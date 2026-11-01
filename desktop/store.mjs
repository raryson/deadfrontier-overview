import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {aggregateQuotes} from '../market-prices.js';
import {sanitizeItemCatalog} from '../item-catalog.js';
import {parseLootItem} from './ui/loot-model.mjs';

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
    try{this.db.exec("DELETE FROM loot;DELETE FROM sessions;DELETE FROM state WHERE key='experience';");this.set('historyClearedAt',Date.now());this.db.exec('COMMIT');this.priceRevision++;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  saveLoot(entry){const {buttons,key,...saved}=entry;this.db.prepare(`INSERT INTO loot(id,session_id,found_at,status,payload) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,status=excluded.status,payload=excluded.payload`).run(entry.id,entry.sessionId,entry.foundAt,entry.status,JSON.stringify(saved));this.priceRevision++;}
  lootHistory(){return this.db.prepare('SELECT payload FROM loot ORDER BY found_at DESC LIMIT 200').all().map(row=>JSON.parse(row.payload));}
  confirmLoot(id,quantity){
    const entry=this.lootById(id);if(!entry||entry.status!=='unconfirmed')throw Error('Invalid loot confirmation.');
    if(quantity!==undefined&&(!Number.isSafeInteger(quantity)||quantity<1||quantity>1e9))throw Error('Invalid loot quantity.');
    this.saveLoot({...entry,status:'accepted',pickupEvidence:'user-confirmed',confirmedAt:Date.now(),...(quantity!==undefined?{quantity,quantityUncertain:false,quantitySource:'user-confirmed'}:{})});
  }
  undoLootConfirmation(id){const entry=this.lootById(id);if(!entry||entry.pickupEvidence!=='user-confirmed')throw Error('Invalid loot confirmation.');const {pickupEvidence,confirmedAt,...rest}=entry;this.saveLoot({...rest,status:'unconfirmed'});}
  lootCounts(){return this.db.prepare("SELECT session_id AS sessionId,COUNT(*) AS found,SUM(status='accepted') AS accepted FROM loot GROUP BY session_id").all();}
  savePrices(batch){
    const put=this.db.prepare(`INSERT INTO prices(market,item_id,unit_kind,observed_at,payload) VALUES(?,?,?,?,?)
      ON CONFLICT(market,item_id,unit_kind) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>=prices.observed_at`);
    this.db.exec('BEGIN IMMEDIATE');try{for(const quote of aggregateQuotes(batch))put.run(quote.market.zone,quote.itemId,quote.unitKind,quote.observedAt,JSON.stringify(quote));this.db.exec('COMMIT');this.priceRevision++;}catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  prices(market){return this.db.prepare('SELECT payload FROM prices WHERE market=?').all(market??'').map(row=>JSON.parse(row.payload));}
  markets(){return this.db.prepare('SELECT market,MAX(observed_at) AS observedAt,COUNT(*) AS count,MAX(json_extract(payload,\'$.market.label\')) AS label FROM prices GROUP BY market ORDER BY observedAt DESC').all();}
  valuationLoot(){return this.db.prepare("SELECT payload FROM loot WHERE status='accepted' ORDER BY found_at DESC").all().map(row=>JSON.parse(row.payload));}
  lootById(id){const row=this.db.prepare('SELECT payload FROM loot WHERE id=?').get(id);return row?JSON.parse(row.payload):null;}
  quoteName(id){if(typeof id!=='string')return null;const row=this.db.prepare('SELECT json_extract(payload,\'$.name\') AS name FROM prices WHERE item_id=? ORDER BY observed_at DESC LIMIT 1').get(id);return row?.name;}
  saveCatalog(input,referenceTime=Date.now()){const batch=sanitizeItemCatalog(input,referenceTime),put=this.db.prepare('INSERT INTO item_catalog(item_id,observed_at,payload) VALUES(?,?,?) ON CONFLICT(item_id) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>=item_catalog.observed_at');this.db.exec('BEGIN IMMEDIATE');try{for(const item of batch.items)put.run(item.itemId,batch.observedAt,JSON.stringify(item));this.db.exec('COMMIT');this.priceRevision++;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  itemCatalog(){return this.db.prepare('SELECT payload,observed_at FROM item_catalog ORDER BY item_id').all().map(row=>({...JSON.parse(row.payload),observedAt:row.observed_at}));}
  close(){this.db.close();}
}
