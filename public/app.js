import {positionPopover} from './popover.js';
import {FORMATS, EXAMPLES, demoPreview, trajectory, validPreview, clarificationFor, quickAnswer} from './model.js';
const $ = id => document.getElementById(id);
const state = {key:'', live:false, requests:0, connectionRevision:0, composing:false, revision:0, format:'Interactive page', audience:'', controller:null, timer:null, proposal:null, component:null, history:[], blocks:[], selection:null, expanded:false, quick:null, uncertainty:null, popoverTimer:null, clarification:null, openClarification:null, popoverOrigin:null, suppressed:null, customDrafts:new Map(), serverKey:false, pendingSend:false, pageController:null, pageRequest:0, taskGoal:'', pageVersion:0};
const node=(tag, cls, text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function stop(){clearTimeout(state.timer);state.controller?.abort();state.controller=null;$('cancel-button').hidden=true;}
function choices(target,values,selected,action){target.replaceChildren();values.forEach(value=>{const b=node('button','',value);b.type='button';b.setAttribute('aria-pressed',String(value===selected));b.onclick=()=>action(value);target.append(b);});}
function refreshIntent(){
  const labels=/projectile|trajectory|gravity|physics|motion/i.test($('intent-input').value)?['New learners','Students','Just me']:['My team','New team members','Just me'];
  document.querySelectorAll('[data-audience]').forEach((b,i)=>{b.dataset.audience=labels[i];b.textContent=labels[i];});
  choices($('format-options'),FORMATS,state.format,value=>{state.format=value;changed();});
  document.querySelectorAll('[data-audience]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.audience===state.audience)));
  $('intent-summary').textContent=[state.format,state.audience?`Audience: ${state.audience} (your choice)`:'Audience not set — you can decide later'].join(' · ');
}
function renderQuick(data,source){
  state.quick=data;
  const answer=source==='Demo'?quickAnswer($('intent-input').value):(data.body[0]||data.interpretation);
  $('quick-preview').hidden=!answer;
  const compact=answer.length>240?answer.slice(0,237).replace(/\s+\S*$/,'')+'…':answer;$('quick-answer').textContent=compact;
  $('quick-provenance').textContent=source==='Demo'?'Short example · demo mode':'Quick answer · GPT-6 Luna';
  updateClarification(state.uncertainty|| (data.question?{question:data.question,options:data.options,phrase:null,replace:false}:null));
}
function updateClarification(clarification){
  state.clarification=clarification;
  const trigger=$('clarify-phrase');trigger.hidden=!clarification;
  $('refine-label').textContent=clarification?.phrase?`Refine “${clarification.phrase}”`:'One detail';
  trigger.setAttribute('aria-label',clarification?clarification.question:'Refine your intent');
}
function renderUncertainty(){
  const input=$('intent-input'),mirror=$('input-mirror');const text=input.value;
  const u=state.uncertainty=clarificationFor(text);
  mirror.replaceChildren();
  if(u){mirror.append(document.createTextNode(text.slice(0,u.start)));const mark=node('mark');mark.textContent=text.slice(u.start,u.end);mark.id='uncertain-range';mirror.append(mark,document.createTextNode(text.slice(u.end)+'\u200b'));}else mirror.textContent=text+'\u200b';
  updateClarification(u);mirror.style.transform=`translateY(${-input.scrollTop}px)`;
}
function applyClarification(value){
  value=value.trim();if(!value)return;
  const input=$('intent-input'),u=state.openClarification||state.clarification;
  if(u?.replace)input.value=input.value.slice(0,u.start)+value+input.value.slice(u.end);
  else input.value=input.value.replace(/\s+$/,'')+`\n${u?.question||'Preference'} ${value}`;
  if(u)state.customDrafts.delete(u.question);
  closeIntentPopover();changed();input.focus();
}
function closeIntentPopover({restore=false,suppress=false}={}){
  clearTimeout(state.popoverTimer);
  const origin=state.popoverOrigin;
  if(suppress)state.suppressed=state.openClarification?.question;
  $('intent-popover').hidden=true;$('clarify-phrase').setAttribute('aria-expanded','false');
  state.openClarification=null;state.popoverOrigin=null;
  if(restore&&origin!=='hover')$('clarify-phrase').hidden?$('intent-input').focus():$('clarify-phrase').focus();
}
function positionIntentPopover(anchor){
  const pop=$('intent-popover');
  const rect=anchor.getBoundingClientRect();
  const result=positionPopover(rect,304,pop.offsetHeight,innerWidth,innerHeight);
  pop.style.width=result.width+'px';pop.style.left=result.left+'px';pop.style.top=result.top+'px';pop.style.setProperty('--arrow-x',result.arrow+'px');pop.dataset.side=result.side;
}
function openIntentPopover(origin='click'){
  const u=state.clarification;if(!u)return;clearTimeout(state.popoverTimer);
  if(origin==='hover'&&state.suppressed===u.question)return;
  const pop=$('intent-popover');if(!pop.hidden&&state.openClarification?.question===u.question)return;
  if(origin!=='hover')state.suppressed=null;
  state.openClarification={...u};state.popoverOrigin=origin;
  $('popover-question').textContent=u.question;
  choices($('popover-options'),u.options,'',applyClarification);
  $('popover-custom').value=state.customDrafts.get(u.question)||'';
  const hasDraft=!!$('popover-custom').value;
  $('popover-custom-form').hidden=!hasDraft;$('custom-answer-button').hidden=hasDraft;$('custom-answer-button').setAttribute('aria-expanded',String(hasDraft));
  pop.hidden=false;
  positionIntentPopover(origin==='hover'&&$('uncertain-range')?$('uncertain-range'):$('clarify-phrase'));
  $('clarify-phrase').setAttribute('aria-expanded','true');
  if(origin!=='hover')(pop.querySelector('#popover-options button')||(hasDraft?$('popover-custom'):$('custom-answer-button'))).focus();
}
function schedulePopoverClose(){clearTimeout(state.popoverTimer);state.popoverTimer=setTimeout(()=>{if(!$('intent-popover').contains(document.activeElement))closeIntentPopover();},260);}
$('clarify-phrase').onclick=()=>openIntentPopover('click');
$('intent-input').addEventListener('pointermove',event=>{if(event.pointerType==='touch'||event.buttons)return;const mark=$('uncertain-range');if(!mark)return;const hit=[...mark.getClientRects()].some(r=>event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom);if(hit)openIntentPopover('hover');else if(!$('intent-popover').hidden)schedulePopoverClose();else state.suppressed=null;});
$('intent-input').addEventListener('pointerleave',()=>{state.suppressed=null;schedulePopoverClose();});
$('clarify-phrase').onpointerenter=()=>clearTimeout(state.popoverTimer);
$('clarify-phrase').onpointerleave=schedulePopoverClose;
$('intent-input').addEventListener('scroll',()=>{renderUncertainty();closeIntentPopover();});
$('intent-popover').onpointerenter=()=>clearTimeout(state.popoverTimer);
$('intent-popover').onpointerleave=schedulePopoverClose;
$('close-popover').onclick=()=>closeIntentPopover({restore:true,suppress:true});
$('custom-answer-button').onclick=()=>{ $('custom-answer-button').hidden=true;$('custom-answer-button').setAttribute('aria-expanded','true');$('popover-custom-form').hidden=false;positionIntentPopover($('clarify-phrase'));$('popover-custom').focus();};
$('popover-custom').oninput=()=>{const key=state.openClarification?.question;if(key){state.customDrafts.set(key,$('popover-custom').value);if(state.customDrafts.size>10)state.customDrafts.delete(state.customDrafts.keys().next().value);}};
$('popover-custom-form').onsubmit=e=>{e.preventDefault();applyClarification($('popover-custom').value);};
$('intent-popover').addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const buttons=[...$('intent-popover').querySelectorAll('button')].filter(b=>!b.hidden&&!b.closest('[hidden]'));const index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
$('intent-input').addEventListener('keydown',e=>{if(e.altKey&&e.key==='ArrowDown'&&state.clarification){e.preventDefault();openIntentPopover('keyboard');}if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();$('build-page').click();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('intent-popover').hidden){e.preventDefault();closeIntentPopover({restore:true,suppress:true});}});
document.addEventListener('pointerdown',e=>{if(!$('intent-popover').hidden&&!$('intent-popover').contains(e.target)&&!$('clarify-phrase').contains(e.target))closeIntentPopover({suppress:true});});
window.addEventListener('resize',()=>{if(!$('intent-popover').hidden)positionIntentPopover($('clarify-phrase'));});window.addEventListener('scroll',()=>{if($('intent-popover').contains(document.activeElement))positionIntentPopover($('clarify-phrase'));else closeIntentPopover();},{passive:true});
$('typing-connection').onclick=()=>{closeIntentPopover();$('connection-dialog').showModal();};
$('build-page').onclick=()=>submitPage();

function pageContext(){
  if(!state.component)return '';
  return JSON.stringify({originalRequest:state.taskGoal,title:$('document-title').value,page:state.component,notes:$('document-input').value}).slice(0,6000);
}
function openPage(){
  state.expanded=true;document.body.classList.add('page-open');
  $('intent-input').placeholder='Ask a question or change this page…';
}
async function submitPage(text=$('intent-input').value.trim()){
  if(!text)return;
  if(!state.live){state.pendingSend=true;$('connection-error').textContent='Connect OpenAI to create a page for your request.';$('connection-dialog').showModal();return;}
  closeIntentPopover();stop();state.pageController?.abort();
  const context=pageContext(),version=state.pageVersion,id=++state.pageRequest;
  const controller=state.pageController=new AbortController();
  if(!state.taskGoal)state.taskGoal=text;
  openPage();$('intent-input').value='';changed();
  $('page-progress').hidden=false;$('page-progress').textContent='Creating your page…';
  $('submitted-request').textContent=text;
  $('document-title').value=state.component?$('document-title').value:'Making room for your idea…';
  try{
    const data=await callPreview({text,context,audience:state.audience,format:state.format,phase:'page'},controller.signal);
    if(id!==state.pageRequest)return;
    const p={...structuredClone(data.preview),revision:state.revision,baseVersion:version,source:data.model,physics:{speed:20,angle:45,gravity:9.81},edits:{},selected:0};
    if(!state.component){state.component=p;$('document-title').value=p.title;state.pageVersion++;renderActive();}
    else{state.proposal=p;renderProposal();}
    $('document-state').textContent=`GPT-6.1 Terra · ${(data.elapsedMs/1000).toFixed(1)} s · this tab only`;
    status(state.proposal?'Updated page ready to review. Your existing page is preserved.':'Your page is ready. Edit it directly or ask for a change below.');
  }catch(error){if(id===state.pageRequest&&error.name!=='AbortError'){status(error.message,true);$('page-progress').textContent=error.message;const retry=node('button','','Retry this request');retry.onclick=()=>submitPage(text);$('page-progress').append(retry);return;}}
  finally{if(id===state.pageRequest){state.pageController=null;if($('page-progress').textContent==='Creating your page…')$('page-progress').hidden=true;}}
}

function setProposal(data, revision, source, selection=null, phase='page'){
  if(phase==='preview'){if(revision===state.revision)renderQuick(data,source);return;}
  if(revision!==state.revision||!validPreview(data))return;
  state.proposal={...structuredClone(data),revision,source,selection,physics:{speed:20,angle:45,gravity:9.81},edits:{},selected:0};
  $('interpretation').textContent=data.interpretation;
  $('preview-kind').textContent=source==='Demo'?'Sample page':'Terra page';
  $('model-question').hidden=!data.question;
  $('question-label').textContent=data.question;
  choices($('question-options'),data.options,'',value=>{const input=$('intent-input');input.value+=`\n${data.question} ${value}`;changed();});
  renderProposal();
}
function renderProposal(){
  const p=state.proposal;$('proposal').hidden=!p;$('proposal-empty').hidden=true;
  if(!p)return;
  $('proposal-label').textContent='Explore this suggested page';$('proposal-title').textContent=p.title;
  $('proposal-provenance').textContent=p.source==='Demo'?'Built-in example · not model-generated':`${p.source==='Luna'||p.source==='gpt-6-luna'?'Luna':'Terra'} content · trusted interactive components`;
  $('accept-button').disabled=p.baseVersion!==undefined?p.baseVersion!==state.pageVersion:p.revision!==state.revision;$('accept-button').firstChild.textContent=state.component?'Replace page (undo available)':'Keep this page';
  $('proposal-content').replaceChildren();renderComponent($('proposal-content'),p);
}
function renderActive(){const target=$('active-component');target.replaceChildren();if(state.component)renderComponent(target,state.component);}
function editableParagraph(target,text,onEdit){const label=node('label','editable-label','Edit this explanation');const field=node('textarea','editable-explanation');field.rows=2;field.maxLength=2500;field.value=text;field.setAttribute('aria-label','Editable explanation');field.oninput=()=>onEdit(field.value);const tools=node('div','inline-help');const ask=node('button','','Ask about selected text');ask.type='button';ask.onclick=()=>{const selection=field.value.slice(field.selectionStart,field.selectionEnd).trim();if(!selection){ask.textContent='Select a passage first';return;}addInlineQuestion(target,selection);};tools.append(ask);label.append(field);target.append(label,tools);}
function addInlineQuestion(target,selection){
  const region=node('div','inline-question');region.append(node('p','selection-quote',`“${selection.slice(0,180)}”`));
  const label=node('label','','Your question about this passage');const field=node('input');field.placeholder='What would you like to understand?';field.maxLength=500;label.append(field);
  const button=node('button','primary-button','Ask here');const answer=node('p','inline-answer');answer.setAttribute('role','status');
  button.onclick=async()=>{if(!field.value.trim())return;button.disabled=true;answer.textContent=state.live?'Luna is preparing an explanation…':'Connect OpenAI to ask a question about this passage.';if(state.live){try{const data=await callPreview({text:`Explain this selected passage: ${selection}\nQuestion: ${field.value}`,audience:state.audience,format:'Outline'},new AbortController().signal);answer.textContent=data.preview.body.join('\n\n');}catch(error){answer.textContent=error.message;}}button.disabled=false;};
  region.append(label,button,answer);target.append(region);field.focus();
}
function renderComponent(target,p){
  const intro=p.body[0]||'Add an explanation in your own words.';
  if(p.kind==='projectile'){
    const sim=node('div','physics-simulation');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 540 230');svg.setAttribute('role','img');svg.setAttribute('aria-label','Ideal projectile trajectory in metres');svg.classList.add('trajectory');sim.append(svg);
    const readings=node('div','physics-readings');readings.setAttribute('aria-live','polite');sim.append(readings);
    const controls=node('div','simulation-controls');
    function draw(){const r=trajectory(p.physics.speed,p.physics.angle,p.physics.gravity);const sx=x=>36+x/(r.range*1.08)*470;const sy=y=>193-y/(r.height*1.25)*165;svg.replaceChildren();const add=(tag,attrs,text)=>{const n=document.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text)n.textContent=text;svg.append(n);return n;};add('line',{x1:36,y1:193,x2:515,y2:193,class:'plot-axis'});add('line',{x1:36,y1:20,x2:36,y2:193,class:'plot-axis'});add('path',{d:r.points.map((pt,i)=>`${i?'L':'M'}${sx(pt.x).toFixed(2)},${sy(pt.y).toFixed(2)}`).join(' '),fill:'none',class:'plot-path'});const peak=r.points[30];add('circle',{cx:sx(peak.x),cy:sy(peak.y),r:5,class:'plot-point'});add('text',{x:36,y:215,class:'plot-label'},'0');add('text',{x:400,y:215,class:'plot-label'},`${r.range.toFixed(1)} m range`);add('text',{x:45,y:22,class:'plot-label'},`${r.height.toFixed(1)} m peak`);readings.textContent=`${r.duration.toFixed(2)} s in flight · ${r.range.toFixed(1)} m horizontal distance`;}
    [['speed','Launch speed',5,30,'m/s'],['angle','Launch angle',10,80,'°']].forEach(([key,title,min,max,unit])=>{const label=node('label');const top=node('span','control-label');const out=node('output','',`${p.physics[key]}${unit==='°'?'':' '}${unit}`);top.append(node('span','',title),out);const range=node('input');range.type='range';range.min=min;range.max=max;range.value=p.physics[key];range.setAttribute('aria-label',title);range.oninput=()=>{p.physics[key]=Number(range.value);out.textContent=`${range.value}${unit==='°'?'':' '}${unit}`;draw();};label.append(top,range);controls.append(label);});
    const glabel=node('label','gravity-control','Gravity');const gravity=node('select');gravity.setAttribute('aria-label','Gravity');[['9.81','Earth · 9.81 m/s²'],['1.62','Moon · 1.62 m/s²'],['3.71','Mars · 3.71 m/s²']].forEach(([v,t])=>{const o=node('option','',t);o.value=v;gravity.append(o);});gravity.value=String(p.physics.gravity);gravity.onchange=()=>{p.physics.gravity=Number(gravity.value);draw();};glabel.append(gravity);controls.append(glabel);sim.append(controls,node('p','simulation-note','Ideal model: no air resistance; launch and landing at the same height. Axes rescale to fit.'));target.append(sim);draw();
  } else if(p.kind==='planner'){
    const grid=node('div','planner-fields');
    p.rows.forEach(row=>{const label=node('label','planner-field',row.criterion);const field=node('input');field.value=row.a;field.placeholder=row.b||'Your choice…';field.maxLength=300;field.setAttribute('aria-label',row.criterion);field.oninput=()=>row.a=field.value;label.append(field);if(row.b)label.append(node('span','field-hint',row.b));grid.append(label);});
    target.append(grid);
    const steps=node('div','planner-steps');p.body.slice(1).forEach((text,i)=>{const section=node('section');section.append(node('span','step-number',String(i+1).padStart(2,'0')),node('p','',text));steps.append(section);});target.append(steps);
    const update=node('button','primary-button','Update with these choices');update.onclick=()=>submitPage('Update this plan using the choices I edited on the page. Keep the other preferences.');if(p===state.component)target.append(update);
  } else if(p.kind==='comparison'){
    const t=node('table');const head=t.createTHead().insertRow();['Criterion','Approach A','Approach B'].forEach(s=>{const th=node('th','',s);th.scope='col';head.append(th);});const body=t.createTBody();p.rows.forEach(row=>{const tr=body.insertRow();['criterion','a','b'].forEach(key=>{const cell=tr.insertCell();const input=node('input');input.value=row[key];input.maxLength=300;input.setAttribute('aria-label',`${row.criterion} ${key==='criterion'?'criterion':key==='a'?'Approach A':'Approach B'}`);input.oninput=()=>row[key]=input.value;cell.append(input);});});target.append(t);
  } else if(p.kind==='diagram'){
    const flow=node('div','interactive-flow');const detail=node('div','node-detail');const names=p.nodes.length?p.nodes:['Start','Explore','Decide'];
    const paint=()=>{flow.replaceChildren();names.forEach((name,i)=>{const b=node('button','flow-node',name);b.setAttribute('aria-pressed',String(p.selected===i));b.onclick=()=>{p.selected=i;paint();};flow.append(b);});detail.replaceChildren();const label=node('label','',`Edit ${names[p.selected]}`);const input=node('input');input.value=names[p.selected];input.maxLength=80;input.oninput=()=>{names[p.selected]=input.value;flow.children[p.selected].textContent=input.value;};label.append(input);detail.append(label);};paint();target.append(flow,detail);
  } else {
    const list=node('div','outline-builder');const sections=p.edits.sections??p.body.map((s,i)=>({title:s.split(' — ')[0]||`Section ${i+1}`,note:s.split(' — ').slice(1).join(' — '),done:false}));p.edits.sections=sections;
    function paint(){list.replaceChildren();sections.forEach((s,i)=>{const row=node('div','outline-row');const check=node('input');check.type='checkbox';check.checked=s.done;check.setAttribute('aria-label',`Mark ${s.title} complete`);check.onchange=()=>s.done=check.checked;const fields=node('div');const title=node('input');title.value=s.title;title.maxLength=180;title.setAttribute('aria-label',`Section ${i+1} title`);title.oninput=()=>s.title=title.value;const note=node('textarea');note.rows=1;note.value=s.note;note.placeholder='Add your own detail…';note.setAttribute('aria-label',`Section ${i+1} note`);note.oninput=()=>s.note=note.value;fields.append(title,note);const up=node('button','quiet-button','Move up');up.disabled=i===0;up.onclick=()=>{[sections[i-1],sections[i]]=[sections[i],sections[i-1]];paint();};row.append(check,fields,up);list.append(row);});}paint();target.append(list);
  }
  editableParagraph(target,p.edits.explanation??intro,value=>p.edits.explanation=value);
}
async function callPreview(payload,signal){
  if(state.requests>=30)throw new Error('This connection has reached its 30-preview limit. Reconnect to enable another session, or use demo mode.');
  state.requests++;
  const response=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json',...(state.key?{'Authorization':`Bearer ${state.key}`}:{})},body:JSON.stringify({context:pageContext(),...payload}),signal});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Preview unavailable. Try again.');if(!validPreview(data.preview))throw new Error('The preview was invalid. Your page is unchanged.');return data;
}
async function preview(phase='preview'){
  const revision=state.revision;const text=$('intent-input').value.trim();if(!text){$('interpretation').textContent='Start anywhere. An unfinished thought is welcome.';state.proposal=null;renderProposal();return;}
  if(!state.live){setProposal(demoPreview(text,state.audience,state.format),revision,'Demo',null,phase);status('Demo uses built-in examples, not semantic AI. No draft text is sent.');return;}
  const controller=new AbortController();state.controller=controller;$('cancel-button').hidden=false;$('input-state').textContent='Preview updating · keep typing';status(phase==='page'?'Terra is building your interactive page…':'Sending the current draft and choices to Luna…');
  try{const data=await callPreview({text,audience:state.audience,format:state.format,phase},controller.signal);if(revision!==state.revision)return;setProposal(data.preview,revision,data.model||'gpt-6-luna',null,phase);status(`${phase==='page'?'Terra page':'Luna preview'} · ${(data.elapsedMs/1000).toFixed(1)} s · ${data.usage?.total_tokens??'—'} tokens. No document changes until you accept.`);}catch(error){if(error.name!=='AbortError'&&revision===state.revision)status(error.message,true);}finally{if(state.controller===controller){state.controller=null;$('cancel-button').hidden=true;$('input-state').textContent='You can keep typing';}}
}
function changed(){
  state.revision++;state.suppressed=null;stop();closeIntentPopover();if(state.proposal&&state.proposal.baseVersion===undefined){$('accept-button').disabled=true;$('proposal-label').textContent='Earlier page · explore again to use the latest intent';}
  const hasText=!!$('intent-input').value.trim();document.body.classList.toggle('has-intent',hasText);$('typing-assistance').hidden=!hasText;
  $('build-page').disabled=!hasText;
  const input=$('intent-input');input.style.height='auto';input.style.height=Math.min(220,Math.max(60,input.scrollHeight))+'px';
  refreshIntent();renderUncertainty();
  if(!hasText){$('quick-preview').hidden=true;updateClarification(null);return;}
  if(!state.live)preview('preview');else{status('Draft changed. Luna preview follows after a pause.');state.timer=setTimeout(()=>preview('preview'),1100);}
}

