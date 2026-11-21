import test from 'node:test';import assert from 'node:assert/strict';
import {validComponents,validPageHelp} from '../public/components/catalog.js';import {explicitPageQuestion,explicitPageRewrite,textDifference,patchIsCurrent} from '../public/page/patch.js';import {handleAPI} from './helpers.mjs';
const cycle={id:'learning-cycle',type:'cycle',title:'Learn by explaining',prompt:'',items:[{label:'Explain',detail:'Try simple words.',value:0},{label:'Find gaps',detail:'Notice what you cannot explain.',value:0}],edges:[]};
const req=(overrides={})=>new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{Authorization:'Bearer test-key-not-a-real-secret','Content-Type':'application/json'},body:JSON.stringify({text:'What does this mean? Explain it for high school.',target:{id:'intro',text:'Explain an idea simply, then find gaps.'},audience:'',format:'Auto',phase:'page-help',...overrides})});
test('catalog rejects executable props, duplicate ids, invalid relationships and oversized data',()=>{assert.equal(validComponents([cycle]),true);for(const invalid of [[{...cycle,onClick:'run code'}],[cycle,cycle],[{...cycle,type:'html'}],[{...cycle,id:'constructor'}],[{...cycle,items:cycle.items.map(i=>({...i,value:Infinity}))}],[{...cycle,type:'graph',edges:[{from:0,to:7,label:'bad'}]}]])assert.equal(validComponents(invalid),false);});
test('page instructions are kept separate from target text and route to Luna without proofreading',async()=>{let sent;const res=await handleAPI(req(),async(u,o)=>{sent=JSON.parse(o.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'It means testing your understanding by explaining.',replacement:'Explain the idea to a classmate. Look up any part you cannot explain, then try again.',components:[cycle]})}]}]});});assert.equal(res.status,200);assert.equal(sent.model,'gpt-6-luna');assert.equal(sent.reasoning.effort,'none');assert.ok(sent.instructions.includes('Do NOT proofread'));assert.ok(sent.instructions.includes('Start with the actual explanation'));assert.ok(sent.instructions.includes('Do NOT repeat, summarize or paraphrase the question'));const input=JSON.parse(sent.input);assert.ok(input.request.includes('What does this mean'));assert.equal(input.target.text,'Explain an idea simply, then find gaps.');const result=await res.json();assert.equal(result.preview.components[0].type,'cycle');assert.equal(result.preview.replacement.includes('What does this mean'),false);});
test('malformed page questions and untrusted components fail before they can change a page',async()=>{let called=false;const never=async()=>{called=true;throw Error();};assert.equal((await handleAPI(req({target:null}),never)).status,400);assert.equal((await handleAPI(req({target:{id:'x',text:'a'.repeat(2501)}}),never)).status,400);assert.equal(called,false);assert.equal(validPageHelp({answer:'Answer',replacement:'text',components:[{...cycle,type:'script'}]}),false);});
test('inline diff preserves original text and clearly identifies changed material',()=>{const d=textDifference('Learn by explaining clearly.','Learn by explaining simply.');assert.equal(d.prefix+d.removed+d.suffix,'Learn by explaining clearly.');assert.equal(d.prefix+d.added+d.suffix,'Learn by explaining simply.');assert.ok(d.removed);assert.ok(d.added);});
test('stale, edited or disconnected proposals cannot apply',()=>{const good={version:2,currentVersion:2,before:'Original',current:'Original',connected:true};assert.equal(patchIsCurrent(good),true);for(const change of [{currentVersion:3},{current:'User edit'},{connected:false}])assert.equal(patchIsCurrent({...good,...change}),false);});
test('diff boundaries never split emoji surrogate pairs',()=>{const d=textDifference('Try 😀 now.','Try 😃 now.');assert.equal(d.prefix,'Try ');assert.equal(d.removed,'😀');assert.equal(d.added,'😃');assert.equal(d.suffix,' now.');});
test('an invalid model component is rejected at the API boundary',async()=>{const res=await handleAPI(req(),async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Hello',replacement:'',components:[{...cycle,type:'html',html:'<script>bad</script>'}]})}]}]}));assert.equal(res.status,502);assert.equal((await res.json()).retryable,false);assert.equal(validComponents([{...cycle,id:undefined}]),false);});

test('slide suggestions are distinct catalog IDs with a maximum of three',async()=>{
 const {validSlideOptions}=await import('../public/components/catalog.js');
 assert.equal(validSlideOptions(['cycle','example','practice']),true);
 for(const invalid of [['cycle','cycle'],['fake'],['constructor'],['cycle','example','practice','timeline']])assert.equal(validSlideOptions(invalid),false);
});

test('Send follows the selected slide recipe and also works with automatic presentation',async()=>{
 const {demoPreview}=await import('../public/shared/model.js');
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
 const {slideRecipe,matchesSlideRecipe}=await import('../public/components/catalog.js');
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
   assert.match(JSON.parse(opts.body).instructions,/Never paraphrase or restate the passage/);
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
 const noteQuestion='What is an ellipse?';
 for(const rewrite of ['Rewrite these notes in one sentence.','Rewrite my notes for a high-school student.']){
  assert.equal(explicitPageRewrite(textDifference(noteQuestion,noteQuestion+' '+rewrite)),rewrite);
 }
});

test('a completed inline question uses the whole changed sentence',()=>{
 const passage='Earth has a semimajor axis of 1 AU.';
 const unfinished=passage+'\n\nWhat is an astronomical';
 assert.equal(explicitPageQuestion(textDifference(unfinished,unfinished+' unit?')),'What is an astronomical unit?');
 assert.equal(explicitPageQuestion(textDifference('', 'What is an ellipse?')),'What is an ellipse?');
 assert.equal(explicitPageQuestion(textDifference('An orbit is round. What is an ellipse?','An orbit is oval. What is an ellipse?')),'');
});

test('explicit rewrite after an inline question has its own instruction path',async()=>{
 const question='Orbits are ellipses. What is an astronomical unit?';
 const instruction='Rewrite this for a high school student.';
 const text=question+' '+instruction;
 assert.equal(explicitPageRewrite(textDifference(question,text)),instruction);
 const replacement='Planets orbit in oval paths. One astronomical unit is about the distance from Earth to the Sun.';
 const response=await handleAPI(req({text:instruction,target:{id:'intro',mode:'rewrite',text}}),async(_,options)=>{
  const sent=JSON.parse(options.body);
  assert.match(sent.instructions,/Follow it even if target.text or page contains an earlier question/);
  assert.match(sent.instructions,/complete revised passage in replacement/);
  assert.equal(JSON.parse(sent.input).request,instruction);
  return modelHelp({answer:'',replacement,components:[]});
 });
 assert.equal((await response.json()).preview.replacement,replacement);
});

test('pages with a visual keep an introduction and at most three takeaways, cut at sentence ends',async()=>{
 const {tidyPage}=await import('../public/shared/model.js');
 const long='First sentence explains the idea clearly. '+'Second sentence keeps going with more detail than a takeaway needs. '.repeat(5);
 const page={kind:'outline',components:[{id:'a'}],body:[long,'One: short.','Two: short.','Three: short.','Four: dropped.']};
 const tidy=tidyPage(page);
 assert.equal(tidy.body.length,4);
 assert.ok(tidy.body[0].length<=240&&tidy.body[0].endsWith('.'));
 assert.ok(tidy.body[0].startsWith('First sentence explains the idea clearly.'));
 assert.deepEqual(tidy.body.slice(1),['One: short.','Two: short.','Three: short.']);
 const prose={kind:'outline',components:[],body:[long,'a','b','c','d']};
 assert.equal(tidyPage(prose),prose,'text-first pages keep their full deliverable');
 const email={kind:'outline',components:[{id:'a'}],body:[long,'One: short.','Two: short.','Three: short.','Subject: Offer for the Analyst role','Hi Alex,','Thank you for the offer. '.repeat(12),'Best,\nJordan']};
 assert.deepEqual(tidyPage(email).body.slice(4),email.body.slice(4),'a written piece after the takeaways is kept whole');
 const longEmail={...email,body:[...email.body.slice(0,4),...Array.from({length:14},(_,i)=>'Line '+i+'.')]};
 const folded=tidyPage(longEmail).body;
 assert.equal(folded.length,12,'a long message is folded to fit the page');
 assert.equal(folded.slice(4).join('\n'),longEmail.body.slice(4).join('\n'),'nothing of it is lost');
});

test('go deeper answers every follow-up once with at most one valid component',async()=>{
 const {deeperSections}=await import('../api.mjs');const {handleAPI}=await import('./helpers.mjs');
 const followUps=['Why do boosters fade?','Are side effects common?'];
 const sections=[{answer:'Antibody levels fall over months.',components:[]},{answer:'Most are mild and short.',components:[]}];
 let sent;
 const response=await handleAPI(new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer test-key-abcdefghijklmnop'},
  body:JSON.stringify({text:'How vaccines work',audience:'',format:'Auto',phase:'deeper',followUps})}),
  async(_,opts)=>{sent=JSON.parse(opts.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({sections})}]}]});});
 assert.equal(response.status,200);
 assert.equal(sent.model,'gpt-6-luna');
 assert.equal(sent.text.format.name,'go_deeper');
 assert.deepEqual((await response.json()).deeper,sections);
 assert.deepEqual(deeperSections({sections:sections.slice(0,1)},2),[sections[0],null],'a missing answer is marked, the others are kept');
 assert.deepEqual(deeperSections({sections:[{answer:'x'.repeat(500),components:[]},sections[1]]},2),[null,sections[1]],'an over-long answer is dropped on its own');
 assert.equal(deeperSections({sections:[]},2),null,'no usable answer is a failure');
 const badVisual={answer:'About 20,000 yen a day.',components:[{id:'cost',type:'key_numbers',title:'Daily cost',prompt:'JPY per day for two, excluding lodging',items:[{label:'Lean',detail:'x',value:20000},{label:'Comfortable',detail:'x',value:40000}],edges:[]}]};
 assert.deepEqual(deeperSections({sections:[badVisual,sections[1]]},2),[{...badVisual,components:[]},sections[1]],'a broken visual is dropped, its answer kept');
 assert.ok(sent.instructions.includes('return exactly 2 sections'));
 const bad=await handleAPI(new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer test-key-abcdefghijklmnop'},
  body:JSON.stringify({text:'x',audience:'',format:'Auto',phase:'deeper',followUps:['a','b','c','d']})}),async()=>{throw new Error('must not call the model');});
 assert.equal(bad.status,400);
});

