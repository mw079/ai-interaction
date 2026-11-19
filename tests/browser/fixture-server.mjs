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
export const keplerAudienceDraft='Explain Kepler’s laws simply';
export const keplerAudienceQuestion='Who is this explanation for?';
export const vaccineTitle='How vaccines work';
export const vaccineFollowUps=['Why do boosters fade?','Are side effects common?'];
export const deeperAnswer=question=>'Short answer about '+question;
export const requirementsDraft='Plan a quiet weekend trip with vegetarian food';
export const requirementsQuestion='What must the trip include?';
export const japanCheckpoint='Plan a Japan trip';
export const japanQuestion='Which part of Japan should the trip focus on?';
export const japanAnswer='Start by choosing a region to anchor the trip.';
export const travelDraft='Plan a five-day April trip for two adults. Compare Tokyo with Kyoto.';
export const travelQuestion='Which city should the trip focus on?';
export const kyotoChoice='Focus on Kyoto';
export const kyotoAnswer='Base the five-day April trip in Kyoto for temples and historic districts.';
export const evaporationTitle='Water and evaporation';
export const evaporationText='Evaporation happens when liquid water becomes water vapor.';
export const triangleTitle='Explore triangles';
export const slideAnswer='Surface molecules can escape into the air even below the boiling point.';
export const slideReplacement=evaporationText+' A puddle can dry on a cool day.';
export const windQuestion='Why does wind matter?';
export const windAnswer='Moving air carries water vapor away from the surface.';
export const windReplacement=evaporationText+' Wind can make a puddle evaporate faster.';

function previewFor({phase,text}){
  const preview={
    kind:'outline',title:'Kepler’s laws',interpretation:'Understand Kepler’s laws.',
    audience:'',questionKind:'none',question:'',phrase:'',options:[],body:[],
    nodes:[],rows:[],information:[],completion:'',components:[],slideOptions:[]
  };
  if(phase==='page'){
    if(text==='Explain all three Kepler laws.')return {...preview,kind:'kepler',body:[
      'Three rules describe how planets orbit the Sun.',
      'First law: An orbit is an ellipse with the Sun at a focus.',
      'Second law: An orbit sweeps equal areas in equal times.',
      'Third law: Larger orbits take longer to complete.'
    ]};
    if(text==='Create an evaporation slide.')return {...preview,title:evaporationTitle,body:[evaporationText]};
    if(text==='Create a triangle slide.')return {...preview,title:triangleTitle,body:['Triangles have three sides.']};
    if(text==='Explain how vaccines work.')return {...preview,title:vaccineTitle,body:['Vaccines teach the immune system to recognise a germ.','Safety: They train immunity without causing the disease.'],
      components:[{id:'vaccine-steps',type:'timeline',title:'From vaccine to memory',prompt:'',edges:[],items:[
        {label:'Target shown',detail:'The vaccine shows an antigen.',value:0,latitude:null,longitude:null},
        {label:'Memory forms',detail:'Memory cells remain afterwards.',value:0,latitude:null,longitude:null}]}],
      followUps:vaccineFollowUps};
    return {...preview,kind:'kepler',body:['Change the orbit to explore Kepler’s laws.']};
  }
  if(text===completedComparison)return {...preview,body:[comparisonAnswer]};
  if(text.startsWith(requirementsDraft.slice(0,20)))return {
    ...preview,questionKind:'clarify',question:requirementsQuestion,phrase:'vegetarian food',options:['Vegetarian meals','Step-free access'],body:['Pick a base with good vegetarian options.'],
    information:[{type:'requirements',phrase:'vegetarian food',question:requirementsQuestion,options:['Vegetarian meals','Step-free access'],unit:'',samples:[]}]
  };
  if(text.includes(kyotoChoice))return {...preview,body:[kyotoAnswer],interpretation:'Plan five days in Kyoto.'};
  if(text===keplerAudienceDraft)return {
    ...preview,questionKind:'clarify',question:'Who should this simple explanation be for?',phrase:'simply',
    options:['Middle school','High school','University'],body:['Planets move around the Sun in oval paths.'],
    information:[{type:'audience',phrase:'simply',question:keplerAudienceQuestion,options:['Middle school','High school','University'],unit:'',samples:[]}]
  };
  if(text.includes('simply (High school)'))return {...preview,body:['At high-school level, imagine a stretched circle with the Sun off-center.']};
  if(text.startsWith(keplerAudienceDraft))return {...preview,body:['Imagine an oval orbit around the Sun.']};
  if(text===japanCheckpoint)return {
    ...preview,interpretation:'Plan a Japan trip.',questionKind:'clarify',question:japanQuestion,phrase:'Japan',
    options:['Kyoto and Osaka','Tokyo','Hokkaido'],body:[japanAnswer],
    information:[{type:'geographic_scope',phrase:'Japan',question:japanQuestion,options:['Kyoto and Osaka','Tokyo','Hokkaido'],unit:'',samples:[]}]
  };
  if(text.startsWith(japanCheckpoint))return {...preview,body:['With kids, Kyoto is a good base for a week.']};
  if(text===travelDraft)return {
    ...preview,interpretation:'Compare Tokyo and Kyoto for an April trip.',
    questionKind:'clarify',question:travelQuestion,phrase:'Tokyo with Kyoto',
    options:['Focus on Tokyo',kyotoChoice,'Split the trip'],body:['Tokyo and Kyoto suit different kinds of trips.']
  };
  if(text.startsWith(travelDraft))return {
    ...preview,questionKind:'clarify',question:'Would you prefer gardens or museums?',options:['Gardens','Museums'],
    body:['Leave one quiet afternoon for gardens or a small museum.']
  };
  return {
    ...preview,
    body:[text.includes(keplerCompletion)?keplerFollowUp:'Kepler’s second law describes how a planet sweeps equal areas in equal times.'],
    completion:keplerCompletion
  };
}

