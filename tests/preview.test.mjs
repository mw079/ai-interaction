import test from 'node:test';
import assert from 'node:assert/strict';
import {trajectory,demoPreview,validPreview,clarificationFor,quickAnswer,liveClarificationFor} from '../public/shared/model.js';
import {handleAPI} from './helpers.mjs';
import {readSSE} from '../public/shared/stream.js';
const headers={Authorization:'Bearer test-key-not-a-real-secret','Content-Type':'application/json',Origin:'https://example.test'};
const req=(body,overrides={})=>new Request('https://example.test/api/preview',{method:'POST',headers,...overrides,body:JSON.stringify(body)});
const payload={text:'Explain projectile motion',audience:'',format:'Interactive page'};
test('ideal projectile has expected same-height flight and lands at zero',()=>{const v=trajectory(20,45,9.81);assert.ok(Math.abs(v.range-40.77472)<.001);assert.ok(Math.abs(v.duration-2.8832)<.001);assert.ok(Math.abs(v.height-10.19368)<.001);assert.ok(Math.abs(v.points.at(-1).y)<1e-10);assert.ok(trajectory(20,45,1.62).range>v.range);});
test('demo templates and output bounds',()=>{assert.equal(demoPreview('projectile motion').kind,'projectile');assert.equal(demoPreview('prepare a presentation').kind,'outline');assert.equal(demoPreview('compare two things').kind,'outline');assert.ok(validPreview(demoPreview('gravity')));assert.equal(validPreview({...demoPreview('gravity'),title:'a'.repeat(161)}),false);});
test('without a server key, and for cross-origin requests, OpenAI is never called',async()=>{const never=()=>{throw new Error('Unexpected upstream call');};assert.equal((await handleAPI(req(payload),never,{OPENAI_API_KEY:''})).status,503);assert.equal((await handleAPI(req(payload,{headers:{...headers,Origin:'https://other.test'}}),never)).status,403);});
test('oversized or invalid input fails before inference',async()=>{const never=()=>{throw new Error('Unexpected upstream call');};assert.equal((await handleAPI(req({...payload,text:'a'.repeat(4001)}),never)).status,400);assert.equal((await handleAPI(req({...payload,format:'run code'}),never)).status,400);});
test('Luna request is bounded, schema-constrained and does not store response',async()=>{const upstream=async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/responses');const b=JSON.parse(opts.body);assert.equal(b.model,'gpt-6-luna');assert.equal(b.store,false);assert.equal(b.reasoning.effort,'none');assert.equal(b.text.format.strict,true);assert.equal(b.tools,undefined);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}],usage:{total_tokens:100}});};const response=await handleAPI(req(payload),upstream);assert.equal(response.status,200);const out=await response.json();assert.equal(out.preview.kind,'projectile');assert.equal(out.usage.total_tokens,100);assert.equal(JSON.stringify(out).includes(headers.Authorization),false);});
test('refusal, malformed and incomplete responses fail safely',async()=>{for(const data of [{status:'incomplete'},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},{status:'completed',output:[]}]){const result=await handleAPI(req(payload),async()=>Response.json(data));assert.notEqual(result.status,200);assert.ok((await result.json()).error);}});
test('upstream failure does not expose error body or authorization',async()=>{const r=await handleAPI(req(payload),async()=>new Response('sensitive upstream detail',{status:401}));assert.equal(r.status,503);const text=await r.text();assert.equal(text.includes('sensitive'),false);assert.equal(text.includes('key'),false);});
test('short requests stay on Luna and explicitly committed pages use Terra',async()=>{for(const phase of ['preview','page']){const upstream=async(url,opts)=>{const b=JSON.parse(opts.body);assert.equal(b.model,phase==='page'?'gpt-6.1-terra':'gpt-6-luna');assert.equal(b.max_output_tokens,phase==='page'?5000:1300);assert.equal(b.reasoning.effort,phase==='page'?'low':'none');return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}]});};const response=await handleAPI(req({...payload,phase}),upstream);assert.equal(response.status,200);assert.equal((await response.json()).model,phase==='page'?'gpt-6.1-terra':'gpt-6-luna');}});
test('unknown phase is rejected instead of routing arbitrary models',async()=>{assert.equal((await handleAPI(req({...payload,phase:'gpt-anything'}),()=>{throw new Error('No upstream call allowed');})).status,400);});
test('the old key check endpoint is gone',async()=>{assert.equal((await handleAPI(new Request('https://example.test/api/check',{method:'POST',headers}),()=>{throw Error('No upstream call allowed');})).status,404);});
test('uncertainty highlights concrete phrases and resolved preferences stop repeating',()=>{assert.equal(clarificationFor('hi'),null);const c=clarificationFor('Please explain physics');assert.equal(c.phrase,'physics');assert.equal(c.start,15);assert.equal(clarificationFor('Help me understand motion. With the mathematics'),null);assert.ok(quickAnswer('projectile motion').length<320);assert.equal(quickAnswer('an unsupported topic'), '');});
test('page context is forwarded and oversized context is rejected',async()=>{
 const context='Existing plan: Italy, quiet hotel; dates not chosen';
 const upstream=async(url,opts)=>{assert.equal(JSON.parse(JSON.parse(opts.body).input).page,context);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...demoPreview('gravity'),kind:'planner'})}]}]});};
 assert.equal((await handleAPI(req({...payload,context,phase:'page'}),upstream)).status,200);
 assert.equal((await handleAPI(req({...payload,context:'x'.repeat(6001)}),()=>{throw Error('No inference');})).status,400);
});
test('every request uses the server key; a key sent by the browser is ignored',async()=>{
 const env={OPENAI_API_KEY:'test-server-key-not-a-real-secret'};
 const config=url=>new Request(url+'/api/config');
 assert.deepEqual(await (await handleAPI(config('https://example.test'),fetch,env)).json(),{live:true,limited:false});
 assert.deepEqual(await (await handleAPI(config('https://example.test'),fetch,{OPENAI_API_KEY:''})).json(),{live:false,limited:false});
 const visitorKey=req(payload,{headers:{...headers,Authorization:'Bearer sk-visitor-supplied-key-0000'}});
 let used;await handleAPI(visitorKey,async(url,opts)=>{used=opts.headers.Authorization;return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}]});},env);
 assert.equal(used,'Bearer '+env.OPENAI_API_KEY);
});
test('the daily limit is counted per visitor on the server and resets the next UTC day',async()=>{
 const {createDailyLimiter}=await import('../api.mjs');
 let now=Date.parse('2026-11-19T23:59:00Z');
 const limiter=createDailyLimiter({perVisitor:2,total:3,now:()=>now});
 let calls=0;const upstream=async()=>{calls++;return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}]});};
 const send=(visitor,body=payload)=>handleAPI(req(body),upstream,{},{limiter,visitor});
 assert.equal((await send('a')).status,200);
 assert.equal((await send('a',{...payload,format:'run code'})).status,400);   // invalid requests are not counted
 assert.equal((await send('a')).status,200);
 const limited=await send('a');assert.equal(limited.status,429);
 assert.deepEqual(await limited.json(),{error:'You’ve reached today’s limit. Try again tomorrow.',limit:'daily',retryable:false});
 assert.equal(calls,2);                                                        // over the limit, OpenAI is not called
 assert.deepEqual(await (await handleAPI(new Request('https://example.test/api/config'),fetch,{},{limiter,visitor:'a'})).json(),{live:true,limited:true});
 assert.equal((await send('b')).status,200);                                   // another visitor has their own count
 const total=await send('c');assert.equal(total.status,429);                   // ...until the app-wide cap is reached
 assert.equal((await total.json()).error,'The demo has reached today’s limit. Try again tomorrow.');
 now=Date.parse('2026-11-20T00:00:01Z');
 assert.equal((await send('a')).status,200);                                   // a new UTC day starts fresh
});

