import test from 'node:test';import assert from 'node:assert/strict';
import {hudStrokeRegions,lootReadRegions,LootLayoutSearch} from '../ui/capture-layout.mjs';
import {enhanceLootText,chooseLootRead,LOOT_OCR_LIMITS} from '../ui/loot-ocr.mjs';
import {canonicalLootName,parseLootReading} from '../ui/loot-journal.mjs';
const catalog=[{name:'Exterminator Reactive',kind:'equipment'},{name:'Exterminator Reactive XT',kind:'equipment'},{name:'Mesh SLX',kind:'equipment'},{name:'VSS Vintorez',kind:'equipment'},{name:'Whiskey',kind:'item'},{name:'Red Rum',kind:'item'},{name:'12.7mm Rifle Bullets',kind:'round'}];
test('automatic crops stay within resized, ultrawide and HiDPI capture frames',()=>{
 for(const[w,h]of [[640,480],[1280,720],[1366,768],[1920,1080],[2560,1440],[3440,1440],[3840,2160]])for(const region of [...hudStrokeRegions(w,h),...lootReadRegions(w,h)]){assert.ok(region.x>=0&&region.y>=0);assert.ok(region.x+region.width<=1.00001&&region.y+region.height<=1.00001);}
 assert.ok(hudStrokeRegions(3840,2160).some(r=>r.scale===2&&Math.round(r.y*2160)===164));
 assert.ok(hudStrokeRegions(1920,1080).some(r=>r.scale===1.5));
 const search=new LootLayoutSearch(),initial=search.candidates(1920,1080,0);assert.ok(initial.length<=2);const adjusted=lootReadRegions(1920,1080).find(r=>r.scale===1.5);search.found(adjusted);assert.equal(search.candidates(1920,1080,67)[0],adjusted);assert.equal(search.candidates(1280,720,100)[0].scale,.667);
});
test('names survive damaged choice text, colour prefixes and punctuation without guessing unknown variants',()=>{
 for(const colour of ['Grey','Black','Blue','Red','Green','White','Yellow','Purple','Orange','Brown'])assert.equal(canonicalLootName(colour+' Mesh SLX',catalog),'Mesh SLX');
 assert.equal(canonicalLootName('Red Rum',catalog),'Red Rum');
 assert.equal(parseLootReading('YOU HAVE FOUND A GREY EXTERMINATOR REACTIVE. VAL YOU TAKE',catalog).item,'Exterminator Reactive');
 assert.equal(parseLootReading("YOU HAVE FOUND A VSS VINTOREZ’ WEL YOU TAKE",catalog).item,'VSS Vintorez');
 assert.equal(parseLootReading('YOU HAVE FOUND A BLUE EXTERMINATOR REACTIVE XT',catalog).item,'Exterminator Reactive XT');
 assert.equal(parseLootReading('YOU HAVE FOUND A BLUE EXTERMINATOR REACTIVE UNKNOWN',catalog),null);
 assert.equal(parseLootReading('WHISKEY IN INVENTORY',catalog),null);
});
test('multiple passes agree on names while conflicting identities and stack quantities remain reviewable',()=>{
 const read=(item,confidence=90)=>({text:'YOU HAVE FOUND SOME '+item+'. WILL YOU TAKE IT?',confidence});
 const same=chooseLootRead([read('12.7MM RIFLE BULLETS'),read('12.7MM RIFLE BULLETS (830)',80),read('12.7MM RIFLE BULLETS (830)',85)],catalog);
 assert.equal(same.agreement,3);assert.equal(same.quantityConfidence,95);assert.match(same.text,/830/);
 assert.equal(chooseLootRead([read('12.7MM RIFLE BULLETS (830)'),read('12.7MM RIFLE BULLETS (880)')],catalog).quantityConflict,true);
 assert.equal(chooseLootRead([read('Whiskey'),read('Mesh SLX')],catalog).nameConflict,true);
 assert.equal(LOOT_OCR_LIMITS.perEvent,8);
});
test('text contrast and sharpening preserve dimensions and avoid bogus text on flat frames',()=>{
 const pixels=new Uint8ClampedArray(20*20*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=160;pixels[i+1]=50;pixels[i+2]=40;pixels[i+3]=255;}
 for(const mode of ['contrast','sharp']){const output=enhanceLootText(pixels,20,20,mode);assert.equal(output.length,pixels.length);for(let i=0;i<output.length;i+=4){assert.equal(output[i],255);assert.equal(output[i+3],255);}}
 assert.throws(()=>enhanceLootText(new Uint8Array(4),20,20));
});
