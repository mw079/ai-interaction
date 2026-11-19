import {areaMap} from '../components/maps.js';
import {entry} from './control-kit.js';
import {blockContextText} from './request-context.js';

const node=(tag,text,className)=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=text;
  if(className)element.className=className;
  return element;
};
function button(text,action){
  const element=node('button',text,'control-option');
  element.type='button';
  element.onclick=action;
  return element;
}

// Segmented switch shared by composer controls: value lives on `state.value`.
function segmented(label,choices,state,onChange){
  const element=node('div',undefined,'control-segmented');
  element.setAttribute('role','radiogroup');
  element.setAttribute('aria-label',label);
  const buttons=choices.map(([id,text])=>{
    const b=node('button',text,'control-seg');
    b.type='button';
    b.setAttribute('role','radio');
    b.onclick=()=>{state.value=id;onChange();};
    element.append(b);
    return [id,b];
  });
  const paint=()=>buttons.forEach(([id,b])=>b.setAttribute('aria-checked',String(state.value===id)));
  return {element,paint};
}

// Newer control families. Like controls.js, choosing is committing: no "Use this" step.
// `choose(value, {keepOpen})` writes the value into the draft; keepOpen leaves the picker open.
export function renderComposerExtension(target,family,item,choose,onResize){
  const options=item.options||[];
  const saved=item.confirmed?item.value||'':'';
  const live=value=>choose(value,{keepOpen:true});
  if(family==='flexible_dates'){
    const dates=saved.match(/\d{4}-\d{2}-\d{2}/g)||[];
    const mode={value:dates.length?'exact':saved==='No date preference'?'any':'flexible'};
    const windowField=entry('When could it happen?',{value:saved.startsWith('Flexible: ')?saved.slice(10):'',placeholder:'Any weekend in June',onCommit:v=>choose('Flexible: '+v)});
    const row=node('div',undefined,'control-date-row');
    const date=(label,value)=>{const l=node('label',undefined,'control-entry');l.append(node('span',label,'control-entry-label'));const i=node('input');i.type='date';i.value=value;l.append(i);row.append(l);return i;};
    const start=date('Start',dates[0]||''),end=date('End (optional)',dates[1]||'');
    const applyDates=()=>{end.min=start.value;if(start.value)live(start.value+(end.value&&end.value>=start.value?' to '+end.value:''));};
    start.onchange=end.onchange=applyDates;
    const seg=segmented('Date preference',[['flexible','Flexible'],['exact','Exact dates'],['any','No preference']],mode,()=>{
      update();
      if(mode.value==='any')choose('No date preference');
      else (mode.value==='exact'?start:windowField.input).focus();
    });
    function update(){windowField.element.hidden=mode.value!=='flexible';row.hidden=mode.value!=='exact';seg.paint();onResize();}
    target.append(seg.element,windowField.element,row);update();
    return true;
  }
  if(family==='area_map'){
    const area=entry('Place or coordinates',{value:saved,placeholder:'Neighbourhood or city',onCommit:v=>choose(v)});
    const map=node('div');
    const draw=point=>map.replaceChildren(areaMap({
      label:'World map. Select a place, or type a place or coordinates below.',point,
      onPick(latitude,longitude){
        const value=latitude.toFixed(2)+', '+longitude.toFixed(2);
        area.input.value=value;area.input.dispatchEvent(new Event('input'));
        draw({latitude,longitude});live(value);
      }
    }));
    draw();
    const presets=node('div',undefined,'control-presets');
    options.forEach(name=>presets.append(button(name,()=>choose(name))));
    target.append(map,presets,area.element);
    return true;
  }
  if(family==='audience_knowledge'){
    // Pick who it is for in one click; optionally add what they know (Enter applies both).
    const parsed=saved.match(/^Audience: (.*?)(?: · Prior knowledge: (.*))?$/);
    const state={audience:parsed?.[1]||'',knowledge:parsed?.[2]||''};
    const value=()=>'Audience: '+state.audience+(state.knowledge?' · Prior knowledge: '+state.knowledge:'');
    const row=node('div',undefined,'control-presets');
    const chips=options.map(label=>{const b=button(label,()=>{state.audience=label;paint();live(value());knowledge.input.focus();});row.append(b);return [label,b];});
    const own=entry('Someone else',{placeholder:'Who is this for?',maxLength:100,onCommit:v=>{state.audience=v;paint();live(value());knowledge.input.focus();}});
    const knowledge=entry('What do they already know? (optional)',{value:state.knowledge,placeholder:'New to the topic',maxLength:120,
      validate:()=>state.audience?'':'Choose who it is for first.',onCommit:v=>{state.knowledge=v;choose(value());}});
    function paint(){chips.forEach(([label,b])=>b.setAttribute('aria-pressed',String(state.audience===label)));}
    target.append(row,own.element,knowledge.element);paint();
    return true;
  }
  if(family==='include_exclude'){
    // Each switch applies live; the picker stays open while topics are sorted.
    const configured=new Map(saved.split(' · ').flatMap(part=>{
      const [mode,labels]=part.split(': ');
      return (labels||'').split('; ').map(label=>[label,mode]);
    }));
    const value=()=>['Include','Exclude'].map(mode=>{
      const labels=inputs.filter(([,state])=>state.value===mode).map(([label])=>label);
      return labels.length?mode+': '+labels.join('; '):'';
    }).filter(Boolean).join(' · ');
    const inputs=options.map(label=>{
      const row=node('div',undefined,'composer-choice-row');
      const state={value:configured.get(label)||'Undecided'};
      const seg=segmented(label,[['Include','Include'],['Undecided','Maybe'],['Exclude','Leave out']],state,()=>{seg.paint();live(value());});
      row.append(node('span',label),seg.element);target.append(row);seg.paint();return [label,state];
    });
    return true;
  }
  if(family==='assumption'){
    const assumption=options[0]||item.phrase;
    const confirm=node('button','Yes, that’s right','control-apply');confirm.type='button';confirm.onclick=()=>choose(assumption);
    const correction=entry('Or correct it',{value:saved&&saved!==assumption?saved:'',placeholder:'What should we assume instead?',onCommit:v=>choose(v)});
    target.append(node('p',assumption,'control-tone-sample'),confirm,correction.element);
    return true;
  }
  if(['goal_comparison','example','tradeoff'].includes(family)&&options.length){
    // Rows apply on click; hovering or focusing a row previews what it would mean.
    const list=node('div',undefined,'control-choices');
    const preview=node('div',undefined,'control-tone-sample');
    preview.setAttribute('aria-live','polite');
    const show=index=>{
      const sample=item.samples?.[index]||'';
      if(family==='tradeoff'&&sample.includes(' | ')){
        preview.classList.add('control-tradeoff');
        preview.replaceChildren(...sample.split(' | ').slice(0,2).map(value=>node('span',value)));
      }else{preview.classList.remove('control-tradeoff');preview.textContent=sample;}
      preview.hidden=!sample;onResize();
    };
    options.forEach((label,index)=>{
      const b=button(label,()=>{const clear=b.getAttribute('aria-pressed')==='true';list.querySelectorAll('.control-option').forEach(o=>o.setAttribute('aria-pressed',String(!clear&&o===b)));choose(clear?'':label);});
      b.setAttribute('aria-pressed',String(saved===label));
      for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>show(index));
      list.append(b);
    });
    target.append(list,preview);show(Math.max(0,options.indexOf(saved)));
    return true;
  }
  return false;
}

