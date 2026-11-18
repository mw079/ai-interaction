import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPONENT_TYPES,SLIDE_RECIPES,validComponents} from '../public/component-catalog.js';
import {CONTROL_FAMILIES} from '../public/intent.js';
import {applyFollowUpScope,followUpScopes} from '../public/composer-extensions.js';
import {handleAPI} from '../api.mjs';

test('the twenty slide components have a selection recipe',()=>{
  const types=Object.values(SLIDE_RECIPES).flatMap(recipe=>recipe.blocks??[]);
  assert.equal(COMPONENT_TYPES.length+Object.values(SLIDE_RECIPES).filter(recipe=>recipe.kind).length,20);
  assert.deepEqual(new Set(types),new Set(COMPONENT_TYPES));
  assert.equal(CONTROL_FAMILIES.length,16); // Slide picker and three composer context controls are separate.
});

test('invalid trees, coordinates, and executable function expressions are rejected',()=>{
  const items=[{label:'One',detail:'First',value:0},{label:'Two',detail:'Second',value:1}];
  const block={id:'test',type:'decision_tree',title:'Test',prompt:'',items,edges:[{from:0,to:1,label:'Continue'}]};
  assert.equal(validComponents([block]),true);
  assert.equal(validComponents([{...block,edges:[{from:0,to:0,label:'Loop'}]}]),false);
  assert.equal(validComponents([{...block,type:'map',items:items.map(item=>({...item,latitude:95,longitude:10}))}]),false);
  assert.equal(validComponents([{...block,type:'function_plot',prompt:'fetch()'}]),false);
  assert.equal(validComponents([{...block,type:'linked_scenarios',prompt:'Input'}]),false);
});

test('focused follow-ups replace only the chosen excerpt or component',()=>{
  const original={body:['The old phrase stays.','Other text'],edits:{},components:[{id:'cycle',title:'Cycle'}]};
  const scope=followUpScopes(original,'passage:0',{length:10,start:4,end:14})[1];
  assert.equal(scope.text,'old phrase');
  const edited=applyFollowUpScope(original,{body:['new phrase']},scope);
  assert.equal(edited.edits.explanation,'The new phrase stays.');
  assert.deepEqual(edited.body,original.body);
  assert.deepEqual(original.edits,{});
  assert.throws(()=>applyFollowUpScope(original,{components:[{id:'different'}]},{id:'block:cycle'}));
  const withBlock=applyFollowUpScope(original,{components:[{id:'cycle',title:'Updated cycle'}]},{id:'block:cycle'});
  assert.equal(withBlock.components[0].title,'Updated cycle');
  assert.deepEqual(withBlock.body,original.body);
});

test('files are unsupported for both drafts and explicit Send',async()=>{
  for(const phase of ['preview','page']){
    const request=new Request('http://127.0.0.1/api/preview',{
      method:'POST',headers:{Authorization:'Bearer test-key-not-real','Content-Type':'application/json'},
      body:JSON.stringify({phase,text:'Preview',format:'Auto',audience:'',sources:[{name:'text.txt',text:'Example source'}]})
    });
    const response=await handleAPI(request,()=>assert.fail('The file must stay out of the model request'));
    assert.equal(response.status,400);
    assert.match((await response.json()).error,/File attachments are unsupported/);
  }
});
