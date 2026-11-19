import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedChoices,requestContext,blockContextText} from '../public/composer/request-context.js';
import {demoPreview,draftWordCount,completedDraft,extendsPreview,workingDraftPreview} from '../public/shared/model.js';
import {handleAPI} from './helpers.mjs';
test('explicit choices survive clearing the composer and inferred choices stay separate',()=>{
 const entries=[{type:'depth',phrase:'explain',value:'Beginner',confirmed:true},{type:'tone',phrase:'explain',value:'Friendly',confirmed:false}];
 const saved=confirmedChoices(entries);entries.length=0;
 const sent=JSON.parse(requestContext({draft:'',confirmed:saved}));assert.deepEqual(sent.confirmed,[{type:'depth',phrase:'explain',value:'Beginner'}]);
});
test('context stays valid JSON within the API bound for escaped drafts and long pages',()=>{
 const encoded=requestContext({draft:'"\n'.repeat(2000),page:'"\n'.repeat(3000),confirmed:[{type:'goal',phrase:'Learn',value:'Physics'}]});assert.ok(encoded.length<=6000);assert.equal(JSON.parse(encoded).confirmed[0].value,'Physics');
});
test('the unified composer requests Luna continuation with live help; Send still uses Terra',async()=>{
 for(const phase of ['preview','page']){
  const request=new Request('https://example.test/api/preview',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-key-not-a-real-secret'},body:JSON.stringify({text:'Explain Kepler laws',format:'Auto',audience:'',interaction:'unified',phase,context:requestContext({explicitIntent:'Prepare an intuitive exam revision guide',confirmed:[{type:'depth',phrase:'Explain',value:'Beginner'}]})})});
  const result=await handleAPI(request,async(url,opts)=>{const sent=JSON.parse(opts.body);assert.equal(sent.model,phase==='preview'?'gpt-6-luna':'gpt-6.1-terra');assert.equal(sent.instructions.includes('Also supply completion:'),phase==='preview');assert.ok(JSON.stringify(sent.input).includes('Beginner'));assert.ok(JSON.stringify(sent.input).includes('Prepare an intuitive exam revision guide'));assert.ok(sent.instructions.includes('intent is the user’s own summary of the goal'));return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}]});});assert.equal(result.status,200);
 }
});

test('manual intent survives context trimming and remains separate from the draft',()=>{
 const context=JSON.parse(requestContext({draft:'"'.repeat(2000),page:'"'.repeat(3000),explicitIntent:'Understand equal areas using a visual example'}));
 assert.equal(context.explicitIntent,'Understand equal areas using a visual example');assert.ok(JSON.stringify(context).length<=6000);
 assert.equal(JSON.parse(requestContext({explicitIntent:'a'.repeat(600)})).explicitIntent.length,500);
});

test('clarifying and exploratory choices are forwarded to both live completion and Send after draft clearing',async()=>{
 const confirmed=confirmedChoices([
  {type:'audience',phrase:'Explain',value:'Undergraduate',confirmed:true},
  {type:'goal',phrase:'Which connection should we explore?',value:'Angular momentum and equal areas',confirmed:true,global:true}
 ]);
 for(const phase of ['preview','page']){
  let sent;
  const request=new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-key-not-a-real-secret'},body:JSON.stringify({text:'Explain Kepler laws',format:'Auto',audience:'',interaction:'unified',phase,context:requestContext({draft:phase==='page'?'':'Explain Kepler laws',confirmed})})});
  const result=await handleAPI(request,async(url,opts)=>{sent=JSON.parse(opts.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('Kepler laws'))}]}]});});
  assert.equal(result.status,200);assert.ok(sent.input.includes('Undergraduate'));assert.ok(sent.input.includes('Angular momentum and equal areas'));assert.ok(sent.input.includes('Which connection should we explore?'));assert.ok(sent.instructions.includes('Follow decisions unless request clearly changes them'));if(phase==='preview')assert.ok(sent.instructions.includes('Never propose a direction already decided'));
  assert.equal(sent.instructions.includes('Also supply completion:'),phase==='preview');
 }
});

