import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {sanitizeItemCatalog,resolveCatalog} from '../item-catalog.js';
test('city observer keeps original names, reads the game Yard function for equipment only and exports no account fields',()=>{
  let tick;const messages=[],calls=[];
  const context={globalData:{demorifle:{name:'Demo Rifle',itemtype:'weapon',password:'not-exported'},steroids:{name:'Steroids',itemtype:'item'},'9mmammo':{name:'9mm Handgun Ammo',itemtype:'ammo'}},scrapValue:(id,quantity)=>{calls.push([id,quantity]);return 25000;},window:{postMessage:value=>messages.push(value)},location:{origin:'https://fairview.deadfrontier.com'},setInterval:callback=>{tick=callback;return 1;},clearInterval:()=>{}};
  vm.runInNewContext(fs.readFileSync(new URL('../catalog-observer.js',import.meta.url),'utf8'),context);tick();
  const snapshot=sanitizeItemCatalog(JSON.parse(JSON.stringify(messages[0].snapshot)));
  assert.deepEqual(calls,[['demorifle',1]]);assert.equal(snapshot.items.find(i=>i.itemId==='demorifle').yardValue,25000);assert.equal(snapshot.items.find(i=>i.itemId==='steroids').name,'Steroids');assert.ok(!JSON.stringify(snapshot).includes('not-exported'));
  assert.equal(resolveCatalog('STEROIDS',snapshot.items).itemId,'steroids');assert.equal(resolveCatalog('Esteroides',snapshot.items),null);
});
