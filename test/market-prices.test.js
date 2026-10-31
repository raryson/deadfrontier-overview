import test from 'node:test';import assert from 'node:assert/strict';
import {sanitizeMarketBatch,aggregateQuotes,valueLoot,valueSessions,PRICE_TTL} from '../market-prices.js';
import {parseMarketResponse,searchBody,MARKET_ENDPOINT,searchMarket} from '../market-search.js';
const now=1700000000000;
const offer=(extra={})=>({itemId:'steroids',name:'Steroids',unitKind:'item',total:10000,quantity:1,...extra});
const batch=offers=>({version:1,market:{zone:'21',label:'Zona 21'},observedAt:now,offers});
test('market payload exports only price fields and normalizes stacks without treating armour durability as units',()=>{
  const raw=new URLSearchParams({tradelist_maxresults:'2',tradelist_0_item:'reactiveslx',tradelist_0_itemname:'Reactive SLX',tradelist_0_quantity:'350',tradelist_0_price:'100000',tradelist_0_member_name:'not-exported',tradelist_1_item:'9mmammo',tradelist_1_itemname:'9mm Handgun Ammo',tradelist_1_quantity:'500',tradelist_1_price:'1000'}).toString();
  const parsed=parseMarketResponse(raw,'21',now);assert.equal(parsed.offers[0].quantity,1);assert.equal(parsed.offers[1].quantity,500);assert.equal(parsed.offers[1].unitKind,'round');assert.ok(!JSON.stringify(parsed).includes('not-exported'));
  const sanitized=sanitizeMarketBatch({...parsed,password:'not-exported',account:'not-exported'},now);assert.ok(!JSON.stringify(sanitized).includes('not-exported'));
});
test('lowest observed unit quote is kept without averaging different item variants',()=>{
  const quotes=aggregateQuotes(batch([offer(),offer({total:9000}),offer({itemId:'steroids_other',total:5000})]));
  assert.equal(quotes[0].unitPrice,9000);assert.equal(quotes[0].samples,2);assert.equal(quotes.length,2);
  assert.equal(valueLoot({status:'accepted',item:'Steroids'},quotes,{now}).reason,'ambiguous');
  assert.equal(valueLoot({status:'accepted',item:'Stero1ds'},quotes,{now,aliases:{stero1ds:'steroids'}}).value,9000);
});
test('expired quotes, uncertain quantities and unconfirmed pickups cannot inflate session totals',()=>{
  const quotes=aggregateQuotes(batch([offer(),offer({itemId:'9mmammo',name:'9mm Handgun Ammo',unitKind:'round',total:1000,quantity:500})]));
  const loot=[{status:'accepted',item:'$500',cash:500,sessionId:'s'},{status:'accepted',item:'Steroids',sessionId:'s'},{status:'accepted',item:'9mm Handgun Ammo',sessionId:'s'},{status:'unconfirmed',item:'Steroids',sessionId:'s'}];
  let values=valueSessions(loot,quotes,{now});assert.deepEqual(values.sessions.s,{cash:500,estimated:10000,priced:2,unpriced:1});
  assert.equal(valueLoot(loot[2],quotes,{now}).reason,'quantityUnknown');assert.equal(valueLoot({...loot[2],quantity:500},quotes,{now}).value,1000);
  values=valueSessions(loot,quotes,{now:now+PRICE_TTL+1});assert.equal(values.sessions.s.estimated,0);assert.equal(values.sessions.s.cash,500);assert.equal(values.sessions.s.unpriced,2);
});
test('price validation rejects malformed data and search is fixed to a read-only listing request without cookies',async()=>{
  assert.throws(()=>sanitizeMarketBatch(batch([offer({quantity:0})]),now));assert.throws(()=>sanitizeMarketBatch({...batch([]),observedAt:now+999999},now));assert.throws(()=>parseMarketResponse('<html>login</html>','21',now));
  assert.throws(()=>searchBody('Steroids','https://example.com'));const params=searchBody('Steroids','21');assert.equal(params.get('search'),'trades');assert.equal(params.get('searchtype'),'buyinglistitemname');
  await searchMarket(async(url,options)=>{assert.equal(url,MARKET_ENDPOINT);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.ok(!options.body.includes('password'));return new Response('tradelist_maxresults=0');},'Steroids','21');
});
test('ordinary equipment uses Yard regardless of market listings; custom prices require an explicit exact variant',()=>{
  const catalog=[{itemId:'reactiveslx',name:'Reactive SLX',kind:'equipment',yardValue:127500}],entry={status:'accepted',item:'Reactive SLX',quantity:350};
  const quotes=aggregateQuotes(batch([offer({itemId:'reactiveslx',name:'Reactive SLX',total:999999}),offer({itemId:'reactiveslx_stats2424',name:'Reactive SLX',total:5000000})]));
  assert.equal(valueLoot(entry,quotes,{now,catalog}).value,127500);assert.equal(valueLoot(entry,[],{now,catalog}).reason,'yard');
  assert.equal(valueLoot({...entry,priceMode:'market'},quotes,{now,catalog}).reason,'variantRequired');
  assert.equal(valueLoot({...entry,priceMode:'market',priceItemId:'reactiveslx_stats2424'},quotes,{now,catalog}).value,5000000);
  assert.equal(valueLoot({status:'accepted',item:'Unknown'},quotes,{now,requireCatalog:true}).reason,'noCatalog');
});

test('Gasoline quotes and loot estimates use millilitres rather than item or bullet counts',()=>{
  const raw=new URLSearchParams({tradelist_maxresults:'1',tradelist_0_item:'fuelammo',tradelist_0_itemname:'Gasoline',tradelist_0_quantity:'1000',tradelist_0_price:'3000'}).toString();
  const parsed=parseMarketResponse(raw,'21',now);assert.equal(parsed.offers[0].unitKind,'ml');
  const quotes=aggregateQuotes(parsed);assert.equal(valueLoot({status:'accepted',item:'GASOLINE',quantity:812,unit:'ml'},quotes,{now}).value,2436);
});
