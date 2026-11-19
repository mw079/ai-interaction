import {renderDiagram} from './diagrams.js';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};

// Wraps one validated page component (title + content) and hands it to its prebuilt renderer.
// Interaction state lives in page.edits.widgets[block.id] so it survives re-renders and history.
export function renderCatalogBlock(target,block,page,{onEdit,ask}){
 page.edits.widgets??={};const saved=page.edits.widgets[block.id]??={selected:0,practice:''};const section=node('section','catalog-block catalog-'+block.type);section.dataset.componentId=block.id;section.setAttribute('aria-label',block.title);const heading=node('div','catalog-heading');heading.append(node('h3','catalog-title',block.title));section.append(heading);
 const content=node('div','catalog-content');section.append(content);const detail=node('p','catalog-detail');detail.setAttribute('aria-live','polite');
 // Every catalog type has a renderer; an unknown type (blocked by validation) shows only its title.
 renderDiagram(content,block,saved,onEdit,detail,{ask,section});
 target.append(section);
 return section;
}