test('long follow-ups contain a structured slide with edited text and stable component IDs',()=>{
 const preview=demoPreview('compare');
 preview.edits={explanation:'The user revised this passage. '+('“λ”\n🌒 '.repeat(350))};
 const block={
  id:'phase-changes',type:'hierarchy',title:'Phase changes',prompt:'',
  items:[{label:'Matter',detail:'“例”\n'.repeat(145),value:0},{label:'Gas',detail:'solid\n'.repeat(90),value:0}],
  edges:[{from:0,to:1,label:'can become'}]
 };
 preview.components=[block];
 const encoded=requestContext({
  draft:'Explain why this changes.',
  page:{title:'My edited slide',originalRequest:'Compare states of matter.',page:preview,notes:'“備忘”\n'.repeat(2000)},
  confirmed:[{type:'audience',phrase:'Explain',value:'Undergraduate'}],
  explicitIntent:'Understand the change'
 });
 assert.ok(Buffer.byteLength(encoded)<=6000);
 const context=JSON.parse(encoded);
 assert.equal(context.explicitIntent,'Understand the change');
 assert.equal(context.confirmed[0].value,'Undergraduate');
 assert.equal(context.page.title,'My edited slide');
 assert.match(context.page.page.body[0],/^The user revised this passage\./);
 assert.equal(context.page.page.components[0].id,'phase-changes');
 assert.deepEqual(context.page.page.components[0].edges.map(({from,to})=>[from,to]),[[0,1]]);
 assert.ok(context.page.notes.length>0);
 assert.notEqual(preview.edits.explanation,context.page.page.body[0]);
});

test('scoped component context stays valid JSON at both API limits',()=>{
 const block={
  id:'test-tree',type:'hierarchy',title:'“分類”'.repeat(24),prompt:'Explain the branches.',
  items:Array.from({length:6},(_,i)=>({label:'節点'.repeat(35),detail:('\u0001🌒"\n'.repeat(100)),value:i,latitude:null,longitude:null})),
  edges:Array.from({length:5},(_,i)=>({from:i,to:i+1,label:'“枝”'.repeat(24)}))
 };
 for(const limit of [2500,4500]){
  const text=blockContextText(block,limit);
  assert.ok(Buffer.byteLength(text)<=limit);
  const compact=JSON.parse(text);
  assert.equal(compact.id,block.id);
  assert.equal(compact.items.length,block.items.length);
  assert.deepEqual(compact.edges.map(({from,to})=>[from,to]),block.edges.map(({from,to})=>[from,to]));
 }
});

test('in-progress previews use finished words and drop resolved or superseded suggestions',()=>{
 const snapshot='Plan a trip to Japan';
 assert.equal(draftWordCount(completedDraft(snapshot+' wi')),5);
 assert.equal(completedDraft(snapshot+' wi'),snapshot);
 assert.equal(extendsPreview(snapshot,snapshot+' with two kids'),true);
 assert.equal(extendsPreview(snapshot,snapshot+'ese gardens'),false);
 assert.equal(extendsPreview(snapshot,snapshot+' Actually, plan a math lesson.'),false);
 const control={phrase:'Japan',type:'location',options:['Kyoto and Osaka','Tokyo']};
 const preview={...control,information:[control],question:'Which region?',body:['Choose a base.'],completion:'Use a train.'};
 assert.equal(workingDraftPreview(preview,snapshot,snapshot+' with two kids').information.length,1);
 const resolved=workingDraftPreview(preview,snapshot,snapshot+' focused on Kyoto');
 assert.deepEqual(resolved.information,[]);
 assert.equal(resolved.question,'');
 assert.equal(resolved.completion,'');
 const duration={phrase:'trip',type:'duration',question:'What trip length should I plan for?',options:['One week','Two weeks']};
 const durationPreview={...duration,information:[duration],body:[]};
 const answeredDuration=workingDraftPreview(durationPreview,snapshot,snapshot+' for a week');
 assert.deepEqual(answeredDuration.information,[]);
 assert.equal(answeredDuration.question,'');
});
