import { emptyState, addBuff, togglePause, remaining, depositAmount, unitPrice } from './core.js';
import { catalog, effects } from './catalog.js';
import { applyServerSnapshot } from './server-sync.js';
import { resolveLanguage, t, effectLabel } from './i18n.js';
import {recordExperience,startExperience,stopExperience,setExperienceMultiplier} from './experience.js';
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
  if(message.type==='xpRefresh') {
    serialized(async()=>{
      const state=await read();
      if(state.experience?.capture?.active)return {ocr:true};
      const context=(await chrome.storage.local.get('gameTabId')).gameTabId;
      const tabId=state.experience?.session?.running?state.experience.ownerTabId:(context??state.experience?.ownerTabId);
      if(!Number.isInteger(tabId)) throw Error('Abra uma página do jogo para atualizar a XP.');
      return {tabId};
    }).then(context=>context.ocr?{ocr:true}:chrome.tabs.sendMessage(context.tabId,{type:'overview-xp-refresh',start:message.start===true})).then(data=>reply({data}),()=>reply({error:'Abra uma página do jogo para atualizar a XP.'}));
    return true;
  }
  serialized(async () => {
    let state = await read();
    switch (message.type) {
      case 'read': return state;
      case 'ocrBegin': {
        if(!sender.tab || sender.url?.split('?')[0]!==chrome.runtime.getURL('dashboard.html'))throw Error('Origem de sincronização inválida.');
        if(state.experience?.capture?.active)throw Error('Já existe uma captura ativa. Pare a captura anterior.');
        const account=state.auto?.account??state.experience?.latest?.account;
        if(!account)throw Error('Abra uma página do jogo para identificar o personagem antes da captura.');
        state.experience=stopExperience(state.experience);
        state.experience={...state.experience,latest:null,session:null,capture:{active:true,id:crypto.randomUUID(),tabId:sender.tab.id,account}};
        break;
      }
      case 'ocrRecalibrate': {
        const capture=state.experience?.capture;
        if(!capture?.active || sender.tab?.id!==capture.tabId || sender.url?.split('?')[0]!==chrome.runtime.getURL('dashboard.html'))throw Error('Origem de sincronização inválida.');
        state.experience={...state.experience,latest:null,session:null};break;
      }
      case 'ocrSnapshot': {
        const capture=state.experience?.capture;
        if(!capture?.active || sender.tab?.id!==capture.tabId || sender.url?.split('?')[0]!==chrome.runtime.getURL('dashboard.html') || message.captureId!==capture.id)throw Error('Origem de sincronização inválida.');
        state.experience=recordExperience(state.experience,{...message.sample,account:capture.account,source:'ocr',serverTime:null},Date.now(),capture.tabId);
        break;
      }
      case 'ocrStart': {
        if(!state.experience?.capture?.active || state.experience.latest?.source!=='ocr' || Date.now()-state.experience.latest.receivedAt>10000)throw Error('Aguarde uma leitura estável do HUD antes de iniciar.');
        state.experience=startExperience(state.experience);
        state.experience.ownerTabId=state.experience.capture.tabId;
        break;
      }
      case 'ocrEnd': {
        const capture=state.experience?.capture;
        if(capture?.active && sender.tab?.id===capture.tabId && sender.url?.split('?')[0]===chrome.runtime.getURL('dashboard.html')) {
          state.experience=stopExperience(state.experience);
          state.experience={...state.experience,capture:{active:false}};
        }
        break;
      }
      case 'xpContext': {
        if(!sender.tab || !sender.url?.startsWith('https://fairview.deadfrontier.com/onlinezombiemmo/'))throw Error('Origem de sincronização inválida.');
        await chrome.storage.local.set({gameTabId:sender.tab.id});
        return {tabId:sender.tab.id,experience:state.experience};
      }
      case 'xpSnapshot': {
        if(!sender.tab || !sender.url?.startsWith('https://fairview.deadfrontier.com/onlinezombiemmo/')) throw Error('Origem de sincronização inválida.');
        if(state.experience?.capture?.active)return state;
        state.experience=recordExperience(state.experience,message.sample,Date.now(),sender.tab.id);
        if(message.start===true) state.experience={...startExperience(state.experience),ownerTabId:sender.tab.id};
        break;
      }
      case 'xpStop': state.experience=stopExperience(state.experience); break;
      case 'xpReset': if(state.experience)state.experience={...state.experience,session:null}; break;
      case 'xpMultiplier': {
        if(!state.experience?.latest)throw Error('Abra uma página do jogo para atualizar a XP.');
        state.experience=setExperienceMultiplier(state.experience,message.multiplier);
        break;
      }
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
chrome.runtime.onStartup.addListener(() => serialized(async () => {
  const state=await read();
  state.experience=stopExperience(state.experience,state.experience?.latest?.receivedAt);
  if(state.experience)state.experience.capture={active:false};
  await save(state);
}).catch(console.error));
chrome.tabs.onRemoved?.addListener(tabId=>serialized(async()=>{
  const state=await read();
  if(state.experience?.ownerTabId===tabId || state.experience?.capture?.tabId===tabId) {
    state.experience=stopExperience(state.experience);
    if(state.experience.capture?.tabId===tabId)state.experience.capture={active:false};
    await save(state);
  }
}).catch(console.error));
chrome.tabs.onUpdated?.addListener((tabId,change)=>{
  if(change.status!=='loading')return;
  serialized(async()=>{
    const state=await read();
    if(state.experience?.capture?.active&&state.experience.capture.tabId===tabId){
      state.experience=stopExperience(state.experience);
      state.experience.capture={active:false};await save(state);
    }
  }).catch(console.error);
});
chrome.runtime.onInstalled.addListener(() => serialized(async () => {
  const state=await read();state.experience=stopExperience(state.experience);
  if(state.experience)state.experience.capture={active:false};await save(state);
}).catch(console.error));
