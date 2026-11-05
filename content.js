(async () => {
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
  const {mountCityPanel}=await import(chrome.runtime.getURL('city-panel.js'));
  const panel=await mountCityPanel(chrome,action=>bankAction(action));
  const frame=panel.frame;
  const send = data => {panel.receive(data);frame.contentWindow?.postMessage(data, extensionOrigin);};
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
  function bankAction(action) {
      if (bankBusy) { send({ type: 'fairview-feedback', message: 'Aguarde a resposta da operação anterior.' }); return; }
      if (!['deposit-all', 'withdraw-all', 'balances'].includes(action)) return;
      bankBusy = true;
      pendingBank = crypto.randomUUID();
      bankTimeout = setTimeout(() => {
        bankBusy = false; pendingBank = null;
        send({ type: 'fairview-feedback', message: 'Sem confirmação da operação. Confira o saldo no jogo antes de repetir.' });
      }, 28000);
      send({ type: 'fairview-feedback', pending: true, message: action === 'balances' ? 'Consultando saldo sem movimentação…' : 'Enviando operação ao banco…' });
      window.postMessage({ type: 'fairview-bank-request', requestId: pendingBank, action }, location.origin);
  }
  window.addEventListener('message', event => {
    // Firefox suppresses source for messages sent by privileged extension pages.
    if ((event.source !== null && event.source !== frame.contentWindow) || event.origin !== extensionOrigin) return;
    const isBank = new URL(location.href).searchParams.get('page') === '15';
    const input = isBank ? document.querySelector('#bankController input#deposit[type="number"]') : null;
    if (event.data?.type === 'fairview-bank-action') {
      bankAction(event.data.action);
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
