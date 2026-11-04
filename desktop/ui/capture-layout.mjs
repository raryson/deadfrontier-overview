// Work in captured-frame pixels: a window can be smaller than the monitor,
// downsampled by capture, or rendered with a different HUD scale.
export function captureScales(width,height,pixelScale=1){
 const fit=Math.min(width/1920,height/1080);
 return [...new Set([pixelScale,1,fit,.75,1.25,1.5,2].filter(s=>s>=.25&&s<=3).map(s=>Math.round(s*1000)/1000))];
}
export function nativeWindowGeometry(window){
 if(!window)return null;
 const values=[window.width,window.height,window.clientWidth,window.clientHeight,window.clientX-window.x,window.clientY-window.y];
 if(values.some(n=>!Number.isFinite(n))||values.slice(0,4).some(n=>n<=0||n>50000))return null;
 const [width,height,clientWidth,clientHeight,left,top]=values;
 if(left<0||top<0||left+clientWidth>width+1||top+clientHeight>height+1)return null;
 return{width,height,clientWidth,clientHeight,left,top};
}
export function captureViewports(width,height,geometry=null){
 const full={x:0,y:0,width,height,pixelScale:1,native:false},out=[];
 if(geometry&&[geometry.width,geometry.height,geometry.clientWidth,geometry.clientHeight].every(n=>Number.isFinite(n)&&n>0)&&[geometry.left,geometry.top].every(n=>Number.isFinite(n)&&n>=0)){
  const g=geometry;
  if(g.left+g.clientWidth<=g.width+1&&g.top+g.clientHeight<=g.height+1){
   // Windows capture may omit the invisible resize border. Derive its visible
   // border from frame/client sizes instead of adding a fixed title-bar height.
   if(width>=g.clientWidth&&height>=g.clientHeight&&width<=g.width+1&&height<=g.height+1){
    const left=(width-g.clientWidth)/2,top=height-g.clientHeight-left;
    if(top>=0)out.push({x:left,y:top,width:g.clientWidth,height:g.clientHeight,pixelScale:1,native:true});
   }
   const rx=width/g.width,ry=height/g.height;
   out.push({x:g.left*rx,y:g.top*ry,width:g.clientWidth*rx,height:g.clientHeight*ry,pixelScale:(rx+ry)/2,native:true});
  }
 }
 out.push(full);return out.filter((r,i)=>!out.slice(0,i).some(a=>a.native===r.native&&Math.abs(a.x-r.x)<.5&&Math.abs(a.y-r.y)<.5&&Math.abs(a.width-r.width)<.5&&Math.abs(a.height-r.height)<.5));
}
function fitRegion(width,height,x,y,w,h){
 if(x<0||y<0||x+w>width||y+h>height)return null;
 return{x:x/width,y:y/height,width:w/width,height:h/height};
}
export function hudStrokeRegions(width,height,geometry=null){
 return captureViewports(width,height,geometry).flatMap(view=>captureScales(view.width,view.height,view.pixelScale).flatMap(scale=>(view.native?[0]:[0,32*scale]).map(inset=>{
  const area=fitRegion(width,height,view.x,view.y+82*scale+inset,320*scale,22*scale);
  return area?{...area,scale,native:view.native}:null;
 }).filter(Boolean)));
}
export function lootReadRegions(width,height,geometry=null){
 return captureViewports(width,height,geometry).flatMap(view=>captureScales(view.width,view.height,view.pixelScale).flatMap(scale=>(view.native?[0]:[0,32*scale]).map(inset=>{
  const area=fitRegion(width,height,view.x+view.width/2-175*scale,view.y+view.height/2+inset/2-115*scale,350*scale,310*scale);
  return area?{...area,scale,defaultScale:Math.abs(scale-Math.min(view.width/1920,view.height/1080))<.002&&inset===0}:null;
 }).filter(Boolean)));
}
export class LootLayoutSearch{
 reset(){this.key='';this.preferred=null;this.cursor=0;this.nextProbe=0;}
 constructor(){this.reset();}
 candidates(width,height,now=Date.now(),geometry=null){
  const key=width+'x'+height+JSON.stringify(geometry);if(key!==this.key){this.reset();this.key=key;this.regions=lootReadRegions(width,height,geometry);}
  const base=this.preferred??this.regions.find(r=>r.defaultScale)??this.regions[0];
  const out=base?[base]:[];
  // At most one extra small detector crop every 200 ms, never a full-screen OCR.
  if(now>=this.nextProbe&&this.regions.length>1){this.nextProbe=now+200;let extra;for(let i=0;i<this.regions.length;i++){extra=this.regions[this.cursor++%this.regions.length];if(extra!==base)break;}if(extra!==base)out.push(extra);}
  return out;
 }
 found(region){this.preferred=region;}
}
