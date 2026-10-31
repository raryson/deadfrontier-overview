import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export class DesktopStore {
  constructor(filename){
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,started_at INTEGER NOT NULL,running INTEGER NOT NULL,payload TEXT NOT NULL);`);
  }
  get(key,fallback){const row=this.db.prepare('SELECT payload FROM state WHERE key=?').get(key);return row?JSON.parse(row.payload):fallback;}
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
  close(){this.db.close();}
}
