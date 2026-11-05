import './quick-buy-model.js';
import {remaining,duration} from './core.js';
import {resolveLanguage,effectLabel,translateMessage} from './i18n.js';

const copy = {
  pt:{city:'CENTRAL DA CIDADE',bank:'Banco rápido',deposit:'Depositar tudo',withdraw:'Sacar tudo',balance:'Consultar saldo',buffs:'Buffs ativos',none:'Nenhum buff ativo',buy:'Compras rápidas',supply:'Comida / Medicina',ammo:'Munição · stacks completas',hint:'Escolha um item para buscar uma stack completa no mercado desta cidade.',more:'Mais ferramentas',close:'Fechar',map:'Bossmap · Região leste',mapToggle:'Mapa',refresh:'Recarregar mapa',mapNote:'Mapa público de terceiros · DFProfiler',quote:'Buscar oferta',confirm:'Confirmar compra',cancel:'Cancelar',searching:'Buscando oferta…',buying:'Comprando…',success:'Compra confirmada',offer:'Menor preço entre as stacks completas retornadas. Oferta válida por 30 segundos.',cash:'Bolso',vault:'Banco',tools:'Ferramentas e configurações',hide:'Recolher painel',show:'Abrir painel',notReady:'Entre na cidade e recarregue a página.',busy:'Aguarde a operação atual terminar.',rateLimit:'Limite de 6 buscas por minuto. Aguarde um pouco.',noStack:'Nenhuma stack completa disponível nesta busca.',expired:'Oferta expirada. Busque novamente.',inventoryFull:'Libere um espaço no inventário.',missed:'Essa oferta já foi vendida. Busque novamente.',refused:'O jogo recusou a operação. Confira sua sessão.',invalidResponse:'Resposta de mercado inválida.',uncertain:'Sem confirmação. Confira o inventário e o saldo antes de repetir.',insufficient:'Saldo insuficiente. Saque no banco antes de comprar.'},
  en:{city:'CITY OVERVIEW',bank:'Quick bank',deposit:'Deposit all',withdraw:'Withdraw all',balance:'Check balance',buffs:'Active buffs',none:'No active buffs',buy:'Quick buys',supply:'Food / Medical',ammo:'Ammo · full stacks',hint:'Choose an item to find a full stack in your current city market.',more:'More tools',close:'Close',map:'Bossmap · Eastern region',mapToggle:'Map',refresh:'Reload map',mapNote:'Third-party public map · DFProfiler',quote:'Find offer',confirm:'Confirm purchase',cancel:'Cancel',searching:'Finding an offer…',buying:'Buying…',success:'Purchase confirmed',offer:'Lowest price among returned full stacks. Offer valid for 30 seconds.',cash:'Cash',vault:'Bank',tools:'Tools and settings',hide:'Collapse panel',show:'Open panel',notReady:'Enter the city and reload this page.',busy:'Wait for the current game operation.',rateLimit:'Limit: 6 searches per minute. Please wait.',noStack:'No full stack available in this search.',expired:'Offer expired. Search again.',inventoryFull:'Free an inventory slot first.',missed:'This offer has already sold. Search again.',refused:'The game refused the operation. Check your session.',invalidResponse:'Invalid market response.',uncertain:'Unconfirmed. Check your inventory and balance before trying again.',insufficient:'Insufficient cash. Withdraw from the bank first.'}
};

