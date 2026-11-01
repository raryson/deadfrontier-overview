import Tesseract from '../../vendor/ocr/tesseract.esm.min.js';
import {parseHudXp,createOcrGate,defaultHudRegion} from '../../ocr-parser.js';
import {lootRegion} from './loot-model.mjs';
import {LootFrames} from './loot-frames.mjs';
import {parseLootPrompt} from './loot-journal.mjs';
import {LootSnapshotQueue,frameIsBlack,looksLikeLoot} from './loot-snapshots.mjs';
const bridge=window.captureBridge,video=document.getElementById('game'),gate=createOcrGate(),queue=new LootSnapshotQueue(),recent=new LootFrames(30);
let config,region,worker,lootWorker,stream,frameTimer,frameWidth=0,frameHeight=0,epoch=0,previewRequested=false,lootBusy=false,lootWake,firstRead=false,missingSince=0,lastSample=null;
const sendStatus=(phase,detail='')=>bridge.status({token:config?.token,phase,detail:String(detail).slice(0,200)});
function prepare(area,threshold=null){
 const w=Math.max(1,Math.round(area.width*video.videoWidth)),h=Math.max(1,Math.round(area.height*video.videoHeight)),canvas=document.createElement('canvas'),scale=Math.min(4,4096/w,1400/h);
 canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(video,area.x*video.videoWidth,area.y*video.videoHeight,w,h,0,0,canvas.width,canvas.height);
 return filter(canvas,threshold);
}
function filter(original,threshold){
 if(threshold===null)return original;
 const canvas=document.createElement('canvas');canvas.width=original.width;canvas.height=original.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(original,0,0);const image=ctx.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<image.data.length;i+=4){const r=image.data[i],g=image.data[i+1],b=image.data[i+2],value=r*.299+g*.587+b*.114>threshold?0:255;image.data[i]=image.data[i+1]=image.data[i+2]=value;image.data[i+3]=255;}ctx.putImageData(image,0,0);return canvas;
}
const bytes=canvas=>new Promise((resolve,reject)=>canvas.toBlob(async blob=>{if(!blob){reject(Error('Frame indisponível'));return;}resolve(new Uint8Array(await blob.arrayBuffer()));},'image/png'));
function crop(canvas,x,y,w,h){const out=document.createElement('canvas');out.width=Math.round(w);out.height=Math.round(h);out.getContext('2d').drawImage(canvas,x,y,w,h,0,0,out.width,out.height);return out;}
function captureLoot(){
 if(!video.videoWidth)return;
 const area=lootRegion(video.videoWidth,video.videoHeight),canvas=document.createElement('canvas');canvas.width=350;canvas.height=310;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,area.x*video.videoWidth,area.y*video.videoHeight,area.width*video.videoWidth,area.height*video.videoHeight,0,0,350,310);
 const pixels=ctx.getImageData(0,0,350,310).data;const at=Date.now(),frame=recent.push(canvas,at);frame.eventId=queue.offer(canvas,at,looksLikeLoot(pixels,350,310));if(queue.size)lootWake?.();
}
bridge.subscribe(update=>{
 if(!['reset','region','clear'].includes(update.type)&&update.token!==config?.token)return;
 if(update.type==='lootCapture'){
  const at=update.at,frames=recent.frames.filter(f=>f.at<=at&&at-f.at<=200);
  const eventId=frames.findLast(f=>f.eventId)?.eventId;
  const eligible=frames.filter(f=>f.eventId===eventId&&eventId),selected=eligible.length?eligible.slice(-3):[frames[0],frames[Math.floor(frames.length/2)],frames.at(-1)].filter(Boolean);
  if(queue.capture(selected,eventId))lootWake?.();return;
 }
 if(update.type==='lootSearch'){captureLoot();return;}
 if(update.type==='preview'){previewRequested=true;return;}
 if(update.type==='clear'){queue.clear();recent.clear();if(update.token)config.token=update.token;gate.reset();lastSample=null;epoch++;return;}
 if(update.type==='reset'){if(update.token)config.token=update.token;gate.reset();lastSample=null;epoch++;return;}
 if(update.type==='region'){config.region=update.region;region=update.region;gate.reset();lastSample=null;epoch++;}
});
const workerOptions={workerPath:new URL('../../vendor/ocr/worker.min.js',import.meta.url).href,corePath:new URL('../../vendor/ocr/tesseract-core-lstm.wasm.js',import.meta.url).href,langPath:new URL('../../vendor/ocr',import.meta.url).href,workerBlobURL:false,cacheMethod:'none'};
async function readLoot(){
 if(lootBusy||!lootWorker)return;lootBusy=true;
 try{
  let job;while(stream?.active&&(job=queue.next())){
   bridge.loot({token:config.token,reading:{kind:'queue',pending:queue.size+1,dropped:queue.dropped}});
   const prompt=crop(job.canvas,35,30,280,65),large=document.createElement('canvas');large.width=1120;large.height=260;const ctx=large.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(prompt,0,0,large.width,large.height);
   let best=null;const quantities=[];
   for(const threshold of [null,80,110]){
    const result=await lootWorker.recognize(await bytes(filter(large,threshold))),text=result.data.text,parsed=parseLootPrompt(text);if(!parsed)continue;
    if(parsed.quantity)quantities.push(parsed.quantity);
    if(!best||result.data.confidence>best.confidence)best={text,confidence:result.data.confidence};
    if(result.data.confidence>=85&&!parsed.quantity)break;
   }
   if(job.generation!==queue.generation)continue;
   if(best){const parsed=parseLootPrompt(best.text);bridge.loot({token:config.token,reading:{kind:'snapshot',manual:job.manual,eventId:job.eventId,capturedAt:job.capturedAt,frameAt:job.at,...best,quantityConfidence:parsed?.quantity&&quantities.filter(q=>q===parsed.quantity).length>=2?95:0}});}
   bridge.loot({token:config.token,reading:{kind:'queue',pending:queue.size,dropped:queue.dropped}});
  }
 }catch{/* A failed crop never stops XP. Later saved crops remain queued. */}
 finally{lootBusy=false;if(stream?.active&&queue.size)setTimeout(readLoot,50);}
}
window.startCapture=async()=>{
 try{
  config=await bridge.config();stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:30,max:30}},audio:false});stream.getVideoTracks()[0].addEventListener('ended',()=>sendStatus('ended'));video.srcObject=stream;await video.play();
  frameWidth=video.videoWidth;frameHeight=video.videoHeight;const saved=config.region;region=saved&&saved.sourceWidth===frameWidth&&saved.sourceHeight===frameHeight?saved:defaultHudRegion(frameWidth,frameHeight);
  // Capture starts before WASM initialization. The FIFO owns frozen crops;
  // closing a dialog or holding F never cancels its asynchronous OCR.
  frameTimer=setInterval(captureLoot,33);lootWake=readLoot;sendStatus('loading');
  const initializeLoot=async()=>{lootWorker=await Tesseract.createWorker('eng',1,workerOptions);await lootWorker.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_BLOCK,user_defined_dpi:'300'});await readLoot();};
  void initializeLoot().catch(()=>sendStatus('error','Não foi possível iniciar o leitor de itens.'));
  worker=await Tesseract.createWorker('eng',1,{...workerOptions,errorHandler:error=>sendStatus('error',error)});await worker.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789LVYlvKkMmBb.,:/()% ',user_defined_dpi:'300'});
  const check=document.createElement('canvas');check.width=48;check.height=27;const checkCtx=check.getContext('2d',{willReadFrequently:true});
  async function loop(){
   try{
    if(!video.videoWidth)return;
    if(frameWidth!==video.videoWidth||frameHeight!==video.videoHeight){frameWidth=video.videoWidth;frameHeight=video.videoHeight;config.region=null;region=defaultHudRegion(frameWidth,frameHeight);gate.reset();lastSample=null;epoch++;sendStatus('resolution');}
    checkCtx.drawImage(video,0,0,48,27);const black=frameIsBlack(checkCtx.getImageData(0,0,48,27).data);
    if(black){missingSince=0;sendStatus(firstRead?'transition':'waitingHud');return;}
    const revision=epoch,candidates=[region];if(!config.region&&region.y*video.videoHeight<85)candidates.push({...region,y:Math.min(112/video.videoHeight,1-region.height)});
    let best=null,diagnostic=[];
    for(const candidate of candidates){if(best?.confidence>=75)break;for(const threshold of [80,null,160,110]){
     const result=await worker.recognize(await bytes(prepare(candidate,threshold))),sample=parseHudXp(result.data.text,{previous:lastSample});diagnostic.push({text:result.data.text.slice(0,100),confidence:Math.round(result.data.confidence),threshold});if(sample&&(!best||result.data.confidence>best.confidence))best={sample,confidence:result.data.confidence,candidate};if(sample&&result.data.confidence>=85)break;
    }}
    if(revision!==epoch)return;const accepted=gate.accept(best?.sample,best?.confidence);
    if(accepted){region=best.candidate;lastSample=accepted;firstRead=true;missingSince=0;bridge.sample({token:config.token,sample:accepted,confidence:best.confidence});}
    if(!best)missingSince ||=Date.now();else missingSince=0;
    const phase=accepted?'reading':best?'confirming':!firstRead?'waitingHud':Date.now()-missingSince<15000?'transition':'unreadable';
    bridge.status({token:config.token,phase,...(config.diagnostics?{diagnostic}:{})});
   }catch(error){sendStatus('error',error.message);}
   finally{
    if(previewRequested&&video.videoWidth){previewRequested=false;const canvas=document.createElement('canvas');canvas.width=Math.min(video.videoWidth,960);canvas.height=Math.round(canvas.width*video.videoHeight/video.videoWidth);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);bridge.preview({token:config.token,image:canvas.toDataURL('image/jpeg',.6),width:video.videoWidth,height:video.videoHeight,region});}
    if(stream?.active)setTimeout(loop,1200);
   }
  }
  await loop();
 }catch(error){sendStatus('error',error.message);throw error;}
};
window.addEventListener('pagehide',()=>{clearInterval(frameTimer);queue.clear();recent.clear();stream?.getTracks().forEach(track=>track.stop());worker?.terminate();lootWorker?.terminate();});
