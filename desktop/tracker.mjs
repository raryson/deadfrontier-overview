import {recordExperience,startExperience,stopExperience,setExperienceMultiplier,rememberExperience,experienceStats} from '../experience.js';

export class DesktopTracker {
  constructor(store){
    this.store=store;
    this.settings={autoTrack:true,overlay:true,saveLootImages:true,multiplier:null,processName:'',preferredTitle:'',region:null,...store.get('settings',{})};
    this.experience=store.get('experience',null);
    this.pendingStart=true;
    if(this.experience?.session?.running)this.finish('appClosed',this.experience.latest?.receivedAt??Date.now());
  }
  persist(reason,now=Date.now()){
    const entry=rememberExperience([],this.experience,now,reason)[0];
    this.store.save(this.experience,entry,this.settings);
  }
  attach(client=null,now=Date.now()){this.finish('gameChanged',now);this.client=client;this.experience={multiplier:this.settings.multiplier,latest:null,session:null};this.pendingStart=true;this.persist();}
  sample(sample,now=Date.now()){
    this.experience=recordExperience(this.experience,{...sample,account:'1',source:'ocr',totalXp:null,serverTime:null},now);
    if(this.pendingStart){this.experience=startExperience(this.experience,now);if(this.client)this.experience.session.client={...this.client};this.pendingStart=false;}
    this.persist(undefined,now);
  }
  finish(reason='stopped',now=Date.now()){
    this.experience=stopExperience(this.experience,now);this.pendingStart=false;this.persist(reason,now);
  }
  reset(){this.finish('reset');this.experience={multiplier:this.settings.multiplier,latest:null,session:null};this.pendingStart=true;this.persist();}
  setMultiplier(multiplier){const updated=setExperienceMultiplier(this.experience,multiplier);this.settings.multiplier=multiplier;this.experience=updated;this.persist();}
  snapshot(){return{experience:this.experience,stats:experienceStats(this.experience),settings:this.settings,history:this.store.history(),sessionCount:this.store.count()};}
}
