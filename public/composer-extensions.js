import {worldMap} from './maps.js';

const node=(tag,text,className)=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=text;
  if(className)element.className=className;
  return element;
};
function button(text,action){
  const element=node('button',text,'picker-option');
  element.type='button';
  element.onclick=action;
  return element;
}
function field(label,type='text',value=''){
  const wrapper=node('label',label,'picker-field');
  const input=node('input');
  input.type=type;
  input.value=value;
  input.maxLength=160;
  wrapper.append(input);
  return {wrapper,input};
}
function submit(form,read,choose,label='Use this'){
  const element=node('button',label,'picker-apply');
  element.type='submit';
  form.append(element);
  form.onsubmit=event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const value=read();
    if(value!==null&&value!=='')choose(value);
  };
}

export function renderComposerExtension(target,family,item,choose,onResize){
  const options=item.options||[];
  const form=node('form',undefined,'picker-form composer-extension');
  if(family==='flexible_dates'){
    const mode=node('select');
    mode.setAttribute('aria-label','Date preference');
    [['flexible','Flexible window'],['exact','Exact dates'],['any','No date preference']].forEach(([id,label])=>{
      const option=node('option',label);
      option.value=id;mode.append(option);
    });
    const windowField=field('When could it happen?','text',item.value?.startsWith('Flexible: ')?item.value.slice(10):'');
    windowField.input.placeholder='Any weekend in June';
    const dates=item.value?.match(/\d{4}-\d{2}-\d{2}/g)||[];
    const start=field('Start date','date',dates[0]||'');
    const end=field('End date (optional)','date',dates[1]||'');
    const update=()=>{
      const exact=mode.value==='exact',flexible=mode.value==='flexible';
      start.wrapper.hidden=end.wrapper.hidden=!exact;
      windowField.wrapper.hidden=!flexible;
      start.input.required=exact;
      windowField.input.required=flexible;
      end.input.min=start.input.value;
      onResize();
    };
    mode.value=dates.length?'exact':item.value==='No date preference'?'any':'flexible';
    mode.onchange=start.input.oninput=update;
    form.append(mode,windowField.wrapper,start.wrapper,end.wrapper);
    submit(form,()=>mode.value==='exact'?start.input.value+(end.input.value?' to '+end.input.value:''):mode.value==='flexible'?'Flexible: '+windowField.input.value.trim():'No date preference',choose);
    target.append(form);update();
    return true;
  }
  if(family==='area_map'){
    const area=field('Place or coordinates','text',item.value);
    area.input.placeholder='Neighbourhood or city';
    area.input.required=true;
    const map=node('div');
    const draw=(points=[])=>map.replaceChildren(worldMap({
      label:'World map. You can also type a place or coordinates below.',
      points,selected:0,onPick(latitude,longitude){
        area.input.value=latitude.toFixed(2)+', '+longitude.toFixed(2);
        draw([{latitude,longitude}]);
      }
    }));
    draw();
    const optionsRow=node('div',undefined,'picker-presets');
    options.forEach(name=>optionsRow.append(button(name,()=>{area.input.value=name;draw();})));
    form.append(map,optionsRow,area.wrapper);
    submit(form,()=>area.input.value.trim(),choose);
    target.append(form);
    return true;
  }
  if(family==='audience_knowledge'){
    const saved=(item.value||'').match(/^Audience: (.*?) · Prior knowledge: (.*)$/);
    const audience=field('Who is this for?','text',saved?.[1]||'');
    const knowledge=field('What do they already know?','text',saved?.[2]||'');
    audience.input.required=true;knowledge.input.required=true;
    audience.input.maxLength=100;knowledge.input.maxLength=120;
    knowledge.input.placeholder='New to the topic';
    const row=node('div',undefined,'picker-presets');
    options.forEach(label=>row.append(button(label,()=>{audience.input.value=label;knowledge.input.focus();})));
    form.append(row,audience.wrapper,knowledge.wrapper);
    submit(form,()=>'Audience: '+audience.input.value.trim()+' · Prior knowledge: '+knowledge.input.value.trim(),choose);
    target.append(form);
    return true;
  }
  if(family==='include_exclude'){
    const configured=new Map((item.value||'').split(' · ').flatMap(part=>{
      const [mode,labels]=part.split(': ');
      return (labels||'').split('; ').map(label=>[label,mode]);
    }));
    const inputs=options.map(label=>{
      const row=node('label',label,'composer-choice-row');
      const select=node('select');
      ['Undecided','Include','Exclude'].forEach(value=>select.append(node('option',value)));
      select.value=configured.get(label)||'Undecided';
      row.append(select);form.append(row);return [label,select];
    });
    submit(form,()=>['Include','Exclude'].map(mode=>{
      const labels=inputs.filter(([,select])=>select.value===mode).map(([label])=>label);
      return labels.length?mode+': '+labels.join('; '):'';
    }).filter(Boolean).join(' · '),choose);
    target.append(form);
    return true;
  }
  if(family==='assumption'){
    const assumption=options[0]||item.phrase;
    const correction=field('Correction','text',item.value&&item.value!==assumption?item.value:'');
    correction.input.placeholder='What should we assume instead?';
    correction.input.required=true;
    target.append(node('p',assumption,'picker-tone-sample'),button('Confirm assumption',()=>choose(assumption)));
    form.append(correction.wrapper);
    submit(form,()=>correction.input.value.trim(),choose,'Use correction');
    target.append(form);
    return true;
  }
  if(['goal_comparison','example','tradeoff'].includes(family)&&options.length){
    let selected=Math.max(0,options.indexOf(item.value));
    const list=node('div',undefined,'picker-choices');
    const preview=node('div',undefined,'picker-tone-sample');
    preview.setAttribute('aria-live','polite');
    const controls=options.map((label,index)=>button(label,()=>{
      selected=index;paint();
    }));
    const paint=()=>{
      controls.forEach((control,index)=>control.setAttribute('aria-pressed',String(index===selected)));
      const sample=item.samples?.[selected]||'';
      if(family==='tradeoff'&&sample.includes(' | ')){
        preview.classList.add('picker-tradeoff');
        preview.replaceChildren(...sample.split(' | ').slice(0,2).map(value=>node('span',value)));
      }else{
        preview.classList.remove('picker-tradeoff');
        preview.textContent=sample;
      }
      preview.hidden=!sample;
      onResize();
    };
    list.append(...controls);form.append(list,preview);
    submit(form,()=>options[selected],choose);
    target.append(form);paint();
    return true;
  }
  return false;
}

export function renderFollowUpScope(target,scopes,active,choose){
  target.replaceChildren();
  const list=node('div',undefined,'picker-choices');
  for(const scope of scopes){
    const control=button(scope.label,()=>choose(scope));
    control.setAttribute('aria-pressed',String(scope.id===active?.id));
    const preview=scope.preview??scope.text;
    if(preview)control.append(node('span',preview.slice(0,90),'picker-scope-preview'));
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
    scopes.push({id:'block:'+block.id,label:block.title,text:JSON.stringify(block),preview:block.prompt||''});
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
