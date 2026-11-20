// The model chooses data and supported interactions, never HTML, scripts or handlers.
export const COMPONENT_TYPES=['cycle','graph','timeline','comparison','chart','worked_example','practice','hotspot_diagram','parameter_explorer','prediction',
  'decision_tree','before_after','hierarchy','sorting','function_plot','evidence','map','linked_scenarios',
  'proportion','matrix','checklist','flashcards','spectrum','key_numbers'];
const str={type:'string'};
export const COMPONENT_SCHEMA={type:'object',additionalProperties:false,properties:{id:str,type:{type:'string',enum:COMPONENT_TYPES},title:str,prompt:str,items:{type:'array',items:{type:'object',additionalProperties:false,properties:{label:str,detail:str,value:{type:'number'},latitude:{type:['number','null']},longitude:{type:['number','null']}},required:['label','detail','value','latitude','longitude']}},edges:{type:'array',items:{type:'object',additionalProperties:false,properties:{from:{type:'integer'},to:{type:'integer'},label:str},required:['from','to','label']}}},required:['id','type','title','prompt','items','edges']};
// Data on a scale, chart, map or timeline often grows by one ("Also add Reykjavik"), so these hold up to 8 items.
const LONG_LISTS=['chart','spectrum','map','timeline'];
const short=(v,n)=>typeof v==='string'&&v.length<=n;
const PLOT_FUNCTIONS=['linear','square','cube','absolute','sine'];
const FUNCTION_NAMES={linear:'linear',square:'square',quadratic:'square',cube:'cube',cubic:'cube',absolute:'absolute',abs:'absolute',sine:'sine',sin:'sine'};

// The model sometimes decorates a function name ("sine (radians)", "Square function").
// Reduce it to the one supported name it contains; anything ambiguous is left for validation to reject.
export function normaliseComponents(list){
  if(!Array.isArray(list))return list;
  return list.map(c=>{
    if(c?.type!=='function_plot'||typeof c.prompt!=='string'||PLOT_FUNCTIONS.includes(c.prompt))return c;
    const found=new Set((c.prompt.toLowerCase().match(/[a-z]+/g)||[]).map(word=>FUNCTION_NAMES[word]).filter(Boolean));
    return found.size===1?{...c,prompt:[...found][0]}:c;
  });
}

