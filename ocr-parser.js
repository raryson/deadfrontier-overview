export function defaultHudRegion(width,height) {
  return {x:0,y:Math.min(80/height,0.8),width:Math.min(360/width,1),height:Math.min(28/height,0.2)};
}
function hudNumber(text) {
  const match=/^([\d.,\s]+)\s*([KMB]?)$/i.exec(text.trim());
  if(!match)return null;
  let digits=match[1].replace(/\s/g,'');
  const unit=({K:1000,M:1000000,B:1000000000})[match[2].toUpperCase()]??1;
  // The game groups thousands as 4,568K; OCR may read the comma as a dot.
  if(/^\d{1,3}(?:[.,]\d{3})+$/.test(digits)) digits=digits.replace(/[.,]/g,'');
  else if((digits.match(/[.,]/g)??[]).length<=1) digits=digits.replace(',','.');
  else return null;
  const value=Number(digits)*unit;
  if(!Number.isSafeInteger(value)||value<0)return null;
  const decimals=(digits.split('.')[1]??'').length;
  return {value,precision:Math.max(1,unit/(10**decimals))};
}
export function parseHudXp(text,{previous=null}={}) {
  const normalized=String(text).toUpperCase().replace(/[|]/g,'/').replace(/[：]/g,':')
    // The HUD's narrow slash is sometimes recognized as an isolated 7.
    // Restrict the repair to a separator after an explicit XP unit.
    .replace(/([KMB])\s+7[.,]?\s+(?=\d)/g,'$1 / ');
  const match=/(?:L\.?[VY]|LEVEL)\s*\.?\s*(\d{1,3})\s*[:;]\s*([\d.,\s]+[KMB]?)\s*\/\s*([\d.,\s]+[KMB]?)/.exec(normalized);
  if(!match)return null;
  const level=Number(match[1]),current=hudNumber(match[2]),target=hudNumber(match[3]);
  if(!current||!target||level<1||level>415||target.value<=0)return null;
  // A dropped K/M suffix turns millions into thousands and creates false deaths.
  const currentUnit=/[KMB]\s*$/.exec(match[2]),targetUnit=/[KMB]\s*$/.exec(match[3]);
  const percent=/^\s*\(\s*(\d{1,3})\s*%/.exec(normalized.slice(match.index+match[0].length));
  let shown=percent?Number(percent[1]):NaN;
  // The closing HUD parenthesis can be appended as 7 before %. Repair only
  // an impossible percentage with that exact suffix, checked against XP/target.
  if(shown>100&&percent[1].endsWith('7')){
    const repaired=Number(percent[1].slice(0,-1));
    if(repaired<=100&&Math.abs(current.value/target.value*100-repaired)<=1.1)shown=repaired;
  }
  if(targetUnit&&!currentUnit&&current.value!==0){
    // Exact XP can appear against an abbreviated target. Use the percentage,
    // an impossible scaled interpretation, or a close prior exact read.
    // Tiny zero-percent values cover the start of a level.
    const multiplier=({K:1000,M:1000000,B:1000000000})[targetUnit[0].trim()];
    const ratio=current.value/target.value*100;
    const visible=Number.isFinite(shown)&&shown<=100;
    const tinyExact=visible&&shown===0&&current.value<1000;
    const contextExact=previous?.level===level&&previous.precision===1&&current.value>=previous.xp&&current.value-previous.xp<=10000;
    const unambiguous=current.value<=target.value&&current.value*multiplier>target.value;
    if(visible){if(Math.abs(ratio-shown)>1.1||!tinyExact&&Math.abs(ratio*multiplier-shown)<=1.1)return null;}
    else if(percent||!unambiguous&&!contextExact)return null;
  }
  // OCR often reads the closing parenthesis as a 7 (40% -> 407%). Such an
  // impossible percentage is not evidence against otherwise valid XP tokens.
  if(Number.isFinite(shown)&&shown<=100&&Math.abs(current.value/target.value*100-shown)>2)return null;
  return {xp:current.value,level,nextLevelXp:target.value,precision:current.precision,source:'ocr',totalXp:null,serverTime:null};
}
export function createOcrGate() {
  let accepted=null,pending=null;
  const same=(a,b)=>a&&b&&a.xp===b.xp&&a.level===b.level&&a.nextLevelXp===b.nextLevelXp;
  return {
    reset(){accepted=null;pending=null;},
    accept(sample,confidence,now=Date.now()) {
      if(!sample||!Number.isFinite(confidence)||confidence<60){pending=null;return null;}
      const priorPending=pending;
      const repeat=same(pending?.sample,sample)?pending.count+1:1;
      const coherent=priorPending&&now-priorPending.at<=10000&&sample.level===priorPending.sample.level&&sample.nextLevelXp===priorPending.sample.nextLevelXp&&sample.xp>=priorPending.sample.xp&&sample.xp-priorPending.sample.xp<=Math.max(sample.nextLevelXp*0.08,sample.precision*10);
      const consistent=coherent&&confidence>=75&&priorPending.confidence>=75;
      const exactSequence=coherent&&sample.precision===1&&priorPending.sample.precision===1&&confidence>=60&&priorPending.confidence>=60;
      const sequence=consistent||exactSequence?priorPending.sequence+1:repeat;
      pending={sample,count:repeat,sequence,confidence,at:now};
      let rebase=false;
      if(!accepted) {
        if(repeat<2&&!consistent&&!(exactSequence&&sequence>=3))return null;
      }
      else if(sample.level===accepted.sample.level && sample.nextLevelXp===accepted.sample.nextLevelXp) {
        const difference=sample.xp-accepted.sample.xp;
        if(difference<0 && Math.abs(difference)<2*Math.max(sample.precision,accepted.sample.precision))return null;
        const large=Math.abs(difference)>Math.max(sample.nextLevelXp*0.08,sample.precision*10)*Math.max(1,(now-accepted.at)/2000);
        if((difference<0||large) && repeat<2&&sequence<3)return null;
      } else {
        if(Math.abs(sample.level-accepted.sample.level)>1)return null;
        if(sample.level===accepted.sample.level){
          // Recover from a bad denominator without inventing XP at that boundary.
          if(sequence<3||confidence<75)return null;
          rebase=true;
        }else if(repeat<2&&!consistent)return null;
      }
      accepted={sample,at:now};return {...sample,...(rebase?{rebase:true}:{})};
    }
  };
}
