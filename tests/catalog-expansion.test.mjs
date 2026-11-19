import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPONENT_TYPES,SLIDE_RECIPES,validComponents} from '../public/components/catalog.js';
import {CONTROL_FAMILIES} from '../public/composer/intent.js';
import {applyFollowUpScope,followUpScopes} from '../public/composer/controls-extended.js';
import {handleAPI} from '../api.mjs';

test('all twenty-six slide components have a selection recipe',()=>{
  const types=Object.values(SLIDE_RECIPES).flatMap(recipe=>recipe.blocks??[]);
  assert.equal(COMPONENT_TYPES.length+Object.values(SLIDE_RECIPES).filter(recipe=>recipe.kind).length,26);
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

test('every gallery example is valid model output for its component',async()=>{
 const {SPECIMENS}=await import('../dev/component-fixtures.js');
 const {validComponents,COMPONENT_TYPES}=await import('../public/components/catalog.js');
 for(const {name,block} of SPECIMENS)assert.ok(validComponents([block]),name+' should pass validation');
 const covered=new Set(SPECIMENS.map(s=>s.block.type));
 assert.deepEqual(COMPONENT_TYPES.filter(type=>!covered.has(type)),[],'every component type has a gallery example');
});

test('page scoring flags repetition, long text and missing follow-ups',async()=>{
 const {scorePage}=await import('../dev/eval-pages.mjs');
 const step=(label,detail)=>({label,detail,value:0,latitude:null,longitude:null});
 const good={kind:'outline',body:['Vaccines teach the immune system to recognise a germ.','Safety: They train immunity without causing the disease.'],
  components:[{id:'v',type:'timeline',title:'Steps',prompt:'',edges:[],items:[step('Target shown','The vaccine shows a harmless antigen to immune cells.'),step('Memory forms','Long-lived memory cells remain after the response.')]}],
  followUps:['Why do boosters fade?','Are side effects common?']};
 assert.equal(scorePage(good,{fitsFirstScreen:true}).passed,7);
 const repeated={...good,body:[good.body[0],'Memory: Long-lived memory cells remain after the immune response.'],followUps:[]};
 const failed=Object.entries(scorePage(repeated,{fitsFirstScreen:false}).checks).filter(([,ok])=>!ok).map(([name])=>name);
 assert.deepEqual(failed,['fits first screen','no repeated content','2–3 Go deeper questions']);
 assert.equal(scorePage({kind:'outline',body:['Hi team, thank you for all the work on the launch. It came together because of each of you. Enjoy the weekend!'],components:[]},{textFirst:true}).passed,2);
});
