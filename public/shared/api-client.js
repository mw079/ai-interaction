// Talks to the local /api/preview endpoint: builds the request context, streams partial
// results, retries a temporary failure once and enforces the per-connection request cap.
import {withSingleRetry,requestError} from './retry.js';
import {readSSE} from './stream.js';
import {validPreview} from './model.js';
import {confirmedChoices,requestContext} from '../composer/request-context.js';

export function createApiClient({state,pageContext,status}){
  function modelPayload(payload,onProgress){
    return {...payload,stream:typeof onProgress==='function'&&['preview','page-help'].includes(payload.phase),context:requestContext({explicitIntent:state.intentOverride,draft:payload.text,page:payload.context??pageContext(),confirmed:[...state.confirmedChoices,...confirmedChoices([...state.information,...state.answers])],date:new Date().toLocaleDateString('en-CA'),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})};
  }
  async function callPreview(payload,signal,onProgress,body=JSON.stringify(modelPayload(payload,onProgress))){
    const revision=state.revision;
    return withSingleRetry(()=>callPreviewAttempt(body,signal,onProgress),{signal,enabled:['preview','page','page-help'].includes(payload.phase),isCurrent:()=>state.revision===revision,onRetry:()=>{onProgress?.({reset:true});status('Connection interrupted. Retrying once…');}});
  }
  async function callPreviewAttempt(body,signal,onProgress){
    if(state.requests>=30)throw new Error('This connection has reached its 30-preview limit. Reconnect to enable another session, or use demo mode.');
    state.requests++;
    let response;try{response=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json',...(state.key?{'Authorization':`Bearer ${state.key}`}:{})},body,signal});}catch(error){if(signal?.aborted)throw error;throw requestError('Connection interrupted. Try again.',true);}
    if(!response.ok){let failure={};try{failure=await response.json();}catch{}throw requestError(failure.error||'Preview unavailable. Try again.',typeof failure.retryable==='boolean'?failure.retryable:response.status>=500);}
    let data;try{if(response.headers.get('Content-Type')?.includes('text/event-stream')){
      for await(const event of readSSE(response.body,{signal})){if(event.type==='partial')onProgress?.(event.preview);else if(event.type==='error')throw requestError(event.error||'The preview was interrupted.',event.retryable===true);else if(event.type==='done'){data=event;break;}}
      if(!data)throw requestError('The preview was interrupted. Try again.',true);
    }else data=await response.json();}catch(error){if(error instanceof TypeError&&!signal?.aborted)throw requestError('Connection interrupted. Try again.',true);throw error;}
    if(!validPreview(data.preview))throw new Error('The preview was invalid. Your page is unchanged.');return data;
  }
  return {modelPayload,callPreview};
}
