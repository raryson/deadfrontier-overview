import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const modelSource=fs.readFileSync(new URL('../quick-buy-model.js',import.meta.url),'utf8');
const requestSource=fs.readFileSync(new URL('../quick-buy-request.js',import.meta.url),'utf8');
function offers(rows) {
  const params=new URLSearchParams({tradelist_maxresults:String(rows.length)});
  rows.forEach((row,i)=>{for(const [key,value] of Object.entries({item:'127rifleammo',quantity:1200,price:13000,trade_zone:21,id_member:2,trade_id:i+100,...row}))params.set(`tradelist_${i}_${key}`,String(value));});return params.toString();
}
function harness() {
  const sent=[],emitted=[],listeners=[];
  const window={addEventListener:(type,fn)=>listeners.push(fn),postMessage:data=>emitted.push(data)};
  class XHR {
    listeners={};addEventListener(type,fn){this.listeners[type]=fn;}
    open(method,url){this.url=url;}setRequestHeader(){}
    send(body){this.body=body;sent.push(this);}
    complete(text,url){this.responseText=text;this.status=200;this.responseURL=url??`https://fairview.deadfrontier.com${this.url}`;this.listeners.load();}
  }
  const context={window,location:{origin:'https://fairview.deadfrontier.com'},URL,URLSearchParams,crypto:{randomUUID:()=> 'test-quote'},XMLHttpRequest:XHR,hash:()=> 'HASH',pageLock:false,document:{getElementById:()=>null},
    userVars:{userID:'1',sc:'FAKE_TOKEN',password:'FAKE_SECRET',pagetime:'123',template_ID:'1',DFSTATS_df_tradezone:'21',DFSTATS_df_cash:20000,DFSTATS_df_invslots:2,DFSTATS_df_inv1_type:'',DFSTATS_df_inv2_type:''},
    globalData:{'127rifleammo':{max_quantity:1200},whiskey:{max_quantity:1},fuelammo:{max_quantity:4546}}};
  vm.runInNewContext(modelSource,context);vm.runInNewContext(requestSource,context);
  const action=(action,extra={},event={})=>listeners[0]({source:window,origin:context.location.origin,data:{type:'overview-quick-request',requestId:'test-1',action,...extra},...event});
  async function quote(rows=[{}]){const promise=action('quote',{id:'127rifleammo'});sent.at(-1).complete(offers(rows));await promise;return emitted.at(-1).quote;}
  return {context,sent,emitted,action,quote};
}
test('selects the cheapest exact full stack, excluding partials, overstacks, other items, own listings and other zones',()=>{
  const h=harness(),model=h.context.DFOverviewQuick,item=model.definition('127rifleammo',h.context.globalData);
  const p=new URLSearchParams(offers([{quantity:1163,price:100},{quantity:2400,price:200},{trade_zone:22,price:300},{item:'14rifleammo',price:400},{id_member:1,price:500},{price:17000},{price:13000}]));
  assert.equal(model.selectOffer(p,item,21,1).price,13000);
  assert.equal(model.definition('fuelammo',h.context.globalData).quantity,4546);
  assert.equal(model.definition('whiskey',h.context.globalData).quantity,1);
  assert.equal(model.definition('credits',h.context.globalData),null);
  assert.throws(()=>model.selectOffer(new URLSearchParams(),item,21,1),/invalidResponse/);
});
test('quotes do not purchase or expose authentication',async()=>{
  const h=harness(),q=await h.quote();assert.equal(q.quantity,1200);assert.equal(q.price,13000);assert.equal(h.sent.length,1);
  assert.equal(h.sent[0].url,'/onlinezombiemmo/trade_search.php');
  assert.ok(!JSON.stringify(h.emitted).includes('FAKE_'));assert.equal(h.context.pageLock,false);
});
test('confirmed purchase pins the quoted listing and expected price; quote cannot be replayed',async()=>{
  const h=harness(),q=await h.quote();const buying=h.action('buy',{quoteId:q.quoteId,price:1,tradeId:'999'});
  const request=h.sent.at(-1),params=new URLSearchParams(request.body);
  assert.equal(params.get('buynum'),'100');assert.equal(params.get('expected_itemprice'),'13000');assert.equal(params.get('action'),'newbuy');
  request.complete('df_cash=7000&df_inv1_type=127rifleammo&df_inv1_quantity=1200');await buying;
  assert.equal(h.emitted.at(-1).ok,true);assert.equal(h.context.userVars.DFSTATS_df_cash,'7000');
  await h.action('buy',{quoteId:q.quoteId});assert.equal(h.emitted.at(-1).error,'expired');assert.equal(h.sent.length,2);
  assert.ok(!JSON.stringify(h.emitted).includes('FAKE_'));
});
test('double-click does not release the in-flight lock or send another request',async()=>{
  const h=harness(),pending=h.action('quote',{id:'127rifleammo'});
  await h.action('quote',{id:'127rifleammo'});assert.equal(h.context.pageLock,true);assert.equal(h.sent.length,1);
  await h.action('quote',{id:'127rifleammo'});assert.equal(h.sent.length,1);
  h.sent[0].complete(offers([{}]));await pending;assert.equal(h.context.pageLock,false);
});
test('missing listing, network uncertainty and redirects never retry or substitute',async()=>{
  for(const response of ['error=missed','df_cash=7000','<html>login</html>']) {
    const h=harness(),q=await h.quote(),pending=h.action('buy',{quoteId:q.quoteId});h.sent.at(-1).complete(response);await pending;
    assert.equal(h.emitted.at(-1).ok,false);await h.action('buy',{quoteId:q.quoteId});assert.equal(h.sent.length,2);
  }
  const h=harness(),pending=h.action('quote',{id:'127rifleammo'});h.sent[0].complete(offers([{}]),'https://other.example/trade_search.php');await pending;assert.equal(h.emitted.at(-1).ok,false);
});
test('cash, inventory and account or zone changes are checked before spending',async()=>{
  for(const mutate of [h=>h.context.userVars.DFSTATS_df_cash=0,h=>h.context.userVars.DFSTATS_df_inv1_type=h.context.userVars.DFSTATS_df_inv2_type='whiskey',h=>h.context.userVars.userID='3',h=>h.context.userVars.DFSTATS_df_tradezone='22']) {
    const h=harness(),q=await h.quote();mutate(h);await h.action('buy',{quoteId:q.quoteId});assert.equal(h.sent.length,1);assert.equal(h.emitted.at(-1).ok,false);
  }
});
test('only allowlisted actions/items and same-origin messages work; searches are bounded',async()=>{
  const h=harness();await h.action('quote',{id:'127rifleammo'},{origin:'https://other.example'});await h.action('quote',{id:'credits'});assert.equal(h.sent.length,0);
  for(let i=0;i<5;i++)await h.quote(); // Invalid item above consumes no search budget.
  await h.quote();await h.action('quote',{id:'127rifleammo'});assert.equal(h.emitted.at(-1).error,'rateLimit');assert.equal(h.sent.length,6);
});
