import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {LootSnapshotQueue,frameIsBlack,looksLikeLoot} from '../ui/loot-snapshots.mjs';
import {LootJournal,canonicalLootName} from '../ui/loot-journal.mjs';import {DesktopStore} from '../store.mjs';
import {valueLoot,valueSessions} from '../../market-prices.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/item-catalog.json',import.meta.url)));
function setup(t){const store=new DesktopStore(':memory:');t.after(()=>store.close());for(let i=0;i<catalog.items.length;i+=500)store.saveCatalog({...catalog,items:catalog.items.slice(i,i+500)},catalog.observedAt);return{store,journal:new LootJournal(store)};}
test('captures survive dialog dismissal and a slow reader; FIFO preserves independent encounters and has bounded storage',()=>{
 let n=0;const queue=new LootSnapshotQueue({limit:2,id:()=>String(++n)}),image={frozen:true};
 queue.offer(image,1000,true);queue.offer(image,1100,true);queue.offer(image,1200,true);queue.offer(image,1340,true);assert.equal(queue.size,3);
 queue.offer(null,1500,false);queue.offer({next:true},1600,true);queue.offer(null,1900,false);queue.offer({},2000,true);assert.equal(queue.dropped,1);
 const jobs=[];let job;while(job=queue.next())jobs.push(job);assert.deepEqual(jobs.map(j=>j.eventId),['1','2','1','1']);assert.equal(jobs[0].canvas,image);
 queue.clear();assert.equal(queue.size,0);assert.notEqual(jobs[0].generation,queue.generation);
});
test('one fast high-confidence dialog is journaled after it closed, without mouse/key/acceptance evidence',t=>{
 const {store,journal}=setup(t),reading={kind:'snapshot',eventId:'short-dialog',capturedAt:1000,frameAt:1010,text:'YOU HAVE FOUND SOME 127MM RIALE BULLETS (880). WILL YOU TAKE THEM?',confidence:90};
 assert.equal(journal.observe(reading,'original-session',20000),true);
 let entry=store.lootHistory()[0];assert.equal(entry.item,'12.7mm Rifle Bullets');assert.equal(entry.rawItem,'127MM RIALE BULLETS');assert.equal(entry.status,'observed');assert.equal(entry.sessionId,'original-session');assert.equal(entry.quantity,undefined);
 journal.observe({...reading,frameAt:1100},'different-session',21000);entry=store.lootHistory()[0];assert.equal(entry.quantity,880);assert.equal(entry.sessionId,'original-session');assert.equal(store.lootHistory().length,1);
 assert.equal(store.lootCounts()[0].identified,1);assert.equal(store.lootCounts()[0].accepted,0);assert.equal(store.valuationLoot().length,1);
});
test('same item in independent dialogs counts twice; weak single reads and unrelated calibres cannot invent identities',t=>{
 const {store,journal}=setup(t),text='YOU HAVE FOUND A WHISKEY. WILL YOU TAKE IT?';
 for(const id of ['first','second'])assert.equal(journal.observe({eventId:id,capturedAt:1000,frameAt:1000,text,confidence:90},null,3000),true);
 assert.equal(store.lootHistory().length,2);
 assert.equal(journal.observe({eventId:'weak',capturedAt:1000,text,confidence:60},null,3000),false);
 assert.equal(canonicalLootName('127MM RIALE BULLETS',store.itemCatalog()),'12.7mm Rifle Bullets');
 assert.equal(canonicalLootName('127MM HANDGUN BULLETS',store.itemCatalog()),'127MM HANDGUN BULLETS');
 assert.equal(canonicalLootName('12.8MM RIALE BULLETS',store.itemCatalog()),'12.8MM RIALE BULLETS');
});
test('identified items have potential value but old uncertain pickups stay excluded; delayed OCR uses capture-time session',t=>{
 const {store}=setup(t),now=Date.now();
 store.save(null,{id:'past',startedAt:100,running:false,endedAt:500},{});store.save(null,{id:'current',startedAt:600,running:true},{});
 assert.equal(store.sessionAt(300),'past');assert.equal(store.sessionAt(550),null);assert.equal(store.sessionAt(700),'current');
 const rows=[{id:'1',item:'Sweeper',status:'observed',sessionId:'past'},{id:'2',item:'Sweeper',status:'unconfirmed',sessionId:'past'}];
 assert.equal(valueLoot(rows[0],[],{catalog:store.itemCatalog(),requireCatalog:true,now}).value,19250);
 assert.equal(valueSessions(rows,[],{catalog:store.itemCatalog(),requireCatalog:true,now}).sessions.past.estimated,19250);
});
test('black loading frames and blank cards do not masquerade as an item dialog',()=>{
 const black=new Uint8ClampedArray(48*27*4);assert.equal(frameIsBlack(black),true);for(let i=0;i<black.length;i+=4)black[i]=black[i+1]=black[i+2]=200;assert.equal(frameIsBlack(black),false);
 assert.equal(looksLikeLoot(new Uint8ClampedArray(350*310*4),350,310),false);
});

test('real-game dark grey title remains eligible while the brighter prompt is required',()=>{
 const width=350,height=310,pixels=new Uint8ClampedArray(width*height*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=125;pixels[i+1]=95;pixels[i+2]=70;}
 // The real title has neutral grey strokes around 80–110, below white text.
 const dot=(x,y,value)=>{const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;};
 for(let x=25;x<=334;x++){dot(x,15,20);dot(x,234,20);}for(let y=15;y<=234;y++){dot(25,y,20);dot(334,y,20);}for(let x=46;x<=145;x++){dot(x,155,20);dot(x,194,20);}
 for(let y=14;y<28;y+=2)for(let x=120;x<225;x+=6)dot(x,y,100);
 for(let y=36;y<62;y+=2)for(let x=45;x<300;x+=8)dot(x,y,190);
 assert.equal(looksLikeLoot(pixels,width,height),true);
 for(let y=14;y<28;y+=2)for(let x=120;x<225;x+=6)dot(x,y,50);
 assert.equal(looksLikeLoot(pixels,width,height),false);
});

test('manual capture bypasses the visual gate and shares the automatic encounter to avoid duplicates',()=>{
 let n=0;const queue=new LootSnapshotQueue({id:()=>String(++n)});
 const id=queue.offer({automatic:true},1000,true);const first=queue.next();
 assert.equal(queue.capture([{canvas:{manual:true},at:1100}],id),true);
 const manual=queue.next();assert.equal(manual.eventId,first.eventId);assert.equal(manual.manual,true);
 assert.equal(queue.capture([{canvas:{dark:true},at:2000}]),true);assert.equal(queue.next().manual,true);
});
test('repeated manual snapshots update one record instead of adding another loot row',t=>{
 const {store,journal}=setup(t),reading={eventId:'one-dialog',capturedAt:1000,frameAt:1000,text:'YOU HAVE FOUND SOME WHISKEY. WILL YOU TAKE IT?',confidence:90};
 journal.observe(reading,null,2000);journal.observe({...reading,manual:true,frameAt:1100},null,2100);
 assert.equal(store.lootHistory().length,1);assert.equal(store.lootHistory()[0].captureMode,'shortcut');
});
