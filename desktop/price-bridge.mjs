import http from 'node:http';
import {randomBytes,randomInt,createHash,timingSafeEqual} from 'node:crypto';
import {sanitizeMarketBatch,itemKey} from '../market-prices.js';
import {sanitizeItemCatalog,resolveCatalog} from '../item-catalog.js';
export const BRIDGE_PORT=17373;
const hash=value=>createHash('sha256').update(value).digest('hex');
const extensionOrigin=value=>/^chrome-extension:\/\/[a-p]{32}$/.test(value)||/^moz-extension:\/\/[a-zA-Z0-9-]{1,80}$/.test(value);
export class PriceBridge{
  constructor({store,onPrices=()=>{},port=BRIDGE_PORT}){this.store=store;this.onPrices=onPrices;this.port=port;this.server=null;this.code=null;this.expiresAt=0;this.failures=[];this.lastSync=null;this.error=null;}
  get clients(){return this.store.get('priceClients',[]);}
  status(){return{listening:!!this.server?.listening,clients:this.clients.length,pairCode:Date.now()<this.expiresAt?this.code:null,pairExpiresAt:this.expiresAt,lastSync:this.lastSync,error:this.error};}
  async start(){
    if(this.server?.listening)return;
    const server=http.createServer((req,res)=>{this.handle(req,res).catch(()=>{if(!res.headersSent)this.reply(res,400,{error:'Invalid request.'});else res.end();});});
    server.requestTimeout=5000;server.headersTimeout=5000;server.maxHeadersCount=30;
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(this.port,'127.0.0.1',resolve);});
    server.on('error',()=>{this.error='bridgeUnavailable';});this.server=server;this.error=null;
  }
  async pairCode(){await this.start();this.code=String(randomInt(10000000,100000000));this.expiresAt=Date.now()+300000;this.failures=[];return this.status();}
  revoke(){this.store.set('priceClients',[]);this.code=null;this.expiresAt=0;}
  async close(){const server=this.server;this.server=null;if(server)await new Promise(resolve=>server.close(resolve));}
  reply(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
  async json(req){
    if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Error('JSON required.');
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>200000)throw Error('Payload too large.');chunks.push(chunk);}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  authorized(req,origin){
    const token=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization??'')?.[1];if(!token)return false;
    const digest=Buffer.from(hash(token),'hex');
    return this.clients.some(client=>(!client.origin||client.origin===origin)&&/^[a-f0-9]{64}$/.test(client.hash)&&timingSafeEqual(digest,Buffer.from(client.hash,'hex')));
  }
  async handle(req,res){
    const origin=req.headers.origin??'',port=this.server?.address()?.port;
    if(req.headers.host!==`127.0.0.1:${port}`||(origin&&!extensionOrigin(origin))){this.reply(res,403,{error:'Origin denied.'});return;}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','authorization, content-type');
      res.setHeader('Access-Control-Allow-Private-Network','true');res.writeHead(204);res.end();return;
    }
    if(req.url==='/v1/pair'&&req.method==='POST'){
      this.failures=this.failures.filter(at=>Date.now()-at<60000);
      if(this.failures.length>=5){this.reply(res,429,{error:'Try again later.'});return;}
      const body=await this.json(req);
      if(!this.code||Date.now()>=this.expiresAt||body.code!==this.code){this.failures.push(Date.now());this.reply(res,403,{error:'Invalid or expired code.'});return;}
      const token=randomBytes(32).toString('base64url');
      const clients=this.clients.slice(-3);clients.push({hash:hash(token),origin,pairedAt:Date.now()});this.store.set('priceClients',clients);
      this.code=null;this.expiresAt=0;this.reply(res,200,{version:1,token});return;
    }
    if(!this.authorized(req,origin)){this.reply(res,401,{error:'Pair the extension.'});return;}
    if(req.url==='/v1/unpair'&&req.method==='POST'){
      const digest=hash(req.headers.authorization.slice(7));this.store.set('priceClients',this.clients.filter(client=>client.hash!==digest));this.reply(res,200,{disconnected:true});return;
    }
    if(req.url==='/v1/prices'&&req.method==='POST'){
      const batch=sanitizeMarketBatch(await this.json(req));this.store.savePrices(batch);this.lastSync=Date.now();this.onPrices(batch.market);
      this.reply(res,200,{accepted:batch.offers.length});return;
    }
    if(req.url==='/v1/catalog'&&req.method==='POST'){
      const batch=sanitizeItemCatalog(await this.json(req));this.store.saveCatalog(batch);this.onPrices(null);this.reply(res,200,{accepted:batch.items.length});return;
    }
    if(req.url==='/v1/status'&&req.method==='GET'){this.reply(res,200,{version:1,lastSync:this.lastSync});return;}
    if(req.url==='/v1/needs'&&req.method==='GET'){
      const aliases=this.store.get('priceAliases',{}),unique=new Map(),catalog=this.store.itemCatalog();
      for(const entry of this.store.valuationLoot())if(!entry.cash){const definition=resolveCatalog(entry.item,catalog,aliases[itemKey(entry.item)]?.split('_')[0]);if(!definition||definition.kind==='equipment'&&entry.priceMode!=='market')continue;const name=definition.name;unique.set(itemKey(name),{name,custom:definition.kind==='equipment'});if(unique.size>=50)break;}
      const names=[...unique.values()].map(item=>item.name),customNames=[...unique.values()].filter(item=>item.custom).map(item=>item.name);
      this.reply(res,200,{version:1,names,customNames});return;
    }
    this.reply(res,404,{error:'Not found.'});
  }
}
