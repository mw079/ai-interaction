// A proposal never mutates accepted content before Apply.
export function patchIsCurrent({version,currentVersion,before,current,connected}){return connected&&version===currentVersion&&before===current;}
export function explicitPageRewrite({prefix,added,suffix}){
 const affected=prefix.slice(prefix.lastIndexOf('\n')+1)+added+suffix.split('\n',1)[0];
 return affected.split('\n').map(line=>line.trim()).findLast(line=>
  /^(?:rewrite|reword|rephrase|revise|replace|shorten|expand|simplify|correct)\s+(?:(?:just|only)\s+)?(?:this|that|the)\s+(?:(?:entire|whole|selected)\s+)?(?:passage|paragraph|sentence|text|title)\b/i.test(line)
 )??'';
}
export function textDifference(before,after){const x=Array.from(before),y=Array.from(after);let a=0,b=0;while(a<x.length&&a<y.length&&x[a]===y[a])a++;while(b<x.length-a&&b<y.length-a&&x.at(-b-1)===y.at(-b-1))b++;return {prefix:x.slice(0,a).join(''),removed:x.slice(a,b?x.length-b:undefined).join(''),added:y.slice(a,b?y.length-b:undefined).join(''),suffix:b?x.slice(-b).join(''):''};}
