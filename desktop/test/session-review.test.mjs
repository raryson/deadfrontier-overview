import test from 'node:test';import assert from 'node:assert/strict';
import {DesktopStore} from '../store.mjs';import {correctLoot,decodeLootImage} from '../loot-review.mjs';import {LootJournal} from '../ui/loot-journal.mjs';import {LootSnapshotQueue} from '../ui/loot-snapshots.mjs';
const image='data:image/jpeg;base64,/9j/2Q==';
function setup(t){const store=new DesktopStore(':memory:');t.after(()=>store.close());store.saveCatalog({version:1,observedAt:Date.now(),items:[{itemId:'whiskey',name:'Whiskey',kind:'item'},{itemId:'fuelammo',name:'Gasoline',kind:'round'}]});return store;}
test('all session loot remains accessible beyond the recent-200 list, with strict paging and session isolation',t=>{
 const store=setup(t);for(let i=0;i<351;i++)store.saveLoot({id:'loot-'+i,sessionId:i===350?'other':'run',foundAt:i,item:'Whiskey',status:'observed'});
 assert.equal(store.lootHistory().length,200);const rows=[];for(let page=0;page<4;page++){const result=store.sessionLoot('run',page);assert.equal(result.total,350);rows.push(...result.rows);}assert.equal(rows.length,350);assert.equal(new Set(rows.map(r=>r.id)).size,350);assert.ok(rows.every(row=>row.sessionId==='run'));assert.throws(()=>store.sessionLoot('run',-1));
});
test('the crop is saved before OCR, survives failed recognition and is removed only with history',t=>{
 const store=setup(t);store.saveCapture({eventId:'capture',capturedAt:1000,imageData:image},'run',true,2000);store.markOcrFailed('capture','unreadable text');
 const row=store.sessionLoot('run').rows[0];assert.equal(row.status,'ocrFailed');assert.equal(row.hasImage,true);assert.deepEqual([...store.lootImage('capture')],[255,216,255,217]);
 store.set('priceAliases',{bad:'whiskey'});store.clearHistory();assert.equal(store.lootImage('capture'),null);assert.equal(store.get('priceAliases').bad,'whiskey');
});
test('saved image payloads reject remote URLs, SVG and oversized data; saving can be disabled',t=>{
 const store=setup(t);for(const bad of ['https://example.com/a.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,'+'A'.repeat(400000)])assert.throws(()=>decodeLootImage(bad));
 store.saveCapture({eventId:'off',capturedAt:1000,imageData:image},'run',false,2000);assert.equal(store.lootImage('off'),null);
});
test('manual review updates an old row, preserves its session and teaches future OCR names without overwriting corrections',t=>{
 const store=setup(t);store.saveCapture({eventId:'old',capturedAt:1000,imageData:image},'original',true,2000);
 correctLoot(store,{id:'old',itemId:'fuelammo',quantity:812,aliasFrom:'GASOUNE'});const corrected=store.lootById('old');assert.equal(corrected.item,'Gasoline');assert.equal(corrected.quantity,812);assert.equal(corrected.unit,'ml');assert.equal(corrected.sessionId,'original');
 const journal=new LootJournal(store);journal.observe({eventId:'next',capturedAt:3000,frameAt:3010,text:'YOU HAVE FOUND SOME GASOUNE. WILL YOU TAKE IT?',confidence:90},'next-run',4000);assert.equal(store.lootById('next').item,'Gasoline');
 assert.equal(journal.observe({eventId:'old',capturedAt:1000,frameAt:1010,text:'YOU HAVE FOUND SOME WHISKEY. WILL YOU TAKE IT?',confidence:95},'wrong-run',5000),false);assert.equal(store.lootById('old').item,'Gasoline');
});
test('dialog identity survives brief detection flicker but separates after a real absence and stable prompt change',()=>{
 let id=0;const queue=new LootSnapshotQueue({id:()=>String(++id)}),a=Uint8Array.from({length:60},(_,i)=>i<25?1:0),b=Uint8Array.from({length:60},(_,i)=>i>=25&&i<50?1:0);
 const first=queue.offer({},1000,true,a);queue.offer({},1016,false);const second=queue.offer({},1032,true,a);assert.equal(first,second);queue.offer({},1150,false);const separate=queue.offer({},1166,true,a);assert.notEqual(first,separate);
 assert.equal(queue.offer({},1182,true,b),null);assert.equal(queue.offer({},1198,true,b),null);const third=queue.offer({},1246,true,b);assert.notEqual(separate,third);assert.equal(queue.created.capturedAt,1182);
});
test('queue overflow retains a capture identity for later image review instead of silently losing the event',()=>{
 let id=0;const queue=new LootSnapshotQueue({limit:1,id:()=>String(++id)});queue.offer({},1000,true);queue.offer({},1150,false);const overflow=queue.offer({},1166,true);assert.equal(overflow,'2');assert.equal(queue.created.queued,false);assert.equal(queue.created.eventId,'2');assert.equal(queue.dropped,1);
});

