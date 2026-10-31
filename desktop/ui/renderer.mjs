import {localizer} from './strings.mjs';
import {experienceStats} from '../../experience.js';
const api=window.overview,$=id=>document.getElementById(id);
let state,language,drawGeneration=0,previewImage=null,drag=null;
const duration=ms=>{const total=Math.max(0,Math.floor(ms/1000));return [Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(n=>String(n).padStart(2,'0')).join(':');};
function number(value){return new Intl.NumberFormat(language.locale,{maximumFractionDigits:0}).format(value);}
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
    const values=[date.toLocaleDateString(language.locale)+'\n'+date.toLocaleTimeString(language.locale,{hour:'2-digit',minute:'2-digit'}),number(entry.gained),number(entry.perHour),duration(entry.elapsed),entry.baseAvailable?number(entry.baseGained):'—',entry.baseAvailable?number(entry.basePerHour):'—',number(entry.lost),[language.t(entry.running?'running':'stopped'),entry.basePartial?language.t('partial'):'',entry.gap?language.t('gap'):''].filter(Boolean).join(' · ')];
    for(const text of values){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('sessions').append(row);
  }
  if(state.preview&&state.preview.image!==previewImage?.src){const generation=++drawGeneration;const image=new Image();image.onload=()=>{if(drawGeneration!==generation)return;previewImage=image;drawPreview();};image.src=state.preview.image;}
}
async function act(type,value){try{state=await api.action(type,value);if(state)render();}catch(error){$('error').hidden=false;$('error').textContent=error.message;setTimeout(()=>$('error').hidden=true,7000);}}
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
api.subscribe(value=>{state=value;render();});state=await api.read();render();
setInterval(()=>{if(state?.experience?.session?.running){const stats=experienceStats(state.experience);$('elapsed').textContent=duration(stats.elapsed);$('rate').textContent=number(stats.perHour);if(state.experience.multiplier||stats.baseGained>0)$('base-rate').textContent=number(stats.basePerHour);}},1000);
