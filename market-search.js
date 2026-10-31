import {sanitizeMarketBatch} from './market-prices.js';
export const MARKET_ENDPOINT='https://fairview.deadfrontier.com/onlinezombiemmo/trade_search.php';
export function searchBody(name,zone){
  if(typeof name!=='string'||!name.trim()||name.length>120||!/^\d{1,6}$/.test(String(zone)))throw Error('Invalid market search.');
  return new URLSearchParams({hash:'',pagetime:'',tradezone:String(zone),searchname:name.trim().slice(0,20),category:'',profession:'',memID:'',searchtype:'buyinglistitemname',search:'trades'});
}
export function parseMarketResponse(text,zone,observedAt=Date.now()){
  if(typeof text!=='string'||text.length>2000000)throw Error('Invalid market response.');
  const fields=new URLSearchParams(text),countText=fields.get('tradelist_maxresults');
  if(!/^\d{1,3}$/.test(countText??'')||Number(countText)>500)throw Error('Invalid market response.');
  const offers=[];
  for(let i=0;i<Number(countText);i++){
    const get=key=>fields.get(`tradelist_${i}_${key}`),itemId=get('item'),name=get('itemname'),total=Number(get('price'));
    if(!itemId||!name||!Number.isSafeInteger(total)||total<1)continue;
    const base=itemId.split('_')[0],stackable=/ammo$/i.test(base)||base==='credits';
    const quantity=stackable?Number(get('quantity')):1;
    if(!Number.isSafeInteger(quantity)||quantity<1||!/^[a-zA-Z0-9_.:-]{1,100}$/.test(itemId))continue;
    offers.push({itemId,name,quantity,total,unitKind:/ammo$/i.test(base)?'round':base==='credits'?'unknown':'item'});
  }
  return sanitizeMarketBatch({version:1,market:{zone:String(zone),label:`Zona ${zone}`},observedAt,offers},observedAt);
}
export async function searchMarket(fetcher,name,zone){
  const response=await fetcher(MARKET_ENDPOINT,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:searchBody(name,zone).toString(),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Market query failed.');
  return parseMarketResponse(await response.text(),zone);
}
