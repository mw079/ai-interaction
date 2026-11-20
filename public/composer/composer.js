import {positionPopover} from './popover.js';
import {canAcceptCompletion,freshCompletion,completionSuffix} from '../shared/model.js';
const $=id=>document.getElementById(id);
import {element as make} from '../shared/dom.js';
export function setupComposerExperience({state,changed,request,openDetail,closeDetail,setIntent}){
 let completion='',completionBase='',helpController=null,selectionTimer=null,selectionVersion=0,lastSelection='',summary='',question=null,completedQuestion=null,questionTimer=null;
 const input=$('intent-input'),composer=document.querySelector('.composer'),trigger=$('clarify-phrase');
 const questionRow=make('div','live-question');questionRow.id='live-question';questionRow.hidden=true;
 const questionButton=make('button','live-question-button');questionButton.type='button';questionButton.setAttribute('aria-haspopup','dialog');questionRow.append(questionButton);composer.before(questionRow);
 const summaryCard=make('section','intent-details');summaryCard.id='intent-details';summaryCard.hidden=true;summaryCard.setAttribute('role','dialog');summaryCard.setAttribute('aria-label','Your intent and editable details');
 const summaryHeading=make('p','intent-details-heading','What I understand');const summaryText=make('p','intent-details-text');
 const headingRow=make('div','intent-details-header');const editIntent=make('button','intent-edit-button','Edit');editIntent.type='button';editIntent.setAttribute('aria-label','Edit your intent');headingRow.append(summaryHeading,editIntent);
 const intentForm=make('form','intent-edit-form');intentForm.hidden=true;
 const intentLabel=make('label','','What do you want to achieve?');intentLabel.htmlFor='intent-edit-input';
 const intentInput=make('textarea');intentInput.id='intent-edit-input';intentInput.rows=3;intentInput.maxLength=500;intentInput.required=true;
 const intentActions=make('div','intent-edit-actions');const cancelIntent=make('button','','Cancel');cancelIntent.type='button';const saveIntent=make('button','control-apply','Use this intent');saveIntent.type='submit';intentActions.append(cancelIntent,saveIntent);intentForm.append(intentLabel,intentInput,intentActions);
 const resetIntent=make('button','intent-reset-button','Use suggested intent');resetIntent.type='button';resetIntent.hidden=true;
 summaryCard.append(headingRow,summaryText,intentForm,$('intent-refinements'),resetIntent);document.body.append(summaryCard);
 function editingIntent(on){intentForm.hidden=!on;summaryText.hidden=on;editIntent.hidden=on;resetIntent.hidden=on||!state.intentOverride;}
 editIntent.onclick=()=>{intentInput.value=state.intentOverride||summary;editingIntent(true);openSummary();intentInput.focus();intentInput.setSelectionRange(intentInput.value.length,intentInput.value.length);};
 cancelIntent.onclick=()=>{editingIntent(false);openSummary();editIntent.focus();};
 intentForm.onsubmit=event=>{event.preventDefault();const value=intentInput.value.trim();if(!value){intentInput.setCustomValidity('Describe what you want to achieve.');intentInput.reportValidity();return;}editingIntent(false);setIntent(value);input.focus();};
 intentInput.oninput=()=>intentInput.setCustomValidity('');
 resetIntent.onclick=()=>{editingIntent(false);setIntent('');input.focus();};
 function closeSummary(){clearTimeout(questionTimer);summaryCard.hidden=true;trigger.setAttribute('aria-expanded','false');render();}
 function openSummary(){if(!summary)return;closeDetail();summaryText.textContent=summary;summaryHeading.textContent=state.intentOverride?'Your intent':'What I understand';resetIntent.hidden=!intentForm.hidden||!state.intentOverride;summaryCard.hidden=false;trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect();const pos=positionPopover(r,320,summaryCard.offsetHeight,innerWidth,innerHeight);Object.assign(summaryCard.style,{left:pos.left+'px',top:pos.top+'px',width:pos.width+'px'});render();}
 trigger.onclick=()=>{
  if(!summaryCard.hidden){closeSummary();return;}
  openSummary();
  if(!summaryCard.hidden)(intentForm.hidden?editIntent:intentInput).focus({preventScroll:true});
 };
 summaryCard.addEventListener('click',e=>{if(e.target.closest('.phrase-access'))closeSummary();});
 questionButton.onclick=()=>{closeSummary();openDetail(question,'click',questionButton);};
 questionButton.onpointerenter=()=>{if(questionButton.disabled)return;clearTimeout(questionTimer);questionTimer=setTimeout(()=>openDetail(question,'hover',questionButton),300);};questionButton.onpointerleave=()=>clearTimeout(questionTimer);
 document.addEventListener('pointerdown',e=>{if(!summaryCard.contains(e.target)&&!trigger.contains(e.target))closeSummary();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!summaryCard.hidden){closeSummary();trigger.focus();}});
 window.addEventListener('resize',closeSummary);window.addEventListener('scroll',closeSummary,{passive:true});
 const ghost=make('div','completion-line');ghost.id='completion-line';ghost.hidden=true;
 const ghostText=make('span','completion-text');const accept=make('button','completion-accept','Tab ↹');accept.type='button';accept.setAttribute('aria-label','Accept suggested sentence');ghost.append(accept);document.querySelector('.composer-actions').prepend(ghost);
 // The prediction for the text it was made for; typing along it keeps the rest of it on show.
 function suggestion(){
  if(!completion||!input.value.startsWith(completionBase))return '';
  const typed=input.value.slice(completionBase.length),full=completionSuffix(completionBase,completion);
  return full.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase())&&full.length>typed.length?full.slice(typed.length):'';
 }
 const help=make('section','local-assistance');help.id='local-assistance';help.hidden=true;help.setAttribute('aria-label','Help with selected text');
 const helpHead=make('div','local-help-heading');const helpLabel=make('span','','Selected text');const dismiss=make('button','','Close');dismiss.type='button';dismiss.setAttribute('aria-label','Close local help');helpHead.append(helpLabel,dismiss);
 const helpText=make('p');helpText.setAttribute('role','status');help.append(helpHead,helpText);document.body.append(help);
 function stopHelp(){clearTimeout(selectionTimer);helpController?.abort();helpController=null;selectionVersion++;lastSelection='';help.hidden=true;document.body.classList.remove('has-local-help');}
 dismiss.onclick=stopHelp;document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!help.hidden)stopHelp();});
 function render(){
  document.body.dataset.experience='unified';
  const focused=document.activeElement===input||document.activeElement===accept,atEnd=input.selectionStart===input.selectionEnd&&input.selectionEnd===input.value.length;
  const next=suggestion();
  ghost.hidden=!next||!focused||!atEnd||state.composing||!summaryCard.hidden||!$('intent-popover').hidden||!help.hidden;
  accept.setAttribute('aria-label','Accept suggestion: '+next.trim());ghostText.textContent=next;ghostText.hidden=ghost.hidden;
  document.querySelector('.input-mirror-layer').style.height=input.clientHeight+'px';const mirror=$('input-mirror');if(!mirror.contains(ghostText))mirror.append(ghostText);
  // The prediction lives inside the field, after the caret. One that would not fit in the field
  // is not shown at all (Tab hint included, so Tab never inserts unseen text): no box below it.
  if(!ghost.hidden&&mirror.scrollHeight>input.scrollTop+input.clientHeight+1){ghost.hidden=true;ghostText.hidden=true;}
  trigger.hidden=false;trigger.style.visibility=summary?'visible':'hidden';
  // A decided format is listed under What I understand; the question row only ever holds an open question.
  if(question?.slideOptions&&state.slideDecided)question=null;
  questionRow.hidden=!question;questionButton.disabled=!!question?.streaming;
  questionButton.textContent=question?.question||'';questionButton.setAttribute('aria-label',(question?.slideOptions?'Slide format: ':question?.questionKind==='explore'?'Explore further: ':'Clarifying question: ')+(question?.question||''));questionButton.setAttribute('aria-expanded',String(!questionRow.hidden&&!$('intent-popover').hidden&&state.openClarification?.question===question?.question));questionButton.setAttribute('aria-controls','intent-popover');
 }
 new ResizeObserver(render).observe(input);
 document.addEventListener('focusin',render);document.addEventListener('focusout',()=>setTimeout(()=>{if(!composer.contains(document.activeElement)&&!summaryCard.contains(document.activeElement)&&!$('intent-popover').contains(document.activeElement))closeSummary();render();},0));input.addEventListener('keyup',render);input.addEventListener('click',render);input.addEventListener('select',render);input.addEventListener('scroll',render);input.addEventListener('compositionstart',render);input.addEventListener('compositionend',render);
 new MutationObserver(()=>{if(!$('intent-popover').hidden)closeSummary();render();}).observe($('intent-popover'),{attributes:true,attributeFilter:['hidden']});
 function acceptSentence(){const input=$('intent-input'),next=suggestion();if(!canAcceptCompletion({text:input.value,start:input.selectionStart,end:input.selectionEnd,completion:next,composing:state.composing}))return;input.value+=next;completion='';input.focus();input.setSelectionRange(input.value.length,input.value.length);changed();}
 accept.onclick=()=>{const input=$('intent-input');input.setSelectionRange(input.value.length,input.value.length);acceptSentence();};
 $('intent-input').addEventListener('keydown',event=>{const input=event.currentTarget;if(event.key==='Escape'){completion='';render();}if(event.key==='Tab'&&!ghost.hidden&&canAcceptCompletion({text:input.value,start:input.selectionStart,end:input.selectionEnd,completion:suggestion(),composing:state.composing||event.isComposing,modified:event.shiftKey||event.metaKey||event.ctrlKey||event.altKey})){event.preventDefault();acceptSentence();}});
 async function explainSelected(text){
  if(!state.live||!text||text===lastSelection)return;helpController?.abort();const controller=helpController=new AbortController(),version=++selectionVersion;lastSelection=text;help.hidden=false;document.body.classList.add('has-local-help');helpLabel.textContent='About “'+text.slice(0,65)+'”';helpText.textContent='…';
  try{const result=await request({text,audience:state.audience,format:'Auto',phase:'selection'},controller.signal);if(version!==selectionVersion||controller.signal.aborted)return;helpText.textContent=result.preview.body.join('\n\n');}catch(error){if(error.name!=='AbortError'&&version===selectionVersion)helpText.textContent=error.message;}
 }
 function inspectSelection(){const active=document.activeElement;let text='';if(active instanceof HTMLTextAreaElement||active instanceof HTMLInputElement){if(!active.closest('.intent-panel')||active.type==='password')return;text=active.value.slice(active.selectionStart,active.selectionEnd).trim();}else{const selection=window.getSelection();const parent=selection?.anchorNode?.parentElement;if(parent?.closest('.intent-panel'))text=selection.toString().trim();}
  clearTimeout(selectionTimer);if(text.length<2||text.length>1000){if(!help.contains(document.activeElement)&&!help.hidden){stopHelp();render();}return;}selectionTimer=setTimeout(()=>explainSelected(text),450);
 }
 document.addEventListener('selectionchange',inspectSelection);$('intent-input').addEventListener('select',inspectSelection);

 window.addEventListener('pagehide',stopHelp);
 return {
  onMirrorRendered:render,
  onStream(partial){
   // The Tab prediction is shown as soon as it is complete, before the rest of the answer.
   const predicted=!partial.reset&&freshCompletion(input.value,partial.completion);
   if(predicted&&predicted!==completion){completion=predicted;completionBase=input.value;}
   if(partial.reset)question=completedQuestion&&{...completedQuestion,streaming:true};
   else if(!completedQuestion&&partial.question)question={question:partial.question,options:[],phrase:null,streaming:true};
   render();
  },
  onPreview(data,{fresh=false,keepQuestion}={}){
   // A new prediction replaces the old one; an interim refresh (no prediction) keeps one the user
   // is still typing along.
   const predicted=freshCompletion(input.value,data.completion);
   if(predicted){completion=predicted;completionBase=input.value;}
   else if(!(keepQuestion&&suggestion()))completion='';
   summary=state.intentOverride||data.interpretation||'';
   const previous=question?.question;
   const next=state.answers.some(e=>e.question===state.uncertainty?.question)?null:state.uncertainty;
   if(next)question=completedQuestion=next;
   else if(completedQuestion&&keepQuestion?.(completedQuestion))question={...completedQuestion,streaming:true};
   else question=completedQuestion=null;
   render();
   if(fresh&&next&&next.question!==previous&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    questionButton.animate([{backgroundColor:'#ececec'},{backgroundColor:'transparent'}],{duration:480,easing:'ease-out'});
   }
  },
  onDraftChanged(keep){if(!keep||!suggestion())completion='';summary=state.intentOverride||'';if(!keep)completedQuestion=null;question=completedQuestion&&{...completedQuestion,streaming:true};stopHelp();closeSummary();render();},
  onPageRendered(){stopHelp();render();},
  stop(){stopHelp();completion='';summary='';question=completedQuestion=null;closeSummary();render();}
 };
}
