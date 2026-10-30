import { catalog, effects } from './catalog.js';
import { duration, remaining } from './core.js';
import { t as translate, resolveLanguage, localeFor, effectLabel, translateMessage } from './i18n.js';
import {experienceStats} from './experience.js';
import {createCaptureController} from './capture-controller.js';
const chrome = globalThis.browser ?? globalThis.chrome;
let languagePreference = (await chrome.storage.local.get('language')).language ?? 'auto';
let language = resolveLanguage(languagePreference, navigator.languages ?? [navigator.language]);
const t = (key, values) => translate(key, language, values);
const $ = id => document.getElementById(id);
let state = { timers: {}, quotes: [], paused: false };
let deposit = null;
let statusTimeout;
let lastBalances = null;
let lastBankFeedback = null;
const money = value => new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 2 }).format(value);
function localizePage() {
  document.documentElement.lang = localeFor(language);
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  $('name').placeholder=t('itemPlaceholder');
  $('language').value = ['auto','pt','en'].includes(languagePreference) ? languagePreference : 'auto';
}
localizePage();
function status(message) {
  $('status').textContent = translateMessage(message, language);
  $('status').style.display = 'block';
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => { $('status').style.display = 'none'; }, 5000);
}
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (result.error) throw Error(result.error);
  return result.data;
}
function handle(task) { return event => { event.preventDefault(); Promise.resolve().then(() => task(event)).catch(error => status(error.message)); }; }
for (const item of catalog) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = `${item.name} · ${item.minutes} min`;
  $('item').append(option);
}
function renderTimers() {
  $('timers').replaceChildren();
  for (const [key, label] of Object.entries(effects)) {
    const timer = state.timers[key];
    if (key.endsWith('_ex') && !timer) continue;
    const left = timer ? remaining(timer, Date.now(), state.paused) : 0;
    const row = document.createElement('div');
    row.className = `timer ${timer ? !left ? 'expired' : '' : 'inactive'}`;
    row.dataset.channel = key;
    const top = document.createElement('div'); top.className = 'timer-top';
    const name = document.createElement('span'); name.textContent = effectLabel(key, language);
    const clock = document.createElement('strong'); clock.textContent = timer ? duration(left) : '—';
    top.append(name, clock); row.append(top);
    if (timer) {
      const info = document.createElement('small');
      info.textContent = state.paused ? t('timerPaused') : left ? t('until', {source:t(timer.source === 'server' ? 'server' : 'manual'), time:new Date(timer.endsAt).toLocaleTimeString(localeFor(language), {hour:'2-digit',minute:'2-digit'})}) : t('ended');
      info.title = new Date(timer.endsAt).toLocaleString(localeFor(language));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', t('remove',{effect:effectLabel(key,language)})); remove.title = t('remove',{effect:effectLabel(key,language)});
      remove.onclick = handle(async () => { state = await request({ type: 'remove', channel: key }); render(); });
      row.append(info, remove);
    }
    $('timers').append(row);
  }
  $('mode').textContent = t(state.paused ? 'paused' : state.auto ? 'server' : 'manual');
  $('sync-status').textContent = state.auto ? t('syncAt',{time:new Date(state.auto.syncedAt).toLocaleString(localeFor(language))}) : t('syncNoData');
  $('pause').textContent = t(state.paused ? 'resume' : 'pause');
}
function render() {
  renderTimers();
  renderExperience();
  $('quotes').replaceChildren();
  for (const quote of state.quotes) {
    const row = document.createElement('div'); row.className = 'quote';
    const name = document.createElement('b'); name.textContent = quote.name;
    const detail = document.createElement('span'); detail.textContent = t('quoteLine',{price:money(quote.price),quantity:quote.quantity,total:money(quote.total),time:new Date(quote.at).toLocaleString(localeFor(language))});
    row.append(name, detail); $('quotes').append(row);
  }
}
function renderExperience() {
  const xp=state.experience, stats=experienceStats(xp);
  $('xp-mode').textContent=xp?.capture?.active?t(xp?.session?.running?'ocrRunning':'ocrReady'):t('xpStopped');
  $('xp-gained').textContent=xp?.session?money(stats.gained):'—';
  $('xp-rate').textContent=xp?.session?money(Math.round(stats.perHour)):'—';
  const baseAvailable=xp?.session && (xp.multiplier || stats.baseGained>0);
  $('xp-base').textContent=baseAvailable?money(Math.round(stats.baseGained)):'—';
  $('xp-base-rate').textContent=baseAvailable?money(Math.round(stats.basePerHour)):'—';
  $('xp-net').textContent=xp?.session?t('xpNet',{net:money(stats.net),lost:money(stats.lost)}):'';
  $('xp-base-note').textContent=stats.basePartial?t('xpBasePartial'):xp?.multiplier?t('xpBaseFactor',{factor:new Intl.NumberFormat(localeFor(language),{maximumFractionDigits:4}).format(xp.multiplier)}):t('xpBaseMissing');
  if(document.activeElement!==$('xp-multiplier')) $('xp-multiplier').value=xp?.multiplier??'';
  $('xp-current').textContent=xp?.latest?t('xpCurrent',{level:xp.latest.level,xp:money(xp.latest.xp),target:xp.latest.nextLevelXp===null?'—':money(xp.latest.nextLevelXp)}):t('xpNoSample');
  $('xp-updated').textContent=xp?.latest?t(stats.stale?'xpStale':'xpUpdated',{time:new Date(xp.latest.receivedAt).toLocaleTimeString(localeFor(language)),elapsed:duration(stats.elapsed)}):t('xpNoSample');
  if(xp?.session?.gap) $('xp-updated').textContent+=` ${t('xpGap')}`;
  $('xp-start').disabled=xp?.session?.running===true||!xp?.capture?.active||xp.latest?.source!=='ocr'||stats.stale;
  $('xp-stop').disabled=!xp?.session?.running;
  $('ocr-connect').disabled=xp?.capture?.active===true||capture.active;
  $('ocr-disconnect').disabled=!capture.active;
  $('xp-refresh').textContent=t(xp?.capture?.active?'ocrRefresh':'xpRefresh');
  $('xp-source-hint').textContent=t('ocrSourceHint');
  $('ocr-precision').textContent=xp?.latest?.source==='ocr'?t('ocrPrecision',{step:money(xp.latest.precision??1)}):'';
}
let ocrStatusKey='ocrNeedCapture';
const capture=createCaptureController({
  preview:$('ocr-preview'),crop:$('ocr-crop-preview'),
  onBegin:async()=>{state=await request({type:'ocrBegin'});render();return state.experience.capture.id;},
  onEnd:async()=>{state=await request({type:'ocrEnd'});render();},
  onSample:async(sample,captureId)=>{state=await request({type:'ocrSnapshot',sample,captureId});render();},
  onRegionChange:async()=>{state=await request({type:'ocrRecalibrate'});render();},
  onStatus:key=>{
    if(ocrStatusKey!==key){ocrStatusKey=key;$('ocr-status').textContent=t(key);}
    $('ocr-calibration').hidden=!capture.active;
    renderExperience();
  },
  onCandidate:(sample,confidence)=>{
    $('ocr-readout').textContent=sample?t('ocrReadout',{level:sample.level,xp:money(sample.xp),target:money(sample.nextLevelXp),confidence}):t('ocrUnreadable');
  },
  loadRegion:async()=>(await chrome.storage.local.get('ocrRegion')).ocrRegion,
  saveRegion:region=>chrome.storage.local.set({ocrRegion:region}),
});
async function connectOcr() {
  if(window.parent!==window) {
    await chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html?capture=1')});status(t('ocrOpenTab'));return;
  }
  if(!state.experience?.latest?.account&&!state.auto?.account)throw Error(t('ocrIdentify'));
  $('ocr-calibration').open=true;
  await capture.start();
}
$('ocr-connect').onclick=handle(connectOcr);
$('ocr-disconnect').onclick=handle(()=>capture.stop());
$('ocr-default').onclick=handle(()=>capture.resetRegion());
async function refreshExperience(start=false) {
  if(state.experience?.capture?.active) {
    if(capture.active)await capture.readNow();
    if(start){state=await request({type:'ocrStart'});render();}
    return;
  }
  if(start)throw Error(t('ocrConnectFirst'));
  const result=await request({type:'xpRefresh',start});
  if(result?.error) throw Error(result.error);
  status(t('xpRefreshed'));
}
$('xp-start').onclick=handle(()=>refreshExperience(true));
$('xp-refresh').onclick=handle(()=>refreshExperience());
$('xp-stop').onclick=handle(async()=>{
  let refreshError;
  try {await refreshExperience();} catch(error){refreshError=error;}
  state=await request({type:'xpStop'});render();
  if(refreshError)status(refreshError.message);
});
$('xp-reset').onclick=handle(async()=>{state=await request({type:'xpReset'});render();});
$('xp-multiplier-form').onsubmit=handle(async()=>{
  const raw=$('xp-multiplier').value;
  // Close the previous observation interval before changing its assumed factor.
  if(state.experience?.session?.running) await refreshExperience();
  state=await request({type:'xpMultiplier',multiplier:raw===''?null:Number(raw)});render();
});
$('buff-form').onsubmit = handle(async () => { state = await request({ type: 'add', id: $('item').value }); render(); status(t('logged')); });
$('custom-form').onsubmit = handle(async () => { state = await request({ type: 'custom', channel: $('channel').value, minutes: $('minutes').value }); render(); });
$('pause').onclick = handle(async () => { state = await request({ type: 'pause' }); render(); });
$('deposit-form').onsubmit = handle(async () => {
  const result = await request({ type: 'deposit', cash: $('cash').value, reserve: $('reserve').value });
  deposit = result.amount; $('deposit-result').textContent = `$${money(deposit)}`;
  $('copy-deposit').disabled = false; $('fill-deposit').disabled = window.parent === window;
});
for (const id of ['cash', 'reserve']) $(id).oninput = () => { deposit = null; $('copy-deposit').disabled = true; $('fill-deposit').disabled = true; $('deposit-result').textContent = '—'; };
$('copy-deposit').onclick = handle(async () => { if (deposit === null) return; await navigator.clipboard.writeText(String(deposit)); status(t('copied')); });
$('fill-deposit').onclick = handle(() => {
  if (deposit === null || window.parent === window) return;
  window.parent.postMessage({ type: 'fairview-fill-deposit', amount: deposit }, 'https://fairview.deadfrontier.com');
});
const readCash = document.createElement('button'); readCash.textContent = t('readCash'); readCash.type = 'button';
$('deposit-form').before(readCash); readCash.disabled = window.parent === window;
readCash.onclick = () => window.parent.postMessage({ type: 'fairview-read-cash' }, 'https://fairview.deadfrontier.com');
$('fill-deposit').textContent = t('fill');
let bankFeedbackTimeout;
function bankFeedback(message, pending = false) {
  lastBankFeedback = { message, pending };
  $('bank-feedback').textContent = translateMessage(message, language);
  for (const id of ['deposit-all', 'withdraw-all', 'bank-check']) $(id).disabled = pending || window.parent === window;
  if (!pending) clearTimeout(bankFeedbackTimeout);
}
function feedbackText(feedback) {
  if(feedback.key==='result') return t('result',{result:t(feedback.values.resultKey),cash:money(feedback.values.cash),bank:money(feedback.values.bank)});
  return feedback.key ? t(feedback.key,feedback.values) : translateMessage(feedback.message,language);
}
for (const [id, action] of [['deposit-all', 'deposit-all'], ['withdraw-all', 'withdraw-all'], ['bank-check', 'balances']]) {
  $(id).onclick = handle(event => {
    if (!event.isTrusted) return;
    if (window.parent === window) throw Error(t('usePanel'));
    bankFeedback(translate('requesting', 'pt'), true);
    clearTimeout(bankFeedbackTimeout);
    bankFeedbackTimeout = setTimeout(() => bankFeedback(translate('noConfirmation','pt')), 30000);
    window.parent.postMessage({ type: 'fairview-bank-action', action }, 'https://fairview.deadfrontier.com');
  });
  $(id).disabled = window.parent === window;
}
window.addEventListener('message', event => {
  if ((event.source !== null && event.source !== window.parent) || event.origin !== 'https://fairview.deadfrontier.com') return;
  if (event.data?.type === 'fairview-cash' && Number.isSafeInteger(event.data.amount) && event.data.amount >= 0) {
    $('cash').value = event.data.amount; $('cash').dispatchEvent(new Event('input')); status(t('cashRead'));
  }
  if (event.data?.type === 'fairview-feedback' && typeof event.data.message === 'string') {
    const message = feedbackText(event.data);
    status(message);
    bankFeedback(event.data.message, event.data.pending === true);
    if(event.data.key) { lastBankFeedback.key=event.data.key; lastBankFeedback.values=event.data.values; $('bank-feedback').textContent=message; }
  }
  if (event.data?.type === 'fairview-balances' && [event.data.cash, event.data.bank].every(n => Number.isSafeInteger(n) && n >= 0)) {
    lastBalances = {cash:event.data.cash,bank:event.data.bank};
    $('bank-balances').textContent = t('balances',{cash:money(event.data.cash),bank:money(event.data.bank)});
    $('cash').value = event.data.cash; $('cash').dispatchEvent(new Event('input'));
  }
});
$('quote-form').onsubmit = handle(async () => { state = await request({ type: 'quote', name: $('name').value, total: $('total').value, quantity: $('quantity').value }); render(); });
$('clear-quotes').onclick = handle(async () => { state = await request({ type: 'clearQuotes' }); render(); });