export async function mountCityPanel(api,onBank) {
  const preferences=await api.storage.local.get(['language','cityPanel']);
  let lang=resolveLanguage(preferences.language,navigator.languages), c=copy[lang]??copy.en;
  let state={}, balances=null, quickBusy=false, activeQuote=null, quoteTimer, selectedButton;
  const settings={collapsed:false,mapOpen:window.innerWidth>=1540,...preferences.cityPanel};
  const host=document.createElement('div');host.id='df-overview-city';
  const shadow=host.attachShadow({mode:'closed'});
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=api.runtime.getURL('city-panel.css');shadow.append(stylesheet);
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
  const button=(text,callback,className)=>{const node=el('button',text,className);node.type='button';node.onclick=callback;return node;};
  const money=n=>`$${Number(n).toLocaleString(lang==='pt'?'pt-BR':'en-US')}`;
  const save=()=>api.storage.local.set({cityPanel:settings}).catch(()=>{});
  const panel=el('aside',null,'panel');panel.setAttribute('aria-label','DeadFrontier Overview');
  const header=el('header');const brand=el('div');brand.append(el('span',c.city,'eyebrow'),el('strong','DeadFrontier Overview'));header.append(brand);
  const collapse=button('−',()=>{settings.collapsed=!settings.collapsed;layout();save();},'icon');header.append(collapse);panel.append(header);
  const body=el('div',null,'body');panel.append(body);
  const section=title=>{const node=el('section');node.append(el('h2',title));body.append(node);return node;};
  const bank=section(c.bank),bankGrid=el('div',null,'grid');
  bankGrid.append(button(c.deposit,()=>onBank('deposit-all'),'primary'),button(c.withdraw,()=>onBank('withdraw-all')));bank.append(bankGrid);
  const fixedWithdrawals=el('div',null,'withdrawals');
  for(const amount of [10000,50000,100000])fixedWithdrawals.append(button(`${lang==='pt'?'Sacar':'Withdraw'} ${money(amount)}`,()=>onBank(`withdraw-${amount}`)));
  bank.append(fixedWithdrawals);
  bank.append(button(c.balance,()=>onBank('balances'),'text-button'));
  const bankBalances=el('p',null,'balances'),bankStatus=el('p',null,'status');bankStatus.setAttribute('role','status');bank.append(bankBalances,bankStatus);
  const buffs=section(c.buffs),buffList=el('div',null,'buffs');buffs.append(buffList);
  const buys=section(c.buy);buys.append(el('p',c.hint,'muted'));
  for(const [group,title] of [['supply',c.supply],['ammo',c.ammo]]) {
    buys.append(el('h3',title));const grid=el('div',null,'grid');
    for(const item of globalThis.DFOverviewQuick.presets.filter(item=>item.group===group)) {
      const b=button(item.name,()=>{selectedButton=b;performQuick('quote',{id:item.id});},'item');b.dataset.item=item.id;grid.append(b);
    }
    buys.append(grid);
  }
  const quickStatus=el('p',null,'status');quickStatus.setAttribute('role','status');buys.append(quickStatus);
  const footer=el('footer');footer.append(button(c.mapToggle,()=>{settings.mapOpen=!settings.mapOpen;layout();save();}),button(c.more,()=>{tools.hidden=false;frame.src ||= api.runtime.getURL('dashboard.html');}));body.append(footer);
  const map=el('aside',null,'map panel');const mapHeader=el('header');mapHeader.append(el('strong',c.map));
  mapHeader.append(button('×',()=>{settings.mapOpen=false;layout();save();},'icon'));map.append(mapHeader);
  const mapFrame=el('iframe');mapFrame.title='DFProfiler Bossmap';mapFrame.referrerPolicy='no-referrer';mapFrame.setAttribute('sandbox','allow-scripts allow-same-origin');
  map.append(mapFrame);const mapFooter=el('footer');const link=el('a',c.mapNote);link.href='https://www.dfprofiler.com/bossmap';link.target='_blank';link.rel='noopener noreferrer';mapFooter.append(link,button('↻',()=>{mapFrame.src='https://www.dfprofiler.com/bossmap#dfov-east';},'icon'));mapFooter.lastChild.title=c.refresh;map.append(mapFooter);
  const tools=el('div',null,'tools');tools.hidden=true;const toolsBar=el('header');toolsBar.append(el('strong',c.tools),button(c.close,()=>{tools.hidden=true;}));
  const frame=el('iframe');frame.title=c.tools;frame.allow='picture-in-picture; clipboard-write';tools.append(toolsBar,frame);
  const dialog=el('dialog');dialog.setAttribute('aria-label',c.confirm);const offerName=el('h2'),offerPrice=el('p',null,'offer-price'),offerNote=el('p',c.offer,'muted');
  const accept=button(c.confirm,()=>{const q=activeQuote;dialog.close();if(q)performQuick('buy',{quoteId:q.quoteId});},'primary');
  dialog.append(offerName,offerPrice,offerNote,el('div',null,'dialog-actions'));dialog.lastChild.append(button(c.cancel,()=>dialog.close()),accept);
  dialog.addEventListener('close',()=>{clearTimeout(quoteTimer);selectedButton?.focus();});
  shadow.append(panel,map,tools,dialog);document.documentElement.append(host);
  // The game's frame is a fixed-width table around both sidebar and inventory.
  // Keep its original position and fill the actual free space on either side.
  function gameFrame() {
    let node=document.getElementById('block13')??document.getElementById('sidebar')??document.getElementById('htmlFlashReplace'),frame=null;
    for(;node&&node!==document.body;node=node.parentElement) {
      if(node.tagName!=='TABLE')continue;
      const width=node.getAttribute('width');
      if(!/^\d+$/.test(width??'')||Number(width)<850||Number(width)>1200)continue;
      if(!frame||node.getBoundingClientRect().width>frame.getBoundingClientRect().width)frame=node;
    }
    return frame;
  }
  function layout() {
    body.hidden=settings.collapsed;collapse.textContent=settings.collapsed?'+':'−';collapse.title=settings.collapsed?c.show:c.hide;collapse.setAttribute('aria-expanded',String(!settings.collapsed));
    panel.classList.toggle('collapsed',settings.collapsed);map.hidden=!settings.mapOpen;
    if(settings.mapOpen && !mapFrame.getAttribute('src'))mapFrame.src='https://www.dfprofiler.com/bossmap#dfov-east';
    const bounds=gameFrame()?.getBoundingClientRect();
    const width=document.documentElement.clientWidth;
    const leftSpace=bounds?Math.max(0,bounds.left-8):0;
    const rightSpace=bounds?Math.max(0,width-bounds.right-8):0;
    // Narrow windows retain the collapsible overlay instead of covering the game
    // with an unreadably thin dock. Desktop docks meet the game frame exactly.
    map.style.width=leftSpace>=260?`${leftSpace}px`:'';
    map.style.left=leftSpace>=260?'8px':'';
    panel.style.width=rightSpace>=260&&!settings.collapsed?`${rightSpace}px`:'';
    panel.style.right=rightSpace>=260?'8px':'';
    host.style.setProperty('--dfov-tools-right',rightSpace>=260?`${rightSpace+16}px`:'320px');
  }
  let layoutFrame;
  const scheduleLayout=()=>{cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(layout);};
  layout();window.addEventListener('resize',scheduleLayout);window.addEventListener('scroll',scheduleLayout,{passive:true});
  const observedFrame=gameFrame();if(observedFrame)new ResizeObserver(scheduleLayout).observe(observedFrame);
  window.addEventListener('load',scheduleLayout,{once:true});
  const pending=new Map();
  function performQuick(action,data={}) {
    if(quickBusy && action!=='context')return;
    if(action!=='context'){quickBusy=true;quickStatus.textContent=action==='buy'?c.buying:c.searching;for(const b of buys.querySelectorAll('button'))b.disabled=true;}
    const requestId=crypto.randomUUID();
    const timer=setTimeout(()=>{pending.delete(requestId);if(action!=='context')finishQuick({ok:false,error:'uncertain'});},18000);
    pending.set(requestId,{timer,action});window.postMessage({type:'overview-quick-request',requestId,action,...data},location.origin);
  }
  function finishQuick(result) {
    quickBusy=false;for(const b of buys.querySelectorAll('button'))b.disabled=false;
    if(!result.ok){quickStatus.textContent=result.error==='cash'?c.insufficient:(c[result.error]??c.uncertain);return;}
    if(result.action==='quote') {
      activeQuote=result.quote;offerName.textContent=activeQuote.name;offerPrice.textContent=`${activeQuote.quantity.toLocaleString()} ${activeQuote.id==='fuelammo'?'ml':'×'} · ${money(activeQuote.price)}`;
      quickStatus.textContent='';accept.disabled=false;accept.textContent=c.confirm;dialog.showModal();accept.focus();
      quoteTimer=setTimeout(()=>{accept.disabled=true;accept.textContent=c.expired;activeQuote=null;},Math.max(0,activeQuote.expiresAt-Date.now()));
    } else {quickStatus.textContent=`${c.success}: ${result.name} × ${result.quantity} · ${money(result.price)}`;if(balances){balances.cash=result.cash;renderBalances();}}
  }
  window.addEventListener('message',event=>{
    if(event.source!==window || event.origin!==location.origin || event.data?.type!=='overview-quick-result')return;
    const entry=pending.get(event.data.requestId);if(!entry)return;clearTimeout(entry.timer);pending.delete(event.data.requestId);
    if(entry.action==='context') {
      if(event.data.ok)for(const item of event.data.items??[]){const b=buys.querySelector(`[data-item="${CSS.escape(item.id)}"]`);if(b){b.title=`${item.name} · ${item.quantity.toLocaleString()}${item.id==='fuelammo'?' ml':''}`;if(item.group==='ammo')b.textContent=`${item.name} (${item.quantity.toLocaleString()}${item.id==='fuelammo'?' ml':''})`;}}
    } else finishQuick(event.data);
  });
  function renderBalances(){if(balances)bankBalances.textContent=`${c.cash}: ${money(balances.cash)} · ${c.vault}: ${money(balances.bank)}`;}
  function renderBuffs() {
    const active=Object.entries(state.timers??{}).filter(([,timer])=>remaining(timer,Date.now(),state.paused)>0);
    const fragment=document.createDocumentFragment();
    for(const [key,timer] of active){const row=el('div',null,'buff');row.append(el('span',effectLabel(key,lang)),el('b',duration(remaining(timer,Date.now(),state.paused))));fragment.append(row);}
    if(!active.length)fragment.append(el('p',c.none,'muted'));buffList.replaceChildren(fragment);
  }
  api.runtime.sendMessage({type:'read'}).then(result=>{state=result.data??{};renderBuffs();}).catch(()=>{});renderBuffs();
  api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.state){state=changes.state.newValue??{};renderBuffs();}});
  setInterval(()=>{if(!document.hidden&&!settings.collapsed)renderBuffs();},1000);
  performQuick('context');
  return {frame,receive(data){
    if(data.type==='fairview-balances'){balances={cash:data.cash,bank:data.bank};renderBalances();}
    if(data.type==='fairview-feedback'){bankStatus.textContent=translateMessage(data.message??'',lang);for(const b of bank.querySelectorAll('button'))b.disabled=data.pending===true;}
  }};
}
