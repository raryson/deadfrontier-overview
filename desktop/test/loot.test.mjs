import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {LootFlow,parseLootDialog,choiceAt,searchInProgress} from '../ui/loot-model.mjs';import {DesktopStore} from '../store.mjs';
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
