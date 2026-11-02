// Crops are sampled independently from OCR. Session images are persisted by main.
export function frameIsBlack(pixels){let dark=0,total=0;for(let i=0;i<pixels.length;i+=4){total++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<30)dark++;}return total>0&&dark/total>.97;}
export function looksLikeLoot(pixels,width,height){
 // The panel is translucent: scenery can be bright or move behind its text.
 // Require its rectangular frame and at least one complete choice button.
 const line=(axis,pos,start,end)=>{let best=0;for(let offset=-2;offset<=2;offset++){let dark=0,total=0;for(let at=start;at<end;at+=2){const x=Math.round((axis==='h'?at:pos+offset)*width/350),y=Math.round((axis==='h'?pos+offset:at)*height/310),i=(y*width+x)*4;total++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<80)dark++;}best=Math.max(best,dark/total);}return best;};
 const edges=[line('h',15,32,327),line('h',234,32,327),line('v',25,22,228),line('v',334,22,228)];
 const outside=[line('h',8,32,327),line('h',241,32,327),line('v',18,22,228),line('v',341,22,228)];
 const button=(left,right)=>line('h',155,left+5,right-5)>.78&&line('h',194,left+5,right-5)>.78;
 if(edges.filter(value=>value>.43).length<3||edges.filter((value,i)=>value-outside[i]>.18).length<2||!button(46,145)&&!button(160,260))return false;
 const ratio=(x,y,w,h,threshold=135)=>{let bright=0,dark=0,n=0;for(let py=Math.floor(y*height);py<Math.min(height,(y+h)*height);py+=2)for(let px=Math.floor(x*width);px<Math.min(width,(x+w)*width);px+=2){const i=(py*width+px)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];n++;if(Math.min(r,g,b)>threshold&&Math.max(r,g,b)-Math.min(r,g,b)<55)bright++;if(Math.max(r,g,b)<110)dark++;}return{light:bright/n,dark:dark/n};};
 const title=ratio(110/350,10/310,130/350,22/310,80),prompt=ratio(35/350,30/310,280/350,65/310);
 return title.light>.012&&title.light<.5&&prompt.light>.008&&prompt.light<.45;
}
export function lootFingerprint(pixels,width=350){const out=[];for(let y=29;y<74;y+=2)for(let x=158;x<315;x+=2){const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];out.push(Math.min(r,g,b)>105&&Math.max(r,g,b)-Math.min(r,g,b)<60?1:0);}return Uint8Array.from(out);}
export function fingerprintDifference(a,b){if(!a||!b||a.length!==b.length)return 0;let union=0,diff=0;for(let i=0;i<a.length;i++){union+=a[i]||b[i]?1:0;diff+=a[i]!==b[i]?1:0;}return union<8?0:diff/union;}
export class LootSnapshotQueue{
 constructor({limit=64,id=()=>crypto.randomUUID()}={}){Object.assign(this,{limit,id});this.events=[];this.active=null;this.dropped=0;this.generation=0;}
 offer(canvas,at,present,fingerprint=null){
  if(!present){if(!this.active||at-this.active.lastSeenAt>100){this.active=null;this.change=null;}return null;}
  let first={canvas,at},event=this.active;
  if(event&&fingerprintDifference(event.fingerprint,fingerprint)>.25){
   if(!this.change||fingerprintDifference(this.change.fingerprint,fingerprint)>.1){this.change={canvas,at,fingerprint};return null;}
   if(at-this.change.at<50)return null;
   first=this.change;event=null;this.change=null;
  }else this.change=null;
  if(!event||at-event.lastSeenAt>250){
   event={id:this.id(),capturedAt:first.at,lastSeenAt:at,frames:[],taken:0,fingerprint};this.active=event;
   event.noOcr=this.events.length>=this.limit;if(event.noOcr)this.dropped++;
   this.created={eventId:event.id,capturedAt:first.at,frameAt:first.at,canvas:first.canvas,queued:!event.noOcr};
   if(!event.noOcr){event.frames.push({canvas:first.canvas,at:first.at});event.taken=1;event.lastTakenAt=first.at;this.events.push(event);}
  }
  event.lastSeenAt=at;
  if(!event.noOcr&&event.taken<5&&at-event.capturedAt>=[0,40,80,220,420][event.taken]){
   event.frames.push({canvas,at});event.lastTakenAt=at;event.taken++;
   if(!this.events.includes(event))this.events.push(event);
  }
  return event.id;
 }
 capture(frames,eventId){
  if(!frames.length)return false;
  let event=this.events.find(e=>e.id===eventId)??(this.active?.id===eventId?this.active:null);
  if(!event){event={id:eventId??this.id(),capturedAt:frames[0].at,lastSeenAt:frames.at(-1).at,frames:[],taken:3};this.created={eventId:event.id,capturedAt:event.capturedAt,frameAt:frames[0].at,canvas:frames[0].canvas,queued:this.events.length<this.limit,manual:true};}
  if(this.events.length>=this.limit&&!this.events.includes(event)){this.dropped++;return false;}
  event.manual=true;event.taken=5;event.noOcr=false;event.done=false;
  if(!this.active||this.active.id===event.id)this.active=event;
  for(const frame of frames.slice(-3))if(!event.frames.some(f=>f.at===frame.at)){event.frames.push(frame);while(event.frames.length>3)event.frames.shift();}
  if(!this.events.includes(event))this.events.push(event);return true;
 }
 next(){const event=this.events.shift();if(!event)return null;const frame=event.frames.shift();if(event.frames.length)this.events.push(event);return{...frame,generation:this.generation,manual:event.manual===true,eventId:event.id,capturedAt:event.capturedAt};}
 complete(id){this.events=this.events.filter(e=>e.id!==id);if(this.active?.id===id){this.active.done=true;this.active.frames=[];}}
 get size(){return this.events.reduce((n,e)=>n+e.frames.length,0);}
 clear(){this.events=[];this.active=null;this.change=null;this.created=null;this.generation++;}
}
