// Capture explicit preferences independently of the visible draft or inferred intent.
export function confirmedChoices(entries=[]){
 return entries.filter(entry=>entry.confirmed).map(({type,phrase,value})=>({type,phrase,value}));
}

const encoder=new TextEncoder();
const fits=(json,limit)=>encoder.encode(json).length<=limit;

function excerpt(text='',limit){
 if(text.length<=limit)return text;
 return text.slice(0,limit-1).replace(/[\uD800-\uDBFF]$/u,'')+'…';
}

function summarizeBlock(block,limit,detailCap){
 return {
  ...block,title:limit(block.title,100),prompt:limit(block.prompt,200),
  items:block.items.map(item=>({...item,label:limit(item.label,80),detail:limit(item.detail,detailCap)})),
  edges:block.edges.map(edge=>({...edge,label:limit(edge.label,80)}))
 };
}

export function blockContextText(block,limit){
 let encoded=JSON.stringify(block);
 for(const scale of [1,.5,.25,.125,.0625,.03125]){
  if(fits(encoded,limit))break;
  encoded=JSON.stringify(summarizeBlock(block,(text,max)=>excerpt(text,Math.max(1,Math.floor(max*scale))),300));
 }
 return encoded;
}

function summarizePage(source,scale){
 if(typeof source==='string')return excerpt(source,Math.max(1,Math.floor(3000*scale)));
 const {page}=source;
 if(!page)return '';
 const limit=(text,max)=>excerpt(text,Math.max(1,Math.floor(max*scale)));
 const edits=page.edits;
 const components=page.components||[];
 return {
  title:limit(source.title,160),originalRequest:limit(source.originalRequest,600),
  page:{
   kind:page.kind,
   body:page.body.map((text,index)=>limit((index===0?edits?.explanation:edits?.paragraphs?.[index-1])??text,700)),
   components:components.map(block=>summarizeBlock(block,limit,220)),
   nodes:page.nodes.map(text=>limit(text,80)),
   rows:page.rows.map(({criterion,a,b})=>({criterion:limit(criterion,80),a:limit(a,300),b:limit(b,300)})),
   orbit:edits?.orbit,physics:page.kind==='projectile'?page.physics:undefined,
   widgets:edits?.widgets&&Object.fromEntries(components.flatMap(({id})=>{
    const widget=edits.widgets[id];
    return widget?[[id,{...widget,practice:limit(widget.practice,250)}]]:[];
   }))
  },
  notes:limit(source.notes,550)
 };
}

export function requestContext({draft='',page='',confirmed=[],date='',timezone='',explicitIntent=''}){
 const context={
  explicitIntent:excerpt(explicitIntent,500),draft:excerpt(draft,2000),page:summarizePage(page,1),
  confirmed:confirmed.slice(-8).map(({type,phrase,value})=>({
   type:excerpt(type,40),phrase:excerpt(phrase,180),value:excerpt(value,300)
  })),
  date:excerpt(date,40),timezone:excerpt(timezone,80)
 };
 let encoded=JSON.stringify(context);
 // Trim draft and page fields before serializing. Confirmed intent and recent choices take priority.
 for(const scale of [.5,.25,.125,.0625,.03125]){
  if(fits(encoded,6000))return encoded;
  context.page=summarizePage(page,scale);
  context.draft=excerpt(draft,Math.floor(2000*scale));
  encoded=JSON.stringify(context);
 }
 while(!fits(encoded,6000)&&context.confirmed.length>1){
  context.confirmed.shift();
  encoded=JSON.stringify(context);
 }
 if(!fits(encoded,6000)){
  context.page=typeof page==='string'?'':{title:excerpt(page.title,160),page:{kind:page.page?.kind,components:page.page?.components?.map(({id,type})=>({id,type}))}};
  encoded=JSON.stringify(context);
 }
 return encoded;
}
