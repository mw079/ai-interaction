import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
try{loadEnvFile(new URL('./.env',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw new Error('Could not load local environment configuration.');}
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['build.mjs'],{cwd:new URL('.',import.meta.url),stdio:'inherit'});
let worker=await import('./dist/server/index.js');
const port=Number(process.env.PORT||4317);
const server=http.createServer(async(req,res)=>{
 try{
  const devFiles={'/__dev/pickers':'pickers.html','/__dev/pickers.js':'pickers.js','/__dev/components':'components.html','/__dev/components.js':'components.js','/__dev/component-fixtures.js':'component-fixtures.js'};
  const devFile=devFiles[new URL(req.url,'http://127.0.0.1').pathname];
  if(devFile&&req.method==='GET'){res.writeHead(200,{'Content-Type':devFile.endsWith('.js')?'application/javascript':'text/html','Cache-Control':'no-store'});res.end(await readFile(new URL('./dev/'+devFile,import.meta.url)));return;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>40000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.default.fetch(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY});res.writeHead(response.status,Object.fromEntries(response.headers));for await(const chunk of response.body||[]){if(res.destroyed)break;res.write(chunk);}res.end();
 }catch{if(res.destroyed)return;if(!res.headersSent){res.writeHead(500,{'Content-Type':'text/plain'});res.end('The local server could not complete this request.');}else res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`AI Interaction preview: http://127.0.0.1:${port}`));
