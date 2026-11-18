import {readSSE} from '../public/stream.js';
import {writeFile} from 'node:fs/promises';
const cases=[['unspecified',''],['high-school','Teach Kepler’s laws to a high school student, using a simple diagram and no equations.'],['undergraduate','Derive Kepler’s third law for an undergraduate physics student, with Newtonian equations and their assumptions.']];
const reports=await Promise.all(cases.map(async([name,explicitIntent])=>{
 const start=Date.now();const response=await fetch('http://127.0.0.1:4317/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'I want to understand Kepler’s laws. Please explain.',audience:'',format:'Auto',phase:'preview',interaction:'unified',stream:true,context:JSON.stringify({explicitIntent,draft:'I want to understand Kepler’s laws. Please explain.',confirmed:[]})})});
 if(!response.ok)throw new Error(name+': '+await response.text());let firstMs=null,updates=0,result;
 for await(const event of readSSE(response.body)){if(event.type==='partial'){updates++;if(firstMs===null&&event.preview.answer)firstMs=Date.now()-start;}else if(event.type==='error')throw new Error(event.error);else if(event.type==='done')result=event;}
 if(!result)throw new Error('No final result');return {name,firstAnswerMs:firstMs,completeMs:Date.now()-start,updates,answer:result.preview.body,question:result.preview.question,options:result.preview.options,information:result.preview.information,model:result.model};
}));await writeFile(new URL('../artifacts/live-intent-stream-check.json',import.meta.url),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