// Vídeo local: Firefox abre PiP pelos controles nativos do vídeo.
const canvas = document.createElement('canvas'); canvas.width = 520; canvas.height = 535;
const context = canvas.getContext('2d');
const video = document.createElement('video'); video.muted = true; video.playsInline = true;
video.setAttribute('aria-hidden','true');
video.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;pointer-events:none;opacity:.01';
document.body.append(video);
let stream;
function paint() {
  context.fillStyle = '#17110f'; context.fillRect(0, 0, 520, 535);
  context.fillStyle = '#e88d43'; context.fillRect(0,0,520,3); context.font = 'bold 21px Segoe UI'; context.fillText('DeadFrontier Overview', 22, 34);
  context.font = '13px Segoe UI'; context.fillText(t(state.paused ? 'pipPaused' : state.auto ? 'pipSync' : 'pipManual'), 22, 57);
  const stats=experienceStats(state.experience);
  context.fillStyle='#bba391';context.font='13px Segoe UI';context.fillText(t('xpGained'),22,86);context.fillText(t('xpRate'),285,86);
  context.fillStyle='#f2c18d';context.font='bold 23px monospace';context.fillText(state.experience?.session?money(stats.gained):'—',22,112,235);context.fillText(state.experience?.session?money(Math.round(stats.perHour)):'—',285,112,213);
  context.fillStyle='#bba391';context.font='12px Segoe UI';context.fillText(t('xpBase'),22,138);context.fillText(t('xpBaseRate'),285,138);
  const baseAvailable=state.experience?.session && (state.experience.multiplier || stats.baseGained>0);
  context.fillStyle='#d6a279';context.font='bold 21px monospace';context.fillText(baseAvailable?money(Math.round(stats.baseGained)):'—',22,163,235);context.fillText(baseAvailable?money(Math.round(stats.basePerHour)):'—',285,163,213);
  context.fillStyle='#bba391';context.font='12px Segoe UI';
  context.fillText(state.experience?.latest?t(stats.stale?'xpStaleShort':state.experience.latest.source==='ocr'?'ocrCurrentShort':'xpCurrentShort',{xp:money(state.experience.latest.xp)}):t('xpNoSample'),22,190);
  if(stats.basePartial) context.fillText(t('xpBasePartialShort'),22,207);
  context.fillStyle='#503629';context.fillRect(22,220,476,1);
  Object.entries(effects).forEach(([key, label], index) => {
    const timer = state.timers[key];
    context.fillStyle = '#e9dfd5'; context.font = '18px Segoe UI'; context.fillText(effectLabel(key,language), 22, 245 + index * 48);
    context.font = 'bold 27px monospace'; context.fillText(timer ? duration(remaining(timer, Date.now(), state.paused)) : '—', 330, 245 + index * 48);
  });
}
$('floating').onclick = handle(async () => {
  if (window.parent !== window && !document.pictureInPictureEnabled) {
    await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    status(t('videoTab'));
    return;
  }
  if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
  paint();
  if (!stream) { stream = canvas.captureStream(2); video.srcObject = stream; }
  await video.play();
  if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
    await video.requestPictureInPicture();
    status(t('keepOpen'));
  } else {
    video.controls = true;
    video.removeAttribute('aria-hidden');
    video.style.cssText = 'display:block;width:100%;max-width:520px;margin:16px auto;border:1px solid #784631;border-radius:5px';
    $('floating').closest('section').append(video);
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
    status(t('firefoxPip'));
  }
});
window.addEventListener('pagehide', () => {stream?.getTracks().forEach(track => track.stop());capture.stop().catch(()=>{});});
function refreshLanguage() {
  language = resolveLanguage(languagePreference,navigator.languages ?? [navigator.language]);
  localizePage(); render(); readCash.textContent=t('readCash');
  if(lastBalances) $('bank-balances').textContent=t('balances',{cash:money(lastBalances.cash),bank:money(lastBalances.bank)});
  if(deposit !== null) $('deposit-result').textContent=`$${money(deposit)}`;
  if(lastBankFeedback) $('bank-feedback').textContent=feedbackText(lastBankFeedback);
  $('status').style.display='none'; paint();
  $('ocr-status').textContent=t(ocrStatusKey);
}
$('language').onchange = handle(async()=>{
  languagePreference=$('language').value;
  await chrome.storage.local.set({language:languagePreference}); refreshLanguage();
});
window.addEventListener('languagechange',()=>{if(languagePreference==='auto')refreshLanguage();});
chrome.storage.onChanged.addListener((changes, area) => {
  if(area !== 'local') return;
  if(changes.state) {state=changes.state.newValue;render();}
  if(changes.language) {languagePreference=changes.language.newValue ?? 'auto';refreshLanguage();}
});
setInterval(() => {
  // Preserva o foco dos botões durante a atualização dos relógios.
  for (const key of Object.keys(effects)) {
    const timer = state.timers[key]; const row = $('timers').querySelector(`[data-channel="${key}"]`);
    if (row && timer) { const left = remaining(timer, Date.now(), state.paused); row.querySelector('strong').textContent = duration(left); row.classList.toggle('expired', !left); }
  }
  renderExperience();paint();
}, 1000);
try { state = await request({ type: 'read' }); render(); } catch (error) { status(t('dataError',{error:translateMessage(error.message,language)})); }
