import test from 'node:test';import assert from 'node:assert/strict';
import {canAcceptCompletion,freshCompletion} from '../public/model.js';
import {handleAPI} from '../api.mjs';
const headers={'Content-Type':'application/json',Authorization:'Bearer test-key-not-a-real-secret',Origin:'https://example.test'};
const req=body=>new Request('https://example.test/api/preview',{method:'POST',headers,body:JSON.stringify({text:'An ellipse is an oval-shaped curve.',audience:'',format:'Auto',...body})});
test('completion only captures unmodified Tab at a collapsed end-of-draft caret',()=>{const p={text:'Explain orbits.',start:15,end:15,completion:'Use an example.'};assert.ok(canAcceptCompletion(p));for(const extra of [{start:0},{end:0},{composing:true},{modified:true},{completion:''}])assert.equal(canAcceptCompletion({...p,...extra}),false);});
test('selection uses Luna and suppresses any replacement',async()=>{
 const response=await handleAPI(req({phase:'selection'}),async(_,options)=>{
  const body=JSON.parse(options.body);
  assert.equal(body.model,'gpt-6-luna');
  assert.equal(body.store,false);
  assert.deepEqual(body.text.format.schema.required,['answer','replacement']);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'An ellipse is a closed oval.',replacement:'Revised passage.'})}]}]});
 });
 assert.equal(response.status,200);
 assert.equal((await response.json()).preview.replacement,'');
});

test('retired prototype requests and oversized selections stop before contacting the model',async()=>{
 const never=()=>assert.fail('Unexpected model request');
 for(const input of [
  {phase:'edit'},
  {interaction:'notebook'},
  {interaction:'canvas'},
  {phase:'selection',text:'a'.repeat(1001)}
 ])assert.equal((await handleAPI(req(input),never)).status,400);
});

test('multiple assistant messages use the final structured result, never concatenated JSON objects',async()=>{
 const response=await handleAPI(req({phase:'selection'}),async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Earlier draft',replacement:''})}]},{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Final scoped explanation',replacement:''})}]}]}));
 assert.equal(response.status,200);assert.equal((await response.json()).preview.body[0],'Final scoped explanation');
});

test('accepted or typed suggestions are suppressed even if Luna repeats them',()=>{
 const sentence='We’ll connect each law to Newtonian gravity.';
 const draft='I want to understand Kepler’s laws. '+sentence;
 for(const suggestion of [sentence,"WE'LL connect each law to Newtonian gravity!",'Connect each law to Newtonian gravity']){
  assert.equal(freshCompletion(draft,suggestion),'');
  assert.equal(canAcceptCompletion({text:draft,start:draft.length,end:draft.length,completion:suggestion}),false);
 }
 assert.equal(freshCompletion(draft,'Show how angular momentum enters.'),'Show how angular momentum enters.');
 assert.equal(freshCompletion('Plot x+1.','Plot x-1.'),'Plot x-1.');
});
