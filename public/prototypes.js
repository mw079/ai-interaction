import {PROTOTYPES,canAcceptCompletion,currentTarget} from './prototype-model.js';
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function setupPrototypeLab({state,changed,request,snapshot,renderActive}){
 let current='focus',preferred='',completion='',outline=[],helpController=null,editTimer=null,selectionTimer=null,editVersion=0,selectionVersion=0,pending=null,lastSelection='',lastField=null;
 try{current=localStorage.getItem('ai-interaction-prototype')||current;preferred=localStorage.getItem('ai-interaction-preferred-prototype')||'';}catch{}
 if(!PROTOTYPES.some(p=>p.id===current))current='focus';
 const bar=make('aside','prototype-bar');bar.setAttribute('aria-label','Compare five interaction designs');
 const brand=make('span','prototype-brand','AI Interaction');
 const label=make('label','prototype-select-label','Design');const select=make('select');select.id='prototype-select';select.setAttribute('aria-label','Interaction design');
 PROTOTYPES.forEach(p=>{const o=make('option','',p.name);o.value=p.id;select.append(o);});select.value=current;label.append(select);
 const choose=make('button','prototype-choose','Choose this design');choose.type='button';
 const caption=make('p','prototype-caption');caption.id='prototype-caption';
 bar.append(brand,label,choose);document.body.prepend(bar);document.querySelector('main').prepend(caption);
 const ghost=make('div','completion-line');ghost.id='completion-line';ghost.hidden=true;
 const ghostText=make('span','completion-text');const accept=make('button','completion-accept','Tab ↹');accept.type='button';accept.setAttribute('aria-label','Accept suggested sentence');ghost.append(ghostText,accept);document.querySelector('.composer').insertBefore(ghost,document.querySelector('.composer-bottom'));
 const liveOutline=make('div','live-outline');liveOutline.id='live-outline';liveOutline.hidden=true;liveOutline.setAttribute('aria-label','Proposed answer structure');$('typing-assistance').append(liveOutline);
 const help=make('section','local-assistance');help.id='local-assistance';help.hidden=true;help.setAttribute('aria-label','Help with selected text');
 const helpHead=make('div','local-help-heading');const helpLabel=make('span','','Selected text');const dismiss=make('button','','Close');dismiss.type='button';dismiss.setAttribute('aria-label','Close local help');helpHead.append(helpLabel,dismiss);
 const helpText=make('p');helpText.setAttribute('role','status');const proposed=make('p','local-replacement');proposed.hidden=true;
 const apply=make('button','primary-button','Apply this change');apply.type='button';apply.hidden=true;help.append(helpHead,helpText,proposed,apply);document.body.append(help);
 const viewBar=make('div','page-view-tools');viewBar.hidden=true;
 const read=make('button','','Read');const explore=make('button','','Explore');read.type=explore.type='button';read.setAttribute('aria-pressed','false');explore.setAttribute('aria-pressed','true');
 const readOnlyState=new Map();
 function setReading(on){document.body.classList.toggle('page-reading',on);for(const field of document.querySelectorAll('#active-component textarea,#active-component input')){if(on){if(!readOnlyState.has(field))readOnlyState.set(field,field.readOnly);field.readOnly=true;}else if(readOnlyState.has(field)){field.readOnly=readOnlyState.get(field);readOnlyState.delete(field);}}}
 read.onclick=()=>{setReading(true);read.setAttribute('aria-pressed','true');explore.setAttribute('aria-pressed','false');};explore.onclick=()=>{setReading(false);read.setAttribute('aria-pressed','false');explore.setAttribute('aria-pressed','true');};
 const undo=make('button','','Undo latest page change');undo.type='button';undo.onclick=()=>{const previous=state.history[0];if(!previous)return;const copy=structuredClone(previous);snapshot('Before undo');$('document-title').value=copy.title;$('document-input').value=copy.text;state.component=copy.component;state.blocks=copy.blocks;state.proposal=null;state.pageVersion++;renderActive();$('proposal').hidden=true;document.dispatchEvent(new CustomEvent('prototype:render-blocks'));};
 viewBar.append(read,explore,undo);document.querySelector('.document-toolbar').after(viewBar);
 function stopHelp(){clearTimeout(editTimer);clearTimeout(selectionTimer);helpController?.abort();helpController=null;editVersion++;selectionVersion++;pending=null;lastField=null;lastSelection='';help.hidden=true;document.body.classList.remove('has-local-help');apply.hidden=true;proposed.hidden=true;}
 dismiss.onclick=stopHelp;document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!help.hidden)stopHelp();});
 function render(){document.body.dataset.prototype=current;document.body.classList.toggle('has-completion',current==='complete'&&!!completion);caption.textContent=PROTOTYPES.find(p=>p.id===current).hint;choose.textContent=preferred===current?'Chosen design ✓':'Choose this design';choose.setAttribute('aria-pressed',String(preferred===current));ghost.hidden=current!=='complete'||!completion;ghostText.textContent=completion;liveOutline.hidden=current!=='canvas'||!outline.length;liveOutline.replaceChildren();outline.forEach((text,i)=>{const item=make('div','outline-tile');item.append(make('span','tile-index',String(i+1).padStart(2,'0')),make('span','',text));liveOutline.append(item);});viewBar.hidden=!state.component||!['canvas','notebook'].includes(current);undo.disabled=!state.history.length;}
 select.onchange=()=>{stopHelp();completion='';outline=[];current=select.value;setReading(false);try{localStorage.setItem('ai-interaction-prototype',current);}catch{}render();changed();};
 choose.onclick=()=>{preferred=preferred===current?'':current;try{if(preferred)localStorage.setItem('ai-interaction-preferred-prototype',preferred);else localStorage.removeItem('ai-interaction-preferred-prototype');}catch{}render();};
 function acceptSentence(){const input=$('intent-input');if(!canAcceptCompletion({text:input.value,start:input.selectionStart,end:input.selectionEnd,completion,composing:state.composing}))return;input.value=input.value.trimEnd()+' '+completion;completion='';input.focus();input.setSelectionRange(input.value.length,input.value.length);changed();}
 accept.onclick=()=>{const input=$('intent-input');input.setSelectionRange(input.value.length,input.value.length);acceptSentence();};
 $('intent-input').addEventListener('keydown',event=>{if(current!=='complete')return;const input=event.currentTarget;if(event.key==='Escape'){completion='';render();}if(event.key==='Tab'&&canAcceptCompletion({text:input.value,start:input.selectionStart,end:input.selectionEnd,completion,composing:state.composing||event.isComposing,modified:event.shiftKey||event.metaKey||event.ctrlKey||event.altKey})){event.preventDefault();acceptSentence();}});
 async function explainSelected(text){
  if(!state.live||!text||text===lastSelection)return;helpController?.abort();const controller=helpController=new AbortController(),version=++selectionVersion;lastSelection=text;pending=null;help.hidden=false;document.body.classList.add('has-local-help');helpLabel.textContent='About “'+text.slice(0,65)+'”';helpText.textContent='…';apply.hidden=true;proposed.hidden=true;
  try{const result=await request({text,audience:state.audience,format:'Auto',phase:'selection'},controller.signal);if(version!==selectionVersion||controller.signal.aborted||current!=='lens')return;helpText.textContent=result.preview.body.join('\n\n');}catch(error){if(error.name!=='AbortError'&&version===selectionVersion)helpText.textContent=error.message;}
 }
 function inspectSelection(){if(current!=='lens')return;const active=document.activeElement;let text='';if(active instanceof HTMLTextAreaElement||active instanceof HTMLInputElement){if(!active.closest('.intent-panel,.paper')||active.type==='password')return;text=active.value.slice(active.selectionStart,active.selectionEnd).trim();}else{const selection=window.getSelection();const parent=selection?.anchorNode?.parentElement;if(parent?.closest('.paper'))text=selection.toString().trim();}
  clearTimeout(selectionTimer);if(text.length<2||text.length>1000)return;selectionTimer=setTimeout(()=>explainSelected(text),450);
 }
 document.addEventListener('selectionchange',inspectSelection);$('intent-input').addEventListener('select',inspectSelection);document.querySelector('.paper').addEventListener('select',inspectSelection,true);
 document.querySelector('.paper').addEventListener('input',event=>{
  if(current!=='notebook'||!state.live||!state.component)return;const target=event.target;if(!(target instanceof HTMLTextAreaElement||target instanceof HTMLInputElement)||!target.closest('#active-component')||['range','checkbox','number'].includes(target.type))return;
  clearTimeout(editTimer);helpController?.abort();const id=++editVersion;pending=null;lastField=target;help.hidden=true;
  const before=target.value;if(before.trim().length<12||before.length>1800)return;
  editTimer=setTimeout(async()=>{const controller=helpController=new AbortController();const version=state.pageVersion;help.hidden=false;document.body.classList.add('has-local-help');helpLabel.textContent='Suggestion for this passage';helpText.textContent='…';apply.hidden=true;proposed.hidden=true;
   try{const result=await request({text:before,audience:state.audience,format:'Auto',phase:'edit'},controller.signal);if(id!==editVersion||controller.signal.aborted||current!=='notebook'||!currentTarget({requestVersion:version,currentVersion:state.pageVersion,before,current:target.value,connected:target.isConnected}))return;
    helpText.textContent=result.preview.body.join('\n\n');const replacement=result.preview.replacement||'';if(replacement&&replacement!==before){pending={target,before,replacement,version};proposed.textContent=replacement;proposed.hidden=false;apply.hidden=false;}
   }catch(error){if(error.name!=='AbortError'&&id===editVersion)helpText.textContent=error.message;}
  },1300);
 });
 apply.onclick=()=>{const patch=pending;if(!patch||!currentTarget({requestVersion:patch.version,currentVersion:state.pageVersion,before:patch.before,current:patch.target.value,connected:patch.target.isConnected}))return;
  snapshot('Before inline suggestion');patch.target.value=patch.replacement;pending=null;const mode=current;current='applying';patch.target.dispatchEvent(new Event('input',{bubbles:true}));current=mode;stopHelp();render();};
 window.addEventListener('pagehide',stopHelp);
 return {interaction:()=>current,onPreview(data){completion=current==='complete'?(data.completion||''):'';outline=current==='canvas'?(data.outline||[]):[];render();},onDraftChanged(){completion='';outline=[];if(current==='lens')stopHelp();render();},onPageRendered(){stopHelp();render();queueMicrotask(()=>{if(document.body.classList.contains('page-reading'))setReading(true);});},stop:stopHelp};
}
