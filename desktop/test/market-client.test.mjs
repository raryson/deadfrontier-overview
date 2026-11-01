import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DesktopStore} from '../store.mjs';
import {MarketClient,MARKET_OPTIONS,validMarket} from '../market-client.mjs';
import {valueLoot} from '../../market-prices.js';
const seed=JSON.parse(fs.readFileSync(new URL('../data/item-catalog.json',import.meta.url)));
function setup(t,{fetcher,now=Date.now,getZone,getPending}={}){
  const store=new DesktopStore(':memory:');t.after(()=>store.close());
  for(let i=0;i<seed.items.length;i+=500)store.saveCatalog({version:1,observedAt:seed.observedAt,items:seed.items.slice(i,i+500)},seed.observedAt);
  return {store,client:new MarketClient({store,fetcher,now,getZone,getPending})};
}
const response=()=>new Response(new URLSearchParams({tradelist_maxresults:'1',tradelist_0_item:'fuelammo',tradelist_0_itemname:'Gasoline',tradelist_0_price:'12000',tradelist_0_quantity:'1000'}));
test('bundled public catalog gives ordinary equipment Yard values without a browser or market search',async t=>{
 const {store,client}=setup(t,{fetcher:async()=>{assert.fail('ordinary gear must not query market');}});
 assert.ok(seed.items.length>1000);for(const item of seed.items)assert.ok(Object.keys(item).every(key=>['itemId','name','kind','yardValue'].includes(key)));
 for(const [name,expected]of [['Mesh SLX',19450],['Sweeper',19250]]){
  const item=store.itemCatalog().find(item=>item.name===name);assert.equal(item.yardValue,expected);
  await assert.rejects(client.query(name),/priceEquipmentYard/);
  assert.equal(valueLoot({item:name,status:'accepted'},[],{catalog:store.itemCatalog(),requireCatalog:true}).value,expected);
 }
 assert.equal(validMarket('21'),true);assert.equal(validMarket('13'),false);assert.equal(MARKET_OPTIONS[0][0],'21');
});
test('direct public queries default to Secronom, isolate markets, cache across restarts and value Gasoline per ml',async t=>{
 let zone='21',calls=0;const fetcher=async(url,opts)=>{calls++;assert.ok(url.endsWith('/trade_search.php'));assert.equal(opts.credentials,'omit');assert.equal(opts.headers.Authorization,undefined);assert.equal(new URLSearchParams(opts.body).get('tradezone'),zone);return response();};
 const {store,client}=setup(t,{fetcher,getZone:()=>zone});
 await client.query('Gasoline');assert.equal(calls,1);assert.equal(store.prices('21')[0].unitPrice,12);
 assert.equal(valueLoot({item:'Gasoline',quantity:812,unit:'ml',status:'accepted'},store.prices('21'),{catalog:store.itemCatalog(),requireCatalog:true}).value,9744);
 await new MarketClient({store,fetcher}).query('Gasoline');assert.equal(calls,1);
 zone='22';await client.query('Gasoline');assert.equal(calls,2);assert.equal(store.prices('22')[0].unitPrice,12);
 await assert.rejects(client.query('not a catalog item'),/priceUnknownItem/);assert.equal(calls,2);
});
test('pending loot prefetches before pickup; failed queries back off and never break tracking',async t=>{
 let at=Date.now(),calls=0;const pending={item:'Gasoline'};
 const {client}=setup(t,{now:()=>at,getPending:()=>pending,fetcher:async()=>{calls++;throw Error('offline');}});
 await client.tick();assert.equal(calls,1);assert.equal(client.status().error,'priceQueryFailed');
 await client.tick();assert.equal(calls,1);at+=61000;await client.tick();assert.equal(calls,2);
});
test('concurrent forced queries are serialized and limited to six per minute',async t=>{
 let calls=0;const {client}=setup(t,{fetcher:async()=>{calls++;return response();}});
 const results=await Promise.allSettled(Array.from({length:7},()=>client.query('Gasoline',{force:true})));
 assert.equal(calls,6);assert.equal(results.filter(result=>result.status==='rejected')[0].reason.message,'priceRateLimit');
});
test('trusted catalog seed can be older than remote freshness window; normal updates cannot bypass it',t=>{
 const {store}=setup(t),old=Date.now()-60*86400000,batch={version:1,observedAt:old,items:[{itemId:'oldtest',name:'Old Test',kind:'item'}]};
 assert.throws(()=>store.saveCatalog(batch));store.saveCatalog(batch,old);assert.ok(store.itemCatalog().some(item=>item.itemId==='oldtest'));
});
