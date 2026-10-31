import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {DesktopStore} from '../store.mjs';import {DesktopTracker} from '../tracker.mjs';
import {sourceForWindow,selectGameWindow,validRegion,csvOfSessions} from '../selection.mjs';
test('window capture only uses the native handle, not a lookalike title',()=>{
  const sources=[{id:'window:101:0',name:'Dead Frontier'},{id:'window:202:0',name:'Unrelated'}];
  assert.equal(sourceForWindow(sources,{handle:'202'}).id,'window:202:0');
  assert.equal(sourceForWindow(sources,{handle:'303'}),null);
  assert.equal(selectGameWindow([{handle:'1',minimized:true}]),null);
  assert.equal(selectGameWindow([{title:'A'},{title:'B'}]),null);
  assert.equal(selectGameWindow([{title:'A'},{title:'B'}],'B').title,'B');
});
test('SQLite preserves sessions after reopening; stop does not automatically resume',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'df-overview-test-'));const filename=path.join(folder,'test.sqlite');
  let store=new DesktopStore(filename),tracker=new DesktopTracker(store);
  tracker.attach();tracker.sample({xp:1000,level:1,precision:1000},1000);tracker.sample({xp:3000,level:1,precision:1000},3000);
  assert.equal(tracker.experience.session.gained,2000);tracker.finish('stopped',4000);
  tracker.sample({xp:6000,level:1,precision:1000},5000);assert.equal(tracker.experience.session.running,false);
  assert.equal(store.history()[0].finalXp,3000);
  tracker.reset();tracker.sample({xp:7000,level:1,precision:1000},6000);tracker.sample({xp:9000,level:1,precision:1000},8000);
  assert.equal(store.count(),2);store.close();
  store=new DesktopStore(filename);tracker=new DesktopTracker(store);
  assert.equal(tracker.experience.session.running,false);assert.equal(tracker.experience.session.endedAt,8000);
  assert.equal(store.history().find(row=>row.gained===2000).gained,2000);assert.equal(store.count(),2);store.close();
});
test('invalid multipliers leave settings untouched, region checks and CSV reject nonnumeric cells',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'df-overview-test-'));const store=new DesktopStore(path.join(folder,'data.sqlite'));const tracker=new DesktopTracker(store);
  assert.throws(()=>tracker.setMultiplier(-1));assert.equal(tracker.settings.multiplier,null);
  assert.equal(validRegion({x:0,y:0,width:.2,height:.1}),true);assert.equal(validRegion({x:.9,y:0,width:.5,height:.1}),false);
  const csv=csvOfSessions([{startedAt:1,gained:'=BAD()',perHour:10}]);assert.ok(!csv.includes('BAD'));assert.ok(csv.includes('10'));store.close();
});
test('CSV includes priced cash/items and explicitly counts loot excluded from the estimate',()=>{
  const csv=csvOfSessions([{id:'session',startedAt:1,gained:100}],{session:{cash:500,estimated:25000,unpriced:2}});
  assert.ok(csv.includes('cashLoot,estimatedItemLoot,unpricedLoot'));assert.ok(csv.endsWith(',500,25000,2'));
});
