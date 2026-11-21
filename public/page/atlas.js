import {renderComponent} from '../components/renderer.js';
import {element as make} from '../shared/dom.js';
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

// Two or three components are views of one topic (where, when, how much): tabs above the visual
// show one at a time, so the first screen never becomes a long stack. Which view is open is
// remembered with the page but is viewing, not editing. A page often arrives with one view and
// gains more a moment later (addViews): the title then becomes the first tab in the same place.
const viewHosts=new WeakMap();
function mountViews(visual,p,options){
 const panels=[],buttons=[];let tabs=null;
 const place=block=>{const panel=renderComponent(visual,block,p,options);panel.id='view-'+block.id;panels.push(panel);};
 function show(i){
  p.edits.view=i;
  buttons.forEach((button,j)=>{button.setAttribute('aria-selected',String(i===j));button.tabIndex=i===j?0:-1;});
  panels.forEach((panel,j)=>{panel.hidden=i!==j;});
  if(tabs&&buttons[i])reveal(buttons[i]);
 }
 // When the names do not fit, the tabs scroll sideways: keep the chosen one in view (without scrolling the page) and fade the side with more.
 function reveal(button){
  const left=button.offsetLeft-tabs.offsetLeft,right=left+button.offsetWidth,edge=36;
  if(left<tabs.scrollLeft+edge)tabs.scrollLeft=Math.max(0,left-edge);
  else if(right>tabs.scrollLeft+tabs.clientWidth-edge)tabs.scrollLeft=right-tabs.clientWidth+edge;
  fade();
 }
 function fade(){
  if(!tabs)return;
  const end=tabs.scrollWidth-tabs.clientWidth;
  tabs.classList.toggle('more-before',tabs.scrollLeft>1);
  tabs.classList.toggle('more-after',tabs.scrollLeft<end-1);
 }
 function sync(){
  if(panels.length<2)return;
  if(!tabs){
   tabs=make('div','atlas-views');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Views');
   visual.classList.add('has-views');visual.prepend(tabs);
   tabs.addEventListener('scroll',fade,{passive:true});
   if(typeof ResizeObserver==='function')new ResizeObserver(fade).observe(tabs);
  }
  for(let i=buttons.length;i<panels.length;i++){
   const block=p.components[i],button=make('button','atlas-view',block.title);
   button.type='button';button.id='view-tab-'+block.id;button.setAttribute('role','tab');button.setAttribute('aria-controls',panels[i].id);
   panels[i].setAttribute('role','tabpanel');panels[i].setAttribute('aria-labelledby',button.id);
   button.onclick=()=>show(i);
   button.onkeydown=event=>{
    const step=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
    if(!step)return;
    event.preventDefault();const next=(i+step+buttons.length)%buttons.length;show(next);buttons[next].focus();
   };
   buttons.push(button);tabs.append(button);
  }
  show(Math.min(Math.max(0,p.edits.view|0),buttons.length-1));
 }
 p.components.forEach(place);
 sync();
 viewHosts.set(p,{add(blocks){blocks.forEach(block=>{p.components.push(block);place(block);});sync();}});
}
// Adds views to the page as it is shown, without re-rendering what is already there.
export function addViews(page,blocks){viewHosts.get(page)?.add(blocks);}

// While a new page is being written: its title and introduction in their final places, and a
// calm placeholder where the visual will appear. renderAtlas then replaces it all in place.
export function renderDraft(target,titleField){
 const layout=make('div','atlas-layout atlas-draft'),copy=make('div','atlas-copy'),visual=make('div','atlas-visual');
 const titleWrapper=make('div','page-field');titleWrapper.append(titleField);
 const introWrapper=make('div','page-field'),intro=make('textarea','atlas-text');intro.rows=1;intro.readOnly=true;intro.tabIndex=-1;intro.setAttribute('aria-label','Introduction, being written');introWrapper.append(intro);
 const pending=make('div','atlas-visual-pending');pending.setAttribute('role','status');
 pending.append(make('span','page-spinner'),make('span','','Building the visual…'));
 copy.append(titleWrapper,introWrapper);visual.append(pending);layout.append(copy,visual);
 target.replaceChildren(layout);
 const fit=field=>{field.style.height='0';field.style.height=field.scrollHeight+'px';};
 return {update({title,intro:text}){
  if(title&&titleField.value!==title){titleField.value=title;fit(titleField);}
  if(text&&intro.value!==text){intro.value=text;fit(intro);}
 }};
}

