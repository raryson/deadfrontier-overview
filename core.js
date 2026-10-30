export const emptyState = () => ({ timers: {}, paused: false, quotes: [] });
export function remaining(timer, now = Date.now(), paused = false) {
  return Math.max(0, paused ? timer.left : timer.endsAt - now);
}
export function addBuff(state, channels, minutes, now = Date.now()) {
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 525600) throw Error('Duração inválida.');
  if (!channels.length || channels.some(key => !['exp', 'damage', 'speed'].includes(key))) throw Error('Efeito inválido.');
  const timers = { ...state.timers };
  for (const key of new Set(channels)) {
    const left = (timers[key] ? remaining(timers[key], now, state.paused) : 0) + minutes * 60000;
    timers[key] = { left, endsAt: now + left, notified: false };
  }
  return { ...state, timers };
}
export function togglePause(state, now = Date.now()) {
  const timers = Object.fromEntries(Object.entries(state.timers).map(([key, timer]) => {
    const left = remaining(timer, now, state.paused);
    return [key, { ...timer, left, endsAt: now + left }];
  }));
  return { ...state, timers, paused: !state.paused };
}
export function depositAmount(cash, reserve) {
  if (![cash, reserve].every(n => Number.isSafeInteger(n) && n >= 0)) throw Error('Use valores inteiros positivos ou zero.');
  return Math.max(0, cash - reserve);
}
export function unitPrice(total, quantity) {
  if (!Number.isFinite(total) || total < 0 || !Number.isSafeInteger(quantity) || quantity < 1) throw Error('Preço ou quantidade inválidos.');
  return total / quantity;
}
export function duration(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
}
