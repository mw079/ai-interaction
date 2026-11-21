import {areaMap} from '../components/maps.js';
import {entry,make,button as kitButton} from './control-kit.js';
// Choice buttons in these controls share the option style.
const button=(text,action)=>kitButton(text,action,'control-option');
import {blockContextText} from './request-context.js';

// Segmented switch shared by composer controls: value lives on `state.value`.
function segmented(label,choices,state,onChange){
  const element=make('div','control-segmented');
  element.setAttribute('role','radiogroup');
  element.setAttribute('aria-label',label);
  const buttons=choices.map(([id,text])=>{
    const b=make('button','control-seg',text);
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
    const row=make('div','control-date-row');
    const date=(label,value)=>{const l=make('label','control-entry');l.append(make('span','control-entry-label',label));const i=make('input');i.type='date';i.value=value;l.append(i);row.append(l);return i;};
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
    const map=make('div');
    const draw=point=>map.replaceChildren(areaMap({
      label:'World map. Select a place, or type a place or coordinates below.',point,
      onPick(latitude,longitude){
        const value=latitude.toFixed(2)+', '+longitude.toFixed(2);
        area.input.value=value;area.input.dispatchEvent(new Event('input'));
        draw({latitude,longitude});live(value);
      }
    }));
    draw();
    const presets=make('div','control-presets');
    options.forEach(name=>presets.append(button(name,()=>choose(name))));
    target.append(map,presets,area.element);
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
      const row=make('div','composer-choice-row');
      const state={value:configured.get(label)||'Undecided'};
      const seg=segmented(label,[['Include','Include'],['Undecided','Maybe'],['Exclude','Leave out']],state,()=>{seg.paint();live(value());});
      row.append(make('span',undefined,label),seg.element);target.append(row);seg.paint();return [label,state];
    });
    return true;
  }
  if(family==='assumption'){
    const assumption=options[0]||item.phrase;
    const confirm=make('button','control-apply','Yes, that’s right');confirm.type='button';confirm.onclick=()=>choose(assumption);
    const correction=entry('Or correct it',{value:saved&&saved!==assumption?saved:'',placeholder:'What should we assume instead?',onCommit:v=>choose(v)});
    target.append(make('p','control-tone-sample',assumption),confirm,correction.element);
    return true;
  }
  if(['goal_comparison','example'].includes(family)&&options.length){
    // Rows apply on click; hovering or focusing a row previews what it would mean.
    const list=make('div','control-choices');
    const preview=make('div','control-tone-sample');
    preview.setAttribute('aria-live','polite');
    const show=index=>{
      const sample=item.samples?.[index]||'';
      preview.textContent=sample;
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
  target.append(make('p','control-hint','Only the selected part will change on Send.'));
  const list=make('div','control-choices');
  for(const scope of scopes){
    const control=button(scope.label,()=>choose(scope));
    control.setAttribute('aria-pressed',String(scope.id===(active?.id||'whole')));
    const preview=scope.preview??scope.text;
    if(preview)control.append(make('span','control-scope-preview',preview.slice(0,90)));
    list.append(control);
  }
  target.append(list);
}

export function followUpScopes(component,activeField,selection){
  const scopes=[{id:'whole',label:'Whole page'}];
  if(!component)return scopes;
  component.body.forEach((text,index)=>{
    const value=index===0?component.edits?.explanation??text:component.edits?.paragraphs?.[index-1]??text;
    // A takeaway is listed by its own label ("Safety"), other passages by position.
    const named=index&&value.match(/^([^:\n]{1,32}):\s/)?.[1].trim();
    if(value.trim())scopes.push({id:'passage:'+index,label:index===0?'Introduction':named||'Paragraph '+(index+1),text:value});
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
