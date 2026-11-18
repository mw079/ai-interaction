import {worldMap} from './maps.js';
const create=(tag,text,className)=>{
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=text;
  if(className)element.className=className;
  return element;
};
function button(text,action){
  const element=create('button',text,'catalog-item');
  element.type='button';
  element.onclick=action;
  return element;
}
const functions={
  linear:{label:'y = x',evaluate:x=>x},
  square:{label:'y = x²',evaluate:x=>x*x},
  cube:{label:'y = x³',evaluate:x=>x*x*x},
  absolute:{label:'y = |x|',evaluate:Math.abs},
  sine:{label:'y = sin(x)',evaluate:Math.sin}
};

export function renderSlideExtension(content,block,state,onEdit,detail){
  const {items,edges,prompt,type}=block;
  const current=()=>Math.min(items.length-1,Math.max(0,state.selected??0));
  const choose=(index,paint)=>{state.selected=index;onEdit();paint();};
  const options=create('div',undefined,'catalog-choices');
  const select=(label,callback)=>{
    const group=create('label',label,'slide-parameter-label');
    const range=create('input');
    range.type='range';
    range.min='0';
    range.max=String(items.length-1);
    range.value=String(current());
    range.oninput=()=>choose(Number(range.value),()=>callback(range));
    group.append(range);
    content.append(group);
    return range;
  };
  if(type==='before_after'){
    const pair=create('div',undefined,'slide-pair');
    const paint=range=>{
      const after=current()===1;
      range.setAttribute('aria-valuetext',items[current()].label);
      pair.replaceChildren(create('strong',items[current()].label),create('p',items[current()].detail));
      toggle.textContent=after?'Show before':'Show after';
    };
    const range=select('Compare the two versions',paint);
    const toggle=button('Show after',()=>{
      choose(1-current(),()=>{range.value=String(current());paint(range);});
    });
    content.append(pair,toggle);
    paint(range);
    return true;
  }
  if(type==='decision_tree'||type==='hierarchy'){
    const paint=()=>{
      const index=current();
      detail.textContent=items[index].detail;
      const title=create('strong',items[index].label);
      const parent=edges.find(edge=>edge.to===index);
      const branches=edges.filter(edge=>edge.from===index).map(edge=>
        button(edge.label||items[edge.to].label,()=>choose(edge.to,()=>{paint();heading.focus();})));
      if(parent)branches.unshift(button('Back to '+items[parent.from].label,()=>choose(parent.from,()=>{paint();heading.focus();})));
      options.replaceChildren(...branches);
      heading.replaceChildren(title);
    };
    const heading=create('div');
    heading.tabIndex=-1;
    content.append(heading,detail,options);
    paint();
    return true;
  }
  if(type==='sorting'){
    const examples=items.map((item,index)=>({item,index})).filter(({item})=>item.value===0);
    const groups=items.map((item,index)=>({item,index})).filter(({item})=>item.value===1);
    const position=()=>Math.min(state.sortIndex??0,examples.length-1);
    const title=create('strong');
    const next=button('Next example',()=>{
      state.sortIndex=(position()+1)%examples.length;onEdit();paint();options.querySelector('button')?.focus();
    });
    function paint(){
      const {item,index}=examples[position()];
      const expected=edges.find(edge=>edge.from===index&&items[edge.to].value===1).to;
      const selected=state.sorted?.[index];
      title.textContent=item.label;
      options.replaceChildren(...groups.map(group=>{
        const control=button(group.item.label,()=>{
          (state.sorted??={})[index]=group.index;onEdit();paint();
          options.querySelector('[aria-pressed="true"]')?.focus();
        });
        control.setAttribute('aria-pressed',String(selected===group.index));
        return control;
      }));
      detail.textContent=selected===undefined?'':(selected===expected?'Correct. ':'Answer: '+items[expected].label+'. ')+item.detail;
    }
    content.append(title,options,detail);
    if(examples.length>1)content.append(next);
    paint();
    return true;
  }
  if(type==='linked_scenarios'){
    const pair=create('div',undefined,'slide-pair slide-pair-grid');
    const paint=range=>{
      const item=items[current()];
      range.setAttribute('aria-valuetext',item.label);
      detail.textContent=item.label;
      pair.replaceChildren(...item.detail.split(' | ').map(text=>{
        const section=create('section');
        const divider=text.indexOf(':');
        if(divider>=0)section.append(create('strong',text.slice(0,divider)),create('p',text.slice(divider+1).trim()));
        else section.textContent=text;
        return section;
      }));
    };
    const range=select(prompt,paint);
    content.append(detail,pair);
    paint(range);
    return true;
  }
  if(type==='map'){
    const map=create('div');
    const controls=items.map((item,index)=>button(item.label,()=>choose(index,paint)));
    const paint=()=>{
      const index=current();
      map.replaceChildren(worldMap({label:block.title+' · selected location: '+items[index].label,points:items,selected:index,onPick(latitude,longitude){
        const distances=items.map(item=>Math.hypot((item.latitude-latitude)/90,(item.longitude-longitude)/180));
        const distance=Math.min(...distances);
        if(distance<.12)choose(distances.indexOf(distance),paint);
      }}));
      controls.forEach((control,i)=>control.setAttribute('aria-pressed',String(i===index)));
      detail.textContent=items[index].detail;
    };
    options.append(...controls);
    content.append(map,options,detail);
    paint();
    return true;
  }
  if(type==='evidence'){
    const claims=[...new Set(edges.map(edge=>edge.from))];
    const pane=create('div',undefined,'slide-pair');
    const controls=claims.map((index,i)=>button(items[index].label,()=>choose(i,paint)));
    const paint=()=>{
      const index=Math.min(current(),claims.length-1);
      const claim=claims[index];
      controls.forEach((control,i)=>control.setAttribute('aria-pressed',String(i===index)));
      detail.textContent=items[claim].detail;
      pane.replaceChildren(...edges.filter(edge=>edge.from===claim).map(edge=>{
        const item=items[edge.to];
        const section=create('section');
        section.append(create('strong',item.label),create('p',item.detail),create('small',edge.label));
        return section;
      }));
    };
    options.append(...controls);
    content.append(options,detail,pane);
    paint();
    return true;
  }
  if(type==='function_plot'){
    renderFunction(content,items,functions[prompt],state,onEdit,detail);
    return true;
  }
  return false;
}

