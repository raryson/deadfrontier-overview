import {defaultHudRegion} from '../../ocr-parser.js';
import {hudStrokeRegions} from './capture-layout.mjs';

export function hudReadRegions(width,height,saved=null,geometry=null){
 if(saved)return[saved];
 const base=defaultHudRegion(width,height);
 const fit=(area,offset,pixelsWide,pixelsHigh)=>{const h=Math.min(area.height,pixelsHigh/height);return{...area,y:Math.min(1-h,area.y+offset/height),width:Math.min(area.width,pixelsWide/width),height:h};};
 // Exclude scenery around and to the right of the short raw-XP line.
 // Coarse regions remain available for longer text and a window title bar.
 const variants=area=>[fit(area,5,220,17),fit(area,3,280,21),area];
 const regions=variants(base);
 if(base.y*height<85)regions.push(...variants({...base,y:Math.min(112/height,1-base.height)}));
 const scale=Math.min(width/1920,height/1080);
 if(Math.abs(scale-1)>.05&&scale>=.25&&scale<=3){
  const scaled=[0,32*scale].map(inset=>({x:0,y:(83*scale+inset)/height,width:Math.min(1,320*scale/width),height:21*scale/height})).filter(r=>r.y+r.height<=1);
  if(scale>1.4)regions.unshift(...scaled);else regions.push(...scaled);
 }
 const native=geometry?hudStrokeRegions(width,height,geometry).filter(r=>r.native).map(({scale,...r})=>({...r,y:r.y+scale/height,height:21*scale/height})):[];
 return [...native,...regions];
}