export function renderFollowUpScope(target,scopes,active,choose){
  target.replaceChildren();
  target.append(node('p','Only the selected part will change on Send.','control-hint'));
  const list=node('div',undefined,'control-choices');
  for(const scope of scopes){
    const control=button(scope.label,()=>choose(scope));
    control.setAttribute('aria-pressed',String(scope.id===(active?.id||'whole')));
    const preview=scope.preview??scope.text;
    if(preview)control.append(node('span',preview.slice(0,90),'control-scope-preview'));
    list.append(control);
  }
  target.append(list);
}

export function followUpScopes(component,activeField,selection){
  const scopes=[{id:'whole',label:'Whole slide'}];
  if(!component)return scopes;
  component.body.forEach((text,index)=>{
    const value=index===0?component.edits?.explanation??text:component.edits?.paragraphs?.[index-1]??text;
    if(value.trim())scopes.push({id:'passage:'+index,label:index===0?'Introduction':'Paragraph '+(index+1),text:value});
  });
  if(activeField&&selection?.length&&selection.start<selection.end){
    const parent=scopes.find(scope=>scope.id===activeField);
    const excerpt=parent?.text.slice(selection.start,selection.end);
    if(excerpt?.trim())scopes.splice(1,0,{id:activeField+':selection',label:'Selected passage',text:excerpt,start:selection.start,end:selection.end});
  }
  for(const block of component.components||[]){
    scopes.push({id:'block:'+block.id,label:block.title,text:blockContextText(block,4500),preview:block.prompt||''});
  }
  return scopes;
}

export function applyFollowUpScope(base,result,scope){
  if(!scope||scope.id==='whole')return result;
  const copy=structuredClone(base);
  if(scope.id.startsWith('block:')){
    const id=scope.id.slice(6);
    const index=copy.components.findIndex(block=>block.id===id);
    const replacement=result.components?.find(block=>block.id===id);
    if(index<0||!replacement)throw new Error('No update was returned for the selected component.');
    copy.components[index]=replacement;
    delete copy.edits?.widgets?.[id];
  }else{
    const index=Number(scope.id.split(':')[1]);
    const replacement=result.body[0]?.trim();
    if(!replacement||index>=copy.body.length)throw new Error('No update was returned for the selected passage.');
    copy.edits??={};
    const original=index===0?copy.edits.explanation??copy.body[0]:copy.edits.paragraphs?.[index-1]??copy.body[index];
    const updated=scope.start!==undefined?original.slice(0,scope.start)+replacement+original.slice(scope.end):replacement;
    if(index===0)copy.edits.explanation=updated;
    else (copy.edits.paragraphs??={})[index-1]=updated;
  }
  return copy;
}
