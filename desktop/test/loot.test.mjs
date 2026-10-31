import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {LootFlow,parseLootDialog,parseLootItem,titleStillVisible,choiceAt,searchInProgress} from '../ui/loot-model.mjs';import {DesktopStore} from '../store.mjs';
const text='ITEM FOUND\nYOU HAVE FOUND A NEROTONIN 8B. WILL YOU TAKE IT?\nYES (E) NO (T) USE (C)\n(8 INVENTORY SLOTS FREE)';
const found={kind:'found',text,confidence:85,buttons:{accepted:{x:.4,y:.5,width:.05,height:.04},rejected:{x:.5,y:.5,width:.05,height:.04}}};
test('loot parser needs item-found prompt, item name and both choices',()=>{
  assert.equal(parseLootDialog(text).item,'NEROTONIN 8B');
  assert.equal(parseLootDialog('YOU HAVE FOUND $2,122. wil YOU TAKE IT? YES (E) HO (Ti').cash,2122);
  assert.equal(parseLootDialog('YOU HAVE FOUND A RIFLE'),null);
  assert.equal(parseLootDialog(text.replace('YES (E)','')),null);
  assert.equal(choiceAt(found.buttons,.42,.52),'accepted');assert.equal(choiceAt(found.buttons,.7,.8),null);
});
test('a search is a hint, never a loot or a pickup; app shutdown cannot confirm a choice',()=>{
  assert.equal(searchInProgress('SEARCHING...'),true);assert.equal(searchInProgress('ITEM FOUND'),false);
  const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
  flow.observe({kind:'searching'},'s1',0);assert.equal(rows.size,0);
  flow.observe(found,'s1',500);flow.observe(found,'s1',1000);flow.choose({action:'accepted'},1100);flow.finish(1200);
  assert.equal([...rows.values()][0].status,'unconfirmed');
});
test('a repeated dialog is one event; dismissal alone is never collected',()=>{
  const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
  flow.observe(found,'session1',0);assert.equal(rows.size,0);flow.observe(found,'session1',500);
  for(let i=2;i<10;i++)flow.observe(found,'session1',i*500);
  assert.equal(rows.size,1);flow.observe({kind:'unknown'},null,6000);assert.ok(flow.pending);
  for(let i=0;i<3;i++)flow.observe({kind:'absent'},null,7000+i*500);
  assert.equal([...rows.values()][0].status,'unconfirmed');
});
test('Yes, No, Use, clicks outside buttons and stale choices stay distinct',()=>{
  for(const action of ['accepted','rejected','used','outside','stale']){
    const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
    flow.observe(found,'s1',0);flow.observe(found,'s1',500);
    flow.choose(action==='outside'?{action:'click',x:.9,y:.9}:{action:action==='stale'?'accepted':action},action==='stale'?5000:600);
    flow.finish(2000,true);assert.equal([...rows.values()][0].status,['outside','stale'].includes(action)?'unconfirmed':action);
  }
});
test('SQLite preserves loot/session association and unfinished outcomes after restart',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-loot-')),file=path.join(folder,'loot.sqlite');
  let store=new DesktopStore(file),flow=new LootFlow(store);
  flow.observe(found,'s1',0);flow.observe(found,'s1',500);flow.choose({action:'click',x:.42,y:.52},600);flow.finish(2000,true);
  flow.observe(found,'s2',3000);flow.observe(found,'s2',3500);store.close();store=new DesktopStore(file);
  assert.equal(store.lootHistory().length,2);assert.equal(store.lootCounts().find(row=>row.sessionId==='s1').accepted,1);
  assert.equal(store.lootHistory()[0].status,'unconfirmed');assert.equal(store.lootCounts().find(row=>row.sessionId==='s2').accepted,0);store.close();
});
test('a new confirmed dialog after a choice does not get attributed to the previous item',()=>{
  const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
  flow.observe(found,'s1',0);flow.observe(found,'s1',500);flow.choose({action:'accepted'},600);
  const next={...found,text:text.replace('NEROTONIN 8B','TEST RIFLE')};
  flow.observe(next,'s1',1000);flow.observe(next,'s1',1500);flow.observe(next,'s1',2000);
  assert.equal(rows.size,2);assert.equal([...rows.values()][0].status,'accepted');assert.equal(flow.pending.item,'TEST RIFLE');
});

