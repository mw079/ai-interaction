import {COMPONENT_SCHEMA,validPageHelp,validComponents,SLIDE_RECIPES,slideRecipe,matchesSlideRecipe,normaliseComponents} from './public/components/catalog.js';
import {readSSE,partialLivePreview,partialPageAnswer} from './public/shared/stream.js';
import {FORMATS,WORLDS,validPreview,isIncompleteComparison,tidyPage} from './public/shared/model.js';
import {modelInstructions,buildModelInput} from './prompts.mjs';

const string={type:'string'};
import {INFORMATION_TYPES} from './public/composer/intent.js';
const informationTypes=Object.keys(INFORMATION_TYPES);
const array=items=>({type:'array',items});
const PREVIEW_SCHEMA={type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['projectile','outline','planner','kepler']},title:string,interpretation:string,audience:string,questionKind:{type:'string',enum:['clarify','explore','none']},question:string,phrase:string,completion:string,options:array(string),body:array(string),nodes:array(string),information:array({type:'object',additionalProperties:false,properties:{type:{type:'string',enum:informationTypes},phrase:string,question:string,options:array(string),unit:string,samples:array(string)},required:['type','phrase','question','options','unit','samples']}),rows:array({type:'object',additionalProperties:false,properties:{criterion:string,a:string,b:string},required:['criterion','a','b']})},required:['kind','title','interpretation','audience','questionKind','question','phrase','options','body','nodes','rows','information','completion']};
PREVIEW_SCHEMA.properties.components={type:'array',items:COMPONENT_SCHEMA};PREVIEW_SCHEMA.required.push('components');
const PAGE_HELP_SCHEMA={type:'object',additionalProperties:false,properties:{answer:string,replacement:string,components:{type:'array',items:COMPONENT_SCHEMA}},required:['answer','replacement','components']};
PREVIEW_SCHEMA.properties.slideOptions={type:'array',items:{type:'string',enum:Object.keys(SLIDE_RECIPES)}};
PREVIEW_SCHEMA.required.push('slideOptions');
PREVIEW_SCHEMA.properties.followUps=array(string);PREVIEW_SCHEMA.required.push('followUps');
// The projectile simulator's starting launch, so a page about the Moon also simulates the Moon.
PREVIEW_SCHEMA.properties.launch={type:'object',additionalProperties:false,properties:{speed:{type:'number'},angle:{type:'number'},world:{type:'string',enum:Object.keys(WORLDS)}},required:['speed','angle','world']};PREVIEW_SCHEMA.required.push('launch');
// The model writes fields in this order, so put what the composer shows first: the answer, the
// question, the Tab prediction (short) and the highlights stream before page-only metadata.
{const p=PREVIEW_SCHEMA.properties;PREVIEW_SCHEMA.properties={body:p.body,question:p.question,phrase:p.phrase,options:p.options,questionKind:p.questionKind,completion:p.completion,information:p.information,...p};}
const DEEPER_SCHEMA={type:'object',additionalProperties:false,properties:{sections:{type:'array',items:{type:'object',additionalProperties:false,properties:{answer:string,components:{type:'array',items:COMPONENT_SCHEMA}},required:['answer','components']}}},required:['sections']};
const SELECTION_SCHEMA={type:'object',additionalProperties:false,properties:{answer:string,replacement:string},required:['answer','replacement']};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const eventStream=body=>new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'}});
// Daily request limits, enforced here on the server: each visitor (by IP) may make DAILY_LIMIT
// model requests per UTC day, and the whole app DAILY_TOTAL_LIMIT, a cap on the day's spending.
// Counts live in memory: they reset when the server restarts, and each Worker isolate keeps its
// own, so a public deployment should move them to a shared store (KV or a Durable Object).
export function createDailyLimiter({perVisitor=200,total=2000,now=()=>Date.now()}={}){
  let day='',visitors=new Map(),used=0;
  const today=()=>{const d=new Date(now()).toISOString().slice(0,10);if(d!==day){day=d;visitors=new Map();used=0;}};
  return {
    limited(visitor){today();return used>=total||(visitors.get(visitor)||0)>=perVisitor;},
    take(visitor){
      today();
      if(used>=total)return {ok:false,error:'The demo has reached today’s limit. Try again tomorrow.'};
      const count=visitors.get(visitor)||0;
      if(count>=perVisitor)return {ok:false,error:'You’ve reached today’s limit. Try again tomorrow.'};
      visitors.set(visitor,count+1);used++;
      return {ok:true,remaining:perVisitor-count-1};
    }
  };
}
let sharedLimiter;
const limiterFor=env=>sharedLimiter??=createDailyLimiter({perVisitor:Number(env.DAILY_LIMIT)||200,total:Number(env.DAILY_TOTAL_LIMIT)||2000});

