import test from 'node:test';import assert from 'node:assert/strict';
import {readSSE,partialLivePreview} from '../public/shared/stream.js';
import {liveClarificationFor,compactLiveAnswer,demoPreview} from '../public/shared/model.js';
import {informationFor} from '../public/composer/intent.js';
import {handleAPI} from './helpers.mjs';
const encoder=new TextEncoder(),frame=value=>encoder.encode('data: '+JSON.stringify(value)+'\n\n');
const request=(signal,overrides={})=>new Request('http://127.0.0.1/api/preview',{method:'POST',signal,headers:{Authorization:'Bearer test-key-not-a-real-secret','Content-Type':'application/json'},body:JSON.stringify({text:'Explain Kepler laws',format:'Auto',audience:'',interaction:'unified',phase:'preview',stream:true,context:JSON.stringify({explicitIntent:'Teach high school students'}),...overrides})});
test('SSE handles split UTF-8, CRLF frames, comments and multiline data',async()=>{
 const bytes=encoder.encode(': comment\r\ndata: {"text":\r\ndata: "Kepler’s laws"}\r\n\r\ndata: [DONE]\r\n\r\n');let i=0;
 const body=new ReadableStream({pull(c){if(i<bytes.length)c.enqueue(bytes.slice(i,i+=1));else c.close();}});const events=[];for await(const event of readSSE(body))events.push(event);assert.deepEqual(events,[{text:'Kepler’s laws'}]);
});
test('partial JSON exposes bounded display text, never incomplete choices or JSON syntax',()=>{
 const a=partialLivePreview(' {"body":["Planets follow ellipses.');assert.equal(a.answer,'Planets follow ellipses.');
 const b=partialLivePreview('{"body":["A \\"question\\" is quoted."],"question":"Who is');assert.equal(b.answer,'A "question" is quoted.');assert.equal(b.question,'Who is');assert.equal(b.questionReady,false);
 const c=partialLivePreview('{"body":["Test"],"question":"Who?","phrase":"Explain","options":["School"');assert.equal(c.options,undefined);
 assert.equal(partialLivePreview('{"body":["Hi \\u2').answer,'Hi ');
 assert.equal(partialLivePreview('{"body":["'+ 'x'.repeat(300)).answer.length,160);
});
test('a partial answer reaches the caller before the upstream response finishes',async()=>{
 let upstreamController,captured;const source=new ReadableStream({start(c){upstreamController=c;}});
 const response=await handleAPI(request(),async(url,opts)=>{captured=JSON.parse(opts.body);return new Response(source,{headers:{'Content-Type':'text/event-stream'}});});
 assert.equal(captured.stream,true);assert.equal(captured.reasoning.effort,'none');assert.ok(captured.input.includes('Teach high school students'));
 const reader=response.body.getReader();upstreamController.enqueue(frame({type:'response.output_text.delta',item_id:'one',delta:'{"body":["Planets'}));
 const early=await reader.read();assert.ok(new TextDecoder().decode(early.value).includes('Planets'));
 const preview={...demoPreview('gravity'),body:['Planets orbit in ellipses.']};
 upstreamController.enqueue(frame({type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(preview)}]}]}}));upstreamController.close();
 let tail='';while(true){const next=await reader.read();if(next.done)break;tail+=new TextDecoder().decode(next.value);}assert.ok(tail.includes('"type":"done"'));assert.ok(tail.includes('gpt-6-luna'));
});
test('failed streams emit a safe error and never mark the response complete',async()=>{
 const source=new ReadableStream({start(c){c.enqueue(frame({type:'response.failed',response:{error:'private upstream diagnostic'}}));c.close();}});
 const response=await handleAPI(request(),async()=>new Response(source));const events=[];for await(const e of readSSE(response.body))events.push(e);assert.equal(events.at(-1).type,'error');assert.equal(JSON.stringify(events).includes('private upstream'),false);assert.equal(events.some(e=>e.type==='done'),false);
});
test('aborting a draft stops reading its stream and cancels the upstream body',async()=>{
 const abort=new AbortController();let cancelled=false;const source=new ReadableStream({start(c){c.enqueue(frame({type:'response.output_text.delta',item_id:'one',delta:'{"body":["Hello'}));},cancel(){cancelled=true;}});
 const response=await handleAPI(request(abort.signal),async()=>new Response(source));const reader=response.body.getReader();await reader.read();abort.abort();await reader.read();assert.equal(cancelled,true);
});
test('audience refinements become visible questions without replacing their choices by format options',()=>{
 const text='Explain Kepler laws';const entries=informationFor(text,[{type:'audience',phrase:'Explain',question:'Who is this for?',options:['High school','Undergraduate'],unit:''},{type:'output_format',phrase:'Kepler laws',question:'Which format?',options:['Diagram','Text'],unit:''}]);
 assert.equal(entries.length,2);assert.equal(liveClarificationFor(text,{question:''},entries).type,'audience');
 const q=liveClarificationFor(text,{question:'Who is learning this?',phrase:'Kepler laws',options:['School','University']},entries);assert.deepEqual(q.options,['School','University']);
 assert.equal(liveClarificationFor(text,{question:''},entries.map(e=>({...e,confirmed:true}))),null);
});
test('live answer display keeps one short sentence with a hard length bound',()=>{
 assert.equal(compactLiveAnswer({body:[],interpretation:'A restatement of the request'}),'');
 assert.equal(compactLiveAnswer({body:['Subject: Thank you for a great launch\n\nHi team,\nThank you all for your hard work.']}),'Subject: Thank you for a great launch\nHi team,\nThank you all for your hard work.','a multi-line sample keeps its lines');
 assert.equal(compactLiveAnswer({body:['First sentence. Second sentence.']}),'First sentence. Second sentence.');   // both fit: the second often carries the point
 assert.equal(compactLiveAnswer({body:['A first sentence that is long enough on its own to matter here. '+'A second one that would take the whole answer well past the hard limit of one hundred and sixty characters.']}),'A first sentence that is long enough on its own to matter here.');assert.ok(compactLiveAnswer({body:['long '.repeat(100)]}).length<=160);
 // An over-long answer ends at its last clause break as a whole sentence, not mid-phrase.
 assert.equal(compactLiveAnswer({body:['Inflation can come from demand outpacing supply, rising production costs, or expectations of future price increases; central banks mainly raise interest rates to cool spending.']}),
  'Inflation can come from demand outpacing supply, rising production costs, or expectations of future price increases.');
});

