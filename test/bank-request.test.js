import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../bank-request.js', import.meta.url), 'utf8');
function harness() {
  const emitted = [], sent = [], handlers = [];
  const location = { origin: 'https://fairview.deadfrontier.com' };
  class XHR {
    listeners = {};
    addEventListener(name, fn) { this.listeners[name] = fn; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.header = [name,value]; }
    send(body) { this.body = body; sent.push(this); }
    complete(text, status = 200, url = `${location.origin}/onlinezombiemmo/bank.php`) {
      this.responseText = text; this.status = status; this.responseURL = url; this.listeners.load();
    }
  }
  const cashElement = { textContent: '', dataset:{} };
  const window = {addEventListener:(_, fn)=>handlers.push(fn),postMessage:message=>emitted.push(message)};
  const context = {window, location, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, XMLHttpRequest:XHR, userVars:{sc:'TOKEN',userID:'123',password:'SECRET'}, pageLock:false, document:{querySelectorAll:()=>[cashElement],getElementById:()=>null}};
  window.fetch = async () => ({ok:true, url:`${location.origin}/onlinezombiemmo/index.php?page=15`, text:async()=>context.bankHtml ?? `initBank(${JSON.stringify(`sc=${context.userVars.sc}&userID=${context.userVars.userID}&password=${context.userVars.password}`)})`});
  vm.runInNewContext(source, context);
  const action = (operation, extra = {}) => handlers[0]({source:window, origin:location.origin, data:{type:'fairview-bank-request',requestId:'test-1',action:operation},...extra});
  return {action,emitted,sent,context,cashElement};
}
test('depósito total funciona sem banco no DOM e usa somente endpoint fixo', async () => {
  const h = harness(); await h.action('deposit-all');
  assert.equal(h.sent.length,1);
  const xhr = h.sent[0], body = new URLSearchParams(xhr.body);
  assert.equal(xhr.method,'POST'); assert.equal(xhr.url,'/onlinezombiemmo/bank.php');
  assert.equal(xhr.body,'deposit=9999999999999&sc=TOKEN&userID=123&password=SECRET');
  assert.equal(body.get('deposit'),'9999999999999'); assert.equal(body.get('withdraw'),null);
  assert.equal(body.get('password'),'SECRET'); assert.equal(h.context.pageLock,true);
  xhr.complete('df_cash=0&df_bankcash=12345');
  assert.equal(h.context.userVars.DFSTATS_df_cash,0);
  assert.equal(h.cashElement.textContent,'Cash: $0'); assert.equal(h.context.pageLock,false);
  assert.equal(h.emitted[0].ok,true); assert.equal(h.emitted[0].bank,12345);
  assert.ok(!JSON.stringify(h.emitted).includes('SECRET')); assert.ok(!JSON.stringify(h.emitted).includes('TOKEN'));
});
test('saque total utiliza o parâmetro do jogo e atualiza saldos confirmados', async () => {
  const h = harness(); await h.action('withdraw-all');
  assert.equal(new URLSearchParams(h.sent[0].body).get('withdraw'),'100000000000000000');
  h.sent[0].complete('df_cash=12345&df_bankcash=0');
  assert.equal(h.emitted[0].cash,12345); assert.equal(h.emitted[0].bank,0);
});

test('saques rápidos enviam o valor fixo escolhido e mantêm a trava até confirmar', async () => {
  for (const amount of [10000,50000,100000]) {
    const h=harness();await h.action(`withdraw-${amount}`);
    assert.equal(h.sent.length,1);
    const params=new URLSearchParams(h.sent[0].body);
    assert.equal(params.get('withdraw'),String(amount));assert.equal(params.has('deposit'),false);
    assert.equal(h.sent[0].url,'/onlinezombiemmo/bank.php');assert.equal(h.context.pageLock,true);
    await h.action(`withdraw-${amount}`);assert.equal(h.sent.length,1);
    h.sent[0].complete(`df_cash=${amount}&df_bankcash=500000`);
    assert.equal(h.emitted.at(-1).ok,true);assert.equal(h.emitted.at(-1).cash,amount);assert.equal(h.context.pageLock,false);
  }
});

