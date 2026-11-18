import {renderSlideExtension} from './slide-extensions.js';
const node=(tag,className,text)=>{
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
};

export function renderSlideInteraction(content,block,saved,onEdit,detail){
  const {type,items,edges,prompt}=block;
  const selection=()=>Math.max(0,Math.min(saved.selected??0,items.length-1));
  if(type==='parameter_explorer'){
    const label=node('label','slide-parameter-label',prompt);
    const range=node('input');
    range.type='range';
    range.min='0';
    range.max=String(items.length-1);
    range.step='1';
    range.value=String(selection());
    const value=node('output','slide-parameter-value');
    const paint=()=>{
      const item=items[selection()];
      value.textContent=item.label;
      range.setAttribute('aria-valuetext',item.label);
      detail.textContent=item.detail;
    };
    range.oninput=()=>{saved.selected=Number(range.value);onEdit();paint();};
    label.append(range);
    content.append(label,value,detail);
    paint();
    return true;
  }
  if(type==='prediction'){
    const responses=node('div','catalog-choices');
    const reveal=node('button','slide-reveal','Reveal answer');
    reveal.type='button';
    const correct=items.findIndex(item=>item.value===1);
    const buttons=items.map((item,index)=>{
      const button=node('button','catalog-item',item.label);
      button.type='button';
      button.onclick=()=>{saved.guess=index;saved.revealed=false;onEdit();paint();};
      return button;
    });
    const paint=()=>{
      const guess=Number.isInteger(saved.guess)&&items[saved.guess]?saved.guess:null;
      buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===guess)));
      reveal.disabled=guess===null||saved.revealed===true;
      detail.hidden=guess===null||!saved.revealed;
      detail.textContent=detail.hidden?'':(guess===correct?'Correct. ':'Answer: '+items[correct].label+'. ')+items[guess].detail;
    };
    reveal.onclick=()=>{saved.revealed=true;onEdit();paint();};
    responses.append(...buttons);
    content.append(node('p','slide-prediction-prompt',prompt),responses,reveal,detail);
    paint();
    return true;
  }
  if(type==='hotspot_diagram'){
    const figure=node('div','slide-hotspots');
    figure.setAttribute('role','group');
    figure.setAttribute('aria-label',block.title);
    const canvas=node('canvas','slide-hotspot-lines');
    canvas.width=600;
    canvas.height=300;
    canvas.setAttribute('aria-hidden','true');
    figure.append(canvas);
    const positions=items.map((_,index)=>{
      const angle=index*2*Math.PI/items.length-Math.PI/2;
      return [50+32*Math.cos(angle),50+35*Math.sin(angle)];
    });
    const buttons=items.map((item,index)=>{
      const button=node('button','catalog-item',item.label);
      button.type='button';
      button.style.left=positions[index][0]+'%';
      button.style.top=positions[index][1]+'%';
      button.onclick=()=>{saved.selected=index;onEdit();paint();};
      return button;
    });
    function paint(){
      const active=selection();
      const context=canvas.getContext('2d');
      if(context){
        context.clearRect(0,0,600,300);
        edges.forEach(({from,to})=>{
          context.beginPath();
          context.strokeStyle=from===active||to===active?'#6c8258':'#ccd4c2';
          context.lineWidth=2;
          context.moveTo(6*positions[from][0],3*positions[from][1]);
          context.lineTo(6*positions[to][0],3*positions[to][1]);
          context.stroke();
        });
      }
      buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===active)));
      const links=edges.filter(edge=>edge.from===active||edge.to===active)
        .map(({from,to,label})=>[items[from].label,label,items[to].label].filter(Boolean).join(' → '));
      detail.textContent=[items[active].detail,...links].join('\n');
    }
    figure.append(...buttons);
    content.append(figure,detail);
    paint();
    return true;
  }
  return renderSlideExtension(content,block,saved,onEdit,detail);
}
