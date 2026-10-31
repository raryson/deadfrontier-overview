// Pure screen interpretation. A disappearing dialog alone never means pickup.
export function lootRegion(width,height){const s=Math.min(width/1920,height/1080);return{x:(width/2-175*s)/width,y:(height/2-115*s)/height,width:350*s/width,height:310*s/height};}
export function parseLootDialog(text){
  const normalized=String(text).replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
  const match=/YOU\s+HAVE\s+FOU[MN]D\s+(?:(?:AN?|SOME)\s+)?(.{2,100}?)\s*[.!?,]?\s*WIL{1,2}\s+YOU\s+TAKE/i.exec(normalized);
  if(!match||!(/\bYES\b/i.test(normalized)&&/\b(?:NO|HO)\s*\(?[T7]/i.test(normalized)))return null;
  let item=match[1].replace(/[.!?,]+$/,'').trim();
  const cash=/^\$\s*(\d{1,3}(?:[ ,.]\d{3})*|\d+)\s*$/.exec(item);
  if(cash){const amount=Number(cash[1].replace(/[ ,.]/g,''));if(!Number.isSafeInteger(amount)||amount<=0)return null;return{item:'$'+new Intl.NumberFormat('en-US').format(amount),key:'cash:'+amount,cash:amount};}
  if(!/^[\p{L}\p{N}][\p{L}\p{N}\s'’+.,()/-]{1,99}$/u.test(item))return null;
  return{item,key:item.toUpperCase().replace(/[^\p{L}\p{N}]/gu,'')};
}
export function wordsOf(blocks){return(blocks??[]).flatMap(b=>(b.paragraphs??[]).flatMap(p=>(p.lines??[]).flatMap(l=>l.words??[])));}
export function lootButtons(blocks,region,imageWidth,imageHeight){
  const choices={};
  for(const word of wordsOf(blocks)){
    const action=/^YES\b/i.test(word.text)?'accepted':/^(?:NO|HO)(?:\b|\(?T)/i.test(word.text)?'rejected':/^USE\b/i.test(word.text)?'used':null;
    if(!action||!word.bbox)continue;
    const b=word.bbox;
    choices[action]={x:region.x+Math.max(0,b.x0-200)/imageWidth*region.width,y:region.y+Math.max(0,b.y0-45)/imageHeight*region.height,
      width:Math.min(imageWidth,b.x1+200)/imageWidth*region.width-Math.max(0,b.x0-200)/imageWidth*region.width,
      height:Math.min(imageHeight,b.y1+45)/imageHeight*region.height-Math.max(0,b.y0-45)/imageHeight*region.height};
  }
  return choices;
}
export function choiceAt(buttons,x,y){return Object.entries(buttons??{}).find(([,b])=>x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height)?.[0]??null;}
export function searchInProgress(text){return /\b(?:SEARCHING|LOOTING)\b|SEARCH\s+IN\s+PROGRESS/i.test(String(text));}
export class LootFlow {
  constructor(store){this.store=store;this.pending=null;this.candidate=null;this.absent=0;}
  observe(reading,sessionId,now=Date.now()){
    if(reading.kind==='searching'){this.searchingAt=now;if(this.pending?.choice)this.finish(now,true);return;}
    if(reading.kind==='unknown')return;
    if(reading.kind==='found'){
      const parsed=parseLootDialog(reading.text);
      if(!parsed||reading.confidence<55)return;
      this.absent=0;
      if(this.pending){
        if(this.pending.key===parsed.key){this.pending.lastSeenAt=now;this.pending.buttons=reading.buttons??{};this.candidate=null;if(!this.pending.sessionId&&sessionId){this.pending.sessionId=sessionId;this.store.saveLoot(this.pending);}}
        else if(this.pending.choice){
          const same=this.candidate?.key===parsed.key&&now-this.candidate.at<4000;
          this.candidate={...parsed,at:now,count:same?this.candidate.count+1:1};
          if(this.candidate.count>=2){this.finish(now,true);this.candidate={...parsed,at:now,count:1};}
        }
        return;
      }
      const same=this.candidate?.key===parsed.key&&now-this.candidate.at<4000;
      this.candidate={...parsed,at:now,count:same?this.candidate.count+1:1};
      if(this.candidate.count<2)return;
      this.pending={id:crypto.randomUUID(),sessionId:sessionId??null,...parsed,foundAt:now,lastSeenAt:now,status:'found',buttons:reading.buttons??{}};
      this.store.saveLoot(this.pending);
    }else if(reading.kind==='absent'){
      this.candidate=null;
      if(this.pending&&++this.absent>=3&&now-this.pending.lastSeenAt>=900)this.finish(now,true);
    }
  }
  choose(input,now=Date.now()){
    if(!this.pending||now-this.pending.lastSeenAt>3000)return false;
    const action=input.action==='click'?choiceAt(this.pending.buttons,input.x,input.y):input.action;
    if(!['accepted','rejected','used'].includes(action))return false;
    this.pending.choice=action;this.pending.choiceAt=now;this.store.saveLoot(this.pending);return true;
  }
  finish(now=Date.now(),disappeared=false){
    if(this.pending)this.store.saveLoot({...this.pending,status:disappeared&&this.pending.choice&&now-this.pending.choiceAt<=10000?this.pending.choice:'unconfirmed',endedAt:now});
    this.pending=null;this.candidate=null;this.absent=0;
  }
}
