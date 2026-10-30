import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../page-observer.js', import.meta.url), 'utf8');
function harness() {
  const messages = [];
  class XHR {
    listeners = [];
    open(method, url) { this.responseURL = new URL(url, 'https://fairview.deadfrontier.com/onlinezombiemmo/').href; return 'opened'; }
    send(body) { this.sent = body; return 'sent'; }
    addEventListener(name, listener) { if (name === 'load') this.listeners.push(listener); }
    respond(text, status = 200) { this.responseText = text; this.status = status; this.listeners.forEach(fn => fn()); }
  }
  const location = { origin:'https://fairview.deadfrontier.com', href:'https://fairview.deadfrontier.com/onlinezombiemmo/index.php?page=25' };
  const context = { XMLHttpRequest:XHR, URL, URLSearchParams, location, userVars:{userID:'123'}, setInterval:()=>1, clearInterval:()=>{}, window:{ postMessage:message=>messages.push(message) } };
  vm.runInNewContext(source, context);
  return { XHR, messages, context };
}
const response = 'df_servertime=590000000&df_boostexpuntil=1790001800&password=SECRET&sc=TOKEN';
test('observa consumo confirmado preservando corpo, retorno e resposta do jogo', () => {
  const { XHR, messages } = harness(); const xhr = new XHR();
  assert.equal(xhr.open('POST','inventory_new.php'),'opened');
  const body = 'action=newconsume&expected_itemtype=freshherbs&password=SECRET';
  assert.equal(xhr.send(body),'sent'); xhr.respond(response);
  assert.equal(xhr.sent,body); assert.equal(xhr.responseText,response);
  assert.equal(messages.length,1); assert.equal(messages[0].fields.df_boostexpuntil,1790001800);
  assert.equal(messages[0].item,'freshherbs');
  assert.ok(!JSON.stringify(messages).includes('SECRET')); assert.ok(!JSON.stringify(messages).includes('TOKEN'));
});
test('erros, outra origem, login e respostas sem prazo não geram eventos', () => {
  const { XHR, messages } = harness();
  for (const [url,text,status] of [['inventory_new.php','status=cash&'+response,200],['inventory_new.php',response,500],['https://other.example/inventory_new.php',response,200],['login.php',response,200],['inventory_new.php','<html>Login</html>',200]]) {
    const xhr = new XHR(); xhr.open('POST',url); xhr.send('password=SECRET'); xhr.respond(text,status);
  }
  assert.equal(messages.length,0);
});
test('fetch preserva a Promise e lê somente a cópia da resposta', async () => {
  const messages = [];
  let cloned = 0;
  const responseObject = { status:200, url:'https://fairview.deadfrontier.com/onlinezombiemmo/inventory_new.php', clone:() => { cloned++; return {text:async()=>response}; } };
  const originalPromise = Promise.resolve(responseObject);
  const context = { XMLHttpRequest:class {open(){} send(){}}, URL, URLSearchParams, location:{origin:'https://fairview.deadfrontier.com',href:responseObject.url}, userVars:{userID:'123'}, setInterval:()=>1, clearInterval:()=>{}, window:{fetch:()=>originalPromise,postMessage:message=>messages.push(message)} };
  vm.runInNewContext(source,context);
  const result = context.window.fetch(responseObject.url,{body:'expected_itemtype=freshherbs&password=SECRET'});
  assert.equal(result,originalPromise);
  await result; await new Promise(resolve=>setImmediate(resolve));
  assert.equal(cloned,1); assert.equal(messages.length,1); assert.equal(messages[0].item,'freshherbs');
  assert.ok(!JSON.stringify(messages).includes('SECRET'));
});
test('leitura de XP publica somente XP permitida e não cria um pacote de buffs incompleto',()=>{
  const h=harness();
  vm.runInNewContext(fs.readFileSync(new URL('../xp-protocol.js',import.meta.url),'utf8'),h.context);
  const xhr=new h.XHR();xhr.open('POST','get_values.php');xhr.send('password=SECRET');
  xhr.respond('df_exp=100&df_level=1&df_servertime=590000000&password=SECRET');
  assert.equal(h.messages.length,1);assert.equal(h.messages[0].type,'overview-server-xp');
  assert.equal(h.messages[0].sample.xp,100);assert.ok(!JSON.stringify(h.messages).includes('SECRET'));
});
