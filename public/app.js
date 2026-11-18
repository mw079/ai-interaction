import {renderFollowUpScope,followUpScopes,applyFollowUpScope} from './composer-extensions.js';
import {slideRecipe} from './component-catalog.js';
import {setupPageAssistant} from './page-assistant.js';
import {renderAtlas} from './atlas.js';
import {PageTimeline} from './page-timeline.js';
import {setupWorkspace} from './workspace.js';
import {withSingleRetry,requestError} from './retry.js';
import {readSSE} from './stream.js';
import {confirmedChoices,requestContext} from './request-context.js';
import {setupComposerExperience} from './composer.js';
import {INFORMATION_TYPES, informationFor, rebaseInformation, chooseInformation, mergeInformation} from './intent.js';
import {renderInformationControl} from './controls.js';
import {positionPopover} from './popover.js';
import {FORMATS, EXAMPLES, demoPreview, trajectory, validPreview, clarificationFor, quickAnswer, compactLiveAnswer, liveClarificationFor, isCurrentPreview} from './model.js';
const $ = id => document.getElementById(id);
const state = {key:'', live:false, requests:0, connectionRevision:0, composing:false, revision:0, format:'Auto', audience:'', controller:null, timer:null, proposal:null, component:null, history:[], blocks:[], selection:null, expanded:false, quick:null, uncertainty:null, popoverTimer:null, clarification:null, openClarification:null, popoverOrigin:null, suppressed:null, customDrafts:new Map(), serverKey:false, pendingSend:false, pageController:null, pageRequest:0, taskGoal:'', pageVersion:0, information:[], previousDraft:'', activeInformation:null,confirmedChoices:[],answers:[],intentOverride:'',slideChoice:undefined};
const node=(tag, cls, text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
let composerExperience,workspace;
let followUpScope=null;
let lastPageSelection=null;
function syncComposerContext(){
  const button=$('composer-scope');
  button.hidden=!state.component;
  button.setAttribute('aria-label',followUpScope?'Focus: '+followUpScope.label:'Choose follow-up scope');
  button.classList.toggle('has-focus',!!followUpScope);
}
function openComposerContext(anchor){
  closeIntentPopover();
  const pop=$('intent-popover');
  const target=$('popover-options');
  const title='Apply the next instruction to';
  state.popoverOrigin='click';
  state.popoverAnchor=anchor;
  state.openClarification={question:title};
  $('popover-question').textContent=title;
  $('popover-custom-form').hidden=true;
  $('custom-answer-button').hidden=true;
  pop.hidden=false;
  target.replaceChildren();
  delete target.dataset.family;
  const selection=lastPageSelection?.version===state.pageVersion?lastPageSelection:null;
  renderFollowUpScope(target,followUpScopes(state.component,selection?.id,selection),followUpScope,scope=>{
    followUpScope=scope.id==='whole'?null:{...scope,version:state.pageVersion};
    closeIntentPopover();
    syncComposerContext();
    anchor.focus();
  });
  positionIntentPopover();
  target.querySelector('button')?.focus();
}
$('composer-scope').onclick=event=>openComposerContext(event.currentTarget);
document.addEventListener('selectionchange',()=>{
  const field=document.activeElement;
  if(field?.tagName!=='TEXTAREA'||!field.closest('#active-component')||field.selectionStart===field.selectionEnd)return;
  const label=field.getAttribute('aria-label')||'';
  const index=label==='Editable explanation'?0:Number(label.match(/^Page paragraph (\d+)$/)?.[1])-1;
  if(Number.isInteger(index))lastPageSelection={id:'passage:'+index,start:field.selectionStart,end:field.selectionEnd,length:field.selectionEnd-field.selectionStart,version:state.pageVersion};
});
const timeline=new PageTimeline();
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);$('status').hidden=!error;}
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
  const answer=source==='Demo'?quickAnswer($('intent-input').value):compactLiveAnswer(data);
  $('quick-preview').hidden=!answer;
  const compact=answer.length>240?answer.slice(0,237).replace(/\s+\S*$/,'')+'…':answer;$('quick-answer').textContent=compact;
  $('quick-provenance').textContent=source==='Demo'?'Example':'';
  $('quick-provenance').hidden=source!=='Demo';
  if(source!=='Demo'){state.information=mergeInformation($('intent-input').value,state.information,data.information||[]);state.uncertainty=liveClarificationFor($('intent-input').value,data,state.information);
    const needsClarification=state.uncertainty && state.uncertainty.questionKind!=='explore' && state.uncertainty.type!=='output_format' &&
      !state.answers.some(answer=>answer.question===state.uncertainty.question);
    if(data.slideOptions?.length && !needsClarification){
      state.uncertainty={question:'How would you like to explore this?',slideOptions:data.slideOptions};
    }
    renderUncertainty();}
  else updateClarification(state.uncertainty);
  composerExperience?.onPreview(data);
}
function updateClarification(clarification){
  state.clarification=clarification;
  const trigger=$('clarify-phrase');if(composerExperience)return;trigger.hidden=!clarification;
  $('refine-label').textContent=clarification?.phrase?`Refine “${clarification.phrase}”`:'One detail';
  trigger.setAttribute('aria-label',clarification?clarification.question:'Refine your intent');
}
function renderUncertainty(){
  const input=$('intent-input'),mirror=$('input-mirror'),text=input.value;
  const entries=state.information;
  const u=state.live?state.uncertainty:(state.uncertainty=clarificationFor(text));
  mirror.replaceChildren();let cursor=0;
  const ranges=entries.length?entries:(u?.phrase&&Number.isInteger(u.start)?[{...u,key:'legacy'}]:[]);
  for(const entry of ranges){
    if(entry.start<cursor)continue;
    mirror.append(document.createTextNode(text.slice(cursor,entry.start)));
    const mark=node('mark');mark.textContent=text.slice(entry.start,entry.end)+(entry.annotation||'');mark.dataset.key=entry.key;mark.classList.toggle('confirmed',!!entry.confirmed);mirror.append(mark);cursor=entry.end+(entry.annotation?.length||0);
  }
  mirror.append(document.createTextNode(text.slice(cursor)+'\u200b'));
  const first=entries.find(e=>!e.confirmed)||entries[0];
  updateClarification(first||u);mirror.style.transform=`translateY(${-input.scrollTop}px)`;
  const rail=$('intent-refinements');rail.replaceChildren();rail.hidden=!entries.length&&!state.answers.length;
  entries.forEach(entry=>{const b=node('button','phrase-access',entry.phrase+(entry.value?` (${entry.value})`:''));b.type='button';b.setAttribute('aria-label',`${INFORMATION_TYPES[entry.type].label}: ${entry.phrase}${entry.value?', '+entry.value:''}`);b.onclick=()=>{state.activeInformation=entry;updateClarification(entry);openIntentPopover('click');};rail.append(b);});
  state.answers.forEach(entry=>{const b=node('button','phrase-access',entry.value);b.type='button';b.setAttribute('aria-label',entry.question+': '+entry.value);b.onclick=()=>{updateClarification({...entry,type:undefined});openIntentPopover('click');};rail.append(b);});
  composerExperience?.onMirrorRendered();
}
function applyClarification(value){
  const input=$('intent-input'),u=state.openClarification||state.clarification;
  if(u&&(!u.phrase||u.global)){value=value.trim();if(!value)return;state.answers=state.answers.filter(e=>e.question!==u.question);state.answers.push({type:'goal',phrase:u.question,question:u.question,options:u.options||[],value,confirmed:true,global:true});}
  else if(u?.type){const result=chooseInformation(input.value,state.information,u.key,value);if(!result){status('This phrase changed. Choose a current phrase and try again.',true);return;}input.value=result.text;state.information=result.entries;state.previousDraft=result.text;}
  else{value=value.trim();if(!value)return;const phrase=u?.phrase;if(!phrase)return;const entry={...u,type:'goal',key:'legacy',annotation:'',value:'',confirmed:false};const entries=[...state.information.filter(e=>e.end+(e.annotation?.length||0)<=entry.start||e.start>=entry.end),entry].sort((a,b)=>a.start-b.start);const result=chooseInformation(input.value,entries,'legacy',value);if(!result)return;input.value=result.text;state.information=result.entries;state.previousDraft=result.text;}
  if(u)state.customDrafts.delete(u.question);
  closeIntentPopover();changed();input.focus();
}
function closeIntentPopover({restore=false,suppress=false}={}){
  clearTimeout(state.popoverTimer);
  const origin=state.popoverOrigin;
  const priorAnchor=state.popoverAnchor;
  if(suppress)state.suppressed=state.openClarification?.question;
  $('intent-popover').hidden=true;if(!composerExperience)$('clarify-phrase').setAttribute('aria-expanded','false');
  state.openClarification=null;state.popoverOrigin=null;state.popoverAnchor=null;
  if(restore&&origin!=='hover')(priorAnchor?.matches('button')?priorAnchor:$('intent-input')).focus();
}
function positionIntentPopover(anchor=state.popoverAnchor||$('clarify-phrase')){
  const pop=$('intent-popover');
  const rect=anchor.getBoundingClientRect();
  const result=positionPopover(rect,304,pop.offsetHeight,innerWidth,innerHeight);
  pop.style.width=result.width+'px';pop.style.left=result.left+'px';pop.style.top=result.top+'px';pop.style.setProperty('--arrow-x',result.arrow+'px');pop.dataset.side=result.side;
}
function openIntentPopover(origin='click',sourceAnchor=null){
  const u=state.clarification;if(!u)return;clearTimeout(state.popoverTimer);
  if(origin==='hover'&&state.suppressed===u.question)return;
  const pop=$('intent-popover');if(!pop.hidden&&(state.openClarification?.key||state.openClarification?.question)===(u.key||u.question))return;
  if(origin!=='hover')state.suppressed=null;
  state.openClarification={...u};state.popoverOrigin=origin;state.popoverAnchor=sourceAnchor||[...$('input-mirror').querySelectorAll('mark')].find(m=>m.dataset.key===u.key)||$('clarify-phrase');
  $('popover-question').textContent=u.question;
  if(u.slideOptions){
    const target=$('popover-options');
    target.replaceChildren();
    const addChoice=(id,label,detail)=>{
      const button=node('button','slide-option');
      button.type='button';
      button.setAttribute('aria-pressed',String(state.slideChoice===id));
      button.append(node('span','slide-option-title',label));
      if(detail)button.append(node('span','slide-option-detail',detail));
      button.onclick=()=>{
        state.slideChoice=id;
        closeIntentPopover({suppress:true});
        composerExperience?.onMirrorRendered();
        $('live-question').querySelector('button').focus();
      };
      target.append(button);
    };
    for(const id of u.slideOptions){
      const {label,detail}=slideRecipe(id);
      addChoice(id,label,detail);
    }
    addChoice(undefined,'Let AI choose');
    $('popover-custom-form').hidden=true;
    $('custom-answer-button').hidden=true;
    pop.hidden=false;
    positionIntentPopover();
    if(origin!=='hover')target.querySelector('button[aria-pressed="true"]')?.focus();
    composerExperience?.onMirrorRendered();
    return;
  }
  if(u.type)renderInformationControl($('popover-options'),u,applyClarification,()=>{if(!$('intent-popover').hidden)positionIntentPopover();});else choices($('popover-options'),u.options,'',applyClarification);
  $('popover-custom').value=state.customDrafts.get(u.question)||'';
  const hasDraft=!!$('popover-custom').value||(!u.type&&!u.options?.length);
  $('popover-custom-form').hidden=!hasDraft;$('custom-answer-button').hidden=hasDraft;$('custom-answer-button').setAttribute('aria-expanded',String(hasDraft));
  pop.hidden=false;
  positionIntentPopover();
  if(!composerExperience)$('clarify-phrase').setAttribute('aria-expanded','true');
  if(origin!=='hover')(pop.querySelector('#popover-options input, #popover-options select')||pop.querySelector('#popover-options button')||(hasDraft?$('popover-custom'):$('custom-answer-button'))).focus();
}
function schedulePopoverClose(){clearTimeout(state.popoverTimer);state.popoverTimer=setTimeout(()=>{if(!$('intent-popover').contains(document.activeElement))closeIntentPopover();},260);}
$('clarify-phrase').onclick=()=>openIntentPopover('click');
function phraseAt(event){return [...$('input-mirror').querySelectorAll('mark')].find(mark=>[...mark.getClientRects()].some(r=>event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom));}
function openMarkedPhrase(mark,origin){const entry=state.information.find(e=>e.key===mark.dataset.key)||state.uncertainty;if(!entry)return;if(state.openClarification?.key!==entry.key)closeIntentPopover();updateClarification(entry);openIntentPopover(origin);}
$('intent-input').addEventListener('pointermove',event=>{if(event.pointerType==='touch'||event.buttons)return;const mark=phraseAt(event);if(mark)openMarkedPhrase(mark,'hover');else if(!$('intent-popover').hidden)schedulePopoverClose();else state.suppressed=null;});
$('intent-input').addEventListener('pointerup',event=>{if(event.button!==0||$('intent-input').selectionStart!==$('intent-input').selectionEnd)return;const mark=phraseAt(event);if(mark)openMarkedPhrase(mark,'click');});
$('intent-input').addEventListener('pointerleave',()=>{state.suppressed=null;schedulePopoverClose();});
$('clarify-phrase').onpointerenter=()=>clearTimeout(state.popoverTimer);
$('clarify-phrase').onpointerleave=schedulePopoverClose;
$('intent-input').addEventListener('scroll',()=>{renderUncertainty();closeIntentPopover();});
$('intent-popover').onpointerenter=()=>clearTimeout(state.popoverTimer);
$('intent-popover').onpointerleave=schedulePopoverClose;
$('close-popover').onclick=()=>closeIntentPopover({restore:true,suppress:true});
$('custom-answer-button').onclick=()=>{ $('custom-answer-button').hidden=true;$('custom-answer-button').setAttribute('aria-expanded','true');$('popover-custom-form').hidden=false;positionIntentPopover();$('popover-custom').focus();};
$('popover-custom').oninput=()=>{const key=state.openClarification?.question;if(key){state.customDrafts.set(key,$('popover-custom').value);if(state.customDrafts.size>10)state.customDrafts.delete(state.customDrafts.keys().next().value);}};
$('popover-custom-form').onsubmit=e=>{e.preventDefault();applyClarification($('popover-custom').value);};
$('intent-popover').addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const buttons=[...$('intent-popover').querySelectorAll('button')].filter(b=>!b.hidden&&!b.closest('[hidden]'));const index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
$('intent-input').addEventListener('keydown',e=>{if(e.altKey&&e.key==='ArrowDown'&&state.clarification){e.preventDefault();openIntentPopover('keyboard');}if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();$('build-page').click();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('intent-popover').hidden){e.preventDefault();closeIntentPopover({restore:true,suppress:true});}});
document.addEventListener('pointerdown',e=>{if(!$('intent-popover').hidden&&!$('intent-popover').contains(e.target)&&!$('clarify-phrase').contains(e.target)&&!$('intent-refinements').contains(e.target))closeIntentPopover({suppress:true});});
window.addEventListener('resize',()=>{if(!$('intent-popover').hidden)positionIntentPopover();});window.addEventListener('scroll',()=>{if($('intent-popover').contains(document.activeElement))positionIntentPopover();else closeIntentPopover();},{passive:true});
$('typing-connection').onclick=()=>{closeIntentPopover();$('connection-dialog').showModal();};
$('build-page').onclick=()=>submitPage();

