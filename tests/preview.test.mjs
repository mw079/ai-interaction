import test from 'node:test';
import assert from 'node:assert/strict';
import {trajectory,demoPreview,validPreview,clarificationFor,quickAnswer,liveClarificationFor,isCurrentPreview} from '../public/model.js';
import {handleAPI} from '../api.mjs';
const headers={Authorization:'Bearer test-key-not-a-real-secret','Content-Type':'application/json',Origin:'https://example.test'};
const req=(body,overrides={})=>new Request('https://example.test/api/preview',{method:'POST',headers,...overrides,body:JSON.stringify(body)});
const payload={text:'Explain projectile motion',audience:'',format:'Interactive page'};
test('ideal projectile has expected same-height flight and lands at zero',()=>{const v=trajectory(20,45,9.81);assert.ok(Math.abs(v.range-40.77472)<.001);assert.ok(Math.abs(v.duration-2.8832)<.001);assert.ok(Math.abs(v.height-10.19368)<.001);assert.ok(Math.abs(v.points.at(-1).y)<1e-10);assert.ok(trajectory(20,45,1.62).range>v.range);});
test('demo templates and output bounds',()=>{assert.equal(demoPreview('projectile motion').kind,'projectile');assert.equal(demoPreview('prepare a presentation').kind,'outline');assert.equal(demoPreview('compare two things').kind,'comparison');assert.ok(validPreview(demoPreview('gravity')));assert.equal(validPreview({...demoPreview('gravity'),title:'a'.repeat(161)}),false);});
test('missing key and cross-origin requests never call OpenAI',async()=>{const never=()=>{throw new Error('Unexpected upstream call');};assert.equal((await handleAPI(req(payload,{headers:{'Content-Type':'application/json'}}),never)).status,401);assert.equal((await handleAPI(req(payload,{headers:{...headers,Origin:'https://other.test'}}),never)).status,403);});
test('oversized or invalid input fails before inference',async()=>{const never=()=>{throw new Error('Unexpected upstream call');};assert.equal((await handleAPI(req({...payload,text:'a'.repeat(4001)}),never)).status,400);assert.equal((await handleAPI(req({...payload,format:'run code'}),never)).status,400);});
test('Luna request is bounded, schema-constrained and does not store response',async()=>{const upstream=async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/responses');const b=JSON.parse(opts.body);assert.equal(b.model,'gpt-6-luna');assert.equal(b.store,false);assert.equal(b.reasoning.effort,'none');assert.equal(b.text.format.strict,true);assert.equal(b.tools,undefined);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}],usage:{total_tokens:100}});};const response=await handleAPI(req(payload),upstream);assert.equal(response.status,200);const out=await response.json();assert.equal(out.preview.kind,'projectile');assert.equal(out.usage.total_tokens,100);assert.equal(JSON.stringify(out).includes(headers.Authorization),false);});
test('refusal, malformed and incomplete responses fail safely',async()=>{for(const data of [{status:'incomplete'},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},{status:'completed',output:[]}]){const result=await handleAPI(req(payload),async()=>Response.json(data));assert.notEqual(result.status,200);assert.ok((await result.json()).error);}});
test('upstream failure does not expose error body or authorization',async()=>{const r=await handleAPI(req(payload),async()=>new Response('sensitive upstream detail',{status:401}));assert.equal(r.status,401);assert.equal((await r.text()).includes('sensitive'),false);});
test('short requests stay on Luna and explicitly committed pages use Terra',async()=>{for(const phase of ['preview','page']){const upstream=async(url,opts)=>{const b=JSON.parse(opts.body);assert.equal(b.model,phase==='page'?'gpt-6.1-terra':'gpt-6-luna');assert.equal(b.max_output_tokens,phase==='page'?3400:1300);assert.equal(b.reasoning.effort,phase==='page'?'low':'none');return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}]});};const response=await handleAPI(req({...payload,phase}),upstream);assert.equal(response.status,200);assert.equal((await response.json()).model,phase==='page'?'gpt-6.1-terra':'gpt-6-luna');}});
test('unknown phase is rejected instead of routing arbitrary models',async()=>{assert.equal((await handleAPI(req({...payload,phase:'gpt-anything'}),()=>{throw new Error('No upstream call allowed');})).status,400);});
test('model access checks both requested models without generation',async()=>{const urls=[];const r=await handleAPI(new Request('https://example.test/api/check',{method:'POST',headers}),async(url,opts)=>{urls.push(url);assert.equal(opts.method,'GET');return Response.json({});});assert.equal(r.status,200);assert.deepEqual(urls,['https://api.openai.com/v1/models/gpt-6-luna','https://api.openai.com/v1/models/gpt-6.1-terra']);});
test('uncertainty highlights concrete phrases and resolved preferences stop repeating',()=>{assert.equal(clarificationFor('hi'),null);const c=clarificationFor('Please explain physics');assert.equal(c.phrase,'physics');assert.equal(c.start,15);assert.equal(clarificationFor('Help me understand motion. With the mathematics'),null);assert.ok(quickAnswer('projectile motion').length<320);assert.equal(quickAnswer('an unsupported topic'), '');});
test('page context is forwarded and oversized context is rejected',async()=>{
 const context='Existing plan: Italy, quiet hotel; dates not chosen';
 const upstream=async(url,opts)=>{assert.equal(JSON.parse(JSON.parse(opts.body).input).context,context);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...demoPreview('gravity'),kind:'planner'})}]}]});};
 assert.equal((await handleAPI(req({...payload,context,phase:'page'}),upstream)).status,200);
 assert.equal((await handleAPI(req({...payload,context:'x'.repeat(6001)}),()=>{throw Error('No inference');})).status,400);
});
test('environment key stays server-side and requires local or authenticated hosted access',async()=>{
 const env={OPENAI_API_KEY:'test-server-key-not-a-real-secret'};
 const config=url=>new Request(url+'/api/config');
 assert.deepEqual(await (await handleAPI(config('http://127.0.0.1:4317'),fetch,env)).json(),{serverKey:true});
 assert.deepEqual(await (await handleAPI(config('https://example.test'),fetch,env)).json(),{serverKey:false});
 const local=new Request('http://127.0.0.1:4317/api/check',{method:'POST'});
 let calls=0;assert.equal((await handleAPI(local,async(url,opts)=>{calls++;assert.equal(opts.headers.Authorization,'Bearer '+env.OPENAI_API_KEY);return Response.json({});},env)).status,200);assert.equal(calls,2);
 assert.equal((await handleAPI(new Request('https://example.test/api/check',{method:'POST'}),()=>{throw Error('No inference');},env)).status,401);
});