test('one question prioritizes clarification and keeps exploration choices as background preferences',()=>{
 const text='Explain Kepler laws';const entries=informationFor(text,[{type:'audience',phrase:'Explain',question:'Who is this for?',options:['School','University'],unit:''}]);
 const data={questionKind:'explore',question:'Why do planets move faster near the Sun?',phrase:'Kepler laws',options:['An example','Use conservation of momentum']};
 assert.equal(liveClarificationFor(text,data,entries).type,'audience');
 const exploration=liveClarificationFor(text,data,entries.map(e=>({...e,confirmed:true})));
 assert.equal(exploration.questionKind,'explore');assert.equal(exploration.phrase,null);assert.equal(exploration.global,true);assert.deepEqual(exploration.options,data.options);
 assert.equal(liveClarificationFor(text,{questionKind:'none',question:''},[]),null);
});

test('clarifying questions recover missing options from matching information or useful safe presets',()=>{
 const data={question:'How much calculus should I use?',questionKind:'clarify',options:[]};
 assert.deepEqual(liveClarificationFor('Explain Kepler with math',data).options,['No calculus','Basic derivatives','Full derivation']);
 const withDescriptor={...data,information:[{question:'How much calculus should I use',options:['Algebra only','Multivariable calculus']}]};
 assert.deepEqual(liveClarificationFor('Explain Kepler with math',withDescriptor).options,['Algebra only','Multivariable calculus']);
 assert.deepEqual(liveClarificationFor('Plan the event',{...data,question:'What is the exact date?'}).options,[]);
});

test('page help streams answer text and releases the replacement only with a validated result',async()=>{
 const proposal={answer:'An ellipse has two foci.',replacement:'Planets follow elliptical orbits.',components:[]};
 const upstreamFrames=[
  {type:'response.output_text.delta',item_id:'one',delta:'{"answer":"An ellipse has'},
  {type:'response.output_text.delta',item_id:'one',delta:' two foci.","replacement":"Planets follow elliptical orbits."}'},
  {type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(proposal)}]}]}}
 ];
 const response=await handleAPI(request(undefined,{phase:'page-help',target:{mode:'question',id:'notes',text:'What is an ellipse?'}}),async(_,opts)=>{
  assert.equal(JSON.parse(opts.body).stream,true);
  return new Response(new ReadableStream({start(controller){
   for(const event of upstreamFrames)controller.enqueue(frame(event));
   controller.close();
  }}));
 });
 const events=[];
 for await(const event of readSSE(response.body))events.push(event);
 assert.deepEqual(events.slice(0,-1),[
  {type:'partial',preview:{answer:'An ellipse has'}},
  {type:'partial',preview:{answer:proposal.answer}}
 ]);
 assert.equal(events.at(-1).type,'done');
 assert.equal(events.at(-1).preview.replacement,proposal.replacement);
});

test('each highlight and the Tab prediction stream as soon as they are complete and valid',()=>{
 const item=JSON.stringify({type:'duration',phrase:'weekend',question:'How long?',options:['2 days','3 days'],unit:'days',samples:[]});
 const bad=JSON.stringify({type:'not_a_type',phrase:'x',question:'?',options:[],unit:'',samples:[]});
 const a=partialLivePreview('{"body":["Hi."],"completion":"parents for a weekend.","information":['+item+','+bad+','+item.slice(0,30));
 assert.equal(a.completion,'parents for a weekend.');
 assert.deepEqual(a.information.map(i=>i.phrase),['weekend']);              // the invalid one and the half-written one wait
 assert.equal(partialLivePreview('{"body":["Hi."],"completion":"par').completion,undefined);
});

test('a follow-up’s preview becomes its status line while it is being made',async()=>{
 const {workingLine}=await import('../public/shared/model.js');
 assert.equal(workingLine('Will add a three-question quiz on tilt.','x'),'Adding a three-question quiz on tilt…');
 assert.equal(workingLine('Will simplify the wording.','x'),'Simplifying the wording…');
 assert.equal(workingLine('Will replace the slider with a chart.','x'),'Replacing the slider with a chart…');
 assert.equal(workingLine('Will put the year first.','x'),'Putting the year first…');
 assert.equal(workingLine('','Add a quiz'),'Working on “Add a quiz”');
});
