import Tesseract from './vendor/ocr/tesseract.esm.min.js';
const {createWorker,PSM}=Tesseract;
import {parseHudXp,createOcrGate,defaultHudRegion} from './ocr-parser.js';

export function prepareOcrFrame(video,region,canvas,threshold=80) {
  const sourceWidth=video.videoWidth??video.naturalWidth??video.width;
  const sourceHeight=video.videoHeight??video.naturalHeight??video.height;
  const sx=Math.round(region.x*sourceWidth),sy=Math.round(region.y*sourceHeight);
  const width=Math.max(1,Math.round(region.width*sourceWidth)),height=Math.max(1,Math.round(region.height*sourceHeight));
  const scale=Math.min(4,4096/width,512/height);
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(video,sx,sy,width,height,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let index=0;index<pixels.data.length;index+=4) {
    const luminance=pixels.data[index]*0.299+pixels.data[index+1]*0.587+pixels.data[index+2]*0.114;
    const value=luminance>threshold?0:255;
    pixels.data[index]=value;pixels.data[index+1]=value;pixels.data[index+2]=value;pixels.data[index+3]=255;
  }
  context.putImageData(pixels,0,0);return canvas;
}

export function createCaptureController({preview,crop,onBegin,onEnd,onSample,onStatus,onCandidate,onRegionChange,loadRegion,saveRegion}) {
  let stream=null,worker=null,video=null,region=null,epoch=0,regionEpoch=0;
  let previewTimer,readTimer,inFlight=null,captureId=null,drag=null;
  const gate=createOcrGate();
  function drawPreview() {
    if(!video?.videoWidth)return;
    preview.width=Math.min(960,video.videoWidth);preview.height=Math.round(preview.width*video.videoHeight/video.videoWidth);
    const context=preview.getContext('2d');context.drawImage(video,0,0,preview.width,preview.height);
    const selected=drag?{x:Math.min(drag.start.x,drag.end.x),y:Math.min(drag.start.y,drag.end.y),width:Math.abs(drag.end.x-drag.start.x),height:Math.abs(drag.end.y-drag.start.y)}:region;
    context.strokeStyle='#ff994b';context.lineWidth=2;
    context.strokeRect(selected.x*preview.width,selected.y*preview.height,selected.width*preview.width,selected.height*preview.height);
  }
  function pointerPosition(event) {
    const rect=preview.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
  }
  async function setRegion(next) {
    if(!video)return;
    region=next;regionEpoch++;gate.reset();
    await onRegionChange();
    await saveRegion({...region,sourceWidth:video.videoWidth,sourceHeight:video.videoHeight});
    onStatus('ocrCalibrated');drawPreview();
  }
  preview.addEventListener('pointerdown',event=>{
    if(!video)return;event.preventDefault();preview.setPointerCapture(event.pointerId);
    const point=pointerPosition(event);drag={start:point,end:point};regionEpoch++;
  });
  preview.addEventListener('pointermove',event=>{if(drag){drag.end=pointerPosition(event);drawPreview();}});
  preview.addEventListener('pointercancel',()=>{drag=null;drawPreview();});
  preview.addEventListener('pointerup',event=>{
    if(!drag)return;drag.end=pointerPosition(event);
    const selected={x:Math.min(drag.start.x,drag.end.x),y:Math.min(drag.start.y,drag.end.y),width:Math.abs(drag.end.x-drag.start.x),height:Math.abs(drag.end.y-drag.start.y)};
    drag=null;
    if(selected.width*video.videoWidth<100||selected.height*video.videoHeight<10){drawPreview();return;}
    setRegion(selected).catch(()=>onStatus('ocrFailed'));
  });
  async function stop() {
    epoch++;clearInterval(previewTimer);clearTimeout(readTimer);
    stream?.getTracks().forEach(track=>track.stop());stream=null;
    if(video){video.pause();video.srcObject=null;video=null;}
    const oldWorker=worker;worker=null;
    gate.reset();drag=null;inFlight=null;
    preview.getContext('2d').clearRect(0,0,preview.width,preview.height);
    crop.getContext('2d').clearRect(0,0,crop.width,crop.height);
    if(captureId){captureId=null;await onEnd();}
    if(oldWorker)await oldWorker.terminate();
    onStatus('ocrStopped');
  }
  async function readNow() {
    if(inFlight)return inFlight;
    if(!worker||!video?.videoWidth||drag)return;
    const thisEpoch=epoch,thisRegion=regionEpoch;
    const image=document.createElement('canvas');prepareOcrFrame(video,region,image);
    crop.width=image.width;crop.height=image.height;crop.getContext('2d').drawImage(image,0,0);
    inFlight=(async()=>{
      try {
        const {data}=await worker.recognize(image);
        if(epoch!==thisEpoch||regionEpoch!==thisRegion)return;
        const sample=parseHudXp(data.text);
        onCandidate(sample,Math.round(data.confidence));
        const accepted=gate.accept(sample,data.confidence);
        if(accepted){await onSample(accepted,captureId);onStatus('ocrReading');}
        else onStatus(sample?'ocrConfirming':'ocrUnreadable');
      } catch {if(epoch===thisEpoch)onStatus('ocrFailed');}
      finally {if(epoch===thisEpoch)inFlight=null;}
    })();
    return inFlight;
  }
  async function start() {
    if(stream)return;
    const thisEpoch=++epoch;
    try {
      if(!navigator.mediaDevices?.getDisplayMedia)throw Error('unsupported');
      // This call must remain directly tied to the user's click/permission picker.
      const selectedStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      if(epoch!==thisEpoch){selectedStream.getTracks().forEach(track=>track.stop());return;}
      stream=selectedStream;
      stream.getVideoTracks()[0].addEventListener('ended',()=>stop().catch(()=>{}),{once:true});
      video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();
      if(epoch!==thisEpoch)return;
      captureId=await onBegin();
      if(epoch!==thisEpoch){captureId=null;await onEnd();return;}
      const saved=await loadRegion();
      if(epoch!==thisEpoch)return;
      region=saved?.sourceWidth===video.videoWidth&&saved?.sourceHeight===video.videoHeight?saved:defaultHudRegion(video.videoWidth,video.videoHeight);
      gate.reset();drawPreview();previewTimer=setInterval(drawPreview,500);onStatus('ocrLoading');
      const loaded=await createWorker('eng',1,{
        workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,
        corePath:new URL('./vendor/ocr',import.meta.url).href,
        langPath:new URL('./vendor/ocr',import.meta.url).href,
        workerBlobURL:false,cacheMethod:'none',logger:()=>{},
      });
      if(epoch!==thisEpoch){await loaded.terminate();return;}
      worker=loaded;
      await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789LVYlvKkMmBb.,:/()% ',user_defined_dpi:'300'});
      const loop=async()=>{await readNow();if(epoch===thisEpoch)readTimer=setTimeout(loop,2000);};
      await loop();
    } catch(error) {
      await stop();
      onStatus(error.name==='NotAllowedError'||error.name==='AbortError'?'ocrCancelled':'ocrFailed');
    }
  }
  return {start,stop,readNow,resetRegion:()=>video?setRegion(defaultHudRegion(video.videoWidth,video.videoHeight)):Promise.resolve(),get active(){return !!stream;}};
}
