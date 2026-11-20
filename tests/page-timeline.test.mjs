import test from 'node:test';import assert from 'node:assert/strict';import {PageTimeline,DirectEditUndo,historyLimit} from '../public/page/timeline.js';
test('Back and Forward preserve edits, diagram controls and notes without overwriting another page',()=>{const t=new PageTimeline();assert.equal(t.move(-1,{}),null);t.append({title:'First',component:{edits:{orbit:{phase:.1}}},notes:'My note'});t.append({title:'Second',component:{edits:{}},notes:''});const first=t.move(-1,{title:'Second edited',component:{edits:{}},notes:'Second note'});first.component.edits.orbit.phase=.6;first.title='First edited';const second=t.move(1,first);assert.equal(second.title,'Second edited');assert.equal(second.notes,'Second note');assert.equal(t.move(-1,second).component.edits.orbit.phase,.6);assert.equal(t.canBack,false);assert.equal(t.canForward,true);});
test('a new page after going back follows normal history branching and snapshots are isolated',()=>{const t=new PageTimeline(),page={title:'A'};t.append(page);page.title='Mutated';t.append({title:'B'});assert.equal(t.move(-1,{title:'B'}).title,'A');t.append({title:'C'});assert.equal(t.canForward,false);assert.equal(t.pages.length,2);assert.equal(t.move(-1,{title:'C'}).title,'A');});
test('navigation bounds are harmless and do not erase the saved page',()=>{const t=new PageTimeline();t.append({title:'Only page',draft:'Keep'});assert.equal(t.move(-1,{title:'Dirty'}),null);assert.equal(t.move(1,{title:'Dirty'}),null);assert.equal(t.pages[0].title,'Only page');});

test('direct undo groups adjacent typing and skips edits superseded by later changes',()=>{
 const undo=new DirectEditUndo();
 undo.record('intro','A','Ab',100);
 undo.record('intro','Ab','Abc',320);
 undo.record('title','Title','New title',400);
 undo.record('intro','Abc','Another draft',2000);
 assert.deepEqual(undo.entries.map(({key,before,after})=>[key,before,after]),[
  ['intro','A','Abc'],['title','Title','New title'],['intro','Abc','Another draft']
 ]);
 const updated={intro:'New wording from Luna',title:'New title'};
 const latest=undo.latest(key=>updated[key]);
 assert.equal(latest.key,'title');
 undo.take(latest);
 assert.equal(undo.latest(key=>updated[key]),undefined);
});

test('append returns displaced pages so newer branches can be kept in History',()=>{
 const timeline=new PageTimeline();
 timeline.append({title:'First'});
 timeline.append({title:'Second'});
 timeline.append({title:'Third'});
 assert.equal(timeline.move(-2,{title:'Third edited'}).title,'First');
 const displaced=timeline.append({title:'First revised'});
 assert.deepEqual(displaced.map(page=>page.title),['Second','Third edited']);
 assert.equal(timeline.canForward,false);
});

test('the timeline keeps at most historyLimit versions and stays on the newest',()=>{
 const t=new PageTimeline();
 for(let i=0;i<historyLimit+5;i++)t.append({title:'Page '+i});
 assert.equal(t.pages.length,historyLimit);assert.equal(t.index,historyLimit-1);
 assert.equal(t.pages[0].title,'Page 5');assert.equal(t.canForward,false);
});