function renderFunction(content,items,fn,state,onEdit,detail){
  const [min,max]=items.map(item=>item.value);
  const canvas=create('canvas',undefined,'function-canvas');
  canvas.width=560;canvas.height=240;
  canvas.setAttribute('role','img');
  const sample=Array.from({length:201},(_,i)=>fn.evaluate(min+(max-min)*i/200));
  const low=Math.min(0,...sample),high=Math.max(0,...sample);
  const xPixel=x=>30+500*(x-min)/(max-min);
  const yPixel=y=>211-182*(y-low)/(high-low||1);
  const label=create('label','Inspect x','slide-parameter-label');
  const range=create('input');
  range.type='range';range.min='0';range.max='200';range.value=String(state.functionPosition??100);
  function paint(){
    const x=min+(max-min)*Number(range.value)/200;
    const y=fn.evaluate(x);
    const values='x = '+Number(x.toFixed(2))+' · y = '+Number(y.toFixed(3));
    range.setAttribute('aria-valuetext',values);
    canvas.setAttribute('aria-label',fn.label+' · '+values);
    detail.textContent=values;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    ctx.clearRect(0,0,560,240);
    ctx.strokeStyle='#a9b3a0';ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(30,yPixel(0));ctx.lineTo(530,yPixel(0));
    if(min<=0&&max>=0){ctx.moveTo(xPixel(0),29);ctx.lineTo(xPixel(0),211);}
    ctx.stroke();
    ctx.strokeStyle='#4f6941';ctx.lineWidth=2;ctx.beginPath();
    sample.forEach((v,i)=>i===0?ctx.moveTo(30,yPixel(v)):ctx.lineTo(30+2.5*i,yPixel(v)));
    ctx.stroke();
    ctx.fillStyle='#586452';ctx.font='12px system-ui';
    ctx.textAlign='left';ctx.fillText(String(min),30,230);
    ctx.textAlign='right';ctx.fillText(String(max),530,230);
    ctx.textAlign='left';ctx.fillText('x',539,230);ctx.fillText('y',10,20);
    ctx.beginPath();ctx.arc(xPixel(x),yPixel(y),5,0,Math.PI*2);
    ctx.fillStyle='#34573b';ctx.fill();
  }
  range.oninput=()=>{state.functionPosition=Number(range.value);onEdit();paint();};
  label.append(range);
  content.append(create('strong',fn.label),canvas,label,detail);
  paint();
}
