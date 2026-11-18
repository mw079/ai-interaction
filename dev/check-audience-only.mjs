import {readSSE} from '../public/stream.js';import {writeFile} from 'node:fs/promises';
const reports=await Promise.all(['high school','undergraduate'].flatMap(level=>['preview','page'].map(async phase=>{
 const explicitIntent=`Explain Kepler’s laws for a ${level} student.`;const start=Date.now();
 const response=await fetch('http://127.0.0.1:4317/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'I want to understand Kepler’s laws. Please explain.',format:'Auto',audience:'',phase,interaction:'unified',stream:phase==='preview',context:JSON.stringify({explicitIntent,confirmed:[]})})});
 if(!response.ok)throw Error(await response.text());let result;
 if(phase==='preview'){for await(const event of readSSE(response.body)){if(event.type==='done')result=event;else if(event.type==='error')throw Error(event.error);}}else result=await response.json();
 if(!result)throw Error('Missing result');return {level,phase,model:result.model,elapsedMs:Date.now()-start,explicitIntent,preview:result.preview};
})));
await writeFile(new URL('../artifacts/kepler-audience-only-check.json',import.meta.url),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports.map(({level,phase,model,elapsedMs,preview})=>({level,phase,model,elapsedMs,body:preview.body,question:preview.question,information:preview.information})),null,2));
