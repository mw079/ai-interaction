import {renderComposerExtension} from './composer-extensions.js';
import {INFORMATION_TYPES} from './intent.js';
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,action,cls='')=>{const b=make('button',cls,text);b.type='button';b.onclick=action;return b;};
// One renderer per family. Values and suggestions belong to the descriptor, never the template.
export function renderInformationControl(target,item,onChoose,onResize=()=>{}){
  target.replaceChildren();const {family}=INFORMATION_TYPES[item.type];target.dataset.family=family;
  const options=item.options||[];
  function option(value){const b=button(value,()=>onChoose(value),'picker-option');b.setAttribute('aria-pressed',String(item.value===value));return b;}
  function field(label,type='text',value=''){const l=make('label','picker-field',label);const f=make('input');f.type=type;f.value=value;f.maxLength=300;l.append(f);return {label:l,input:f};}
  function form(){const f=make('form','picker-form');target.append(f);return f;}
  function submit(f,getValue){const b=make('button','picker-apply','Use this');b.type='submit';f.append(b);f.onsubmit=e=>{e.preventDefault();if(!f.reportValidity())return;const v=getValue();if(v?.trim())onChoose(v);};}
  if(renderComposerExtension(target,family,item,onChoose,onResize)){
    if(item.confirmed)target.append(button('Clear this choice',()=>onChoose(''),'picker-clear'));
    return;
  }
  if(family==='depth'&&options.length>=2){
    const group=form();
    const label=make('label','picker-field','Explanation depth');
    const range=make('input');
    range.type='range';
    range.min='0';
    range.max=String(options.length-1);
    range.step='1';
    range.value=String(Math.max(0,options.indexOf(item.value)));
    const value=make('output','picker-depth-value');
    const update=()=>{
      value.textContent=options[Number(range.value)];
      range.setAttribute('aria-valuetext',value.textContent);
    };
    range.oninput=update;
    update();
    label.append(range);
    group.append(label,value);
    submit(group,()=>options[Number(range.value)]);
  }else if(family==='tone'&&options.length){
    const group=form();
    let index=Math.max(0,options.indexOf(item.value));
    const tones=make('div','picker-presets');
    const sample=make('blockquote','picker-tone-sample');
    const buttons=options.map((tone,i)=>button(tone,()=>{index=i;update();},'picker-option'));
    function update(){
      buttons.forEach((control,i)=>control.setAttribute('aria-pressed',String(i===index)));
      sample.textContent=item.samples?.[index]||'';
      sample.hidden=!sample.textContent;
      onResize();
    }
    tones.append(...buttons);
    group.append(tones,sample);
    submit(group,()=>options[index]);
    update();
  }else if(['choices','cards','depth','tone','goal_comparison','example','tradeoff'].includes(family)){
    const grid=make('div',family==='cards'?'picker-cards':'picker-choices');
    options.forEach(value=>{const b=option(value);if(family==='cards'){const visual=make('span','card-preview');visual.setAttribute('aria-hidden','true');const diagram=/visual|diagram|orbit|simulat|map/i.test(value);visual.dataset.visual=String(diagram);visual.append(make('i'),make('i'),make('i'));b.prepend(visual);}grid.append(b);});target.append(grid);
  }else if(family==='search'){
    const f=field('Find an option or enter your own','search',item.value);f.input.placeholder='Search suggestions…';target.append(f.label);const results=make('div','picker-choices');target.append(results);
    const draw=()=>{results.replaceChildren();options.filter(o=>o.toLocaleLowerCase().includes(f.input.value.toLocaleLowerCase())).forEach(o=>results.append(option(o)));if(!results.children.length)results.append(make('p','picker-hint','Use your own value below.'));onResize();};f.input.oninput=draw;draw();
    const custom=form();const use=make('button','picker-apply','Use this value');use.type='submit';custom.append(use);custom.onsubmit=e=>{e.preventDefault();if(f.input.value.trim())onChoose(f.input.value.trim());};
  }else if(family==='number'){
    if(options.length){const presets=make('div','picker-presets');options.forEach(v=>presets.append(option(v)));target.append(presets);}
    const f=form();const row=make('div','picker-number-row');const numbers=item.value.match(/\d+(?:\.\d+)?/g)||[];const n=field(item.type==='budget'?'From (optional)':'Amount','number',numbers[0]||'');n.input.min='0';n.input.step=item.type==='quantity'?'1':'any';n.input.required=item.type!=='budget';row.append(n.label);
    let upper;if(item.type==='budget'){upper=field('To (optional)','number',numbers[1]||'');upper.input.min='0';upper.input.step='any';row.append(upper.label);}
    const u=field(item.type==='budget'?'Currency / unit':'Unit','text',item.unit);u.input.maxLength=30;if(item.type!=='quantity')row.append(u.label);f.append(row);
    submit(f,()=>{const a=n.input.value,b=upper?.input.value;if(upper&&!a&&!b){n.input.setCustomValidity('Enter an amount.');n.input.reportValidity();n.input.oninput=()=>n.input.setCustomValidity('');return '';}
      if(upper&&a&&b&&Number(b)<Number(a)){upper.input.setCustomValidity('The upper amount must be at least the lower amount.');upper.input.reportValidity();upper.input.oninput=()=>upper.input.setCustomValidity('');return '';}
      return `${upper?(a&&b?`${a}–${b}`:a?`from ${a}`:`up to ${b}`):a}${u.input.value.trim()?' '+u.input.value.trim():''}`;});
  }else if(family==='datetime'){
    const f=form();let a,b,zone;
    if(item.type==='time'){a=field('Time','time',(item.value.match(/\b\d{2}:\d{2}\b/)||[''])[0]);zone=field('Timezone','text',Intl.DateTimeFormat().resolvedOptions().timeZone||'');zone.input.maxLength=80;f.append(a.label,zone.label);}
    else{const dates=item.value.match(/\d{4}-\d{2}-\d{2}/g)||[];a=field(item.type==='date_range'?'Start date':'Date','date',dates[0]||'');f.append(a.label);if(item.type==='date_range'){b=field('End date','date',dates[1]||'');b.input.required=true;f.append(b.label);}}
    a.input.required=true;if(b)a.input.oninput=()=>{b.input.min=a.input.value;};
    submit(f,()=>`${a.input.value}${b?' to '+b.input.value:''}${zone?.input.value?' '+zone.input.value.trim():''}`);
    if(options.length){const presets=make('div','picker-presets');options.forEach(v=>presets.append(option(v)));target.append(presets);}
  }else if(family==='list'){
    let selected=item.value?item.value.split(item.type==='priorities'?' → ':'; ').filter(Boolean):[];
    const choices=make('div','picker-choices');options.forEach(value=>{const b=option(value);b.setAttribute('aria-pressed',String(selected.includes(value)));b.onclick=()=>{selected=selected.includes(value)?selected.filter(s=>s!==value):[...selected,value];draw();};choices.append(b);});target.append(choices);
    const list=make('ol','picker-list');target.append(list);
    function draw(){list.replaceChildren();selected.forEach((value,index)=>{const li=make('li');li.append(make('span','',value));if(item.type==='priorities'){const up=button('↑',()=>{[selected[index-1],selected[index]]=[selected[index],selected[index-1]];draw();});up.disabled=index===0;up.setAttribute('aria-label','Move '+value+' up');li.append(up);}const remove=button('×',()=>{selected.splice(index,1);draw();});remove.setAttribute('aria-label','Remove '+value);li.append(remove);list.append(li);});[...choices.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(selected.includes(options[i]))));onResize();}draw();
    const add=form(),custom=field('Add your own');custom.input.maxLength=100;const addButton=make('button','','Add');addButton.type='submit';add.append(custom.label,addButton);add.onsubmit=e=>{e.preventDefault();const value=custom.input.value.trim();if(value&&!selected.includes(value)&&selected.length<8){selected.push(value);custom.input.value='';draw();}};
    const commit=button('Use these',()=>{const value=selected.join(item.type==='priorities'?' → ':'; ');if(value.length>300){target.querySelector('.picker-error')?.remove();target.append(make('p','picker-error','Keep your choices under 300 characters.'));return;}if(value)onChoose(value);},'picker-apply');target.append(commit);
  }
  if(item.confirmed)target.append(button('Clear this choice',()=>onChoose(''),'picker-clear'));
}
