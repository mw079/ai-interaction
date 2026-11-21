import {element} from './shared/dom.js';
import {createApiClient} from './shared/api-client.js';
import {renderProjectile} from './page/projectile.js';
import {renderFollowUpScope,followUpScopes,applyFollowUpScope} from './composer/controls-extended.js';
import {slideRecipe,validComponents} from './components/catalog.js';
import {setupPageAssistant} from './page/assistant.js';
import {renderAtlas,refreshDeeper,addViews,renderDraft} from './page/atlas.js';
import {PageTimeline,DirectEditUndo,historyLimit} from './page/timeline.js';
import {setupWorkspace} from './page/workspace.js';
import {confirmedChoices} from './composer/request-context.js';
import {setupComposerExperience} from './composer/composer.js';
import {INFORMATION_TYPES, rebaseInformation, chooseInformation, mergeInformation} from './composer/intent.js';
import {renderControl,formatPreview} from './composer/controls.js';
import {positionPopover} from './composer/popover.js';
import {workingLine, demoPreview, clarificationFor, quickAnswer, compactLiveAnswer, liveClarificationFor, draftWordCount, completedDraft, PREVIEW_WORD_STEP, extendsPreview, workingDraftPreview, draftAnswersQuestion, projectileLaunch} from './shared/model.js';
const $ = id => document.getElementById(id);
const state = {live:false, limited:false, composing:false, revision:0, format:'Auto', audience:'', controller:null, timer:null, proposal:null, component:null, history:[], uncertainty:null, popoverTimer:null, clarification:null, openClarification:null, popoverOrigin:null, suppressed:null, customDrafts:new Map(), pageController:null, pageRequest:0, taskGoal:'', pageVersion:0, information:[], previousDraft:'',confirmedChoices:[],answers:[],intentOverride:'',slideChoice:undefined};
const node=element;
const {modelPayload,callPreview}=createApiClient({state,pageContext:()=>pageContext(),status:(text,error)=>status(text,error),onLimit:message=>showLimit(message)});
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
    text.animate([{backgroundColor:'#ececec'},{backgroundColor:'transparent'}],{duration:480,easing:'ease-out'});
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
    const audienceTypes=['audience','prior_knowledge'];
    const knownAudience=state.confirmedChoices.some(choice=>audienceTypes.includes(choice.type));
    if(knownAudience&&audienceTypes.includes(state.uncertainty?.type))state.uncertainty=null;
    const needsClarification=state.uncertainty && state.uncertainty.questionKind!=='explore' && state.uncertainty.type!=='output_format' &&
      !state.answers.some(answer=>answer.question===state.uncertainty.question);
    const audienceQuestion=audienceTypes.includes(state.uncertainty?.type);
    if(data.slideOptions?.length && !state.slideDecided && (!needsClarification||audienceQuestion)){
      state.slideOptions=data.slideOptions;
      state.uncertainty={question:'How would you like to explore this?',slideOptions:data.slideOptions};
    }
    renderUncertainty();}
  else updateClarification(state.uncertainty);
  composerExperience?.onPreview(data,{fresh,keepQuestion:interim?question=>!draftAnswersQuestion(question,tail):null});
}
function updateClarification(clarification){
  state.clarification=clarification;
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
  const rail=$('intent-refinements');rail.replaceChildren();rail.hidden=!entries.length&&!state.answers.length&&!state.slideDecided;
  entries.forEach(entry=>{const b=node('button','phrase-access',entry.phrase+(entry.value?` (${entry.value})`:''));b.type='button';b.setAttribute('aria-label',`${INFORMATION_TYPES[entry.type].label}: ${entry.phrase}${entry.value?', '+entry.value:''}`);b.onclick=()=>{updateClarification(entry);openIntentPopover('click');};rail.append(b);});
  state.answers.forEach(entry=>{const b=node('button','phrase-access',entry.value);b.type='button';b.setAttribute('aria-label',entry.question+': '+entry.value);b.onclick=()=>{updateClarification({...entry,type:undefined});openIntentPopover('click');};rail.append(b);});
  // The chosen way to explore it is a decision like any other: listed, and reopened to change it.
  if(state.slideDecided){
    const label=state.slideChoice?slideRecipe(state.slideChoice).label:'Let AI choose';
    const b=node('button','phrase-access',label);b.type='button';b.setAttribute('aria-label','How would you like to explore this?: '+label);
    b.onclick=()=>{updateClarification({question:'How would you like to explore this?',slideOptions:state.slideOptions?.length?state.slideOptions:[state.slideChoice].filter(Boolean)});openIntentPopover('click');};
    rail.append(b);
  }
  composerExperience?.onMirrorRendered();
}
// keepOpen: multi-value controls apply each change live and leave the picker open.
function applyClarification(value,{keepOpen=false}={}){
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
    // Track the updated entry so the next live change replaces this value instead of adding one.
    const updated=result.entries.find(entry=>entry.key===u.key);
    if(updated&&state.openClarification)state.openClarification={...state.openClarification,...updated};
  }
  else{value=value.trim();if(!value)return;const phrase=u?.phrase;if(!phrase)return;const entry={...u,type:'goal',key:'legacy',annotation:'',value:'',confirmed:false};const entries=[...state.information.filter(e=>e.end+(e.annotation?.length||0)<=entry.start||e.start>=entry.end),entry].sort((a,b)=>a.start-b.start);const result=chooseInformation(input.value,entries,'legacy',value);if(!result)return;input.value=result.text;state.information=result.entries;state.previousDraft=result.text;}
  if(u)state.customDrafts.delete(u.question);
  if(keepOpen){
    changed({keepPopover:true});composerExperience?.onMirrorRendered?.();
    // The phrase highlight is re-rendered; keep the popover anchored to its new element.
    const key=state.openClarification?.key;
    const mark=key&&[...$('input-mirror').querySelectorAll('mark')].find(m=>m.dataset.key===key);
    if(mark&&state.popoverAnchor?.isConnected===false)state.popoverAnchor=mark;
    if(!$('intent-popover').hidden)positionIntentPopover();
    return;
  }
  closeIntentPopover();changed({immediate:true});state.suppressed=u?.question;input.focus();
}
function closeIntentPopover({restore=false,suppress=false}={}){
  clearTimeout(state.popoverTimer);
  const origin=state.popoverOrigin;
  const priorAnchor=state.popoverAnchor;
  if(priorAnchor===$('composer-scope'))priorAnchor.setAttribute('aria-expanded','false');
  if(suppress)state.suppressed=state.openClarification?.question;
  $('intent-popover').hidden=true;$('intent-popover').classList.remove('audience-picker');
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
      practice:'list',flashcards:'list',prediction:'list',sorting:'list',evidence:'text',
      relationships:'network',cycle:'cycle',parameter:'slider',scenarios:'slider',function:'chart',spectrum:'slider',decision:'network',hierarchy:'network'};
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
        renderUncertainty();
        composerExperience?.onMirrorRendered();
        // The question row goes away once the format is decided, so focus returns to the draft.
        $('intent-input').focus();
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
  if(u.type)renderControl($('popover-options'),u,applyClarification,()=>{if(!$('intent-popover').hidden)positionIntentPopover();});else choices($('popover-options'),u.options,'',applyClarification);
  $('popover-custom').value=state.customDrafts.get(u.question)||'';
  const hasDraft=!!$('popover-custom').value||(!u.options?.length&&(!u.type||INFORMATION_TYPES[u.type].family==='choices'));
  $('popover-custom').placeholder=hasDraft&&!u.options?.length?'Type your answer…':'In your own words…';
  $('custom-answer-button').textContent='Type your own answer';
  // A control with its own text field (a range, a search, "Add your own") needs no second one.
  const ownEntry=!!$('popover-options').querySelector('.control-entry input:not([type=date]):not([type=time])');
  $('popover-custom-form').hidden=!hasDraft||ownEntry;$('custom-answer-button').hidden=hasDraft||ownEntry;$('custom-answer-button').setAttribute('aria-expanded',String(hasDraft));
  pop.hidden=false;
  positionIntentPopover();
  if(origin!=='hover')(pop.querySelector('#popover-options input, #popover-options select')||pop.querySelector('#popover-options button')||(hasDraft?$('popover-custom'):$('custom-answer-button'))).focus();
}
function schedulePopoverClose(){clearTimeout(state.popoverTimer);state.popoverTimer=setTimeout(()=>{if(!$('intent-popover').contains(document.activeElement))closeIntentPopover();},260);}
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
$('build-page').onclick=()=>submitPage();
// The whole field box is a text target: a click on its padding or empty space (not on a button)
// puts the caret in the draft, as the text cursor promises.
document.querySelector('.composer').addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button,a,input,select,textarea,label'))return;
  event.preventDefault();
  const field=$('intent-input');field.focus();field.setSelectionRange(field.value.length,field.value.length);
});
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
// More views: a page shown with one view asks, in the background, for up to two views that
// answer a different question. They join as tabs only if the page is still the same, unedited.
function requestViews(page){
  if(!state.live||page.kind!=='outline'||page.components?.length!==1||page.viewsRequested)return;
  page.viewsRequested=true;
  const version=state.pageVersion;
  callPreview({text:state.taskGoal||page.title,audience:state.audience,format:state.format,phase:'views'}).then(data=>{
    if(state.component!==page||state.pageVersion!==version||!Array.isArray(data.views))return;
    const taken=new Set(page.components.map(c=>c.id));
    const extra=data.views.filter(c=>!taken.has(c.id)).slice(0,3-page.components.length);
    if(!extra.length||!validComponents([...page.components,...extra]))return;
    addViews(page,extra);
    timeline.save(capturePage());
  }).catch(()=>{});
}
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
  if(!state.live){if(!state.limited)status('Live pages are not available right now.',true);return;}
  // The one-line preview the user read ("Will add…") goes with the request, so Send does what it said.
  // Only a preview of exactly this text, for the page as it is now, counts as a promise.
  const promised=retryContext?retryContext.promised:(state.component&&shownPreview&&shownPreview.source!=='Demo'&&shownPreview.version===state.pageVersion&&shownPreview.text.trim()===text?compactLiveAnswer(shownPreview.data):'')||undefined;
  directEdits.endBurst();closeIntentPopover();stop();state.pageController?.abort();
  const context=structuredClone(pageContext()),version=state.pageVersion,id=++state.pageRequest;
  const preferences=new Map(state.confirmedChoices.map(e=>[e.type+':'+e.phrase,e]));
  confirmedChoices([...state.information,...state.answers]).forEach(e=>preferences.set(e.type+':'+e.phrase,e));state.confirmedChoices=[...preferences.values()].slice(-8);
  const controller=state.pageController=new AbortController();
  // The original request belongs to the page being made: a first Send that is cancelled by a newer
  // one must not stay the goal (its topic would leak into the new page's extra views).
  if(!state.component)state.taskGoal=text;
  openPage();$('intent-input').value='';changed();workspace?.reading();
  status('');
  const progressTimer=showPageProgress();
  $('submitted-request').textContent=text;
  // A follow-up keeps the page in view; a status line above the field says what is being changed.
  if(state.component){
    changeStatus.replaceChildren(node('span','page-spinner'),node('span','',workingLine(promised,text)));
    changeStatus.hidden=false;
  }
  // A first page shows its title and introduction as soon as they are written (about 1-2 s),
  // with a placeholder for the visual; a follow-up keeps the current page until the new one is ready.
  let draft=null;
  const progress=state.component?undefined:partial=>{
    if(id!==state.pageRequest||!partial.title)return;
    if(!draft){documentPanel.classList.add('has-slide','is-drafting');draft=renderDraft($('active-component'),$('document-title'));}
    draft.update(partial);
  };
  try{
    const data=await callPreview({text,context,audience:state.audience,format:state.format,phase:'page',slideChoice:scope?undefined:slideChoice,pageScope:scope?{id:scope.id,text:scope.text}:undefined,promised},controller.signal,progress);
    if(id!==state.pageRequest)return;
    if(scope&&version!==state.pageVersion)throw new Error('The selected part changed while the response was being prepared.');
    const result=scope?applyFollowUpScope(base,data.preview,scope):data.preview;
    if(scope)result.title=$('document-title').value;
    const p={...structuredClone(result),revision:state.revision,baseVersion:version,source:data.model,physics:scope?result.physics:projectileLaunch(result.launch),edits:scope?result.edits:{},selected:scope?result.selected:0};
    if(!state.component||version===state.pageVersion){
      // A follow-up that adds a part below the first visual (a quiz, a second chart) scrolls to it.
      const earlier=state.component&&new Map((state.component.components||[]).map(c=>[c.id,JSON.stringify(c)]));
      const added=!scope&&earlier?(p.components||[]).slice(1).find(c=>!earlier.has(c.id)):null;
      // A follow-up that changes a view in place (new checklist items) shows that view too.
      const updated=!scope&&earlier&&!added?(p.components||[]).find(c=>earlier.has(c.id)&&earlier.get(c.id)!==JSON.stringify(c)):null;
      if(state.component){timeline.save(capturePage());snapshot(scope?'Before focused change':'Before new page');}
      state.component=p;$('document-title').value=p.title;
      if(!scope)directEdits=new DirectEditUndo();
      else if(scope.id.startsWith('passage:'))directEdits.forget(scope.id.startsWith('passage:0')?'intro':scope.id.split(':').slice(0,2).join(':'));
      else if(scope.id.startsWith('block:'))directEdits.forget('practice:'+scope.id.slice(6));
      state.proposal=null;state.pageVersion++;
      renderActive();renderProposal();appendPage();renderPageNavigation();workspace?.reading();
      if(added)showUpdatedPart('block:'+added.id,added.title,false,'added');
      else if(updated)showUpdatedPart('block:'+updated.id,updated.title,false,'updated');
      else showUpdatedPart(scope?.id,scope?.label);
      if(!scope)requestViews(p);
    }
    else{p.baseVersion=state.pageVersion;state.proposal=p;renderProposal();}
    status(state.proposal?'Updated page ready to review. Your existing page is preserved.':'Your page is ready. Edit it directly or ask for a change below.');
  }catch(error){
    // A first page that fails after its title appeared: put the title field back in its place
    // (the draft holds it), then clear the draft, so the error and Retry show in the empty paper.
    if(id===state.pageRequest&&!state.component){
      const titleField=$('document-title');$('active-component').before(titleField);titleField.value='';titleField.style.height='';
      documentPanel.classList.remove('has-slide','is-drafting');$('active-component').replaceChildren();
    }
    if(id===state.pageRequest&&error.name!=='AbortError'){
      documentPanel.removeAttribute('data-generating');
      const retry=node('button','','Retry this request');
      retry.onclick=()=>submitPage(text,slideChoice,{scope,promised});
      pageProgress.replaceChildren(node('span','',error.message),retry);
    }
  }finally{
    clearInterval(progressTimer);
    if(id===state.pageRequest){
      state.pageController=null;
      documentPanel.classList.remove('is-drafting');
      changeStatus.hidden=true;
      if(documentPanel.hasAttribute('data-generating'))hidePageProgress();
    }
  }
}

