import {renderComposerExtension} from './composer-extensions.js';
import {INFORMATION_TYPES} from './intent.js';
import {make,button,entry,currentLine} from './control-kit.js';
// A tiny schematic of a response format, chosen from words in its label.
const PREVIEW_KINDS=[['chart',/chart|graph|bar|data|number|statistic/i],['steps',/step|timeline|process|sequence|cycle|walk/i],['map',/map|place|route|location/i],
  ['grid',/compar|table|versus|vs\b|matrix/i],['visual',/visual|diagram|orbit|simulat|interactive|explore/i],['list',/list|bullet|checklist|outline|plan/i]];
export function formatPreview(value,forced){
  const kind=forced||PREVIEW_KINDS.find(([,pattern])=>pattern.test(value))?.[0]||'text';
  const preview=make('span','card-preview');preview.dataset.kind=kind;preview.setAttribute('aria-hidden','true');
  // Fixed, app-owned sketches; no model content is inserted here.
  const SKETCHES={
    network:'<svg viewBox="0 0 60 36" width="60" height="36"><path d="M30 7 15 28M30 7 45 28M15 28h30" stroke="#b8c6aa" stroke-width="1.5" fill="none"/><circle cx="30" cy="7" r="4.5" fill="#4f6b45"/><circle cx="15" cy="28" r="4" fill="#7d9a6c"/><circle cx="45" cy="28" r="4" fill="#7d9a6c"/></svg>',
    steps:'<svg viewBox="0 0 64 20" width="64" height="20"><path d="M8 10h48" stroke="#b8c6aa" stroke-width="1.5"/><circle cx="8" cy="10" r="5" fill="#4f6b45"/><circle cx="24" cy="10" r="4" fill="#a9bf98"/><circle cx="40" cy="10" r="4" fill="#cad6c2"/><circle cx="56" cy="10" r="4" fill="#cad6c2"/></svg>',
    cycle:'<svg viewBox="0 0 40 36" width="40" height="36"><circle cx="20" cy="18" r="12" stroke="#b8c6aa" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/><circle cx="20" cy="6" r="4" fill="#4f6b45"/><circle cx="32" cy="18" r="3.5" fill="#7d9a6c"/><circle cx="20" cy="30" r="3.5" fill="#7d9a6c"/><circle cx="8" cy="18" r="3.5" fill="#7d9a6c"/></svg>'
  };
  if(SKETCHES[kind]){preview.innerHTML=SKETCHES[kind];return preview;}
  const count={chart:4,steps:4,map:3,grid:4,visual:3,list:3,text:3,slider:2}[kind];
  for(let i=0;i<count;i++)preview.append(make('i'));
  return preview;
}
// One renderer per family. Values and suggestions belong to the descriptor, never the template.
// Choosing is committing: single choices apply and close; multi-value controls apply each change
// live and stay open; typed answers apply on Enter. Nothing needs a separate "Use this" step.
export function renderInformationControl(target,item,onChoose,onResize=()=>{}){
  target.replaceChildren();const {family}=INFORMATION_TYPES[item.type];target.dataset.family=family;
  const options=item.options||[];
  const current=currentLine(item,onChoose);
  const choose=(value,opts)=>{
    current.set(value);
    // Mark the chosen row among single-choice options so the choice is visible wherever it is shown.
    target.querySelectorAll('.picker-choices:not(.picker-multi)>.picker-option,.picker-cards>.picker-option,.picker-presets>.picker-option').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===value)));
    onChoose(value,opts);
  };
  const live=value=>choose(value,{keepOpen:true});
  function option(value,{sample}={}){
    const b=button(value,()=>choose(value),'picker-option');
    b.setAttribute('aria-pressed',String(item.confirmed&&item.value===value));
    if(sample)for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>sample(value));
    return b;
  }
  const rows=list=>{const g=make('div','picker-choices');g.append(...list);target.append(g);return g;};
  const finish=()=>{target.append(current.element);onResize();};
  if(renderComposerExtension(target,family,item,choose,onResize)){finish();return;}

  if(family==='tone'||(family==='depth'&&options.length)){
    // Ordered rows (brief to detailed for depth). Tone previews its sample on hover or focus.
    const sample=make('blockquote','picker-tone-sample');
    const show=value=>{const text=item.samples?.[options.indexOf(value)]||'';sample.textContent=text;sample.hidden=!text;onResize();};
    rows(options.map(o=>option(o,{sample:family==='tone'?show:null})));
    if(family==='tone'){target.append(sample);show(item.confirmed&&options.includes(item.value)?item.value:options[0]);}
  }else if(['choices','cards','goal_comparison','example','tradeoff'].includes(family)){
    const grid=make('div',family==='cards'?'picker-cards':'picker-choices');
    options.forEach(value=>{const b=option(value);if(family==='cards')b.prepend(formatPreview(value));grid.append(b);});
    target.append(grid);
  }else if(family==='search'){
    const results=make('div','picker-choices');
    const find=entry('Search or enter your own',{value:item.confirmed?item.value:'',placeholder:'Type to filter…',maxLength:300,onCommit:value=>choose(value)});
    find.input.type='search';
    const draw=()=>{const q=find.input.value.toLocaleLowerCase();results.replaceChildren(...options.filter(o=>o.toLocaleLowerCase().includes(q)).map(o=>option(o)));
      if(!results.children.length)results.append(make('p','picker-hint','Press Enter to use what you typed.'));onResize();};
    find.input.addEventListener('input',draw);
    target.append(find.element,results);draw();
  }else if(family==='number'){
    if(options.length){const presets=make('div','picker-presets');options.forEach(v=>presets.append(option(v)));target.append(presets);}
    const numbers=(item.confirmed?item.value:'').match(/\d+(?:\.\d+)?/g)||[];
    const unit=item.unit?' '+item.unit:'';
    if(item.type==='budget'){
      // A range reads naturally as one line: "100–200 EUR per night". Enter applies it.
      const range=entry('Your own range'+(item.unit?' ('+item.unit+')':''),{value:numbers.length?numbers.join('–'):'',placeholder:'e.g. 100–200',maxLength:40,
        validate:v=>/^\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?$/.test(v)?(()=>{const [a,b]=v.split(/[–-]/).map(Number);return b!==undefined&&b<a?'The upper amount must be at least the lower amount.':'';})():'Enter an amount or a range like 100–200.',
        onCommit:v=>choose(v.replace(/\s*[–-]\s*/,'–')+unit)});
      target.append(range.element);
    }else{
      const amount=entry('Your own'+(item.unit?' ('+item.unit+')':''),{type:'number',value:numbers[0]||'',placeholder:'Amount',maxLength:12,
        validate:v=>Number(v)>=0?'':'Enter a positive number.',onCommit:v=>choose(v+unit)});
      amount.input.min='0';amount.input.step=item.type==='quantity'?'1':'any';
      target.append(amount.element);
    }
  }else if(family==='datetime'){
    // Dates apply as soon as they are picked; a range applies once both ends are set.
    const row=make('div','picker-date-row');
    const dates=(item.confirmed?item.value:'').match(/\d{4}-\d{2}-\d{2}/g)||[];
    const field=(label,type,value)=>{const l=make('label','picker-entry');l.append(make('span','picker-entry-label',label));const i=make('input');i.type=type;i.value=value;l.append(i);row.append(l);return i;};
    if(item.type==='time'){
      const time=field('Time','time',((item.confirmed?item.value:'').match(/\b\d{2}:\d{2}\b/)||[''])[0]);
      const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
      time.onchange=()=>{if(time.value)choose(time.value+(zone?' '+zone:''));};
    }else if(item.type==='date_range'){
      const start=field('Start','date',dates[0]||''),end=field('End','date',dates[1]||'');
      const apply=()=>{end.min=start.value;if(start.value&&end.value&&end.value>=start.value)choose(start.value+' to '+end.value);else if(start.value&&!end.value)end.focus();};
      start.onchange=end.onchange=apply;
    }else{
      const date=field('Date','date',dates[0]||'');
      date.onchange=()=>{if(date.value)choose(date.value);};
    }
    target.append(row);
    if(options.length){const presets=make('div','picker-presets');options.forEach(v=>presets.append(option(v)));target.append(presets);}
  }else if(family==='list'){
    // Multi-select applies live: each toggle or reorder updates the draft; the picker stays open.
    const ordered=item.type==='priorities';
    let selected=item.confirmed&&item.value?item.value.split(ordered?' → ':'; ').filter(Boolean):[];
    const all=()=>[...options,...selected.filter(v=>!options.includes(v))];
    const choices=make('div','picker-choices picker-multi');target.append(choices);
    const hint=make('p','picker-hint','Order matters: the first is most important.');
    const list=make('ol','picker-list');if(ordered)target.append(hint,list);
    const apply=()=>{const value=selected.join(ordered?' → ':'; ');if(value.length>300)return;live(value);draw();};
    const own=entry('Add your own',{placeholder:'Type and press Enter',maxLength:100,goLabel:'Add',onCommit:v=>{if(!selected.includes(v)&&selected.length<8){selected.push(v);own.input.value='';own.input.dispatchEvent(new Event('input'));apply();}}});
    target.append(own.element);
    function draw(){
      choices.replaceChildren(...all().map(value=>{const b=button(value,()=>{selected=selected.includes(value)?selected.filter(s=>s!==value):[...selected,value];apply();},'picker-option');b.setAttribute('aria-pressed',String(selected.includes(value)));return b;}));
      list.replaceChildren(...(ordered?selected:[]).map((value,index)=>{
        const li=make('li');li.append(make('span','picker-rank',String(index+1)),make('span','',value));
        const up=button('↑',()=>{[selected[index-1],selected[index]]=[selected[index],selected[index-1]];apply();},'picker-icon');up.disabled=index===0;up.setAttribute('aria-label','Move '+value+' up');
        const down=button('↓',()=>{[selected[index+1],selected[index]]=[selected[index],selected[index+1]];apply();},'picker-icon');down.disabled=index===selected.length-1;down.setAttribute('aria-label','Move '+value+' down');
        li.append(up,down);return li;}));
      list.hidden=hint.hidden=!selected.length;
      onResize();
    }
    draw();
  }
  finish();
}
