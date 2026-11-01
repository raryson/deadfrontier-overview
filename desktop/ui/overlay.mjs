import {localizer} from './strings.mjs';
import {experienceStats} from '../../experience.js';
const $=id=>document.getElementById(id);
let state;
function paint(){
  if(!state)return;
  const {t,locale}=localizer(state.settings.language);
  const number=value=>new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(value);
  const xp=state.experience,stats=experienceStats(xp),totals=state.pricing?.sessions?.[xp?.session?.id??'unassigned'];
  const value='$'+new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format((totals?.cash??0)+(totals?.estimated??0));
  $('loot-phase').textContent=state.lootQueueDropped?t('lootQueueDropped',{count:state.lootQueueDropped}):Date.now()-(state.lootManualAt??0)<4000?t('lootManualQueued'):state.pendingLoot?t('lootPending',{item:state.pendingLoot.item}):state.lootProcessing?t('lootQueue',{count:state.lootQueueSize??0}):state.lootSearching?t('overlayLootAnticipating'):'';
  $('loot-value').textContent=t('priceOverlay',{value,missing:totals?.unpriced??0});
  $('state').textContent=t(['transition','waitingHud'].includes(state.phase)?state.phase:stats.stale&&xp?.session?.running?'stale':xp?.session?.running?'running':state.phase);
  for(const[id,key]of [['xp-label','xpGained'],['rate-label','xpRate'],['base-label','xpBase'],['base-rate-label','xpBaseRate']])$(id).textContent=t(key);
  $('xp').textContent=xp?.session?number(stats.gained):'—';$('rate').textContent=xp?.session?number(stats.perHour):'—';
  const base=xp?.session&&(xp.multiplier||stats.baseGained>0);
  $('base').textContent=base?number(stats.baseGained):'—';$('base-rate').textContent=base?number(stats.basePerHour):'—';
  $('foot').textContent=xp?.latest?t('current')+': '+number(xp.latest.xp)+' · ≈ '+number(xp.latest.precision??1)+' XP':'Alt+Shift+D · '+t('none');
}
window.overview.subscribe(value=>{state=value;paint();});
state=await window.overview.read();paint();setInterval(paint,1000);
