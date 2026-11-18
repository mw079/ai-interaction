// Page navigation is local state, never a model request. Values are isolated snapshots.
export class PageTimeline {
 constructor(){this.pages=[];this.index=-1;}
 get canBack(){return this.index>0;} get canForward(){return this.index+1<this.pages.length;}
 save(page){if(this.index>=0)this.pages[this.index]=structuredClone(page);}
 append(page){this.pages=this.pages.slice(0,this.index+1);this.pages.push(structuredClone(page));this.index=this.pages.length-1;}
 move(delta,current){const next=this.index+delta;if(next<0||next>=this.pages.length)return null;this.save(current);this.index=next;return structuredClone(this.pages[next]);}
}
