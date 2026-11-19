import {renderCatalogBlock} from './component-renderer.js';
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const mathElement=(tag,...children)=>{
 const element=document.createElementNS('http://www.w3.org/1998/Math/MathML',tag);
 element.append(...children);
 return element;
};

function keplerEquations(){
 const variable=name=>mathElement('mi',name);
 const number=value=>mathElement('mn',value);
 const operator=symbol=>mathElement('mo',symbol);
 const power=(name,exponent)=>mathElement('msup',variable(name),number(exponent));
 const row=(...elements)=>mathElement('mrow',...elements);
 const equation=(label,...terms)=>{
  const math=mathElement('math',...terms);
  math.setAttribute('display','block');
  math.setAttribute('aria-label',label);
  return math;
 };
 const shape=make('div','atlas-equation');
 shape.append(equation('Eccentricity ranges from zero up to, but excluding, one',
  number('0'),operator('≤'),variable('e'),operator('<'),number('1')));
 const areas=make('div','atlas-equation');
 areas.append(equation('Rate of change of swept area equals a constant',
  mathElement('mfrac',row(mathElement('mi','d'),variable('A')),row(mathElement('mi','d'),variable('t'))),
  operator('='),mathElement('mtext','constant')));
 const period=make('div','atlas-equation');
 period.append(equation('Orbital period squared is proportional to semimajor axis cubed',
  power('T','2'),operator('∝'),power('a','3')));
 const details=make('details','atlas-equation-details');
 details.append(make('summary','','Full equation'),equation(
  'Orbital period squared equals four pi squared times semimajor axis cubed, divided by G times the sum of the two masses',
  power('T','2'),operator('='),
  mathElement('mfrac',row(number('4'),power('π','2'),power('a','3')),
   row(variable('G'),operator('('),variable('M'),operator('+'),variable('m'),operator(')')))),
  make('p','','G is the gravitational constant. M and m are the two masses.'));
 period.append(details);
 return [shape,areas,period];
}

