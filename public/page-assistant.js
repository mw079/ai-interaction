import {explicitPageRewrite,patchIsCurrent,textDifference} from './page-patch.js';
import {validComponents} from './component-catalog.js';
import {renderCatalogBlock} from './component-renderer.js';

const node=(tag,cls,text)=>{
 const element=document.createElement(tag);
 if(cls)element.className=cls;
 if(text!==undefined)element.textContent=text;
 return element;
};

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

 const editable=element=>element?.matches?.('textarea[data-page-field]')&&element.closest('#active-component');
 const blockFor=element=>{
  const section=element?.closest?.('[data-component-id]');
  return state.component?.components?.find(block=>block.id===section?.dataset.componentId);
 };
 const textTarget=(field,quote)=>({
  anchor:field,field,original:field.value,
  target:{id:field.dataset.pageField,text:field.value,...(quote?{quote}: {})}
 });
 function blockTarget(anchor,block,quote,practice){
  const original=block?JSON.stringify(block):anchor.textContent.trim();
  return {
   anchor,block,original,target:{
    id:block?'component:'+block.id:'selection',
    text:original.slice(0,2500),
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
   const anchor=from?.closest('.catalog-block,.atlas-law-detail,.atlas-equation');
   const quote=range?.toString().trim().slice(0,600);
   if(quote&&anchor?.contains(to)&&anchor.closest('#active-component')&&!anchor.closest('.page-assistant')){
    part=blockTarget(anchor,blockFor(anchor),quote);
   }
  }
  if(!part){
   if(active?.mode==='selection'&&!output)close();
   return;
  }
  const {anchor,target}=part;
  if(selection?.anchor===anchor&&selection.quote===target.quote&&selection.version===state.pageVersion)return;
  selection={anchor,quote:target.quote,version:state.pageVersion};
  schedule(part,'selection',target.quote,450);
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
  const instruction=explicitPageRewrite(difference);
  if(instruction){
   part.target.mode='question';
   schedule(part,'edit',instruction.slice(0,1000),700);
   return;
  }
  part.target.added=difference.added.slice(0,1000);
  part.target.removed=difference.removed.slice(0,1000);
  schedule(part,'edit',(difference.added.trim()||difference.removed.trim()).slice(0,1000),700);
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
   controller=new AbortController();
   const {signal}=controller;
   try{
    const {preview}=await request({text:instruction,target,audience:state.audience,format:'Auto',phase:'page-help'},signal);
    if(signal.aborted||id!==sequence||version!==state.pageVersion||!part.anchor.isConnected)return;
    const answer=preview.body.join(' ');
    const replacement=part.field&&preview.replacement!==part.original&&preview.replacement?.length<=part.field.maxLength?preview.replacement:'';
    const components=preview.components||[];
    if(mode==='edit')baselines.set(part.field,part.original);
    if(!answer&&!replacement&&!components.length)return;
    render(part,answer,{version,replacement,components});
   }catch(error){
    if(error.name!=='AbortError'&&id===sequence&&version===state.pageVersion)render(part,error.message);
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

 function render(part,answer,change){
  const wrapper=part.anchor.closest('.page-field,.catalog-block');
  output=node('div','page-assistant');
  if(wrapper)wrapper.append(output);
  else part.anchor.after(output);
  const replacement=change?.replacement;
  const hasProposal=!!(replacement||change?.components.length);
  if(answer){
   const response=node('p','page-response',answer);
   response.setAttribute('role','status');
   response.setAttribute('aria-label','Answer');
   output.append(response);
  }
  if(!hasProposal)return;

  if(answer){
   const offer=node('button','page-reject','Review edit');
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
    change.components.forEach(block=>renderCatalogBlock(preview,block,temp,{onEdit(){},ask(){}}));
    output.append(preview);
   }
   const actions=node('div','page-review-actions');
   const apply=node('button','page-apply','Apply'),reject=node('button','page-reject','Reject');
   apply.type=reject.type='button';actions.append(apply,reject);output.append(actions);
   reject.onclick=()=>{
    close();
    if(answer)render(part,answer);
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
    if(!validComponents(components)){close();render(part,'This suggestion exceeds the slide’s two-component limit.');return;}
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