test('data that grows fits: up to 12 for chart and timeline, 8 for spectrum and map, 6 elsewhere',()=>{
  const items=n=>Array.from({length:n},(_,i)=>({label:'Item '+i,detail:'Detail.',value:i*10,latitude:null,longitude:null}));
  assert.equal(validComponents([{id:'ph',type:'spectrum',title:'pH',prompt:'Acidic | Alkaline',items:items(8),edges:[]}]),true);
  assert.equal(validComponents([{id:'ph',type:'spectrum',title:'pH',prompt:'Acidic | Alkaline',items:items(9),edges:[]}]),false);
  assert.equal(validComponents([{...cycle,items:items(7)}]),false);
  assert.equal(validComponents([{id:'sums',type:'chart',title:'Sums',prompt:'',items:items(11),edges:[]}]),true);   // every sum of two dice
  assert.equal(validComponents([{id:'sums',type:'chart',title:'Sums',prompt:'',items:items(13),edges:[]}]),false);
  assert.equal(validComponents([{id:'trip',type:'map',title:'Trip',prompt:'',items:items(9).map(i=>({...i,latitude:1,longitude:1})),edges:[]}]),false);
});

test('a page has up to three components (views), never four',()=>{
 const block=id=>({...cycle,id});
 assert.equal(validComponents([block('a'),block('b'),block('c')]),true);
 assert.equal(validComponents([block('a'),block('b'),block('c'),block('d')]),false);
});

test('the background views step returns 0-2 valid extra views and needs the page',async()=>{
 const call=(body,views)=>handleAPI(new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({text:'Plan three days in Rome',audience:'',format:'Auto',phase:'views',...body})}),
  async(_,options)=>{const sent=JSON.parse(options.body);assert.equal(sent.text.format.name,'more_views');assert.equal(sent.model,'gpt-6-luna');
   return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({components:views})}]}]});});
 const context=JSON.stringify({page:{title:'Rome',page:{kind:'outline',components:[cycle]}}});
 const ok=await call({context},[{...cycle,id:'days'}]);
 assert.equal(ok.status,200);assert.deepEqual((await ok.json()).views.map(v=>v.id),['days']);
 assert.equal((await call({context},[{...cycle,id:'a'},{...cycle,id:'b'},{...cycle,id:'c'}])).status,502);   // at most two more
 assert.equal((await call({},[])).status,400);                                                            // needs the page
});
