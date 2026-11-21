import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPONENT_TYPES,SLIDE_RECIPES,validComponents,normaliseComponents} from '../public/components/catalog.js';
import {CONTROL_FAMILIES} from '../public/composer/intent.js';
import {applyFollowUpScope,followUpScopes} from '../public/composer/controls-extended.js';
import {handleAPI} from './helpers.mjs';

test('all twenty-six slide components have a selection recipe',()=>{
  const types=Object.values(SLIDE_RECIPES).flatMap(recipe=>recipe.blocks??[]);
  assert.equal(COMPONENT_TYPES.length+Object.values(SLIDE_RECIPES).filter(recipe=>recipe.kind).length,26);
  assert.deepEqual(new Set(types),new Set(COMPONENT_TYPES));
  assert.equal(CONTROL_FAMILIES.length,14); // Slide picker and three composer context controls are separate.
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
 assert.equal(scorePage(good,{fitsFirstScreen:true}).passed,8);
 const trip={...good,kind:"planner",components:[]};const tripScore=scorePage(trip,{fitsFirstScreen:true,expect:{uses:["map"],route:true,noForm:true}});
 assert.equal(tripScore.checks["shows the plan, not a form"],false);assert.equal(tripScore.checks["uses map"],false);assert.equal(tripScore.checks["map is a route"],false);
 const repeated={...good,body:[good.body[0],'Memory: Long-lived memory cells remain after the immune response.'],followUps:[]};
 const failed=Object.entries(scorePage(repeated,{fitsFirstScreen:false}).checks).filter(([,ok])=>!ok).map(([name])=>name);
 assert.deepEqual(failed,['fits first screen','no repeated content','2–3 Go deeper questions']);
 assert.equal(scorePage({kind:'outline',body:['Hi team, thank you for all the work on the launch. It came together because of each of you. Enjoy the weekend!'],components:[]},{textFirst:true}).passed,2);
});

test('a decorated function name is reduced to the supported one, an ambiguous one is not',()=>{
  const plot=prompt=>({id:'curve',type:'function_plot',title:'Curve',prompt,items:[{label:'From',detail:'',value:-6},{label:'To',detail:'',value:6}],edges:[]});
  const [sine,square,both,code]=normaliseComponents([plot('sine (radians)'),plot('Quadratic function'),plot('sine or cube'),plot('fetch()')]);
  assert.equal(sine.prompt,'sine');
  assert.equal(square.prompt,'square');
  assert.equal(both.prompt,'sine or cube');
  assert.equal(validComponents([sine]),true);
  assert.equal(validComponents([both]),false);
  assert.equal(validComponents([code]),false);
});

test('every component and every picker type has guidance and an example in its prompt',async()=>{
 const {CATALOG_INSTRUCTIONS:c,COMPONENT_TYPES}=await import('../public/components/catalog.js');
 const {modelInstructions}=await import('../prompts.mjs');
 const {INFORMATION_TYPES}=await import('../public/composer/intent.js');
 const named=(t,text)=>new RegExp('\\b'+t+'\\b').test(text);
 const guide=c.slice(c.indexOf('CHOOSE BY'),c.indexOf('EXAMPLES')),examples=c.slice(c.indexOf('EXAMPLES'),c.indexOf('BLOCK FORMAT'));
 for(const type of COMPONENT_TYPES){assert.ok(named(type,guide),type+' has no when-to-use line');assert.ok(named(type,examples),type+' has no example');}
 const live=modelInstructions({phase:'preview'},'','');
 const types=live.slice(live.indexOf('Pick the type that fits'));
 for(const type of Object.keys(INFORMATION_TYPES))assert.match(types,new RegExp('\\b'+type+'\\b[^;]*“'),type+' has no example phrase');
});

test('the journey check scores each stage and flags what went wrong',async()=>{
 const {scoreJourney,JOURNEYS}=await import('../dev/eval-journeys.mjs');
 assert.equal(JOURNEYS.length,20);assert.equal(new Set(JOURNEYS.map(([id])=>id)).size,20);
 const good={errors:[],typing:{answer:'Short answer.',highlights:[{type:'Place or area',phrase:'Lisbon'}],tab:' with my parents.'},picker:{options:['A','B','C'],ownEntry:true},
  titleSeconds:2,pageSeconds:9,views:['map: Route','timeline: Days'],followTyping:{preview:'Will add a rainy day.'},followStatus:'Adding a rainy day…',
  after:{views:['map: Route','timeline: Days','timeline: Rainy day'],proposal:false,error:false},deeper:{answer:'A long enough answer about the aquarium and how to get there.'}};
 assert.ok(Object.values(scoreJourney(good)).every(Boolean));
 const bad=scoreJourney({...good,typing:{...good.typing,highlights:[{type:'Audience',phrase:'How do I'}],tab:' Share the SQL.'},after:{views:['comparison: One'],proposal:false,error:false}});
 assert.equal(bad['highlights are short details'],false);assert.equal(bad['Tab never asks for something'],false);assert.equal(bad['follow-up keeps the page'],false);
 assert.deepEqual(scoreJourney({failure:'timeout'}),{'journey completed':false});
});

test('the focus picker names a takeaway by its label, also after the takeaway was edited',async()=>{
 const {followUpScopes}=await import('../public/composer/controls-extended.js');
 const page={body:['Intro.','Safety: They train immunity.','Plain second passage.'],components:[],edits:{paragraphs:{0:'They train immunity without disease.'}}};
 assert.deepEqual(followUpScopes(page).map(s=>s.label),['Whole slide'.replace('slide','page'),'Introduction','Safety','Paragraph 3']);
});
