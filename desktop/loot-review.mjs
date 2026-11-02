import {itemKey} from '../market-prices.js';
import {isStackLoot} from './ui/loot-model.mjs';
export function decodeLootImage(value){
 if(typeof value!=='string'||value.length>350000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value))throw Error('Invalid loot image');
 const image=Buffer.from(value.slice(value.indexOf(',')+1),'base64');if(image.length<4||image.length>250000||image[0]!==255||image[1]!==216||image[2]!==255)throw Error('Invalid loot image');return image;
}
export function correctLoot(store,{id,itemId,quantity,aliasFrom}){
 const entry=store.lootById(id),definition=store.itemCatalog().find(item=>item.itemId===itemId);if(!entry||!definition)throw Error('priceAliasInvalid');
 if(quantity!=null&&(!Number.isSafeInteger(quantity)||quantity<1||quantity>1e9))throw Error('Invalid quantity');
 const saved={...entry,item:definition.name,rawItem:entry.rawItem??entry.item,status:'observed',correctedByUser:true,correctedAt:Date.now(),quantityUncertain:false};
 delete saved.cash;delete saved.unit;if(definition.itemId==='fuelammo')saved.unit='ml';else if(definition.kind==='round')saved.unit='round';
 if(!isStackLoot(saved,definition)){saved.quantity=1;saved.quantityUncertain=false;}else if(quantity!=null)saved.quantity=quantity;else{delete saved.quantity;saved.quantityUncertain=true;}
 if(aliasFrom!=null&&typeof aliasFrom!=='string')throw Error('priceAliasInvalid');
 if(aliasFrom?.trim()){const aliases=store.get('priceAliases',{}),key=itemKey(aliasFrom);if(!key||key.length>120||Object.keys(aliases).length>=1000&&!Object.hasOwn(aliases,key))throw Error('priceAliasInvalid');aliases[key]=definition.itemId;store.set('priceAliases',aliases);}
 store.saveLoot(saved);return saved;
}
export function correctCash(store,{id,cash}){
 const entry=store.lootById(id);if(!entry||!Number.isSafeInteger(cash)||cash<1||cash>1e12)throw Error('invalidCashAmount');
 const saved={...entry,item:'$'+new Intl.NumberFormat('en-US').format(cash),cash,quantity:1,quantityUncertain:false,status:'observed',correctedByUser:true,correctedAt:Date.now(),cashSource:'user-confirmed'};
 delete saved.unit;delete saved.priceMode;delete saved.priceItemId;store.saveLoot(saved);return saved;
}
