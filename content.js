(() => {
  const chrome = globalThis.browser ?? globalThis.chrome;
  const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '');
  let xpContext=null, xpPending=null, xpTimeout;
  chrome.runtime.sendMessage({type:'xpContext'}).then(result=>{xpContext=result.data;}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes.state && xpContext) xpContext.experience=changes.state.newValue?.experience;});
  function refreshXp(start=false) {
    if(xpPending) return Promise.resolve({error:'Aguarde a operação atual do jogo terminar.'});
    return new Promise(resolve=>{
      const requestId=crypto.randomUUID(); xpPending={requestId,start,resolve};
      xpTimeout=setTimeout(()=>{xpPending=null;resolve({error:'Não foi possível atualizar a XP salva no servidor.'});},17000);
      window.postMessage({type:'overview-xp-request',requestId},location.origin);
    });
  }
  window.addEventListener('message',event=>{
    if(event.source!==window || event.origin!==location.origin) return;
    if(event.data?.type==='overview-market-context'&&/^\d{1,6}$/.test(String(event.data.zone)))chrome.runtime.sendMessage({type:'marketContext',zone:String(event.data.zone)}).catch(()=>{});
    if(event.data?.type==='overview-item-catalog'&&Array.isArray(event.data.snapshot?.items)&&event.data.snapshot.items.length<=500)chrome.runtime.sendMessage({type:'itemCatalog',snapshot:event.data.snapshot}).catch(()=>{});
    if(event.data?.type==='overview-server-xp') chrome.runtime.sendMessage({type:'xpSnapshot',sample:event.data.sample}).catch(()=>{});
    if(event.data?.type==='overview-xp-result' && xpPending?.requestId===event.data.requestId) {
      const pending=xpPending;xpPending=null;clearTimeout(xpTimeout);
      if(event.data.sample) chrome.runtime.sendMessage({type:'xpSnapshot',sample:event.data.sample,start:pending.start}).then(result=>pending.resolve(result.error?{error:result.error}:{ok:true})).catch(()=>pending.resolve({error:'Não foi possível atualizar a XP salva no servidor.'}));
      else pending.resolve({error:event.data.error});
    }
  });
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id || message?.type!=='overview-xp-refresh')return;
    refreshXp(message.start===true).then(reply); return true;
  });
  setInterval(()=>{
    if(xpContext?.experience?.session?.running && !xpContext.experience.capture?.active && xpContext.experience.ownerTabId===xpContext.tabId) refreshXp().catch(()=>{});
  },30000);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'fairview-server-buffs') return;
    chrome.runtime.sendMessage({ type: 'serverSnapshot', snapshot: event.data }).catch(() => {});
  });
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = 'button{background:linear-gradient(#d87835,#9c4025);color:#fff0df;border:1px solid #e19454;border-radius:4px;padding:12px 16px;cursor:pointer;font:bold 12px Segoe UI;box-shadow:0 2px 10px #000a,inset 0 1px #ffc58644}button:hover{filter:brightness(1.12)}button:focus-visible{outline:2px solid #ffb26d;outline-offset:3px}iframe{display:block;width:min(420px,calc(100vw - 28px));height:min(780px,calc(100vh - 90px));border:1px solid #784631;border-radius:5px;margin-bottom:10px;background:#17110f}iframe[hidden]{display:none}';
  const frame = document.createElement('iframe'); frame.src = chrome.runtime.getURL('dashboard.html'); frame.title = 'DeadFrontier Overview'; frame.hidden = true;
  frame.allow = 'picture-in-picture; clipboard-write';
  const toggle = document.createElement('button'); toggle.textContent = '◈ DeadFrontier Overview'; toggle.setAttribute('aria-expanded', 'false');
  toggle.onclick = () => { frame.hidden = !frame.hidden; toggle.setAttribute('aria-expanded', String(!frame.hidden)); };
  shadow.append(style, frame, toggle); document.documentElement.append(host);
  const send = data => frame.contentWindow.postMessage(data, extensionOrigin);
  let bankBusy = false;
  let pendingBank = null;
  let bankTimeout;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'fairview-bank-result' || !pendingBank || event.data.requestId !== pendingBank) return;
    pendingBank = null; bankBusy = false; clearTimeout(bankTimeout);
    if (event.data.ok === true && [event.data.cash, event.data.bank].every(n => Number.isSafeInteger(n) && n >= 0)) {
      send({ type: 'fairview-feedback', key:'result', values:{resultKey:event.data.readOnly?'balanceChecked':'operationConfirmed',cash:event.data.cash,bank:event.data.bank}, message: `${event.data.readOnly ? 'Saldo consultado' : 'Operação confirmada'}. Bolso: $${event.data.cash.toLocaleString('en-US')} · Banco: $${event.data.bank.toLocaleString('en-US')}` });
      send({ type: 'fairview-balances', cash: event.data.cash, bank: event.data.bank });
    } else send({ type: 'fairview-feedback', message: typeof event.data.error === 'string' ? event.data.error : 'Confira os saldos no jogo antes de tentar novamente.' });
  });
  window.addEventListener('message', event => {
    // Firefox suppresses source for messages sent by privileged extension pages.
    if ((event.source !== null && event.source !== frame.contentWindow) || event.origin !== extensionOrigin) return;
    const isBank = new URL(location.href).searchParams.get('page') === '15';
    const input = isBank ? document.querySelector('#bankController input#deposit[type="number"]') : null;
    if (event.data?.type === 'fairview-bank-action') {
      if (bankBusy) { send({ type: 'fairview-feedback', message: 'Aguarde a resposta da operação anterior.' }); return; }
      const action = event.data.action;
      if (!['deposit-all', 'withdraw-all', 'balances'].includes(action)) return;
      bankBusy = true;
      pendingBank = crypto.randomUUID();
      bankTimeout = setTimeout(() => {
        bankBusy = false; pendingBank = null;
        send({ type: 'fairview-feedback', message: 'Sem confirmação da operação. Confira o saldo no jogo antes de repetir.' });
      }, 28000);
      send({ type: 'fairview-feedback', pending: true, message: action === 'balances' ? 'Consultando saldo sem movimentação…' : 'Enviando operação ao banco…' });
      window.postMessage({ type: 'fairview-bank-request', requestId: pendingBank, action }, location.origin);
      return;
    }
    if (event.data?.type === 'fairview-read-cash') {
      const amount = input?.max ? Number(input.max) : NaN;
      if (Number.isSafeInteger(amount) && amount >= 0) send({ type: 'fairview-cash', amount });
      else send({ type: 'fairview-feedback', message: 'Abra o banco do jogo para ler o dinheiro disponível.' });
    }
    if (event.data?.type !== 'fairview-fill-deposit') return;
    const amount = event.data.amount;
    if (!input || input.disabled || input.readOnly || !input.max || !Number.isSafeInteger(amount) || amount < 0 || amount > Number(input.max)) {
      send({ type: 'fairview-feedback', message: 'Abra o banco e confira o dinheiro disponível antes de preencher.' }); return;
    }
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(amount));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: '0' }));
    input.focus();
    send({ type: 'fairview-feedback', message: 'Valor preenchido. Confira e confirme pelo botão deposit do jogo.' });
  });
})();
