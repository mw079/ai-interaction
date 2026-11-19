import {renderComposerExtension} from './composer-extensions.js';
import {INFORMATION_TYPES} from './intent.js';
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,action,cls='')=>{const b=make('button',cls,text);b.type='button';b.onclick=action;return b;};
// A tiny schematic of a response format, chosen from words in its label.
const PREVIEW_KINDS=[['chart',/chart|graph|bar|data|number|statistic/i],['steps',/step|timeline|process|sequence|cycle|walk/i],['map',/map|place|route|location/i],
  ['grid',/compar|table|versus|vs\b|matrix/i],['visual',/visual|diagram|orbit|simulat|interactive|explore/i],['list',/list|bullet|checklist|outline|plan/i]];
export function formatPreview(value,forced){
  const kind=forced||PREVIEW_KINDS.find(([,pattern])=>pattern.test(value))?.[0]||'text';
  const preview=make('span','card-preview');preview.dataset.kind=kind;preview.setAttribute('aria-hidden','true');
  const count={chart:4,steps:4,map:3,grid:4,visual:3,list:3,text:3}[kind];
  for(let i=0;i<count;i++)preview.append(make('i'));
  return preview;
}
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
      group.querySelectorAll('.picker-tick').forEach((t,i)=>t.setAttribute('aria-pressed',String(i===Number(range.value))));
    };
    range.oninput=update;
    update();
    label.append(range);
    const ticks=make('div','picker-ticks');ticks.style.setProperty('--n',options.length);
    options.forEach((o,i)=>{const t=button(o,()=>{range.value=String(i);update();},'picker-tick');ticks.append(t);});
    group.append(label,ticks,value);
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
    options.forEach(value=>{const b=option(value);if(family==='cards')b.prepend(formatPreview(value));grid.append(b);});target.append(grid);
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
    // Multi-select: options toggle with a check; chosen items form an ordered list for priorities.
    const ordered=item.type==='priorities';
    let selected=item.value?item.value.split(ordered?' → ':'; ').filter(Boolean):[];
    const all=()=>[...options,...selected.filter(v=>!options.includes(v))];
    const choices=make('div','picker-choices picker-multi');target.append(choices);
    const list=make('ol','picker-list');const hint=make('p','picker-hint','Order matters: the first is most important.');if(ordered)target.append(hint,list);
    const addToggle=button('+ Add your own',()=>{add.hidden=false;addToggle.hidden=true;custom.input.focus();onResize();},'picker-add-toggle');
    const add=make('form','picker-add');add.hidden=true;const custom=field('Your own','text');custom.input.maxLength=100;custom.input.placeholder='Type and press Enter';
    const addButton=make('button','picker-add-apply','Add');addButton.type='submit';add.append(custom.label,addButton);
    add.onsubmit=e=>{e.preventDefault();const value=custom.input.value.trim();if(value&&!selected.includes(value)&&selected.length<8){selected.push(value);custom.input.value='';draw();}};
    target.append(addToggle,add);
    const commit=button('',()=>{const value=selected.join(ordered?' → ':'; ');if(value.length>300){target.querySelector('.picker-error')?.remove();target.append(make('p','picker-error','Keep your choices under 300 characters.'));return;}if(value)onChoose(value);},'picker-apply');
    target.append(commit);
    function draw(){
      choices.replaceChildren(...all().map(value=>{const b=button(value,()=>{selected=selected.includes(value)?selected.filter(s=>s!==value):[...selected,value];draw();},'picker-option');b.setAttribute('aria-pressed',String(selected.includes(value)));return b;}));
      list.replaceChildren(...(ordered?selected:[]).map((value,index)=>{
        const li=make('li');li.append(make('span','picker-rank',String(index+1)),make('span','',value));
        const up=button('↑',()=>{[selected[index-1],selected[index]]=[selected[index],selected[index-1]];draw();},'picker-icon');up.disabled=index===0;up.setAttribute('aria-label','Move '+value+' up');
        const down=button('↓',()=>{[selected[index+1],selected[index]]=[selected[index],selected[index+1]];draw();},'picker-icon');down.disabled=index===selected.length-1;down.setAttribute('aria-label','Move '+value+' down');
        li.append(up,down);return li;}));
      list.hidden=hint.hidden=!selected.length;
      commit.disabled=!selected.length;
      commit.textContent=selected.length?`Use ${selected.length} selected`:'Select at least one';
      onResize();
    }
    draw();
  }
  if(item.confirmed)target.append(button('Clear this choice',()=>onChoose(''),'picker-clear'));
}
