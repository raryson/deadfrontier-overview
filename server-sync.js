// The game's public base.js compares boostuntil against servertime + this epoch.
export const GAME_EPOCH = 1200000000;
export const channels = ['exp', 'damage', 'speed', 'exp_ex', 'damage_ex', 'speed_ex'];
export function applyServerSnapshot(state, snapshot, now = Date.now()) {
  if (!snapshot || !/^\d{1,20}$/.test(snapshot.account) || !['page', 'response'].includes(snapshot.source)) throw Error('Sincronização inválida.');
  const fields = snapshot.fields;
  const serverTime = fields?.df_servertime;
  if (!Number.isSafeInteger(serverTime) || serverTime < 0 || serverTime > 2000000000) throw Error('Horário do servidor inválido.');
  const sameAccount = state.auto?.account === snapshot.account;
  if (sameAccount && serverTime < state.auto.serverTime) return state;
  const timers = sameAccount || !state.auto ? { ...state.timers } : {};
  let count = 0;
  for (const key of channels) {
    const [base, suffix] = key.split('_');
    const value = fields[`df_boost${base}until${suffix ? '_ex' : ''}`];
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || value < 0 || value > 10000000000) throw Error('Expiração inválida.');
    const left = Math.max(0, value - (serverTime + GAME_EPOCH)) * 1000;
    if (left > 100 * 366 * 86400000) throw Error('Duração do servidor inválida.');
    count++;
    if (!left) delete timers[key];
    else {
      const prior = timers[key];
      const endsAt = prior?.source === 'server' && prior.serverUntil === value ? Math.min(prior.endsAt, now + left) : now + left;
      timers[key] = { left: Math.max(0, endsAt - now), endsAt, notified: prior?.serverUntil === value ? prior.notified : false, source: 'server', serverUntil: value };
    }
  }
  if (!count) throw Error('Resposta sem tempos de buffs.');
  return { ...state, paused: false, timers, auto: { account: snapshot.account, serverTime, syncedAt: now, source: snapshot.source, item: String(snapshot.item || '').slice(0, 100) } };
}
