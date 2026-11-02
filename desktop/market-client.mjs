import {searchMarket} from '../market-search.js';
import {itemKey} from '../market-prices.js';
import {resolveCatalog} from '../item-catalog.js';

// Current game market regions. Main outposts, including Secronom, share 21.
export const MARKET_OPTIONS=[
  ['21','Secronom Bunker / Outposts'],['22','Camp Valcrest'],['10','Wastelands'],
  ['1','North Western'],['2','Northern'],['3','North Eastern'],['4','Western'],
  ['5','Central'],['6','Eastern'],['7','South Western'],['8','Southern'],['9','South Eastern']
];
export const validMarket=zone=>MARKET_OPTIONS.some(([id])=>id===zone);
export class MarketClient{
  constructor({store,getZone=()=> '21',getPending=()=>null,onChange=()=>{},fetcher=globalThis.fetch,now=Date.now}){
    Object.assign(this,{store,getZone,getPending,onChange,now});this.fetcher=fetcher.bind(globalThis);
    this.queue=Promise.resolve();this.ticking=false;this.phase='idle';this.error=null;
    this.cache=store.get('nativeMarketCache',{});this.requests=store.get('nativeMarketRequests',[]).filter(at=>Number.isFinite(at)&&now()-at<60000&&at<=now());
  }
  status(){return{phase:this.phase,error:this.error,lastSync:this.lastSync??null,name:this.name??null,batch:this.batch??null};}
  changed(phase,error=null){this.phase=phase;this.error=error;this.onChange();}
  run(task){const result=this.queue.then(task);this.queue=result.catch(()=>{});return result;}
  zone(){const zone=this.getZone();return validMarket(zone)?zone:'21';}
  cached(key){const entry=this.cache[key];return entry&&this.now()-entry.at<(entry.failed?60000:600000);}
  saveCache(key,failed=false){
    this.cache[key]={at:this.now(),failed};this.cache=Object.fromEntries(Object.entries(this.cache).sort((a,b)=>b[1].at-a[1].at).slice(0,500));this.store.set('nativeMarketCache',this.cache);
  }
  needs(sessionId=this.store.history(1)[0]?.id??null){
    const revision=this.store.priceRevision,key=JSON.stringify([revision,sessionId,Math.floor(this.now()/60000)]);
    if(Number.isFinite(revision)&&this.needsCache?.key===key)return this.needsCache.items;
    const rows=this.store.sessionMarketLoot(sessionId,this.now()-7*86400000),aliases=this.store.get('priceAliases',{}),catalog=this.store.itemCatalog(),names=new Map();
    for(const entry of rows){
      if(entry.cash)continue;const alias=aliases[itemKey(entry.item)]?.split('_')[0],definition=resolveCatalog(entry.item,catalog,alias);
      if(!definition||definition.kind==='equipment'&&entry.priceMode!=='market')continue;
      names.set(itemKey(definition.name),{name:definition.name,custom:definition.kind==='equipment'});if(names.size>=50)break;
    }
    const items=[...names.values()];if(Number.isFinite(revision))this.needsCache={key,items};return items;
  }
  async query(name,{custom=false,force=false}={}){return this.run(()=>this.request(name,custom,force));}
  async request(name,custom,force){
    const zone=this.zone(),key=zone+':'+itemKey(name);
    try{
      const definition=resolveCatalog(name,this.store.itemCatalog());
      if(!definition)throw Error('priceUnknownItem');
      if(definition.kind==='equipment'&&!custom)throw Error('priceEquipmentYard');
      if(!force&&this.cached(key)){this.changed('ready');return{cached:true};}
      this.requests=this.requests.filter(at=>this.now()-at<60000);
      if(this.requests.length>=6)throw Error('priceRateLimit');
      this.requests.push(this.now());this.store.set('nativeMarketRequests',this.requests);this.name=definition.name;this.changed('loading');
      let batch;try{batch=await searchMarket(this.fetcher,definition.name,zone);}catch{this.saveCache(key,true);throw Error('priceQueryFailed');}
      batch={...batch,observedAt:this.now(),market:{...batch.market,label:MARKET_OPTIONS.find(([id])=>id===zone)[1]}};
      this.store.savePrices(batch);this.saveCache(key);this.lastSync=this.now();this.changed(batch.offers.length?'ready':'empty');return{offers:batch.offers.length};
    }catch(error){this.changed(error.message==='priceRateLimit'?'limited':'error',error.message);throw error;}
  }
  async tick(){return{manualOnly:true};}
  async syncSession(sessionId=this.store.history(1)[0]?.id??null){
    if(this.ticking)return{busy:true};this.ticking=true;
    try{return await this.run(async()=>{
      const zone=this.zone(),items=this.needs(sessionId),pending=items.filter(item=>!this.cached(zone+':'+itemKey(item.name)));
      this.batch={sessionId,total:items.length,queried:0,cached:items.length-pending.length,remaining:pending.length,failed:0,at:this.now()};this.changed('loading');
      for(const item of pending){this.requests=this.requests.filter(at=>this.now()-at<60000);if(this.batch.queried>=6||this.requests.length>=6||this.zone()!==zone)break;
        try{await this.request(item.name,item.custom,false);}catch{this.batch.failed++;}this.batch.queried++;this.batch.remaining--;}
      this.changed(this.batch.remaining?'limited':this.batch.failed?'error':'ready',this.batch.failed?'priceQueryFailed':null);return this.batch;
    });}finally{this.ticking=false;}
  }
}
