import test from 'node:test';
import assert from 'node:assert/strict';
import {readHudStrokes} from '../ui/hud-strokes.mjs';
test('stroke reader refuses black/loading frames, incomplete crops and random scenery',()=>{
 assert.equal(readHudStrokes(new Uint8Array(320*22*4),320,22),null);
 assert.equal(readHudStrokes(new Uint8Array(320*21*4),320,21),null);
 let seed=271828;for(let frame=0;frame<100;frame++){const pixels=new Uint8Array(320*22*4);for(let i=0;i<pixels.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[i]=seed>>>24;}assert.equal(readHudStrokes(pixels,320,22),null);}
});
