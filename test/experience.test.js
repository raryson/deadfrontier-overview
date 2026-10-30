import test from 'node:test';
import assert from 'node:assert/strict';
import {recordExperience,startExperience,stopExperience,setExperienceMultiplier,experienceStats} from '../experience.js';
const sample=(xp,extra={})=>({account:'123',xp,level:1,serverTime:100,...extra});
test('XP recebida, líquida e por hora partem de uma leitura inicial sem contar XP anterior',()=>{
  let xp=startExperience(recordExperience(null,sample(100),0,5),0);
  xp=recordExperience(xp,sample(1100,{serverTime:101}),600000,5);
  assert.equal(experienceStats(xp,600000).gained,1000);
  assert.equal(experienceStats(xp,600000).perHour,6000);
  xp=recordExperience(xp,sample(900,{serverTime:102}),900000,5);
  assert.equal(experienceStats(xp,900000).net,800);
  assert.equal(experienceStats(xp,900000).lost,200);
});
test('duplicatas e leituras anteriores não inflam ganhos nem perdas',()=>{
  let xp=startExperience(recordExperience(null,sample(100),0,5),0);
  xp=recordExperience(xp,sample(200,{serverTime:101}),1000,5);
  xp=recordExperience(xp,sample(200,{serverTime:101}),2000,5);
  assert.equal(xp.session.gained,100);
  assert.equal(recordExperience(xp,sample(10,{serverTime:99}),3000,5),xp);
});
test('mudança de nível usa o limiar anterior sem interpretar a redução como morte',()=>{
  let xp=startExperience(recordExperience(null,sample(900,{nextLevelXp:1000}),0,5),0);
  xp=recordExperience(xp,sample(50,{level:2,serverTime:101}),1000,5);
  assert.equal(xp.session.gained,150);assert.equal(xp.session.lost,0);
});
test('saltos de nível usam XP acumulada; sem limiares registram lacuna sem inventar ganho',()=>{
  let xp=startExperience(recordExperience(null,sample(100,{totalXp:1100}),0,5),0);
  xp=recordExperience(xp,sample(200,{level:3,totalXp:5200,serverTime:101}),1000,5);
  assert.equal(xp.session.gained,4100);
  xp=recordExperience(xp,sample(20,{level:5,serverTime:102}),2000,5);
  assert.equal(xp.session.gained,4100);assert.equal(xp.session.gap,true);
});
test('fator é aplicado por intervalo e mudança não recalcula ganhos anteriores',()=>{
  let xp=setExperienceMultiplier(startExperience(recordExperience(null,sample(0),0,5),0),2);
  xp=recordExperience(xp,sample(200,{serverTime:101}),1000,5);
  xp=setExperienceMultiplier(xp,4);
  xp=recordExperience(xp,sample(600,{serverTime:102}),2000,5);
  assert.equal(xp.session.baseGained,200);
  assert.equal(xp.session.gained,600);
  assert.equal(experienceStats(xp,2000).basePartial,false);
});
test('períodos sem fator ficam marcados como parciais e não recebem estimativa retroativa',()=>{
  let xp=startExperience(recordExperience(null,sample(0),0,5),0);
  xp=recordExperience(xp,sample(100,{serverTime:101}),1000,5);
  xp=setExperienceMultiplier(xp,2);
  xp=recordExperience(xp,sample(300,{serverTime:102}),2000,5);
  assert.equal(xp.session.baseGained,100);assert.equal(experienceStats(xp,2000).basePartial,true);
});
test('parar congela duração e nova conta não herda sessão nem fator',()=>{
  let xp=setExperienceMultiplier(startExperience(recordExperience(null,sample(0),0,5),0),2);
  xp=stopExperience(xp,10000);
  assert.equal(experienceStats(xp,999999).elapsed,10000);
  xp=recordExperience(xp,sample(100,{account:'456'}),20000,6);
  assert.equal(xp.session,null);assert.equal(xp.multiplier,undefined);assert.equal(xp.ownerTabId,6);
});
test('dados antigos, inválidos e divisor inválido são tratados explicitamente',()=>{
  const xp=recordExperience(null,sample(0),0,5);
  assert.equal(experienceStats(xp,100000).stale,true);
  assert.throws(()=>startExperience(xp,130000));
  assert.throws(()=>recordExperience(xp,sample(-1)));
  assert.throws(()=>setExperienceMultiplier(xp,0));
  assert.equal(experienceStats(startExperience(xp,0),0).perHour,0);
});
