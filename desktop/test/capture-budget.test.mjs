import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPTURE_LIMITS,HudScanBudget,pixelSignature} from '../ui/capture-budget.mjs';
import {hudReadRegions} from '../ui/xp-regions.mjs';
import {LootSnapshotQueue} from '../ui/loot-snapshots.mjs';

test('failed HUD scans have a bounded recognition budget, back off and eventually try every fallback',()=>{
 const budget=new HudScanBudget(),regions=hudReadRegions(1920,1080),seen=new Set();
 for(let cycle=0;cycle<8;cycle++){const attempts=budget.attempts(regions);assert.ok(attempts.length<=3);for(const choice of attempts)seen.add(JSON.stringify(choice));budget.result(null);}
 assert.equal(seen.size,24);assert.equal(budget.delay,5000);
 const known={candidate:regions[0],threshold:80};budget.result(known);assert.equal(budget.delay,2000);assert.deepEqual(budget.attempts(regions)[0],{area:regions[0],threshold:80});
 budget.reset();assert.equal(budget.preferred,null);
 assert.equal(CAPTURE_LIMITS.fps,15);assert.equal(CAPTURE_LIMITS.recentFrames,6);
});

test('unchanged HUD pixels can reuse a readout while even a small RGB change invalidates its signature',()=>{
 const a=Uint8Array.from([120,130,140,255,50,60,70,255]),b=new Uint8Array(a);
 assert.equal(pixelSignature(a),pixelSignature(b));b[4]++;assert.notEqual(pixelSignature(a),pixelSignature(b));
});

test('resolved loot cancels queued work and stops later automatic retries without duplicating the encounter',()=>{
 const queue=new LootSnapshotQueue({id:()=> 'loot'});const first=queue.offer({},1000,true);queue.offer({},1150,true);assert.equal(queue.size,2);
 queue.resolve(first);assert.equal(queue.size,0);assert.equal(queue.offer({},1400,true),first);assert.equal(queue.size,0);
 queue.offer({},1600,false);queue.offer({},1750,true);assert.equal(queue.size,1);
});
