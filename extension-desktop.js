import {searchMarket} from './market-search.js';
import {itemKey} from './market-prices.js';
import {sanitizeItemCatalog,resolveCatalog} from './item-catalog.js';
export const PRICE_ALARM='overview-price-sync';
export const LOCAL_ORIGIN='http://127.0.0.1:17373';
export const PRICE_PERMISSIONS=['http://127.0.0.1/*','https://fairview.deadfrontier.com/*'];
export class ExtensionDesktop{
  constructor(api,fetcher=globalThis.fetch){this.api=api;this.fetcher=fetcher.bind(globalThis);this.queue=Promise.resolve();}
  run(task){const result=this.queue.then(task);this.queue=result.catch(()=>{});return result;}
  async state(){return(await this.api.storage.local.get('desktopSync')).desktopSync??{zone:'21',enabled:false};}
  async save(state){await this.api.storage.local.set({desktopSync:state});}
  async local(path,token,body){
    const response=await this.fetcher(LOCAL_ORIGIN+path,{method:body?'POST':'GET',credentials:'omit',redirect:'error',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw Error(response.status===401?'pairRequired':response.status===403&&path==='/v1/pair'?'pairCodeInvalid':'desktopUnavailable');
    return response.json();
  }
  publicState(state){return{paired:!!state.token,enabled:!!state.enabled,zone:state.zone??'21',lastSync:state.lastSync??null,lastQuery:state.lastQuery??null,pending:state.pending?.length??0,online:state.online===true,error:state.error??null};}
  async pair(code){return this.run(async()=>{
    if(!/^\d{8}$/.test(code))throw Error('pairCodeInvalid');
    if(!await this.api.permissions.contains({origins:PRICE_PERMISSIONS}))throw Error('pricePermissionRequired');
    const result=await this.local('/v1/pair',null,{code});
    if(result.version!==1||!/^[A-Za-z0-9_-]{43}$/.test(result.token??''))throw Error('desktopUnavailable');
    const state={...(await this.state()),token:result.token,enabled:true,online:true,error:null};delete state.catalogRevisionSent;await this.save(state);
    await this.api.alarms.create(PRICE_ALARM,{periodInMinutes:1});return this.publicState(state);
  });}
  async disconnect(){return this.run(async()=>{const state=await this.state();if(state.token)try{await this.local('/v1/unpair',state.token,{});}catch{}delete state.token;state.enabled=false;state.online=false;state.pending=[];await this.save(state);await this.api.alarms.clear(PRICE_ALARM);return this.publicState(state);});}
  async context(zone){return this.run(async()=>{if(!/^\d{1,6}$/.test(String(zone)))throw Error('Invalid trade zone.');const state=await this.state();state.zone=String(zone);await this.save(state);return this.publicState(state);});}
  async catalog(input){return this.run(async()=>{
    const batch=sanitizeItemCatalog(input),old=(await this.api.storage.local.get('itemCatalog')).itemCatalog??{items:[],revision:0},items=new Map(old.items.map(item=>[item.itemId,item]));
    for(const item of batch.items)items.set(item.itemId,item);if(items.size>10000)throw Error('Invalid item catalog.');
    await this.api.storage.local.set({itemCatalog:{items:[...items.values()],observedAt:batch.observedAt,revision:old.revision+1}});
    const state=await this.state();if(state.token&&state.enabled){try{await this.flush(state);}catch{state.online=false;state.error='desktopUnavailable';}await this.save(state);}return{catalogItems:items.size};
  });}
  async quote(state,name,custom=false){
    const catalog=(await this.api.storage.local.get('itemCatalog')).itemCatalog;
    const definition=resolveCatalog(name,catalog?.items??[]);
    if(!definition)throw Error('priceUnknownItem');
    if(definition.kind==='equipment'&&!custom)throw Error('priceEquipmentYard');
    const now=Date.now(),recent=(state.requests??[]).filter(at=>now-at<60000);
    if(recent.length>=6)throw Error('priceRateLimit');
    recent.push(now);state.requests=recent;await this.save(state);
    let batch;try{batch=await searchMarket(this.fetcher,name,state.zone??'21');}catch{throw Error('priceQueryFailed');}
    state.pending=[...(state.pending??[]).filter(e=>now-e.observedAt<7*86400000),batch].slice(-50);
    state.queried={...state.queried,[`${state.zone}:${itemKey(name)}`]:now};
    state.queried=Object.fromEntries(Object.entries(state.queried).sort((a,b)=>b[1]-a[1]).slice(0,500));
    state.lastQuery=Date.now();await this.save(state);return batch;
  }
  async flush(state){
    const catalog=(await this.api.storage.local.get('itemCatalog')).itemCatalog;
    if(catalog&&catalog.revision!==state.catalogRevisionSent){
      for(let i=0;i<catalog.items.length;i+=500)await this.local('/v1/catalog',state.token,{version:1,observedAt:catalog.observedAt,items:catalog.items.slice(i,i+500)});
      state.catalogRevisionSent=catalog.revision;await this.save(state);
    }
    const pending=state.pending??[];
    while(pending.length){await this.local('/v1/prices',state.token,pending[0]);pending.shift();state.pending=pending;state.lastSync=Date.now();await this.save(state);}
    state.online=true;state.error=null;
  }
  async search(name,custom=false){return this.run(async()=>{
    const state=await this.state();if(!state.token||!state.enabled)throw Error('pairRequired');
    const batch=await this.quote(state,name,custom);
    try{await this.flush(state);}catch{state.online=false;state.error='desktopUnavailable';}
    await this.save(state);return{...this.publicState(state),offers:batch.offers.length};
  });}
  async status(){return this.publicState(await this.state());}
  async resume(){const state=await this.state();if(state.enabled&&state.token)await this.api.alarms.create(PRICE_ALARM,{periodInMinutes:1});}
  async tick(){return this.run(async()=>{
    const state=await this.state();if(!state.enabled||!state.token)return this.publicState(state);
    try{
      const server=await this.local('/v1/status',state.token);await this.flush(state);
      if(server.directPricing){state.online=true;state.error=null;await this.save(state);return this.publicState(state);}
      const needs=await this.local('/v1/needs',state.token);
      if(!Array.isArray(needs.names)||needs.names.length>50)throw Error('Invalid request.');
      const names=needs.names.filter(name=>typeof name==='string'&&name.length<=120&&name.trim()&&Date.now()-(state.queried?.[`${state.zone}:${itemKey(name)}`]??0)>10*60000).slice(0,6);
      const custom=new Set((Array.isArray(needs.customNames)?needs.customNames:[]).filter(name=>typeof name==='string').map(itemKey));
      for(const name of names){await this.quote(state,name,custom.has(itemKey(name)));await this.flush(state);}
      state.online=true;state.error=null;
    }catch(error){const queryError=['priceRateLimit','priceQueryFailed','priceUnknownItem','priceEquipmentYard'].includes(error.message);state.online=queryError;state.error=queryError?error.message:error.message==='pairRequired'?'pairRequired':'desktopUnavailable';}
    await this.save(state);return this.publicState(state);
  });}
}
