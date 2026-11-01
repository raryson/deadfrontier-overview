// Pure screen interpretation. A disappearing dialog alone never means pickup.
export function lootRegion(width,height){const s=Math.min(width/1920,height/1080);return{x:(width/2-175*s)/width,y:(height/2-115*s)/height,width:350*s/width,height:310*s/height};}
export function parseLootItem(value){
  let item=String(value).replace(/\s+/g,' ').trim().replace(/[.!?,]+$/,'').trim();
  const cash=/^\$\s*(\d{1,3}(?:[ ,.]\d{3})*|\d+)\s*$/.exec(item);
  if(cash){const amount=Number(cash[1].replace(/[ ,.]/g,''));if(!Number.isSafeInteger(amount)||amount<=0)return null;return{item:'$'+new Intl.NumberFormat('en-US').format(amount),key:'cash:'+amount,cash:amount};}
  let quantity,unit,quantityUncertain=false;
  const stack=/^(.+?)\s*\(\s*([\d, ]+)\s*(ML|MILLILIT(?:ER|RE)S?|ROUNDS?|BULLETS?|SHELLS?|UNITS?)?\s*\)?$/i.exec(item);
  if(stack){quantity=Number(stack[2].replace(/[ ,]/g,''));if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1e9)return null;item=stack[1].trim();unit=/^GASOLINE$/i.test(item)||/^ML|^MILLIL/i.test(stack[3]??'')?'ml':/ROUND|BULLET|SHELL/i.test(stack[3]??'')?'round':undefined;}
  else {const uncertain=/^(.+?(?:BULLETS|SHELLS|GRENADES|AMMO|GASOLINE))\s*\(\s*[\dBOISZ, .]+\s*\)?$/i.exec(item);if(uncertain){item=uncertain[1];quantityUncertain=true;}}
  item=item.replace(/[\s(,;.!?]+$/,'').trim();
  if((item.match(/\(/g)??[]).length!==(item.match(/\)/g)??[]).length)return null;
  if(!/^[\p{L}\p{N}][\p{L}\p{N}\s'’+.,()/-]{1,99}$/u.test(item))return null;
  return{item,key:item.toUpperCase().replace(/[^\p{L}\p{N}]/gu,'')+(quantity?'#'+quantity:''),...(quantity?{quantity,...(unit?{unit}:{})}:{}),...(quantityUncertain?{quantityUncertain:true}:{})};
}
export function parseLootDialog(text){
  const normalized=String(text).replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
  const match=/YOU\s+HAVE\s+(?:FOU[MN]D|FOND|FORE)\s+(?:(?:AN?)\s+|S[O0][MR]E(?:\s+|\??(?=\d)))?(.{2,100}?)\s*[.!?,]?\s*WIL{1,2}\s+YOU\s+TAKE/i.exec(normalized);
  if(!match||!(/\bYES\b/i.test(normalized)&&/\b(?:NO|HO)(?:\b|\s*\(?[T7M])/i.test(normalized)))return null;
  return parseLootItem(match[1]);
}
export function wordsOf(blocks){return(blocks??[]).flatMap(b=>(b.paragraphs??[]).flatMap(p=>(p.lines??[]).flatMap(l=>l.words??[])));}
export function lootButtons(blocks,region,imageWidth,imageHeight){
  const choices={};
  for(const word of wordsOf(blocks)){
    const action=/^YES\b/i.test(word.text)?'accepted':/^(?:NO|HO)(?:\b|\(?[T7M])/i.test(word.text)?'rejected':/^USE\b/i.test(word.text)?'used':null;
    if(!action||!word.bbox)continue;
    const b=word.bbox;
    choices[action]={x:region.x+Math.max(0,b.x0-200)/imageWidth*region.width,y:region.y+Math.max(0,b.y0-45)/imageHeight*region.height,
      width:Math.min(imageWidth,b.x1+200)/imageWidth*region.width-Math.max(0,b.x0-200)/imageWidth*region.width,
      height:Math.min(imageHeight,b.y1+45)/imageHeight*region.height-Math.max(0,b.y0-45)/imageHeight*region.height};
  }
  return choices;
}
export function choiceAt(buttons,x,y){return Object.entries(buttons??{}).find(([,b])=>x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height)?.[0]??null;}
export function lootBindings(text){
  const bindings={E:'accepted',T:'rejected',C:'used'};
  for(const [label,action]of [['YES','accepted'],['NO','rejected'],['USE','used']]){
    const match=new RegExp('\\b'+label+'\\s*[([]\\s*([EFTC])\\s*[)\\]]','i').exec(String(text));
    if(match){for(const key of Object.keys(bindings))if(bindings[key]===action)delete bindings[key];bindings[match[1].toUpperCase()]=action;}
  }
  return bindings;
}
export function searchInProgress(text){return /\b(?:SEARCHING|LOOTING)\b|SEARCH\s+IN\s+PROGRESS/i.test(String(text));}
export function titleStillVisible(before,after,ratio=.65){
  if(!before||!after||before.length!==after.length)return null;
  let total=0,preserved=0;
  for(let i=0;i<before.length;i+=4){const r=before[i],g=before[i+1],b=before[i+2],light=r*.299+g*.587+b*.114;if(light<105||Math.max(r,g,b)-Math.min(r,g,b)>40)continue;total++;if(after[i]*.299+after[i+1]*.587+after[i+2]*.114>=light*.7)preserved++;}
  return total<20?null:preserved/total>=ratio;
}
export class LootFlow {
  constructor(store){this.store=store;this.pending=null;this.candidate=null;this.absent=0;this.hintAt=null;this.earlyInputs=[];this.boundary=false;this.handledInputs=new Set();}
  armed(now=Date.now()){return!!(this.pending||this.candidate||(this.hintAt!==null&&now-this.hintAt<4000)||(this.searchingAt!==undefined&&now-this.searchingAt<12000));}
  anticipate(now=Date.now()){if(this.pending)this.finish(now,true);this.searchingAt=now;}
  observeInput(reading,input,sessionId,now=Date.now()){
    if(!input?.id||!Number.isFinite(input.at)||now-input.at>10000||input.at>now+100||!Number.isFinite(reading.capturedAt)||input.at-reading.capturedAt<0||input.at-reading.capturedAt>500)return false;
    const dismissed=reading.inputDismissed===true&&Number.isFinite(reading.inputAfterAt)&&reading.inputAfterAt-input.at>=200&&reading.inputAfterAt-input.at<=5000&&reading.inputAfterAt<=now+100;
    if(this.handledInputs.has(input.id)){
      if(this.pending?.choiceInputId===input.id&&dismissed)this.finish(reading.inputAfterAt,true);
      return true;
    }
    const parsed=parseLootDialog(reading.text);
    if(!parsed||reading.confidence<75||(reading.nameConfidence??reading.confidence)<45)return false;
    if(this.lastCompleted?.item===parsed.item&&reading.capturedAt<=this.lastCompleted.endedAt)return false;
    if(reading.quantityVerified===false){delete parsed.quantity;parsed.key=parsed.item.toUpperCase().replace(/[^\p{L}\p{N}]/gu,'');parsed.quantityUncertain=true;}
    else if(reading.quantityVerified===true&&Number.isSafeInteger(reading.quantity)&&reading.quantity>0&&reading.quantity<=1e9){parsed.quantity=reading.quantity;parsed.key=parsed.item.toUpperCase().replace(/[^\p{L}\p{N}]/gu,'')+'#'+parsed.quantity;}
    const candidate={...parsed,buttons:reading.buttons??{},bindings:lootBindings(reading.text)};
    const action=input.action==='click'?choiceAt(candidate.buttons,input.x,input.y):input.action==='key'?candidate.bindings[input.key]:input.action;
    if(!['accepted','rejected','used'].includes(action))return false;
    if(this.pending?.choice&&this.pending.key!==parsed.key)this.finish(now,true);
    if(this.pending){Object.assign(this.pending,candidate,{lastSeenAt:now});}
    else this.pending={id:crypto.randomUUID(),sessionId:sessionId??null,...candidate,foundAt:reading.capturedAt,lastSeenAt:now,status:'found'};
    this.store.saveLoot(this.pending);
    this.choose({...input,action},now);
    if(dismissed)this.finish(reading.inputAfterAt,true);
    return true;
  }
  observeInputAbsence(reading,input,now=Date.now()){
    // Combat clicks can fill the input queue after a valid choice. Their
    // recent frames still prove dismissal, but never create a choice.
    const at=reading?.capturedAt;
    if(!this.pending?.choice||reading.kind!=='absent'||reading.dialogVisible!==false||!input?.id||!Number.isFinite(input.at)||!Number.isFinite(at)||at<this.pending.choiceAt||at>input.at||input.at-at>500||now-at<0||now-at>2000||at<=(this.lastInputAbsenceAt??-Infinity))return false;
    this.lastInputAbsenceAt=at;this.observe({kind:'absent'},null,now);return true;
  }
  observe(reading,sessionId,now=Date.now()){
    if(reading.kind==='visible'){
      if(this.pending&&!this.boundary&&reading.nameVisible===true)this.pending.lastSeenAt=now;
      return;
    }
    if(reading.kind==='hint'){this.hintAt=now;return;}
    if(reading.kind==='searching'){this.searchingAt=now;if(this.pending)this.finish(now,true);return;}
    if(reading.kind==='unknown')return;
    if(reading.kind==='found'){
      const parsed=parseLootDialog(reading.text);
      if(!parsed||reading.confidence<55)return;
      if(Number.isSafeInteger(reading.quantityCandidate)&&reading.quantityCandidate>0&&reading.quantityCandidate<=1e9){
        const previous=this.quantityCandidate,same=previous?.item===parsed.item&&previous?.quantity===reading.quantityCandidate&&now-previous.at<4000;
        this.quantityCandidate={item:parsed.item,quantity:reading.quantityCandidate,count:same?previous.count+1:1,at:now};
        if(this.quantityCandidate.count>=2)reading={...reading,quantityVerified:true,quantity:reading.quantityCandidate};
      }
      if(reading.quantityVerified===false){delete parsed.quantity;parsed.key=parsed.item.toUpperCase().replace(/[^\p{L}\p{N}]/gu,'');parsed.quantityUncertain=true;}
      else if(reading.quantityVerified===true&&Number.isSafeInteger(reading.quantity)&&reading.quantity>0&&reading.quantity<=1e9){parsed.quantity=reading.quantity;parsed.key=parsed.item.toUpperCase().replace(/[^\p{L}\p{N}]/gu,'')+'#'+parsed.quantity;}
      this.absent=0;
      if(this.pending){
        if(this.pending.item===parsed.item&&this.pending.quantityUncertain&&parsed.quantity){Object.assign(this.pending,{quantity:parsed.quantity,quantityUncertain:false,key:parsed.key});this.store.saveLoot(this.pending);}
        if(this.pending.item===parsed.item&&this.pending.quantity&&!parsed.quantity){parsed.quantity=this.pending.quantity;parsed.key=this.pending.key;}
        if(this.pending.key===parsed.key){this.boundary=false;this.pending.lastSeenAt=now;this.pending.buttons=reading.buttons??{};this.pending.bindings=lootBindings(reading.text);this.candidate=null;if(!this.pending.sessionId&&sessionId){this.pending.sessionId=sessionId;this.store.saveLoot(this.pending);}}
        else if(this.pending.choice||this.boundary){
          const same=this.candidate?.key===parsed.key&&now-this.candidate.at<4000;
          this.candidate={...parsed,at:now,count:same?this.candidate.count+1:1};
          if(this.candidate.count>=2){const candidate=this.candidate;this.finish(now,true);this.pending={id:crypto.randomUUID(),sessionId:sessionId??null,...candidate,foundAt:now,lastSeenAt:now,status:'found',buttons:reading.buttons??{}};delete this.pending.at;delete this.pending.count;this.store.saveLoot(this.pending);}
        }
        return;
      }
      const same=(this.candidate?.key===parsed.key||this.candidate?.item===parsed.item&&(this.candidate.quantityUncertain||parsed.quantityUncertain))&&now-this.candidate.at<4000;
      this.candidate={...parsed,at:now,count:same?this.candidate.count+1:1};
      if(this.candidate.count<2&&!(reading.verifiedHeader===true&&reading.confidence>=80&&(reading.nameConfidence??reading.confidence)>=75))return;
      this.pending={id:crypto.randomUUID(),sessionId:sessionId??null,...parsed,foundAt:now,lastSeenAt:now,status:'found',buttons:reading.buttons??{},bindings:lootBindings(reading.text)};
      this.store.saveLoot(this.pending);
      for(const input of this.earlyInputs.filter(e=>now-e.at<=4000))this.choose(input,input.at);
      this.earlyInputs=[];
    }else if(reading.kind==='absent'){
      this.boundary=true;
      this.candidate=null;
      if(this.pending&&++this.absent>=3&&now-this.pending.lastSeenAt>=900)this.finish(now,true);
    }
  }
  choose(input,now=Date.now()){
    if(!this.pending){if(!input.id&&this.hintAt!==null&&now-this.hintAt<4000)this.earlyInputs=[...this.earlyInputs,{...input,at:now}].slice(-8);return false;}
    if(now-this.pending.lastSeenAt>4000)return false;
    const action=input.action==='click'?choiceAt(this.pending.buttons,input.x,input.y):input.action==='key'?(this.pending.bindings??{E:'accepted',T:'rejected',C:'used'})[input.key]:input.action;
    if(!['accepted','rejected','used'].includes(action))return false;
    this.pending.choice=action;this.pending.choiceAt=input.at??now;
    if(input.id){this.pending.choiceInputId=input.id;this.handledInputs.add(input.id);if(this.handledInputs.size>128)this.handledInputs.delete(this.handledInputs.values().next().value);}
    this.store.saveLoot(this.pending);return true;
  }
  finish(now=Date.now(),disappeared=false){
    if(this.pending){const status=disappeared&&this.pending.choice&&now-this.pending.choiceAt<=10000?this.pending.choice:'unconfirmed';this.store.saveLoot({...this.pending,status,endedAt:now});if(status!=='unconfirmed')this.lastCompleted={key:this.pending.key,item:this.pending.item,endedAt:now};}
    this.pending=null;this.candidate=null;this.absent=0;this.hintAt=null;this.earlyInputs=[];this.quantityCandidate=null;this.boundary=false;this.lastInputAbsenceAt=null;
  }
}
