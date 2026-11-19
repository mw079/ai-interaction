// One bounded retry, never a polling loop. The same cancellation signal owns both attempts.
export function requestError(message,retryable=false){return Object.assign(new Error(message),{retryable});}
export function retryDelay(ms,signal){
 return new Promise((resolve,reject)=>{
  const aborted=()=>{clearTimeout(timer);signal?.removeEventListener('abort',aborted);reject(new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',aborted);resolve();},ms);
  if(signal?.aborted)aborted();else signal?.addEventListener('abort',aborted,{once:true});
 });
}
export async function withSingleRetry(operation,{signal,enabled=true,isCurrent=()=>true,onRetry=()=>{},delayMs=800,wait=retryDelay}={}){
 for(let attempt=0;attempt<2;attempt++){
  signal?.throwIfAborted();
  try{return await operation();}catch(error){
   signal?.throwIfAborted();
   if(attempt||!enabled||error.retryable!==true||!isCurrent())throw error;
   onRetry();await wait(delayMs,signal);signal?.throwIfAborted();
   if(!isCurrent())throw error;
  }
 }
}
