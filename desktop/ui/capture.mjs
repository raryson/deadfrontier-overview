import Tesseract from '../../vendor/ocr/tesseract.esm.min.js';
import {parseHudXp,createOcrGate,defaultHudRegion} from '../../ocr-parser.js';
const bridge=window.captureBridge;
const video=document.getElementById('game');
const gate=createOcrGate();
let config,region,worker,stream,epoch=0,previewRequested=false,frameWidth=0,frameHeight=0;
const sendStatus=(phase,detail='')=>bridge.status({token:config?.token,phase,detail:String(detail).slice(0,200)});
function prepare(region,threshold=160){
  const width=Math.max(1,Math.round(region.width*video.videoWidth)),height=Math.max(1,Math.round(region.height*video.videoHeight));
  const canvas=document.createElement('canvas');const scale=Math.min(4,4096/width,512/height);
  canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingQuality='high';
  ctx.drawImage(video,region.x*video.videoWidth,region.y*video.videoHeight,width,height,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const c=pixels.data[i]*.299+pixels.data[i+1]*.587+pixels.data[i+2]*.114>threshold?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=c;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);return canvas;
}
function canvasBytes(canvas){return new Promise((resolve,reject)=>canvas.toBlob(async blob=>{if(!blob){reject(Error('Frame indisponível'));return;}resolve(new Uint8Array(await blob.arrayBuffer()));},'image/png'));}
bridge.subscribe(update=>{
  if(update.type==='preview'){previewRequested=true;return;}
  if(update.type==='reset'){if(update.token)config.token=update.token;gate.reset();epoch++;return;}
  if(update.type==='region'){if(update.token)config.token=update.token;config.region=update.region;region=update.region;gate.reset();epoch++;}
});
window.startCapture=async()=>{
  try{
    config=await bridge.config();
    stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{max:5}},audio:false});
    stream.getVideoTracks()[0].addEventListener('ended',()=>sendStatus('ended'));
    video.srcObject=stream;await video.play();
    const saved=config.region;
    region=saved&&saved.sourceWidth===video.videoWidth&&saved.sourceHeight===video.videoHeight?saved:defaultHudRegion(video.videoWidth,video.videoHeight);
    frameWidth=video.videoWidth;frameHeight=video.videoHeight;
    sendStatus('loading');
    // A direct core path avoids probing/compiling multiple WASM variants.
    worker=await Tesseract.createWorker('eng',1,{
      workerPath:new URL('../../vendor/ocr/worker.min.js',import.meta.url).href,
      corePath:new URL('../../vendor/ocr/tesseract-core-lstm.wasm.js',import.meta.url).href,
      langPath:new URL('../../vendor/ocr',import.meta.url).href,workerBlobURL:false,cacheMethod:'none',
      errorHandler:error=>sendStatus('error',error),
      logger:entry=>{if(entry.status!=='recognizing text')sendStatus('loading');}
    });
    await worker.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789LVYlvKkMmBb.,:/()% ',user_defined_dpi:'300'});
    async function loop(){
      try{
        if(!video.videoWidth)return;
        if(frameWidth!==video.videoWidth||frameHeight!==video.videoHeight){
          frameWidth=video.videoWidth;frameHeight=video.videoHeight;config.region=null;
          region=defaultHudRegion(frameWidth,frameHeight);gate.reset();epoch++;sendStatus('resolution');
        }
        const revision=epoch;
        const candidates=[region];
        // Window borders/title bars vary. Try the HUD one title bar lower until
        // a stable reference is found, without requiring a picker or calibration.
        if(!config.region&&region.y*video.videoHeight<85)candidates.push({...region,y:Math.min((80+32)/video.videoHeight,1-region.height)});
        let best=null,diagnostic=[];
        for(const candidate of candidates){
          for(const threshold of [160,80]){
            const image=prepare(candidate,threshold);const result=await worker.recognize(await canvasBytes(image));
            const sample=parseHudXp(result.data.text);
            diagnostic.push({text:String(result.data.text).replace(/[^0-9LVYlvKkMmBb.,:/()%\s]/g,'').slice(0,100),confidence:Math.round(result.data.confidence),threshold});
            if(sample&&(!best||result.data.confidence>best.confidence))best={sample,confidence:result.data.confidence,candidate};
            if(sample&&result.data.confidence>=85)break;
          }
        }
        if(revision!==epoch)return;
        const accepted=gate.accept(best?.sample,best?.confidence);
        if(accepted){region=best.candidate;bridge.sample({token:config.token,sample:accepted,confidence:best.confidence});}
        bridge.status({token:config.token,phase:accepted?'reading':best?'confirming':'unreadable',...(config.diagnostics?{diagnostic}:{})});
        if(previewRequested){
          previewRequested=false;const canvas=document.createElement('canvas');canvas.width=Math.min(video.videoWidth,960);canvas.height=Math.round(canvas.width*video.videoHeight/video.videoWidth);
          canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
          bridge.preview({token:config.token,image:canvas.toDataURL('image/jpeg',.6),width:video.videoWidth,height:video.videoHeight,region});
        }
      }catch(error){sendStatus('error',error.message);}
      finally{if(stream?.active)setTimeout(loop,2000);}
    }
    await loop();
  }catch(error){sendStatus('error',error.message);throw error;}
};
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(track=>track.stop());worker?.terminate();});
