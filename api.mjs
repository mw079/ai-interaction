import {COMPONENT_SCHEMA,validPageHelp,SLIDE_RECIPES,slideRecipe,matchesSlideRecipe} from './public/component-catalog.js';
import {readSSE,partialLivePreview} from './public/stream.js';
import {FORMATS,validPreview} from './public/model.js';
import {modelInstructions} from './prompts.mjs';

const string={type:'string'};
import {INFORMATION_TYPES} from './public/intent.js';
const informationTypes=Object.keys(INFORMATION_TYPES);
const array=items=>({type:'array',items});
export const PREVIEW_SCHEMA={type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['projectile','outline','diagram','comparison','planner','kepler']},title:string,interpretation:string,audience:string,questionKind:{type:'string',enum:['clarify','explore','none']},question:string,phrase:string,completion:string,options:array(string),body:array(string),nodes:array(string),information:array({type:'object',additionalProperties:false,properties:{type:{type:'string',enum:informationTypes},phrase:string,question:string,options:array(string),unit:string,samples:array(string)},required:['type','phrase','question','options','unit','samples']}),rows:array({type:'object',additionalProperties:false,properties:{criterion:string,a:string,b:string},required:['criterion','a','b']})},required:['kind','title','interpretation','audience','questionKind','question','phrase','options','body','nodes','rows','information','completion']};
PREVIEW_SCHEMA.properties.components={type:'array',items:COMPONENT_SCHEMA};PREVIEW_SCHEMA.required.push('components');
export const PAGE_HELP_SCHEMA={type:'object',additionalProperties:false,properties:{answer:string,replacement:string,components:{type:'array',items:COMPONENT_SCHEMA}},required:['answer','replacement','components']};
PREVIEW_SCHEMA.properties.slideOptions={type:'array',items:{type:'string',enum:Object.keys(SLIDE_RECIPES)}};
PREVIEW_SCHEMA.required.push('slideOptions');
// Put visible draft fields first so streaming delivers useful content before metadata.
PREVIEW_SCHEMA.properties={body:PREVIEW_SCHEMA.properties.body,question:PREVIEW_SCHEMA.properties.question,phrase:PREVIEW_SCHEMA.properties.phrase,options:PREVIEW_SCHEMA.properties.options,...PREVIEW_SCHEMA.properties};
const SELECTION_SCHEMA={type:'object',additionalProperties:false,properties:{answer:string,replacement:string},required:['answer','replacement']};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export async function handleAPI(request,upstream=fetch,env={}){
  const local=new URL(request.url).hostname==='127.0.0.1';
  const serverKey=env.OPENAI_API_KEY&&(local||request.headers.has('oai-authenticated-user-id'));
  if(new URL(request.url).pathname==='/api/config')return json({serverKey:!!serverKey});
  if(request.method!=='POST')return json({error:'Use POST for this action.'},405);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'This request must come from the same website.'},403);
  const authorization=request.headers.get('Authorization')||(serverKey?`Bearer ${env.OPENAI_API_KEY}`:'');
  if(!/^Bearer [A-Za-z0-9_-]{16,300}$/.test(authorization))return json({error:'Add your OpenAI API key to use Luna.'},401);
  const path=new URL(request.url).pathname;if(!['/api/check','/api/preview'].includes(path))return json({error:'Not found.'},404);
  let payload;
  if(path==='/api/preview'){
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
    const reader=request.body?.getReader();if(!reader)return json({error:'Add a thought first.'},400);
    const chunks=[];let bytes=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>40000){await reader.cancel();return json({error:'This preview is too long. Keep it under 4,000 characters.'},413);}chunks.push(value);}const data=new Uint8Array(bytes);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}payload=JSON.parse(new TextDecoder().decode(data));}catch{return json({error:'The request was not valid JSON.'},400);}
    if(!payload||(payload.stream!==undefined&&typeof payload.stream!=='boolean')||(payload.interaction!==undefined&&payload.interaction!=='unified')||(payload.context!==undefined&&(typeof payload.context!=='string'||payload.context.length>6000))||(payload.phase!==undefined&&!['preview','page','selection','page-help'].includes(payload.phase))||typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>4000||typeof payload.audience!=='string'||payload.audience.length>120||!FORMATS.includes(payload.format))return json({error:'Use a shorter thought, audience, and supported view.'},400);
  }
  if(payload?.sources!==undefined)return json({error:'File attachments are unsupported. Paste relevant text into your request.'},400);
  if(payload?.pageScope!==undefined && (payload.phase!=='page'||!payload.pageScope||
    typeof payload.pageScope.id!=='string'||!/^(?:passage:[0-5](?::selection)?|block:[a-z][a-z0-9-]{0,39})$/.test(payload.pageScope.id)||
    typeof payload.pageScope.text!=='string'||payload.pageScope.text.length>4500))
    return json({error:'Choose an available part of the page.'},400);
  const contextInstructions=(payload?.pageScope?' The explicit pageScope is the only target. For a passage, return its replacement text alone in body[0]. For a block, return the replacement block with exactly the target ID after block: in components. Retain the existing component type unless the user asks to change it.':'');
  const requestedSlide=payload?.slideChoice;
  const recipe=slideRecipe(requestedSlide);
  if(requestedSlide!==undefined && (payload.phase!=='page'||!recipe))return json({error:'Choose an available slide format.'},400);
  const slideInstructions=recipe
    ? ' The user selected '+requestedSlide+'. Make it the primary presentation. '+(recipe.kind?'Use kind='+recipe.kind+'.':'Use kind=outline and include '+recipe.blocks.join(', ')+' in components.')+' This selection takes priority over default formats. Return slideOptions empty.'
    : ' Return slideOptions empty for a generated page.';
  const pageHelp=payload?.phase==='page-help';
  if(pageHelp&&(!payload.target||typeof payload.target.id!=='string'||payload.target.id.length>100||typeof payload.target.text!=='string'||payload.target.text.length>2500||(payload.target.quote!==undefined&&(typeof payload.target.quote!=='string'||payload.target.quote.length>600))||(payload.target.practice!==undefined&&(typeof payload.target.practice!=='string'||payload.target.practice.length>1500))||payload.text.length>1000))return json({error:'Choose a shorter passage and question.'},400);
  if(pageHelp&&!validPageActivity(payload.target))return json({error:'Choose a passage or describe a change.'},400);
  const selection=payload?.phase==='selection';
  if(selection&&payload.text.length>1000)return json({error:'Choose a shorter passage for local help.'},400);
  const page=payload?.phase==='page';const model=page?'gpt-6.1-terra':'gpt-6-luna';
  const streamAbort=new AbortController();const streaming=payload?.stream===true&&payload.phase==='preview';
  const start=Date.now();const timeout=AbortSignal.timeout(page?45000:25000);const signal=AbortSignal.any([request.signal,timeout,streamAbort.signal]);
  try{
    const check=path==='/api/check';
    const response=await upstream(check?'https://api.openai.com/v1/models/gpt-6-luna':'https://api.openai.com/v1/responses',{
      method:check?'GET':'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},redirect:'error',signal,
      ...(check?{}:{body:JSON.stringify({model,store:false,...(streaming?{stream:true}:{}),reasoning:{effort:page?'low':'none'},max_output_tokens:page?3400:pageHelp?2200:1300,
        instructions:modelInstructions(payload,slideInstructions,contextInstructions),
        input:JSON.stringify(payload),text:{format:{type:'json_schema',name:pageHelp||selection?'local_assistance':'interactive_preview',strict:true,schema:pageHelp?PAGE_HELP_SCHEMA:selection?SELECTION_SCHEMA:PREVIEW_SCHEMA}}
      })})
    });
    if(!response.ok){const messages={401:'OpenAI rejected this key. Check it and try again.',403:`This key cannot access ${model}.`,404:`${model} is not available for this key.`,429:'OpenAI quota or rate limit reached. Check API billing or try again later.'};return json({retryable:response.status>=500,error:messages[response.status]||'OpenAI could not complete the request. Your page is unchanged.'},[401,403,404,429].includes(response.status)?response.status:502);}
    if(check){const terra=await upstream('https://api.openai.com/v1/models/gpt-6.1-terra',{method:'GET',headers:{Authorization:authorization},redirect:'error',signal});if(!terra.ok)return json({error:'This key can access Luna, but GPT-6.1 Terra access could not be verified. Check model permissions and try again.'},terra.status===429?429:403);return json({connected:true,models:{preview:'gpt-6-luna',page:'gpt-6.1-terra'}});}
    if(streaming)return liveStreamResponse(response,{model,start,signal,abort:()=>streamAbort.abort()});
    return finishModelResponse(await response.json(),{model,start,selection,pageHelp,recipe,activity:payload?.target?.mode});
  }catch(error){return json({retryable:!request.signal.aborted,error:error.name==='TimeoutError'||timeout.aborted?`${model} took too long. Try again.`:'Connection interrupted. Your page is unchanged; try again.'},504);}
}

