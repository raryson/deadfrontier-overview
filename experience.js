export function recordExperience(previous, sample, now = Date.now(), tabId = null) {
  if (!sample || !/^\d{1,20}$/.test(sample.account) || !Number.isSafeInteger(sample.xp) || sample.xp < 0 || !Number.isSafeInteger(sample.level) || sample.level < 1 || sample.level > 1000) throw Error('Dados de XP inválidos.');
  for (const key of ['totalXp','nextLevelXp','serverTime']) if (sample[key] != null && (!Number.isSafeInteger(sample[key]) || sample[key] < 0)) throw Error('Dados de XP inválidos.');
  const source=sample.source==='ocr'?'ocr':'server';
  const latest = { account:sample.account, xp:sample.xp, level:sample.level, totalXp:sample.totalXp ?? null, nextLevelXp:sample.nextLevelXp ?? null, serverTime:sample.serverTime ?? null, receivedAt:now,source,precision:source==='ocr'&&Number.isFinite(sample.precision)?Math.max(1,sample.precision):1 };
  if(previous?.capture?.active && source!=='ocr')return previous;
  if (!previous?.latest) return {...previous,latest,ownerTabId:tabId,session:null};
  if(previous.latest.account!==sample.account)return {latest,ownerTabId:tabId,session:null};
  if (source!=='ocr' && latest.serverTime != null && previous.latest.serverTime != null && latest.serverTime < previous.latest.serverTime) return previous;
  let session=previous.session ? {...previous.session} : null;
  if((previous.latest.source??'server')!==source)session=session?.running?{...session,running:false,endedAt:now}:session;
  if (session?.running) {
    const old=previous.latest;
    let delta=null;
    if(old.totalXp != null && latest.totalXp != null) delta=latest.totalXp-old.totalXp;
    else if(old.level===latest.level) delta=latest.xp-old.xp;
    else if(latest.level===old.level+1 && old.nextLevelXp != null) delta=old.nextLevelXp-old.xp+latest.xp;
    if(delta===null) session.gap=true;
    else if(delta>=0) {
      session.gained+=delta;
      if(previous.multiplier) session.baseGained=(session.baseGained??0)+delta/previous.multiplier;
      else session.unknownBaseXp=(session.unknownBaseXp??0)+delta;
    }
    else session.lost-=delta;
    if(!Number.isSafeInteger(session.gained) || !Number.isSafeInteger(session.lost)) throw Error('Dados de XP inválidos.');
  }
  return {...previous,latest,session,ownerTabId:session?.running?previous.ownerTabId:tabId};
}
export function startExperience(experience, now = Date.now()) {
  if(!experience?.latest || now-experience.latest.receivedAt>120000) throw Error('Atualize a XP antes de iniciar a sessão.');
  return {...experience,session:{startedAt:now,endedAt:null,running:true,gained:0,lost:0,baseGained:0,unknownBaseXp:0,gap:false}};
}
export function setExperienceMultiplier(experience,multiplier) {
  if(multiplier!==null && (!Number.isFinite(multiplier) || multiplier<=0 || multiplier>1000)) throw Error('Multiplicador de XP inválido.');
  return {...experience,multiplier};
}
export function stopExperience(experience, now = Date.now()) {
  if(!experience?.session?.running) return experience;
  return {...experience,session:{...experience.session,running:false,endedAt:now}};
}
export function experienceStats(experience, now = Date.now()) {
  const session=experience?.session;
  const stale=!experience?.latest || now-experience.latest.receivedAt>(experience.latest.source==='ocr'?10000:90000);
  if(!session) return {net:0,gained:0,lost:0,perHour:0,netPerHour:0,baseGained:0,basePerHour:0,basePartial:false,elapsed:0,stale};
  const elapsed=Math.max(0,(session.running?now:session.endedAt)-session.startedAt);
  const net=session.gained-session.lost;
  return {net,gained:session.gained,lost:session.lost,perHour:elapsed>=1000?session.gained*3600000/elapsed:0,netPerHour:elapsed>=1000?net*3600000/elapsed:0,baseGained:session.baseGained??0,basePerHour:elapsed>=1000?(session.baseGained??0)*3600000/elapsed:0,basePartial:(session.unknownBaseXp??0)>0,elapsed,stale};
}