function renderProposal(){
  const p=state.proposal;$('proposal').hidden=!p;
  if(!p)return;
  const stale=p.baseVersion!==undefined?p.baseVersion!==state.pageVersion:p.revision!==state.revision;
  $('proposal-label').textContent='A new version is ready';$('proposal-title').textContent=p.title;
  $('proposal-reason').textContent=stale?'The page changed again after this was made. Ask again to get a version that includes your latest edits.':'You edited the page while this was being made, so it waits for you instead of replacing your work.';
  $('proposal-provenance').textContent=state.component&&!stale?'You can go back with ←':'';
  $('accept-button').disabled=stale;$('accept-button').textContent=state.component?'Replace page':'Keep this page';
  // A compact summary, not a second live page: intro, then what the new version contains.
  const content=$('proposal-content');content.replaceChildren();
  if(p.body?.[0])content.append(node('p','proposal-intro',p.body[0]));
  const parts=[...(p.components||[]).map(c=>c.title),...(p.kind==='kepler'?['Orbit explorer']:p.kind==='projectile'?['Launch simulator']:[]),
    ...(p.body||[]).slice(1).map(text=>text.match(/^([^:\n]{1,32}):\s/)?.[1]).filter(Boolean)];
  if(parts.length){const list=node('div','proposal-parts');parts.slice(0,6).forEach(part=>list.append(node('span','proposal-part',part)));content.append(list);}
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
 if(state.component){renderAtlas(target,state.component,{titleField:title,onEdit:markPageEdit});if(state.component.kind==='projectile'){const sim=renderProjectile(state.component);if(sim)target.querySelector('.atlas-visual').append(sim);}}
 for(const field of paper.querySelectorAll('[data-edit-key]'))editValues.set(field,field.value);
 renderPageNavigation();
}
function capturePage(){return {title:$('document-title').value,text:$('document-input').value,component:state.component,taskGoal:state.taskGoal,preferences:state.confirmedChoices,paperScroll:paper.scrollTop,scroll:window.scrollY,directEdits:directEdits.entries};}
function appendPage(){
 const displaced=timeline.append(capturePage());
 if(displaced.length)recordHistory(displaced.reverse(),'Later version');
 if(!$('history-panel').hidden)renderHistory();
}
function renderPageNavigation(){const b=$('page-back'),f=$('page-forward');if(!b)return;b.disabled=!timeline.canBack;f.disabled=!timeline.canForward;$('page-position').textContent=timeline.index<0?'':`${timeline.index+1} / ${timeline.pages.length}`;updateUndoButton();}
function showUpdatedPart(id,label,restoreFocus=false,change='updated'){
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
  // A part on another view (tab) is brought into view first.
  const panel=element.closest('[role=tabpanel]');
  if(panel?.hidden)document.getElementById(panel.getAttribute('aria-labelledby'))?.click();
  const section=element.closest('.page-field')||element;
  const top=section.getBoundingClientRect(),frame=paper.getBoundingClientRect();
  if(passageIndex==='0'||id==='intro'||id==='title')paper.scrollTop=0;
  else if(top.top<frame.top+14||top.bottom>frame.bottom-14){
   const scale=frame.height/paper.offsetHeight||1;
   paper.scrollTop+=(top.top-frame.top)/scale-16;
  }
  section.classList.add('page-updated');
  setTimeout(()=>section.classList.remove('page-updated'),1800);
  $('page-update').textContent=label?label+' '+change:'Passage updated';
 });
}
function restorePage(page){
 const copy=structuredClone(page);
 $('document-title').value=copy.title;$('document-input').value=copy.text;state.component=copy.component;
 state.taskGoal=copy.taskGoal||'';state.confirmedChoices=copy.preferences||[];directEdits=new DirectEditUndo(copy.directEdits);
 openPage();hidePageProgress();$('page-update').textContent='';
 renderActive();renderProposal();workspace?.reading();
 const version=state.pageVersion;
 requestAnimationFrame(()=>{if(version!==state.pageVersion)return;paper.scrollTop=copy.paperScroll||0;window.scrollTo({top:copy.scroll||0,behavior:'instant'});});
}
function navigatePage(delta){
 const page=timeline.move(delta,capturePage());if(!page)return;
 state.pageController?.abort();state.pageRequest++;stop();state.proposal=null;state.pageVersion++;
 restorePage(page);changed();
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
  if(!text||state.composing)return;
  if(state.limited)return;
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
    extendsPreview(text,currentDraft());
  const progress=partial=>{
    if(!isCurrent())return;
    if(partial.reset){active.answer='';showQuickAnswer(completedAnswer||$('quick-answer').textContent,true);}
    if(typeof partial.answer==='string'&&partial.answer.trim()&&draftWordCount(currentDraft().slice(text.length))<=12){
      showQuickAnswer(partial.answer,false,!active.answer);
      active.answer=partial.answer;
    }
    if(currentDraft()!==text)return;
    // Highlights appear one by one as each finishes, not all at once at the end.
    const marks=partial.information&&JSON.stringify(partial.information.map(item=>item.phrase));
    if(marks&&marks!==active.marks){
      active.marks=marks;
      state.information=mergeInformation($('intent-input').value,state.information,partial.information);
      renderUncertainty();
    }
    composerExperience?.onStream(partial);
  };
  try{
    const data=await callPreview(payload,controller.signal,progress);
    if(!isCurrent())return;
    previewCache.set(key,data);
    if(previewCache.size>20)previewCache.delete(previewCache.keys().next().value);
    renderSnapshot(data.preview,data.model||'gpt-6-luna',text);status('');
  }catch(error){
    if(error.name!=='AbortError'&&isCurrent()&&currentDraft()===text){
      showQuickAnswer(completedAnswer);composerExperience?.onPreviewFailed();status(error.message,true);
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
function changed({immediate=false,typing=false,keepPopover=false}={}){
  if(!$('intent-input').value.trim()){state.slideChoice=undefined;state.slideDecided=false;state.slideOptions=undefined;}
  document.dispatchEvent(new Event('intent:changed'));
  const input=$('intent-input'),text=input.value.trim();
  const keep=state.live&&!!text;
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
  showQuickAnswer(keep?(completedAnswer||$('quick-answer').textContent):'',keep);state.suppressed=null;if(!keepPopover)closeIntentPopover();
  if(state.proposal&&state.proposal.baseVersion===undefined){$('accept-button').disabled=true;$('proposal-label').textContent='Earlier page · explore again to use the latest intent';}
  const hasText=!!text;if(!hasText)state.answers=[];document.body.classList.toggle('has-intent',hasText);$('typing-assistance').hidden=!hasText;
  $('build-page').disabled=!hasText||state.limited;   // over today's limit Send cannot do anything, so it stays off
  sizeComposer();
  if(shownPreview)renderSnapshot(shownPreview.data,shownPreview.source,shownPreview.text,false);
  else renderUncertainty();
  if(!hasText){$('quick-preview').hidden=true;updateClarification(null);return;}
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
$('intent-input').oninput=event=>{if(!state.composing)changed({typing:event.inputType==='insertText'&&event.data?.length===1});};$('intent-input').addEventListener('compositionstart',()=>{state.composing=true;stop();});$('intent-input').addEventListener('compositionend',()=>{state.composing=false;changed();});
$('cancel-button').onclick=()=>{stop();showQuickAnswer(completedAnswer);composerExperience?.onPreviewFailed();status('Preview paused. Keep editing to resume.');$('input-state').textContent='Preview paused';};
$('accept-button').onclick=()=>{const p=state.proposal;if(!p||(p.baseVersion!==undefined?p.baseVersion!==state.pageVersion:p.revision!==state.revision))return;timeline.save(capturePage());snapshot(state.component?'Before replacing the page':'Before keeping the page');state.component=structuredClone(p);$('document-title').value=p.title;directEdits=new DirectEditUndo();state.proposal=null;state.pageVersion++;renderActive();renderProposal();appendPage();renderPageNavigation();status('Page kept. Edit it directly, or restore the previous version in History.');};
$('dismiss-button').onclick=()=>{state.proposal=null;renderProposal();};
// History opens directly under the toolbar that holds its button, so it is always in view.
function setHistoryOpen(open){$('history-panel').hidden=!open;$('history-button').setAttribute('aria-expanded',String(open));if(open){renderHistory();$('close-history').focus({preventScroll:true});}}
$('history-button').onclick=()=>setHistoryOpen($('history-panel').hidden);$('close-history').onclick=()=>{setHistoryOpen(false);$('history-button').focus();};
$('download-button').onclick=()=>{const data={version:1,title:$('document-title').value,notes:$('document-input').value,component:state.component};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='ai-interaction-page.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Exported page data as JSON.');};
$('active-component').addEventListener('input',event=>{if(event.target.closest('.page-assistant'))return;state.pageVersion++;if(state.proposal?.baseVersion!==undefined)renderProposal();});
$('document-title').addEventListener('input',event=>{markPageEdit();event.target.style.height='0';event.target.style.height=event.target.scrollHeight+'px';});
$('document-input').addEventListener('input',markPageEdit);
composerExperience=setupComposerExperience({state,changed,request:callPreview,setIntent(value){state.intentOverride=value.slice(0,500);changed({immediate:true});},closeDetail:closeIntentPopover,openDetail(entry,origin='click',anchor=null){if(!entry)return;closeIntentPopover();updateClarification(entry);openIntentPopover(origin,anchor);}});
const editValues=new WeakMap();
let applyingSavedEdit=false;
const editField=key=>[...paper.querySelectorAll('[data-edit-key]')].find(field=>
 field.dataset.editKey===key&&!field.closest('.page-assistant,#proposal'));
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

// The follow-up status line sits in the dock, above the live question row and the field.
const changeStatus=node('div','change-status');changeStatus.id='change-status';changeStatus.setAttribute('role','status');changeStatus.hidden=true;
$('live-question').before(changeStatus);
workspace=setupWorkspace();$('page-back').onclick=()=>navigatePage(-1);$('page-forward').onclick=()=>navigatePage(1);
window.addEventListener('pagehide',()=>{stop();state.pageController?.abort();});changed();
// How it works: the demo video in a dialog, with sound. It closes with ×, Escape or a click
// outside the video, and focus returns to the button.
const demoDialog=$('demo-dialog'),demoVideo=$('demo-video');
$('how-it-works').onclick=()=>{demoDialog.showModal();demoVideo.currentTime=0;demoVideo.play().catch(()=>{});};
$('close-demo').onclick=()=>demoDialog.close();
demoDialog.addEventListener('click',event=>{if(event.target===demoDialog)demoDialog.close();});
demoDialog.addEventListener('close',()=>{demoVideo.pause();$('how-it-works').focus();});
// Live help needs the server's key; a visitor over today's limit sees the try-tomorrow card instead.
function showLimit(message){
  state.live=false;state.limited=true;stop();composerExperience?.stop();state.pageController?.abort();hidePageProgress();
  document.body.classList.remove('live');document.body.classList.add('limited');
  $('typing-assistance').hidden=true;
  if(message)$('limit-message').textContent=message;
  $('limit-card').hidden=false;$('build-page').disabled=true;
  $('limit-video')?.play().catch(()=>{});   // a short demo of the app, started only when the card is shown
}
fetch('/api/config').then(r=>r.json()).then(config=>{if(config.limited){showLimit();return;}if(!config.live)return;state.live=true;document.body.classList.add('live');changed();}).catch(()=>{});