// Visitors never supply a key: every request uses the server's OPENAI_API_KEY, within the daily limits.
export async function handleAPI(request,upstream=fetch,env={},{limiter=limiterFor(env),visitor='anonymous'}={}){
  const serverKey=!!env.OPENAI_API_KEY;
  if(new URL(request.url).pathname==='/api/config')return json({live:serverKey,limited:serverKey&&limiter.limited(visitor)});
  if(request.method!=='POST')return json({error:'Use POST for this action.'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'This request must come from the same website.'},403);
  if(!serverKey)return json({error:'Live answers are not available right now.'},503);
  const authorization=`Bearer ${env.OPENAI_API_KEY}`;
  if(new URL(request.url).pathname!=='/api/preview')return json({error:'Not found.'},404);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
  const reader=request.body?.getReader();if(!reader)return json({error:'Add a thought first.'},400);
  let payload;
  const chunks=[];let bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>40000){await reader.cancel();return json({error:'This preview is too long. Keep it under 4,000 characters.'},413);}chunks.push(value);}const data=new Uint8Array(bytes);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}payload=JSON.parse(new TextDecoder().decode(data));}catch{return json({error:'The request was not valid JSON.'},400);}
  if(!payload||(payload.stream!==undefined&&typeof payload.stream!=='boolean')||(payload.interaction!==undefined&&payload.interaction!=='unified')||(payload.context!==undefined&&(typeof payload.context!=='string'||payload.context.length>6000))||(payload.phase!==undefined&&!['preview','page','selection','page-help','deeper'].includes(payload.phase))||typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>4000||typeof payload.audience!=='string'||payload.audience.length>120||!FORMATS.includes(payload.format))return json({error:'Use a shorter thought, audience, and supported view.'},400);
  if(payload?.sources!==undefined)return json({error:'File attachments are unsupported. Paste relevant text into your request.'},400);
  if(payload?.promised!==undefined&&(payload.phase!=='page'||typeof payload.promised!=='string'||payload.promised.length>200))return json({error:'The preview could not be used with this request.'},400);
  if(payload?.pageScope!==undefined && (payload.phase!=='page'||!payload.pageScope||
    typeof payload.pageScope.id!=='string'||!/^(?:passage:[0-5](?::selection)?|block:[a-z][a-z0-9-]{0,39})$/.test(payload.pageScope.id)||
    typeof payload.pageScope.text!=='string'||payload.pageScope.text.length>4500))
    return json({error:'Choose an available part of the page.'},400);
  const contextInstructions=(payload?.pageScope?' The explicit pageScope is the only target. For a passage, return its replacement text alone in body[0]. For a block, return the replacement block with exactly the target ID after block: in components. Retain the existing component type unless the user asks to change it.':'');
  const requestedSlide=payload?.slideChoice;
  const recipe=slideRecipe(requestedSlide);
  if(requestedSlide!==undefined && (payload.phase!=='page'||!recipe))return json({error:'Choose an available slide format.'},400);
  if(payload?.phase==='preview'&&isIncompleteComparison(payload.text)){
    const preview={kind:'outline',title:'',interpretation:'',audience:'',questionKind:'none',question:'',phrase:'',options:[],body:[],nodes:[],rows:[],information:[],completion:'',components:[],slideOptions:[]};
    const result={preview,waiting:true};
    return payload.stream?eventStream('data: '+JSON.stringify({type:'done',...result})+'\n\n'):json(result);
  }
  const slideInstructions=recipe
    ? ' The user selected '+requestedSlide+'. Make it the primary presentation. '+(recipe.kind?'Use kind='+recipe.kind+'.':'Use kind=outline and include '+recipe.blocks.join(', ')+' in components.')+' This selection takes priority over default formats. Return slideOptions empty.'
    : ' Return slideOptions empty for a generated page.';
  const deeper=payload?.phase==='deeper';
  if(deeper&&(!Array.isArray(payload.followUps)||!payload.followUps.length||payload.followUps.length>3||!payload.followUps.every(q=>typeof q==='string'&&q.trim()&&q.length<=90)))return json({error:'Choose up to three short follow-up questions.'},400);
  const pageHelp=payload?.phase==='page-help';
  if(pageHelp&&(!payload.target||typeof payload.target.id!=='string'||payload.target.id.length>100||typeof payload.target.text!=='string'||payload.target.text.length>2500||(payload.target.quote!==undefined&&(typeof payload.target.quote!=='string'||payload.target.quote.length>600))||(payload.target.practice!==undefined&&(typeof payload.target.practice!=='string'||payload.target.practice.length>1500))||payload.text.length>1000))return json({error:'Choose a shorter passage and question.'},400);
  if(pageHelp&&!validPageActivity(payload.target))return json({error:'Choose a passage or describe a change.'},400);
  const selection=payload?.phase==='selection';
  if(selection&&payload.text.length>1000)return json({error:'Choose a shorter passage for local help.'},400);
  const page=payload?.phase==='page';const model=page?'gpt-6.1-terra':'gpt-6-luna';
  const streamAbort=new AbortController();const streaming=payload?.stream===true&&(payload.phase==='preview'||pageHelp);
  const start=Date.now();const timeout=AbortSignal.timeout(page?45000:25000);const signal=AbortSignal.any([request.signal,timeout,streamAbort.signal]);
  // Count only requests that will reach OpenAI: invalid ones above cost nothing and are not counted.
  const allowance=limiter.take(visitor);
  if(!allowance.ok)return json({error:allowance.error,limit:'daily',retryable:false},429);
  try{
    const response=await upstream('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},redirect:'error',signal,
      ...({body:JSON.stringify({model,store:false,...(streaming?{stream:true}:{}),reasoning:{effort:page?'low':'none'},max_output_tokens:page?5000:pageHelp?2200:deeper?2600:1300,
        instructions:modelInstructions(payload,slideInstructions,contextInstructions),
        input:JSON.stringify(buildModelInput(payload,{slideLabel:recipe?.label})),text:{format:{type:'json_schema',name:deeper?'go_deeper':pageHelp||selection?'local_assistance':'interactive_preview',strict:true,schema:deeper?DEEPER_SCHEMA:pageHelp?PAGE_HELP_SCHEMA:selection?SELECTION_SCHEMA:PREVIEW_SCHEMA}}
      })})
    });
    if(!response.ok){const messages={401:'Live answers are not available right now.',403:'Live answers are not available right now.',404:'Live answers are not available right now.',429:'The service is busy. Try again in a moment.'};return json({retryable:response.status>=500,error:messages[response.status]||'OpenAI could not complete the request. Your page is unchanged.'},[401,403,404].includes(response.status)?503:response.status===429?503:502);}
    const resultOptions={model,start,selection,pageHelp,recipe,activity:payload?.target?.mode,tidy:payload?.phase==='page'&&!payload.pageScope,deeper:deeper?payload.followUps.length:0};
    if(streaming)return liveStreamResponse(response,resultOptions,signal,()=>streamAbort.abort());
    return finishModelResponse(await response.json(),resultOptions);
  }catch(error){return json({retryable:!request.signal.aborted,error:error.name==='TimeoutError'||timeout.aborted?`${model} took too long. Try again.`:'Connection interrupted. Your page is unchanged; try again.'},504);}
}