function snapshot(label){state.history.unshift({label,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),title:$('document-title').value,text:$('document-input').value,component:structuredClone(state.component),blocks:structuredClone(state.blocks)});state.history=state.history.slice(0,8);$('history-count').textContent=state.history.length;}
function renderHistory(){const target=$('history-list');target.replaceChildren();if(!state.history.length)target.append(node('p','status-line','Accepted changes will appear here.'));state.history.forEach((v,i)=>{const row=node('div','history-row');row.append(node('span','',`${v.label} · ${v.time}`));const b=node('button','','Restore');b.onclick=()=>{const chosen=structuredClone(v);snapshot('Before restore');$('document-title').value=chosen.title;$('document-input').value=chosen.text;state.component=chosen.component;state.blocks=chosen.blocks;state.pageVersion++;state.proposal=null;renderProposal();renderActive();renderBlocks();renderHistory();status('Previous page restored. The page you left is in History.');};row.append(b);target.append(row);});}
function renderBlocks(){const target=$('accepted-blocks');target.replaceChildren();state.blocks.forEach((block,i)=>{const section=node('section','visual-block');const heading=node('div','block-title');heading.append(node('h3','',block.title));const b=node('button','quiet-button','Remove');b.onclick=()=>{snapshot('Before removing a block');state.blocks.splice(i,1);renderBlocks();};heading.append(b);section.append(heading);renderComponent(section,block);target.append(section);});}
$('intent-input').oninput=()=>{if(!state.composing)changed();};$('intent-input').addEventListener('compositionstart',()=>{state.composing=true;stop();});$('intent-input').addEventListener('compositionend',()=>{state.composing=false;changed();});
$('audience-input').oninput=e=>{state.audience=e.target.value;changed();};document.querySelectorAll('[data-audience]').forEach(b=>b.onclick=()=>{state.audience=b.dataset.audience;$('audience-input').value=state.audience;changed();});
document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{$('intent-input').value=EXAMPLES[b.dataset.example];state.audience='';$('audience-input').value='';state.format='Interactive page';changed();});
$('refresh-button').onclick=()=>{stop();preview();};$('cancel-button').onclick=()=>{stop();status('Preview paused. Keep editing, or refresh when you are ready.');$('input-state').textContent='Preview paused';};
$('accept-button').onclick=()=>{const p=state.proposal;if(!p||(p.baseVersion!==undefined?p.baseVersion!==state.pageVersion:p.revision!==state.revision))return;if(p.selection&&$('document-input').value.slice(p.selection.start,p.selection.end)!==p.selection.text){status('The selected text changed. Select it again for a fresh suggestion.',true);return;}snapshot(state.component?'Before replacing the page':'Before keeping the page');if(p.selection)state.blocks.push(structuredClone(p));else{state.component=structuredClone(p);$('document-title').value=p.title;}state.proposal=null;state.pageVersion++;renderActive();renderBlocks();renderProposal();$('document-state').textContent='Kept in this tab · export to save';status('Page kept. Edit it directly, or restore the previous version in History.');};
$('dismiss-button').onclick=()=>{state.proposal=null;renderProposal();};$('new-suggestion').onclick=()=>$('intent-input').focus();
$('document-input').addEventListener('select',()=>{const f=$('document-input');const text=f.value.slice(f.selectionStart,f.selectionEnd).trim();state.selection=text?{start:f.selectionStart,end:f.selectionEnd,text:f.value.slice(f.selectionStart,f.selectionEnd)}:null;$('selection-tools').hidden=!text;$('selection-label').textContent=text?`Selected: ${text.slice(0,35)}${text.length>35?'…':''}`:'Selected text';});
async function fromSelection(kind){if(!state.selection)return;stop();const selection={...state.selection};if(!state.live){const v=demoPreview(selection.text,state.audience,kind==='diagram'?'Diagram':'Outline');v.title=kind==='diagram'?'Explore the selected idea':'A closer look';setProposal(v,state.revision,'Demo',selection);status('Sample selection response. Connect Luna for an explanation of arbitrary text.');}else{const revision=state.revision;try{const data=await callPreview({text:`${kind==='diagram'?'Make a diagram about':'Explain'} this selected text: ${selection.text}`,audience:state.audience,format:kind==='diagram'?'Diagram':'Outline'},new AbortController().signal);setProposal(data.preview,revision,'Luna',selection);}catch(e){status(e.message,true);}}}
$('diagram-selection').onclick=()=>fromSelection('diagram');$('explain-selection').onclick=()=>fromSelection('outline');
$('history-button').onclick=()=>{$('history-panel').hidden=!$('history-panel').hidden;renderHistory();};$('close-history').onclick=()=>$('history-panel').hidden=true;
$('download-button').onclick=()=>{const data={version:1,title:$('document-title').value,notes:$('document-input').value,component:state.component,blocks:state.blocks};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='ai-interaction-page.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Exported page data as JSON. API keys are never included.');};
for(const [button,dialog] of [['connection-button','connection-dialog'],['about-button','about-dialog']])$(button).onclick=()=>{closeIntentPopover();$(dialog).showModal();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(b.dataset.close==='connection-dialog')$('api-key').value='';$(b.dataset.close).close();});$('connection-dialog').addEventListener('close',()=>{$('api-key').value='';state.connectionRevision++;});
$('connection-form').onsubmit=async event=>{event.preventDefault();const key=$('api-key').value.trim();if(!key&&!state.serverKey){$('connection-error').textContent='Enter an OpenAI API key, or stay in demo mode.';return;}const connectionRevision=++state.connectionRevision;$('connect-button').disabled=true;$('connection-error').textContent='Checking Luna access…';try{const response=await fetch('/api/check',{method:'POST',headers:key?{Authorization:`Bearer ${key}`}:{}});const result=await response.json();if(connectionRevision!==state.connectionRevision)return;if(!response.ok)throw new Error(result.error||'Connection failed.');stop();state.key=key;state.requests=0;state.live=true;document.body.classList.add('live');$('mode-label').textContent='OpenAI connected';$('typing-connection').firstChild.textContent='Connected';$('api-key').value='';$('connection-error').textContent='';$('connection-dialog').close();changed();if(state.pendingSend){state.pendingSend=false;submitPage();}}catch(error){$('connection-error').textContent=error.message;}finally{$('connect-button').disabled=false;}};
$('disconnect-button').onclick=()=>{state.connectionRevision++;stop();state.pageController?.abort();state.pageRequest++;state.pendingSend=false;state.key='';state.live=false;document.body.classList.remove('live');$('mode-label').textContent='Demo mode';$('typing-connection').firstChild.textContent='Demo';$('api-key').value='';$('connection-dialog').close();changed();};
$('active-component').addEventListener('input',()=>{state.pageVersion++;if(state.proposal?.baseVersion!==undefined)renderProposal();});
$('document-title').addEventListener('input',()=>state.pageVersion++);
$('document-input').addEventListener('input',()=>state.pageVersion++);
window.addEventListener('pagehide',()=>{stop();state.pageController?.abort();state.key='';});refreshIntent();changed();
fetch('/api/config').then(r=>r.json()).then(config=>{if(!config.serverKey)return;state.serverKey=true;state.live=true;document.body.classList.add('live');$('mode-label').textContent='OpenAI configured';$('typing-connection').firstChild.textContent='OpenAI';$('disconnect-button').textContent='Pause live previews';changed();}).catch(()=>{});
