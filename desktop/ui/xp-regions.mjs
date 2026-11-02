import {defaultHudRegion} from '../../ocr-parser.js';

export function hudReadRegions(width,height,saved=null){
 if(saved)return[saved];
 const base=defaultHudRegion(width,height);
 const fit=(area,offset,pixelsWide,pixelsHigh)=>{const h=Math.min(area.height,pixelsHigh/height);return{...area,y:Math.min(1-h,area.y+offset/height),width:Math.min(area.width,pixelsWide/width),height:h};};
 // Exclude scenery around and to the right of the short raw-XP line.
 // Coarse regions remain available for longer text and a window title bar.
 const variants=area=>[fit(area,5,220,17),fit(area,3,280,21),area];
 const regions=variants(base);
 if(base.y*height<85)regions.push(...variants({...base,y:Math.min(112/height,1-base.height)}));
 return regions;
}