function validPageActivity(target){
  const {mode,quote,added,removed}=target;
  if(mode==='edit')return typeof added==='string'&&added.length<=1000&&
    typeof removed==='string'&&removed.length<=1000&&!!(added.trim()||removed.trim());
  if(added!==undefined||removed!==undefined)return false;
  if(mode==='selection')return !!quote?.trim();
  return mode===undefined||mode==='question'||mode==='rewrite';
}

function finishModelResponse(data,{model,start,selection=false,pageHelp=false,recipe,activity,tidy=false,deeper=0}){
if(data.status!=='completed')return json({retryable:false,error:'The preview was incomplete. Shorten the request or try again.'},502);
    const content=(data.output||[]).filter(i=>i.type==='message').at(-1)?.content||[];if(content.some(c=>c.type==='refusal'))return json({error:'The model declined this request. Try a different topic.'},422);
    let preview;try{preview=JSON.parse(content.filter(c=>c.type==='output_text').map(c=>c.text).join(''));}catch{return json({retryable:false,error:'The model did not return a valid preview. Your page is unchanged.'},502);}
    // Optional suggestion lists are trimmed rather than rejected: a fourth option or follow-up
    // question should not cost the user the whole answer. Content (body, components) is never cut.
    if(preview&&typeof preview==='object')for(const [key,max] of [['options',3],['followUps',3],['information',6],['slideOptions',3]])
      if(Array.isArray(preview[key])&&preview[key].length>max)preview[key]=preview[key].slice(0,max);
    if(preview?.components)preview.components=normaliseComponents(preview.components);
    if(Array.isArray(preview?.sections))preview.sections=preview.sections.map(section=>section?.components?{...section,components:normaliseComponents(section.components)}:section);
    if(deeper){
      if(!validDeeper(preview,deeper))return json({retryable:false,error:'The follow-up answers exceeded supported limits.'},502);
      return json({preview:{kind:'outline',title:'Go deeper',interpretation:'',audience:'',question:'',phrase:'',options:[],body:[],nodes:[],rows:[],information:[],completion:'',components:[]},deeper:preview.sections,model,elapsedMs:Date.now()-start});
    }
    if(pageHelp){
      if(!validPageHelp(preview))return json({retryable:false,error:'The proposed change exceeded supported limits. Your page is unchanged.'},502);
      const canPropose=activity!=='selection';
      return json({preview:{kind:'outline',title:'Page response',interpretation:'',audience:'',question:'',phrase:'',options:[],body:preview.answer?[preview.answer]:[],nodes:[],rows:[],information:[],completion:'',replacement:canPropose?preview.replacement:'',components:canPropose?preview.components:[]},model,elapsedMs:Date.now()-start});
    }
    if(selection){
      if(!preview||typeof preview.answer!=='string'||preview.answer.length>700||typeof preview.replacement!=='string'||preview.replacement.length>2000)
        return json({retryable:false,error:'Local help exceeded its limits. Your page is unchanged.'},502);
      preview={kind:'outline',title:'Local help',interpretation:'',audience:'',question:'',phrase:'',options:[],body:[preview.answer],nodes:[],rows:[],information:[],completion:'',replacement:''};
    }
    if(tidy)preview=tidyPage(preview);
    if(!validPreview(preview))return json({retryable:false,error:'The answer did not fit the page format. Your page is unchanged; try again or rephrase.'},502);
    if(recipe&&!matchesSlideRecipe(preview,recipe))return json({retryable:true,error:'The model missed the selected slide format. Try again.'},502);
    return json({preview,model,elapsedMs:Date.now()-start,usage:{input_tokens:data.usage?.input_tokens,output_tokens:data.usage?.output_tokens,total_tokens:data.usage?.total_tokens}});
}