test('loot quantities are separate from original item names, including clipped closing parentheses and ml',()=>{
  for(const suffix of ['(812)','(812','(812 ml)'])assert.deepEqual(parseLootItem('GASOLINE '+suffix),{item:'GASOLINE',key:'GASOLINE#812',quantity:812,unit:'ml'});
  assert.equal(parseLootItem('HEAVY GRENADES (158').quantity,158);
  assert.equal(parseLootItem('12.7MM RIFLE BULLETS (880)').item,'12.7MM RIFLE BULLETS');
  assert.equal(parseLootItem('NEROTONIN 8B').quantity,undefined);
  assert.equal(parseLootItem('Grey Mesh SLX').item,'Grey Mesh SLX');
  assert.equal(parseLootItem('Sweeper').item,'Sweeper');
  assert.equal(parseLootItem('WHISKEY (').item,'WHISKEY');
  assert.equal(parseLootItem('GASOLINE (0)'),null);
});
test('header arms choices before slow full-card OCR and a verified name can consume an early Yes',()=>{
  const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
  flow.observe({kind:'hint'},'s1',0);assert.equal(flow.armed(0),true);
  flow.choose({action:'click',x:.42,y:.52},100);
  flow.observe({...found,verifiedHeader:true},'s1',300);
  assert.equal(rows.size,1);assert.equal(flow.pending.choice,'accepted');
  flow.finish(1500,true);assert.equal([...rows.values()][0].status,'accepted');
  assert.equal(flow.armed(1500),false);
});
test('a stale or unrelated early click cannot accept a later item',()=>{
  for(const input of [{action:'click',x:.9,y:.9},{action:'accepted'}]){
    const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
    flow.choose(input,0);flow.observe({kind:'hint'},'s1',200);
    flow.choose(input,250);flow.observe({...found,verifiedHeader:true},'s1',input.action==='accepted'?5000:300);
    flow.finish(6000,true);assert.equal([...rows.values()][0].status,'unconfirmed');
  }
});
test('an unconfirmed old dialog cannot block the next equipment drop',()=>{
  const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
  flow.observe(found,'s1',0);flow.observe(found,'s1',500);
  flow.observe({kind:'searching'},'s1',800);
  const next={...found,text:text.replace('NEROTONIN 8B','GREY MESH SLX')};
  flow.observe(next,'s1',1000);flow.observe(next,'s1',1400);
  assert.equal(rows.size,2);assert.equal([...rows.values()][0].status,'unconfirmed');assert.equal(flow.pending.item,'GREY MESH SLX');
});
test('legacy stack names migrate without inventing pickups or changing session identity',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-quantity-')),file=path.join(folder,'loot.sqlite');
  let store=new DesktopStore(file);store.db.prepare("DELETE FROM state WHERE key='lootQuantityMigration'").run();
  store.saveLoot({id:'gas',item:'GASOLINE (812',sessionId:'old-run',foundAt:1,status:'accepted'});
  store.saveLoot({id:'grenade',item:'HEAVY GRENADES (158',sessionId:'old-run',foundAt:2,status:'unconfirmed'});
  store.close();store=new DesktopStore(file);
  assert.equal(store.lootById('gas').item,'GASOLINE');assert.equal(store.lootById('gas').quantity,812);assert.equal(store.lootById('gas').unit,'ml');assert.equal(store.lootById('gas').sessionId,'old-run');assert.equal(store.lootById('gas').rawItem,'GASOLINE (812');
  assert.equal(store.lootById('grenade').status,'unconfirmed');store.close();
});

