import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {aggregateQuotes} from '../market-prices.js';
import {sanitizeItemCatalog} from '../item-catalog.js';
import {parseLootItem,isStackLoot} from './ui/loot-model.mjs';
import {decodeLootImage} from './loot-review.mjs';

export class DesktopStore {
  constructor(filename){
    this.priceRevision=0;
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,started_at INTEGER NOT NULL,running INTEGER NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS loot(id TEXT PRIMARY KEY,session_id TEXT,found_at INTEGER NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS prices(market TEXT NOT NULL,item_id TEXT NOT NULL,unit_kind TEXT NOT NULL,observed_at INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(market,item_id,unit_kind));
      CREATE TABLE IF NOT EXISTS loot_images(loot_id TEXT PRIMARY KEY,captured_at INTEGER NOT NULL,quality REAL NOT NULL,image BLOB NOT NULL);
      CREATE INDEX IF NOT EXISTS loot_session_time ON loot(session_id,found_at);
      CREATE TABLE IF NOT EXISTS item_catalog(item_id TEXT PRIMARY KEY,observed_at INTEGER NOT NULL,payload TEXT NOT NULL);`);
    // A shutdown cannot confirm a pickup that was still awaiting the screen.
    this.db.prepare("UPDATE loot SET status='unconfirmed',payload=json_set(payload,'$.status','unconfirmed') WHERE status='found'").run();
    if(!this.get('lootQuantityMigration',false)){
      this.db.exec('BEGIN IMMEDIATE');
      try{
        const put=this.db.prepare('UPDATE loot SET payload=? WHERE id=?');
        for(const row of this.db.prepare('SELECT id,payload FROM loot').all()){
          const entry=JSON.parse(row.payload),parsed=parseLootItem(entry.item);
          if(parsed?.quantity&&parsed.item!==entry.item){const {key,...clean}=parsed;put.run(JSON.stringify({...entry,rawItem:entry.rawItem??entry.item,...clean,quantity:entry.quantity??parsed.quantity}),row.id);}
        }
        this.set('lootQuantityMigration',true);this.db.exec('COMMIT');
      }catch(error){this.db.exec('ROLLBACK');throw error;}
    }
  }
  get(key,fallback){const row=this.db.prepare('SELECT payload FROM state WHERE key=?').get(key);return row?JSON.parse(row.payload):fallback;}
  set(key,value){this.db.prepare('INSERT INTO state(key,payload) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload').run(key,JSON.stringify(value));if(key==='priceAliases')this.priceRevision++;}
  save(experience,entry,settings){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const put=this.db.prepare('INSERT INTO state(key,payload) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload');
      put.run('experience',JSON.stringify(experience??null));
      put.run('settings',JSON.stringify(settings));
      if(entry)this.db.prepare(`INSERT INTO sessions(id,started_at,running,payload) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET running=excluded.running,payload=excluded.payload WHERE sessions.running=1`)
        .run(entry.id,entry.startedAt,entry.running?1:0,JSON.stringify(entry));
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  history(limit=100){return this.db.prepare('SELECT payload FROM sessions ORDER BY started_at DESC LIMIT ?').all(limit).map(row=>JSON.parse(row.payload));}
  count(){return this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count;}
  clearHistory(){
    this.db.exec('BEGIN IMMEDIATE');
    try{this.db.exec("DELETE FROM loot_images;DELETE FROM loot;DELETE FROM sessions;DELETE FROM state WHERE key='experience';");this.set('historyClearedAt',Date.now());this.db.exec('COMMIT');this.priceRevision++;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  normalizeLoot(entry){this.lootKinds??=new Map(this.itemCatalog().map(item=>[item.name,item]));if(entry.item&&!entry.cash&&!isStackLoot(entry,this.lootKinds.get(entry.item)))return{...entry,quantity:1,quantityUncertain:false};return entry;}
  normalizeLootQuantities(){if(this.get('singleLootQuantityMigration',false))return;this.db.exec('BEGIN IMMEDIATE');try{for(const row of this.db.prepare('SELECT payload FROM loot').all())this.saveLoot(this.normalizeLoot(JSON.parse(row.payload)));this.set('singleLootQuantityMigration',true);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}}
  rejectNonLootCaptures(validate){if(this.get('lootPanelFilterVersion',0)>=1)return;this.db.exec('BEGIN IMMEDIATE');try{for(const row of this.db.prepare("SELECT l.payload,i.image FROM loot l JOIN loot_images i ON i.loot_id=l.id WHERE l.status IN ('ocrPending','ocrFailed','ignored')").all()){if(!validate(row.image))this.saveLoot({...JSON.parse(row.payload),status:'notLoot',captureRejection:'no-loot-panel'});}this.set('lootPanelFilterVersion',1);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}}
  saveLoot(entry){entry=this.normalizeLoot(entry);const {buttons,key,...saved}=entry;this.db.prepare(`INSERT INTO loot(id,session_id,found_at,status,payload) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,status=excluded.status,payload=excluded.payload`).run(entry.id,entry.sessionId,entry.foundAt,entry.status,JSON.stringify(saved));this.priceRevision++;}
  lootHistory(){return this.db.prepare("SELECT payload,EXISTS(SELECT 1 FROM loot_images WHERE loot_id=loot.id) has_image FROM loot WHERE status!='notLoot' ORDER BY found_at DESC LIMIT 200").all().map(row=>({...JSON.parse(row.payload),hasImage:!!row.has_image}));}
  sessionById(id){const row=this.db.prepare('SELECT payload FROM sessions WHERE id=?').get(id);return row?JSON.parse(row.payload):null;}
  sessionMarketLoot(id,notBefore){return this.db.prepare("SELECT payload FROM loot WHERE session_id IS ? AND found_at>=? AND status IN ('accepted','observed') ORDER BY found_at DESC LIMIT 1000").all(id,notBefore).map(row=>JSON.parse(row.payload));}
  sessionReviewLoot(id){return this.db.prepare("SELECT payload,EXISTS(SELECT 1 FROM loot_images WHERE loot_id=loot.id) has_image FROM loot WHERE session_id IS ? AND status NOT IN ('notLoot','ignored','rejected','used') ORDER BY found_at,id LIMIT 5000").all(id).map(row=>({...JSON.parse(row.payload),hasImage:!!row.has_image}));}
  sessionLoot(id,page=0){
    if(!Number.isSafeInteger(page)||page<0||page>1000000)throw Error('Invalid page');
    const rows=this.db.prepare("SELECT payload,EXISTS(SELECT 1 FROM loot_images WHERE loot_id=loot.id) has_image FROM loot WHERE session_id IS ? AND status!='notLoot' ORDER BY found_at,id LIMIT 100 OFFSET ?").all(id,page*100);
    return{total:this.db.prepare("SELECT COUNT(*) n FROM loot WHERE session_id IS ? AND status!='notLoot'").get(id).n,page,pageSize:100,rows:rows.map(row=>({...JSON.parse(row.payload),hasImage:!!row.has_image}))};
  }
  saveLootImage(id,data,at,quality=0){
    const image=decodeLootImage(data);if(!this.lootById(id)||!Number.isFinite(at)||!Number.isFinite(quality))throw Error('Invalid capture');
    this.db.prepare('INSERT INTO loot_images VALUES(?,?,?,?) ON CONFLICT(loot_id) DO UPDATE SET captured_at=excluded.captured_at,quality=excluded.quality,image=excluded.image WHERE excluded.quality>loot_images.quality').run(id,at,quality,image);
  }
  lootImage(id){return this.db.prepare('SELECT image FROM loot_images WHERE loot_id=?').get(id)?.image??null;}
  saveCapture(reading,sessionId,saveImage=true,now=Date.now()){
    if(!/^[a-zA-Z0-9-]{1,80}$/.test(reading.eventId??'')||!Number.isFinite(reading.capturedAt)||reading.capturedAt>now+100||now-reading.capturedAt>600000)return false;
    if(!this.lootById(reading.eventId))this.saveLoot({id:reading.eventId,sessionId:sessionId??null,foundAt:reading.capturedAt,item:'',status:'ocrPending',captureMode:reading.manual?'shortcut':'snapshot'});
    if(saveImage&&reading.imageData)this.saveLootImage(reading.eventId,reading.imageData,reading.frameAt??reading.capturedAt,reading.confidence??0);
    return true;
  }
  markOcrFailed(id,text=''){const entry=this.lootById(id);if(entry?.status==='ocrPending')this.saveLoot({...entry,status:'ocrFailed',ocrText:String(text).slice(0,1200)});}
  confirmLoot(id,quantity){
    const entry=this.lootById(id);if(!entry||entry.status!=='unconfirmed')throw Error('Invalid loot confirmation.');
    if(quantity!==undefined&&(!Number.isSafeInteger(quantity)||quantity<1||quantity>1e9))throw Error('Invalid loot quantity.');
    this.saveLoot({...entry,status:'accepted',pickupEvidence:'user-confirmed',confirmedAt:Date.now(),...(quantity!==undefined?{quantity,quantityUncertain:false,quantitySource:'user-confirmed'}:{})});
  }
  undoLootConfirmation(id){const entry=this.lootById(id);if(!entry||entry.pickupEvidence!=='user-confirmed')throw Error('Invalid loot confirmation.');const {pickupEvidence,confirmedAt,...rest}=entry;this.saveLoot({...rest,status:'unconfirmed'});}
  lootCounts(){return this.db.prepare("SELECT session_id AS sessionId,COUNT(*) AS found,SUM(status='accepted') AS accepted,SUM(status IN ('accepted','observed')) AS identified FROM loot WHERE status!='notLoot' GROUP BY session_id").all();}
  savePrices(batch){
    const put=this.db.prepare(`INSERT INTO prices(market,item_id,unit_kind,observed_at,payload) VALUES(?,?,?,?,?)
      ON CONFLICT(market,item_id,unit_kind) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>=prices.observed_at`);
    this.db.exec('BEGIN IMMEDIATE');try{for(const quote of aggregateQuotes(batch))put.run(quote.market.zone,quote.itemId,quote.unitKind,quote.observedAt,JSON.stringify(quote));this.db.exec('COMMIT');this.priceRevision++;}catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  prices(market){return this.db.prepare('SELECT payload FROM prices WHERE market=?').all(market??'').map(row=>JSON.parse(row.payload));}
  markets(){return this.db.prepare('SELECT market,MAX(observed_at) AS observedAt,COUNT(*) AS count,MAX(json_extract(payload,\'$.market.label\')) AS label FROM prices GROUP BY market ORDER BY observedAt DESC').all();}
  sessionAt(at){if(!Number.isFinite(at))return null;return this.db.prepare("SELECT id FROM sessions WHERE started_at<=? AND (running=1 OR json_extract(payload,'$.endedAt')>=?) ORDER BY started_at DESC LIMIT 1").get(at,at)?.id??null;}
  valuationLoot(){return this.db.prepare("SELECT payload FROM loot WHERE status IN ('accepted','observed') ORDER BY found_at DESC").all().map(row=>JSON.parse(row.payload));}
  lootById(id){const row=this.db.prepare('SELECT payload FROM loot WHERE id=?').get(id);return row?JSON.parse(row.payload):null;}
  quoteName(id){if(typeof id!=='string')return null;const row=this.db.prepare('SELECT json_extract(payload,\'$.name\') AS name FROM prices WHERE item_id=? ORDER BY observed_at DESC LIMIT 1').get(id);return row?.name;}
  saveCatalog(input,referenceTime=Date.now()){const batch=sanitizeItemCatalog(input,referenceTime),put=this.db.prepare('INSERT INTO item_catalog(item_id,observed_at,payload) VALUES(?,?,?) ON CONFLICT(item_id) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>=item_catalog.observed_at');this.db.exec('BEGIN IMMEDIATE');try{for(const item of batch.items)put.run(item.itemId,batch.observedAt,JSON.stringify(item));this.db.exec('COMMIT');this.priceRevision++;this.lootKinds=null;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  itemCatalog(){return this.db.prepare('SELECT payload,observed_at FROM item_catalog ORDER BY item_id').all().map(row=>({...JSON.parse(row.payload),observedAt:row.observed_at}));}
  close(){this.db.close();}
}