function pageContext(){
  if(!state.component)return '';
  return JSON.stringify({originalRequest:state.taskGoal,title:$('document-title').value,componentIds:(state.component.components||[]).map(c=>c.id),edits:state.component.edits,page:state.component,notes:$('document-input').value}).slice(0,6000);
}
function openPage(){
  state.expanded=true;document.body.classList.add('page-open');
  $('intent-input').placeholder='Ask a question or change this page…';
}
async function submitPage(text=$('intent-input').value.trim(),slideChoice=text===$('intent-input').value.trim()?state.slideChoice:undefined,retryContext){
  const scope=retryContext?retryContext.scope:followUpScope;
  if(scope&&scope.version!==state.pageVersion){status('The page changed. Choose a new focus before sending.',true);return;}
  const base=scope?structuredClone(state.component):null;
  if(!text)return;
  if(!state.live){state.pendingSend=true;$('connection-error').textContent='Connect OpenAI to create a page for your request.';$('connection-dialog').showModal();return;}
  closeIntentPopover();stop();state.pageController?.abort();
  const context=pageContext(),version=state.pageVersion,id=++state.pageRequest;
  const preferences=new Map(state.confirmedChoices.map(e=>[e.type+':'+e.phrase,e]));
  confirmedChoices([...state.information,...state.answers]).forEach(e=>preferences.set(e.type+':'+e.phrase,e));state.confirmedChoices=[...preferences.values()].slice(-8);
  const controller=state.pageController=new AbortController();
  if(!state.taskGoal)state.taskGoal=text;
  openPage();$('intent-input').value='';changed();workspace?.reading();
  $('page-progress').hidden=false;$('page-progress').textContent='Creating your page…';
  $('submitted-request').textContent=text;
  $('document-title').value=state.component?$('document-title').value:'Making room for your idea…';
  try{
    const data=await callPreview({text,context,audience:state.audience,format:state.format,phase:'page',slideChoice:scope?undefined:slideChoice,pageScope:scope?{id:scope.id,text:scope.text.slice(0,4500)}:undefined},controller.signal);
    if(id!==state.pageRequest)return;
    if(scope&&version!==state.pageVersion)throw new Error('The selected part changed while the response was being prepared.');
    const draft=scope?applyFollowUpScope(base,data.preview,scope):data.preview;
    if(scope)draft.title=$('document-title').value;
    const p={...structuredClone(draft),revision:state.revision,baseVersion:version,source:data.model,physics:scope?draft.physics:{speed:20,angle:45,gravity:9.81},edits:scope?draft.edits:{},selected:scope?draft.selected:0};
    if(!state.component||version===state.pageVersion){if(state.component){timeline.save(capturePage());snapshot('Before new page');}state.component=p;$('document-title').value=p.title;if(!scope)state.blocks=[];state.proposal=null;state.pageVersion++;renderActive();renderBlocks();renderProposal();timeline.append(capturePage());renderPageNavigation();workspace?.reading();}
    else{p.baseVersion=state.pageVersion;state.proposal=p;renderProposal();}
    $('document-state').textContent='This tab only · export to save';
    status(state.proposal?'Updated page ready to review. Your existing page is preserved.':'Your page is ready. Edit it directly or ask for a change below.');
  }catch(error){if(id===state.pageRequest&&error.name!=='AbortError'){status(error.message,true);$('page-progress').textContent=error.message;const retry=node('button','','Retry this request');retry.onclick=()=>submitPage(text,slideChoice,{scope});$('page-progress').append(retry);return;}}
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
function renderActive(){
 followUpScope=null;lastPageSelection=null;syncComposerContext();
 document.dispatchEvent(new Event('page:render'));composerExperience?.onPageRendered();const target=$('active-component'),title=$('document-title');target.before(title);target.atlasDispose?.();target.replaceChildren();
 if(state.component){renderAtlas(target,state.component,{titleField:title,onEdit:()=>{state.pageVersion++;document.dispatchEvent(new Event('page:edit'));}});if(state.component.kind==='projectile'){const temp=node('div');renderComponent(temp,state.component);const sim=temp.querySelector('.physics-simulation');if(sim)target.querySelector('.atlas-visual').append(sim);}}
 renderPageNavigation();
}
function capturePage(){return {title:$('document-title').value,text:$('document-input').value,component:state.component,blocks:state.blocks,taskGoal:state.taskGoal,preferences:state.confirmedChoices,paperScroll:document.querySelector('.paper').scrollTop,scroll:window.scrollY};}
function renderPageNavigation(){const b=$('page-back'),f=$('page-forward');if(!b)return;b.disabled=!timeline.canBack;f.disabled=!timeline.canForward;$('page-position').textContent=timeline.index<0?'':`${timeline.index+1} / ${timeline.pages.length}`;}
function navigatePage(delta){
 const page=timeline.move(delta,capturePage());if(!page)return;
 state.pageController?.abort();state.pageRequest++;stop();state.proposal=null;state.pageVersion++;
 $('document-title').value=page.title;$('document-input').value=page.text;state.component=page.component;state.blocks=page.blocks;state.taskGoal=page.taskGoal;state.confirmedChoices=page.preferences||[];
 $('page-progress').hidden=true;renderActive();renderBlocks();renderProposal();changed();workspace?.reading();requestAnimationFrame(()=>{document.querySelector('.paper').scrollTop=page.paperScroll||0;window.scrollTo({top:page.scroll||0,behavior:'instant'});});
}

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
async function callPreview(payload,signal,onProgress){
  const revision=state.revision;
  return withSingleRetry(()=>callPreviewAttempt(payload,signal,onProgress),{signal,enabled:['preview','page','page-help'].includes(payload.phase),isCurrent:()=>state.revision===revision,onRetry:()=>{onProgress?.({reset:true});status('Connection interrupted. Retrying once…');}});
}
async function callPreviewAttempt(payload,signal,onProgress){
  if(state.requests>=30)throw new Error('This connection has reached its 30-preview limit. Reconnect to enable another session, or use demo mode.');
  state.requests++;
  let response;try{response=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json',...(state.key?{'Authorization':`Bearer ${state.key}`}:{})},body:JSON.stringify({...payload,stream:typeof onProgress==='function'&&payload.phase==='preview',interaction:composerExperience?.interaction()||'unified',context:requestContext({explicitIntent:state.intentOverride,draft:payload.text,page:payload.context??pageContext(),confirmed:[...state.confirmedChoices,...confirmedChoices([...state.information,...state.answers])],date:new Date().toLocaleDateString('en-CA'),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})}),signal});}catch(error){if(signal?.aborted)throw error;throw requestError('Connection interrupted. Try again.',true);}
  if(!response.ok){let failure={};try{failure=await response.json();}catch{}throw requestError(failure.error||'Preview unavailable. Try again.',typeof failure.retryable==='boolean'?failure.retryable:response.status>=500);}
  let data;try{if(response.headers.get('Content-Type')?.includes('text/event-stream')){
    for await(const event of readSSE(response.body,{signal})){if(event.type==='partial')onProgress?.(event.preview);else if(event.type==='error')throw requestError(event.error||'The preview was interrupted.',event.retryable===true);else if(event.type==='done'){data=event;break;}}
    if(!data)throw requestError('The preview was interrupted. Try again.',true);
  }else data=await response.json();}catch(error){if(error instanceof TypeError&&!signal?.aborted)throw requestError('Connection interrupted. Try again.',true);throw error;}
  if(!validPreview(data.preview))throw new Error('The preview was invalid. Your page is unchanged.');return data;
}
async function preview(phase='preview'){
  const revision=state.revision;const text=$('intent-input').value.trim();if(!text){$('interpretation').textContent='Start anywhere. An unfinished thought is welcome.';state.proposal=null;renderProposal();return;}
  if(!state.live){setProposal(demoPreview(text,state.audience,state.format),revision,'Demo',null,phase);status('Demo uses built-in examples, not semantic AI. No draft text is sent.');return;}
  const controller=new AbortController();state.controller=controller;$('cancel-button').hidden=false;$('input-state').textContent='Preview updating · keep typing';status(phase==='page'?'Terra is building your interactive page…':'Sending the current draft and choices to Luna…');
  try{const data=await callPreview({text,audience:state.audience,format:state.format,phase},controller.signal,partial=>{
    if(!isCurrentPreview(revision,state.revision,controller.signal))return;
    if(partial.reset){$('quick-preview').hidden=true;$('quick-answer').textContent='';}
    if(typeof partial.answer==='string'){$('quick-answer').textContent=partial.answer;$('quick-preview').hidden=!partial.answer;}
    composerExperience?.onStream(partial);
  });if(!isCurrentPreview(revision,state.revision,controller.signal))return;setProposal(data.preview,revision,data.model||'gpt-6-luna',null,phase);status('');}catch(error){if(error.name!=='AbortError'&&revision===state.revision){$('quick-preview').hidden=true;composerExperience?.onStream({reset:true});status(error.message,true);}}finally{if(state.controller===controller){state.controller=null;$('cancel-button').hidden=true;$('input-state').textContent='You can keep typing';}}
}
function sizeComposer(){const input=$('intent-input');input.style.height='0px';input.style.height=Math.min(220,Math.max(56,input.scrollHeight))+'px';}
window.addEventListener('resize',sizeComposer);
function changed(){
  state.slideChoice=undefined;
  document.dispatchEvent(new Event('intent:changed'));
  composerExperience?.onDraftChanged();
  state.information=rebaseInformation(state.previousDraft,$('intent-input').value,state.information).filter(e=>e.confirmed);state.previousDraft=$('intent-input').value;
  state.revision++;state.quick=null;state.uncertainty=null;$('quick-preview').hidden=true;state.suppressed=null;stop();closeIntentPopover();if(state.proposal&&state.proposal.baseVersion===undefined){$('accept-button').disabled=true;$('proposal-label').textContent='Earlier page · explore again to use the latest intent';}
  const hasText=!!$('intent-input').value.trim();if(!hasText)state.answers=[];document.body.classList.toggle('has-intent',hasText);$('typing-assistance').hidden=!hasText;
  $('build-page').disabled=!hasText;
  sizeComposer();
  refreshIntent();renderUncertainty();
  if(!hasText){$('quick-preview').hidden=true;updateClarification(null);return;}
  if(!state.live)preview('preview');else{status('Draft changed. Luna preview follows after a pause.');state.timer=setTimeout(()=>preview('preview'),1100);}
}

function snapshot(label){state.history.unshift({label,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),title:$('document-title').value,text:$('document-input').value,component:structuredClone(state.component),blocks:structuredClone(state.blocks)});state.history=state.history.slice(0,8);$('history-count').textContent=state.history.length;}
function renderHistory(){const target=$('history-list');target.replaceChildren();if(!state.history.length)target.append(node('p','status-line','Accepted changes will appear here.'));state.history.forEach((v,i)=>{const row=node('div','history-row');row.append(node('span','',`${v.label} · ${v.time}`));const b=node('button','','Restore');b.onclick=()=>{const chosen=structuredClone(v);timeline.save(capturePage());snapshot('Before restore');$('document-title').value=chosen.title;$('document-input').value=chosen.text;state.component=chosen.component;state.blocks=chosen.blocks;state.pageVersion++;state.proposal=null;renderProposal();renderActive();renderBlocks();renderHistory();timeline.append(capturePage());renderPageNavigation();status('Previous page restored. The page you left is in History.');};row.append(b);target.append(row);});}
function renderBlocks(){const target=$('accepted-blocks');target.replaceChildren();state.blocks.forEach((block,i)=>{const section=node('section','visual-block');const heading=node('div','block-title');heading.append(node('h3','',block.title));const b=node('button','quiet-button','Remove');b.onclick=()=>{snapshot('Before removing a block');state.blocks.splice(i,1);renderBlocks();};heading.append(b);section.append(heading);renderComponent(section,block);target.append(section);});}
$('intent-input').oninput=()=>{if(!state.composing)changed();};$('intent-input').addEventListener('compositionstart',()=>{state.composing=true;stop();});$('intent-input').addEventListener('compositionend',()=>{state.composing=false;changed();});
$('audience-input').oninput=e=>{state.audience=e.target.value;changed();};document.querySelectorAll('[data-audience]').forEach(b=>b.onclick=()=>{state.audience=b.dataset.audience;$('audience-input').value=state.audience;changed();});
document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{$('intent-input').value=EXAMPLES[b.dataset.example];state.audience='';$('audience-input').value='';state.format='Auto';changed();});
$('refresh-button').onclick=()=>{stop();preview();};$('cancel-button').onclick=()=>{stop();status('Preview paused. Keep editing, or refresh when you are ready.');$('input-state').textContent='Preview paused';};
$('accept-button').onclick=()=>{const p=state.proposal;if(!p||(p.baseVersion!==undefined?p.baseVersion!==state.pageVersion:p.revision!==state.revision))return;if(p.selection&&$('document-input').value.slice(p.selection.start,p.selection.end)!==p.selection.text){status('The selected text changed. Select it again for a fresh suggestion.',true);return;}timeline.save(capturePage());snapshot(state.component?'Before replacing the page':'Before keeping the page');if(p.selection)state.blocks.push(structuredClone(p));else{state.component=structuredClone(p);$('document-title').value=p.title;}state.proposal=null;state.pageVersion++;renderActive();renderBlocks();renderProposal();timeline.append(capturePage());renderPageNavigation();$('document-state').textContent='Kept in this tab · export to save';status('Page kept. Edit it directly, or restore the previous version in History.');};
$('dismiss-button').onclick=()=>{state.proposal=null;renderProposal();};$('new-suggestion').onclick=()=>$('intent-input').focus();
$('document-input').addEventListener('select',()=>{const f=$('document-input');const text=f.value.slice(f.selectionStart,f.selectionEnd).trim();state.selection=text?{start:f.selectionStart,end:f.selectionEnd,text:f.value.slice(f.selectionStart,f.selectionEnd)}:null;$('selection-tools').hidden=!text;$('selection-label').textContent=text?`Selected: ${text.slice(0,35)}${text.length>35?'…':''}`:'Selected text';});
async function fromSelection(kind){if(!state.selection)return;stop();const selection={...state.selection};if(!state.live){const v=demoPreview(selection.text,state.audience,kind==='diagram'?'Diagram':'Outline');v.title=kind==='diagram'?'Explore the selected idea':'A closer look';setProposal(v,state.revision,'Demo',selection);status('Sample selection response. Connect Luna for an explanation of arbitrary text.');}else{const revision=state.revision;try{const data=await callPreview({text:`${kind==='diagram'?'Make a diagram about':'Explain'} this selected text: ${selection.text}`,audience:state.audience,format:kind==='diagram'?'Diagram':'Outline'},new AbortController().signal);setProposal(data.preview,revision,'Luna',selection);}catch(e){status(e.message,true);}}}
$('diagram-selection').onclick=()=>fromSelection('diagram');$('explain-selection').onclick=()=>fromSelection('outline');
$('history-button').onclick=()=>{$('history-panel').hidden=!$('history-panel').hidden;renderHistory();};$('close-history').onclick=()=>$('history-panel').hidden=true;
$('download-button').onclick=()=>{const data={version:1,title:$('document-title').value,notes:$('document-input').value,component:state.component,blocks:state.blocks};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='ai-interaction-page.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Exported page data as JSON. API keys are never included.');};
for(const [button,dialog] of [['connection-button','connection-dialog'],['about-button','about-dialog']])$(button).onclick=()=>{closeIntentPopover();$(dialog).showModal();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(b.dataset.close==='connection-dialog')$('api-key').value='';$(b.dataset.close).close();});$('connection-dialog').addEventListener('close',()=>{$('api-key').value='';state.connectionRevision++;});
$('connection-form').onsubmit=async event=>{event.preventDefault();const key=$('api-key').value.trim();if(!key&&!state.serverKey){$('connection-error').textContent='Enter an OpenAI API key, or stay in demo mode.';return;}const connectionRevision=++state.connectionRevision;$('connect-button').disabled=true;$('connection-error').textContent='Checking Luna access…';try{const response=await fetch('/api/check',{method:'POST',headers:key?{Authorization:`Bearer ${key}`}:{}});const result=await response.json();if(connectionRevision!==state.connectionRevision)return;if(!response.ok)throw new Error(result.error||'Connection failed.');stop();state.key=key;state.requests=0;state.live=true;document.body.classList.add('live');$('mode-label').textContent='OpenAI connected';$('typing-connection').firstChild.textContent='Connected';$('api-key').value='';$('connection-error').textContent='';$('connection-dialog').close();changed();if(state.pendingSend){state.pendingSend=false;submitPage();}}catch(error){$('connection-error').textContent=error.message;}finally{$('connect-button').disabled=false;}};
$('disconnect-button').onclick=()=>{state.connectionRevision++;stop();composerExperience?.stop();state.pageController?.abort();state.pageRequest++;state.pendingSend=false;state.key='';state.live=false;document.body.classList.remove('live');$('mode-label').textContent='Demo mode';$('typing-connection').firstChild.textContent='Demo';$('api-key').value='';$('connection-dialog').close();changed();};
$('active-component').addEventListener('input',event=>{if(event.target.closest('.page-assistant'))return;state.pageVersion++;if(state.proposal?.baseVersion!==undefined)renderProposal();});
$('document-title').addEventListener('input',event=>{state.pageVersion++;event.target.style.height='0';event.target.style.height=event.target.scrollHeight+'px';});
$('document-input').addEventListener('input',()=>state.pageVersion++);
document.addEventListener('prototype:render-blocks',()=>{renderBlocks();renderProposal();});
composerExperience=setupComposerExperience({state,changed,request:callPreview,snapshot,renderActive,setIntent(value){state.intentOverride=value.slice(0,500);changed();if(state.live&&$('intent-input').value.trim()){stop();preview('preview');}},closeDetail:closeIntentPopover,openDetail(entry,origin='click',anchor=null){if(!entry)return;closeIntentPopover();updateClarification(entry);openIntentPopover(origin,anchor);}});
setupPageAssistant({state,request:callPreview,commit(apply){timeline.save(capturePage());snapshot('Before inline change');apply();state.pageVersion++;renderActive();timeline.append(capturePage());renderPageNavigation();}});
workspace=setupWorkspace();$('page-back').onclick=()=>navigatePage(-1);$('page-forward').onclick=()=>navigatePage(1);
window.addEventListener('pagehide',()=>{stop();state.pageController?.abort();state.key='';});refreshIntent();changed();
fetch('/api/config').then(r=>r.json()).then(config=>{if(!config.serverKey)return;state.serverKey=true;state.live=true;document.body.classList.add('live');$('mode-label').textContent='OpenAI configured';$('typing-connection').firstChild.textContent='OpenAI';$('disconnect-button').textContent='Pause live previews';changed();}).catch(()=>{});
