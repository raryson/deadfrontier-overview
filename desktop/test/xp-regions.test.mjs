import test from 'node:test';
import assert from 'node:assert/strict';
import {hudReadRegions} from '../ui/xp-regions.mjs';
import {parseHudXp,createOcrGate} from '../../ocr-parser.js';

test('raw-XP crop matches the real HUD line and retains coarse/title-bar fallbacks without drifting',()=>{
 const regions=hudReadRegions(1920,1080),first=regions[0];
 assert.equal(Math.round(first.y*1080),85);assert.equal(Math.round(first.width*1920),220);assert.equal(Math.round(first.height*1080),17);
 assert.equal(Math.round(regions[2].y*1080),80);assert.equal(Math.round(regions[3].y*1080),117);
 assert.deepEqual(hudReadRegions(1920,1080),regions);
 const custom={x:.1,y:.2,width:.3,height:.04};assert.deepEqual(hudReadRegions(1920,1080,custom),[custom]);
 for(const region of hudReadRegions(320,200)){assert.ok(region.y>=0&&region.y+region.height<=1);assert.ok(region.width>0&&region.width<=1);}
});

test('the actual level-105 raw-XP OCR starts and accumulates a moving exact readout',()=>{
 const gate=createOcrGate(),read=xp=>parseHudXp(`LY 105: ${xp} / 6.600K (1%)`);
 const sample=read(45459);assert.equal(sample.level,105);assert.equal(sample.xp,45459);assert.equal(sample.nextLevelXp,6600000);assert.equal(sample.precision,1);
 assert.equal(gate.accept(sample,71,0),null);assert.equal(gate.accept(read(46000),71,2000),null);
 assert.equal(gate.accept(read(47000),71,4000).xp,47000);assert.equal(gate.accept(read(48000),71,6000).xp,48000);
 assert.equal(parseHudXp('LV 105: 45,459 / 6,600K (1%)').xp,45459);
 assert.equal(parseHudXp('LV 105: 45,459 / 6,600 (1%)'),null);
});
