export const historyLimit=40;

// Page navigation is local state, never a model request. Values are isolated snapshots.
export class PageTimeline {
 constructor(){this.pages=[];this.index=-1;}
 get canBack(){return this.index>0;} get canForward(){return this.index+1<this.pages.length;}
 save(page){if(this.index>=0)this.pages[this.index]=structuredClone(page);}
 append(page){
  const displaced=this.pages.splice(this.index+1);
  this.pages.push(structuredClone(page));
  // Keep at most historyLimit versions in memory, like History: the oldest goes first.
  if(this.pages.length>historyLimit)this.pages.shift();
  this.index=this.pages.length-1;
  return displaced;
 }
 move(delta,current){const next=this.index+delta;if(next<0||next>=this.pages.length)return null;this.save(current);this.index=next;return structuredClone(this.pages[next]);}
}

const editLimit=24;
export class DirectEditUndo{
 constructor(entries=[]){this.entries=entries.slice(-editLimit);this.endBurst();}
 endBurst(){this.lastEditAt=-Infinity;}
 record(key,before,after,now){
  if(before===after)return;
  const previous=this.entries.at(-1);
  if(previous?.key===key&&previous.after===before&&now-this.lastEditAt<=900){
   previous.after=after;
   if(previous.before===after)this.entries.pop();
  }else{
   this.entries.push({key,before,after});
   if(this.entries.length>editLimit)this.entries.shift();
  }
  this.lastEditAt=now;
 }
 latest(valueFor){return this.entries.findLast(entry=>valueFor(entry.key)===entry.after);}
 take(entry){
  const index=this.entries.indexOf(entry);
  if(index>=0)this.entries.splice(index,1);
  this.endBurst();
 }
 forget(key){
  this.entries=this.entries.filter(entry=>entry.key!==key);
  this.endBurst();
 }
}
