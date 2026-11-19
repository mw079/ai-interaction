import {validPreview} from './model.js';

const workspaceKey='ai-interaction.workspace.v1';
const pageLimit=40;
export const historyLimit=40;
const sizeLimit=2_000_000;

// Page navigation is local state, never a model request. Values are isolated snapshots.
export class PageTimeline {
 constructor(){this.pages=[];this.index=-1;}
 get canBack(){return this.index>0;} get canForward(){return this.index+1<this.pages.length;}
 save(page){if(this.index>=0)this.pages[this.index]=structuredClone(page);}
 append(page){
  const displaced=this.pages.splice(this.index+1);
  this.pages.push(structuredClone(page));
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
  this.entries.splice(index,1);
  this.endBurst();
 }
 forget(key){
  this.entries=this.entries.filter(entry=>entry.key!==key);
  this.endBurst();
 }
}

function validPage(page){
 return !!page&&typeof page.title==='string'&&typeof page.text==='string'&&
  validPreview(page.component)&&Array.isArray(page.blocks)&&page.blocks.every(validPreview)&&
  (page.directEdits===undefined||(Array.isArray(page.directEdits)&&page.directEdits.length<=editLimit&&
   page.directEdits.every(entry=>entry&&typeof entry.key==='string'&&typeof entry.before==='string'&&typeof entry.after==='string')));
}

export function readWorkspace(storage){
 try{
  const raw=storage?.getItem(workspaceKey);
  if(!raw||raw.length>sizeLimit)return null;
  const saved=JSON.parse(raw);
  if(saved?.version!==1||!Array.isArray(saved.pages)||saved.pages.length>pageLimit||
    !Number.isInteger(saved.index)||saved.index<0||saved.index>=saved.pages.length||
    !saved.pages.every(validPage)||!Array.isArray(saved.history)||saved.history.length>historyLimit||
    !saved.history.every(page=>validPage(page)&&typeof page.label==='string'&&typeof page.time==='string'))return null;
  return saved;
 }catch{return null;}
}

export function writeWorkspace(storage,timeline,current,history){
 if(!storage||timeline.index<0||!current.component)return;
 const start=Math.max(0,Math.min(timeline.index-Math.floor(pageLimit/2),timeline.pages.length-pageLimit));
 const index=timeline.index-start;
 const pages=timeline.pages.slice(start,start+pageLimit);
 pages[index]=current;
 try{
  const saved=JSON.stringify({version:1,pages,index,history:history.filter(entry=>entry.component).slice(0,historyLimit)});
  if(saved.length<=sizeLimit)storage.setItem(workspaceKey,saved);
 }catch{/* Private browsing or a full store leaves the in-memory workspace usable. */}
}
