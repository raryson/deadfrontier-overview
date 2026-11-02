import glyphs from './hud-glyphs.mjs';
import {parseHudXp} from '../../ocr-parser.js';
const byChar=new Map();for(const glyph of glyphs){const entries=byChar.get(glyph.c)??[];entries.push(glyph);byChar.set(glyph.c,entries);}

// Small stroke-contrast templates for the game's outlined numeric HUD. Only
// glyph-relative sample points are stored, never a player's screenshot/text.
// A complete LV/XP/target/percentage layout is required; other fonts fall back
// to the general OCR reader. All values still pass the normal temporal gate.
export function readHudStrokes(pixels,width,height){
 if(width<210||height<22||pixels.length!==width*height*4)return null;
 const gray=new Float32Array(width*height);for(let i=0;i<gray.length;i++)gray[i]=pixels[i*4]*.299+pixels[i*4+1]*.587+pixels[i*4+2]*.114;
 let offset=0;
 const score=(x,g)=>{let light=0,dark=0;for(const[dx,y]of g.pos)light+=gray[(y+offset)*width+x+dx]??0;for(const[dx,y]of g.neg)dark+=gray[(y+offset)*width+x+dx]??255;return light/g.pos.length-dark/g.neg.length;};
 const match=(c,lo,hi)=>{let best={s:-Infinity,x:0,c};for(let x=Math.max(2,Math.ceil(lo));x<=Math.min(width-10,Math.floor(hi));x++)for(const g of byChar.get(c)??[]){const s=score(x,g);if(s>best.s)best={s,x,c};}return best;};
 let prefix=null;for(const dy of [-1,0,1]){offset=dy;const L=match('L',7,15),V=match('V',L.x+6,L.x+10);if(L.s>=90&&V.s>=90&&(!prefix||L.s+V.s>prefix.L.s+prefix.V.s))prefix={L,V,dy};}
 if(!prefix)return null;offset=prefix.dy;
 const {L,V}=prefix,colon=match(':',V.x+10,V.x+42),slash=match('/',colon.x+15,colon.x+110),K=match('K',slash.x+15,slash.x+85),open=match('(',K.x+8,K.x+25),percent=match('%',open.x+6,open.x+30),close=match(')',percent.x+7,percent.x+15);
 if([colon,slash,K,open,percent,close].some(anchor=>anchor.s<90))return null;
 const number=(lo,hi,minCount,maxCount,maxEndGap)=>{
  const candidates=[];for(let x=Math.ceil(lo);x<hi-2;x++){let best={s:-Infinity};for(const c of '0123456789')for(const g of byChar.get(c)){const s=score(x,g);if(s>best.s)best={c,x,s};}if(best.s>=80)candidates.push(best);}
  const selected=[];for(const candidate of candidates.sort((a,b)=>b.s-a.s))if(!selected.some(other=>Math.abs(other.x-candidate.x)<6))selected.push(candidate);selected.sort((a,b)=>a.x-b.x);
  if(selected.length<minCount||selected.length>maxCount||selected[0].x-lo>8||hi-(selected.at(-1).x+6)>maxEndGap||selected.some((v,i)=>i&&v.x-selected[i-1].x>12))return null;
  return{text:selected.map(v=>v.c).join(''),quality:Math.min(...selected.map(v=>v.s))};
 };
 const unit=match('K',colon.x+15,slash.x-7),hasUnit=unit.s>=90&&slash.x-unit.x<=20;
 const level=number(V.x+8,colon.x,1,3,4),xp=number(colon.x+6,hasUnit?unit.x:slash.x-3,1,9,hasUnit?4:12),target=number(slash.x+9,K.x,1,7,4),percentage=number(open.x+3,percent.x,1,3,4);
 if(!level||!xp||!target||!percentage||Number(percentage.text)>100)return null;
 const text='LV '+level.text+': '+xp.text+(hasUnit?'K':'')+' / '+target.text+'K ('+percentage.text+'%)',sample=parseHudXp(text);
 if(!sample)return null;
 const quality=Math.min(level.quality,xp.quality,target.quality,percentage.quality,L.s,V.s,colon.s,slash.s,K.s);
 return{sample,text,confidence:Math.min(95,Math.max(65,Math.round(quality/2+30))),method:'hud-strokes'};
}
