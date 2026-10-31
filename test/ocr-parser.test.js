import test from 'node:test';import assert from 'node:assert/strict';
import {parseHudXp,createOcrGate,defaultHudRegion} from '../ocr-parser.js';
test('HUD com K respeita milhares e a precisão visível, incluindo vírgula lida como ponto',()=>{
  for(const value of ['1,234K','1.234K','1234K']) {
    const p=parseHudXp(`LV. 12: ${value} / 2,000K (62%)`);
    assert.equal(p.xp,1234000);assert.equal(p.nextLevelXp,2000000);assert.equal(p.precision,1000);
  }
});
test('decimais M e XP sem abreviação são aceitos sem inventar casas escondidas',()=>{
  assert.equal(parseHudXp('LV 12: 1.5M / 2M').xp,1500000);
  assert.equal(parseHudXp('LV 12: 1.5M / 2M').precision,100000);
  assert.equal(parseHudXp('LV 12: 123 / 500').precision,1);
  assert.equal(parseHudXp('LV 12: 600K / 500K').xp,600000);
});
test('leituras sem marcador de nível, com denominador zero ou nível impossível são descartadas',()=>{
  for(const value of ['ENERGY 100%','1234K / 2000K','LV 12: 100 / 0','LV 999: 100 / 500','LV 12: ABC / 500'])assert.equal(parseHudXp(value),null);
});
const reading=xp=>({xp,level:12,nextLevelXp:2000000,precision:1000});
test('primeira leitura exige confirmação e duas leituras coerentes podem acompanhar ganho contínuo',()=>{
  const gate=createOcrGate();assert.equal(gate.accept(reading(1000000),90,0),null);
  assert.equal(gate.accept(reading(1002000),90,2000).xp,1002000);
  assert.equal(gate.accept(reading(1004000),90,4000).xp,1004000);
});
test('baixa confiança, oscilação pequena para baixo e saltos isolados não viram XP ganha/perdida',()=>{
  const gate=createOcrGate();gate.accept(reading(1000000),90,0);gate.accept(reading(1000000),90,2000);
  assert.equal(gate.accept(reading(8000000),10,4000),null);
  assert.equal(gate.accept(reading(999000),90,4000),null);
  assert.equal(gate.accept(reading(8000000),90,4000),null);
  assert.equal(gate.accept(reading(1001000),90,6000).xp,1001000);
});
test('queda expressiva e mudança de nível precisam de confirmação; nova área exige nova linha base',()=>{
  const gate=createOcrGate();gate.accept(reading(1000000),90,0);gate.accept(reading(1000000),90,2000);
  assert.equal(gate.accept(reading(800000),90,4000),null);
  assert.equal(gate.accept(reading(800000),90,6000).xp,800000);
  const next={...reading(5000),level:13,nextLevelXp:3000000};
  assert.equal(gate.accept(next,90,8000),null);assert.equal(gate.accept(next,90,10000).level,13);
  gate.reset();assert.equal(gate.accept(next,90,12000),null);
});
test('área padrão acompanha o deslocamento em pixels do HUD sem depender da resolução',()=>{
  assert.equal(Math.round(defaultHudRegion(1920,1080).y*1080),80);
  assert.equal(Math.round(defaultHudRegion(1366,768).y*768),80);
});

test('sufixo perdido e percentual incompatível não criam ganhos ou mortes falsos',()=>{
  assert.equal(parseHudXp('LV 94: 2,113 / 5,500K (38%)'),null);
  assert.equal(parseHudXp('LV 94: 2,113K / 5,500K (88%)'),null);
  assert.equal(parseHudXp('LV 94: 2,113K / 5,500K (38%)').xp,2113000);
  assert.equal(parseHudXp('LV 94: 2,178K / 5500K (407%)').xp,2178000);
  assert.equal(parseHudXp('LV 1: 123 / 500 (25%)').xp,123);
  const slash=parseHudXp('LV 94: 2249K 7 5.500K 141%');
  assert.equal(slash.xp,2249000);assert.equal(slash.nextLevelXp,5500000);
});

test('limiar errado se recupera com três leituras coerentes mesmo enquanto XP sobe',()=>{
  const gate=createOcrGate();gate.accept(reading(1000000),90,0);gate.accept(reading(1000000),90,2000);
  const corrected=xp=>({...reading(xp),nextLevelXp:2500000});
  assert.equal(gate.accept(corrected(1002000),90,4000),null);
  assert.equal(gate.accept(corrected(1004000),90,6000),null);
  assert.equal(gate.accept(corrected(1006000),90,8000).rebase,true);
  assert.equal(gate.accept(corrected(1008000),90,10000).rebase,undefined);
});

test('subida de nível aceita confirmação coerente sem exigir XP idêntica',()=>{
  const gate=createOcrGate();gate.accept(reading(1990000),90,0);gate.accept(reading(1990000),90,2000);
  const next=xp=>({...reading(xp),level:13,nextLevelXp:3000000});
  assert.equal(gate.accept(next(5000),90,4000),null);
  assert.equal(gate.accept(next(10000),90,6000).xp,10000);
});