function validPageActivity(target){
  const {mode,quote,added,removed}=target;
  if(mode==='edit')return typeof added==='string'&&added.length<=1000&&
    typeof removed==='string'&&removed.length<=1000&&!!(added.trim()||removed.trim());
  if(added!==undefined||removed!==undefined)return false;
  if(mode==='selection')return !!quote?.trim();
  return mode===undefined||mode==='question';
}

function finishModelResponse(data,{model,start,selection=false,pageHelp=false,recipe,activity}){
if(data.status!=='completed')return json({retryable:false,error:'The preview was incomplete. Shorten the request or try again.'},502);
    const content=(data.output||[]).filter(i=>i.type==='message').at(-1)?.content||[];if(content.some(c=>c.type==='refusal'))return json({error:'The model declined this request. Try a different topic.'},422);
    let preview;try{preview=JSON.parse(content.filter(c=>c.type==='output_text').map(c=>c.text).join(''));}catch{return json({retryable:false,error:'The model did not return a valid preview. Your page is unchanged.'},502);}
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
    if(!validPreview(preview))return json({retryable:false,error:'The generated preview exceeded supported limits. Try a simpler request.'},502);
    if(recipe&&!matchesSlideRecipe(preview,recipe))return json({retryable:true,error:'The model missed the selected slide format. Try again.'},502);
    return json({preview,model,elapsedMs:Date.now()-start,usage:{input_tokens:data.usage?.input_tokens,output_tokens:data.usage?.output_tokens,total_tokens:data.usage?.total_tokens}});
}

