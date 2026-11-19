import {renderFollowUpScope,followUpScopes,applyFollowUpScope} from './composer-extensions.js';
import {slideRecipe} from './component-catalog.js';
import {setupPageAssistant} from './page-assistant.js';
import {renderAtlas,refreshDeeper} from './atlas.js';
import {PageTimeline,DirectEditUndo,historyLimit} from './page-timeline.js';
import {setupWorkspace} from './workspace.js';
import {withSingleRetry,requestError} from './retry.js';
import {readSSE} from './stream.js';
import {confirmedChoices,requestContext} from './request-context.js';
import {setupComposerExperience} from './composer.js';
import {INFORMATION_TYPES, informationFor, rebaseInformation, chooseInformation, mergeInformation} from './intent.js';
import {renderInformationControl,formatPreview} from './controls.js';
import {positionPopover} from './popover.js';
import {demoPreview, trajectory, validPreview, clarificationFor, quickAnswer, compactLiveAnswer, liveClarificationFor, isIncompleteComparison, draftWordCount, completedDraft, PREVIEW_WORD_STEP, extendsPreview, workingDraftPreview, draftAnswersQuestion} from './model.js';
const $ = id => document.getElementById(id);
const state = {key:'', live:false, requests:0, connectionRevision:0, composing:false, revision:0, format:'Auto', audience:'', controller:null, timer:null, proposal:null, component:null, history:[], blocks:[], selection:null, uncertainty:null, popoverTimer:null, clarification:null, openClarification:null, popoverOrigin:null, suppressed:null, customDrafts:new Map(), serverKey:false, pendingSend:false, pageController:null, pageRequest:0, taskGoal:'', pageVersion:0, information:[], previousDraft:'', activeInformation:null,confirmedChoices:[],answers:[],intentOverride:'',slideChoice:undefined};
const node=(tag, cls, text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
let composerExperience,workspace;
let followUpScope=null;
let lastPageSelection=null;
function syncComposerContext(){
  const button=$('composer-scope');
  button.hidden=!state.component;
  const label=followUpScope?'Focus: '+followUpScope.label:'Focus';
  $('focus-label').textContent=label;
  button.setAttribute('aria-label',followUpScope?label:'Focus the next instruction');
  button.title=followUpScope?'Only '+followUpScope.label+' will change on Send':'Choose what should change';
  button.classList.toggle('has-focus',!!followUpScope);
}
function openComposerContext(anchor){
  closeIntentPopover();
  const pop=$('intent-popover');
  const target=$('popover-options');
  const title='What should change?';
  state.popoverOrigin='click';
  state.popoverAnchor=anchor;
  state.openClarification={question:title};
  $('popover-question').textContent=title;
  $('popover-custom-form').hidden=true;
  $('custom-answer-button').hidden=true;
  pop.hidden=false;
  anchor.setAttribute('aria-expanded','true');
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
  const index=Number(field.dataset.passageIndex);
  if(Number.isInteger(index))lastPageSelection={id:'passage:'+index,start:field.selectionStart,end:field.selectionEnd,length:field.selectionEnd-field.selectionStart,version:state.pageVersion};
});
const timeline=new PageTimeline();
let directEdits=new DirectEditUndo();
const paper=document.querySelector('.paper');
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);$('status').hidden=!error;}
let activePreview,shownPreview,lastPreviewStart,previewQueued=false;
function stop(){
 clearTimeout(state.timer);state.controller?.abort();state.controller=null;
 activePreview=null;previewQueued=false;$('cancel-button').hidden=true;
}
function choices(target,values,selected,action){target.replaceChildren();values.forEach(value=>{const b=node('button','',value);b.type='button';b.setAttribute('aria-pressed',String(value===selected));b.onclick=()=>action(value);target.append(b);});}
const previewCache=new Map();
let completedAnswer='';
function showQuickAnswer(answer,updating=false,fresh=false){
  const text=$('quick-answer');
  $('quick-preview').hidden=!answer;
  $('quick-preview').toggleAttribute('data-updating',updating);
  if(text.textContent===answer)return;
  text.textContent=answer;
  if(fresh&&answer&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    text.animate([{backgroundColor:'#e8efe2'},{backgroundColor:'transparent'}],{duration:480,easing:'ease-out'});
  }
}
function renderQuick(data,source,{tail='',interim=false,fresh=false}={}){
  const answer=source==='Demo'?quickAnswer($('intent-input').value):compactLiveAnswer(data);
  if(answer||!interim){
    completedAnswer=answer;
    showQuickAnswer(answer,interim&&!fresh,fresh);
  }else showQuickAnswer(completedAnswer||$('quick-answer').textContent,true);
  $('quick-provenance').textContent=source==='Demo'?'Example':'';
  $('quick-provenance').hidden=source!=='Demo';
  if(source!=='Demo'){state.information=mergeInformation($('intent-input').value,state.information,data.information||[]);state.uncertainty=liveClarificationFor($('intent-input').value,data,state.information);
    const audienceTypes=['audience','prior_knowledge','audience_knowledge'];
    const knownAudience=state.confirmedChoices.some(choice=>audienceTypes.includes(choice.type));
    if(knownAudience&&audienceTypes.includes(state.uncertainty?.type))state.uncertainty=null;
    const needsClarification=state.uncertainty && state.uncertainty.questionKind!=='explore' && state.uncertainty.type!=='output_format' &&
      !state.answers.some(answer=>answer.question===state.uncertainty.question);
    const audienceQuestion=audienceTypes.includes(state.uncertainty?.type);
    if(data.slideOptions?.length && !state.slideDecided && (!needsClarification||audienceQuestion)){
      state.uncertainty={question:'How would you like to explore this?',slideOptions:data.slideOptions};
    }
    renderUncertainty();}
  else updateClarification(state.uncertainty);
  composerExperience?.onPreview(data,{fresh,keepQuestion:interim?question=>!draftAnswersQuestion(question,tail):null});
}
function updateClarification(clarification){
  state.clarification=clarification;
  const trigger=$('clarify-phrase');if(composerExperience)return;trigger.hidden=!clarification;
  trigger.setAttribute('aria-label',clarification?clarification.question:'Refine your intent');
}
function renderUncertainty(){
  const input=$('intent-input'),mirror=$('input-mirror'),text=input.value;
  const entries=state.information;
  const u=state.live||isIncompleteComparison(text)?state.uncertainty:(state.uncertainty=clarificationFor(text));
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
  if(u&&(!u.phrase||u.global)){value=value.trim();if(!value)return;state.answers=state.answers.filter(e=>e.question!==u.question);state.answers.push({type:u.type||'goal',phrase:u.question,question:u.question,options:u.options||[],value,confirmed:true,global:true});}
  else if(u?.type){
    // A live refresh can replace suggestions while the user is reading this open picker.
    const end=u.end+(u.annotation?.length||0);
    const otherEntries=state.information.filter(entry=>entry.start>=end||entry.end+(entry.annotation?.length||0)<=u.start);
    const result=chooseInformation(input.value,[...otherEntries,u].sort((a,b)=>a.start-b.start),u.key,value);
    if(!result){
      closeIntentPopover({suppress:true});input.focus();
      return;
    }
    input.value=result.text;state.information=result.entries;state.previousDraft=result.text;
  }
  else{value=value.trim();if(!value)return;const phrase=u?.phrase;if(!phrase)return;const entry={...u,type:'goal',key:'legacy',annotation:'',value:'',confirmed:false};const entries=[...state.information.filter(e=>e.end+(e.annotation?.length||0)<=entry.start||e.start>=entry.end),entry].sort((a,b)=>a.start-b.start);const result=chooseInformation(input.value,entries,'legacy',value);if(!result)return;input.value=result.text;state.information=result.entries;state.previousDraft=result.text;}
  if(u)state.customDrafts.delete(u.question);
  closeIntentPopover();changed({immediate:true});state.suppressed=u?.question;input.focus();
}
function closeIntentPopover({restore=false,suppress=false}={}){
  clearTimeout(state.popoverTimer);
  const origin=state.popoverOrigin;
  const priorAnchor=state.popoverAnchor;
  if(priorAnchor===$('composer-scope'))priorAnchor.setAttribute('aria-expanded','false');
  if(suppress)state.suppressed=state.openClarification?.question;
  $('intent-popover').hidden=true;$('intent-popover').classList.remove('audience-picker');if(!composerExperience)$('clarify-phrase').setAttribute('aria-expanded','false');
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
  let u=state.clarification;if(!u)return;clearTimeout(state.popoverTimer);
  if(origin==='hover'&&state.suppressed===u.question)return;
  const pop=$('intent-popover');if(!pop.hidden&&(state.openClarification?.key||state.openClarification?.question)===(u.key||u.question))return;
  if(origin!=='hover')state.suppressed=null;
  pop.classList.toggle('audience-picker',u.type==='audience');
  if(u.type==='audience'&&u.options?.some(option=>/\b(?:middle school|high school|university|college|undergraduate)\b/iu.test(option))){
    u={...u,options:['Middle school','High school','University']};
  }
  state.openClarification={...u};state.popoverOrigin=origin;state.popoverAnchor=sourceAnchor||[...$('input-mirror').querySelectorAll('mark')].find(m=>m.dataset.key===u.key)||$('clarify-phrase');
  $('popover-question').textContent=u.question;
  if(u.slideOptions){
    const target=$('popover-options');
    target.replaceChildren();
    const kinds={chart:'chart',numbers:'chart',parts:'chart',timeline:'steps',example:'steps',checklist:'steps',map:'map',compare:'grid',matrix:'grid',reveal:'grid',
      practice:'list',flashcards:'list',prediction:'list',sorting:'list',evidence:'text'};
    const addChoice=(id,label,detail)=>{
      const button=node('button','slide-option');
      button.type='button';
      button.setAttribute('aria-pressed',String(state.slideChoice===id));
      if(id)button.append(formatPreview(label,kinds[id]||'visual'));
      const text=node('span','slide-option-text');
      text.append(node('span','slide-option-title',label));
      if(detail)text.append(node('span','slide-option-detail',detail));
      button.append(text);
      button.onclick=()=>{
        state.slideDecided=true;
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
  const hasDraft=!!$('popover-custom').value||(!u.options?.length&&(!u.type||INFORMATION_TYPES[u.type].family==='choices'));
  $('popover-custom').placeholder=hasDraft&&!u.options?.length?'Type your answer…':'In your own words…';
  $('custom-answer-button').textContent='Type your own answer';
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
// Go deeper: prefetch short answers for a page's follow-up questions in one Luna request.
const deeperRequests=new WeakSet();
document.addEventListener('page:deeper',async event=>{
  const page=event.detail;
  if(!state.live||page!==state.component||deeperRequests.has(page)||!page.followUps?.length)return;
  deeperRequests.add(page);
  try{
    const data=await callPreview({text:page.title||$('document-title').value||'This page',audience:state.audience,format:state.format,phase:'deeper',followUps:page.followUps});
    page.deeper=Array.isArray(data.deeper)?data.deeper:'error';
  }catch{page.deeper='error';}
  refreshDeeper(page);
});
document.addEventListener('page:follow-up',event=>{if(typeof event.detail==='string'&&event.detail.trim())submitPage(event.detail.trim(),undefined);});

function pageContext(){
  if(!state.component)return '';
  return {originalRequest:state.taskGoal,title:$('document-title').value,page:state.component,notes:$('document-input').value};
}
function openPage(){
  document.body.classList.add('page-open');
}
const documentPanel=document.querySelector('.document-panel');
const pageProgress=$('page-progress');
function hidePageProgress(){
  documentPanel.removeAttribute('data-generating');
  pageProgress.hidden=true;
}
function showPageProgress(){
  documentPanel.setAttribute('data-generating','');
  const spinner=node('span','page-spinner');
  spinner.setAttribute('aria-hidden','true');
  const elapsed=node('span','page-elapsed');
  elapsed.setAttribute('aria-hidden','true');
  elapsed.hidden=true;
  pageProgress.replaceChildren(spinner,node('span','','Creating…'),elapsed);
  pageProgress.hidden=false;
  const started=performance.now();
  return setInterval(()=>{
    const seconds=Math.floor((performance.now()-started)/1000);
    elapsed.hidden=seconds<3;
    elapsed.textContent=seconds+' s';
  },1000);
}
async function submitPage(text=$('intent-input').value.trim(),slideChoice=text===$('intent-input').value.trim()?state.slideChoice:undefined,retryContext){
  const scope=retryContext?retryContext.scope:followUpScope;
  if(scope&&scope.version!==state.pageVersion){status('The page changed. Choose a new focus before sending.',true);return;}
  const base=scope?structuredClone(state.component):null;
  if(!text)return;
  if(!state.live){state.pendingSend=true;$('connection-error').textContent='Connect OpenAI to create a page for your request.';$('connection-dialog').showModal();return;}
  directEdits.endBurst();closeIntentPopover();stop();state.pageController?.abort();
  const context=structuredClone(pageContext()),version=state.pageVersion,id=++state.pageRequest;
  const preferences=new Map(state.confirmedChoices.map(e=>[e.type+':'+e.phrase,e]));
  confirmedChoices([...state.information,...state.answers]).forEach(e=>preferences.set(e.type+':'+e.phrase,e));state.confirmedChoices=[...preferences.values()].slice(-8);
  const controller=state.pageController=new AbortController();
  if(!state.taskGoal)state.taskGoal=text;
  openPage();$('intent-input').value='';changed();workspace?.reading();
  status('');
  const progressTimer=showPageProgress();
  $('submitted-request').textContent=text;
  try{
    const data=await callPreview({text,context,audience:state.audience,format:state.format,phase:'page',slideChoice:scope?undefined:slideChoice,pageScope:scope?{id:scope.id,text:scope.text}:undefined},controller.signal);
    if(id!==state.pageRequest)return;
    if(scope&&version!==state.pageVersion)throw new Error('The selected part changed while the response was being prepared.');
    const draft=scope?applyFollowUpScope(base,data.preview,scope):data.preview;
    if(scope)draft.title=$('document-title').value;
    const p={...structuredClone(draft),revision:state.revision,baseVersion:version,source:data.model,physics:scope?draft.physics:{speed:20,angle:45,gravity:9.81},edits:scope?draft.edits:{},selected:scope?draft.selected:0};
    if(!state.component||version===state.pageVersion){
      if(state.component){timeline.save(capturePage());snapshot(scope?'Before focused change':'Before new page');}
      state.component=p;$('document-title').value=p.title;
      if(!scope){state.blocks=[];directEdits=new DirectEditUndo();}
      else if(scope.id.startsWith('passage:'))directEdits.forget(scope.id.startsWith('passage:0')?'intro':scope.id.split(':').slice(0,2).join(':'));
      else if(scope.id.startsWith('block:'))directEdits.forget('practice:'+scope.id.slice(6));
      state.proposal=null;state.pageVersion++;
      renderActive();renderBlocks();renderProposal();appendPage();renderPageNavigation();workspace?.reading();
      showUpdatedPart(scope?.id,scope?.label);
    }
    else{p.baseVersion=state.pageVersion;state.proposal=p;renderProposal();}
    status(state.proposal?'Updated page ready to review. Your existing page is preserved.':'Your page is ready. Edit it directly or ask for a change below.');
  }catch(error){
    if(id===state.pageRequest&&error.name!=='AbortError'){
      documentPanel.removeAttribute('data-generating');
      const retry=node('button','','Retry this request');
      retry.onclick=()=>submitPage(text,slideChoice,{scope});
      pageProgress.replaceChildren(node('span','',error.message),retry);
    }
  }finally{
    clearInterval(progressTimer);
    if(id===state.pageRequest){
      state.pageController=null;
      if(documentPanel.hasAttribute('data-generating'))hidePageProgress();
    }
  }
}

function setProposal(data, revision, source, selection){
  if(revision!==state.revision||!validPreview(data))return;
  state.proposal={...structuredClone(data),revision,source,selection,physics:{speed:20,angle:45,gravity:9.81},edits:{},selected:0};
  renderProposal();
}
function renderProposal(){
  const p=state.proposal;$('proposal').hidden=!p;
  if(!p)return;
  $('proposal-label').textContent='Explore this suggested page';$('proposal-title').textContent=p.title;
  $('proposal-provenance').textContent=p.source==='Demo'?'Built-in example · not model-generated':`${p.source==='Luna'||p.source==='gpt-6-luna'?'Luna':'Terra'} content · trusted interactive components`;
  $('accept-button').disabled=p.baseVersion!==undefined?p.baseVersion!==state.pageVersion:p.revision!==state.revision;$('accept-button').firstChild.textContent=state.component?'Replace page (undo available)':'Keep this page';
  $('proposal-content').replaceChildren();renderComponent($('proposal-content'),p);
}
function markPageEdit(){
 state.pageVersion++;
 document.dispatchEvent(new Event('page:edit'));
}
function renderActive(){
 documentPanel.classList.toggle('has-slide',!!state.component);
 if(state.component)$('intent-input').placeholder='Ask a question or change this page…';
 followUpScope=null;lastPageSelection=null;syncComposerContext();
 document.dispatchEvent(new Event('page:render'));composerExperience?.onPageRendered();const target=$('active-component'),title=$('document-title');target.before(title);target.atlasDispose?.();target.replaceChildren();
 if(state.component){renderAtlas(target,state.component,{titleField:title,onEdit:markPageEdit});if(state.component.kind==='projectile'){const temp=node('div');renderComponent(temp,state.component);const sim=temp.querySelector('.physics-simulation');if(sim)target.querySelector('.atlas-visual').append(sim);}}
 for(const field of paper.querySelectorAll('[data-edit-key]'))editValues.set(field,field.value);
 renderPageNavigation();
}
function capturePage(){return {title:$('document-title').value,text:$('document-input').value,component:state.component,blocks:state.blocks,taskGoal:state.taskGoal,preferences:state.confirmedChoices,paperScroll:paper.scrollTop,scroll:window.scrollY,directEdits:directEdits.entries};}
function appendPage(){
 const displaced=timeline.append(capturePage());
 if(displaced.length)recordHistory(displaced.reverse(),'Later version');
 if(!$('history-panel').hidden)renderHistory();
}
function renderPageNavigation(){const b=$('page-back'),f=$('page-forward');if(!b)return;b.disabled=!timeline.canBack;f.disabled=!timeline.canForward;$('page-position').textContent=timeline.index<0?'':`${timeline.index+1} / ${timeline.pages.length}`;updateUndoButton();}
function showUpdatedPart(id,label,restoreFocus=false){
 const version=state.pageVersion;
 requestAnimationFrame(()=>{
  if(version!==state.pageVersion)return;
  if(!id){paper.scrollTop=0;return;}
  const root=$('active-component');
  const [,passageIndex]=id.match(/^passage:(\d+)/)||[];
  const blockId=id.match(/^(?:block|component):(.+)$/)?.[1];
  const element=id==='notes'?$('document-input'):blockId?[...root.querySelectorAll('[data-component-id]')].find(el=>el.dataset.componentId===blockId):
    [...root.querySelectorAll('textarea[data-page-field]')].find(el=>passageIndex!==undefined?el.dataset.passageIndex===passageIndex:el.dataset.pageField===id);
  if(!element)return;
  if(restoreFocus){
   if(blockId)element.tabIndex=-1;
   element.focus({preventScroll:true});
   if(!blockId)element.setSelectionRange(element.value.length,element.value.length);
  }
  const section=element.closest('.page-field')||element;
  const top=section.getBoundingClientRect(),frame=paper.getBoundingClientRect();
  if(passageIndex==='0'||id==='intro'||id==='title')paper.scrollTop=0;
  else if(top.top<frame.top+14||top.bottom>frame.bottom-14){
   const scale=frame.height/paper.offsetHeight||1;
   paper.scrollTop+=(top.top-frame.top)/scale-16;
  }
  section.classList.add('page-updated');
  setTimeout(()=>section.classList.remove('page-updated'),1800);
  $('page-update').textContent=label?label+' updated':'Passage updated';
 });
}
function restorePage(page){
 const copy=structuredClone(page);
 state.selection=null;$('selection-tools').hidden=true;
 $('document-title').value=copy.title;$('document-input').value=copy.text;state.component=copy.component;state.blocks=copy.blocks;
 state.taskGoal=copy.taskGoal||'';state.confirmedChoices=copy.preferences||[];directEdits=new DirectEditUndo(copy.directEdits);
 openPage();hidePageProgress();$('page-update').textContent='';
 renderActive();renderBlocks();renderProposal();workspace?.reading();
 const version=state.pageVersion;
 requestAnimationFrame(()=>{if(version!==state.pageVersion)return;paper.scrollTop=copy.paperScroll||0;window.scrollTo({top:copy.scroll||0,behavior:'instant'});});
}
function navigatePage(delta){
 const page=timeline.move(delta,capturePage());if(!page)return;
 state.pageController?.abort();state.pageRequest++;stop();state.proposal=null;state.pageVersion++;
 restorePage(page);changed();
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
function modelPayload(payload,onProgress){
  return {...payload,stream:typeof onProgress==='function'&&['preview','page-help'].includes(payload.phase),context:requestContext({explicitIntent:state.intentOverride,draft:payload.text,page:payload.context??pageContext(),confirmed:[...state.confirmedChoices,...confirmedChoices([...state.information,...state.answers])],date:new Date().toLocaleDateString('en-CA'),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})};
}
async function callPreview(payload,signal,onProgress,body=JSON.stringify(modelPayload(payload,onProgress))){
  const revision=state.revision;
  return withSingleRetry(()=>callPreviewAttempt(body,signal,onProgress),{signal,enabled:['preview','page','page-help'].includes(payload.phase),isCurrent:()=>state.revision===revision,onRetry:()=>{onProgress?.({reset:true});status('Connection interrupted. Retrying once…');}});
}
async function callPreviewAttempt(body,signal,onProgress){
  if(state.requests>=30)throw new Error('This connection has reached its 30-preview limit. Reconnect to enable another session, or use demo mode.');
  state.requests++;
  let response;try{response=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json',...(state.key?{'Authorization':`Bearer ${state.key}`}:{})},body,signal});}catch(error){if(signal?.aborted)throw error;throw requestError('Connection interrupted. Try again.',true);}
  if(!response.ok){let failure={};try{failure=await response.json();}catch{}throw requestError(failure.error||'Preview unavailable. Try again.',typeof failure.retryable==='boolean'?failure.retryable:response.status>=500);}
  let data;try{if(response.headers.get('Content-Type')?.includes('text/event-stream')){
    for await(const event of readSSE(response.body,{signal})){if(event.type==='partial')onProgress?.(event.preview);else if(event.type==='error')throw requestError(event.error||'The preview was interrupted.',event.retryable===true);else if(event.type==='done'){data=event;break;}}
    if(!data)throw requestError('The preview was interrupted. Try again.',true);
  }else data=await response.json();}catch(error){if(error instanceof TypeError&&!signal?.aborted)throw requestError('Connection interrupted. Try again.',true);throw error;}
  if(!validPreview(data.preview))throw new Error('The preview was invalid. Your page is unchanged.');return data;
}
function livePreviewRequest(text){
  return {text,audience:state.audience,format:state.format,phase:'preview'};
}
function previewKey(text){
  return state.pageVersion+':'+JSON.stringify(modelPayload(livePreviewRequest(text),preview));
}
function renderSnapshot(data,source,text,fresh=true){
  shownPreview={data,source,text,version:state.pageVersion};
  const current=$('intent-input').value.trim();
  const interim=current!==text;
  renderQuick(interim?workingDraftPreview(data,text,current):data,source,{interim,tail:current.slice(text.length),fresh});
}
function applyCachedPreview(key,text){
  const cached=previewCache.get(key);
  if(!cached)return false;
  stop();
  previewCache.delete(key);
  previewCache.set(key,cached);
  renderSnapshot(cached.preview,cached.model||'gpt-6-luna',text);
  $('input-state').textContent='You can keep typing';
  status('');
  return true;
}
async function preview(text=$('intent-input').value.trim()){
  const currentDraft=()=>$('intent-input').value.trim();
  if(!text||state.composing||isIncompleteComparison(text)||isIncompleteComparison(currentDraft()))return;
  if(!state.live){renderQuick(demoPreview(text,state.audience,state.format),'Demo');status('Demo uses built-in examples, not semantic AI. No draft text is sent.');return;}
  if(activePreview){
    previewQueued=activePreview.text!==text;
    return;
  }
  const key=previewKey(text);
  if(text===currentDraft()&&applyCachedPreview(key,text))return;
  const payload=livePreviewRequest(text);
  const controller=state.controller=new AbortController();
  const version=state.pageVersion;
  const active=activePreview={text,version,answer:''};
  lastPreviewStart={text,time:Date.now()};
  previewQueued=false;
  $('cancel-button').hidden=false;$('input-state').textContent='Preview updating · keep typing';
  const isCurrent=()=>activePreview===active&&!controller.signal.aborted&&version===state.pageVersion&&
    extendsPreview(text,currentDraft())&&!isIncompleteComparison(currentDraft());
  const progress=partial=>{
    if(!isCurrent())return;
    if(partial.reset){active.answer='';showQuickAnswer(completedAnswer||$('quick-answer').textContent,true);}
    if(typeof partial.answer==='string'&&partial.answer.trim()&&draftWordCount(currentDraft().slice(text.length))<=12){
      showQuickAnswer(partial.answer,false,!active.answer);
      active.answer=partial.answer;
    }
    if(currentDraft()===text)composerExperience?.onStream(partial);
  };
  try{
    const data=await callPreview(payload,controller.signal,progress);
    if(!isCurrent())return;
    previewCache.set(key,data);
    if(previewCache.size>20)previewCache.delete(previewCache.keys().next().value);
    renderSnapshot(data.preview,data.model||'gpt-6-luna',text);status('');
  }catch(error){
    if(error.name!=='AbortError'&&isCurrent()&&currentDraft()===text){
      showQuickAnswer(completedAnswer);composerExperience?.onStream({reset:true});status(error.message,true);
    }
  }finally{
    if(activePreview===active){
      const queued=previewQueued&&version===state.pageVersion;
      activePreview=null;state.controller=null;previewQueued=false;
      if(queued&&currentDraft()!==text)preview();
      else{$('cancel-button').hidden=true;$('input-state').textContent='You can keep typing';}
    }
  }
}
function sizeComposer(){const input=$('intent-input');input.style.height='0px';input.style.height=Math.min(220,Math.max(56,input.scrollHeight))+'px';}
window.addEventListener('resize',sizeComposer);
function changed({immediate=false,typing=false}={}){
  if(!$('intent-input').value.trim()){state.slideChoice=undefined;state.slideDecided=false;}
  document.dispatchEvent(new Event('intent:changed'));
  const input=$('intent-input'),text=input.value.trim();
  const waiting=isIncompleteComparison(text),keep=state.live&&!!text&&!waiting;
  const compatible=snapshot=>keep&&!immediate&&snapshot?.version===state.pageVersion&&extendsPreview(snapshot.text,text);
  clearTimeout(state.timer);
  previewQueued=false;
  if(!compatible(activePreview))stop();
  if(!keep||immediate||lastPreviewStart&&!extendsPreview(lastPreviewStart.text,text))lastPreviewStart=null;
  if(!compatible(shownPreview))shownPreview=null;
  composerExperience?.onDraftChanged(keep);
  state.information=rebaseInformation(state.previousDraft,input.value,state.information).filter(e=>e.confirmed);state.previousDraft=input.value;
  state.revision++;state.uncertainty=null;
  if(!keep)completedAnswer='';
  showQuickAnswer(keep?(completedAnswer||$('quick-answer').textContent):'',keep);state.suppressed=null;closeIntentPopover();
  if(state.proposal&&state.proposal.baseVersion===undefined){$('accept-button').disabled=true;$('proposal-label').textContent='Earlier page · explore again to use the latest intent';}
  const hasText=!!text;if(!hasText)state.answers=[];document.body.classList.toggle('has-intent',hasText);$('typing-assistance').hidden=!hasText;
  $('build-page').disabled=!hasText;
  sizeComposer();
  if(shownPreview)renderSnapshot(shownPreview.data,shownPreview.source,shownPreview.text,false);
  else renderUncertainty();
  if(!hasText){$('quick-preview').hidden=true;updateClarification(null);return;}
  if(waiting){$('input-state').textContent='Waiting for the second item to compare';status('');return;}
  if(!state.live){preview();return;}
  if(activePreview?.answer&&draftWordCount(text.slice(activePreview.text.length))<=12)showQuickAnswer(activePreview.answer);
  if(!activePreview&&previewCache.size&&applyCachedPreview(previewKey(text),text))return;
  $('cancel-button').hidden=false;
  if(immediate){preview();return;}
  state.timer=setTimeout(()=>preview(),/[\p{L}\p{N}][.!?][”’"')]?$/u.test(text)?100:250);
  const checkpoint=typing?completedDraft(input.value):'';
  if(checkpoint&&!activePreview&&draftWordCount(checkpoint)-draftWordCount(lastPreviewStart?.text||'')>=PREVIEW_WORD_STEP&&
     Date.now()-(lastPreviewStart?.time??-Infinity)>=1200){
    if(checkpoint===text)clearTimeout(state.timer);
    preview(checkpoint);
  }
}

function recordHistory(pages,label){
 const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
 const entries=pages.map(page=>({...structuredClone(page),label,time}));
 state.history=[...entries,...state.history].slice(0,historyLimit);
 $('history-count').textContent=state.history.length;
}
function snapshot(label){recordHistory([capturePage()],label);}
function renderHistory(){
 const target=$('history-list');target.replaceChildren();
 if(!state.history.length)target.append(node('p','status-line','Accepted changes will appear here.'));
 for(const entry of state.history){
  const row=node('div','history-row');row.append(node('span','',entry.title+' · '+entry.label+' · '+entry.time));
  const button=node('button','','Restore');button.onclick=()=>{
   state.pageController?.abort();state.pageRequest++;stop();
   timeline.save(capturePage());snapshot('Before restore');state.pageVersion++;state.proposal=null;
   restorePage(entry);changed();appendPage();renderPageNavigation();renderHistory();
   status('Previous page restored. The page you left is in History.');
  };
  row.append(button);target.append(row);
 }
}
function renderBlocks(){const target=$('accepted-blocks');target.replaceChildren();state.blocks.forEach((block,i)=>{const section=node('section','visual-block');const heading=node('div','block-title');heading.append(node('h3','',block.title));const b=node('button','quiet-button','Remove');b.onclick=()=>{snapshot('Before removing a block');state.blocks.splice(i,1);renderBlocks();};heading.append(b);section.append(heading);renderComponent(section,block);target.append(section);});}
$('intent-input').oninput=event=>{if(!state.composing)changed({typing:event.inputType==='insertText'&&event.data?.length===1});};$('intent-input').addEventListener('compositionstart',()=>{state.composing=true;stop();});$('intent-input').addEventListener('compositionend',()=>{state.composing=false;changed();});
$('cancel-button').onclick=()=>{stop();showQuickAnswer(completedAnswer);composerExperience?.onStream({reset:true});status('Preview paused. Keep editing to resume.');$('input-state').textContent='Preview paused';};
$('accept-button').onclick=()=>{const p=state.proposal;if(!p||(p.baseVersion!==undefined?p.baseVersion!==state.pageVersion:p.revision!==state.revision))return;if(p.selection&&$('document-input').value.slice(p.selection.start,p.selection.end)!==p.selection.text){status('The selected text changed. Select it again for a fresh suggestion.',true);return;}timeline.save(capturePage());snapshot(state.component?'Before replacing the page':'Before keeping the page');if(p.selection)state.blocks.push(structuredClone(p));else{state.component=structuredClone(p);$('document-title').value=p.title;directEdits=new DirectEditUndo();}state.proposal=null;state.pageVersion++;renderActive();renderBlocks();renderProposal();appendPage();renderPageNavigation();status('Page kept. Edit it directly, or restore the previous version in History.');};
$('dismiss-button').onclick=()=>{state.proposal=null;renderProposal();};
$('document-input').addEventListener('select',()=>{const f=$('document-input');const text=f.value.slice(f.selectionStart,f.selectionEnd).trim();state.selection=text?{start:f.selectionStart,end:f.selectionEnd,text:f.value.slice(f.selectionStart,f.selectionEnd)}:null;$('selection-tools').hidden=!text;$('selection-label').textContent=text?`Selected: ${text.slice(0,35)}${text.length>35?'…':''}`:'Selected text';});
async function fromSelection(kind){if(!state.selection)return;stop();const selection={...state.selection};if(!state.live){const v=demoPreview(selection.text,state.audience,kind==='diagram'?'Diagram':'Outline');v.title=kind==='diagram'?'Explore the selected idea':'A closer look';setProposal(v,state.revision,'Demo',selection);status('Sample selection response. Connect Luna for an explanation of arbitrary text.');}else{const revision=state.revision;try{const data=await callPreview({text:`${kind==='diagram'?'Make a diagram about':'Explain'} this selected text: ${selection.text}`,audience:state.audience,format:kind==='diagram'?'Diagram':'Outline'},new AbortController().signal);setProposal(data.preview,revision,'Luna',selection);}catch(e){status(e.message,true);}}}
$('diagram-selection').onclick=()=>fromSelection('diagram');$('explain-selection').onclick=()=>fromSelection('outline');
$('history-button').onclick=()=>{$('history-panel').hidden=!$('history-panel').hidden;renderHistory();};$('close-history').onclick=()=>$('history-panel').hidden=true;
$('download-button').onclick=()=>{const data={version:1,title:$('document-title').value,notes:$('document-input').value,component:state.component,blocks:state.blocks};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='ai-interaction-page.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Exported page data as JSON. API keys are never included.');};
for(const [button,dialog] of [['connection-button','connection-dialog'],['about-button','about-dialog']])$(button).onclick=()=>{closeIntentPopover();$(dialog).showModal();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(b.dataset.close==='connection-dialog')$('api-key').value='';$(b.dataset.close).close();});$('connection-dialog').addEventListener('close',()=>{$('api-key').value='';state.connectionRevision++;});
$('connection-form').onsubmit=async event=>{event.preventDefault();const key=$('api-key').value.trim();if(!key&&!state.serverKey){$('connection-error').textContent='Enter an OpenAI API key, or stay in demo mode.';return;}const connectionRevision=++state.connectionRevision;$('connect-button').disabled=true;$('connection-error').textContent='Checking Luna access…';try{const response=await fetch('/api/check',{method:'POST',headers:key?{Authorization:`Bearer ${key}`}:{}});const result=await response.json();if(connectionRevision!==state.connectionRevision)return;if(!response.ok)throw new Error(result.error||'Connection failed.');stop();state.key=key;previewCache.clear();shownPreview=null;completedAnswer='';composerExperience?.stop();state.requests=0;state.live=true;document.body.classList.add('live');$('mode-label').textContent='OpenAI connected';$('typing-connection').firstChild.textContent='Connected';$('api-key').value='';$('connection-error').textContent='';$('connection-dialog').close();changed();if(state.pendingSend){state.pendingSend=false;submitPage();}}catch(error){$('connection-error').textContent=error.message;}finally{$('connect-button').disabled=false;}};
$('disconnect-button').onclick=()=>{state.connectionRevision++;stop();composerExperience?.stop();state.pageController?.abort();state.pageRequest++;hidePageProgress();state.pendingSend=false;state.key='';previewCache.clear();state.live=false;document.body.classList.remove('live');$('mode-label').textContent='Demo mode';$('typing-connection').firstChild.textContent='Demo';$('api-key').value='';$('connection-dialog').close();changed();};
$('active-component').addEventListener('input',event=>{if(event.target.closest('.page-assistant'))return;state.pageVersion++;if(state.proposal?.baseVersion!==undefined)renderProposal();});
$('document-title').addEventListener('input',event=>{markPageEdit();event.target.style.height='0';event.target.style.height=event.target.scrollHeight+'px';});
$('document-input').addEventListener('input',markPageEdit);
composerExperience=setupComposerExperience({state,changed,request:callPreview,setIntent(value){state.intentOverride=value.slice(0,500);changed({immediate:true});},closeDetail:closeIntentPopover,openDetail(entry,origin='click',anchor=null){if(!entry)return;closeIntentPopover();updateClarification(entry);openIntentPopover(origin,anchor);}});
const editValues=new WeakMap();
let applyingSavedEdit=false;
const editField=key=>[...paper.querySelectorAll('[data-edit-key]')].find(field=>
 field.dataset.editKey===key&&!field.closest('.page-assistant,#proposal,#accepted-blocks'));
function latestDirectEdit(){return directEdits.latest(key=>editField(key)?.value);}
function updateUndoButton(){$('undo-edit').disabled=!latestDirectEdit();}
paper.addEventListener('input',event=>{
 const field=event.target;
 if(!editValues.has(field))return;
 const before=editValues.get(field);
 editValues.set(field,field.value);
 if(applyingSavedEdit)return;
 directEdits.record(field.dataset.editKey,before,field.value,Date.now());
 updateUndoButton();
},true);
$('undo-edit').onclick=()=>{
 const entry=latestDirectEdit();
 if(!entry)return;
 const field=editField(entry.key);
 directEdits.take(entry);
 field.value=entry.before;
 applyingSavedEdit=true;
 try{field.dispatchEvent(new Event('input',{bubbles:true}));}finally{applyingSavedEdit=false;}
 document.dispatchEvent(new CustomEvent('page:undo-edit',{detail:field}));
 field.focus({preventScroll:true});
 field.scrollIntoView({block:'nearest'});
 updateUndoButton();
};
setupPageAssistant({state,request:callPreview,commit(apply,id){
 timeline.save(capturePage());snapshot('Before inline change');
 directEdits.forget(id.startsWith('component:')?'practice:'+id.slice(10):id);
 applyingSavedEdit=true;
 try{apply();}finally{applyingSavedEdit=false;}
 state.pageVersion++;renderActive();appendPage();renderPageNavigation();showUpdatedPart(id,undefined,true);
}});

workspace=setupWorkspace();$('page-back').onclick=()=>navigatePage(-1);$('page-forward').onclick=()=>navigatePage(1);
window.addEventListener('pagehide',()=>{stop();state.pageController?.abort();state.key='';});changed();
fetch('/api/config').then(r=>r.json()).then(config=>{if(!config.serverKey)return;state.serverKey=true;state.live=true;document.body.classList.add('live');$('mode-label').textContent='OpenAI configured';$('typing-connection').firstChild.textContent='OpenAI';$('disconnect-button').textContent='Pause live previews';changed();}).catch(()=>{});
