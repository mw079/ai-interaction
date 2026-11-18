// Fixed interaction templates; the model supplies topic-specific labels and choices only.
export const INFORMATION_TYPES = {
  output_format:{label:'Response format',family:'cards'}, goal:{label:'Goal',family:'choices'},
  audience:{label:'Audience',family:'search'}, prior_knowledge:{label:'Prior knowledge',family:'choices'},
  depth:{label:'Depth',family:'depth'}, length:{label:'Length',family:'number'},
  tone:{label:'Tone',family:'tone'}, language:{label:'Language',family:'search'},
  date:{label:'Date',family:'datetime'}, date_range:{label:'Date range',family:'datetime'},
  time:{label:'Time',family:'datetime'}, duration:{label:'Duration',family:'number'},
  location:{label:'Location',family:'search'}, geographic_scope:{label:'Area',family:'search'},
  budget:{label:'Budget',family:'number'}, quantity:{label:'Quantity',family:'number'},
  priorities:{label:'Priorities',family:'list'}, requirements:{label:'Requirements',family:'list'},
  exclusions:{label:'Exclusions',family:'list'}, comparison_options:{label:'Compare',family:'list'},
  flexible_dates:{label:'Date flexibility',family:'flexible_dates'},
  area_map:{label:'Search area',family:'area_map'},
  assumption:{label:'Assumption',family:'assumption'},
  goal_comparison:{label:'Goal',family:'goal_comparison'},
  audience_knowledge:{label:'Audience and prior knowledge',family:'audience_knowledge'},
  example:{label:'Example',family:'example'},
  include_exclude:{label:'Include or exclude topics',family:'include_exclude'},
  tradeoff:{label:'Trade-off',family:'tradeoff'}
};
export const CONTROL_FAMILIES=['choices','cards','search','number','datetime','list','depth','tone','flexible_dates','area_map','assumption','goal_comparison','audience_knowledge','example','include_exclude','tradeoff'];
export function validInformation(items){
  const short=(s,n)=>typeof s==='string'&&s.length<=n;
  return Array.isArray(items)&&items.length<=4&&items.every(i=>i&&Object.hasOwn(INFORMATION_TYPES,i.type)&&short(i.phrase,120)&&i.phrase.trim().length>0&&short(i.question,180)&&short(i.unit,30)&&Array.isArray(i.options)&&i.options.length<=5&&i.options.every(o=>short(o,100))&&(i.samples===undefined||(Array.isArray(i.samples)&&i.samples.length<=i.options.length&&i.samples.every(sample=>short(sample,180)))));
}
export function informationFor(text,items=[]){
  if(!validInformation(items))return [];
  const result=[];
  // Preserve distinct controls when the model returns a long phrase containing another anchor.
  // Use an uncovered exact fragment; never invent words or choices.
  const placed=items.map(item=>{
    if(!['audience','prior_knowledge'].includes(item.type))return item;
    const a=text.indexOf(item.phrase),b=a+item.phrase.length;
    if(a<0||!items.some(other=>other!==item&&text.indexOf(other.phrase)<b&&text.indexOf(other.phrase)+other.phrase.length>a))return item;
    const verb=[...text.matchAll(/\b(?:explain|understand|teach|learn|explanation)\b/gi)].find(m=>items.every(other=>other===item||m.index+m[0].length<=text.indexOf(other.phrase)||m.index>=text.indexOf(other.phrase)+other.phrase.length));
    return verb?{...item,phrase:verb[0]}:item;
  });
  const anchored=placed.map(item=>{
    const start=text.indexOf(item.phrase),end=start+item.phrase.length;if(start<0)return item;
    let free=[[start,end]];
    for(const other of placed){const a=text.indexOf(other.phrase),b=a+other.phrase.length;if(other===item||a<start||b>end||other.phrase.length>=item.phrase.length)continue;
      free=free.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:[[x,Math.max(x,a)],[Math.min(y,b),y]]);
    }
    const fragments=free.map(([a,b])=>text.slice(a,b).trim()).filter(x=>/\p{L}{3}/u.test(x)).sort((a,b)=>b.length-a.length);
    return fragments.length?{...item,phrase:fragments[0]}:item;
  });
  for(const item of anchored){
    const start=text.indexOf(item.phrase);if(start<0)continue;
    let depth=0;for(const char of text.slice(0,start)){if(char==='(')depth++;else if(char===')')depth=Math.max(0,depth-1);}if(depth)continue;
    const end=start+item.phrase.length;
    if(result.some(r=>start<r.end&&end>r.start))continue;
    const type=item.type==='quantity'&&/^(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/i.test(item.unit.trim())?'duration':item.type;
    result.push({...item,type,start,end,key:`${type}:${start}`,value:'',annotation:'',confirmed:false});
  }
  return result.sort((a,b)=>a.start-b.start);
}
// Track owned annotations through ordinary typing without matching unrelated parentheses.
export function rebaseInformation(before,after,entries){
  let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;
  let end=before.length,newEnd=after.length;while(end>start&&newEnd>start&&before[end-1]===after[newEnd-1]){end--;newEnd--;}
  const delta=after.length-before.length;
  return entries.flatMap(entry=>{
    let next={...entry};const ownedEnd=entry.end+(entry.annotation?.length||0);
    if(end<=entry.start) {next.start+=delta;next.end+=delta;}
    else if(start<ownedEnd) return [];
    if(after.slice(next.start,next.end)!==entry.phrase)return [];
    if(entry.annotation&&after.slice(next.end,next.end+entry.annotation.length)!==entry.annotation)return [];
    return [next];
  });
}
export function chooseInformation(text,entries,key,value){
  const entry=entries.find(e=>e.key===key);value=String(value).trim();
  if(!entry||value.length>300||/[\r\n]/.test(value))return null;
  const annotation=value?` (${value})`:'';
  const oldEnd=entry.end+(entry.annotation?.length||0);
  if(text.slice(entry.start,entry.end)!==entry.phrase||text.slice(entry.end,oldEnd)!==(entry.annotation||''))return null;
  const nextText=text.slice(0,entry.end)+annotation+text.slice(oldEnd);
  if(nextText.length>4000)return null;
  const delta=annotation.length-(entry.annotation?.length||0);
  return {text:nextText,entries:entries.map(e=>e.key===key?{...e,value,annotation,confirmed:!!value}:e.start>=oldEnd?{...e,start:e.start+delta,end:e.end+delta}:e)};
}
export function mergeInformation(text,confirmed,incoming){
  const retained=confirmed.filter(e=>e.confirmed&&text.slice(e.start,e.end)===e.phrase&&text.slice(e.end,e.end+e.annotation.length)===e.annotation);
  return [...retained,...informationFor(text,incoming).filter(e=>!retained.some(r=>e.start<r.end+r.annotation.length&&e.end>r.start))].sort((a,b)=>a.start-b.start);
}
