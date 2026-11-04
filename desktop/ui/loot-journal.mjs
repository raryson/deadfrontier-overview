import {parseLootItem,isStackLoot} from './loot-model.mjs';
const key=value=>String(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
const distance=(a,b)=>{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];};
export function canonicalLootName(name,catalog){
  const exact=catalog.filter(item=>key(item.name)===key(name));if(exact.length===1)return exact[0].name;
  const uncoloured=String(name).replace(/^(?:GREY|GRAY|BLACK|WHITE|RED|BLUE|GREEN|YELLOW|ORANGE|PURPLE|PINK|BROWN|SILVER|GOLD|GOLDEN)\s+/i,'');
  if(uncoloured!==name){const armour=catalog.filter(item=>item.kind==='equipment'&&key(item.name)===key(uncoloured));if(armour.length===1)return armour[0].name;}
  // Calibres must match exactly; only one spelling edit in ammunition words.
  const numbers=String(name).replace(/[.,]/g,'').match(/\d+/g)?.join(':');
  if(!numbers||!/(?:BULLETS|SHELLS|AMMO|GRENADES)$/i.test(name))return name;
  const candidates=catalog.filter(item=>item.kind==='round'&&item.name.replace(/[.,]/g,'').match(/\d+/g)?.join(':')===numbers&&distance(key(item.name),key(name))<=1);
  return candidates.length===1?candidates[0].name:name;
}
export function parseLootPrompt(text){
 const normalized=String(text).replace(/\s+/g,' ').trim();
 const match=/YOU\s+HAVE\s+(?:FOU[MN]D|FOND|FORE)\s+(?:(?:AN?)\s+|S[O0][MR]E(?:\s+|\??(?=\d)))?(.{2,100}?)\s*[.!?,]?\s*WIL{1,2}\s+YOU\s+TAKE/i.exec(normalized);
 return match?parseLootItem(match[1]):null;
}
export function parseLootReading(text,catalog=[]){
 const parsed=parseLootPrompt(text);
 const canonical=parsed&&canonicalLootName(parsed.item,catalog);
 if(parsed&&(parsed.cash||catalog.some(item=>item.name===canonical)))return parsed;
 // The item name is the evidence we need. A damaged WILL YOU TAKE suffix
 // must not discard an otherwise exact catalog name under YOU HAVE FOUND.
 const found=/YOU\s+HAVE\s+(?:FOU[MN]D|FOND|FORE)[.:]?\s+(?:(?:AN?)\s+|S[O0][MR]E\s+)?([\s\S]+)/i.exec(String(text));
 if(!found)return parsed;
 const norm=s=>String(s).toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim(),tail=' '+norm(found[1])+' ';
 const matches=catalog.filter(item=>tail.includes(' '+norm(item.name)+' ')).sort((a,b)=>norm(b.name).length-norm(a.name).length);
 if(!matches.length||matches[1]&&norm(matches[0].name).length===norm(matches[1].name).length)return parsed;
 const end=tail.indexOf(' '+norm(matches[0].name)+' ')+norm(matches[0].name).length+2,after=tail.slice(end).trim();
 if(after&&!/^(?:W[IL1V]{2,4}|VAL|WAL|WEL|WRL|TWRL|\d)(?:\b|\s)/.test(after))return parsed;
 const amount=/\(\s*([\d, ]+)\s*(ML|ROUNDS?)?\s*\)/i.exec(found[1]);
 return parseLootItem(matches[0].name+(amount?' ('+amount[1]+(amount[2]?' '+amount[2]:'')+')':''));
}
export class LootJournal{
 constructor(store){this.store=store;this.events=new Map();}
 observe(reading,sessionId,now=Date.now()){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(reading.eventId??'')||!Number.isFinite(reading.capturedAt)||reading.capturedAt>now+100||now-reading.capturedAt>600000||!Number.isFinite(reading.confidence)||reading.confidence<65||reading.frameAt!=null&&(!Number.isFinite(reading.frameAt)||reading.frameAt<reading.capturedAt||reading.frameAt>now+100))return false;
  if(reading.nameConflict)return false;
  const parsed=parseLootReading(reading.text,this.store.itemCatalog());if(!parsed)return false;
  const existing=this.store.lootById?.(reading.eventId);if(existing?.correctedByUser)return false;
  const original=parsed.item,aliasKey=original.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu,' ').trim(),alias=this.store.get?.('priceAliases',{})?.[aliasKey];
  parsed.item=this.store.itemCatalog().find(item=>item.itemId===alias)?.name??canonicalLootName(original,this.store.itemCatalog());
  let event=this.events.get(reading.eventId);if(!event){event={id:reading.eventId,sessionId,foundAt:reading.capturedAt,votes:new Map(),quantities:new Map()};this.events.set(reading.eventId,event);while(this.events.size>200)this.events.delete(this.events.keys().next().value);}
  const signature=key(parsed.item),old=event.votes.get(signature),seen=new Set(old?.frames??[]);seen.add(reading.frameAt??reading.capturedAt);event.votes.set(signature,{frames:[...seen]});
  if(parsed.quantity&&!reading.quantityConflict){const votes=event.quantities.get(parsed.quantity)??new Set();votes.add(reading.frameAt??reading.capturedAt);event.quantities.set(parsed.quantity,votes);}
  const known=this.store.itemCatalog().some(item=>key(item.name)===signature);
  if(seen.size<2&&reading.confidence<(known?75:85))return false;
  if(event.saved&&key(event.saved.item)!==signature){const priorKnown=this.store.itemCatalog().some(item=>key(item.name)===key(event.saved.item));if(priorKnown||!known)return false;}
  const verifiedQuantity=parsed.quantity&&!reading.quantityConflict&&((event.quantities.get(parsed.quantity)?.size??0)>=2||reading.quantityConfidence>=90)?parsed.quantity:event.saved?.quantitySource==='single-item'?undefined:event.saved?.quantity;
  const entry={...existing,...event.saved,ocrText:reading.text.slice(0,1200),ocrConfidence:reading.confidence,id:event.id,sessionId:event.sessionId??null,item:parsed.item,rawItem:original,foundAt:event.foundAt,readAt:now,status:'observed',captureMode:reading.manual?'shortcut':'snapshot',...(parsed.cash?{cash:parsed.cash}:{}),...(parsed.unit?{unit:parsed.unit}:{}),...(verifiedQuantity?{quantity:verifiedQuantity,quantityUncertain:false}:parsed.quantity||parsed.quantityUncertain?{quantityUncertain:true}:{})};
  if(!parsed.cash){if(!isStackLoot(entry,this.store.itemCatalog().find(item=>key(item.name)===signature))){entry.quantity=1;entry.quantityUncertain=false;entry.quantitySource='single-item';}else{delete entry.quantitySource;if(!verifiedQuantity){delete entry.quantity;entry.quantityUncertain=true;}}}
  event.saved=entry;this.store.saveLoot(entry);return true;
 }
}
