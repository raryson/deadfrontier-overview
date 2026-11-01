import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {DesktopStore} from '../store.mjs';import {PriceBridge} from '../price-bridge.mjs';
import http from 'node:http';
const origin='chrome-extension://'+'a'.repeat(32);
test('loopback bridge requires pairing, denies websites/rebinding, consumes codes once and stores no login data',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-prices-'));const store=new DesktopStore(path.join(folder,'state.sqlite'));const bridge=new PriceBridge({store,port:0,directPricing:true});
  try{
    const pairing=await bridge.pairCode(),base='http://127.0.0.1:'+bridge.server.address().port;
    const post=(url,body,headers={})=>fetch(base+url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    assert.equal((await fetch(base+'/v1/status',{headers:{Origin:origin}})).status,401);
    assert.equal((await post('/v1/pair',{code:pairing.pairCode},{Origin:'https://evil.example'})).status,403);
    const rebound=await new Promise((resolve,reject)=>{const request=http.request(base+'/v1/pair',{method:'POST',headers:{Host:'evil.example',Origin:origin,'Content-Type':'application/json'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end(JSON.stringify({code:pairing.pairCode}));});
    assert.equal(rebound,403);
    const response=await post('/v1/pair',{code:pairing.pairCode}),token=(await response.json()).token;assert.equal(response.status,200);assert.ok(token);
    const status=await(await fetch(base+'/v1/status',{headers:{Origin:origin,Authorization:'Bearer '+token}})).json();assert.equal(status.directPricing,true);
    assert.equal((await post('/v1/pair',{code:pairing.pairCode})).status,403);
    const body={version:1,market:{zone:'21',label:'Outpost'},observedAt:Date.now(),password:'must-not-store',offers:[{itemId:'steroids',name:'Steroids',unitKind:'item',total:9000,quantity:1,seller:'must-not-store'}]};
    assert.equal((await post('/v1/prices',body,{Authorization:'Bearer '+token})).status,200);assert.equal(store.prices('21')[0].unitPrice,9000);assert.ok(!JSON.stringify(store.prices('21')).includes('must-not-store'));assert.ok(!JSON.stringify(store.get('priceClients',[])).includes(token));
    assert.equal((await post('/v1/prices',body,{Authorization:'Bearer '+token,Origin:'chrome-extension://'+'b'.repeat(32)})).status,401);
    await post('/v1/unpair',{}, {Authorization:'Bearer '+token});assert.equal((await fetch(base+'/v1/status',{headers:{Origin:origin,Authorization:'Bearer '+token}})).status,401);
  }finally{await bridge.close();store.close();}
});
test('pairing attempts are rate-limited and stale snapshots cannot overwrite fresh prices',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-price-limit-')),store=new DesktopStore(path.join(folder,'state.sqlite')),bridge=new PriceBridge({store,port:0});
  try{
    await bridge.pairCode();const base='http://127.0.0.1:'+bridge.server.address().port;
    for(let i=0;i<5;i++)assert.equal((await fetch(base+'/v1/pair',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{"code":"00000000"}'})).status,403);
    assert.equal((await fetch(base+'/v1/pair',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'{"code":"00000000"}'})).status,429);
    const make=(at,price)=>({version:1,market:{zone:'21',label:'Outpost'},observedAt:at,offers:[{itemId:'steroids',name:'Steroids',unitKind:'item',quantity:1,total:price}]});
    store.savePrices(make(Date.now(),9000));store.savePrices(make(Date.now()-60000,1));assert.equal(store.prices('21')[0].unitPrice,9000);
  }finally{await bridge.close();store.close();}
});
