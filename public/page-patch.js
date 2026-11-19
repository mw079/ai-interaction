// A proposal never mutates accepted content before Apply.
export function patchIsCurrent({version,currentVersion,before,current,connected}){return connected&&version===currentVersion&&before===current;}
function affectedLines({prefix,added,suffix}){
 return prefix.slice(prefix.lastIndexOf('\n')+1)+added+suffix.split('\n',1)[0];
}
export function explicitPageQuestion(difference){
 const questions=text=>text.split(/\n+|(?<=[.!?])\s+/u).map(line=>line.trim()).filter(line=>
  /^(?:what|why|how|when|where|who|which|is|are|does|do|did|can|could|would|should)\b[^?]*\?$/iu.test(line)
 );
 const previous=questions(affectedLines({...difference,added:difference.removed}));
 return questions(affectedLines(difference)).findLast(question=>!previous.includes(question))??'';
}
export function explicitPageRewrite(difference){
 const command=/(?:^|(?<=[.!?])\s+)(?:rewrite|reword|rephrase|revise|replace|shorten|expand|simplify|correct)\s+(?:(?:just|only)\s+)?(?:this|that|the|these|those|my)(?:\s+(?:(?:entire|whole|selected)\s+)?(?:passage|paragraph|sentence|text|title|notes?)\b|(?=\s+(?:for|to|with|in|as)\b|[.!?]?\s*$))/gi;
 return affectedLines(difference).split('\n').map(line=>{
  const start=[...line.trim().matchAll(command)].at(-1)?.index;
  return start===undefined?'':line.trim().slice(start).trimStart();
 }).findLast(Boolean)??'';
}
export function textDifference(before,after){const x=Array.from(before),y=Array.from(after);let a=0,b=0;while(a<x.length&&a<y.length&&x[a]===y[a])a++;while(b<x.length-a&&b<y.length-a&&x.at(-b-1)===y.at(-b-1))b++;return {prefix:x.slice(0,a).join(''),removed:x.slice(a,b?x.length-b:undefined).join(''),added:y.slice(a,b?y.length-b:undefined).join(''),suffix:b?x.slice(-b).join(''):''};}
