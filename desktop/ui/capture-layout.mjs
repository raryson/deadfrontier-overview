// Work in captured-frame pixels: a window can be smaller than the monitor,
// downsampled by capture, or rendered with a different HUD scale.
export function captureScales(width,height){
 const fit=Math.min(width/1920,height/1080);
 return [...new Set([1,fit,.75,1.25,1.5,2].filter(s=>s>=.25&&s<=3).map(s=>Math.round(s*1000)/1000))];
}
function fitRegion(width,height,x,y,w,h){
 if(x<0||y<0||x+w>width||y+h>height)return null;
 return{x:x/width,y:y/height,width:w/width,height:h/height};
}
export function hudStrokeRegions(width,height){
 return captureScales(width,height).flatMap(scale=>[0,32*scale].map(inset=>{
  const area=fitRegion(width,height,0,82*scale+inset,320*scale,22*scale);
  return area?{...area,scale}:null;
 }).filter(Boolean));
}
export function lootReadRegions(width,height){
 return captureScales(width,height).flatMap(scale=>[0,32*scale].map(inset=>{
  const area=fitRegion(width,height,width/2-175*scale,height/2+inset/2-115*scale,350*scale,310*scale);
  return area?{...area,scale}:null;
 }).filter(Boolean));
}
export class LootLayoutSearch{
 reset(){this.key='';this.preferred=null;this.cursor=0;this.nextProbe=0;}
 constructor(){this.reset();}
 candidates(width,height,now=Date.now()){
  const key=width+'x'+height;if(key!==this.key){this.reset();this.key=key;this.regions=lootReadRegions(width,height);}
  const base=this.preferred??this.regions.find(r=>Math.abs(r.scale-Math.min(width/1920,height/1080))<.002)??this.regions[0];
  const out=base?[base]:[];
  // At most one extra small detector crop every 200 ms, never a full-screen OCR.
  if(now>=this.nextProbe&&this.regions.length>1){this.nextProbe=now+200;let extra;for(let i=0;i<this.regions.length;i++){extra=this.regions[this.cursor++%this.regions.length];if(extra!==base)break;}if(extra!==base)out.push(extra);}
  return out;
 }
 found(region){this.preferred=region;}
}
