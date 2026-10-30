// MAIN world only: authentication stays inside the game's page.
(() => {
  let busy = false;
  async function bankCredentials() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      // Read the same bank bootstrap that bank.js uses, without navigating to it.
      const response = await window.fetch('/onlinezombiemmo/index.php?page=15', { credentials: 'same-origin', signal: controller.signal });
      const url = new URL(response.url);
      if (!response.ok || url.origin !== location.origin || url.pathname !== '/onlinezombiemmo/index.php' || url.searchParams.get('page') !== '15') throw Error('A sessão do banco foi redirecionada. Reabra sua sessão no jogo.');
      const html = await response.text();
      if (html.length > 2000000) throw Error('A página de inicialização do banco excedeu o limite esperado.');
      const match = /\binitBank\(\s*("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')\s*\)/.exec(html);
      if (!match) throw Error('Não foi possível localizar a inicialização do banco. Nenhuma movimentação foi enviada.');
      // Decode only a literal string; never execute fetched HTML or JavaScript.
      const data = match[1].slice(1, -1).replace(/\\(u[\da-fA-F]{4}|x[\da-fA-F]{2}|[\s\S])/g, (_, escape) => {
        if (escape[0] === 'u') return String.fromCharCode(parseInt(escape.slice(1), 16));
        if (escape[0] === 'x') return String.fromCharCode(parseInt(escape.slice(1), 16));
        return ({ n:'\n', r:'\r', t:'\t', b:'\b', f:'\f', v:'\v', '0':'\0' })[escape] ?? escape;
      });
      const credentials = {};
      for (const part of data.split('&')) {
        const index = part.indexOf('='); const key = part.slice(0, index);
        if (index >= 0 && ['sc', 'userID', 'password'].includes(key)) credentials[key] = part.slice(index + 1);
      }
      if (['sc', 'userID', 'password'].some(key => !credentials[key]) || String(credentials.userID) !== String(userVars.userID)) throw Error('A inicialização do banco não corresponde ao personagem ativo. Nenhuma movimentação foi enviada.');
      return credentials;
    } finally { clearTimeout(timeout); }
  }
  const actions = { 'deposit-all': ['deposit', '9999999999999'], 'withdraw-all': ['withdraw', '100000000000000000'], balances: [] };
  const respond = (requestId, result) => window.postMessage({ type: 'fairview-bank-result', requestId, ...result }, location.origin);
  window.addEventListener('message', async event => {
    // Firefox sets source=null for postMessage sent by a privileged content script.
    // Still restrict the origin, message type, action and destination endpoint.
    if ((event.source !== null && event.source !== window) || event.origin !== location.origin || event.data?.type !== 'fairview-bank-request') return;
    const { requestId, action } = event.data;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) return;
    if (!Object.hasOwn(actions, action)) { respond(requestId, { ok: false, error: 'Operação inválida.' }); return; }
    if (busy || (typeof pageLock !== 'undefined' && pageLock)) { respond(requestId, { ok: false, error: 'Aguarde a operação atual do jogo terminar.' }); return; }
    if (typeof userVars === 'undefined' || ['sc', 'userID', 'password'].some(key => userVars[key] === undefined || userVars[key] === null || String(userVars[key]) === '')) {
      respond(requestId, { ok: false, error: 'Sessão indisponível. Entre no jogo e recarregue esta página.' }); return;
    }
    const [operation, amount] = actions[action];
    const readOnly = action === 'balances';
    const endpoint = readOnly ? '/onlinezombiemmo/get_values.php' : '/onlinezombiemmo/bank.php';
    busy = true;
    const hasPageLock = typeof pageLock !== 'undefined';
    if (hasPageLock) pageLock = true;
    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true; busy = false;
      if (hasPageLock) pageLock = false;
      respond(requestId, result);
    };
    const uncertain = reason => finish({ ok: false, error: `Não foi possível confirmar ${readOnly ? 'o saldo' : 'a operação'} [${reason}]. Confira o saldo no jogo antes de repetir.` });
    let credentials;
    try { credentials = readOnly ? userVars : await bankCredentials(); }
    catch (error) {
      finish({ ok: false, error: error.name === 'AbortError' ? 'A inicialização do banco demorou demais. Nenhuma movimentação foi enviada.' : error.message }); return;
    }
    // Match bank.js's order and base.js's serialization, including prepared values.
    const params = {};
    if (!readOnly) params[operation] = amount;
    params.sc = credentials.sc; params.userID = credentials.userID; params.password = credentials.password;
    const body = typeof objectJoin === 'function' ? objectJoin(params) : Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&');
    const xhr = new XMLHttpRequest();
    xhr.timeout = 15000;
    xhr.addEventListener('load', () => {
      try {
        const url = new URL(xhr.responseURL);
        if (xhr.status !== 200) { uncertain(`HTTP ${xhr.status}`); return; }
        if (url.origin !== location.origin || url.pathname !== endpoint) {
          const destination = url.origin === location.origin ? url.pathname.replace(/[^a-zA-Z0-9_./-]/g, '').slice(0, 120) : 'outro domínio';
          uncertain(`resposta redirecionada para ${destination}`); return;
        }
        const text = xhr.responseText.trim();
        if (!text) { uncertain('resposta vazia'); return; }
        if (text.startsWith('<')) { uncertain('servidor retornou HTML'); return; }
        const result = new URLSearchParams(text);
        if (result.has('status')) { finish({ ok: false, error: 'O servidor recusou a operação. Confira sua sessão e o saldo no jogo.' }); return; }
        const cashText = result.get('df_cash'); const bankText = result.get('df_bankcash');
        if (!/^\d+$/.test(cashText ?? '') || !/^\d+$/.test(bankText ?? '')) {
          const fieldStatus = value => value === null ? 'ausente' : /^\d+$/.test(value) ? 'presente' : 'inválido';
          uncertain(`HTTP 200; bolso ${fieldStatus(cashText)}; banco ${fieldStatus(bankText)}`); return;
        }
        const cash = Number(cashText), bank = Number(bankText);
        if (![cash, bank].every(Number.isSafeInteger)) { uncertain('saldo fora do limite numérico'); return; }
        userVars.DFSTATS_df_cash = cash;
        userVars.DFSTATS_df_bankcash = bank;
        // Keep bank.js's private view consistent if the bank happens to be open.
        if (typeof pData !== 'undefined') { pData.df_cash = cash; pData.df_bankcash = bank; }
        for (const element of document.querySelectorAll('.heldCash')) {
          element.textContent = `Cash: $${cash.toLocaleString('en-US')}`;
          element.dataset.cash = element.textContent;
        }
        if (document.getElementById('bankController') && typeof setupBank === 'function') setupBank();
        finish({ ok: true, cash, bank, readOnly });
      } catch { uncertain('falha ao interpretar resposta'); }
    }, { once: true });
    xhr.addEventListener('error', () => uncertain('erro de rede'), { once: true });
    xhr.addEventListener('timeout', () => uncertain('tempo de resposta esgotado'), { once: true });
    xhr.addEventListener('abort', () => uncertain('requisição cancelada'), { once: true });
    try {
      xhr.open('POST', endpoint);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.send(body);
    } catch { uncertain('falha ao enviar requisição'); }
  });
})();
