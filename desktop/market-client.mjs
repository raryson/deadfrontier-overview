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
  status(){return{phase:this.phase,error:this.error,lastSync:this.lastSync??null,name:this.name??null};}
  changed(phase,error=null){this.phase=phase;this.error=error;this.onChange();}
  run(task){const result=this.queue.then(task);this.queue=result.catch(()=>{});return result;}
  zone(){const zone=this.getZone();return validMarket(zone)?zone:'21';}
  cached(key){const entry=this.cache[key];return entry&&this.now()-entry.at<(entry.failed?60000:600000);}
  saveCache(key,failed=false){
    this.cache[key]={at:this.now(),failed};this.cache=Object.fromEntries(Object.entries(this.cache).sort((a,b)=>b[1].at-a[1].at).slice(0,500));this.store.set('nativeMarketCache',this.cache);
  }
  needs(){
    const pending=this.getPending(),rows=[...(pending?[{...pending,status:'found'}]:[]),...this.store.lootHistory().filter(e=>['accepted','observed'].includes(e.status))],aliases=this.store.get('priceAliases',{}),catalog=this.store.itemCatalog(),names=new Map();
    for(const entry of rows){
      if(entry.cash)continue;const alias=aliases[itemKey(entry.item)]?.split('_')[0],definition=resolveCatalog(entry.item,catalog,alias);
      if(!definition||definition.kind==='equipment'&&entry.priceMode!=='market')continue;
      names.set(itemKey(definition.name),{name:definition.name,custom:definition.kind==='equipment'});if(names.size>=50)break;
    }
    return [...names.values()];
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
  async tick(){
    if(this.ticking)return;this.ticking=true;
    try{await this.run(async()=>{const next=this.needs().find(item=>!this.cached(this.zone()+':'+itemKey(item.name)));if(next)await this.request(next.name,next.custom,false);});}
    catch{/* A pricing failure never interrupts tracking or retries immediately. */}
    finally{this.ticking=false;}
  }
}
