import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedChoices,requestContext} from '../public/request-context.js';
import {demoPreview} from '../public/model.js';
import {handleAPI} from '../api.mjs';
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
  const result=await handleAPI(request,async(url,opts)=>{const sent=JSON.parse(opts.body);assert.equal(sent.model,phase==='preview'?'gpt-6-luna':'gpt-6.1-terra');assert.equal(sent.instructions.includes('Also supply completion:'),phase==='preview');assert.ok(JSON.stringify(sent.input).includes('Beginner'));assert.ok(JSON.stringify(sent.input).includes('Prepare an intuitive exam revision guide'));assert.ok(sent.instructions.includes('context.explicitIntent'));return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoPreview('gravity'))}]}]});});assert.equal(result.status,200);
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
  assert.equal(result.status,200);assert.ok(sent.input.includes('Undergraduate'));assert.ok(sent.input.includes('Angular momentum and equal areas'));assert.ok(sent.input.includes('Which connection should we explore?'));assert.ok(sent.instructions.includes('Apply them to the actual answer content and the page'));if(phase==='preview')assert.ok(sent.instructions.includes('never propose choosing or requesting that same direction again'));
  assert.equal(sent.instructions.includes('Also supply completion:'),phase==='preview');
 }
});
