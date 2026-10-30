import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function harness(){
  const sent=[],messages=[],handlers=[];
  class XHR {
    events={};addEventListener(name,callback){this.events[name]=callback;}
    open(method,url){this.method=method;this.url=url;}setRequestHeader(){}
    send(body){this.body=body;sent.push(this);}
  }
  const window={addEventListener:(_,fn)=>handlers.push(fn),postMessage:value=>messages.push(value)};
  const context={window,URL,URLSearchParams,location:{origin:'https://fairview.deadfrontier.com'},XMLHttpRequest:XHR,userVars:{userID:'123',sc:'TOKEN',password:'SECRET',EXPTABLE_exp_lvl2:'1000',EXPTABLE_exp_lvl3:'2000'},pageLock:false};
  for(const file of ['xp-protocol.js','xp-request.js'])vm.runInNewContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context);
  const request=()=>handlers[0]({source:null,origin:context.location.origin,data:{type:'overview-xp-request',requestId:'test-1'}});
  return {sent,messages,request,context};
}
test('consulta XP usa apenas get_values e publica campos permitidos',()=>{
  const h=harness();h.request();const xhr=h.sent[0];
  assert.equal(xhr.url,'/onlinezombiemmo/get_values.php');
  const body=new URLSearchParams(xhr.body);assert.equal(body.has('deposit'),false);assert.equal(body.has('withdraw'),false);
  xhr.responseURL='https://fairview.deadfrontier.com/onlinezombiemmo/get_values.php';xhr.status=200;
  xhr.responseText='df_exp=50&df_level=2&df_servertime=100&password=SECRET&sc=TOKEN';xhr.events.load();
  assert.equal(h.messages[0].sample.totalXp,1050);assert.equal(h.messages[0].sample.nextLevelXp,2000);
  assert.ok(!JSON.stringify(h.messages).includes('SECRET'));assert.ok(!JSON.stringify(h.messages).includes('TOKEN'));
});
test('resposta de erro não publica XP inventada nem repete requisição',()=>{
  const h=harness();h.request();const xhr=h.sent[0];
  xhr.responseURL='https://fairview.deadfrontier.com/onlinezombiemmo/get_values.php';xhr.status=200;xhr.responseText='status=cash';xhr.events.load();
  assert.ok(h.messages[0].error);assert.equal(h.messages[0].sample,undefined);assert.equal(h.sent.length,1);
});
