import test from 'node:test';
import assert from 'node:assert/strict';
import {ExtensionDesktop,LOCAL_ORIGIN} from '../extension-desktop.js';
import {MARKET_ENDPOINT} from '../market-search.js';

function mockApi(){
  let stored={};
  return {storage:{local:{get:async()=>structuredClone(stored),set:async value=>{stored={...stored,...structuredClone(value)};}}},permissions:{contains:async()=>true},alarms:{create:async()=>{},clear:async()=>{}}};
}

test('the default worker fetch keeps its global receiver for pairing and market queries',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async function(url,options){
    assert.equal(this,globalThis,'native WorkerGlobalScope.fetch must not receive the ExtensionDesktop instance');
    calls.push(url);
    if(url===LOCAL_ORIGIN+'/v1/pair')return Response.json({version:1,token:'f'.repeat(43)});
    if(url===MARKET_ENDPOINT)return new Response(new URLSearchParams({tradelist_maxresults:'1',tradelist_0_item:'steroids',tradelist_0_itemname:'Steroids',tradelist_0_price:'9000',tradelist_0_quantity:'1'}));
    return Response.json({version:1});
  };
  try{
    const extension=new ExtensionDesktop(mockApi());
    await extension.catalog({version:1,observedAt:Date.now(),items:[{itemId:'steroids',name:'Steroids',kind:'item'}]});
    const paired=await extension.pair('12345678');assert.equal(paired.paired,true);
    const result=await extension.search('Steroids');assert.equal(result.offers,1);assert.equal(result.pending,0);
    assert.ok(calls.includes(MARKET_ENDPOINT));assert.ok(calls.includes(LOCAL_ORIGIN+'/v1/prices'));
  }finally{globalThis.fetch=original;}
});

test('an injected fetch that already has a bound receiver remains usable',async()=>{
  const receiver={calls:0};
  const fetcher=async function(){assert.equal(this,receiver);this.calls++;return Response.json({version:1});};
  const extension=new ExtensionDesktop(mockApi(),fetcher.bind(receiver));
  await extension.local('/v1/status','test-token');assert.equal(receiver.calls,1);
});

test('new native app receives catalog but does not delegate public market queries to the extension',async()=>{
  const api=mockApi(),calls=[];
  await api.storage.local.set({desktopSync:{token:'f'.repeat(43),enabled:true,zone:'21'},itemCatalog:{version:1,observedAt:Date.now(),revision:1,items:[{itemId:'fuelammo',name:'Gasoline',kind:'round'}]}});
  const extension=new ExtensionDesktop(api,async url=>{calls.push(url);return Response.json({version:1,directPricing:true});});
  const result=await extension.tick();assert.equal(result.online,true);assert.equal(result.error,null);
  assert.ok(calls.includes(LOCAL_ORIGIN+'/v1/catalog'));assert.ok(!calls.includes(LOCAL_ORIGIN+'/v1/needs'));assert.ok(!calls.includes(MARKET_ENDPOINT));
});
