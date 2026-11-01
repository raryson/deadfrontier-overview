// Small, fixed-size crops only. No full-screen frames are retained or written.
export function frameIsBlack(pixels){let dark=0,total=0;for(let i=0;i<pixels.length;i+=4){total++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<30)dark++;}return total>0&&dark/total>.97;}
export function looksLikeLoot(pixels,width,height){
  const ratio=(x,y,w,h)=>{let bright=0,dark=0,n=0;for(let py=Math.floor(y*height);py<Math.min(height,(y+h)*height);py+=2)for(let px=Math.floor(x*width);px<Math.min(width,(x+w)*width);px+=2){const i=(py*width+px)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];n++;if(Math.min(r,g,b)>135&&Math.max(r,g,b)-Math.min(r,g,b)<55)bright++;if(Math.max(r,g,b)<110)dark++;}return{light:bright/n,dark:dark/n};};
  const title=ratio(110/350,10/310,130/350,22/310),prompt=ratio(35/350,30/310,280/350,65/310);
  return title.light>.018&&title.light<.5&&title.dark>.4&&prompt.light>.012&&prompt.light<.45&&prompt.dark>.4;
}
export class LootSnapshotQueue{
  constructor({limit=24,id=()=>crypto.randomUUID()}={}){Object.assign(this,{limit,id});this.events=[];this.active=null;this.dropped=0;this.generation=0;}
  offer(canvas,at,present){
    if(!present){if(this.active&&at-this.active.lastSeenAt>180)this.active=null;return null;}
    let event=this.active;
    if(!event||at-event.lastSeenAt>250){
      event={id:this.id(),capturedAt:at,lastSeenAt:at,frames:[],taken:0};this.active=event;
      if(this.events.length>=this.limit){this.dropped++;this.active=null;return null;}
      this.events.push(event);
    }
    event.lastSeenAt=at;
    if(event.taken<3&&(event.lastTakenAt==null||at-event.lastTakenAt>=80)){
      // Each canvas is owned by this queue; later captures never mutate it.
      event.frames.push({canvas,at});event.lastTakenAt=at;event.taken++;
      if(!this.events.includes(event))this.events.push(event);
    }
    return event.id;
  }
  next(){const event=this.events.find(e=>e.frames.length);if(!event)return null;const frame=event.frames.shift();if(!event.frames.length)this.events.splice(this.events.indexOf(event),1);return{...frame,generation:this.generation,eventId:event.id,capturedAt:event.capturedAt};}
  get size(){return this.events.reduce((n,e)=>n+e.frames.length,0);}
  clear(){this.events=[];this.active=null;this.generation++;}
}
