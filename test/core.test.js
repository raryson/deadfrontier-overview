import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, addBuff, remaining, togglePause, depositAmount, unitPrice } from '../core.js';
test('reuso soma duração por efeito sem multiplicar potência', () => {
  let state = addBuff(emptyState(), ['exp', 'speed'], 15, 0);
  state = addBuff(state, ['exp'], 3, 60000);
  assert.equal(remaining(state.timers.exp, 60000), 17 * 60000);
  assert.equal(remaining(state.timers.speed, 60000), 14 * 60000);
});
test('datas persistidas descontam período fechado e nunca ficam negativas', () => {
  const state = JSON.parse(JSON.stringify(addBuff(emptyState(), ['damage'], 3, 1000)));
  assert.equal(remaining(state.timers.damage, 61000), 120000);
  assert.equal(remaining(state.timers.damage, 999999), 0);
});
test('pausa, adição durante pausa e retomada preservam duração', () => {
  let state = togglePause(addBuff(emptyState(), ['speed'], 3, 0), 60000);
  state = addBuff(state, ['speed'], 1, 900000);
  assert.equal(remaining(state.timers.speed, 1000000, state.paused), 180000);
  state = togglePause(state, 1000000);
  assert.equal(remaining(state.timers.speed, 1060000), 120000);
});
test('depósito respeita reserva e rejeita valores fracionários e inválidos', () => {
  assert.equal(depositAmount(5000, 1200), 3800);
  assert.equal(depositAmount(500, 1200), 0);
  for (const n of [-1, Infinity, NaN, 0.5]) assert.throws(() => depositAmount(n, 0));
});
test('comparação usa unidades válidas e buffs exigem duração válida', () => {
  assert.equal(unitPrice(15000, 3), 5000);
  assert.throws(() => unitPrice(15000, 0));
  assert.throws(() => addBuff(emptyState(), ['unknown'], 3));
  assert.throws(() => addBuff(emptyState(), ['exp'], NaN));
});
