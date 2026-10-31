import test from 'node:test';
import assert from 'node:assert/strict';
import {recordExperience,startExperience,stopExperience,setExperienceMultiplier,experienceStats,rememberExperience,EXPERIENCE_HISTORY_LIMIT} from '../experience.js';
const sample=(xp,extra={})=>({account:'123',xp,level:1,serverTime:100,...extra});

test('recuperação da referência OCR marca lacuna sem inventar ganho ou perda',()=>{
  let xp=startExperience(recordExperience(null,sample(100000,{source:'ocr'}),0),0);
  xp=recordExperience(xp,sample(200000,{source:'ocr',rebase:true}),2000);
  assert.equal(xp.session.gained,0);assert.equal(xp.session.lost,0);assert.equal(xp.session.gap,true);
  xp=recordExperience(xp,sample(205000,{source:'ocr'}),4000);
  assert.equal(xp.session.gained,5000);
});
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
test('captura local não é sobrescrita pela consulta atrasada da cidade',()=>{
  let xp=recordExperience({capture:{active:true}},sample(1000,{source:'ocr',precision:1000}),0,5);
  xp=startExperience(xp,0);
  xp=recordExperience(xp,sample(3000,{source:'ocr',precision:1000}),2000,5);
  assert.equal(xp.session.gained,2000);assert.equal(xp.latest.source,'ocr');
  assert.equal(recordExperience(xp,sample(100,{source:'server',serverTime:200}),3000,7),xp);
  assert.equal(experienceStats(xp,13000).stale,true);
});
test('trocar de fonte encerra a sessão em vez de contar diferença entre XP arredondada e exata',()=>{
  let xp=startExperience(recordExperience(null,sample(1234),0,5),0);
  xp=recordExperience(xp,sample(2000,{source:'ocr',precision:1000}),1000,5);
  assert.equal(xp.session.running,false);assert.equal(xp.session.gained,0);
});

test('histórico atualiza a sessão pelo identificador e congela resultados e endpoints ao parar',()=>{
  let xp=setExperienceMultiplier(startExperience(recordExperience(null,sample(100),0,5),0),2);
  let history=rememberExperience([],xp,0);
  const id=xp.session.id;
  assert.equal(startExperience(xp,1000).session.id,id);
  xp=recordExperience(xp,sample(500),2000,5);
  history=rememberExperience(history,xp,2000);
  assert.equal(history.length,1);assert.equal(history[0].gained,400);
  xp=stopExperience(xp,4000);history=rememberExperience(history,xp,4000,'stopped');
  assert.equal(history[0].baseGained,200);assert.equal(history[0].perHour,360000);
  const closed=structuredClone(history[0]);
  xp=recordExperience(xp,sample(900),6000,5);
  history=rememberExperience(history,xp,6000);
  assert.deepEqual(history[0],closed);assert.equal(history[0].finalXp,500);
});

test('histórico mantém contas distintas, estimativa parcial e somente as últimas 100 sessões',()=>{
  let history=[];
  for(let index=0;index<EXPERIENCE_HISTORY_LIMIT+2;index++){
    let xp=startExperience(recordExperience(null,sample(0,{account:index%2?'123':'456'}),index*10000,5),index*10000);
    xp=recordExperience(xp,sample(100,{account:xp.latest.account}),index*10000+1000,5);
    xp=stopExperience(xp,index*10000+2000);
    history=rememberExperience(history,xp,index*10000+2000);
  }
  assert.equal(history.length,100);assert.equal(history.at(-1).startedAt,20000);
  assert.equal(history[0].basePartial,true);assert.equal(history[0].baseAvailable,false);
  assert.deepEqual([...new Set(history.map(entry=>entry.account))].sort(),['123','456']);
});