test('single items default to one, while ammunition and fuel retain quantity validation',t=>{
 const store=setup(t),journal=new LootJournal(store);
 const read=(id,text)=>journal.observe({eventId:id,capturedAt:1000,frameAt:1010,text:'YOU HAVE FOUND SOME '+text+'. WILL YOU TAKE IT?',confidence:95},'run',2000);
 read('single','WHISKEY');assert.equal(store.lootById('single').quantity,1);
 read('ammo','12.7MM RIFLE BULLETS (880)');assert.equal(store.lootById('ammo').quantity,undefined);assert.equal(store.lootById('ammo').quantityUncertain,true);
 read('fuel','GASOLINE');assert.equal(store.lootById('fuel').quantity,undefined);
 correctLoot(store,{id:'single',itemId:'whiskey',quantity:null});assert.equal(store.lootById('single').quantity,1);
});

test('non-dialog captures are hidden without deleting original data or valid unreadable loot',t=>{
 const store=setup(t);for(const id of ['valid','scenery'])store.saveCapture({eventId:id,capturedAt:1000,imageData:image},'run',true,2000);
 let checks=0;store.rejectNonLootCaptures(()=>++checks===1);
 assert.equal(store.sessionLoot('run').total,1);assert.equal(store.lootHistory().length,1);assert.equal(store.lootById('valid').status,'ocrPending');assert.equal(store.lootById('scenery').status,'notLoot');assert.ok(store.lootImage('scenery'));
 store.rejectNonLootCaptures(()=>{throw Error('Must not rerun');});
});

test('a later sharp catalogue reading refines an unknown name in the same dialog',t=>{
 const store=setup(t),journal=new LootJournal(store),base={eventId:'one',capturedAt:1000,confidence:90};
 journal.observe({...base,frameAt:1010,text:'YOU HAVE FOUND A WHESKE. WILL YOU TAKE IT?'},'run',2000);
 journal.observe({...base,frameAt:1250,confidence:95,text:'YOU HAVE FOUND A WHISKEY. WILL YOU TAKE IT?'},'run',2300);
 assert.equal(store.lootHistory().length,1);assert.equal(store.lootById('one').item,'Whiskey');
});

test('completed OCR still gets later sharp crops of the same translucent dialog',()=>{
 const queue=new LootSnapshotQueue({id:()=> 'dialog'});queue.offer({},1000,true);queue.next();queue.complete('dialog');
 assert.equal(queue.offer({},1220,true),'dialog');assert.equal(queue.next().eventId,'dialog');queue.complete('dialog');
 assert.equal(queue.offer({},1440,true),'dialog');assert.equal(queue.next().eventId,'dialog');
});

test('conflicting numeric variants cannot confirm ammunition quantity',t=>{
 const store=setup(t),journal=new LootJournal(store),reading={eventId:'conflict',capturedAt:1000,confidence:95,text:'YOU HAVE FOUND SOME 12.7MM RIFLE BULLETS (830). WILL YOU TAKE THEM?',quantityConfidence:95,quantityConflict:true};
 journal.observe({...reading,frameAt:1010},'run',2000);journal.observe({...reading,frameAt:1220},'run',2300);
 assert.equal(store.lootById('conflict').quantity,undefined);assert.equal(store.lootById('conflict').quantityUncertain,true);
});
