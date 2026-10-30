// MAIN-world helper. Extract only XP fields, never authentication data.
function overviewXpSample(values, table, account) {
  const value = key => values[`DFSTATS_${key}`] ?? values[key];
  const integer = raw => /^\d+$/.test(String(raw)) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
  const xp=integer(value('df_exp')), level=integer(value('df_level'));
  if(xp===null || level===null || level<1 || level>1000 || !/^\d{1,20}$/.test(String(account))) return null;
  const threshold=levelNumber => integer(values[`EXPTABLE_exp_lvl${levelNumber}`] ?? table?.[`EXPTABLE_exp_lvl${levelNumber}`]);
  let totalXp=xp;
  for(let levelNumber=2;levelNumber<=level;levelNumber++) {
    const cost=threshold(levelNumber);
    if(cost===null || !Number.isSafeInteger(totalXp+cost)) {totalXp=null;break;}
    totalXp+=cost;
  }
  return {account:String(account),xp,level,totalXp,nextLevelXp:threshold(level+1),serverTime:integer(value('df_servertime'))};
}
