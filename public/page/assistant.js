import {explicitPageQuestion,explicitPageRewrite,patchIsCurrent,textDifference} from './patch.js';
import {blockContextText} from '../composer/request-context.js';
import {validComponents} from '../components/catalog.js';
import {renderComponent} from '../components/renderer.js';

import {element as node} from '../shared/dom.js';

function answerContent(answer){
 const fragment=document.createDocumentFragment();
 let list;
 for(const line of answer.split('\n')){
  const text=line.trim();
  if(!text){list=null;continue;}
  const numbered=text.match(/^(\d+)[.)]\s+(.+)$/);
  const item=node(numbered?'li':'p');
  const value=numbered?numbered[2]:text;
  let cursor=0;
  for(const match of value.matchAll(/\*\*([^*]+)\*\*/g)){
   item.append(value.slice(cursor,match.index),node('strong','',match[1]));
   cursor=match.index+match[0].length;
  }
  item.append(value.slice(cursor).replace(/\*\*/g,''));
  if(numbered){
   if(!list){list=node('ol');list.start=Number(numbered[1]);fragment.append(list);}
   list.append(item);
  }else{list=null;fragment.append(item);}
 }
 return fragment;
}

const liveHelpDelay=250;

export function setupPageAssistant({state,request,commit}){
 const paper=document.querySelector('.paper');
 const baselines=new WeakMap();
 let output,inline,controller,timer,active,selection,committing=false;
 let sequence=0;

 function cancel(){
  clearTimeout(timer);controller?.abort();controller=null;sequence++;
 }
 function close(){
  cancel();
  inline?.parentElement?.classList.remove('has-inline-review');inline?.remove();inline=null;
  output?.remove();output=null;active=null;
 }

 document.addEventListener('page:render',()=>{selection=null;close();});
 document.addEventListener('page:edit',()=>{if(!committing)close();});
 document.addEventListener('page:undo-edit',event=>{close();baselines.set(event.detail,event.detail.value);});
 document.addEventListener('intent:changed',close);
 window.addEventListener('pagehide',close);

 const editable=element=>element?.matches?.('textarea[data-page-field]')&&element.closest('#active-component,.page-notes');
 const blockFor=element=>{
  const section=element?.closest?.('[data-component-id]');
  return state.component?.components?.find(block=>block.id===section?.dataset.componentId);
 };
 function textTarget(field,quote){
  const original=field.value;
  const start=Math.max(0,Math.min(field.selectionStart-1200,original.length-2500));
  return {anchor:field,field,original,target:{
   id:field.dataset.pageField,text:original.slice(start,start+2500),...(quote?{quote}:{})
  }};
 }
 function blockTarget(anchor,block,quote,practice){
  const original=block?JSON.stringify(block):anchor.textContent.trim();
  return {
   anchor,block,original,target:{
    id:block?'component:'+block.id:'selection',
    text:block?blockContextText(block,2500):original.slice(0,2500),
    ...(quote?{quote}:{}),
    ...(practice!==undefined?{practice:practice.slice(0,1500)}:{})
   }
  };
 }

 document.addEventListener('page:ask',event=>{
  const {anchor,block,practice}=event.detail;
  if(!committing&&practice?.trim())schedule(blockTarget(anchor,block,'',practice),'question','Give feedback on my explanation.',0);
 });

 function inspectSelection(){
  if(committing||!state.component)return;
  const field=document.activeElement;
  let part;
  if(editable(field)){
   const quote=field.value.slice(field.selectionStart,field.selectionEnd).trim().slice(0,600);
   if(quote)part=textTarget(field,quote);
  }else{
   const range=window.getSelection();
   const from=range?.anchorNode?.parentElement;
   const to=range?.focusNode?.parentElement;
   const anchor=from?.closest('.component-block,.atlas-law-detail,.atlas-equation');
   const quote=range?.toString().trim().slice(0,600);
   if(quote&&anchor?.contains(to)&&anchor.closest('#active-component')&&!anchor.closest('.page-assistant')){
    part=blockTarget(anchor,blockFor(anchor),quote);
   }
  }
  if(!part){
   // Clearing the highlight dismisses its explanation, unless the reader is selecting inside it.
   const inside=output&&window.getSelection()?.anchorNode&&output.contains(window.getSelection().anchorNode);
   if(active?.mode==='selection'&&!inside){close();selection=null;}
   return;
  }
  const {anchor,target}=part;
  if(selection?.anchor===anchor&&selection.quote===target.quote&&selection.version===state.pageVersion)return;
  selection={anchor,quote:target.quote,version:state.pageVersion};
  schedule(part,'selection',target.quote,liveHelpDelay);
 }
 document.addEventListener('selectionchange',inspectSelection);
 paper.addEventListener('select',inspectSelection,true);

 function remember(event){
  if(editable(event.target)&&!baselines.has(event.target))baselines.set(event.target,event.target.value);
 }
 paper.addEventListener('focusin',remember);
 paper.addEventListener('beforeinput',remember);
 paper.addEventListener('input',readEdit);
 paper.addEventListener('compositionend',readEdit);
 function readEdit(event){
  const field=event.target;
  if(!editable(field)||event.isComposing||committing||!state.component)return;
  selection=null;
  if(!baselines.has(field)){baselines.set(field,field.value);return;}
  const before=baselines.get(field);
  const difference=textDifference(before,field.value);
  if(!difference.added.trim()&&!difference.removed.trim())return;
  const part=textTarget(field);
  const rewrite=explicitPageRewrite(difference);
  const question=explicitPageQuestion(difference);
  const instruction=rewrite||question;
  if(instruction){
   part.target.mode=rewrite?'rewrite':'question';
   schedule(part,'edit',instruction.slice(0,1000),liveHelpDelay);
   return;
  }
  part.target.added=difference.added.slice(0,1000);
  part.target.removed=difference.removed.slice(0,1000);
  schedule(part,'edit',(difference.added.trim()||difference.removed.trim()).slice(0,1000),liveHelpDelay);
 }

 function schedule(part,mode,instruction,delay){
  close();
  active={part,mode};
  send(part,mode,instruction,delay);
 }

 function send(part,mode,instruction,delay){
  cancel();
  active={part,mode};
  if(!state.live)return;
  const id=sequence;
  const version=state.pageVersion;
  const target={mode,...part.target};
  timer=setTimeout(async()=>{
   const current=controller=new AbortController();
   const {signal}=current;
   const isCurrent=()=>!signal.aborted&&id===sequence&&version===state.pageVersion&&part.anchor.isConnected;
   const pendingTimer=target.mode==='rewrite'?setTimeout(()=>{
    if(isCurrent())showRewritePending(part);
   },300):undefined;
   try{
    const {preview}=await request({text:instruction,target,audience:state.audience,format:'Auto',phase:'page-help'},signal,partial=>{
     if(!isCurrent())return;
     if(partial.reset){
      output?.remove();output=null;
      if(target.mode==='rewrite')showRewritePending(part);
     }else if(partial.answer?.trim()){
      clearTimeout(pendingTimer);
      showAnswer(part,partial.answer,true);
     }
    });
    if(!isCurrent())return;
    const answer=preview.body.join(' ');
    const replacement=part.field&&part.target.text===part.original&&preview.replacement!==part.original&&preview.replacement?.length<=part.field.maxLength?preview.replacement:'';
    const components=preview.components||[];
    if(mode==='edit')baselines.set(part.field,part.original);
    if(!answer&&!replacement&&!components.length){output?.remove();output=null;return;}
    render(part,answer,{version,replacement,components});
   }catch(error){
    if(error.name!=='AbortError'&&isCurrent())render(part,error.message);
   }finally{
    clearTimeout(pendingTimer);
    if(controller===current){
     controller=null;
     if(!isCurrent())close();
    }
   }
  },delay);
 }

 // The editable field stays mounted so keyboard input can dismiss a proposal and keep typing.
 paper.addEventListener('beforeinput',event=>{
  if(inline&&event.target===active?.part.field)close();
 });
 paper.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&(output||inline)){
   event.preventDefault();
   const field=active?.part.field;
   close();field?.focus({preventScroll:true});
  }
 });

 function ensureOutput(part){
  if(output)return;
  const wrapper=part.anchor.closest('.page-field,.component-block');
  output=node('div','page-assistant');
  const dismiss=node('button','page-assistant-close','×');
  dismiss.type='button';
  dismiss.setAttribute('aria-label','Dismiss explanation');
  dismiss.title='Dismiss (Esc)';
  dismiss.tabIndex=-1;
  dismiss.onclick=()=>{const field=active?.part.field;close();selection=null;field?.focus({preventScroll:true});};
  output.append(dismiss);
  if(wrapper)wrapper.append(output);
  else part.anchor.after(output);
 }

 function showRewritePending(part){
  ensureOutput(part);
  if(output.querySelector('.page-assistant-status'))return;
  const pending=node('p','page-assistant-status','Preparing edit…');
  pending.setAttribute('role','status');
  output.append(pending);
 }

 function showAnswer(part,answer,streaming=false){
  ensureOutput(part);
  output.querySelector('.page-assistant-status')?.remove();
  let response=output.querySelector('.page-response');
  if(!answer){response?.remove();return;}
  if(!response){
   response=node('div','page-response');
   response.setAttribute('role','status');
   response.setAttribute('aria-label','Answer');
   output.append(response);
  }
  response.setAttribute('aria-live',streaming?'off':'polite');
  if(response.dataset.answer!==answer){response.dataset.answer=answer;response.replaceChildren(answerContent(answer));}
 }

 function render(part,answer,change){
  showAnswer(part,answer);
  const wrapper=part.anchor.closest('.page-field,.component-block');
  const replacement=change?.replacement;
  const hasProposal=!!(replacement||change?.components.length);
  if(!hasProposal)return;

  if(answer){
   const offer=node('button','page-reject page-offer','Review edit');
   offer.type='button';
   output.append(offer);
   offer.onclick=()=>{offer.remove();showProposal().focus();};
  }else showProposal();

  function showProposal(){
   if(replacement){
    inline=node('div',part.field.className+' inline-diff');
    inline.setAttribute('role','status');
    inline.setAttribute('aria-label','Proposed wording');
    const {prefix,removed,added,suffix}=textDifference(part.original,replacement);
    inline.append(document.createTextNode(prefix));
    // Keep small deletions visible. Large rewrites read cleanly in place.
    if(removed&&removed.length<=60&&(prefix||suffix))inline.append(node('del','',removed));
    if(added)inline.append(node('ins','',added));
    inline.append(document.createTextNode(suffix));
    if(answer)output.append(inline);
    else{
     wrapper.classList.add('has-inline-review');
     part.field.after(inline);
     inline.onpointerdown=event=>{
      event.preventDefault();
      close();part.field.focus({preventScroll:true});
     };
    }
   }
   if(change.components.length){
    const preview=node('div','component-proposals');
    const temp={edits:{}};
    change.components.forEach(block=>renderComponent(preview,block,temp,{onEdit(){},ask(){}}));
    output.append(preview);
   }
   const actions=node('div','page-review-actions');
   const apply=node('button','page-apply','Apply'),reject=node('button','page-reject','Reject');
   apply.type=reject.type='button';actions.append(apply,reject);output.append(actions);
   reject.onclick=()=>{
    close();
    if(answer)showAnswer(part,answer);
    if(part.field)baselines.set(part.field,part.field.value);
    part.field?.focus({preventScroll:true});
   };
   apply.onclick=()=>{
    const current=part.field?.value??(part.block
     ?JSON.stringify(state.component?.components?.find(block=>block.id===part.block.id))
     :part.anchor.textContent.trim());
    if(!patchIsCurrent({version:change.version,currentVersion:state.pageVersion,before:part.original,current,connected:part.anchor.isConnected})){
     close();return;
    }
    const merged=new Map((state.component.components||[]).map(block=>[block.id,block]));
    change.components.forEach(block=>merged.set(block.id,block));
    const components=[...merged.values()];
    if(!validComponents(components)){close();showAnswer(part,'This suggestion exceeds the slide’s two-component limit.');return;}
    committing=true;
    try{
     commit(()=>{
      if(change.replacement&&part.field){
       part.field.value=change.replacement;
       part.field.dispatchEvent(new Event('input',{bubbles:true}));
       baselines.set(part.field,part.field.value);
      }
      state.component.components=components;
     },part.target.id);
    }finally{committing=false;}
   };
   return apply;
  }
 }
}
