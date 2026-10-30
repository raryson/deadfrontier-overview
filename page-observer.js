// Runs in MAIN world. Never exports request bodies, cookies, passwords or tokens.
(() => {
  const fieldNames = ['df_servertime', ...['exp', 'damage', 'speed'].flatMap(key =>
    [`df_boost${key}until`, `df_boost${key}until_ex`])];
  const allowedPaths = new Set(['/onlinezombiemmo/inventory_new.php', '/onlinezombiemmo/get_values.php', '/onlinezombiemmo/bank.php']);
  const requests = new WeakMap();
  const isRelevant = value => {
    try { const url = new URL(value, location.href); return url.origin === location.origin && allowedPaths.has(url.pathname); } catch { return false; }
  };
  function publish(values, source, item = '') {
    const fields = {};
    for (const key of fieldNames) {
      const value = values[`DFSTATS_${key}`] ?? values[key];
      if (value !== undefined && /^\d+$/.test(String(value))) fields[key] = Number(value);
    }
    if (!Object.hasOwn(fields, 'df_servertime') || Object.keys(fields).length < 2) return;
    const account = typeof userVars !== 'undefined' ? String(userVars.userID ?? '') : '';
    if (!/^\d{1,20}$/.test(account)) return;
    window.postMessage({ type: 'fairview-server-buffs', fields, account, source, item: String(item).slice(0, 100), observedAt: Date.now() }, location.origin);
  }
  function observe(text, status, item) {
    if (status !== 200 || typeof text !== 'string' || text.length > 2000000 || /^\s*status=/.test(text)) return;
    const values = {};
    const params = new URLSearchParams(text);
    for (const key of fieldNames) {
      const value = params.get(key) ?? params.get(`DFSTATS_${key}`);
      if (value !== null) values[key] = value;
    }
    publish(values, 'response', item);
  }
  function itemName(body) {
    try { return typeof body === 'string' || body instanceof URLSearchParams ? new URLSearchParams(body).get('expected_itemtype') || '' : ''; } catch { return ''; }
  }
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    requests.set(this, { relevant: isRelevant(url) });
    return Reflect.apply(originalOpen, this, [method, url, ...args]);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const meta = requests.get(this);
    if (meta?.relevant) {
      const item = itemName(body);
      this.addEventListener('load', () => {
        try { if ((!this.responseType || this.responseType === 'text') && isRelevant(this.responseURL)) observe(this.responseText, this.status, item); } catch { /* Observation must not interrupt the game. */ }
      }, { once: true });
    }
    return Reflect.apply(originalSend, this, arguments);
  };
  const originalFetch = window.fetch;
  if (originalFetch) window.fetch = function(input, init) {
    const result = Reflect.apply(originalFetch, this, arguments);
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    if (isRelevant(url)) result.then(response => {
      if (isRelevant(response.url)) response.clone().text().then(text => observe(text, response.status, itemName(init?.body))).catch(() => {});
    }).catch(() => {});
    return result;
  };
  // Read only explicitly listed timer fields from the game's initial state.
  let attempts = 0;
  const startup = setInterval(() => {
    attempts++;
    try {
      if (typeof userVars !== 'undefined' && userVars.DFSTATS_df_servertime !== undefined) {
        publish(userVars, 'page'); clearInterval(startup);
      }
    } catch { /* The page may still be initializing. */ }
    if (attempts >= 60) clearInterval(startup);
  }, 500);
})();
