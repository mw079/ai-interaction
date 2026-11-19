// Calls the API the way the server does: with the server's key from the environment and, unless a
// test passes its own, a fresh limiter so tests never share a daily count.
import {handleAPI as serverHandleAPI,createDailyLimiter} from '../api.mjs';
export const TEST_KEY='test-key-not-a-real-secret';
export function handleAPI(request,upstream,env={},options={}){
  return serverHandleAPI(request,upstream,{OPENAI_API_KEY:TEST_KEY,...env},{limiter:createDailyLimiter({perVisitor:Infinity,total:Infinity}),...options});
}