test('live clarification follows the complete draft and permits no question',()=>{
 const text='I want to explore physics and I want to understand the kepler laws.';
 assert.equal(liveClarificationFor(text,{question:'',options:[],phrase:''}),null);
 const focused=liveClarificationFor(text,{question:'Would a visual or mathematical explanation help?',options:['Visual','Mathematical'],phrase:'kepler laws'});
 assert.equal(text.slice(focused.start,focused.end),'kepler laws');
 assert.equal(focused.replace,false);
 assert.equal(liveClarificationFor(text,{question:'What level?',options:[],phrase:'quantum'}).phrase,null);
});

test('automatic format and typed contextual refinements are accepted and bounded',async()=>{
 const refinement={type:'output_format',phrase:'Kepler laws',question:'How would you like to explore the laws?',options:['Orbit diagram','Mathematical derivation'],unit:''};
 const upstream=async(url,opts)=>{const request=JSON.parse(opts.body);assert.equal(JSON.parse(request.input).decisions?.responseFormat,undefined,'Auto is a default, not a decision');assert.equal(request.text.format.schema.properties.information.items.properties.type.enum.length,24);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...demoPreview('Kepler laws'),information:[refinement]})}]}]});};
 assert.equal((await handleAPI(req({...payload,text:'Explain Kepler laws',format:'Auto'}),upstream)).status,200);
 assert.equal(validPreview({...demoPreview('Kepler laws'),information:[{...refinement,type:'execute_html'}]}),false);
});

