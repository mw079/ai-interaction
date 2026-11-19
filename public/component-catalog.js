// The model chooses data and supported interactions, never HTML, scripts or handlers.
export const COMPONENT_TYPES=['cycle','graph','timeline','comparison','chart','worked_example','practice','hotspot_diagram','parameter_explorer','prediction',
  'decision_tree','before_after','hierarchy','sorting','function_plot','evidence','map','linked_scenarios',
  'proportion','matrix','checklist','flashcards','spectrum','key_numbers'];
const str={type:'string'};
export const COMPONENT_SCHEMA={type:'object',additionalProperties:false,properties:{id:str,type:{type:'string',enum:COMPONENT_TYPES},title:str,prompt:str,items:{type:'array',items:{type:'object',additionalProperties:false,properties:{label:str,detail:str,value:{type:'number'},latitude:{type:['number','null']},longitude:{type:['number','null']}},required:['label','detail','value','latitude','longitude']}},edges:{type:'array',items:{type:'object',additionalProperties:false,properties:{from:{type:'integer'},to:{type:'integer'},label:str},required:['from','to','label']}}},required:['id','type','title','prompt','items','edges']};
const short=(v,n)=>typeof v==='string'&&v.length<=n;
export function validComponents(list){return Array.isArray(list)&&list.length<=2&&new Set(list.map(c=>c?.id)).size===list.length&&list.every(c=>c&&Object.keys(c).every(k=>['id','type','title','prompt','items','edges'].includes(k))&&typeof c.id==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(c.id)&&!['constructor','prototype','__proto__'].includes(c.id)&&COMPONENT_TYPES.includes(c.type)&&short(c.title,100)&&short(c.prompt,200)&&Array.isArray(c.items)&&c.items.length>=2&&c.items.length<=6&&c.items.every(i=>i&&Object.keys(i).every(k=>['label','detail','value','latitude','longitude'].includes(k))&&short(i.label,80)&&short(i.detail,600)&&Number.isFinite(i.value)&&Math.abs(i.value)<=1000000)&&Array.isArray(c.edges)&&c.edges.length<=8&&c.edges.every(e=>e&&Object.keys(e).every(k=>['from','to','label'].includes(k))&&Number.isInteger(e.from)&&Number.isInteger(e.to)&&e.from>=0&&e.to>=0&&e.from<c.items.length&&e.to<c.items.length&&short(e.label,80))&&validInteraction(c));}
function validInteraction(component){
  const {type, items, edges, prompt}=component;
  if(type==='hotspot_diagram'||type==='graph')return edges.length>0;
  if(type==='parameter_explorer')return !!prompt.trim() && items.every((item,index)=>item.label.trim()&&item.detail.trim() && (index===0||item.value>items[index-1].value));
  if(type==='prediction')return !!prompt.trim() && items.every(item=>item.label.trim()&&item.detail.trim()&&[0,1].includes(item.value)) && items.filter(item=>item.value===1).length===1;
  if(type==='decision_tree'||type==='hierarchy'){
    const visited=new Set();
    function visit(index){
      if(visited.has(index))return false;
      visited.add(index);
      return edges.filter(e=>e.from===index).every(e=>visit(e.to));
    }
    return edges.length===items.length-1 && visit(0) && visited.size===items.length;
  }
  if(type==='before_after')return items.length===2 && items.every(i=>i.detail.trim());
  if(type==='sorting'){
    const groups=items.filter(i=>i.value===1).length;
    return groups>=2 && groups<items.length && items.every((i,index)=>
      [0,1].includes(i.value) && (i.value===1 || edges.filter(e=>e.from===index&&items[e.to].value===1).length===1));
  }
  if(type==='function_plot')return items.length===2 && ['linear','square','cube','absolute','sine'].includes(prompt) &&
    items[0].value<items[1].value && items.every(i=>Math.abs(i.value)<=100);
  if(type==='evidence')return edges.length>0 && edges.every(e=>e.from!==e.to && e.label.trim());
  if(type==='map')return items.every(i=>Number.isFinite(i.latitude)&&Math.abs(i.latitude)<=90&&Number.isFinite(i.longitude)&&Math.abs(i.longitude)<=180);
  if(type==='proportion')return items.every(i=>Number.isFinite(i.value)&&i.value>0);
  if(type==='matrix')return items.length===4 && prompt.split(' | ').length===2 && prompt.split(' | ').every(p=>p.trim());
  if(type==='spectrum')return prompt.split(' | ').length===2 && prompt.split(' | ').every(p=>p.trim()) && items.every(i=>Number.isFinite(i.value)&&i.value>=0&&i.value<=100);
  if(type==='key_numbers')return items.length<=4 && items.every(i=>Number.isFinite(i.value)) && prompt.length<=20;
  if(type==='linked_scenarios')return !!prompt.trim() && items.every((i,index)=>
    i.label.trim() && i.detail.split(' | ').length===2 && i.detail.split(' | ').every(part=>part.trim()) && (index===0||i.value>items[index-1].value));
  return true;
}
export function validPageHelp(v){return !!v&&Object.keys(v).every(k=>['answer','replacement','components'].includes(k))&&short(v.answer,600)&&short(v.replacement,2000)&&validComponents(v.components);}
const EXTRA_CATALOG = ' New types: decision_tree and hierarchy use one rooted tree from item 0; edge labels are branch choices. before_after has two items in before/after order. sorting uses items with value 1 as category headings, value 0 as examples, and one edge from each example to its correct group; detail explains the answer. function_plot prompt is exactly one of linear (y=x), square, cube, absolute, sine (radians); two items specify numeric domain endpoints within -100 to 100. evidence uses edges from a claim to an evidence item, edge labels identify the source; cite only provided sources, never invent evidence or provenance. map uses accurate latitude and longitude per item; all other types set latitude and longitude to null. linked_scenarios uses prompt to name the shared parameter, increasing item.value for each input, and item.detail as two named outcomes in the form Scenario A: outcome | Scenario B: outcome. Use precise, short labels; include only grounded data. Use value 0 except where the component explicitly requires numeric data. More types: proportion shows parts of one whole; each item.value is a positive share (percentages or counts), only with grounded figures. matrix places exactly four items in a 2x2 grid in the order top-left, top-right, bottom-left, bottom-right; prompt is "x-axis label | y-axis label" where right and up are high. checklist is 2-6 practical steps the reader can tick off; detail says how. flashcards are 2-6 question (label) and answer (detail) pairs for self-testing. spectrum places items on a scale: prompt is "low end | high end" and each item.value is its position from 0 to 100. key_numbers shows 2-4 important grounded figures: item.value is the number, label says what it measures, detail gives context, and prompt is an optional short unit shared by all values.';
export const CATALOG_INSTRUCTIONS='VISUAL COMPONENT CATALOG: components is a list of 0-2 composable blocks. Prefer an interactive representation for an explanation when it helps understanding; do not default to plain paragraphs for processes, relationships or worked examples. Use cycle ONLY when the last step leads back to the first (for example the water cycle or the Feynman technique); use timeline for any one-way sequence of steps or events (for example how a vaccine leads to immune memory), graph for explicit relationships with indexed edges, timeline for ordered events, comparison for 2-3 alternatives (the items are the alternatives themselves, each detail giving its key trade-off; for many criteria use a different block), chart ONLY for supplied or justified numerical data (never invent measurements), worked_example for selectable worked steps and optional learner practice, practice for a learner explanation activity with two or more prompts or self-check hints and a feedback field. Each block has unique lowercase-hyphen id, type, title, prompt (a short question about the learner practice, or empty), items (2-6 label/detail/value records), and edges (0-8 indexed from/to/label connections; required for graph). Use hotspot_diagram for a clickable labelled diagram with indexed edges showing real connections. Use parameter_explorer when varying one numerical input clarifies an idea: prompt names the parameter and units, items are 2-6 concrete scenarios in strictly increasing numeric value order, label shows the input, and detail explains the outcome. Only give supported results at those points, no guessed measurements. Use prediction for one specific question in prompt, 2-6 plausible answers in items, exactly one with value=1 and the others 0; each detail explains why the answer is right or wrong. Use value 0 for all other non-chart types. Detail explains each item at the requested audience level. Return no executable code, HTML or handlers. Use one primary visual. Add a second block only when it offers a different activity, such as practice after an explanation. Never repeat the same steps, items or labels across blocks or in the prose. Item labels are 1-4 words. Each item detail is the one-sentence caption shown when that item is selected (max 140 characters). Components should answer the actual request, not repeat generic templates. Text-only is appropriate for tasks such as drafting a message. Leave components empty in typing previews. Preserve existing component ids when updating the same block.'+EXTRA_CATALOG;

