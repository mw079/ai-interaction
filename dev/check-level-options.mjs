import {readSSE} from '../public/stream.js';import {writeFile} from 'node:fs/promises';
const results=await Promise.all(['high school','undergraduate'].map(async level=>{
 const res=await fetch('http://127.0.0.1:4317/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'I want to understand Kepler’s laws. Please explain.',format:'Auto',audience:'',phase:'preview',stream:true,interaction:'unified',context:JSON.stringify({explicitIntent:`Explain Kepler’s laws for a ${level} student.`,confirmed:[]})})});let result;
 if(!res.ok)throw Error(await res.text());for await(const e of readSSE(res.body)){if(e.type==='done')result=e.preview;if(e.type==='error')throw Error(e.error);}return {level,answer:result.body,question:result.question,information:result.information};
}));await writeFile(new URL('../artifacts/kepler-level-options-check.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
