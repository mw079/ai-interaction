import {renderSlideInteraction} from './slide-interactions.js';
import {renderDiagram} from './diagrams.js';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function renderCatalogBlock(target,block,page,{onEdit,ask}){
 page.edits.widgets??={};const saved=page.edits.widgets[block.id]??={selected:0,practice:''};const section=node('section','catalog-block catalog-'+block.type);section.dataset.componentId=block.id;section.setAttribute('aria-label',block.title);const heading=node('div','catalog-heading');heading.append(node('h3','catalog-title',block.title));section.append(heading);
 const content=node('div','catalog-content');section.append(content);const detail=node('p','catalog-detail');detail.setAttribute('aria-live','polite');
 if(renderDiagram(content,block,saved,onEdit,detail)||renderSlideInteraction(content,block,saved,onEdit,detail)){
  target.append(section);
  return section;
 }
 if(block.type==='chart'){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 480 240');svg.setAttribute('role','img');svg.setAttribute('aria-label',block.title);const max=Math.max(...block.items.map(i=>Math.abs(i.value)),1);block.items.forEach((item,i)=>{const r=document.createElementNS(svg.namespaceURI,'rect');r.setAttribute('x',i*480/block.items.length+10);r.setAttribute('y',item.value>=0?120-item.value/max*100:120);r.setAttribute('width',480/block.items.length-20);r.setAttribute('height',Math.abs(item.value)/max*100);const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=item.label+': '+item.value;r.append(title);svg.append(r);});const zero=document.createElementNS(svg.namespaceURI,'line');zero.setAttribute('x1','0');zero.setAttribute('x2','480');zero.setAttribute('y1','120');zero.setAttribute('y2','120');zero.setAttribute('stroke','currentColor');zero.setAttribute('stroke-width','1');svg.append(zero);content.append(svg);
 }
 const choices=node('div','catalog-choices');choices.setAttribute('aria-label',block.type==='cycle'?'Cycle steps':'Explore '+block.title);
 block.items.forEach((item,i)=>{const b=node('button','catalog-item',item.label);b.type='button';b.onclick=()=>{saved.selected=i;paint();};choices.append(b);if(block.type==='cycle'&&i<block.items.length-1)choices.append(node('span','catalog-link','→'));});content.append(choices);
 if(block.type==='graph'){const links=node('div','catalog-edges');block.edges.forEach(e=>{const b=node('button','catalog-edge',block.items[e.from].label+' → '+block.items[e.to].label+(e.label?' · '+e.label:''));b.type='button';b.onclick=()=>{saved.selected=e.to;paint();};links.append(b);});content.append(links);}
 content.append(detail);
 function paint(){const i=Math.min(saved.selected,block.items.length-1);choices.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));const item=block.items[i];detail.textContent=(block.type==='chart'?item.value+' — ':'')+item.detail;}
 if(['worked_example','practice'].includes(block.type)){
  const label=node('label','practice-label','Your explanation');const practice=node('textarea','learner-practice');practice.dataset.editKey='practice:'+block.id;practice.rows=3;practice.maxLength=1500;practice.value=saved.practice;practice.placeholder=block.prompt||'Try explaining the idea in your own words…';practice.setAttribute('aria-label','Your explanation for '+block.title);practice.oninput=()=>{saved.practice=practice.value;onEdit();};label.append(practice);content.append(label);const feedback=node('button','practice-feedback','Ask about my explanation');feedback.type='button';feedback.onclick=()=>ask(section,block,practice.value);content.append(feedback);
 }
 paint();target.append(section);return section;
}
