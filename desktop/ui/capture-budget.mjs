export const CAPTURE_LIMITS=Object.freeze({fps:15,frameMs:67,recentFrames:6,xpAttempts:3,xpInterval:2000,xpIdleInterval:5000,cacheMs:10000});

export function pixelSignature(pixels){let hash=2166136261;for(let i=0;i<pixels.length;i+=4){hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+1],16777619);hash=Math.imul(hash^pixels[i+2],16777619);}return hash>>>0;}

export class HudScanBudget{
 constructor(){this.reset();}
 reset(){this.cursor=0;this.preferred=null;this.misses=0;}
 attempts(regions){
  const variants=regions.flatMap(area=>[80,null,160,110].map(threshold=>({area,threshold}))),out=[];
  if(this.preferred)out.push(this.preferred);
  let checked=0;while(out.length<CAPTURE_LIMITS.xpAttempts&&checked++<variants.length){const choice=variants[this.cursor++%variants.length];if(!out.some(v=>v.threshold===choice.threshold&&JSON.stringify(v.area)===JSON.stringify(choice.area)))out.push(choice);}
  return out;
 }
 result(best){if(best){if(best.method!=='hud-strokes')this.preferred={area:best.candidate,threshold:best.threshold};this.misses=0;}else{this.misses++;if(this.misses>=2)this.preferred=null;}}
 get delay(){return this.misses>=2?CAPTURE_LIMITS.xpIdleInterval:CAPTURE_LIMITS.xpInterval;}
}
