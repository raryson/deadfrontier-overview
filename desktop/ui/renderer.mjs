import {localizer} from './strings.mjs';
import {experienceStats} from '../../experience.js';
const api=window.overview,$=id=>document.getElementById(id);
let state,language,drawGeneration=0,previewImage=null,drag=null;
const duration=ms=>{const total=Math.max(0,Math.floor(ms/1000));return [Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(n=>String(n).padStart(2,'0')).join(':');};
function number(value){return new Intl.NumberFormat(language.locale,{maximumFractionDigits:0}).format(value);}
function money(value){return '$'+new Intl.NumberFormat(language.locale,{maximumFractionDigits:2}).format(value);}
function options(id,entries,selected){const element=$(id);if(document.activeElement===element)return;const signature=JSON.stringify(entries);if(element.dataset.options!==signature){const old=element.value;element.replaceChildren(...entries.map(([value,text])=>new Option(text,value)));element.dataset.options=signature;if([...element.options].some(o=>o.value===old))element.value=old;}if(selected!==undefined)element.value=selected;}
function priceSummary(summary){if(!summary)return money(0);return money(summary.cash+summary.estimated)+(summary.unpriced?' · '+language.t('pricePendingCount',{count:summary.unpriced}):'');}
function render(){
  if(!state)return;language=localizer(state.settings.language);
  for(const element of document.querySelectorAll('[data-text]'))element.textContent=language.t(element.dataset.text);
  document.documentElement.lang=language.language;
  $('language').value=state.settings.language??'auto';$('auto').checked=state.settings.autoTrack;$('overlay').checked=state.settings.overlay;
  $('phase').textContent=language.t(state.phase);$('dot').className='status-dot '+state.phase;
  $('game').textContent=state.game?`${state.game.title} · ${state.game.processName}`:'';$('detail').textContent=state.detail;
  $('test').hidden=!state.demo;
  const xp=state.experience,stats=experienceStats(xp);
  $('session-state').textContent=language.t(stats.stale&&xp?.session?.running?'stale':xp?.session?.running?'running':xp?.session?'stopped':'none');
  for(const [id,value]of Object.entries({gained:stats.gained,rate:stats.perHour,lost:stats.lost}))$(id).textContent=xp?.session?number(value):'—';
  const base=xp?.session&&(xp.multiplier||stats.baseGained>0);
  $('base').textContent=base?number(stats.baseGained):'—';$('base-rate').textContent=base?number(stats.basePerHour):'—';
  $('elapsed').textContent=xp?.session?duration(stats.elapsed):'—';
  $('current').textContent=xp?.latest?`${language.t('current')}: ${number(xp.latest.xp)} / ${number(xp.latest.nextLevelXp)} · LV ${xp.latest.level}`:'';
  $('precision').textContent=xp?.latest?language.t('precision',{step:number(xp.latest.precision??1)}):'';
  $('stop').disabled=!xp?.session?.running;$('reset').disabled=!state.game&&!state.demo;
  if(document.activeElement!==$('factor'))$('factor').value=state.settings.multiplier??'';
  if(document.activeElement!==$('process'))$('process').value=state.settings.processName??'';
  $('windows').replaceChildren();
  if(!state.windows.length){const option=new Option(language.t('noWindow'),'');$('windows').append(option);}
  for(const window of state.windows)$('windows').append(new Option(`${window.title} · ${window.processName}`,window.handle));
  $('select-window').disabled=!state.windows.length;
  $('count').textContent=number(state.sessionCount);$('empty').hidden=state.history.length>0;
  $('sessions').replaceChildren();
  for(const entry of state.history){
    const row=document.createElement('tr'),date=new Date(entry.startedAt);
    const values=[date.toLocaleDateString(language.locale)+'\n'+date.toLocaleTimeString(language.locale,{hour:'2-digit',minute:'2-digit'}),number(entry.gained),number(entry.perHour),duration(entry.elapsed),entry.baseAvailable?number(entry.baseGained):'—',entry.baseAvailable?number(entry.basePerHour):'—',number(entry.lost),number(state.lootCounts?.find(row=>row.sessionId===entry.id)?.accepted??0),priceSummary(state.pricing?.sessions?.[entry.id]),[language.t(entry.running?'running':'stopped'),entry.basePartial?language.t('partial'):'',entry.gap?language.t('gap'):''].filter(Boolean).join(' · ')];
    for(const text of values){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('sessions').append(row);
  }
  const accepted=state.lootCounts?.find(row=>row.sessionId===(xp?.session?.id??null))?.accepted??0;
  $('loot-count').textContent=language.t(xp?.session?.id?'lootAccepted':'lootUnassignedAccepted',{count:number(accepted)});
  $('loot-pending').textContent=state.pendingLoot?language.t('lootPending',{item:state.pendingLoot.item}):state.lootProcessing?language.t('lootProcessing'):state.lootCaptureWarning?language.t('lootReadMissed'):state.lootSearching?language.t('lootAnticipating'):'';
  const summary=state.pricing?.sessions?.[xp?.session?.id??'unassigned'];
  $('loot-cash').textContent=money(summary?.cash??0);$('loot-estimate').textContent=money(summary?.estimated??0);$('loot-unpriced').textContent=number(summary?.unpriced??0);
  $('loot-empty').hidden=!!state.loot?.length;
  if(!$('loot-rows').contains(document.activeElement)){
    $('loot-rows').replaceChildren();
    for(const entry of state.loot??[]){
      const row=document.createElement('tr');for(const value of [new Date(entry.foundAt).toLocaleString(language.locale),entry.item+(entry.quantity?' · '+number(entry.quantity)+(entry.unit==='ml'?' ml':' ×'):''),language.t(entry.pickupEvidence==='user-confirmed'?'lootUserConfirmed':entry.status)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      const valuation=entry.valuation,cell=document.createElement('td');cell.textContent=valuation?.value!=null?money(valuation.value)+(valuation.reason==='yard'?' · Yard':valuation.reason==='estimated'?' · '+language.t('priceMarketSource'):''):language.t('priceReason_'+(valuation?.reason??'noQuote'));
      if(valuation?.quote)cell.title=`${valuation.quote.market.label} · ${new Date(valuation.quote.observedAt).toLocaleString(language.locale)} · ${valuation.quote.samples} · ${valuation.quote.name}`;
      if(entry.status==='unconfirmed'||entry.pickupEvidence==='user-confirmed'){
        const button=document.createElement('button');button.textContent=language.t(entry.pickupEvidence==='user-confirmed'?'lootUndoConfirm':'lootConfirm');button.onclick=()=>act(entry.pickupEvidence==='user-confirmed'?'lootUndoConfirm':'lootConfirm',{id:entry.id});cell.append(document.createElement('br'),button);
      }
      if(entry.quantity||entry.quantityUncertain||valuation?.reason==='quantityUnknown'||!entry.cash&&(entry.status==='unconfirmed'||entry.pickupEvidence==='user-confirmed')){
        const form=document.createElement('form'),input=document.createElement('input'),button=document.createElement('button');form.className='quantity-form';input.type='number';input.min='1';input.max='1000000000';input.required=true;input.setAttribute('aria-label',language.t('priceQuantity'));button.textContent=language.t('priceQuantitySave');
        input.value=entry.quantity??'';form.append(input,button);form.onsubmit=async event=>{event.preventDefault();await act('priceQuantity',{id:entry.id,quantity:Number(input.value)});document.activeElement?.blur();render();};cell.append(form);
      }
      if(valuation?.equipment){
        const select=document.createElement('select');select.setAttribute('aria-label',language.t('priceEquipmentSource'));select.append(new Option('Yard / NPC',''));
        for(const quote of state.pricing.catalog.filter(q=>q.source==='market'&&q.itemId.startsWith(valuation.equipment.itemId+'_')))select.append(new Option(`${language.t('priceCustomMarket')} · ${quote.itemId}`,quote.itemId));
        select.value=entry.priceMode==='market'?entry.priceItemId:'';
        select.title=language.t('priceCustomHint');select.onchange=async()=>{await act('priceEquipmentVariant',{id:entry.id,itemId:select.value||null});document.activeElement?.blur();render();};cell.append(select);
      }
      row.append(cell);$('loot-rows').append(row);
    }
  }
  renderPrices();
  if(state.preview&&state.preview.image!==previewImage?.src){const generation=++drawGeneration;const image=new Image();image.onload=()=>{if(drawGeneration!==generation)return;previewImage=image;drawPreview();};image.src=state.preview.image;}
}
async function act(type,value){try{state=await api.action(type,value);if(state){if(['lootConfirm','lootUndoConfirm'].includes(type))document.activeElement?.blur();render();}}catch(error){$('error').hidden=false;$('error').textContent=language?.t(error.message)??error.message;setTimeout(()=>$('error').hidden=true,7000);}}
function renderPrices(){
  const pricing=state.pricing;if(!pricing)return;const bridge=pricing.bridge;
  $('price-direct-state').textContent=language.t('priceNative_'+(pricing.direct?.phase??'idle'));
  $('price-query-status').textContent=pricing.direct?.error?language.t(pricing.direct.error):pricing.direct?.name?pricing.direct.name+' · '+language.t('priceNative_'+pricing.direct.phase):'';
  if(!$('price-item-names').childElementCount)$('price-item-names').replaceChildren(...pricing.catalog.map(item=>new Option(item.name)));
  $('price-bridge-state').textContent=language.t(bridge?.error??(bridge?.clients&&bridge.listening?'pricePaired':bridge?.listening?'priceReady':'priceOff'));
  $('price-disconnect').disabled=!bridge?.clients&&!bridge?.listening;
  $('price-code').hidden=!bridge?.pairCode;$('price-code').textContent=bridge?.pairCode??'';$('price-code-hint').hidden=!bridge?.pairCode;
  $('price-last-sync').textContent=language.t('priceMarketCurrent',{zone:pricing.market})+' · '+(pricing.markets.find(m=>m.market===pricing.market)?.observedAt?new Date(pricing.markets.find(m=>m.market===pricing.market).observedAt).toLocaleString(language.locale):language.t('priceNoQuotes'));
  options('price-market',pricing.marketOptions,pricing.market);
  options('price-alias-from',[...new Set((state.loot??[]).filter(e=>!e.cash).map(e=>e.item))].map(name=>[name,name]));
  options('price-alias-target',pricing.catalog.map(q=>[q.itemId,`${q.name} · ${q.itemId}`]));
  $('price-alias-submit').disabled=!$('price-alias-from').value||!$('price-alias-target').value;
  $('price-catalog').replaceChildren();
  for(const quote of pricing.catalog.filter(q=>q.unitPrice!=null).sort((a,b)=>(b.source==='market')-(a.source==='market')).slice(0,50)){
    const row=document.createElement('tr');for(const text of [quote.name,money(quote.unitPrice)+(quote.unitKind==='ml'?' / ml':''),quote.source==='yard'?'Yard / NPC':language.t('priceMarketSource'),quote.observedAt?new Date(quote.observedAt).toLocaleString(language.locale):'—']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('price-catalog').append(row);
  }
}
function drawPreview(){if(!previewImage)return;const canvas=$('preview');canvas.hidden=false;canvas.width=previewImage.naturalWidth;canvas.height=previewImage.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(previewImage,0,0);const region=drag?{x:Math.min(drag.a.x,drag.b.x),y:Math.min(drag.a.y,drag.b.y),width:Math.abs(drag.a.x-drag.b.x),height:Math.abs(drag.a.y-drag.b.y)}:state.preview.region;ctx.strokeStyle='#ff9c4f';ctx.lineWidth=2;ctx.strokeRect(region.x*canvas.width,region.y*canvas.height,region.width*canvas.width,region.height*canvas.height);}
function point(event){const rect=$('preview').getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};}
$('preview').onpointerdown=event=>{if(!previewImage)return;event.preventDefault();$('preview').setPointerCapture(event.pointerId);drag={a:point(event),b:point(event)};};
$('preview').onpointermove=event=>{if(drag){drag.b=point(event);drawPreview();}};
$('preview').onpointercancel=()=>{drag=null;drawPreview();};
$('preview').onpointerup=event=>{if(!drag)return;drag.b=point(event);const region={x:Math.min(drag.a.x,drag.b.x),y:Math.min(drag.a.y,drag.b.y),width:Math.abs(drag.a.x-drag.b.x),height:Math.abs(drag.a.y-drag.b.y),sourceWidth:state.preview.width,sourceHeight:state.preview.height};drag=null;if(region.width*region.sourceWidth>=100&&region.height*region.sourceHeight>=10)act('region',region).then(()=>act('preview'));drawPreview();};
$('auto').onchange=()=>act('auto',$('auto').checked);$('overlay').onchange=()=>act('overlay',$('overlay').checked);
$('language').onchange=()=>act('language',$('language').value);
$('stop').onclick=()=>act('stop');$('reset').onclick=()=>act('reset');$('export').onclick=()=>act('export');$('quit').onclick=()=>act('quit');
$('factor-form').onsubmit=event=>{event.preventDefault();act('multiplier',$('factor').value===''?null:Number($('factor').value));};
$('process-form').onsubmit=event=>{event.preventDefault();act('process',$('process').value.trim());};
$('select-window').onclick=()=>act('select',$('windows').value);
$('preview-button').onclick=()=>act('preview');$('default-region').onclick=()=>act('defaultRegion');
$('calibration').ontoggle=()=>{if($('calibration').open)act('preview');};
$('price-pair').onclick=()=>act('pricePair');$('price-disconnect').onclick=()=>act('priceDisconnect');
$('price-market').onchange=()=>act('priceMarket',$('price-market').value);
$('price-alias-form').onsubmit=event=>{event.preventDefault();act('priceAlias',{from:$('price-alias-from').value,itemId:$('price-alias-target').value});};
api.subscribe(value=>{state=value;render();});state=await api.read();render();
setInterval(()=>{if(state?.experience?.session?.running){const stats=experienceStats(state.experience);$('elapsed').textContent=duration(stats.elapsed);$('rate').textContent=number(stats.perHour);if(state.experience.multiplier||stats.baseGained>0)$('base-rate').textContent=number(stats.basePerHour);}},1000);

for(const button of document.querySelectorAll('.nav-button'))button.onclick=()=>{const target=document.getElementById(button.dataset.section);if(target?.tagName==='DETAILS')target.open=true;target?.scrollIntoView({behavior:'smooth',block:'start'});for(const item of document.querySelectorAll('.nav-button'))item.classList.toggle('active',item===button);};
$('clear-history').onclick=()=>act('clearHistory');

$('price-query-form').onsubmit=event=>{event.preventDefault();act('priceQuery',{name:$('price-query-name').value,custom:$('price-query-custom').checked});};
$('price-refresh').onclick=()=>act('priceRefresh');