async function fixtureUpstream(options,gates){
  const sent=JSON.parse(options.body);
  const {stream}=sent;
  // The model input carries no phase; infer it the way the request itself implies it.
  const input=JSON.parse(sent.input);
  const phase=sent.text.format.name==='go_deeper'?'deeper':sent.model==='gpt-6.1-terra'?'page':sent.text.format.name==='local_assistance'?'page-help':'preview';
  const request={...input,phase,text:input.request};
  const exactRewrite=request.target?.mode==='rewrite'
    ? request.text.match(/^Replace this entire (?:paragraph|note) with exactly this sentence: (.+)$/)?.[1]
    : undefined;
  const preview=request.phase==='page-help'
    ? exactRewrite
      ? {answer:'',replacement:exactRewrite,components:[]}
      : {
      answer:request.target.id==='notes'&&request.text==='Explain again in very simple terms.'
        ? 'Kepler’s rules:\n\n1. **Shape.** Orbits can be oval.\n2. **Speed.** Planets move faster near the Sun.'
        : request.text===windQuestion?windAnswer
        : request.target.mode==='question'&&request.text==='What is an astronomical unit?'
        ? 'One AU is roughly the distance from Earth to the Sun.'
        : request.target.mode==='question'&&request.target.id==='notes'&&request.text==='What is an ellipse?'
          ? 'An ellipse is an oval with two foci.'
          : request.target.text.includes('Why below boiling')?slideAnswer:'',
      replacement:request.text===windQuestion?windReplacement:/cool day|Why below boiling/.test(request.target.text)?slideReplacement:'',
      components:[]
    }
    : request.phase==='deeper'
    ? {sections:request.followUps.map(question=>({answer:deeperAnswer(question),components:[]}))}
    : previewFor(request);
  const text=JSON.stringify(preview);
  const response={status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]};
  const gate=gates.get(request.text);
  if(!stream){await gate;return Response.json(response);}
  const delta=JSON.stringify(request.phase==='page-help'?{answer:preview.answer}:{body:preview.body}).slice(0,-1);
  const push=(controller,event)=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify(event)+'\n\n'));
  const body=new ReadableStream({
    async start(controller){
      const first=gate?delta.slice(0,Math.floor(delta.length/2)):delta;
      push(controller,{type:'response.output_text.delta',item_id:'fixture',delta:first});
      if(gate){
        await gate;
        push(controller,{type:'response.output_text.delta',item_id:'fixture',delta:delta.slice(first.length)});
      }
      push(controller,{type:'response.completed',response});
      controller.close();
    }
  });
  return new Response(body,{headers:{'Content-Type':'text/event-stream'}});
}

export async function startFixtureServer(){
  const gates=new Map();
  const server=http.createServer(async(request,response)=>{
    try{
      const chunks=[];
      for await(const chunk of request)chunks.push(chunk);
      const url=new URL(request.url,'http://'+request.headers.host);
      const init={method:request.method,headers:request.headers};
      if(!['GET','HEAD'].includes(request.method))init.body=Buffer.concat(chunks);
      const webRequest=new Request(url,init);
      const result=url.pathname.startsWith('/api/')
        ? await handleAPI(webRequest,(_,options)=>fixtureUpstream(options,gates),{OPENAI_API_KEY:'local-fixture-not-a-real-key'})
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
    holdPreview(text){
      const gate=Promise.withResolvers();
      gates.set(text,gate.promise);
      return ()=>{gates.delete(text);gate.resolve();};
    },
    close(){return new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  };
}
