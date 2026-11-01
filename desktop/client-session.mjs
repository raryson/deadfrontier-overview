// Session ownership follows a client execution, independently of capture windows.
export function sameClient(a,b){return!!a&&!!b&&Number.isSafeInteger(a.processId)&&a.processId>0&&a.processId===b.processId&&(!a.processStartedAt||!b.processStartedAt||a.processStartedAt===b.processStartedAt);}
export class ClientSession {
 constructor(tracker){this.tracker=tracker;this.client=null;}
 attach(window,now=Date.now()){
  if(sameClient(this.client,window))return false;
  const client={processId:window.processId,processStartedAt:window.processStartedAt??null};
  this.tracker.attach(client,now);this.client=client;return true;
 }
 matches(window){return sameClient(this.client,window);}
 observe(clients,now=Date.now()){
  if(!this.client||clients.some(client=>this.matches(client)))return false;
  this.finish('gameClosed',now);return true;
 }
 finish(reason,now=Date.now()){this.tracker.finish(reason,now);this.client=null;}
}
