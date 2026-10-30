import test from 'node:test';
import assert from 'node:assert/strict';
import { applyServerSnapshot, GAME_EPOCH } from '../server-sync.js';
import { emptyState } from '../core.js';
const server = 590000000;
const snapshot = (extra = {}) => ({ account: '123', source: 'response', fields: { df_servertime: server, df_boostexpuntil: server + GAME_EPOCH + 1800 }, ...extra });
test('prazo do servidor converte para tempo local e repetições não somam duração', () => {
  const initial = applyServerSnapshot(emptyState(), snapshot(), 1000);
  assert.equal(initial.timers.exp.endsAt, 1801000);
  assert.equal(applyServerSnapshot(initial, snapshot(), 2000).timers.exp.endsAt, 1801000);
  const again = applyServerSnapshot(initial, snapshot({ fields: { df_servertime: server + 60, df_boostexpuntil: server + GAME_EPOCH + 1800 } }), 61000);
  assert.equal(again.timers.exp.endsAt, 1801000);
});
test('EX tem relógio independente e expiração remove apenas campo recebido', () => {
  let state = applyServerSnapshot(emptyState(), snapshot({ fields: { df_servertime: server, df_boostexpuntil: server + GAME_EPOCH + 1800, df_boostexpuntil_ex: server + GAME_EPOCH + 3600 } }), 1000);
  assert.equal(state.timers.exp_ex.left, 3600000);
  state = applyServerSnapshot(state, snapshot({ fields: { df_servertime: server + 1, df_boostexpuntil: 0 } }), 2000);
  assert.equal(state.timers.exp, undefined);
  assert.equal(state.timers.exp_ex.left, 3600000);
});
test('resposta antiga é descartada e troca de personagem limpa relógios anteriores', () => {
  const state = applyServerSnapshot(emptyState(), snapshot(), 1000);
  assert.equal(applyServerSnapshot(state, snapshot({ fields: { df_servertime: server - 1, df_boostexpuntil: 0 } }), 2000), state);
  const other = applyServerSnapshot(state, snapshot({ account: '456', fields: { df_servertime: server, df_boostspeeduntil: server + GAME_EPOCH + 60 } }), 2000);
  assert.equal(other.timers.exp, undefined);
  assert.equal(other.timers.speed.left, 60000);
});
test('não aceita pacote incompleto, prazo absurdo ou identificador inválido', () => {
  for (const packet of [snapshot({fields:{df_servertime:server}}), snapshot({account:'not-an-id'}), snapshot({fields:{df_servertime:server,df_boostexpuntil:Infinity}})]) assert.throws(() => applyServerSnapshot(emptyState(), packet));
});
