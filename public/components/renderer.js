import {renderDiagram} from './diagrams.js';
import {element as node} from '../shared/dom.js';

// Wraps one validated page component (title + content) and hands it to its prebuilt renderer.
// Interaction state lives in page.edits.widgets[block.id] so it survives re-renders and history.
export function renderComponent(target,block,page,{onEdit,ask}){
 page.edits.widgets??={};const saved=page.edits.widgets[block.id]??={selected:0,practice:''};const section=node('section','component-block component-'+block.type);section.dataset.componentId=block.id;section.setAttribute('aria-label',block.title);const heading=node('div','component-heading');heading.append(node('h3','component-title',block.title));section.append(heading);
 const content=node('div','component-content');section.append(content);const detail=node('p','component-detail');detail.setAttribute('aria-live','polite');
 // Every catalog type has a renderer; an unknown type (blocked by validation) shows only its title.
 renderDiagram(content,block,saved,onEdit,detail,{ask,section});
 target.append(section);
 return section;
}