test('Kepler diagrams are a bounded trusted component, not executable model content',async()=>{
 const request=new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{Authorization:'Bearer test-key-not-a-real-secret','Content-Type':'application/json'},body:JSON.stringify({text:'Explain Kepler laws with an orbit diagram',format:'Diagram',audience:'High school',phase:'page'})});
 const response=await handleAPI(request,async(url,opts)=>{const sent=JSON.parse(opts.body);assert.ok(sent.text.format.schema.properties.kind.enum.includes('kepler'));assert.ok(sent.instructions.includes('use kind=kepler'));return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...demoPreview('Kepler'),kind:'kepler'})}]}]});});assert.equal(response.status,200);assert.equal((await response.json()).preview.kind,'kepler');
});

test('an unfinished comparison still reaches Luna, which is told to help instead of waiting',async()=>{
 let sent;
 const result=await handleAPI(req({...payload,phase:'preview',text:'Explain the difference between evaporation and…'}),async(url,opts)=>{sent=JSON.parse(opts.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'outline',title:'',interpretation:'',audience:'',questionKind:'clarify',question:'Compared with what?',phrase:'',options:['Sublimation','Condensation','Boiling'],body:['Evaporation turns liquid into gas at the surface.'],nodes:[],rows:[],information:[],completion:' sublimation.',components:[],slideOptions:[],followUps:[],launch:{speed:20,angle:45,world:'earth'}})}]}]});});
 assert.equal(result.status,200);
 assert.ok(sent.instructions.includes('Never go silent'));
 const data=await result.json();
 assert.equal(data.preview.completion,' sublimation.');
 assert.equal(data.preview.question,'Compared with what?');
});

test('adding the other subject resumes the Luna request',async()=>{
 const text='Explain the difference between evaporation and sublimation.';
 let called=false;
 const result=await handleAPI(req({...payload,phase:'preview',text}),async(_,options)=>{
  called=true;
  const upstream=JSON.parse(options.body);
  assert.equal(upstream.model,'gpt-6-luna');
  assert.equal(JSON.parse(upstream.input).request,text);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview(text))}]}]});
 });
 assert.equal(called,true);
 assert.equal(result.status,200);
});

test('model input is ordered by authority, omits defaults and empty fields, and never duplicates the draft',async()=>{
 const {buildModelInput,modelInstructions}=await import('../prompts.mjs');
 const context=JSON.stringify({explicitIntent:'Revise for an exam',draft:'Explain Kepler laws (High school)',page:{title:'Orbits'},
  confirmed:[{type:'audience',phrase:'Kepler laws',value:'High school'}],date:'2026-11-19',timezone:'Europe/Berlin'});
 const input=buildModelInput({text:'Explain Kepler laws (High school)',audience:'',format:'Auto',phase:'page',context,stream:false,interaction:'unified'},{slideLabel:'Explore an orbit'});
 assert.deepEqual(Object.keys(input),['request','decisions','page','today']);
 assert.deepEqual(input.decisions,{choices:[{about:'audience',phrase:'Kepler laws',value:'High school'}],slideFormat:'Explore an orbit',intent:'Revise for an exam'});
 assert.equal(JSON.stringify(input).includes('draft'),false,'the draft is sent once, as request');
 assert.equal('stream' in input||'interaction' in input,false,'transport flags never reach the model');
 assert.deepEqual(buildModelInput({text:'Hi',audience:'',format:'Auto',context:'{not json'}),{request:'Hi',page:'{not json'});
 for(const phase of ['preview','page','page-help','selection','deeper'])
  assert.match(modelInstructions({phase,target:{mode:'question'}},'',''),/^INPUT\. .*order of authority/,phase+' starts with the shared input contract');
});

