import test from 'node:test';import assert from 'node:assert/strict';
import {PROTOTYPES,canAcceptCompletion,currentTarget,validAssistResult} from '../public/prototype-model.js';
import {handleAPI} from '../api.mjs';
const headers={'Content-Type':'application/json',Authorization:'Bearer test-key-not-a-real-secret',Origin:'https://example.test'};
const req=body=>new Request('https://example.test/api/preview',{method:'POST',headers,body:JSON.stringify({text:'An ellipse is an oval-shaped curve.',audience:'',format:'Auto',...body})});
test('five distinct prototype identities are available',()=>{assert.equal(PROTOTYPES.length,5);assert.equal(new Set(PROTOTYPES.map(x=>x.id)).size,5);});
test('completion only captures unmodified Tab at a collapsed end-of-draft caret',()=>{const p={text:'Explain orbits.',start:15,end:15,completion:'Use an example.'};assert.ok(canAcceptCompletion(p));for(const extra of [{start:0},{end:0},{composing:true},{modified:true},{completion:''}])assert.equal(canAcceptCompletion({...p,...extra}),false);});
test('local patches cannot apply over later user edits or disconnected targets',()=>{const p={requestVersion:2,currentVersion:2,before:'A',current:'A'};assert.ok(currentTarget(p));assert.equal(currentTarget({...p,currentVersion:3}),false);assert.equal(currentTarget({...p,current:'B'}),false);assert.equal(currentTarget({...p,connected:false}),false);});
test('selection and edit requests use Luna and a focused schema; selection never returns a patch',async()=>{
 for(const phase of ['selection','edit']){const r=await handleAPI(req({phase,interaction:phase==='edit'?'notebook':'lens'}),async(url,opts)=>{const p=JSON.parse(opts.body);assert.equal(p.model,'gpt-6-luna');assert.equal(p.store,false);assert.deepEqual(p.text.format.schema.required,['answer','replacement']);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'An ellipse is a closed oval.',replacement:'Revised passage.'})}]}]});});assert.equal(r.status,200);const data=await r.json();assert.equal(data.preview.replacement,phase==='edit'?'Revised passage.':'');}
});
test('invalid modes, long selections and oversized edit results are rejected',async()=>{const never=()=>{throw Error('Unexpected call');};assert.equal((await handleAPI(req({interaction:'untrusted'}),never)).status,400);assert.equal((await handleAPI(req({phase:'selection',text:'a'.repeat(1001)}),never)).status,400);assert.equal(validAssistResult({answer:'Okay',replacement:'a'.repeat(2001)}),false);});

test('multiple assistant messages use the final structured result, never concatenated JSON objects',async()=>{
 const response=await handleAPI(req({phase:'selection',interaction:'lens'}),async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Earlier draft',replacement:''})}]},{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Final scoped explanation',replacement:''})}]}]}));
 assert.equal(response.status,200);assert.equal((await response.json()).preview.body[0],'Final scoped explanation');
});