// A page has up to three components, shown one at a time as views (tabs).
export const MAX_COMPONENTS=3;
export function validComponents(list){return Array.isArray(list)&&list.length<=MAX_COMPONENTS&&new Set(list.map(c=>c?.id)).size===list.length&&list.every(c=>c&&Object.keys(c).every(k=>['id','type','title','prompt','items','edges'].includes(k))&&typeof c.id==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(c.id)&&!['constructor','prototype','__proto__'].includes(c.id)&&COMPONENT_TYPES.includes(c.type)&&short(c.title,100)&&short(c.prompt,200)&&Array.isArray(c.items)&&c.items.length>=2&&c.items.length<=(LONG_LISTS.includes(c.type)?8:6)&&c.items.every(i=>i&&Object.keys(i).every(k=>['label','detail','value','latitude','longitude'].includes(k))&&short(i.label,80)&&short(i.detail,600)&&Number.isFinite(i.value)&&Math.abs(i.value)<=1000000)&&Array.isArray(c.edges)&&c.edges.length<=8&&c.edges.every(e=>e&&Object.keys(e).every(k=>['from','to','label'].includes(k))&&Number.isInteger(e.from)&&Number.isInteger(e.to)&&e.from>=0&&e.to>=0&&e.from<c.items.length&&e.to<c.items.length&&short(e.label,80))&&validInteraction(c));}
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
  if(type==='function_plot')return items.length===2 && PLOT_FUNCTIONS.includes(prompt) &&
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
// Ordered by what the user wants to see or do, so the model picks the component that fits the
// request instead of the few it knows best. One-line examples guide without a page to copy.
export const CATALOG_INSTRUCTIONS=[
 'VISUAL COMPONENTS. components holds 0-3 blocks. One is usual. Add a second or third only when each answers a different question about the same request (where, when, how much; learn, then check yourself); they appear as tabs, one at a time, most important first. Never show the same information twice, across blocks or in the prose. Text-only is right for a message or email. Leave components empty in typing previews.',
 'CHOOSE BY WHAT THE USER WANTS TO SEE OR DO:',
 '- Places, a trip or a route: map. For stops visited in order set prompt to "route" and say in each detail what to do there. A trip usually adds a timeline of the days.',
 '- Steps, a schedule or a plan over time: timeline, one item per step, day or week. cycle only when the last step leads back to the first (the water cycle).',
 '- Choosing between options: comparison (2-3 alternatives, each detail its key trade-off), decision_tree (choices that branch to an answer), matrix (four options on two criteria).',
 '- Numbers: chart (grounded values to compare), proportion (parts of one whole), key_numbers (2-4 headline figures), spectrum (positions on a scale).',
 '- How something works: hotspot_diagram (parts and their real connections), graph (relationships between ideas), hierarchy (a whole broken into parts), cycle.',
 '- What if: parameter_explorer (one numeric input changes the outcome), linked_scenarios (one input, two outcomes side by side).',
 '- Doing it: checklist (2-6 practical steps to tick off), worked_example (a solved problem in steps).',
 '- Checking yourself: flashcards, prediction (one question, several answers), sorting (put examples in groups), practice (explain it in your own words).',
 '- Also: evidence (sources for a claim), before_after (a change), function_plot (a maths function).',
 'EXAMPLES, one per component (shapes, not templates; pick what fits the actual request):',
 '“Two days in Kyoto and Osaka” → map (prompt route) + timeline of the days. “Learn to swim in six weeks” → timeline of the weeks + checklist for each session. “Bake bread for a party of ten” → timeline of the baking + key_numbers for the amounts. “Largest countries by area” → chart + map. “How does the water cycle work?” → cycle. “How does the stock market work?” → graph of how companies, investors and prices relate. “The parts of an eye” → hotspot_diagram. “How is the EU organised?” → hierarchy. “Electric car or hybrid for my family?” → decision_tree on charging and trip length, + comparison. “Which marketing ideas are quick wins?” → matrix of effort and impact. “How is a monthly budget split?” → proportion. “Where do common drinks sit on the pH scale?” → spectrum. “Explain compound interest” → worked_example with numbers. “Help me explain osmosis in my own words” → practice. “Quiz me on gravity on the Moon” → prediction. “Which animals are mammals or reptiles?” → sorting. “How does the interest rate change my mortgage payment?” → parameter_explorer. “Save 200 or 100 a month for ten years?” → linked_scenarios. “How did my sentence change?” → before_after. “Is this claim true? Sources: …” → evidence, citing only the sources given. “Show me the sine function” → function_plot. “Spanish phrases for a trip” → flashcards. “Should I rent or buy?” → comparison. “Get ready for a job interview” → checklist.',
 'BLOCK FORMAT. Each block has a unique lowercase-hyphen id (keep existing ids when updating a block), type, title (a short name of at most 24 characters, also its tab label: “Your route”, “Costs”, “Check yourself”), prompt (empty unless the type uses it), items (2-6 label/detail/value records; a chart, spectrum, map or timeline may have 7-8 when the data needs them or the user adds to it; never two things in one item) and edges (0-8 indexed from/to/label connections). Item labels are 1-4 words. Each detail is the one-sentence caption shown when that item is selected (max 140 characters), at the requested audience level. Use value 0 and latitude/longitude null unless the type needs them. Include only grounded data; never invent measurements, evidence or sources. Return no executable code, HTML or handlers.',
 'TYPE RULES. graph and hotspot_diagram need edges. chart: value is the number. map: accurate latitude and longitude for every item. parameter_explorer: prompt names the parameter and units; items are scenarios in strictly increasing value, label shows the input, detail explains the outcome. prediction: prompt is the question; exactly one item has value 1, the others 0; each detail says why it is right or wrong. decision_tree and hierarchy: one rooted tree from item 0, edges = items - 1; edge labels are branch choices. before_after: two items in before, after order, each with a detail. sorting: items with value 1 are group headings, value 0 are examples, one edge from each example to its group; detail explains the answer. function_plot: prompt is exactly one of linear, square, cube, absolute, sine; two items give the domain endpoints (value, within -100 to 100). evidence: edges from the claim to each evidence item, labelled with the source; cite only provided sources. linked_scenarios: prompt names the shared input; increasing item.value; each detail is “Scenario A: outcome | Scenario B: outcome”. proportion: each value is a positive share. matrix: exactly four items in the order top-left, top-right, bottom-left, bottom-right; prompt is “x-axis label | y-axis label”, right and up are high. checklist and flashcards: 2-6 items (flashcards: question as label, answer as detail). spectrum: prompt is “low end | high end”, value is the position from 0 to 100. key_numbers: 2-4 items, value is the number, prompt an optional unit of at most 20 characters. worked_example and practice: prompt may hold the learner question.'
].join('\n');

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

export const SLIDE_FORMAT_INSTRUCTIONS = 'For an interactive teaching request with an undecided presentation, return the three best distinct slideOptions IDs, ranked by fit. Give fewer when fewer are useful. A chosen audience or simple example does not decide the presentation. Return [] for requests that do not benefit from a slide choice or when the user already specified the presentation. Choose only supported recipes: ' +
  Object.entries(SLIDE_RECIPES).map(([id,recipe])=>id+' ('+recipe.detail+')').join(', ') +
  '. Rank by what the reader needs to see or do. For Kepler’s laws, orbit directly shows orbital motion and equal swept areas, so rank it first when presentation is open. For a general Feynman request, cycle, example and practice may fit. Offer cycle only for steps that repeat; for a one-way process (such as how vaccines work) offer timeline. When the topic has structure to show, prefer a visual recipe (relationships, hotspots, hierarchy, scenarios, prediction) over generic example or practice. Comparing a first attempt and revision favors reveal. Skip the picker when the interaction is already explicit. Only suggest evidence with supporting material, map for real places, chart with suitable numerical data, and orbit/projectile for their supported physics. Omit generic filler.';