export function renderAtlas(target,p,{titleField,onEdit}){
 target.atlasDispose?.();const observers=[];target.atlasDispose=()=>observers.forEach(o=>o.disconnect());p.edits??={};const layout=make('div','atlas-layout'),copy=make('div','atlas-copy'),visual=make('div','atlas-visual');
 const diagram=!!p.components?.length||['kepler','planner','projectile'].includes(p.kind);
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
 if(p.components?.length)mountViews(visual,p,{onEdit,ask:askBlock});
 if(p.kind==='kepler'){
  const orbit=p.edits.orbit??={eccentricity:.45,phase:.15,law:1};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 500 350');svg.setAttribute('role','img');svg.setAttribute('aria-label','Kepler orbit: Sun at a focus, planet position and two equal-time swept areas');svg.classList.add('atlas-orbit');visual.append(svg);
  const caption=make('div','atlas-orbit-caption');caption.append(make('span','','Sun at one focus'));const speed=make('output');caption.append(speed);visual.append(caption);
  const controls=make('div','atlas-controls');const outputs={};
  for(const [key,label,min,max]of [['eccentricity','Eccentricity',0,65],['phase','Time through orbit',0,100]]){const l=make('label');const row=make('span','atlas-control-label',label);const out=outputs[key]=make('output');row.append(out);const input=make('input');input.type='range';input.min=min;input.max=max;input.value=Math.round(orbit[key]*100);input.setAttribute('aria-label',label);input.oninput=()=>{orbit[key]=+input.value/100;draw();};l.append(row,input);controls.append(l);}visual.append(controls);
  const tabs=make('div','atlas-laws');tabs.setAttribute('aria-label','Kepler law');const equations=keplerEquations();copy.append(...equations);
  ['Elliptical paths','Equal areas','Orbital periods'].forEach((label,i)=>{const b=make('button','',label);b.setAttribute('aria-pressed',String(orbit.law===i));b.onclick=()=>{orbit.law=i;showLaw();draw();};tabs.append(b);});target.append(tabs);
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
 }else if(p.kind==='planner'){
  const fields=make('div','atlas-plan');p.rows.forEach((row,i)=>{const label=make('label','',row.criterion);const input=make('textarea');input.rows=1;input.dataset.editKey='planner:'+i;input.value=row.a;input.placeholder=row.b||'Your choice';input.maxLength=300;
   // Wraps and grows with its text, so a long step is never cut off.
   const fit=()=>{input.style.height='0';input.style.height=input.scrollHeight+input.offsetHeight-input.clientHeight+'px';};
   input.oninput=()=>{row.a=input.value;onEdit();fit();};const observer=new ResizeObserver(()=>{if(input.clientWidth)fit();});observer.observe(input);observers.push(observer);
   label.append(input);fields.append(label);});visual.append(fields);
 }else if(p.kind==='projectile'){
  // The existing tested simulator is attached by the app, retaining its controls.
  visual.classList.add('atlas-projectile');
 }
 const body=make('div','atlas-body');
 const paragraphs=p.body.slice(1);
 const lawLabels=['Orbital shape','Equal areas','Orbital period'];
 const lawPrefixes=[/^(?:first law\s*[:.)]|1[.)])\s*/i,/^(?:second law\s*[:.)]|2[.)])\s*/i,/^(?:third law\s*[:.)]|3[.)])\s*/i];
 const overview=p.kind==='kepler'&&paragraphs.length===3&&paragraphs.every((paragraph,i)=>lawPrefixes[i].test(paragraph.trim()));
 // Any page can use the same takeaway columns: up to three "Label: one sentence" passages.
 // Each passage is judged on its own, so one over-long label shows as plain text in its column
 // instead of turning every takeaway back into prose. Most passages must fit to use columns.
 const takeawayPattern=/^([^:\n]{1,32}):\s+(\S[\s\S]*)$/;
 const takeawayParts=paragraph=>{const m=paragraph.trim().match(takeawayPattern);return m&&m[1].trim().split(/\s+/).length<=4?m:null;};
 // A written piece the user asked for (an email) can follow the takeaways: the leading
 // "Label: sentence" passages stay columns and the piece reads as plain text below them.
 let lead=0;while(lead<3&&lead<paragraphs.length&&takeawayParts(paragraphs[lead]))lead++;
 const written=!overview&&!!p.components?.length&&lead>0&&paragraphs.length>3&&paragraphs.slice(lead).some(paragraph=>!takeawayParts(paragraph));
 const columns=written?lead:paragraphs.length;
 const fitting=paragraphs.slice(0,columns).filter(takeawayParts).length;
 const takeaways=!overview&&columns>=1&&columns<=3&&fitting>0&&fitting*2>=columns;
 body.classList.toggle('atlas-law-overview',overview||takeaways);
 body.style.setProperty('--cols',String(columns||3));
 const message=written?make('div','atlas-message'):null;
 paragraphs.forEach((paragraph,i)=>{
  p.edits.paragraphs??={};
  const parts=takeaways&&i<columns?takeawayParts(paragraph):null;
  const original=overview?paragraph.trim().replace(lawPrefixes[i],''):parts?parts[2]:paragraph;
  const item=text(p.edits.paragraphs[i]??original,'Page paragraph '+(i+2),value=>p.edits.paragraphs[i]=value,i+1);
  if(overview||parts)item.prepend(make('h3','atlas-law-heading',overview?lawLabels[i]:parts[1].trim()));
  (message&&i>=columns?message:body).append(item);
 });
 target.append(body);
 if(message)target.append(message);
 // Go deeper: follow-up questions as tabs. Answers are prefetched in one request and shown
 // in a panel below, one at a time; the full slide stays a secondary action.
 if(p.followUps?.length){
  const next=make('section','atlas-next');
  next.setAttribute('aria-label','Go deeper');
  const tabs=make('div','atlas-next-tabs');
  tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Go deeper');
  tabs.append(make('span','atlas-next-label','Go deeper'));
  const panel=make('div','atlas-next-panel');
  panel.setAttribute('role','tabpanel');
  panel.setAttribute('aria-live','polite');
  let open=null;
  const buttons=p.followUps.map((question,i)=>{
   const button=make('button','atlas-next-button',question);
   button.type='button';
   button.setAttribute('role','tab');
   button.onclick=()=>{open=open===i?null:i;paint(true);};
   tabs.append(button);
   return button;
  });
  // reveal: an answer the user opened (or that arrives while open) is scrolled into view in the page card.
  function paint(reveal=false){
   buttons.forEach((button,i)=>button.setAttribute('aria-selected',String(open===i)));
   panel.hidden=open===null;
   if(open===null)return;
   const question=p.followUps[open];
   const promote=make('button','atlas-next-promote','Make this the main slide');
   promote.type='button';
   const arrow=make('span','',' →');arrow.setAttribute('aria-hidden','true');promote.append(arrow);
   promote.onclick=()=>document.dispatchEvent(new CustomEvent('page:follow-up',{detail:question}));
   const section=Array.isArray(p.deeper)?p.deeper[open]:null;
   if(section){
    const body=make('div','atlas-next-body');
    body.append(make('p','atlas-next-answer',section.answer));
    panel.replaceChildren(body);
    section.components?.forEach(component=>renderComponent(panel,component,p,{onEdit,ask:askBlock}));
    panel.append(promote);
    panel.animate?.([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'});
   }else{
    const waiting=p.deeper==='error'||Array.isArray(p.deeper)?'This answer is not available right now.':'Preparing an answer…';
    panel.replaceChildren(make('p','atlas-next-status',waiting),promote);
   }
   if(reveal&&panel.isConnected)requestAnimationFrame(()=>panel.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  }
  deeperPainters.set(p,paint);
  next.append(tabs,panel);
  target.append(next);
  paint();
  if(p.deeper===undefined)document.dispatchEvent(new CustomEvent('page:deeper',{detail:p}));
 }
}

// Repaint the Go deeper panel when prefetched answers arrive, without re-rendering the page.
const deeperPainters=new WeakMap();
export function refreshDeeper(page){deeperPainters.get(page)?.(true);}