function liveStreamResponse(upstream,resultOptions,signal,abort){
 const partialResponse=resultOptions.pageHelp?partialPageAnswer:partialLivePreview;
 const encoder=new TextEncoder();let cancelled=false;
 const body=new ReadableStream({async start(controller){
  const send=value=>{if(!cancelled)controller.enqueue(encoder.encode('data: '+JSON.stringify(value)+'\n\n'));};
  let text='',item=null,previous='',completed=false;
  try{
   for await(const event of readSSE(upstream.body,{signal})){
    if(event.type==='response.output_text.delta'){
     if(item!==null&&item!==event.item_id){text='';previous='';send({type:'partial',preview:{reset:true}});}item=event.item_id;
     if(typeof event.delta!=='string')continue;text+=event.delta;if(text.length>40000)throw new Error('Oversized preview');
     const preview=partialResponse(text),encoded=JSON.stringify(preview);if(encoded!==previous&&Object.keys(preview).length){previous=encoded;send({type:'partial',preview});}
    }else if(event.type==='response.completed'){
     const result=finishModelResponse(event.response,resultOptions);const data=await result.json();send(result.ok?{type:'done',...data}:{type:'error',error:data.error,retryable:data.retryable===true});completed=true;break;
    }else if(['response.failed','response.incomplete','error','response.refusal.done'].includes(event.type)){const code=event.response?.error?.code||event.error?.code||event.code;const retryable=['server_error','internal_server_error','timeout'].includes(code);throw Object.assign(new Error('Incomplete preview'),{retryable});}
   }
   if(!completed)throw new Error('Interrupted preview');
  }catch(error){if(!cancelled)send({type:'error',error:'The live preview was interrupted. Keep typing or try again.',retryable:error.retryable??(!signal.aborted||signal.reason?.name==='TimeoutError')});}
  finally{if(!cancelled)controller.close();abort();}
 },cancel(){cancelled=true;abort();}});
 return eventStream(body);
}

// Go deeper: one short answer per follow-up question, each with at most one small component.
export function validDeeper(value,count){
  return !!value&&Array.isArray(value.sections)&&value.sections.length===count&&value.sections.every(section=>
    section&&typeof section.answer==='string'&&section.answer.trim()&&section.answer.length<=420&&
    Array.isArray(section.components)&&section.components.length<=1&&validComponents(section.components));
}
