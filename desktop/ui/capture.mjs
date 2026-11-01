import Tesseract from '../../vendor/ocr/tesseract.esm.min.js';
import {LootFrames} from './loot-frames.mjs';
import {parseHudXp,createOcrGate,defaultHudRegion} from '../../ocr-parser.js';
import {lootRegion,parseLootDialog,lootButtons,searchInProgress,wordsOf,titleStillVisible} from './loot-model.mjs';
const bridge=window.captureBridge;
const video=document.getElementById('game');
const gate=createOcrGate();
const lootFrames=new LootFrames(12),lootInputJobs=[];
let frameTimer,lootWake,lootBurstUntil=0;
let config,region,worker,lootWorker,headerWorker,stream,epoch=0,previewRequested=false,frameWidth=0,frameHeight=0;
const sendStatus=(phase,detail='')=>bridge.status({token:config?.token,phase,detail:String(detail).slice(0,200)});
function prepare(region,threshold=160,neutralOnly=false){
  const width=Math.max(1,Math.round(region.width*video.videoWidth)),height=Math.max(1,Math.round(region.height*video.videoHeight));
  const canvas=document.createElement('canvas');const scale=Math.min(4,4096/width,1400/height);
  canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=!(neutralOnly||threshold===null);ctx.imageSmoothingQuality='high';
  ctx.drawImage(video,region.x*video.videoWidth,region.y*video.videoHeight,width,height,0,0,canvas.width,canvas.height);
  if(threshold===null)return canvas;
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];const c=r*.299+g*.587+b*.114>threshold&&(!neutralOnly||Math.max(r,g,b)-Math.min(r,g,b)<65)?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=c;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);return canvas;
}
function canvasBytes(canvas){return new Promise((resolve,reject)=>canvas.toBlob(async blob=>{if(!blob){reject(Error('Frame indisponível'));return;}resolve(new Uint8Array(await blob.arrayBuffer()));},'image/png'));}
bridge.subscribe(update=>{
  if(update.type==='lootSearch'&&update.token===config?.token){lootBurstUntil=Date.now()+12000;lootWake?.();return;}
  if(update.type==='lootInput'&&update.token===config?.token&&typeof update.input?.id==='string'){
    const input=update.input,before=lootFrames.frames.filter(frame=>frame.at<=input.at&&input.at-frame.at<=500).slice(-3);
    if(!before.length)return;
    lootBurstUntil=Date.now()+12000;
    setTimeout(()=>{for(const frame of before)lootInputJobs.push({frame,after:lootFrames.after(input.at+350),inputId:input.id});while(lootInputJobs.length>9)lootInputJobs.shift();lootWake?.();},450);
    return;
  }
  if(update.type==='preview'){previewRequested=true;return;}
  if(update.type==='reset'){lootInputJobs.length=0;lootFrames.clear();if(update.token)config.token=update.token;gate.reset();epoch++;return;}
  if(update.type==='region'){if(update.token)config.token=update.token;config.region=update.region;region=update.region;gate.reset();epoch++;}
});
window.startCapture=async()=>{
  try{
    config=await bridge.config();
    stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{max:12}},audio:false});
    stream.getVideoTracks()[0].addEventListener('ended',()=>sendStatus('ended'));
    video.srcObject=stream;await video.play();
    frameTimer=setInterval(()=>{
      if(!video.videoWidth)return;const area=lootRegion(video.videoWidth,video.videoHeight),canvas=document.createElement('canvas');
      const width=area.width*video.videoWidth,height=area.height*video.videoHeight,scale=Math.min(1,600/width);
      canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      canvas.getContext('2d').drawImage(video,area.x*video.videoWidth,area.y*video.videoHeight,width,height,0,0,canvas.width,canvas.height);
      lootFrames.push(canvas,Date.now());
    },75);
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
    // A separate worker keeps loot recognition from changing the XP whitelist
    // or delaying its serial OCR loop. Only the game's central dialog is read.
    async function startLoot(){
      try{
        lootWorker=await Tesseract.createWorker('eng',1,{
          workerPath:new URL('../../vendor/ocr/worker.min.js',import.meta.url).href,
          corePath:new URL('../../vendor/ocr/tesseract-core-lstm.wasm.js',import.meta.url).href,
          langPath:new URL('../../vendor/ocr',import.meta.url).href,workerBlobURL:false,cacheMethod:'none'
        });
        await lootWorker.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_BLOCK,user_defined_dpi:'300'});
        headerWorker=await Tesseract.createWorker('eng',1,{
          workerPath:new URL('../../vendor/ocr/worker.min.js',import.meta.url).href,
          corePath:new URL('../../vendor/ocr/tesseract-core-lstm.wasm.js',import.meta.url).href,
          langPath:new URL('../../vendor/ocr',import.meta.url).href,workerBlobURL:false,cacheMethod:'none'
        });
        await headerWorker.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,user_defined_dpi:'300'});
        let lastFallback=0,lastSearch=0,lootDelay=400,lastTitle=null,lastNameEvidence=null,lootBusy=false,nextLootTimer;
        // Every recognition pass uses this frozen card, including button boxes.
        // The old reader cropped only 38px of prompt and reread live frames
        // between name/buttons; wrapped equipment names could disappear midway.
        function cropCard(original,x,y,width,height){
          const canvas=document.createElement("canvas");canvas.width=Math.round(original.width*width);canvas.height=Math.round(original.height*height);canvas.getContext("2d").drawImage(original,original.width*x,original.height*y,original.width*width,original.height*height,0,0,canvas.width,canvas.height);return canvas;
        }
        function filterCard(original,threshold){
          const canvas=document.createElement('canvas');canvas.width=original.width;canvas.height=original.height;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(original,0,0);
          if(threshold===null)return canvas;
          const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
          for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];const c=r*.299+g*.587+b*.114>threshold&&Math.max(r,g,b)-Math.min(r,g,b)<65?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=c;pixels.data[i+3]=255;}
          ctx.putImageData(pixels,0,0);return canvas;
        }
        function upscale(frame){const canvas=document.createElement('canvas'),scale=Math.min(4,1400/frame.canvas.width,1240/frame.canvas.height);canvas.width=Math.round(frame.canvas.width*scale);canvas.height=Math.round(frame.canvas.height*scale);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(frame.canvas,0,0,canvas.width,canvas.height);return canvas;}
        lootWake=()=>{clearTimeout(nextLootTimer);if(!lootBusy)readLoot();};
        async function readLoot(){
          if(lootBusy)return;lootBusy=true;
          try{
            if(!video.videoWidth)return;
            const job=lootInputJobs.pop(),frame=job?.frame??lootFrames.frames.at(-1);if(!frame)return;
            const revision=epoch,area=lootRegion(video.videoWidth,video.videoHeight),card=upscale(frame);
            const title=cropCard(card,110/350,10/310,130/350,20/310);
            const titlePixels=title.getContext('2d').getImageData(0,0,title.width,title.height).data;
            const titleVisible=titleStillVisible(lastTitle,titlePixels);
            if(!job&&lastNameEvidence&&titleVisible!==false){
              const box=lastNameEvidence.box,patch=cropCard(card,box.x,box.y,box.width,box.height),pixels=patch.getContext('2d').getImageData(0,0,patch.width,patch.height).data;
              if(titleStillVisible(lastNameEvidence.pixels,pixels,.85)===true)bridge.loot({token:config.token,reading:{kind:'visible',nameVisible:true}});
            }
            const header=await headerWorker.recognize(await canvasBytes(title));
            const titlePresent=/(?:[I1L\[]TEM|MEM)\s*(?:FOU[MN]D|FOND)/i.test(header.data.text);
            const verifiedHeader=header.data.confidence>=40&&/(?:[I1L\[]TEM|MEM)\s*(?:FOU[MN]D|FOND)/i.test(header.data.text);
            if(revision!==epoch)return;
            if(!job&&verifiedHeader){lastTitle=titlePixels;bridge.loot({token:config.token,reading:{kind:'hint'}});}
            // Header recognition arms only the game's choice keys immediately.
            // Full-card OCR may finish after the user has already clicked Yes.
            if(job||verifiedHeader||Date.now()<lootBurstUntil||Date.now()-lastFallback>=1200){
              lastFallback=Date.now();let best=null,lastText='';const quantityVotes=[];

              const buttonCard=cropCard(card,0,145/310,1,130/310);
              const buttonArea={...area,y:area.y+area.height*145/310,height:area.height*130/310};
              const buttonImage=filterCard(buttonCard,110);
              const buttonResult=await lootWorker.recognize(await canvasBytes(buttonImage),{},{text:true,blocks:true});
              for(const [promptHeight,threshold] of [[38,null],[38,80],[60,null],[60,110]]){
                const prompt=cropCard(card,35/350,30/310,280/350,promptHeight/310);
                const image=filterCard(prompt,threshold),result=await lootWorker.recognize(await canvasBytes(image),{},{text:true,blocks:true});
                const text=result.data.text+'\n'+buttonResult.data.text;lastText=text;
                const parsed=parseLootDialog(text);
                if(!parsed)continue;
                if(parsed.quantity&&/\(\s*[\d, ]+\s*(?:ML|ROUNDS?)?\s*\)/i.test(result.data.text))quantityVotes.push(parsed.quantity);
                const tokens=parsed.item.toUpperCase().split(/\s+/).map(t=>t.replace(/[^A-Z0-9]/g,''));
                const words=wordsOf(result.data.blocks).filter(w=>parsed.cash?/[\d$]/.test(w.text):tokens.includes(w.text.toUpperCase().replace(/[^A-Z0-9]/g,'')));
                if(!words.length||words.some(w=>w.confidence<45)||result.data.confidence<65)continue;
                const confidence=result.data.confidence,nameConfidence=Math.min(...words.map(w=>w.confidence));
                const boxes=words.filter(w=>w.bbox).map(w=>w.bbox);
                const left=Math.max(0,Math.min(...boxes.map(b=>b.x0))-2),top=Math.max(0,Math.min(...boxes.map(b=>b.y0))-2),right=Math.min(image.width,Math.max(...boxes.map(b=>b.x1))+2),bottom=Math.min(image.height,Math.max(...boxes.map(b=>b.y1))+2);
                const evidenceBox=boxes.length?{x:35/350+left/image.width*280/350,y:30/310+top/image.height*promptHeight/310,width:(right-left)/image.width*280/350,height:(bottom-top)/image.height*promptHeight/310}:null;
                const quantityWord=parsed.quantity?wordsOf(result.data.blocks).find(w=>Number(w.text.replace(/[^0-9]/g,''))===parsed.quantity&&/[()]/.test(w.text)):null;
                if(!best||confidence>best.confidence)best={text,confidence,nameConfidence,evidenceBox,...(quantityWord?.confidence>=70||result.data.confidence>=85&&parsed.quantity?{quantityCandidate:parsed.quantity}:{}),buttons:lootButtons(buttonResult.data.blocks,buttonArea,buttonImage.width,buttonImage.height)};
                if(confidence>=80&&(!parsed.quantity||quantityVotes.filter(q=>q===parsed.quantity).length>=2))break;
              }
              if(best){
                let beforeName;
                if(best.evidenceBox){const box=best.evidenceBox,patch=cropCard(card,box.x,box.y,box.width,box.height);beforeName={box,pixels:patch.getContext('2d').getImageData(0,0,patch.width,patch.height).data};}
                if(!job){lastTitle=titlePixels;lastNameEvidence=beforeName;}
                if(job&&job.after&&best.evidenceBox){
                  const afterCard=upscale(job.after),box=best.evidenceBox,afterTitle=cropCard(afterCard,110/350,10/310,130/350,20/310),afterName=cropCard(afterCard,box.x,box.y,box.width,box.height);
                  const afterPixels=afterCard.getContext('2d').getImageData(0,0,afterCard.width,afterCard.height).data;let light=0;for(let i=0;i<afterPixels.length;i+=64)light+=afterPixels[i]+afterPixels[i+1]+afterPixels[i+2];
                  best.inputDismissed=light/(afterPixels.length/64*3)>8&&titleStillVisible(titlePixels,afterTitle.getContext('2d').getImageData(0,0,afterTitle.width,afterTitle.height).data)===false&&titleStillVisible(beforeName.pixels,afterName.getContext('2d').getImageData(0,0,afterName.width,afterName.height).data,.85)===false;
                  best.inputAfterAt=job.after.at;
                }
                delete best.evidenceBox;
                const parsed=parseLootDialog(best.text);
                if(parsed?.quantity){
                  best.quantityVerified=quantityVotes.filter(q=>q===parsed.quantity).length>=2;
                  if(best.quantityVerified)best.quantity=parsed.quantity;
                }
              }
              if(revision!==epoch)return;
              const partial=titlePresent||titleVisible!==false&&!!lastTitle||/ITEM\s*FOUND|YOU\s+HAVE\s+FOUND|WILL\s+YOU\s+TAKE|INVENTORY\s+SLOTS\s+FREE/i.test(lastText);
              bridge.loot({token:config.token,reading:best?{kind:'found',...best,verifiedHeader,dialogVisible:true,capturedAt:frame.at,...(job?{inputId:job.inputId}:{}),headerText:header.data.text.slice(0,100)}:{kind:partial?'unknown':'absent',dialogVisible:partial,...(job?{inputId:job.inputId}:{}),text:lastText.slice(0,1200),headerText:header.data.text.slice(0,100)}});
            }
            if(!job&&!verifiedHeader&&Date.now()>=lootBurstUntil&&Date.now()-lastSearch>=3000){
              lastSearch=Date.now();const progress=prepare({x:.25,y:.75,width:.5,height:.25},160,true);
              const check=await headerWorker.recognize(await canvasBytes(progress));
              if(revision===epoch&&check.data.confidence>=55&&searchInProgress(check.data.text))bridge.loot({token:config.token,reading:{kind:'searching'}});
            }
          }catch{/* A loot OCR failure never stops XP or confirms a pickup. */}
          finally{lootBusy=false;if(stream?.active)nextLootTimer=setTimeout(readLoot,lootInputJobs.length?0:Date.now()<lootBurstUntil?100:lootDelay);}
        }
        await readLoot();
      }catch{/* XP remains usable if the optional loot reader cannot start. */}
    }
    startLoot();
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
          for(const [threshold,neutral] of [[160,false],[80,false],[110,true],[null,false]]){
            const image=prepare(candidate,threshold,neutral);const result=await worker.recognize(await canvasBytes(image));
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
window.addEventListener('pagehide',()=>{clearInterval(frameTimer);lootFrames.clear();stream?.getTracks().forEach(track=>track.stop());worker?.terminate();lootWorker?.terminate();headerWorker?.terminate();});
