import {itemKey} from './market-prices.js';
export function sanitizeItemCatalog(input,now=Date.now()){
  if(input?.version!==1||!Array.isArray(input.items)||input.items.length>500||!Number.isSafeInteger(input.observedAt)||input.observedAt>now+300000||input.observedAt<now-30*86400000)throw Error('Invalid item catalog.');
  const items=input.items.map(item=>{
    if(!/^[a-zA-Z0-9_.:-]{1,100}$/.test(item.itemId??'')||typeof item.name!=='string'||!item.name.trim()||item.name.length>120||!['equipment','item','round','unknown'].includes(item.kind))throw Error('Invalid catalog item.');
    const result={itemId:item.itemId,name:item.name.trim(),kind:item.kind};
    if(item.kind==='equipment'&&Number.isSafeInteger(item.yardValue)&&item.yardValue>=0&&item.yardValue<=1e12)result.yardValue=item.yardValue;
    return result;
  });return{version:1,observedAt:input.observedAt,items};
}
export function resolveCatalog(name,items,alias){
  const matches=items.filter(item=>alias?item.itemId===alias:itemKey(item.name)===itemKey(name));
  return matches.length===1?matches[0]:null;
}
