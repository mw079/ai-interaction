import test from 'node:test';import assert from 'node:assert/strict';
import {validComponents,validPageHelp} from '../public/component-catalog.js';import {explicitPageRewrite,textDifference,patchIsCurrent} from '../public/page-patch.js';import {handleAPI} from '../api.mjs';
const cycle={id:'learning-cycle',type:'cycle',title:'Learn by explaining',prompt:'',items:[{label:'Explain',detail:'Try simple words.',value:0},{label:'Find gaps',detail:'Notice what you cannot explain.',value:0}],edges:[]};
const req=(overrides={})=>new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{Authorization:'Bearer test-key-not-a-real-secret','Content-Type':'application/json'},body:JSON.stringify({text:'What does this mean? Explain it for high school.',target:{id:'intro',text:'Explain an idea simply, then find gaps.'},audience:'',format:'Auto',phase:'page-help',...overrides})});
test('catalog rejects executable props, duplicate ids, invalid relationships and oversized data',()=>{assert.equal(validComponents([cycle]),true);for(const invalid of [[{...cycle,onClick:'run code'}],[cycle,cycle],[{...cycle,type:'html'}],[{...cycle,id:'constructor'}],[{...cycle,items:cycle.items.map(i=>({...i,value:Infinity}))}],[{...cycle,type:'graph',edges:[{from:0,to:7,label:'bad'}]}]])assert.equal(validComponents(invalid),false);});
test('page instructions are kept separate from target text and route to Luna without proofreading',async()=>{let sent;const res=await handleAPI(req(),async(u,o)=>{sent=JSON.parse(o.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'It means testing your understanding by explaining.',replacement:'Explain the idea to a classmate. Look up any part you cannot explain, then try again.',components:[cycle]})}]}]});});assert.equal(res.status,200);assert.equal(sent.model,'gpt-6-luna');assert.equal(sent.reasoning.effort,'none');assert.ok(sent.instructions.includes('Do NOT proofread'));assert.ok(sent.instructions.includes('Start with the actual explanation'));assert.ok(sent.instructions.includes('Do NOT repeat, summarize or paraphrase the question'));const input=JSON.parse(sent.input);assert.ok(input.text.includes('What does this mean'));assert.equal(input.target.text,'Explain an idea simply, then find gaps.');const result=await res.json();assert.equal(result.preview.components[0].type,'cycle');assert.equal(result.preview.replacement.includes('What does this mean'),false);});
test('malformed page questions and untrusted components fail before they can change a page',async()=>{let called=false;const never=async()=>{called=true;throw Error();};assert.equal((await handleAPI(req({target:null}),never)).status,400);assert.equal((await handleAPI(req({target:{id:'x',text:'a'.repeat(2501)}}),never)).status,400);assert.equal(called,false);assert.equal(validPageHelp({answer:'Answer',replacement:'text',components:[{...cycle,type:'script'}]}),false);});
test('inline diff preserves original text and clearly identifies changed material',()=>{const d=textDifference('Learn by explaining clearly.','Learn by explaining simply.');assert.equal(d.prefix+d.removed+d.suffix,'Learn by explaining clearly.');assert.equal(d.prefix+d.added+d.suffix,'Learn by explaining simply.');assert.ok(d.removed);assert.ok(d.added);});
test('stale, edited or disconnected proposals cannot apply',()=>{const good={version:2,currentVersion:2,before:'Original',current:'Original',connected:true};assert.equal(patchIsCurrent(good),true);for(const change of [{currentVersion:3},{current:'User edit'},{connected:false}])assert.equal(patchIsCurrent({...good,...change}),false);});
test('diff boundaries never split emoji surrogate pairs',()=>{const d=textDifference('Try 😀 now.','Try 😃 now.');assert.equal(d.prefix,'Try ');assert.equal(d.removed,'😀');assert.equal(d.added,'😃');assert.equal(d.suffix,' now.');});
test('an invalid model component is rejected at the API boundary',async()=>{const res=await handleAPI(req(),async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Hello',replacement:'',components:[{...cycle,type:'html',html:'<script>bad</script>'}]})}]}]}));assert.equal(res.status,502);assert.equal((await res.json()).retryable,false);assert.equal(validComponents([{...cycle,id:undefined}]),false);});

test('slide suggestions are distinct catalog IDs with a maximum of three',async()=>{
 const {validSlideOptions}=await import('../public/component-catalog.js');
 assert.equal(validSlideOptions(['cycle','example','practice']),true);
 for(const invalid of [['cycle','cycle'],['fake'],['constructor'],['cycle','example','practice','timeline']])assert.equal(validSlideOptions(invalid),false);
});

test('Send follows the selected slide recipe and also works with automatic presentation',async()=>{
 const {demoPreview}=await import('../public/model.js');
 const page={...demoPreview('Feynman technique'),kind:'outline',components:[cycle],slideOptions:[]};
 const mock=preview=>async(_,options)=>{
  const sent=JSON.parse(options.body);
  if(JSON.parse(sent.input).slideChoice)assert.match(sent.instructions,/user selected cycle/);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(preview)}]}]});
 };
 const send=(choice)=>req({phase:'page',target:undefined,slideChoice:choice});
 assert.equal((await handleAPI(send('cycle'),mock(page))).status,200);
 const other={...page,components:[]};
 assert.equal((await handleAPI(send(),mock(other))).status,200);
 assert.equal((await handleAPI(send('cycle'),mock(other))).status,502);
 assert.equal((await handleAPI(send('fake'),()=>assert.fail('Invalid choice reached model'))).status,400);
});