test('uncertain stack quantities need matching consecutive numeric observations and can upgrade a pending item',()=>{
  const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});
  const ammo={...found,text:text.replace('NEROTONIN 8B','12.7MM RIFLE BULLETS (880)'),quantityVerified:false,quantityCandidate:880};
  flow.observe(ammo,'s',0);flow.observe(ammo,'s',500);assert.equal(flow.pending.quantity,880);
  flow.observe({...ammo,quantityCandidate:undefined},'s',1000);assert.equal(flow.pending.quantity,880);assert.equal(rows.size,1);
  flow.choose({action:'accepted'},1100);flow.finish(2000,true);assert.equal([...rows.values()][0].quantity,880);assert.equal([...rows.values()][0].status,'accepted');
  const other=new LootFlow({saveLoot:()=>{}});other.observe({...ammo,quantityCandidate:undefined},'s',0);other.observe({...ammo,quantityCandidate:undefined},'s',500);assert.equal(other.pending.quantity,undefined);assert.equal(other.pending.quantityUncertain,true);
});

test('an OCR failure is not a disappearance while the title pixels remain visible',()=>{
 const before=new Uint8ClampedArray(160),same=new Uint8ClampedArray(160),gone=new Uint8ClampedArray(160);for(let i=0;i<160;i+=4){before[i]=before[i+1]=before[i+2]=180;same[i]=same[i+1]=same[i+2]=160;gone[i]=gone[i+1]=gone[i+2]=30;}
 assert.equal(titleStillVisible(before,same),true);assert.equal(titleStillVisible(before,gone),false);assert.equal(titleStillVisible(gone,gone),null);
});

test('OCR spelling changes in an unchanged dialog do not create extra equipment drops',()=>{
 const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});flow.observe(found,'s',0);flow.observe(found,'s',500);
 const variant={...found,text:text.replace('NEROTONIN 8B','NEROTON1N 8B')};for(let i=0;i<5;i++)flow.observe(variant,'s',1000+i*300);
 assert.equal(rows.size,1);assert.equal(flow.pending.item,'NEROTONIN 8B');
});

test('a visually unchanged item name keeps a long-open dialog fresh for Yes without inventing a choice',()=>{
 const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});flow.observe(found,'s',0);flow.observe(found,'s',500);
 flow.observe({kind:'visible',nameVisible:true},'s',30000);assert.equal(flow.choose({action:'click',x:.42,y:.52},30100),true);
 flow.finish(32000,true);assert.equal([...rows.values()][0].status,'accepted');
});
test('unknown OCR, title-only evidence or an observed boundary cannot renew a stale item name',()=>{
 for(const reading of [{kind:'unknown'},{kind:'visible',nameVisible:false},{kind:'hint'}]){
  const flow=new LootFlow({saveLoot:()=>{}});flow.observe(found,'s',0);flow.observe(found,'s',500);flow.observe(reading,'s',30000);assert.equal(flow.choose({action:'accepted'},30100),false);
 }
 const flow=new LootFlow({saveLoot:()=>{}});flow.observe(found,'s',0);flow.observe(found,'s',500);flow.observe({kind:'absent'},'s',2000);flow.observe({kind:'visible',nameVisible:true},'s',30000);assert.equal(flow.choose({action:'accepted'},30100),false);
});

test('manual pickup recovery is explicit, reversible and preserves the original session',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-confirm-')),store=new DesktopStore(path.join(folder,'db.sqlite'));
 store.saveLoot({id:'confirmed-test',item:'12.7MM RIFLE BULLETS',sessionId:'run',foundAt:1,status:'unconfirmed'});
 assert.throws(()=>store.confirmLoot('confirmed-test',-1));store.confirmLoot('confirmed-test',880);
 assert.equal(store.lootById('confirmed-test').quantity,880);assert.equal(store.lootById('confirmed-test').sessionId,'run');assert.equal(store.lootById('confirmed-test').pickupEvidence,'user-confirmed');assert.equal(store.lootById('confirmed-test').status,'accepted');
 store.undoLootConfirmation('confirmed-test');assert.equal(store.lootById('confirmed-test').status,'unconfirmed');assert.equal(store.lootById('confirmed-test').pickupEvidence,undefined);store.close();
});