test('a projectile page starts at the launch the model chose, clamped to the simulator',async()=>{
  const {projectileLaunch,validPreview}=await import('../public/shared/model.js');
  assert.deepEqual(projectileLaunch({speed:20,angle:45,world:'moon'}),{speed:20,angle:45,gravity:1.62});
  assert.deepEqual(projectileLaunch({speed:90,angle:2,world:'mars'}),{speed:30,angle:10,gravity:3.71});
  assert.deepEqual(projectileLaunch(undefined),{speed:20,angle:45,gravity:9.81});
  const page={kind:'projectile',title:'',interpretation:'',audience:'',question:'',options:[],body:[],nodes:[],rows:[]};
  assert.equal(validPreview({...page,launch:{speed:20,angle:45,world:'moon'}}),true);
  assert.equal(validPreview({...page,launch:{speed:20,angle:45,world:'jupiter'}}),false);
});
test('with a page open, typing help previews what Send will do; without one it answers',async()=>{
  const {modelInstructions}=await import('../prompts.mjs');
  const withPage=modelInstructions({phase:'preview',text:'Explain the equations simply',context:JSON.stringify({page:{title:'Kepler’s laws'}})});
  const without=modelInstructions({phase:'preview',text:'Explain the equations simply',context:JSON.stringify({})});
  assert.match(withPage,/OPEN PAGE\..*starting with "Will"/);
  assert.doesNotMatch(without,/OPEN PAGE/);
});
test('the preview the user read is sent with the page request as a promise, and only there',async()=>{
  const promised='Will add a simple example for each law’s equation and explain what every symbol means.';
  let input;
  const upstream=async(url,opts)=>{const body=JSON.parse(opts.body);input=JSON.parse(body.input);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}]});};
  assert.equal((await handleAPI(req({...payload,phase:'page',promised}),upstream)).status,200);
  assert.equal(input.promised,promised);
  assert.deepEqual(Object.keys(input).slice(0,3),['request','decisions','promised'].filter(k=>k in input));
  const never=()=>{throw Error('No upstream call allowed');};
  assert.equal((await handleAPI(req({...payload,phase:'preview',promised}),never)).status,400);
  assert.equal((await handleAPI(req({...payload,phase:'page',promised:'x'.repeat(201)}),never)).status,400);
  const {modelInstructions}=await import('../prompts.mjs');
  assert.match(modelInstructions({phase:'page',text:'x'}),/promised: the one-line preview.*request wins/);
});
test('with a page open, typing help asks when an open choice would change the page',async()=>{
  const {modelInstructions}=await import('../prompts.mjs');
  const withPage=modelInstructions({phase:'preview',text:'Make it more detailed',context:JSON.stringify({page:{title:'Kepler’s laws'}})});
  assert.match(withPage,/QUESTION with a page open: when the instruction leaves open a choice/);
  assert.match(withPage,/sensible default is not a reason to skip the question/);
  assert.match(withPage,/Do not ask when the instruction already says what to change/);
});

test('a fourth option or follow-up is trimmed instead of rejecting the whole answer',async()=>{
 const model={...demoPreview('gravity'),questionKind:'clarify',question:'Which level?',phrase:'',options:['A','B','C','D'],followUps:['One?','Two?','Three?','Four?'],
  information:[],completion:'',components:[],slideOptions:[],launch:{speed:20,angle:45,world:'earth'}};
 const request=new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Explain gravity',format:'Auto',audience:'',phase:'preview'})});
 const response=await handleAPI(request,async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(model)}]}]}));
 assert.equal(response.status,200);
 const {preview}=await response.json();
 assert.deepEqual(preview.options,['A','B','C']);assert.equal(preview.followUps.length,3);
});
