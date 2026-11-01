// Bounded, memory-only history of the game's central dialog. Never persisted.
export class LootFrames {
  constructor(limit=12){this.limit=limit;this.frames=[];}
  push(canvas,at){const frame={canvas,at};this.frames.push(frame);while(this.frames.length>this.limit)this.frames.shift();return frame;}
  before(at){return this.frames.findLast(frame=>frame.at<=at&&at-frame.at<=500)??null;}
  after(at){return this.frames.find(frame=>frame.at>=at&&frame.at-at<=750)??null;}
  clear(){this.frames=[];}
}
