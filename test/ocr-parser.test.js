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
test('XP exata abaixo de um milhão aceita alvo com K somente quando o percentual resolve o sufixo',()=>{
  for(const token of ['669,855','669.855','669855']){
    const result=parseHudXp(`LV 100: ${token} / 6,100K (11%)`);
    assert.equal(result.xp,669855);assert.equal(result.nextLevelXp,6100000);assert.equal(result.precision,1);
  }
  assert.equal(parseHudXp('LV 100: 1,000 / 6,100K (0%)').xp,1000);
  for(const text of ['LV 100: 669,855 / 6,100K (407%)','LV 100: 2,113 / 6,100K (35%)'])assert.equal(parseHudXp(text),null);
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

test('percentual com parêntese confundido com 7 permite XP exata somente com razão compatível',()=>{
  for(const [xp,percent]of [[933291,'157'],[951041,'167'],[966990,'167']]){
    const sample=parseHudXp(`LV 100: ${xp} / 6100K (${percent}%)`);assert.equal(sample.xp,xp);assert.equal(sample.nextLevelXp,6100000);
  }
  for(const text of ['LV 100: 933291 / 6100K (407%)','LV 100: 933291 / 6100K (168%)','LV 100: 933 / 6100K (157%)','LV 100: 933291 / 6100K (997%)'])assert.equal(parseHudXp(text),null);
});

test('XP sem K funciona no início do nível e em valores exatos grandes sem aceitar um K perdido',()=>{
 for(const xp of [1,12,999,1000,12345,933291,1001234]){const result=parseHudXp('LV 100: '+xp+' / 6100K ('+Math.floor(xp/6100000*100)+'%)');assert.equal(result.xp,xp);assert.equal(result.precision,1);}
 assert.equal(parseHudXp('LV 100: 933291 / 6100K').xp,933291);
 assert.equal(parseHudXp('LV 100: 2,113 / 6100K (35%)'),null);
 assert.equal(parseHudXp('LV 100: 2,113 / 6100K'),null);
 assert.equal(parseHudXp('LV 100: 150 / 6100K',{previous:{level:100,xp:100,precision:1}}).xp,150);
});

test('exact XP can start from three coherent moving readouts with moderate OCR confidence',()=>{
 const gate=createOcrGate(),raw=xp=>({xp,level:100,nextLevelXp:6100000,precision:1});
 assert.equal(gate.accept(raw(1234),64,0),null);assert.equal(gate.accept(raw(2345),68,2000),null);
 assert.equal(gate.accept(raw(3456),66,4000).xp,3456);assert.equal(gate.accept(raw(4567),67,6000).xp,4567);
 const bad=createOcrGate();assert.equal(bad.accept(raw(1),59,0),null);assert.equal(bad.accept(raw(999999),64,2000),null);assert.equal(bad.accept(raw(1),65,4000),null);
});
test('a damaged closing parenthesis does not hide a valid zero-percent exact XP readout',()=>{
 for(const tail of ['(0%7','(0%,','(0%','(0%)'])assert.equal(parseHudXp('LV 100: 1,234 / 6,100K '+tail).xp,1234);
 assert.equal(parseHudXp('LV 100: 2,113 / 6100K (35%7'),null);
});

test('capped HUD percentages preserve XP above the level target in fast modes',()=>{
 const gate=createOcrGate();
 const first=parseHudXp('LV 106: 7,233K / 6,700K (100%)');
 assert.equal(first.xp,7233000);assert.equal(first.nextLevelXp,6700000);
 assert.equal(gate.accept(first,85,0),null);
 const next=parseHudXp('LV 106: 7,300K / 6,700K (100%)');
 assert.equal(gate.accept(next,85,2000).xp,7300000);
 assert.equal(parseHudXp('LV 106: 7,233K / 6,700K (99%)'),null);
 assert.equal(parseHudXp('LV 106: 7,233 / 6,700K (100%)'),null);
 assert.equal(parseHudXp('LV 106: 233K / 6,700K (100%)'),null);
});
