import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {LootFlow,lootBindings} from '../ui/loot-model.mjs';import {LootFrames} from '../ui/loot-frames.mjs';import {DesktopStore} from '../store.mjs';
const text='ITEM FOUND\nYOU HAVE FOUND SOME 12.7MM RIFLE BULLETS (880). WILL YOU TAKE THEM?\nYES (E) NO (T) USE (C)';
const buttons={accepted:{x:.4,y:.5,width:.1,height:.05},rejected:{x:.52,y:.5,width:.1,height:.05}};
const reading={kind:'found',text,confidence:90,nameConfidence:85,buttons,capturedAt:1000,inputDismissed:true,inputAfterAt:1500,quantityVerified:true,quantity:880};
const key=(value='E',id='key-1')=>({id,at:1050,action:'key',key:value});
const fixture=()=>{const rows=new Map(),flow=new LootFlow({saveLoot:e=>rows.set(e.id,structuredClone(e))});return{rows,flow};};

test('E/F search anticipation does not create loot or consume the search hold as Yes',()=>{
 const {flow,rows}=fixture();flow.anticipate(0);assert.equal(flow.armed(11000),true);assert.equal(flow.armed(12001),false);assert.equal(rows.size,0);
 assert.equal(flow.observeInput({...reading,capturedAt:1200},key(),'run',2000),false);assert.equal(rows.size,0);
 assert.equal(flow.choose(key(),2000),false);flow.observe({...reading,inputId:undefined,verifiedHeader:true},'run',2100);assert.equal(flow.pending.choice,undefined);
});
test('an E shortcut can accept a short-lived dialog even when OCR finishes after it closed',()=>{
 const {flow,rows}=fixture();assert.equal(flow.observeInput(reading,key(),'run',5000),true);
 const entry=[...rows.values()][0];assert.equal(entry.status,'accepted');assert.equal(entry.quantity,880);assert.equal(entry.foundAt,1000);assert.equal(entry.endedAt,1500);assert.equal(entry.sessionId,'run');
 assert.equal(flow.observeInput(reading,key(),'run',6000),true);assert.equal(rows.size,1);
 assert.equal(flow.observeInput(reading,key('E','repeat-key'),'run',6000),false);assert.equal(rows.size,1);
});
test('F is a search key, not Yes, unless the dialog explicitly binds Yes to F',()=>{
 let {flow,rows}=fixture();assert.equal(flow.observeInput(reading,key('F'),'run',2000),false);assert.equal(rows.size,0);
 ({flow,rows}=fixture());assert.equal(flow.observeInput({...reading,text:text.replace('YES (E)','YES (F)')},key('F'),'run',2000),true);assert.equal([...rows.values()][0].status,'accepted');assert.equal(lootBindings('YES (F) NO (T)').E,undefined);
});
test('No, Use, inside clicks and outside clicks stay distinct in frame-linked choices',()=>{
 for(const [input,status]of [[key('T'),'rejected'],[key('C'),'used'],[{id:'mouse',at:1050,action:'click',x:.45,y:.52},'accepted']]){const {flow,rows}=fixture();assert.equal(flow.observeInput(reading,input,'run',2000),true);assert.equal([...rows.values()][0].status,status);}
 const {flow,rows}=fixture();assert.equal(flow.observeInput(reading,{id:'outside',at:1050,action:'click',x:.9,y:.9},'run',2000),false);assert.equal(rows.size,0);
});
test('future, stale, unrelated, incomplete or low-confidence frames cannot prove a pickup',()=>{
 for(const changed of [{capturedAt:1100},{capturedAt:400},{text:'SEARCHING...'}, {confidence:74}]){const {flow,rows}=fixture();assert.equal(flow.observeInput({...reading,...changed},key(),'run',2000),false);assert.equal(rows.size,0);}
 const {flow,rows}=fixture();assert.equal(flow.observeInput(reading,key(),'run',12000),false);assert.equal(rows.size,0);
});
test('a native choice requires either observed dismissal or later absent frames',()=>{
 const {flow,rows}=fixture();flow.observeInput({...reading,inputAfterAt:undefined},key(),'run',3000);assert.equal([...rows.values()][0].status,'found');
 for(const at of [4000,4300,4600])flow.observe({kind:'absent'},'run',at);assert.equal([...rows.values()][0].status,'accepted');
});
test('unknown stack counts remain missing even when the keyboard pickup is confirmed',()=>{
 const {flow,rows}=fixture();flow.observeInput({...reading,quantityVerified:false},key(),'run',2000);assert.equal([...rows.values()][0].status,'accepted');assert.equal([...rows.values()][0].quantity,undefined);
});
test('a long-open stale pending name can be matched by the actual input frame without adding a duplicate',()=>{
 const {flow,rows}=fixture();flow.observe(reading,'run',0);flow.observe(reading,'run',500);const id=flow.pending.id;
 assert.equal(flow.observeInput({...reading,capturedAt:29850,inputAfterAt:30500}, {...key(),at:30000},'run',31000),true);assert.equal(rows.size,1);assert.equal([...rows.values()][0].id,id);assert.equal([...rows.values()][0].status,'accepted');
});
test('the dialog ring is bounded and never substitutes a future or old frame for a keypress',()=>{
 const frames=new LootFrames(3);for(const at of [1000,1100,1200,1300])frames.push({at},at);
 assert.equal(frames.frames.length,3);assert.equal(frames.before(1250).at,1200);assert.equal(frames.before(1000),null);assert.equal(frames.before(2000),null);assert.equal(frames.after(1150).at,1200);frames.clear();assert.equal(frames.frames.length,0);
});
test('clearing old history preserves preferences, pairing, catalog and market data',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-clear-')),store=new DesktopStore(path.join(directory,'db.sqlite'));
 store.set('settings',{overlay:true,language:'en'});store.set('priceClients',[{hash:'test-only-hash'}]);store.set('experience',{session:{running:false}});store.save(null,{id:'session',startedAt:1,running:false},{overlay:true,language:'en'});store.saveLoot({id:'loot',sessionId:'session',foundAt:1,item:'Whiskey',status:'accepted'});
 const now=Date.now();store.saveCatalog({version:1,observedAt:now,items:[{itemId:'whiskey',name:'Whiskey',kind:'item'}]});store.savePrices({version:1,observedAt:now,market:{zone:'21',label:'Test'},offers:[{itemId:'whiskey',name:'Whiskey',quantity:1,total:100,unitKind:'item'}]});
 store.clearHistory();assert.equal(store.count(),0);assert.equal(store.lootHistory().length,0);assert.equal(store.get('experience',null),null);assert.equal(store.get('settings').language,'en');assert.equal(store.get('priceClients')[0].hash,'test-only-hash');assert.equal(store.itemCatalog().length,1);assert.equal(store.prices('21').length,1);assert.equal(store.db.prepare('PRAGMA quick_check').get().quick_check,'ok');store.close();
});
test('native E/F hold timing requires a second, rearms after release and resets on focus changes',{skip:process.platform!=='win32'},()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dfov-hold-')),exe=path.join(folder,'probe.exe'),compiler=path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
 execFileSync(compiler,['/nologo','/target:exe','/r:System.Web.Extensions.dll','/out:'+exe,path.resolve('native/WindowProbe.cs'),path.resolve('native/SearchHoldTracker.cs')],{windowsHide:true});
 assert.deepEqual(JSON.parse(execFileSync(exe,['--test-search-hold'],{encoding:'utf8',windowsHide:true}).trim()),{holdTiming:true,release:true,focusReset:true});assert.deepEqual(JSON.parse(execFileSync(exe,['--test-loot-hotkey'],{encoding:'utf8',windowsHide:true}).trim()),{hotkey:true});const detected=JSON.parse(execFileSync(exe,['--fixture',String(process.pid),'--once'],{encoding:'utf8',windowsHide:true}).trim());assert.equal(detected.clients.length,1);assert.equal(detected.clients[0].processId,process.pid);assert.match(detected.clients[0].processStartedAt,/^\d+$/);assert.equal(detected.windows.length,0);fs.unlinkSync(exe);
});

