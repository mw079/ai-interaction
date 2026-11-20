import {validInformation} from '../composer/intent.js';
// Shared SSE framing. Handles arbitrary UTF-8/network chunk boundaries and cancellation.
export async function* readSSE(body,{signal}={}){
 if(!body)throw new Error('The stream was empty.');
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='',bytes=0;
 const abort=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
 try{
  while(true){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const {done,value}=await reader.read();if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   bytes+=value?.byteLength||0;if(bytes>2000000)throw new Error('The stream exceeded its limit.');
   buffer+=(done?decoder.decode():decoder.decode(value,{stream:true}));buffer=buffer.replace(/\r\n/g,'\n');
   if(done&&buffer.trim())buffer+='\n\n';
   let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')continue;yield JSON.parse(data);}
   if(done)break;
  }
 }finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function streamString(text,start){
 for(let i=start+1;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]==='"'){try{return {value:JSON.parse(text.slice(start,i+1)),end:i+1,complete:true};}catch{return null;}}}
 const raw=text.slice(start+1);for(let cut=0;cut<=Math.min(6,raw.length);cut++){try{return {value:JSON.parse('"'+raw.slice(0,raw.length-cut)+'"'),end:text.length,complete:false};}catch{}}
 return null;
}
function streamValueEnd(text,start){
 if(text[start]==='"'){const s=streamString(text,start);return s?.complete?s.end:-1;}
 let depth=0;for(let i=start;i<text.length;i++){const c=text[i];if(c==='"'){const s=streamString(text,i);if(!s?.complete)return -1;i=s.end-1;continue;}if(c==='['||c==='{')depth++;else if(c===']'||c==='}'){depth--;if(depth===0)return i+1;if(depth<0)return i;}else if(c===','&&depth===0)return i;}
 return -1;
}
// The finished elements of an array that is still streaming: '[{…},{…},{"ty' → the first two.
function completeItems(text,start){
 const items=[];let i=start+1;
 while(i<text.length){
  while(i<text.length&&/[\s,]/.test(text[i]))i++;
  if(text[i]!=='{'&&text[i]!=='"')break;
  const end=streamValueEnd(text,i);
  if(end<0||text[end-1]!=='}'&&text[end-1]!=='"')break;
  try{items.push(JSON.parse(text.slice(i,end)));}catch{break;}
  i=end;
 }
 return items;
}
function partialFields(text){
 const fields=Object.create(null),complete=new Set();let i=0;while(/\s/.test(text[i]||'')&&i<text.length)i++;if(text[i++]!=='{')return {fields,complete};
 const skip=()=>{while(i<text.length&&/\s|,/.test(text[i]))i++;};
 while(i<text.length){skip();if(text[i]!== '"')break;const key=streamString(text,i);if(!key?.complete)break;i=key.end;skip();if(text[i++]!==':')break;skip();const start=i,end=streamValueEnd(text,start);
  if(end<0){if(text[start]==='"'){const value=streamString(text,start);if(value)fields[key.value]=value.value;}else if(key.value==='body'&&text[start]==='['){i=start+1;skip();if(text[i]==='"'){const value=streamString(text,i);if(value)fields.body=[value.value];}}else if(text[start]==='[')fields[key.value]=completeItems(text,start);break;}
  try{fields[key.value]=JSON.parse(text.slice(start,end));complete.add(key.value);}catch{break;}i=end;
 }
 return {fields,complete};
}

// Only expose bounded display text before the complete structured result is validated.
export function partialPageAnswer(text){
 const {fields}=partialFields(text);
 return typeof fields.answer==='string'?{answer:fields.answer.slice(0,600)}:{};
}

export function partialLivePreview(text){
 const {fields,complete}=partialFields(text);
 const result={};
 // Each highlight and the Tab prediction are sent as soon as they are complete, one at a time,
 // and only once each passes the same validation as the final answer.
 if(Array.isArray(fields.information)){const ready=fields.information.filter(item=>validInformation([item])).slice(0,6);if(ready.length)result.information=ready;}
 if(complete.has('completion')&&typeof fields.completion==='string'&&fields.completion.length<=180)result.completion=fields.completion;if(Array.isArray(fields.body)&&typeof fields.body[0]==='string')result.answer=fields.body[0].slice(0,160);
 if(typeof fields.question==='string'){result.question=fields.question.slice(0,200);result.questionReady=complete.has('question')&&complete.has('options')&&complete.has('phrase');}
 if(complete.has('phrase')&&typeof fields.phrase==='string')result.phrase=fields.phrase.slice(0,120);
 if(complete.has('options')&&Array.isArray(fields.options)&&fields.options.length<=5&&fields.options.every(v=>typeof v==='string'&&v.length<=100))result.options=fields.options;
 return result;
}
