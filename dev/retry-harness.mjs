// Isolated local-only browser QA. Fake upstream; no real key, billing or deployment.
import http from 'node:http';
import {handleAPI} from '../api.mjs';
import worker from '../dist/server/index.js';
const port=4318;let mode='success',calls=[],failed=false;
const fixture=text=>({kind:'outline',title:'Kepler laws',interpretation:'Understand planetary motion.',audience:'',questionKind:'clarify',question:'Who is this explanation for?',phrase:'',options:['High school','Undergraduate'],body:['Planets sweep out equal areas in equal times.'],nodes:[],rows:[],information:[],completion:'Include a simple example.',outline:[]});
const server=http.createServer(async(req,res)=>{try{
 const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const path=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
 if(path==='/__test/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode,calls}));return;}
 if(path==='/__test/reset'&&req.method==='POST'){mode=JSON.parse(body).mode;calls=[];failed=false;res.end('ok');return;}
 const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}:{})});
 const response=path.startsWith('/api/')?await handleAPI(request,async(url,opts)=>{
  if(opts.method==='GET')return Response.json({id:'test-model'});
  const input=JSON.parse(opts.body),entry={text:JSON.parse(input.input).text,at:Date.now(),status:200};calls.push(entry);
  if(mode==='temporary'&&!failed){failed=true;entry.status=503;return new Response('{}',{status:503});}
  const text=JSON.stringify(fixture(entry.text));
  return new Response(new ReadableStream({start(c){for(const e of [{type:'response.output_text.delta',item_id:'test',delta:JSON.stringify({body:['Planets sweep out equal areas in equal times.']}).slice(0,-1)},{type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]}}])c.enqueue(new TextEncoder().encode('data: '+JSON.stringify(e)+'\n\n'));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
 },{OPENAI_API_KEY:'local-test-placeholder-not-a-real-key'}):await worker.fetch(request,{});
 res.writeHead(response.status,Object.fromEntries(response.headers));for await(const c of response.body||[])res.write(c);res.end();
 }catch(e){res.writeHead(500);res.end('Local test harness failed: '+e.message);}});
server.listen(port,'127.0.0.1',()=>console.log(`Isolated retry QA: http://127.0.0.1:${port}/`));