function liveStreamResponse(upstream,{model,start,signal,abort}){
 const encoder=new TextEncoder();let cancelled=false;
 const body=new ReadableStream({async start(controller){
  const send=value=>{if(!cancelled)controller.enqueue(encoder.encode('data: '+JSON.stringify(value)+'\n\n'));};
  let text='',item=null,previous='',completed=false;
  try{
   for await(const event of readSSE(upstream.body,{signal})){
    if(event.type==='response.output_text.delta'){
     if(item!==null&&item!==event.item_id){text='';previous='';send({type:'partial',preview:{reset:true}});}item=event.item_id;
     if(typeof event.delta!=='string')continue;text+=event.delta;if(text.length>40000)throw new Error('Oversized preview');
     const preview=partialLivePreview(text),encoded=JSON.stringify(preview);if(encoded!==previous&&Object.keys(preview).length){previous=encoded;send({type:'partial',preview});}
    }else if(event.type==='response.completed'){
     const result=finishModelResponse(event.response,{model,start});const data=await result.json();send(result.ok?{type:'done',...data}:{type:'error',error:data.error,retryable:data.retryable===true});completed=true;break;
    }else if(['response.failed','response.incomplete','error','response.refusal.done'].includes(event.type)){const code=event.response?.error?.code||event.error?.code||event.code;const retryable=['server_error','internal_server_error','timeout'].includes(code);throw Object.assign(new Error('Incomplete preview'),{retryable});}
   }
   if(!completed)throw new Error('Interrupted preview');
  }catch(error){if(!cancelled)send({type:'error',error:'The live preview was interrupted. Keep typing or try again.',retryable:error.retryable??(!signal.aborted||signal.reason?.name==='TimeoutError')});}
  finally{if(!cancelled)controller.close();abort();}
 },cancel(){cancelled=true;abort();}});
 return new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'}});
}
