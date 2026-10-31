import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ExtensionDesktop,LOCAL_ORIGIN} from '../../extension-desktop.js';import {MARKET_ENDPOINT} from '../../market-search.js';import {valueLoot,valueSessions} from '../../market-prices.js';import {PriceBridge} from '../price-bridge.mjs';import {DesktopStore} from '../store.mjs';
test('extension → authenticated local bridge → SQLite → loot values, including Yard policy and offline retry',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-extension-prices-')),store=new DesktopStore(path.join(folder,'db.sqlite')),bridge=new PriceBridge({store,port:0});
  let stored={},offline=false;const queries=[],origin='chrome-extension://'+'c'.repeat(32);
  const api={storage:{local:{get:async()=>structuredClone(stored),set:async value=>{stored={...stored,...structuredClone(value)};}}},permissions:{contains:async()=>true},alarms:{create:async()=>{},clear:async()=>{}}};
  try{
    const pairing=await bridge.pairCode(),base='http://127.0.0.1:'+bridge.server.address().port;
    for(const [id,item,extra]of [['loot1','Steroids',{}],['loot2','Demo Rifle',{}],['loot3','$2,122',{cash:2122}],['loot4','9mm Handgun Ammo',{}]])store.saveLoot({id,item,sessionId:'session',foundAt:Date.now(),status:'accepted',...extra});
    const fetcher=async(url,options={})=>{
      if(url===MARKET_ENDPOINT){const name=new URLSearchParams(options.body).get('searchname');queries.push(name);const ammo=name.includes('9mm'),gear=name==='Demo Rifle';return new Response(new URLSearchParams({tradelist_maxresults:'1',tradelist_0_item:ammo?'9mmammo':gear?'demorifle_stats888':'steroids',tradelist_0_itemname:ammo?'9mm Handgun Ammo':gear?'Demo Rifle':'Steroids',tradelist_0_price:ammo?'1000':gear?'888000':'9000',tradelist_0_quantity:ammo?'500':'1'}).toString());}
      if(offline)throw Error('offline');return fetch(String(url).replace(LOCAL_ORIGIN,base),{...options,headers:{...options.headers,Origin:origin}});
    };
    const extension=new ExtensionDesktop(api,fetcher);
    await extension.catalog({version:1,observedAt:Date.now(),items:[{itemId:'steroids',name:'Steroids',kind:'item'},{itemId:'demorifle',name:'Demo Rifle',kind:'equipment',yardValue:25000},{itemId:'9mmammo',name:'9mm Handgun Ammo',kind:'round'}]});
    await extension.pair(pairing.pairCode);await extension.tick();
    assert.deepEqual(queries.sort(),['9mm Handgun Ammo','Steroids']);
    assert.deepEqual(valueSessions(store.valuationLoot(),store.prices('21'),{catalog:store.itemCatalog(),requireCatalog:true}).sessions.session,{cash:2122,estimated:34000,priced:3,unpriced:1});
    await assert.rejects(()=>extension.search('Demo Rifle'),/priceEquipmentYard/);assert.equal(queries.length,2);
    await extension.search('Demo Rifle',true);assert.equal(queries.length,3);
    assert.equal(valueLoot(store.lootById('loot2'),store.prices('21'),{catalog:store.itemCatalog()}).value,25000);
    assert.equal(valueLoot({...store.lootById('loot2'),priceMode:'market',priceItemId:'demorifle_stats888'},store.prices('21'),{catalog:store.itemCatalog()}).value,888000);
    offline=true;await extension.search('Steroids');assert.equal((await extension.status()).pending,1);assert.equal((await extension.status()).online,false);
    offline=false;await extension.tick();assert.equal((await extension.status()).pending,0);assert.equal((await extension.status()).online,true);
    assert.ok(!JSON.stringify(await extension.status()).includes(stored.desktopSync.token));
    await extension.search('Steroids');await extension.search('Steroids');await assert.rejects(()=>extension.search('Steroids'),/priceRateLimit/);
    await extension.disconnect();assert.equal(bridge.clients.length,0);assert.equal((await extension.status()).paired,false);
  }finally{await bridge.close();store.close();}
});
