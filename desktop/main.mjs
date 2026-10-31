import {app,BrowserWindow,desktopCapturer,ipcMain,protocol,session,Tray,Menu,globalShortcut,nativeImage,screen,dialog} from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {DesktopStore} from './store.mjs';
import {DesktopTracker} from './tracker.mjs';
import {selectGameWindow,sourceForWindow,validRegion,csvOfSessions} from './selection.mjs';

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
let store,tracker,mainWindow,overlayWindow,captureWindow,tray,probe,fixtureWindow;
let quitting=false,windows=[],target=null,source=null,token=null,preview=null,retryAt=0,phase='waiting',detail='',captureStartedAt=0,lastCaptureMessage=0,probeBusy=false,selecting=false,selectionEpoch=0;
const ownRenderer=(event,url)=>event.senderFrame?.url===url;
function publicState(){return{...tracker.snapshot(),phase,detail,game:target?{title:target.title,processName:target.processName,minimized:target.minimized}:null,
  windows:windows.map(window=>({handle:window.handle,title:window.title,processName:window.processName})),demo:localTest,preview};}
function broadcast(){
  if(!tracker)return;const state=publicState();
  for(const window of [mainWindow,overlayWindow])if(window&&!window.isDestroyed())window.webContents.send('overview:state',state);
}
function preferences(extra){Object.assign(tracker.settings,extra);tracker.persist();updateTray();broadcast();}
function finishCapture(reason='gameClosed'){
  selectionEpoch++;
  tracker?.finish(reason);
  token=null;source=null;target=null;preview=null;
  const old=captureWindow;captureWindow=null;
  if(old&&!old.isDestroyed())old.destroy();
  overlayWindow?.hide();phase=tracker?.settings.autoTrack?'waiting':'disabled';detail='';broadcast();
}
function secureWindow(window,url){
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,destination)=>{if(destination!==url)event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
}
function showMain(){mainWindow.show();mainWindow.focus();broadcast();}
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
  tracker.attach();phase='loading';detail='';captureStartedAt=lastCaptureMessage=Date.now();
  captureWindow=new BrowserWindow({show:false,width:320,height:180,skipTaskbar:true,webPreferences:{preload:path.join(directory,'capture-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const created=captureWindow;secureWindow(created,captureURL);
  created.webContents.on('render-process-gone',()=>{if(created===captureWindow){finishCapture('captureFailed');phase='error';detail='O leitor foi reiniciado. Tentando novamente…';retryAt=Date.now()+10000;broadcast();}});
  await created.loadURL(captureURL);
  if(created!==captureWindow)return;
  // Fixed, local app code. Electron marks this app-controlled capture startup
  // as a user gesture; the source is restricted to the native game HWND above.
  created.webContents.executeJavaScript('window.startCapture()',true).catch(error=>{
    if(created!==captureWindow)return;
    finishCapture('captureFailed');phase='error';detail=String(error.message).slice(0,180);retryAt=Date.now()+10000;broadcast();
  });
  broadcast();
}
function positionOverlay(){
  if(!target||!overlayWindow||overlayWindow.isDestroyed())return;
  if(!tracker.settings.overlay||target.minimized||!target.foreground||!source){overlayWindow.hide();return;}
  let bounds={x:target.x,y:target.y,width:target.width,height:target.height};
  if(screen.screenToDipRect)bounds=screen.screenToDipRect(null,bounds);
  const display=screen.getDisplayMatching(bounds).workArea;
  const x=Math.max(display.x,Math.min(bounds.x+bounds.width-365,display.x+display.width-350));
  const y=Math.max(display.y,Math.min(bounds.y+65,display.y+display.height-230));
  overlayWindow.setBounds({x:Math.round(x),y:Math.round(y),width:350,height:225});overlayWindow.showInactive();
}
async function updateWindows(next){
  if(quitting||!tracker)return;
  windows=next;
  if(probeBusy)return;
  probeBusy=true;
  try{
    if(source){
      const active=windows.find(window=>window.handle===target?.handle);
      if(!active){finishCapture('gameClosed');}
      else {target=active;positionOverlay();}
    }
    if(!source&&tracker.settings.autoTrack){
      const chosen=selectGameWindow(windows,tracker.settings.preferredTitle);
      if(chosen)await startCapture(chosen);
      else phase=windows.filter(window=>!window.minimized).length>1?'ambiguous':'waiting';
    }
    broadcast();
  }catch(error){phase='error';detail=String(error.message).slice(0,180);retryAt=Date.now()+10000;broadcast();}
  finally{probeBusy=false;}
}
function startProbe(){
  probe?.kill();
  const helper=path.join(directory,'bin','DFWindowProbe.exe');
  if(!fsSync.existsSync(helper)){phase='error';detail='Helper de detecção ausente. Gere o app com npm run package.';broadcast();return;}
  const args=['--parent',String(process.pid)];
  if(selfTest)args.push('--fixture',String(process.pid));
  if(tracker.settings.processName)args.push('--process',tracker.settings.processName);
  probe=spawn(helper,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const child=probe;
  readline.createInterface({input:child.stdout}).on('line',line=>{try{const packet=JSON.parse(line);if(Array.isArray(packet.windows)&&child===probe)updateWindows(packet.windows);}catch{}});
  child.on('error',()=>{phase='error';detail='Não foi possível iniciar a detecção da janela.';broadcast();});
  child.on('exit',()=>{if(child===probe&&!quitting){phase='error';detail='A detecção da janela foi encerrada. Reabra o app.';broadcast();}});
}
async function createFixture(){
  fixtureWindow=new BrowserWindow({title:'DF Overview Capture Fixture',width:1100,height:700,frame:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await fixtureWindow.loadURL('dfov://app/desktop/ui/fixture.html');
}

if(!app.requestSingleInstanceLock()){app.quit();}
else {
  app.on('second-instance',()=>{if(mainWindow)showMain();});
  app.whenReady().then(async()=>{
    if(process.platform!=='win32'){dialog.showErrorBox('DeadFrontier Overview','Esta prévia é para Windows.');app.quit();return;}
    Menu.setApplicationMenu(null);
    protocol.handle('dfov',async request=>{
      const url=new URL(request.url);const pathname=decodeURIComponent(url.pathname);
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
    tracker=new DesktopTracker(store);
    mainWindow=new BrowserWindow({title:'DeadFrontier Overview',width:1120,height:830,minWidth:860,minHeight:660,backgroundColor:'#17110f',icon:path.join(root,'icon.png'),webPreferences:{preload:path.join(directory,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
    secureWindow(mainWindow,uiURL);
    mainWindow.on('close',event=>{if(!quitting){event.preventDefault();mainWindow.hide();}});
    overlayWindow=new BrowserWindow({title:'DF Overview Overlay',width:350,height:225,show:false,frame:false,transparent:true,resizable:false,skipTaskbar:true,focusable:false,alwaysOnTop:true,webPreferences:{preload:path.join(directory,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
    secureWindow(overlayWindow,overlayURL);overlayWindow.setIgnoreMouseEvents(true,{forward:true});
    tray=new Tray(nativeImage.createFromPath(path.join(root,'icon.png')));tray.setToolTip('DeadFrontier Overview — acompanhamento local');tray.on('double-click',showMain);updateTray();
    ipcMain.handle('overview:read',event=>{if(![uiURL,overlayURL].includes(event.senderFrame?.url))throw Error('Origem inválida');return publicState();});
    ipcMain.handle('overview:action',async(event,message)=>{
      if(!ownRenderer(event,uiURL))throw Error('Origem inválida');
      const {type,value}=message??{};
      if(type==='auto'&&typeof value==='boolean'){preferences({autoTrack:value});if(!value)finishCapture('disabled');}
      else if(type==='language'&&['auto','pt','en'].includes(value))preferences({language:value});
      else if(type==='overlay'&&typeof value==='boolean'){preferences({overlay:value});positionOverlay();}
      else if(type==='stop'){tracker.finish('stopped');}
      else if(type==='reset'){tracker.reset();if(captureWindow){token=crypto.randomUUID();captureWindow.webContents.send('capture:update',{type:'reset',token});}}
      else if(type==='multiplier')tracker.setMultiplier(value);
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
        if(!result.canceled&&result.filePath)await fs.writeFile(result.filePath,csvOfSessions(store.history(-1)),{encoding:'utf8'});
      }
      else if(type==='quit'){quitting=true;app.quit();return;}
      else throw Error('Ação inválida');
      tracker.persist();broadcast();return publicState();
    });
    ipcMain.handle('capture:config',event=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents)throw Error('Origem inválida');
      return{token,region:tracker.settings.region,diagnostics:!!diagnosticFile};
    });
    ipcMain.on('capture:sample',(event,message)=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents||message?.token!==token||!source||target?.minimized||message.confidence<60)return;
      try{tracker.sample(message.sample);lastCaptureMessage=Date.now();phase='reading';broadcast();}catch{phase='error';detail='Leitura de XP inválida.';broadcast();}
    });
    ipcMain.on('capture:status',(event,message)=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents||message?.token!==token)return;
      lastCaptureMessage=Date.now();phase=String(message.phase);detail=String(message.detail??'').slice(0,200);
      if(diagnosticFile&&Array.isArray(message.diagnostic))try{fsSync.writeFileSync(diagnosticFile,JSON.stringify({phase,readAt:Date.now(),attempts:message.diagnostic.slice(0,4)}));}catch{}
      if(phase==='ended')finishCapture('captureEnded');
      else if(phase==='resolution'){tracker.reset();broadcast();}
      else broadcast();
    });
    ipcMain.on('capture:preview',(event,message)=>{
      if(!ownRenderer(event,captureURL)||event.sender!==captureWindow?.webContents||message?.token!==token||typeof message.image!=='string'||!message.image.startsWith('data:image/jpeg;base64,')||message.image.length>2500000)return;
      preview={image:message.image,width:message.width,height:message.height,region:message.region};broadcast();
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
    }else startProbe();
    setInterval(()=>{
      if(quitting||!tracker)return;
      positionOverlay();
      if(captureWindow&&Date.now()-Math.max(captureStartedAt,lastCaptureMessage)>45000){finishCapture('captureFailed');phase='error';detail='O leitor não respondeu. Nova tentativa em alguns segundos.';retryAt=Date.now()+10000;broadcast();}
      if(selfTest){fsSync.writeFileSync(path.join(dataDirectory,'test-status.json'),JSON.stringify({phase,game:!!target,stats:tracker.snapshot().stats,sessionCount:store.count(),session:tracker.experience?.session,history:store.history(5)}));}
    },1000);
    if(process.argv.includes('--inspect-ui'))mainWindow.webContents.openDevTools({mode:'detach'});
  }).catch(error=>{console.error(error);app.exit(1);});
}
app.on('before-quit',()=>{quitting=true;globalShortcut.unregisterAll();if(tracker)tracker.finish('appClosed');const oldProbe=probe;probe=null;oldProbe?.kill();const old=captureWindow;captureWindow=null;old?.destroy();store?.close();store=null;tracker=null;});
app.on('window-all-closed',()=>{});