test('saque rápido não aceita valores fora dos atalhos nem valor sobrescrito na mensagem',async()=>{
  const h=harness();await h.action('withdraw-999999');assert.equal(h.sent.length,0);
  await h.action('withdraw-10000',{data:{type:'fairview-bank-request',requestId:'test-2',action:'withdraw-10000',amount:999999}});
  assert.equal(new URLSearchParams(h.sent[0].body).get('withdraw'),'10000');
  h.sent[0].complete('df_cash=10000&df_bankcash=100');
});
test('Firefox aceita mensagem do content script com source nulo e origem correta', async () => {
  const h = harness(); await h.action('deposit-all', { source: null });
  assert.equal(h.sent.length, 1);
  h.sent[0].complete('df_cash=0&df_bankcash=100');
  assert.equal(h.emitted[0].ok, true);
});
test('cliques concorrentes e trava nativa não geram uma segunda requisição', async () => {
  const h = harness(); await h.action('deposit-all'); await h.action('withdraw-all');
  assert.equal(h.sent.length,1); assert.equal(h.emitted[0].ok,false);
  h.sent[0].complete('df_cash=0&df_bankcash=1');
  h.context.pageLock=true; await h.action('withdraw-all'); assert.equal(h.sent.length,1);
});
test('origem externa, operação inválida e ausência de sessão não enviam requisições', async () => {
  const h=harness(); await h.action('deposit-all',{origin:'https://other.example'}); await h.action('donate');
  await h.action('deposit-all',{source:null, origin:'https://other.example'});
  delete h.context.userVars.password; await h.action('deposit-all'); assert.equal(h.sent.length,0);
});
test('erro, redirecionamento ou resposta incompleta não confirmam nem repetem operação', async () => {
  for (const [text,status,url] of [['status=cash',200],['df_cash=0',200],['df_cash=0&df_bankcash=1',500],['df_cash=0&df_bankcash=1',200,'https://other.example/bank.php']]) {
    const h=harness(); await h.action('deposit-all'); h.sent[0].complete(text,status,url);
    assert.equal(h.emitted[0].ok,false); assert.equal(h.sent.length,1); assert.equal(h.context.pageLock,false);
    assert.equal(h.context.userVars.DFSTATS_df_cash,undefined);
  }
});
test('timeout retorna resultado incerto e não tenta novamente', async () => {
  const h=harness(); await h.action('deposit-all'); h.sent[0].listeners.timeout();
  assert.equal(h.sent.length,1); assert.equal(h.emitted[0].ok,false);
  assert.match(h.emitted[0].error,/antes de repetir/); assert.equal(h.context.pageLock,false);
});
test('consulta saldo usa get_values sem parâmetros de movimentação', async () => {
  const h=harness(); await h.action('balances');
  const xhr=h.sent[0], params=new URLSearchParams(xhr.body);
  assert.equal(xhr.url,'/onlinezombiemmo/get_values.php');
  assert.equal(params.has('deposit'),false); assert.equal(params.has('withdraw'),false);
  xhr.complete('df_cash=123&df_bankcash=456',200,'https://fairview.deadfrontier.com/onlinezombiemmo/get_values.php');
  assert.equal(h.emitted[0].ok,true); assert.equal(h.emitted[0].readOnly,true);
  assert.equal(h.emitted[0].cash,123); assert.equal(h.emitted[0].bank,456);
});
test('diagnóstico diferencia HTTP, HTML, vazio e campo ausente sem revelar corpo', async () => {
  for (const [text,status,expected] of [['SECRET',503,/HTTP 503/],['<html>SECRET</html>',200,/retornou HTML/],['',200,/resposta vazia/],['df_cash=0&private=SECRET',200,/bolso presente; banco ausente/]]) {
    const h=harness(); await h.action('balances');
    h.sent[0].complete(text,status,'https://fairview.deadfrontier.com/onlinezombiemmo/get_values.php');
    assert.equal(h.emitted[0].ok,false); assert.match(h.emitted[0].error,expected);
    assert.ok(!JSON.stringify(h.emitted).includes('SECRET')); assert.equal(h.sent.length,1);
  }
});
test('serialização mantém valores preparados pelo jogo sem codificação duplicada', async () => {
  const h=harness(); h.context.userVars.sc='token%2Bprepared';
  await h.action('withdraw-all');
  assert.equal(h.sent[0].body,'withdraw=100000000000000000&sc=token%2Bprepared&userID=123&password=SECRET');
});
test('movimentação usa contexto do banco sem substituir credenciais do inventário', async () => {
  const h=harness();
  h.context.bankHtml = `<script>initBank('sc=BANKTOKEN&userID=123&password=BANKSECRET');</script>`;
  await h.action('deposit-all');
  assert.equal(h.sent[0].body,'deposit=9999999999999&sc=BANKTOKEN&userID=123&password=BANKSECRET');
  assert.equal(h.context.userVars.sc,'TOKEN'); assert.equal(h.context.userVars.password,'SECRET');
  h.sent[0].complete('df_cash=0&df_bankcash=100');
  assert.ok(!JSON.stringify(h.emitted).includes('BANKSECRET'));
});
test('inicialização ausente, executável ou de outro personagem impede POST bancário', async () => {
  for (const html of ['<html>Login</html>', 'initBank(runSomething())', `initBank('sc=T&userID=456&password=P')`]) {
    const h=harness(); h.context.bankHtml=html;
    await h.action('deposit-all');
    assert.equal(h.sent.length,0); assert.equal(h.emitted[0].ok,false);
    assert.equal(h.context.pageLock,false);
  }
});
test('consulta de saldo não carrega inicialização do banco', async () => {
  const h=harness(); let fetches=0;
  h.context.window.fetch=async()=>{fetches++; throw Error('não deveria carregar');};
  await h.action('balances'); assert.equal(fetches,0); assert.equal(h.sent.length,1);
});
test('sessão redirecionada não envia movimentação', async () => {
  const h=harness(); h.context.window.fetch=async()=>({ok:true,url:'https://fairview.deadfrontier.com/login.php'});
  await h.action('withdraw-all'); assert.equal(h.sent.length,0); assert.equal(h.emitted[0].ok,false);
});
