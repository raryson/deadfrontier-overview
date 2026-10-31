export const PRICE_TTL=15*60*1000;
export const itemKey=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,100}$/.test(value);
export function sanitizeMarketBatch(input,now=Date.now()){
  if(input?.version!==1||!identifier(input.market?.zone)||!Array.isArray(input.offers)||input.offers.length>500)throw Error('Invalid market snapshot.');
  const market={server:'fairview',zone:input.market.zone,label:String(input.market.label??input.market.zone).replace(/[\u0000-\u001f]/g,'').slice(0,80)};
  if(!Number.isSafeInteger(input.observedAt)||input.observedAt<now-7*86400000||input.observedAt>now+300000)throw Error('Invalid quote timestamp.');
  const offers=input.offers.map(offer=>{
    if(!identifier(offer.itemId)||typeof offer.name!=='string'||!offer.name.trim()||offer.name.length>120||!['item','round','unknown'].includes(offer.unitKind)||
      !Number.isSafeInteger(offer.total)||offer.total<1||offer.total>1e12||!Number.isSafeInteger(offer.quantity)||offer.quantity<1||offer.quantity>1e9)throw Error('Invalid market offer.');
    return{itemId:offer.itemId,name:offer.name.trim(),unitKind:offer.unitKind,total:offer.total,quantity:offer.quantity};
  });
  return{version:1,market,observedAt:input.observedAt,offers};
}
export function aggregateQuotes(batch){
  const grouped=new Map();
  for(const offer of batch.offers){
    const key=offer.itemId+'|'+offer.unitKind,unitPrice=offer.total/offer.quantity,previous=grouped.get(key);
    if(!previous)grouped.set(key,{...offer,unitPrice,samples:1,observedAt:batch.observedAt,market:batch.market});
    else{previous.samples++;if(unitPrice<previous.unitPrice)Object.assign(previous,{unitPrice,total:offer.total,quantity:offer.quantity});}
  }
  return[...grouped.values()];
}
export function valueLoot(entry,quotes,{now=Date.now(),aliases={},catalog=[],requireCatalog=false}={}){
  if(entry.status!=='accepted')return{value:null,reason:'notAccepted'};
  if(Number.isSafeInteger(entry.cash)&&entry.cash>0)return{value:entry.cash,reason:'cash',quantity:1};
  const key=itemKey(entry.item),alias=Object.hasOwn(aliases,key)?aliases[key]:null;
  const definitions=catalog.filter(item=>alias?item.itemId===alias||item.itemId===alias.split('_')[0]:itemKey(item.name)===key);
  if(definitions.length>1)return{value:null,reason:'ambiguous'};
  const definition=definitions[0],equipment=definition?.kind==='equipment'?definition:null;
  if(equipment&&entry.priceMode!=='market')return Number.isSafeInteger(equipment.yardValue)?{value:equipment.yardValue,reason:'yard',quantity:1,equipment}:{value:null,reason:'noYard',equipment};
  if(equipment&&(!entry.priceItemId||!entry.priceItemId.startsWith(equipment.itemId+'_')))return{value:null,reason:'variantRequired',equipment};
  if(requireCatalog&&!definition)return{value:null,reason:'noCatalog'};
  const selected=equipment?entry.priceItemId:alias;
  const matches=quotes.filter(quote=>selected?quote.itemId===selected:itemKey(quote.name)===key);
  const ids=new Set(matches.map(quote=>quote.itemId));
  if(!matches.length)return{value:null,reason:'noQuote',equipment};
  if(ids.size>1)return{value:null,reason:'ambiguous'};
  const quote=matches.reduce((a,b)=>a.observedAt>b.observedAt?a:b);
  if(now-quote.observedAt>PRICE_TTL||quote.observedAt>now+300000)return{value:null,reason:'stale',quote,equipment};
  const quantity=equipment?1:Number.isSafeInteger(entry.quantity)&&entry.quantity>0?entry.quantity:quote.unitKind==='item'?1:null;
  if(quantity===null)return{value:null,reason:'quantityUnknown',quote};
  return{value:quote.unitPrice*quantity,reason:'estimated',quantity,quote,equipment};
}
export function valueSessions(loot,quotes,options){
  const sessions=Object.create(null);
  const rows=loot.map(entry=>{
    const valuation=valueLoot(entry,quotes,options);
    if(entry.status==='accepted'){
      const key=entry.sessionId??'unassigned',summary=sessions[key]??={cash:0,estimated:0,priced:0,unpriced:0};
      if(valuation.value===null)summary.unpriced++;
      else{summary.priced++;if(valuation.reason==='cash')summary.cash+=valuation.value;else summary.estimated+=valuation.value;}
    }
    return{...entry,valuation};
  });
  return{rows,sessions};
}
