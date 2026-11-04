import {parseLootReading,canonicalLootName} from './loot-journal.mjs';
export const LOOT_OCR_LIMITS=Object.freeze({perFrame:4,perEvent:8,backlogFrame:2});
export const LOOT_TEXT_PASSES=Object.freeze([
 {y:33,height:16,mode:'original',line:true},
 {y:33,height:16,mode:'contrast',line:true},
 {y:30,height:32,mode:'sharp',line:false},
 {y:30,height:48,mode:'contrast',line:false}
]);
// Enhance only the saved text strip, never the whole game frame. Min-channel
// luminance suppresses coloured scenery behind the translucent red dialog.
export function enhanceLootText(pixels,width,height,mode='contrast'){
 if(pixels.length!==width*height*4||width<1||height<1)throw Error('Invalid text pixels');
 const gray=new Uint8Array(width*height),hist=new Uint32Array(256);
 for(let i=0;i<gray.length;i++){const j=i*4;gray[i]=Math.min(pixels[j],pixels[j+1],pixels[j+2]);hist[gray[i]]++;}
 const percentile=f=>{let sum=0;for(let n=0;n<256;n++){sum+=hist[n];if(sum>=gray.length*f)return n;}return 255;};
 const low=percentile(.02),high=Math.max(low+32,percentile(.99));
 const out=new Uint8ClampedArray(pixels.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=y*width+x,g=gray[at];let value;
  {
   let detail=0;if(mode==='sharp'&&x>0&&x<width-1&&y>0&&y<height-1){let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=gray[at+dy*width+dx];detail=(g-sum/9)*.7;}
   value=255-Math.max(0,Math.min(255,(g+detail-low)*255/(high-low)));
  }
  const i=at*4;out[i]=out[i+1]=out[i+2]=value;out[i+3]=255;
 }
 return out;
}
export function chooseLootRead(reads,catalog=[]){
 const groups=new Map();
 for(const reading of reads){const parsed=parseLootReading(reading.text,catalog);if(!parsed||reading.confidence<60)continue;
  const name=canonicalLootName(parsed.item,catalog),key=name.toUpperCase().replace(/[^A-Z0-9]/g,''),known=!!parsed.cash||catalog.some(item=>item.name===name);
  const group=groups.get(key)??{reads:[],known};group.reads.push({...reading,parsed});groups.set(key,group);
 }
 const sorted=[...groups.values()].sort((a,b)=>(b.known?30:0)+b.reads.length*15+Math.max(...b.reads.map(r=>r.confidence))-(a.known?30:0)-a.reads.length*15-Math.max(...a.reads.map(r=>r.confidence)));
 if(!sorted.length)return null;
 const group=sorted[0],ordered=group.reads.toSorted((a,b)=>b.confidence-a.confidence),best=ordered.find(r=>r.parsed.quantity)??ordered[0];
 const quantities=group.reads.map(r=>r.parsed.quantity).filter(Boolean),quantityConflict=new Set(quantities).size>1;
 return{text:best.text,confidence:ordered[0].confidence,agreement:group.reads.length,known:group.known,nameConflict:sorted.filter(g=>g.known&&g.reads.some(r=>r.confidence>=75)).length>1,quantityConflict,quantityConfidence:!quantityConflict&&quantities.length>=2?95:0};
}