// Each recipe is a presentation choice the composer can offer and the page can render.
export const SLIDE_RECIPES = Object.freeze({
  cycle: {label:'See the loop', detail:'Follow steps that repeat', blocks:['cycle']},
  example: {label:'Follow a worked example', detail:'Walk through one concrete case', blocks:['worked_example']},
  practice: {label:'Try it yourself', detail:'Write an explanation and get feedback', blocks:['practice']},
  relationships: {label:'Explore the connections', detail:'See how the ideas relate', blocks:['graph']},
  timeline: {label:'See the steps', detail:'Follow the process one step at a time', blocks:['timeline']},
  compare: {label:'Compare side by side', detail:'Inspect the differences', blocks:['comparison']},
  chart: {label:'Explore the numbers', detail:'Inspect values in a chart', blocks:['chart']},
  hotspots: {label:'Explore a labelled diagram', detail:'Select a part to see how it works', blocks:['hotspot_diagram']},
  parameter: {label:'Change a parameter', detail:'Compare outcomes as one input changes', blocks:['parameter_explorer']},
  prediction: {label:'Predict what happens', detail:'Make a guess and reveal the explanation', blocks:['prediction']},
  decision: {label:'Follow a decision',detail:'See where each choice leads',blocks:['decision_tree']},
  reveal: {label:'Compare before and after',detail:'See exactly what changed',blocks:['before_after']},
  hierarchy: {label:'Explore the categories',detail:'Open a branch to see what belongs there',blocks:['hierarchy']},
  sorting: {label:'Sort the examples',detail:'Place examples and get feedback',blocks:['sorting']},
  function: {label:'Explore the curve',detail:'Move along a plot to inspect inputs and outputs',blocks:['function_plot']},
  evidence: {label:'Inspect the evidence',detail:'Connect claims to supplied evidence',blocks:['evidence']},
  map: {label:'Explore on a map',detail:'Select a place to learn about it',blocks:['map']},
  scenarios: {label:'Compare two scenarios',detail:'Change one input and see both outcomes',blocks:['linked_scenarios']},
  parts: {label:'See the parts of a whole',detail:'Compare how a whole divides into parts',blocks:['proportion']},
  matrix: {label:'Place it on two dimensions',detail:'See four quadrants side by side',blocks:['matrix']},
  checklist: {label:'Work through a checklist',detail:'Tick off practical steps',blocks:['checklist']},
  flashcards: {label:'Test yourself',detail:'Flip cards to check your recall',blocks:['flashcards']},
  spectrum: {label:'See it on a scale',detail:'Compare where each sits from low to high',blocks:['spectrum']},
  numbers: {label:'See the key numbers',detail:'Focus on the figures that matter',blocks:['key_numbers']},
  orbit: {label:'Explore an orbit', detail:'Adjust the orbit and see what changes', kind:'kepler'},
  projectile: {label:'Try a launch', detail:'Explore speed, angle and gravity', kind:'projectile'}
});

