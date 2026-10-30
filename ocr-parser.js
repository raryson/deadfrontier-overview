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
export function parseHudXp(text) {
  const normalized=String(text).toUpperCase().replace(/[|]/g,'/').replace(/[：]/g,':');
  const match=/(?:L\.?[VY]|LEVEL)\s*\.?\s*(\d{1,3})\s*[:;]\s*([\d.,\s]+[KMB]?)\s*\/\s*([\d.,\s]+[KMB]?)/.exec(normalized);
  if(!match)return null;
  const level=Number(match[1]),current=hudNumber(match[2]),target=hudNumber(match[3]);
  if(!current||!target||level<1||level>415||target.value<=0)return null;
  return {xp:current.value,level,nextLevelXp:target.value,precision:current.precision,source:'ocr',totalXp:null,serverTime:null};
}
export function createOcrGate() {
  let accepted=null,pending=null;
  const same=(a,b)=>a&&b&&a.xp===b.xp&&a.level===b.level&&a.nextLevelXp===b.nextLevelXp;
  return {
    reset(){accepted=null;pending=null;},
    accept(sample,confidence,now=Date.now()) {
      if(!sample||!Number.isFinite(confidence)||confidence<60)return null;
      const priorPending=pending;
      const repeat=same(pending?.sample,sample)?pending.count+1:1;
      pending={sample,count:repeat,confidence};
      if(!accepted) {
        const consistent=priorPending&&confidence>=75&&priorPending.confidence>=75&&sample.level===priorPending.sample.level&&sample.nextLevelXp===priorPending.sample.nextLevelXp&&sample.xp>=priorPending.sample.xp&&sample.xp-priorPending.sample.xp<=Math.max(sample.nextLevelXp*0.08,sample.precision*10);
        if(repeat<2&&!consistent)return null;
      }
      else if(sample.level===accepted.sample.level && sample.nextLevelXp===accepted.sample.nextLevelXp) {
        const difference=sample.xp-accepted.sample.xp;
        if(difference<0 && Math.abs(difference)<2*Math.max(sample.precision,accepted.sample.precision))return null;
        const large=Math.abs(difference)>Math.max(sample.nextLevelXp*0.08,sample.precision*10)*Math.max(1,(now-accepted.at)/2000);
        if((difference<0||large) && repeat<2)return null;
      } else {
        // Threshold changes at the same level indicate an unstable crop/OCR read.
        if(sample.level===accepted.sample.level || Math.abs(sample.level-accepted.sample.level)>1)return null;
        if(repeat<2)return null;
      }
      accepted={sample,at:now};return {...sample};
    }
  };
}
