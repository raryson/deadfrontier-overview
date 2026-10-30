import { emptyState, addBuff, togglePause, remaining, depositAmount, unitPrice } from './core.js';
import { catalog, effects } from './catalog.js';
import { applyServerSnapshot } from './server-sync.js';
import { resolveLanguage, t, effectLabel } from './i18n.js';
const chrome = globalThis.browser ?? globalThis.chrome;

// Serializa alterações vindas do painel, da aba e dos alarmes.
let queue = Promise.resolve();
function serialized(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}
async function read() { return (await chrome.storage.local.get('state')).state || emptyState(); }
async function save(state) {
  await chrome.storage.local.set({ state });
  for (const key of Object.keys(effects)) {
    await chrome.alarms.clear(`buff-${key}`);
    const timer = state.timers[key];
    if (!state.paused && timer && !timer.notified) {
      await chrome.alarms.create(`buff-${key}`, { when: Math.max(Date.now() + 1000, timer.endsAt) });
    }
  }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message.type !== 'string') return;
  serialized(async () => {
    let state = await read();
    switch (message.type) {
      case 'read': return state;
      case 'serverSnapshot': {
        if (!sender.tab || !sender.url?.startsWith('https://fairview.deadfrontier.com/onlinezombiemmo/')) throw Error('Origem de sincronização inválida.');
        state = applyServerSnapshot(state, message.snapshot);
        break;
      }
      case 'add': {
        const item = catalog.find(entry => entry.id === message.id);
        if (!item) throw Error('Item desconhecido.');
        state = addBuff(state, item.channels, item.minutes);
        break;
      }
      case 'custom': state = addBuff(state, [message.channel], Number(message.minutes)); break;
      case 'pause': state = togglePause(state); break;
      case 'remove': delete state.timers[message.channel]; break;
      case 'quote': {
        const name = String(message.name || '').trim().slice(0, 100);
        if (!name) throw Error('Informe o nome do item.');
        const price = unitPrice(Number(message.total), Number(message.quantity));
        state.quotes = [{ name, total: Number(message.total), quantity: Number(message.quantity), price, at: Date.now() }, ...state.quotes].slice(0, 50);
        break;
      }
      case 'clearQuotes': state.quotes = []; break;
      case 'deposit': return { amount: depositAmount(Number(message.cash), Number(message.reserve)) };
      default: throw Error('Ação desconhecida.');
    }
    await save(state);
    return state;
  }).then(data => reply({ data }), error => reply({ error: error.message }));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => serialized(async () => {
  if (!alarm.name.startsWith('buff-')) return;
  const state = await read();
  const key = alarm.name.slice(5);
  const timer = state.timers[key];
  if (state.paused || !timer || timer.notified || remaining(timer) > 0) return;
  const preference=(await chrome.storage.local.get('language')).language;
  const language=resolveLanguage(preference,globalThis.navigator?.languages ?? [chrome.i18n?.getUILanguage?.() ?? 'en']);
  await chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title: 'DeadFrontier Overview', message: t('notification',language,{effect:effectLabel(key,language)}) });
  timer.notified = true;
  await save(state);
}).catch(console.error));
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
chrome.runtime.onStartup.addListener(() => serialized(async () => save(await read())).catch(console.error));
chrome.runtime.onInstalled.addListener(() => serialized(async () => save(await read())).catch(console.error));
