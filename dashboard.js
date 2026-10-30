import { catalog, effects } from './catalog.js';
import { duration, remaining } from './core.js';
import { t as translate, resolveLanguage, localeFor, effectLabel, translateMessage } from './i18n.js';
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
  $('quotes').replaceChildren();
  for (const quote of state.quotes) {
    const row = document.createElement('div'); row.className = 'quote';
    const name = document.createElement('b'); name.textContent = quote.name;
    const detail = document.createElement('span'); detail.textContent = t('quoteLine',{price:money(quote.price),quantity:quote.quantity,total:money(quote.total),time:new Date(quote.at).toLocaleString(localeFor(language))});
    row.append(name, detail); $('quotes').append(row);
  }
}
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
const canvas = document.createElement('canvas'); canvas.width = 520; canvas.height = 380;
const context = canvas.getContext('2d');
const video = document.createElement('video'); video.muted = true; video.playsInline = true;
video.setAttribute('aria-hidden','true');
video.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;pointer-events:none;opacity:.01';
document.body.append(video);
let stream;
function paint() {
  context.fillStyle = '#17110f'; context.fillRect(0, 0, 520, 380);
  context.fillStyle = '#e88d43'; context.fillRect(0,0,520,3); context.font = 'bold 21px Segoe UI'; context.fillText('DeadFrontier Overview', 22, 34);
  context.font = '13px Segoe UI'; context.fillText(t(state.paused ? 'pipPaused' : state.auto ? 'pipSync' : 'pipManual'), 22, 57);
  Object.entries(effects).forEach(([key, label], index) => {
    const timer = state.timers[key];
    context.fillStyle = '#e9dfd5'; context.font = '18px Segoe UI'; context.fillText(effectLabel(key,language), 22, 100 + index * 48);
    context.font = 'bold 27px monospace'; context.fillText(timer ? duration(remaining(timer, Date.now(), state.paused)) : '—', 330, 100 + index * 48);
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
window.addEventListener('pagehide', () => stream?.getTracks().forEach(track => track.stop()));
function refreshLanguage() {
  language = resolveLanguage(languagePreference,navigator.languages ?? [navigator.language]);
  localizePage(); render(); readCash.textContent=t('readCash');
  if(lastBalances) $('bank-balances').textContent=t('balances',{cash:money(lastBalances.cash),bank:money(lastBalances.bank)});
  if(deposit !== null) $('deposit-result').textContent=`$${money(deposit)}`;
  if(lastBankFeedback) $('bank-feedback').textContent=feedbackText(lastBankFeedback);
  $('status').style.display='none'; paint();
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
  paint();
}, 1000);
try { state = await request({ type: 'read' }); render(); } catch (error) { status(t('dataError',{error:translateMessage(error.message,language)})); }
