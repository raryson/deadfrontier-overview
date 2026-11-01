import test from 'node:test';import assert from 'node:assert/strict';
import {DesktopStore} from '../store.mjs';import {DesktopTracker} from '../tracker.mjs';import {ClientSession,sameClient} from '../client-session.mjs';import {LootJournal} from '../ui/loot-journal.mjs';
const run=(pid=123,started='100')=>({processId:pid,processStartedAt:started,handle:'88'});
const sample=xp=>({xp,level:10,nextLevelXp:100000,precision:1});
function setup(t){const store=new DesktopStore(':memory:');t.after(()=>store.close());const tracker=new DesktopTracker(store);return{store,tracker,scope:new ClientSession(tracker)};}
test('closing a client freezes its session; reopening creates a distinct reference without counting previous XP',t=>{
 const {store,tracker,scope}=setup(t);scope.attach(run(),0);tracker.sample(sample(1000),1000);tracker.sample(sample(3000),3000);const first=tracker.experience.session.id;
 assert.equal(scope.observe([],4000),true);assert.equal(tracker.experience.session.running,false);assert.equal(scope.observe([],4500),false);
 const closed=store.history().find(e=>e.id===first);assert.equal(closed.reason,'gameClosed');assert.equal(closed.endedAt,4000);assert.equal(closed.gained,2000);
 scope.attach(run(456,'200'),5000);tracker.sample(sample(9000),6000);assert.notEqual(tracker.experience.session.id,first);assert.equal(tracker.experience.session.gained,0);
 tracker.sample(sample(10000),7000);assert.equal(tracker.experience.session.gained,1000);assert.equal(store.count(),2);assert.equal(store.history().find(e=>e.id===first).reason,'gameClosed');
});
test('minimizing, map loading and a replacement capture window within one execution keep the same session',t=>{
 const {store,tracker,scope}=setup(t),client=run();scope.attach(client,0);tracker.sample(sample(1000),1000);const id=tracker.experience.session.id;
 assert.equal(scope.observe([client],2000),false);assert.equal(scope.attach({...client,handle:'99',minimized:true},2500),false);
 tracker.sample(sample(3000),3000);assert.equal(tracker.experience.session.id,id);assert.equal(tracker.experience.session.gained,2000);assert.equal(store.count(),1);
});
test('PID and HWND reuse cannot merge two executions with different creation times',t=>{
 const {store,tracker,scope}=setup(t);scope.attach(run(),0);tracker.sample(sample(1000),1000);const first=tracker.experience.session.id;
 assert.equal(sameClient(run(),run(123,'101')),false);assert.equal(scope.observe([run(123,'101')],2000),true);
 scope.attach(run(123,'101'),2100);tracker.sample(sample(8000),3000);assert.notEqual(tracker.experience.session.id,first);assert.equal(store.count(),2);assert.deepEqual(tracker.experience.session.client,{processId:123,processStartedAt:'101'});
});
test('a client closed before HUD readiness creates no empty session; manual stop stays stopped until a new execution',t=>{
 const {store,tracker,scope}=setup(t);scope.attach(run(),0);scope.observe([],500);assert.equal(store.count(),0);
 scope.attach(run(2,'new'),600);tracker.sample(sample(1000),1000);tracker.finish('stopped',1500);scope.observe([run(2,'new')],2000);scope.attach({...run(2,'new'),handle:'new-window'},2100);tracker.sample(sample(2000),2500);assert.equal(tracker.experience.session.running,false);
 scope.observe([],3000);scope.attach(run(3,'next'),3100);tracker.sample(sample(3000),4000);assert.equal(tracker.experience.session.running,true);assert.equal(tracker.experience.session.gained,0);
});
test('OCR completed after closing and reopening remains attached to the session at capture time',t=>{
 const {store,tracker,scope}=setup(t);scope.attach(run(),0);tracker.sample(sample(1000),1000);const first=tracker.experience.session.id;scope.observe([],3000);
 scope.attach(run(2,'next'),4000);tracker.sample(sample(5000),5000);const second=tracker.experience.session.id;
 const journal=new LootJournal(store),reading={eventId:'late-previous-run',capturedAt:2000,frameAt:2010,confidence:90,text:'YOU HAVE FOUND A TEST RIFLE. WILL YOU TAKE IT?'};
 journal.observe(reading,store.sessionAt(reading.capturedAt),7000);assert.equal(store.lootHistory()[0].sessionId,first);assert.notEqual(store.lootHistory()[0].sessionId,second);
});
