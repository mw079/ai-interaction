import {readSSE} from '../public/stream.js';
import {writeFile} from 'node:fs/promises';
const cases=[{label:'clarify',text:'Explain Kepler’s laws.'},{label:'explore',text:'Explain Kepler’s laws for a high school student using simple examples, without equations.'},{label:'none',text:'Hello'}];
const results=await Promise.all(cases.map(async c=>{
 const res=await fetch('http://127.0.0.1:4317/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:c.text,format:'Auto',audience:'',phase:'preview',stream:true,interaction:'unified',context:JSON.stringify({confirmed:[]})})});
 if(!res.ok)throw Error(await res.text());let data,partials=0;for await(const e of readSSE(res.body)){if(e.type==='partial')partials++;if(e.type==='error')throw Error(e.error);if(e.type==='done')data=e.preview;}
 return {...c,partials,questionKind:data.questionKind,question:data.question,options:data.options,completion:data.completion,answer:data.body};
}));
await writeFile(new URL('../artifacts/question-modes-check.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
if(results[0].questionKind!=='clarify'||results[1].questionKind!=='explore'||results[2].questionKind!=='none')process.exitCode=1;