export function renderAtlas(target,p,{titleField,onEdit}){
 target.atlasDispose?.();const observers=[];target.atlasDispose=()=>observers.forEach(o=>o.disconnect());p.edits??={};const layout=make('div','atlas-layout'),copy=make('div','atlas-copy'),visual=make('div','atlas-visual');
 const diagram=!!p.components?.length||['kepler','diagram','comparison','planner','projectile'].includes(p.kind);
 layout.classList.toggle('atlas-prose',!diagram);
 const titleWrapper=make('div','page-field');titleField.dataset.pageField='title';titleWrapper.append(titleField);copy.append(titleWrapper);
 function text(value,label,changed,index,key=index===0?'intro':'passage:'+index){
  const wrapper=make('div','page-field'),field=make('textarea','atlas-text');
  if(index!==undefined)field.dataset.passageIndex=String(index);
  field.dataset.pageField=key;field.dataset.editKey=key;
  field.rows=1;field.defaultValue=value;field.maxLength=2500;field.setAttribute('aria-label',label);
  const fit=()=>{field.style.height='0';field.style.height=field.scrollHeight+'px';};
  field.oninput=()=>{changed(field.value);onEdit();fit();};
  const observer=new ResizeObserver(()=>{if(field.clientWidth)fit();});observer.observe(field);observers.push(observer);queueMicrotask(fit);
  wrapper.append(field);return wrapper;
 }
 copy.append(text(p.edits.explanation??p.body[0]??'', 'Editable explanation',value=>p.edits.explanation=value,0));
 const fitTitle=()=>{titleField.style.height='0';titleField.style.height=titleField.scrollHeight+'px';};const titleObserver=new ResizeObserver(()=>{if(titleField.clientWidth)fitTitle();});titleObserver.observe(titleField);observers.push(titleObserver);queueMicrotask(fitTitle);layout.append(copy);if(diagram)layout.append(visual);target.append(layout);
 const askBlock=(anchor,block,practice)=>document.dispatchEvent(new CustomEvent('page:ask',{detail:{anchor,block,practice}}));
 if(p.components?.length){p.components.forEach((c,i)=>renderCatalogBlock(i===0?visual:target,c,p,{onEdit,ask:askBlock}));}
 if(p.kind==='kepler'){
  const orbit=p.edits.orbit??={eccentricity:.45,phase:.15,law:1};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 500 350');svg.setAttribute('role','img');svg.setAttribute('aria-label','Kepler orbit: Sun at a focus, planet position and two equal-time swept areas');svg.classList.add('atlas-orbit');visual.append(svg);
  const caption=make('div','atlas-orbit-caption');caption.append(make('span','','Sun at one focus'));const speed=make('output');caption.append(speed);visual.append(caption);
  const controls=make('div','atlas-controls');const outputs={};
  for(const [key,label,min,max]of [['eccentricity','Eccentricity',0,65],['phase','Time through orbit',0,100]]){const l=make('label');const row=make('span','atlas-control-label',label);const out=outputs[key]=make('output');row.append(out);const input=make('input');input.type='range';input.min=min;input.max=max;input.value=Math.round(orbit[key]*100);input.setAttribute('aria-label',label);input.oninput=()=>{orbit[key]=+input.value/100;onEdit();draw();};l.append(row,input);controls.append(l);}visual.append(controls);
  const tabs=make('div','atlas-laws');tabs.setAttribute('aria-label','Kepler law');const equations=keplerEquations();copy.append(...equations);
  ['Elliptical paths','Equal areas','Orbital periods'].forEach((label,i)=>{const b=make('button','',label);b.setAttribute('aria-pressed',String(orbit.law===i));b.onclick=()=>{orbit.law=i;onEdit();showLaw();draw();};tabs.append(b);});target.append(tabs);
  const detail=make('p','atlas-law-detail');target.append(detail);
  function showLaw(){
   const [before,emphasis,after]=[
    ['An ellipse has ', 'two foci', '. The Sun occupies one of them.'],
    ['The two shaded regions correspond to ', 'equal time intervals', '.'],
    ['', 'T is the orbital period', ' and a is the semimajor axis. For the same total mass, a larger orbit takes longer.']
   ][orbit.law];
   detail.replaceChildren(before,make('strong','',emphasis),after);
   equations.forEach((equation,index)=>equation.hidden=index!==orbit.law);
   [...tabs.children].forEach((tab,index)=>tab.setAttribute('aria-pressed',String(index===orbit.law)));
  }
  function draw(){svg.replaceChildren();const e=orbit.eccentricity,a=190,b=a*Math.sqrt(1-e*e),cx=250,cy=175,sun=cx+a*e;const solve=M=>{let E=M;for(let j=0;j<10;j++)E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));return E;};const xy=E=>[cx+a*Math.cos(E),cy+b*Math.sin(E)];const add=(tag,attrs)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);};
   if(orbit.law===1)for(const m of [0,Math.PI]){const x=xy(solve(m)),y=xy(solve(m+.6));add('path',{d:`M ${sun} ${cy} L ${x[0]} ${x[1]} A ${a} ${b} 0 0 1 ${y[0]} ${y[1]} Z`,class:'atlas-sector'});}
   add('ellipse',{cx,cy,rx:a,ry:b,class:'atlas-track'});const E=solve(orbit.phase*Math.PI*2),point=xy(E);add('line',{x1:sun,y1:cy,x2:point[0],y2:point[1],class:'atlas-radius'});add('circle',{cx:sun,cy,r:8,class:'atlas-sun'});add('circle',{cx:point[0],cy:point[1],r:5,class:'atlas-planet'});
   outputs.eccentricity.textContent=e.toFixed(2);outputs.phase.textContent=Math.round(orbit.phase*100)+'%';speed.textContent='Relative speed '+Math.sqrt(2/(1-e*Math.cos(E))-1).toFixed(2)+'×';
  }
  showLaw();draw();
 }else if(p.components?.length){
  // Catalog blocks own this page's visual surface.
 }else if(p.kind==='diagram'){
  const names=p.nodes.length?p.nodes:['The idea','Its connections'];const flow=make('div','atlas-connections');names.forEach((name,i)=>{const field=make('input','atlas-node');field.dataset.editKey='node:'+i;field.value=name;field.maxLength=80;field.setAttribute('aria-label','Diagram label '+(i+1));field.oninput=()=>{names[i]=field.value;p.nodes=names;onEdit();};flow.append(field);});visual.append(flow);
 }else if(p.kind==='comparison'){
  const table=make('table','atlas-comparison');const head=table.createTHead().insertRow();['Criterion','A','B'].forEach(label=>{const th=make('th','',label);th.scope='col';head.append(th);});for(const [i,row] of p.rows.entries()){const tr=table.insertRow();for(const k of ['criterion','a','b']){const cell=tr.insertCell();cell.append(text(row[k],row.criterion+' '+k,value=>row[k]=value,undefined,'comparison:'+i+':'+k));}}visual.append(table);
 }else if(p.kind==='planner'){
  const fields=make('div','atlas-plan');p.rows.forEach((row,i)=>{const label=make('label','',row.criterion);const input=make('input');input.dataset.editKey='planner:'+i;input.value=row.a;input.placeholder=row.b||'Your choice';input.maxLength=300;input.oninput=()=>{row.a=input.value;onEdit();};label.append(input);fields.append(label);});visual.append(fields);
 }else if(p.kind==='projectile'){
  // The existing tested simulator is attached by the app, retaining its controls.
  visual.classList.add('atlas-projectile');
 }
 const body=make('div','atlas-body');
 const paragraphs=p.body.slice(1);
 const lawLabels=['Orbital shape','Equal areas','Orbital period'];
 const lawPrefixes=[/^(?:first law\s*[:.)]|1[.)])\s*/i,/^(?:second law\s*[:.)]|2[.)])\s*/i,/^(?:third law\s*[:.)]|3[.)])\s*/i];
 const overview=p.kind==='kepler'&&paragraphs.length===3&&paragraphs.every((paragraph,i)=>lawPrefixes[i].test(paragraph.trim()));
 // Any page can use the same takeaway columns: two or three "Label: one sentence" passages.
 const takeawayPattern=/^([^:\n]{1,32}):\s+(\S[\s\S]*)$/;
 const takeaways=!overview&&paragraphs.length>=2&&paragraphs.length<=3&&
  paragraphs.every(paragraph=>{const m=paragraph.trim().match(takeawayPattern);return m&&m[1].trim().split(/\s+/).length<=4;});
 body.classList.toggle('atlas-law-overview',overview||takeaways);
 body.style.setProperty('--cols',String(paragraphs.length||3));
 paragraphs.forEach((paragraph,i)=>{
  p.edits.paragraphs??={};
  const parts=takeaways?paragraph.trim().match(takeawayPattern):null;
  const original=overview?paragraph.trim().replace(lawPrefixes[i],''):parts?parts[2]:paragraph;
  const item=text(p.edits.paragraphs[i]??original,'Page paragraph '+(i+2),value=>p.edits.paragraphs[i]=value,i+1);
  if(overview||parts)item.prepend(make('h3','atlas-law-heading',overview?lawLabels[i]:parts[1].trim()));
  body.append(item);
 });
 target.append(body);
 // Go deeper: the next ideas become their own slide instead of more text on this one.
 if(p.followUps?.length){
  const next=make('nav','atlas-next');
  next.setAttribute('aria-label','Go deeper');
  next.append(make('span','atlas-next-label','Go deeper'));
  p.followUps.forEach(question=>{
   const button=make('button','atlas-next-button',question);
   button.type='button';
   button.onclick=()=>document.dispatchEvent(new CustomEvent('page:follow-up',{detail:question}));
   next.append(button);
  });
  target.append(next);
 }
}
