import http from 'node:http';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['build.mjs'],{cwd:new URL('.',import.meta.url),stdio:'inherit'});
let worker=await import('./dist/server/index.js');
const port=Number(process.env.PORT||4317);
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>16000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.default.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'text/plain'});res.end('The local server could not complete this request.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`AI Interaction preview: http://127.0.0.1:${port}`));