test('live clarification follows the complete draft and permits no question',()=>{
 const text='I want to explore physics and I want to understand the kepler laws.';
 assert.equal(liveClarificationFor(text,{question:'',options:[],phrase:''}),null);
 const focused=liveClarificationFor(text,{question:'Would a visual or mathematical explanation help?',options:['Visual','Mathematical'],phrase:'kepler laws'});
 assert.equal(text.slice(focused.start,focused.end),'kepler laws');
 assert.equal(focused.replace,false);
 assert.equal(liveClarificationFor(text,{question:'What level?',options:[],phrase:'quantum'}).phrase,null);
});
test('late or aborted previews never apply to a newer draft',()=>{
 assert.equal(isCurrentPreview(1,2,new AbortController().signal),false);
 const controller=new AbortController();controller.abort();assert.equal(isCurrentPreview(2,2,controller.signal),false);
 assert.equal(isCurrentPreview(2,2,new AbortController().signal),true);
});

test('automatic format and typed contextual refinements are accepted and bounded',async()=>{
 const refinement={type:'output_format',phrase:'Kepler laws',question:'How would you like to explore the laws?',options:['Orbit diagram','Mathematical derivation'],unit:''};
 const upstream=async(url,opts)=>{const request=JSON.parse(opts.body);assert.equal(JSON.parse(request.input).format,'Auto');assert.equal(request.text.format.schema.properties.information.items.properties.type.enum.length,28);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...demoPreview('Kepler laws'),information:[refinement]})}]}]});};
 assert.equal((await handleAPI(req({...payload,text:'Explain Kepler laws',format:'Auto'}),upstream)).status,200);
 assert.equal(validPreview({...demoPreview('Kepler laws'),information:[{...refinement,type:'execute_html'}]}),false);
});

test('Kepler diagrams are a bounded trusted component, not executable model content',async()=>{
 const request=new Request('http://127.0.0.1/api/preview',{method:'POST',headers:{Authorization:'Bearer test-key-not-a-real-secret','Content-Type':'application/json'},body:JSON.stringify({text:'Explain Kepler laws with an orbit diagram',format:'Diagram',audience:'High school',phase:'page'})});
 const response=await handleAPI(request,async(url,opts)=>{const sent=JSON.parse(opts.body);assert.ok(sent.text.format.schema.properties.kind.enum.includes('kepler'));assert.ok(sent.instructions.includes('use kind=kepler'));return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...demoPreview('Kepler'),kind:'kepler'})}]}]});});assert.equal(response.status,200);assert.equal((await response.json()).preview.kind,'kepler');
});