test('new slide controls reject ambiguous inputs and map to their recipes',async()=>{
 const {slideRecipe,matchesSlideRecipe}=await import('../public/component-catalog.js');
 const block=(type,values,edges=[])=>({
  ...cycle,type,prompt:'What changes?',edges,
  items:cycle.items.map((item,index)=>({...item,value:values[index]}))
 });
 for(const [id,component] of [
  ['hotspots',block('hotspot_diagram',[0,0],[{from:0,to:1,label:'leads to'}])],
  ['parameter',block('parameter_explorer',[1,2])],
  ['prediction',block('prediction',[0,1])]
 ]){
  assert.equal(validComponents([component]),true);
  assert.equal(matchesSlideRecipe({kind:'outline',components:[component]},slideRecipe(id)),true);
 }
 for(const invalid of [
  block('hotspot_diagram',[0,0]),
  block('parameter_explorer',[2,1]),
  block('parameter_explorer',[2,2]),
  block('prediction',[0,0]),
  block('prediction',[1,1])
 ])assert.equal(validComponents([invalid]),false);
});

test('live slide edits keep the typed question separate from the passage and support quiet responses',async()=>{
 const added='why without boiling';
 const payload={text:added,target:{mode:'edit',id:'intro',text:'Water evaporates. '+added,added,removed:''}};
 const upstream=async(_,opts)=>{
  const sent=JSON.parse(opts.body);
  assert.match(sent.instructions,/infer intent from what changed/);
  assert.deepEqual(JSON.parse(sent.input).target,payload.target);
  return modelHelp({answer:'',replacement:'',components:[]});
 };
 const result=await handleAPI(req(payload),upstream);
 assert.equal(result.status,200);
 assert.deepEqual((await result.json()).preview.body,[]);
 assert.equal((await handleAPI(req({...payload,target:{...payload.target,added:'x'.repeat(1001)}}),()=>assert.fail())).status,400);
});

test('a plain prose addition can produce an inline replacement without a rewrite command',async()=>{
 const added='faster when windy, fresh air carries vapor away';
 const text='Puddles dry on cool days. '+added;
 const replacement='Puddles dry on cool days. Wind can speed evaporation by carrying moist air away from the surface.';
 const result=await handleAPI(req({text:added,target:{mode:'edit',id:'intro',text,added,removed:''}}),async(_,opts)=>{
  const sent=JSON.parse(opts.body);
  assert.match(sent.instructions,/propose an improvement without being asked to rewrite/);
  assert.match(sent.instructions,/retain unrelated wording/);
  assert.equal(JSON.parse(sent.input).target.text,text);
  return modelHelp({answer:'',replacement,components:[]});
 });
 assert.equal(result.status,200);
 assert.equal((await result.json()).preview.replacement,replacement);
});

test('highlighting sends the quote in context and cannot suggest a page change by itself',async()=>{
 const result=await handleAPI(req({text:'surface molecules',target:{mode:'selection',id:'intro',quote:'surface molecules',text:'Fast surface molecules can escape.'}}),
  async(_,opts)=>{
   assert.match(JSON.parse(opts.body).instructions,/explain the highlighted words in context/);
   return modelHelp({answer:'Molecules at the surface can escape into the air.',replacement:'Changed passage',components:[cycle]});
  });
 const {preview}=await result.json();
 assert.deepEqual(preview.body,['Molecules at the surface can escape into the air.']);
 assert.equal(preview.replacement,'');
 assert.deepEqual(preview.components,[]);
});

function modelHelp(value){
 return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
}

test('explicit rewrite instructions are distinguished from ordinary passage edits',()=>{
 const passage='Explain an idea in simple words.';
 const instruction='Replace this paragraph with an evaporation example.';
 const updated=instruction.replace('evaporation','orbit');
 assert.equal(explicitPageRewrite(textDifference(passage,passage+'\n\n'+instruction)),instruction);
 assert.equal(explicitPageRewrite(textDifference(passage+'\n\n'+instruction,passage+'\n\n'+updated)),updated);
 assert.equal(explicitPageRewrite(textDifference(passage,'Explain an idea simply.')),'');
});