test('a damaged shortcut label does not hide an otherwise complete item-found dialog',()=>{const {flow,rows}=fixture();assert.equal(flow.observeInput({...reading,text:text.replace('NO (T)','NOM')},key(),'run',2000),true);assert.equal([...rows.values()][0].status,'accepted');});

test('fixed-label OCR errors and unreadable stack numbers keep the item without inventing a quantity',()=>{const {flow,rows}=fixture();const damaged=text.replace('FOUND SOME','FOND SORE').replace('(880)','(BBO)');assert.equal(flow.observeInput({...reading,text:damaged,quantityVerified:false},key(),'run',2000),true);const entry=[...rows.values()][0];assert.equal(entry.item,'12.7MM RIFLE BULLETS');assert.equal(entry.quantity,undefined);assert.equal(entry.status,'accepted');});

test('recent distinct absent input frames finish a prior verified choice even during continuous combat clicks',()=>{
 const {flow,rows}=fixture();flow.observeInput({...reading,inputDismissed:false},key(),'run',1600);
 const absent=at=>({kind:'absent',dialogVisible:false,capturedAt:at});
 assert.equal(flow.observeInputAbsence(absent(1900),{id:'combat1',at:1950},2000),true);
 assert.equal(flow.observeInputAbsence(absent(1900),{id:'duplicate',at:1950},2050),false);
 assert.equal(flow.observeInputAbsence(absent(2100),{id:'combat2',at:2150},2200),true);
 assert.equal([...rows.values()][0].status,'found');
 assert.equal(flow.observeInputAbsence(absent(2500),{id:'combat3',at:2550},2600),true);
 assert.equal([...rows.values()][0].status,'accepted');assert.equal(flow.pending,null);
});
test('absent input frames cannot create pickups, confirm stale frames or cross a choice boundary',()=>{
 const {flow,rows}=fixture();flow.observe(reading,'run',1000);flow.observe(reading,'run',1100);
 assert.equal(flow.observeInputAbsence({kind:'absent',dialogVisible:false,capturedAt:1200},{id:'no-choice',at:1250},1300),false);
 flow.choose({...key(),at:1500},1500);
 for(const [reading,input,now] of [
 [{kind:'absent',dialogVisible:false,capturedAt:1400},{id:'before',at:1450},1600],
 [{kind:'absent',dialogVisible:false,capturedAt:1700},{id:'future',at:1600},1800],
 [{kind:'absent',dialogVisible:false,capturedAt:1600},{id:'stale',at:1650},4000],
 [{kind:'unknown',dialogVisible:true,capturedAt:1600},{id:'visible',at:1650},1800]
 ])assert.equal(flow.observeInputAbsence(reading,input,now),false);
 assert.equal([...rows.values()][0].status,'found');
});
