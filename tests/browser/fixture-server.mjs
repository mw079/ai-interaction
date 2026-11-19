import http from 'node:http';
import {once} from 'node:events';
import {handleAPI} from '../../api.mjs';
import worker from '../../dist/server/index.js';

export const keplerDraft='I want to understand Kepler’s laws as an undergraduate.\nConnect all three laws to Newtonian gravity and explain the equal-areas law.';
export const keplerCompletion='Include a worked example linking the orbital speed to conservation of angular momentum.';
export const keplerFollowUp='Angular momentum stays constant, so the orbital radius sweeps out equal areas in equal times.';
export const unfinishedComparison='Explain the difference between evaporation and…';
export const completedComparison='Explain the difference between evaporation and sublimation.';
export const comparisonAnswer='Evaporation changes liquid to gas; sublimation changes solid directly to gas.';
export const travelDraft='Plan a five-day April trip for two adults. Compare Tokyo with Kyoto.';
export const travelQuestion='Which city should the trip focus on?';
export const kyotoChoice='Focus on Kyoto';
export const kyotoAnswer='Base the five-day April trip in Kyoto for temples and historic districts.';
export const evaporationTitle='Water and evaporation';
export const evaporationText='Evaporation happens when liquid water becomes water vapor.';
export const triangleTitle='Explore triangles';
export const slideAnswer='Surface molecules can escape into the air even below the boiling point.';
export const slideReplacement=evaporationText+' A puddle can dry on a cool day.';

function previewFor({phase,text}){
  const preview={
    kind:'outline',title:'Kepler’s laws',interpretation:'Understand Kepler’s laws.',
    audience:'',questionKind:'none',question:'',phrase:'',options:[],body:[],
    nodes:[],rows:[],information:[],completion:'',components:[],slideOptions:[]
  };
  if(phase==='page'){
    if(text==='Create an evaporation slide.')return {...preview,title:evaporationTitle,body:[evaporationText]};
    if(text==='Create a triangle slide.')return {...preview,title:triangleTitle,body:['Triangles have three sides.']};
    return {...preview,kind:'kepler',body:['Change the orbit to explore Kepler’s laws.']};
  }
  if(text===completedComparison)return {...preview,body:[comparisonAnswer]};
  if(text.includes(kyotoChoice))return {...preview,body:[kyotoAnswer],interpretation:'Plan five days in Kyoto.'};
  if(text===travelDraft)return {
    ...preview,interpretation:'Compare Tokyo and Kyoto for an April trip.',
    questionKind:'clarify',question:travelQuestion,phrase:'Tokyo with Kyoto',
    options:['Focus on Tokyo',kyotoChoice,'Split the trip'],body:['Tokyo and Kyoto suit different kinds of trips.']
  };
  return {
    ...preview,
    body:[text.includes(keplerCompletion)?keplerFollowUp:'Kepler’s second law describes how a planet sweeps equal areas in equal times.'],
    completion:keplerCompletion
  };
}

function fixtureUpstream(_,options){
  const {input,stream}=JSON.parse(options.body);
  const request=JSON.parse(input);
  const preview=request.phase==='page-help'
    ? {
      answer:request.target.text.includes('Why below boiling')?slideAnswer:'',
      replacement:/cool day|Why below boiling/.test(request.target.text)?slideReplacement:'',
      components:[]
    }
    : previewFor(request);
  const text=JSON.stringify(preview);
  const response={status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]};
  if(!stream)return Response.json(response);
  const events=[
    {type:'response.output_text.delta',item_id:'fixture',delta:JSON.stringify({body:preview.body}).slice(0,-1)},
    {type:'response.completed',response}
  ];
  return new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{
    headers:{'Content-Type':'text/event-stream'}
  });
}

export async function startFixtureServer(){
  const server=http.createServer(async(request,response)=>{
    try{
      const chunks=[];
      for await(const chunk of request)chunks.push(chunk);
      const url=new URL(request.url,'http://'+request.headers.host);
      const init={method:request.method,headers:request.headers};
      if(!['GET','HEAD'].includes(request.method))init.body=Buffer.concat(chunks);
      const webRequest=new Request(url,init);
      const result=url.pathname.startsWith('/api/')
        ? await handleAPI(webRequest,fixtureUpstream,{OPENAI_API_KEY:'local-fixture-not-a-real-key'})
        : await worker.fetch(webRequest,{});
      response.writeHead(result.status,Object.fromEntries(result.headers));
      for await(const chunk of result.body||[])response.write(chunk);
      response.end();
    }catch(error){
      if(!response.headersSent)response.writeHead(500);
      response.end(error.message);
    }
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return {
    url:'http://127.0.0.1:'+server.address().port,
    close(){return new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  };
}