export function slideRecipe(id) {
  return typeof id === 'string' && Object.hasOwn(SLIDE_RECIPES,id) ? SLIDE_RECIPES[id] : undefined;
}

export function validSlideOptions(ids) {
  return Array.isArray(ids) && ids.length <= 3 && new Set(ids).size === ids.length && ids.every(slideRecipe);
}

export function matchesSlideRecipe(preview,recipe) {
  if(recipe.kind) return preview.kind === recipe.kind;
  return !['kepler','projectile'].includes(preview.kind) &&
    recipe.blocks.every(type=>preview.components?.some(block=>block.type===type));
}

export const SLIDE_PICKER_INSTRUCTIONS = 'For an interactive teaching request with an undecided presentation, return the three best distinct slideOptions IDs, ranked by fit. Give fewer when fewer are useful. A chosen audience or simple example does not decide the presentation. Return [] for requests that do not benefit from a slide choice or when the user already specified the presentation. Choose only supported recipes: ' +
  Object.entries(SLIDE_RECIPES).map(([id,recipe])=>id+' ('+recipe.detail+')').join(', ') +
  '. Rank by what the reader needs to see or do. For Kepler’s laws, orbit directly shows orbital motion and equal swept areas, so rank it first when presentation is open. For a general Feynman request, cycle, example and practice may fit. Offer cycle only for steps that repeat; for a one-way process (such as how vaccines work) offer timeline. When the topic has structure to show, prefer a visual recipe (relationships, hotspots, hierarchy, scenarios, prediction) over generic example or practice. Comparing a first attempt and revision favors reveal. Skip the picker when the interaction is already explicit. Only suggest evidence with supporting material, map for real places, chart with suitable numerical data, and orbit/projectile for their supported physics. Omit generic filler.';
