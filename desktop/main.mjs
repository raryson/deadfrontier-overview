import {app,BrowserWindow,desktopCapturer,ipcMain,protocol,session,Tray,Menu,globalShortcut,nativeImage,screen,dialog} from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {DesktopStore} from './store.mjs';
import {DesktopTracker} from './tracker.mjs';
import {ClientSession} from './client-session.mjs';
import {correctLoot} from './loot-review.mjs';
import {LootFlow} from './ui/loot-model.mjs';
import {LootJournal,canonicalLootName} from './ui/loot-journal.mjs';
import {selectGameWindow,sourceForWindow,validRegion,csvOfSessions} from './selection.mjs';
import {PriceBridge} from './price-bridge.mjs';
import {MarketClient,MARKET_OPTIONS,validMarket} from './market-client.mjs';
import {valueLoot,valueSessions,itemKey,PRICE_TTL} from '../market-prices.js';

const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(directory);
const demo=process.argv.includes('--demo');
const selfTest=process.argv.includes('--self-test');
const localTest=demo||selfTest;
const diagnosticArgument=process.argv.indexOf('--diagnostic-file');
const diagnosticFile=diagnosticArgument>=0&&path.isAbsolute(process.argv[diagnosticArgument+1]??'')?process.argv[diagnosticArgument+1]:null;
app.setName('DeadFrontier Overview');
if(localTest){
  const argument=process.argv.indexOf('--test-data');
  const testDirectory=argument>=0&&path.isAbsolute(process.argv[argument+1]??'')?process.argv[argument+1]:
    app.isPackaged?path.join(app.getPath('temp'),selfTest?'dfov-self-test':'dfov-demo'):path.join(root,'.tmp',selfTest?'desktop-self-test':'desktop-demo');
  app.setPath('userData',testDirectory);
}
protocol.registerSchemesAsPrivileged([{scheme:'dfov',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const uiURL='dfov://app/desktop/ui/index.html';
const overlayURL='dfov://app/desktop/ui/overlay.html';
const captureURL='dfov://app/desktop/ui/capture.html';
const csp="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self'; object-src 'none'; frame-src 'none'";
let store,tracker,clientSession,lootFlow,lootJournal,priceBridge,marketClient,priceCache,mainWindow,overlayWindow,captureWindow,tray,probe,fixtureWindow;
const nativeLootInputs=new Map(),retiredReaders=new Map();
let lootCaptureWarningAt=0,lootQueueSize=0,lootQueueDropped=0,lootManualAt=0;
let clearHistoryRequested=process.argv.includes('--clear-history');
let quitting=false,windows=[],target=null,source=null,token=null,preview=null,retryAt=0,phase='waiting',detail='',captureStartedAt=0,lastCaptureMessage=0,probeBusy=false,selecting=false,selectionEpoch=0,armedHandle='',watchedHandle='';
const ownRenderer=(event,url)=>event.senderFrame?.url===url;
function priceState(){
  const selected=tracker.settings.priceMarket??'21',now=Date.now();
  if(!priceCache||priceCache.revision!==store.priceRevision||priceCache.selected!==selected||now>=priceCache.until){
    const markets=store.markets(),market=selected||markets[0]?.market||'21',quotes=store.prices(market),aliases=store.get('priceAliases',{}),catalog=store.itemCatalog();
    const valued=valueSessions(store.valuationLoot(),quotes,{now,aliases,catalog,requireCatalog:true});
    const expiry=quotes.map(q=>q.observedAt+PRICE_TTL+1).filter(at=>at>now);
    priceCache={revision:store.priceRevision,selected,until:Math.min(now+60000,...expiry),market,markets,quotes,aliases,catalog,sessions:valued.sessions};
  }
  const catalog=new Map(priceCache.catalog.map(item=>[item.itemId,{...item,unitPrice:item.yardValue,source:item.kind==='equipment'?'yard':null}]));
  for(const quote of priceCache.quotes)if(catalog.get(quote.itemId)?.kind!=='equipment')catalog.set(quote.itemId,{...quote,source:'market'});
  return{direct:marketClient?.status(),marketOptions:MARKET_OPTIONS,market:priceCache.market,markets:priceCache.markets,catalog:[...catalog.values()],sessions:priceCache.sessions,bridge:priceBridge?.status(),aliases:priceCache.aliases};
}
function publicState(){const pricing=priceState();return{...tracker.snapshot(),pricing,detailRevision:store.priceRevision,loot:store.lootHistory().map(e=>({...e,valuation:valueLoot(e,priceCache.quotes,{aliases:priceCache.aliases,catalog:priceCache.catalog,requireCatalog:true})})),lootCounts:store.lootCounts(),lootSearching:Date.now()-(lootFlow?.searchingAt??0)<12000,lootManualAt,lootQueueSize,lootQueueDropped,lootProcessing:lootQueueSize>0,lootCaptureWarning:Date.now()-lootCaptureWarningAt<15000,pendingLoot:lootFlow?.pending?{item:lootFlow.pending.item,foundAt:lootFlow.pending.foundAt}:null,phase,detail,game:target?{title:target.title,processName:target.processName,minimized:target.minimized}:null,
  windows:windows.map(window=>({handle:window.handle,title:window.title,processName:window.processName})),demo:localTest,preview};}
function broadcast(){
  if(!tracker)return;const state=publicState();
  for(const window of [mainWindow,overlayWindow])if(window&&!window.isDestroyed())window.webContents.send('overview:state',state);
}
function preferences(extra){Object.assign(tracker.settings,extra);tracker.persist();updateTray();broadcast();}
function disposeReader(id){const entry=retiredReaders.get(id);if(!entry)return;retiredReaders.delete(id);clearTimeout(entry.timer);if(!entry.window.isDestroyed())entry.window.destroy();}
function finishCapture(reason='gameClosed',endSession=true){
  nativeLootInputs.clear();lootQueueSize=0;
  lootFlow?.finish();armLoot(false);watchLoot('');selectionEpoch++;
  if(endSession)clientSession?.finish(reason);
  const old=captureWindow,oldToken=token;captureWindow=null;
  token=null;source=null;target=null;preview=null;
  if(old&&!old.isDestroyed()){
    if(['gameClosed','captureEnded','windowChanged'].includes(reason)){
      const id=old.webContents.id,timer=setTimeout(()=>disposeReader(id),30000);timer.unref();
      retiredReaders.set(id,{window:old,token:oldToken,closedAt:Date.now(),until:Date.now()+30000,timer});
      old.webContents.send('capture:update',{type:'drain',token:oldToken});
    }else old.destroy();
  }
  overlayWindow?.hide();phase=tracker?.settings.autoTrack?'waiting':'disabled';detail='';broadcast();
}
function armLoot(armed){const handle=armed&&target?target.handle:'';if(probe?.stdin.writable&&handle!==armedHandle){probe.stdin.write(handle?'ARM '+handle+'\n':'DISARM\n');armedHandle=handle;}}
function watchLoot(handle){if(probe?.stdin.writable&&handle!==watchedHandle){probe.stdin.write(handle?'WATCH '+handle+'\n':'WATCH\n');watchedHandle=handle;}}
function secureWindow(window,url){
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,destination)=>{if(destination!==url)event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
}
function showMain(){mainWindow.show();mainWindow.focus();broadcast();}
function clearHistory(){
  lootFlow?.finish();nativeLootInputs.clear();lootCaptureWarningAt=0;lootQueueSize=0;lootQueueDropped=0;store.clearHistory();lootJournal=new LootJournal(store);priceCache=null;
  tracker.experience=null;tracker.pendingStart=true;tracker.persist();
  token=crypto.randomUUID();captureWindow?.webContents.send('capture:update',{type:'clear',token});
  clearHistoryRequested=false;broadcast();
}
function updateTray(){
  if(!tray||!tracker)return;
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Abrir painel',click:showMain},
    {label:'Acompanhar jogo automaticamente',type:'checkbox',checked:tracker.settings.autoTrack,click:item=>{preferences({autoTrack:item.checked});if(!item.checked)finishCapture('disabled');}},
    {label:'Mostrar overlay',type:'checkbox',checked:tracker.settings.overlay,click:item=>preferences({overlay:item.checked})},
    {type:'separator'},{label:'Sair',click:()=>{quitting=true;app.quit();}}
  ]));
}
async function startCapture(window){
  if(captureWindow||selecting||Date.now()<retryAt||!tracker.settings.autoTrack)return;
  selecting=true;const selection=selectionEpoch;
  let sources;
  try{sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:0,height:0},fetchWindowIcons:false});}finally{selecting=false;}
  if(selection!==selectionEpoch||!tracker.settings.autoTrack)return;
  const matched=sourceForWindow(sources,window);
  if(!matched){phase='sourceMissing';broadcast();return;}
  target=window;source=matched;token=crypto.randomUUID();preview=null;
  watchLoot(window.handle);
  clientSession.attach(window);phase='loading';detail='';captureStartedAt=lastCaptureMessage=Date.now();
  captureWindow=new BrowserWindow({show:false,width:320,height:180,skipTaskbar:true,webPreferences:{preload:path.join(directory,'capture-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const created=captureWindow;secureWindow(created,captureURL);
  created.webContents.on('render-process-gone',()=>{if(created===captureWindow){finishCapture('captureFailed',false);phase='error';detail='O leitor foi reiniciado. Tentando novamente…';retryAt=Date.now()+10000;broadcast();}});
  await created.loadURL(captureURL);
  if(created!==captureWindow)return;
  // Fixed, local app code. Electron marks this app-controlled capture startup
  // as a user gesture; the source is restricted to the native game HWND above.
  created.webContents.executeJavaScript('window.startCapture()',true).catch(error=>{
    if(created!==captureWindow)return;
    finishCapture('captureFailed',false);phase='error';detail=String(error.message).slice(0,180);retryAt=Date.now()+10000;broadcast();
  });
  broadcast();
}
function positionOverlay(){
  if(!target||!overlayWindow||overlayWindow.isDestroyed())return;
  if(!tracker.settings.overlay||target.minimized||!target.foreground||!source){overlayWindow.hide();return;}
  let bounds={x:target.x,y:target.y,width:target.width,height:target.height};
  if(screen.screenToDipRect)bounds=screen.screenToDipRect(null,bounds);
  const display=screen.getDisplayMatching(bounds).workArea;
  const x=Math.max(display.x,Math.min(bounds.x+bounds.width-365,display.x+display.width-365));
  const y=Math.max(display.y,Math.min(bounds.y+bounds.height-290,display.y+display.height-290));
  overlayWindow.setBounds({x:Math.round(x),y:Math.round(y),width:350,height:275});
  // A game can re-enter the topmost band when it regains focus or switches
  // display modes. Restore our z-order without activating the overlay.
  overlayWindow.setAlwaysOnTop(true,'screen-saver');
  if(!overlayWindow.isVisible())overlayWindow.showInactive();
  overlayWindow.moveTop();
}
async function updateWindows(next,clients=next){
  if(quitting||!tracker)return;
  windows=next;
  if(probeBusy)return;
  probeBusy=true;
  try{
    if(clientSession.observe(clients))finishCapture('gameClosed',false);
    if(source){
      const active=windows.find(window=>window.handle===target?.handle&&clientSession.matches(window));
      if(!active){finishCapture('windowChanged',false);}
      else {target=active;positionOverlay();}
    }
    if(!source&&tracker.settings.autoTrack){
      const candidates=clientSession.client?windows.filter(window=>clientSession.matches(window)):windows;
      const chosen=selectGameWindow(candidates,tracker.settings.preferredTitle);
      if(chosen)await startCapture(chosen);
      else phase=clientSession.client?'waitingHud':windows.filter(window=>!window.minimized).length>1?'ambiguous':'waiting';
    }
    broadcast();
  }catch(error){phase='error';detail=String(error.message).slice(0,180);retryAt=Date.now()+10000;broadcast();}
  finally{probeBusy=false;}
}
function startProbe(){
  probe?.kill();
  armedHandle='';
  watchedHandle='';
  const helper=path.join(directory,'bin','DFWindowProbe.exe');
  if(!fsSync.existsSync(helper)){phase='error';detail='Helper de detecção ausente. Gere o app com npm run package.';broadcast();return;}
  const args=['--parent',String(process.pid)];
  if(selfTest)args.push('--fixture',String(process.pid));
  if(tracker.settings.processName)args.push('--process',tracker.settings.processName);
  probe=spawn(helper,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const child=probe;
  child.stdin.on('error',()=>{});
  readline.createInterface({input:child.stdout}).on('line',line=>{try{
    const packet=JSON.parse(line);if(child!==probe)return;
    if(Array.isArray(packet.windows))updateWindows(packet.windows,packet.clients);
    if(packet.lootCapture?.handle===target?.handle&&source&&!target.minimized&&Number.isFinite(packet.lootCapture.at)&&Math.abs(Date.now()-packet.lootCapture.at)<1000){
      lootManualAt=Date.now();captureWindow?.webContents.send('capture:update',{type:'lootCapture',token,at:packet.lootCapture.at});broadcast();
    }
    if(packet.lootSearch?.handle===target?.handle&&packet.lootSearch.heldMs>=1000&&source){
      if(!lootFlow.pending)lootFlow.anticipate();
      captureWindow?.webContents.send('capture:update',{type:'lootSearch',token});armLoot(false);broadcast();
    }
    if(packet.lootInput&&packet.lootInput.handle===target?.handle){
      const now=Date.now(),input={...packet.lootInput,id:crypto.randomUUID(),at:Number.isFinite(packet.lootInput.at)&&Math.abs(packet.lootInput.at-now)<2000?packet.lootInput.at:now};
      for(const [id,entry]of nativeLootInputs)if(now-entry.input.at>10000)nativeLootInputs.delete(id);
      if(nativeLootInputs.size>=32)nativeLootInputs.delete(nativeLootInputs.keys().next().value);
      lootCaptureWarningAt=0;nativeLootInputs.set(input.id,{input,token,sessionId:tracker.experience?.session?.running?tracker.experience.session.id:null});
      captureWindow?.webContents.send('capture:update',{type:'lootInput',token,input:{id:input.id,at:input.at}});
      if(diagnosticFile)try{fsSync.writeFileSync(diagnosticFile+'.input.json',JSON.stringify({input:packet.lootInput,queued:true}));}catch{}
      broadcast();
    }
  }catch{}});
  child.on('error',()=>{phase='error';detail='Não foi possível iniciar a detecção da janela.';broadcast();});
  child.on('exit',()=>{if(child===probe&&!quitting){phase='error';detail='A detecção da janela foi encerrada. Reabra o app.';broadcast();}});
}
async function createFixture(){
  fixtureWindow=new BrowserWindow({show:false,title:'DF Overview Capture Fixture',width:1920,height:1080,x:0,y:0,frame:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await fixtureWindow.loadURL('dfov://app/desktop/ui/fixture.html'+(process.argv.includes('--onslaught-test')?'?onslaught=1':process.argv.includes('--snapshot-test')?'?snapshots=1':process.argv.includes('--manual-capture-test')?'?manual=1':''));fixtureWindow.showInactive();
}

if(!app.requestSingleInstanceLock()){app.quit();}
else {
  app.on('second-instance',(_event,args)=>{if(args.includes('--clear-history')){clearHistoryRequested=true;if(store&&tracker)clearHistory();}if(mainWindow)showMain();});
  app.whenReady().then(async()=>{
    if(process.platform!=='win32'){dialog.showErrorBox('DeadFrontier Overview','Esta prévia é para Windows.');app.quit();return;}
    Menu.setApplicationMenu(null);
    protocol.handle('dfov',async request=>{
      const url=new URL(request.url);const pathname=decodeURIComponent(url.pathname);
      const imageMatch=/^\/loot-image\/([a-zA-Z0-9-]{1,80})\.jpg$/.exec(pathname);
      if(url.host==='app'&&request.method==='GET'&&imageMatch){const image=store?.lootImage(imageMatch[1]);return new Response(image??'Not found',{status:image?200:404,headers:{'Content-Type':image?'image/jpeg':'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
      const allowed=url.host==='app'&&request.method==='GET'&&(
        /^\/desktop\/ui\/[a-zA-Z0-9._-]+$/.test(pathname)||/^\/vendor\/ocr\/[a-zA-Z0-9._-]+$/.test(pathname)||['/experience.js','/ocr-parser.js','/i18n.js','/icon.png'].includes(pathname));
      if(!allowed)return new Response('Not found',{status:404});
      try{
        const bytes=await fs.readFile(path.join(root,pathname));
        const type=/\.(?:js|mjs)$/.test(pathname)?'text/javascript':pathname.endsWith('.html')?'text/html':pathname.endsWith('.css')?'text/css':pathname.endsWith('.png')?'image/png':'application/octet-stream';
        return new Response(bytes,{headers:{'Content-Type':type,'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'}});
      }catch{return new Response('Not found',{status:404});}
    });
    session.defaultSession.webRequest.onBeforeRequest((request,callback)=>callback({cancel:!request.url.startsWith('dfov://app/')&&!request.url.startsWith('blob:dfov://app/')&&!request.url.startsWith('data:')}));
    session.defaultSession.setDisplayMediaRequestHandler((request,callback)=>{
      if(request.frame?.url!==captureURL||request.frame?.top!==captureWindow?.webContents.mainFrame||!source||!token||request.audioRequested){callback(null);return;}
      callback({video:source});
    });
    const dataDirectory=app.getPath('userData');
    store=new DesktopStore(path.join(dataDirectory,'overview.sqlite'));
    if(clearHistoryRequested){store.clearHistory();clearHistoryRequested=false;}
    const seed=JSON.parse(await fs.readFile(path.join(directory,'data','item-catalog.json'),'utf8'));
    for(let i=0;i<seed.items.length;i+=500)store.saveCatalog({version:1,observedAt:seed.observedAt,items:seed.items.slice(i,i+500)},seed.observedAt);
    tracker=new DesktopTracker(store);clientSession=new ClientSession(tracker);
    if(!validMarket(tracker.settings.priceMarket)){tracker.settings.priceMarket='21';tracker.persist();}
    lootFlow=new LootFlow(store);lootJournal=new LootJournal(store);
    for(const entry of store.lootHistory()){const name=canonicalLootName(entry.item,store.itemCatalog());if(name!==entry.item)store.saveLoot({...entry,rawItem:entry.rawItem??entry.item,item:name});}
    marketClient=new MarketClient({store,getZone:()=>tracker.settings.priceMarket,getPending:()=>lootFlow.pending,onChange:broadcast});
    priceBridge=new PriceBridge({store,directPricing:true,onPrices:broadcast});
    if(!localTest&&priceBridge.clients.length)priceBridge.start().catch(()=>{priceBridge.error='priceBridgeUnavailable';broadcast();});
    mainWindow=new BrowserWindow({title:'DeadFrontier Overview',width:1120,height:830,minWidth:860,minHeight:660,backgroundColor:'#17110f',icon:path.join(root,'icon.png'),webPreferences:{preload:path.join(directory,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
    secureWindow(mainWindow,uiURL);
    mainWindow.on('close',event=>{if(!quitting){event.preventDefault();mainWindow.hide();}});
    overlayWindow=new BrowserWindow({title:'DF Overview Overlay',width:350,height:275,show:false,frame:false,transparent:true,resizable:false,skipTaskbar:true,focusable:false,alwaysOnTop:true,webPreferences:{preload:path.join(directory,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
    secureWindow(overlayWindow,overlayURL);overlayWindow.setIgnoreMouseEvents(true,{forward:true});
    overlayWindow.setAlwaysOnTop(true,'screen-saver');
    tray=new Tray(nativeImage.createFromPath(path.join(root,'icon.png')));tray.setToolTip('DeadFrontier Overview — acompanhamento local');tray.on('double-click',showMain);updateTray();
    ipcMain.handle('overview:read',event=>{if(![uiURL,overlayURL].includes(event.senderFrame?.url))throw Error('Origem inválida');return publicState();});
    ipcMain.handle('overview:session',(event,request)=>{
      if(!ownRenderer(event,uiURL)||(typeof request?.id!=='string'||request.id.length>120))throw Error('Invalid session');
      const entry=request.id==='unassigned'?{id:'unassigned'}:store.sessionById(request.id);if(!entry)throw Error('Invalid session');const page=store.sessionLoot(request.id==='unassigned'?null:request.id,request.page??0);priceState();
      return{session:entry,definitions:priceCache.catalog,totals:priceCache.sessions[entry.id]??null,...page,rows:page.rows.map(row=>({...row,valuation:valueLoot(row,priceCache.quotes,{aliases:priceCache.aliases,catalog:priceCache.catalog,requireCatalog:true})}))};
    });
    ipcMain.handle('overview:action',async(event,message)=>{
      if(!ownRenderer(event,uiURL))throw Error('Origem inválida');
      const {type,value}=message??{};
      if(type==='auto'&&typeof value==='boolean'){preferences({autoTrack:value});if(!value)finishCapture('disabled');}
      else if(type==='language'&&['auto','pt','en'].includes(value))preferences({language:value});
      else if(type==='overlay'&&typeof value==='boolean'){preferences({overlay:value});positionOverlay();}
      else if(type==='saveLootImages'&&typeof value==='boolean'){preferences({saveLootImages:value});captureWindow?.webContents.send('capture:update',{type:'imageSetting',token,enabled:value});}
      else if(type==='lootCorrect'){correctLoot(store,value);}
      else if(type==='lootIgnore'&&typeof value==='string'){const entry=store.lootById(value);if(entry)store.saveLoot({...entry,status:'ignored'});}
      else if(type==='stop'){tracker.finish('stopped');}
      else if(type==='reset'){tracker.reset();if(captureWindow){token=crypto.randomUUID();captureWindow.webContents.send('capture:update',{type:'reset',token});}}
      else if(type==='multiplier')tracker.setMultiplier(value);
      else if(type==='pricePair')await priceBridge.pairCode();
      else if(type==='priceDisconnect'){priceBridge.revoke();await priceBridge.close();}
      else if(type==='priceMarket'&&validMarket(value)){preferences({priceMarket:value,priceMarketMode:'manual'});if(!localTest)void marketClient.tick();}
      else if(type==='priceQuery'&&typeof value?.name==='string'&&value.name.length<=120){try{await marketClient.query(value.name.trim(),{custom:value.custom===true,force:true});}catch{/* Localized query status is returned below. */}}
      else if(type==='priceRefresh'&&!localTest){void marketClient.tick();}
      else if(type==='priceAlias'&&typeof value?.from==='string'&&typeof value?.itemId==='string'){
        const aliases=store.get('priceAliases',{}),key=itemKey(value.from);
        if(!key||key.length>120||!priceState().catalog.some(q=>q.itemId===value.itemId))throw Error('priceAliasInvalid');
        aliases[key]=value.itemId;if(Object.keys(aliases).length>1000)throw Error('priceAliasInvalid');store.set('priceAliases',aliases);
      }
      else if(type==='priceQuantity'&&typeof value?.id==='string'&&Number.isSafeInteger(value?.quantity)&&value.quantity>=1&&value.quantity<=1000000000){
        const entry=store.lootById(value.id);if(!entry)throw Error('priceAliasInvalid');store.saveLoot({...entry,quantity:value.quantity,quantityUncertain:false,quantitySource:'user-confirmed'});
      }
      else if(type==='lootConfirm'&&typeof value?.id==='string'){store.confirmLoot(value.id,value.quantity);}
      else if(type==='lootUndoConfirm'&&typeof value?.id==='string'){store.undoLootConfirmation(value.id);}
      else if(type==='clearHistory'){
        const pt=(tracker.settings.language==='pt'||tracker.settings.language!=='en'&&app.getLocale().startsWith('pt'));
        const answer=await dialog.showMessageBox(mainWindow,{type:'warning',title:'DeadFrontier Overview',message:pt?'Apagar o histórico de XP e loot?':'Delete XP and loot history?',detail:pt?'As preferências, conexão e cotações serão mantidas.':'Preferences, pairing and quotes will be kept.',buttons:pt?['Cancelar','Apagar histórico']:['Cancel','Delete history'],defaultId:0,cancelId:0});
        if(answer.response===1)clearHistory();
      }
      else if(type==='priceEquipmentVariant'&&typeof value?.id==='string'&&(value.itemId===null||typeof value.itemId==='string')){
        const entry=store.lootById(value.id);if(!entry)throw Error('priceAliasInvalid');
        const equipment=valueLoot({...entry,status:'accepted',priceMode:'yard'},priceCache?.quotes??[],{aliases:store.get('priceAliases',{}),catalog:store.itemCatalog()}).equipment;
        if(!equipment||value.itemId!==null&&(!value.itemId.startsWith(equipment.itemId+'_')||!store.prices(priceState().market).some(q=>q.itemId===value.itemId)))throw Error('priceAliasInvalid');
        store.saveLoot({...entry,priceMode:value.itemId===null?'yard':'market',priceItemId:value.itemId});
      }
      else if(type==='process'&&typeof value==='string'&&/^[\w ()-]{0,80}$/.test(value)){preferences({processName:value.replace(/\.exe$/i,'')});finishCapture('processChanged');startProbe();}
      else if(type==='select'&&typeof value==='string'){
        const window=windows.find(item=>item.handle===value);if(!window)throw Error('Janela indisponível');
        preferences({preferredTitle:window.title});finishCapture('gameChanged');await startCapture(window);
      }
      else if(type==='preview'){if(source)captureWindow?.webContents.send('capture:update',{type:'preview'});}
      else if(type==='region'&&validRegion(value)&&source){
        const wasRunning=tracker.experience?.session?.running||tracker.pendingStart;
        tracker.reset();tracker.pendingStart=wasRunning;preferences({region:value});
        token=crypto.randomUUID();captureWindow?.webContents.send('capture:update',{type:'region',region:value,token});
      }
      else if(type==='defaultRegion'){
        preferences({region:null});if(target){const current=target;finishCapture('cropChanged');await startCapture(current);}
      }
      else if(type==='export'){
        const result=await dialog.showSaveDialog(mainWindow,{defaultPath:'deadfrontier-sessoes.csv',filters:[{name:'CSV',extensions:['csv']}]});
        if(!result.canceled&&result.filePath){priceState();const valued=valueSessions(store.valuationLoot(),priceCache.quotes,{aliases:priceCache.aliases,catalog:priceCache.catalog,requireCatalog:true});await fs.writeFile(result.filePath,csvOfSessions(store.history(-1),valued.sessions),{encoding:'utf8'});}
      }
      else if(type==='quit'){quitting=true;app.quit();return;}
      else throw Error('Ação inválida');
      tracker.persist();broadcast();return publicState();
    });
    ipcMain.handle('capture:config',event=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents)throw Error('Origem inválida');
      return{token,region:tracker.settings.region,diagnostics:!!diagnosticFile,saveImages:tracker.settings.saveLootImages!==false};
    });
    ipcMain.on('capture:sample',(event,message)=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents||message?.token!==token||!source||target?.minimized||message.confidence<60)return;
      try{tracker.sample(message.sample);lastCaptureMessage=Date.now();phase='reading';broadcast();}catch{phase='error';detail='Leitura de XP inválida.';broadcast();}
    });
    ipcMain.on('capture:status',(event,message)=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents||message?.token!==token)return;
      lastCaptureMessage=Date.now();phase=String(message.phase);detail=String(message.detail??'').slice(0,200);
      if(diagnosticFile&&Array.isArray(message.diagnostic))try{fsSync.writeFileSync(diagnosticFile,JSON.stringify({phase,readAt:Date.now(),attempts:message.diagnostic.slice(0,4)}));}catch{}
      if(phase==='ended')finishCapture('captureEnded',false);
      else if(phase==='resolution'){broadcast();}
      else broadcast();
    });
    ipcMain.on('capture:preview',(event,message)=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents||message?.token!==token||typeof message.image!=='string'||!message.image.startsWith('data:image/jpeg;base64,')||message.image.length>2500000)return;
      preview={image:message.image,width:message.width,height:message.height,region:message.region};broadcast();
    });
    ipcMain.on('capture:loot',(event,message)=>{
      if(quitting||!ownRenderer(event,captureURL))return;
      const retired=retiredReaders.get(event.sender.id),current=event.sender===captureWindow?.webContents&&message?.token===token&&!!source;
      if(!current&&(!retired||message?.token!==retired.token||Date.now()>retired.until))return;
      const reading=message.reading;
      if(retired&&!['capture','ocrFailed','snapshot','queue'].includes(reading?.kind))return;
      if(retired&&['capture','ocrFailed','snapshot'].includes(reading?.kind)&&(reading.capturedAt>retired.closedAt||(reading.frameAt??reading.capturedAt)>retired.closedAt))return;
      if(retired&&reading?.kind==='queue'){if(reading.pending===0)disposeReader(event.sender.id);return;}
      if(!['capture','ocrFailed','snapshot','queue','visible','hint','found','absent','unknown','searching'].includes(reading?.kind)||String(reading.text??'').length>1200)return;
      if(reading.kind==='queue'){
        if(Number.isSafeInteger(reading.pending)&&reading.pending>=0&&reading.pending<=256)lootQueueSize=reading.pending;
        if(Number.isSafeInteger(reading.dropped)&&reading.dropped>=0)lootQueueDropped=reading.dropped;
        broadcast();return;
      }
      if(reading.kind==='capture'){store.saveCapture(reading,store.sessionAt(reading.capturedAt),tracker.settings.saveLootImages!==false);if(reading.queued===false)store.markOcrFailed(reading.eventId);broadcast();return;}
      if(reading.kind==='ocrFailed'){store.markOcrFailed(reading.eventId,reading.text);broadcast();return;}
      if(reading.kind==='snapshot'){store.saveCapture(reading,store.sessionAt(reading.capturedAt),tracker.settings.saveLootImages!==false);if(diagnosticFile)try{fsSync.writeFileSync(diagnosticFile+'.loot.json',JSON.stringify({...reading,imageData:undefined}));}catch{}if(!lootJournal.observe(reading,store.sessionAt(reading.capturedAt)))store.markOcrFailed(reading.eventId,reading.text);broadcast();return;}
      if(diagnosticFile&&!['hint','visible'].includes(reading.kind))try{fsSync.writeFileSync(diagnosticFile+'.loot.json',JSON.stringify(reading));}catch{}
      if(reading.buttons&&Object.values(reading.buttons).some(value=>!validRegion(value)))return;
      if(reading.inputId){
        const evidence=nativeLootInputs.get(reading.inputId);
        if(evidence?.token!==token)return;
        if(reading.dialogVisible===true)evidence.sawDialog=true;
        if(reading.kind==='absent'&&target.foreground===true)lootFlow.observeInputAbsence(reading,evidence.input);
        if(reading.kind==='found'&&lootFlow.observeInput({...reading,inputDismissed:reading.inputDismissed===true&&target.foreground===true},evidence.input,evidence.sessionId)){nativeLootInputs.delete(reading.inputId);lootCaptureWarningAt=0;}
      }else lootFlow.observe(reading,tracker.experience?.session?.running?tracker.experience.session.id:null);
      armLoot(false);broadcast();
    });
    await Promise.all([mainWindow.loadURL(uiURL),overlayWindow.loadURL(overlayURL)]);
    globalShortcut.register('Alt+Shift+D',()=>mainWindow.isVisible()?mainWindow.hide():showMain());
    globalShortcut.register('Alt+Shift+O',()=>preferences({overlay:!tracker.settings.overlay}));
    if(selfTest)await createFixture();
    if(demo){
      tracker.settings.autoTrack=false;tracker.attach();tracker.setMultiplier(4.2);
      tracker.sample({xp:100000,level:10,nextLevelXp:250000,precision:1000},Date.now()-600000);
      tracker.sample({xp:142000,level:10,nextLevelXp:250000,precision:1000},Date.now());
      tracker.finish('demo');phase='demo';broadcast();
      for(const [id,item,extra]of [['demo-steroids','Steroids',{}],['demo-cash','$2,122',{cash:2122}],['demo-equipment','Demo Rifle',{}],['demo-ammo','9mm Handgun Bullets',{}]])store.saveLoot({id,sessionId:tracker.experience.session.id,item,foundAt:Date.now(),status:'accepted',...extra});
      broadcast();
    }else startProbe();
    setInterval(()=>{
      if(quitting||!tracker)return;
      for(const [id,entry]of nativeLootInputs)if(Date.now()-entry.input.at>10000){if(entry.sawDialog)lootCaptureWarningAt=Date.now();nativeLootInputs.delete(id);}
      armLoot(false);
      if(!localTest)void marketClient.tick();
      positionOverlay();
      if(diagnosticFile&&overlayWindow&&!overlayWindow.isDestroyed())try{fsSync.writeFileSync(diagnosticFile+'.overlay.json',JSON.stringify({phase,enabled:tracker.settings.overlay,game:!!target,foreground:target?.foreground,minimized:target?.minimized,source:!!source,visible:overlayWindow.isVisible(),alwaysOnTop:overlayWindow.isAlwaysOnTop(),bounds:overlayWindow.getBounds()}));}catch{}
      if(captureWindow&&Date.now()-Math.max(captureStartedAt,lastCaptureMessage)>45000){finishCapture('captureFailed');phase='error';detail='O leitor não respondeu. Nova tentativa em alguns segundos.';retryAt=Date.now()+10000;broadcast();}
      if(selfTest){fsSync.writeFileSync(path.join(dataDirectory,'test-status.json'),JSON.stringify({phase,game:!!target,lootManualAt,lootQueueSize,stats:tracker.snapshot().stats,sessionCount:store.count(),session:tracker.experience?.session,history:store.history(5),loot:store.lootHistory(),pendingLoot:lootFlow.pending}));}
    },1000);
    if(process.argv.includes('--inspect-ui'))mainWindow.webContents.openDevTools({mode:'detach'});
  }).catch(error=>{console.error(error);app.exit(1);});
}
app.on('before-quit',()=>{quitting=true;for(const id of [...retiredReaders.keys()])disposeReader(id);globalShortcut.unregisterAll();priceBridge?.close();lootFlow?.finish();armLoot(false);if(tracker)tracker.finish('appClosed');const oldProbe=probe;probe=null;oldProbe?.kill();const old=captureWindow;captureWindow=null;old?.destroy();store?.close();store=null;tracker=null;});
app.on('window-all-closed',()=>{});
