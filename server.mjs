import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
try{loadEnvFile(new URL('./.env',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw new Error('Could not load local environment configuration.');}
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['build.mjs'],{cwd:new URL('.',import.meta.url),stdio:'inherit'});
let worker=await import('./dist/server/index.js');
const port=Number(process.env.PORT||4317);
// On Render (which sets RENDER=true) the app is public: it listens on every interface, trusts the
// visitor address Cloudflare writes into CF-Connecting-IP, and hides the developer pages. Locally it
// stays on 127.0.0.1, where a CF-Connecting-IP header could only come from the visitor and is dropped.
const hosted=process.env.RENDER==='true';
const host=process.env.HOST||(hosted?'0.0.0.0':'127.0.0.1');
const server=http.createServer(async(req,res)=>{
 try{
  const devFiles={'/__dev/controls':'controls.html','/__dev/controls.js':'controls.js','/__dev/pickers':'controls.html','/__dev/components':'components.html','/__dev/components.js':'components.js','/__dev/component-fixtures.js':'component-fixtures.js'};
  const devFile=!hosted&&devFiles[new URL(req.url,'http://127.0.0.1').pathname];
  if(devFile&&req.method==='GET'){res.writeHead(200,{'Content-Type':devFile.endsWith('.js')?'application/javascript':'text/html','Cache-Control':'no-store'});res.end(await readFile(new URL('./dev/'+devFile,import.meta.url)));return;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>40000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  // The daily limit counts per visitor. Locally the visitor is the connection address; any
  // CF-Connecting-IP header was sent by the visitor and could dodge the limit, so it is dropped.
  const headers={...req.headers};if(!hosted)delete headers['cf-connecting-ip'];
  const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.default.fetch(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY,DAILY_LIMIT:process.env.DAILY_LIMIT,DAILY_TOTAL_LIMIT:process.env.DAILY_TOTAL_LIMIT,LOCAL_VISITOR:req.socket.remoteAddress});res.writeHead(response.status,Object.fromEntries(response.headers));for await(const chunk of response.body||[]){if(res.destroyed)break;res.write(chunk);}res.end();
 }catch{if(res.destroyed)return;if(!res.headersSent){res.writeHead(500,{'Content-Type':'text/plain'});res.end('The local server could not complete this request.');}else res.end();}
});
server.listen(port,host,()=>console.log(`AI Interaction: http://${host==='0.0.0.0'?'localhost':host}:${port}`));
