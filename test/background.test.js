import test from 'node:test';
import assert from 'node:assert/strict';
let stored = {};
const listeners = {};
const alarms = new Map();
const notices = [];
const event = name => ({ addListener: fn => { listeners[name] = fn; } });
globalThis.chrome = {
  runtime: { id: 'test-extension', onMessage: event('message'), onStartup: event('startup'), onInstalled: event('installed'), getURL: path => `chrome-extension://test-extension/${path}` },
  storage: { local: { get: async () => structuredClone(stored), set: async value => { stored = { ...stored, ...structuredClone(value) }; } } },
  alarms: { onAlarm: event('alarm'), clear: async key => alarms.delete(key), create: async (key, value) => alarms.set(key, value) },
  notifications: { create: async value => notices.push(value) },
  action: { onClicked: event('action') }, tabs: { create: async () => {} }
};
// Firefox: somente browser.* com Promises, sem depender do alias chrome.*.
globalThis.browser = globalThis.chrome;
delete globalThis.chrome;
await import('../background.js');
const request = message => new Promise(resolve => listeners.message(message, {id: browser.runtime.id}, resolve));
test('worker serializa registros concorrentes e persiste estado', async () => {
  await Promise.all([request({type:'add',id:'soda'}), request({type:'add',id:'soda'})]);
  assert.ok(stored.state.timers.speed.endsAt - Date.now() > 359000);
  assert.equal(alarms.size, 1);
  assert.deepEqual((await request({type:'read'})).data, stored.state);
});
test('pausa remove alarmes e retomada os recria', async () => {
  await request({type:'pause'}); assert.equal(alarms.size, 0);
  await request({type:'pause'}); assert.equal(alarms.size, 1);
});
test('expiração avisa uma vez e startup restaura alarme perdido', async () => {
  stored.state.timers.speed.endsAt = Date.now() - 1000;
  await listeners.alarm({name:'buff-speed'});
  await listeners.alarm({name:'buff-speed'});
  assert.equal(notices.length, 1);
  assert.equal(stored.state.timers.speed.notified, true);
  await request({type:'add',id:'soda'});
  alarms.clear(); await listeners.startup(); assert.equal(alarms.size, 1);
});
test('entrada inválida não altera estado', async () => {
  const before = structuredClone(stored);
  assert.ok((await request({type:'custom', channel:'exp', minutes:-1})).error);
  assert.deepEqual(stored, before);
});
test('notificação respeita idioma salvo e mantém preferência ao atualizar relógios', async () => {
  stored.language='en';
  stored.state.timers.speed.endsAt=Date.now()-1000;
  stored.state.timers.speed.notified=false;
  await listeners.alarm({name:'buff-speed'});
  assert.equal(notices.at(-1).title,'DeadFrontier Overview');
  assert.equal(notices.at(-1).message,'The recorded timer for Speed +35% has expired.');
  assert.equal(stored.language,'en');
});
