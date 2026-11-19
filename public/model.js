import {validComponents,validSlideOptions} from './component-catalog.js';
import {validInformation} from './intent.js';
export const FORMATS = ['Auto','Interactive page', 'Diagram', 'Outline'];
export function isIncompleteComparison(text){
 const draft=text.trim().replace(/[\s.…]+$/u,'');
 return /\bbetween\s+[^.!?]+\s+and$/iu.test(draft)||
  /\b(?:compare|contrast)\s+[^.!?]+\s+(?:with|to|and)$/iu.test(draft)||
  /\S\s+(?:versus|vs)$/iu.test(draft);
}
// Continuous typing asks Luna for help after this many newly completed words.
export const PREVIEW_WORD_STEP=4;
export function draftWordCount(text){
 return (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu)||[]).length;
}

export function completedDraft(text){
 return text.replace(/[\p{L}\p{M}\p{N}'’-]+$/u,'').trim();
}

export function extendsPreview(snapshot,current){
 if(current===snapshot)return true;
 if(!current.startsWith(snapshot))return false;
 const tail=current.slice(snapshot.length);
 return !(/[\p{L}\p{N}]$/u.test(snapshot)&&/^[\p{L}\p{M}\p{N}]/u.test(tail))&&
  !/\b(?:actually|instead|rather than|forget that|ignore that)\b/iu.test(tail);
}

export function draftAnswersQuestion(entry,tail){
 const normalize=text=>' '+(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).join(' ')+' ';
 const added=normalize(tail);
 const answered=(entry.options||[]).some(option=>option.split(/\s+(?:and|or)\s+|\//iu).some(value=>{
  const term=normalize(value.trim());
  return term.trim().length>=2&&added.includes(term);
 }));
 const durationGiven=/\b(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:hours?|days?|weeks?|months?|years?)\b/iu.test(tail);
 const asksDuration=entry.type==='duration'||/\b(?:trip length|how long|how many days|duration)\b/iu.test(entry.question||'');
 return answered||(durationGiven&&asksDuration);
}

export function workingDraftPreview(data,snapshot,current){
 const tail=current.slice(snapshot.length);
 const haveAnchor=entry=>entry.phrase?.trim()&&snapshot.includes(entry.phrase)&&!draftAnswersQuestion(entry,tail);
 const question=data.questionKind!=='explore'&&haveAnchor(data)?data.question:'';
 return {...data,body:draftWordCount(tail)<=12?data.body:[],question,phrase:question?data.phrase:'',
  options:question?data.options:[],information:(data.information||[]).filter(item=>item.type!=='output_format'&&haveAnchor(item)),
  completion:'',interpretation:'',slideOptions:[]};
}

export function freshCompletion(text,suggestion){
 if(typeof suggestion!=='string'||suggestion.length>180)return '';
 const normalize=value=>(value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'")
  .match(/[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{M}\p{N}]+)*|[+−*/%^=<>×÷-]/gu)||[]).join(' ');
 const candidate=normalize(suggestion);
 if(!candidate||(' '+normalize(text)+' ').includes(' '+candidate+' '))return '';
 return suggestion.trim();
}
export function canAcceptCompletion({text,start,end,completion,composing=false,modified=false}){
 return !composing&&!modified&&start===end&&end===text.length&&!!freshCompletion(text,completion)&&text.length+completion.length+1<=4000;
}
export function clarificationFor(text) {
  if(text.trim().length<8)return null;
  const rules=[
    {regex:/\bphysics\b/i,question:'Which part of physics?',options:['Projectile motion','Energy','Waves'],replace:true},
    {regex:/\bexpensive\b/i,question:'What do you mean by expensive?',options:['Purchase price','Running costs','Valuation'],replace:false},
    {regex:/\b(?:explain|understand)\b/i,question:'What kind of explanation would help?',options:['Simple intuition','With examples','With the mathematics'],replace:false}
  ];
  for(const r of rules){const m=r.regex.exec(text);if(!m)continue;if(!r.replace&&/\b(?:simple intuition|with examples|mathematics|purchase price|running costs|valuation)\b/i.test(text))continue;return {start:m.index,end:m.index+m[0].length,phrase:m[0],question:r.question,options:r.options,replace:r.replace};}
  return null;
}
// Live ambiguity comes from the response for the complete current draft, not keyword rules.
export function liveClarificationFor(text, data, entries=[]) {
  const priority=entries.find(e=>e.type==='audience'&&!e.confirmed&&e.question)||entries.find(e=>e.type==='prior_knowledge'&&!e.confirmed&&e.question);
  const questionKey=value=>value.trim().toLowerCase().replace(/[?.!]+$/,'');
  const asksAudience=question=>/\b(?:audience|who\b.*(?:\bfor\b|\blearn\b|\bread\b))\b/i.test(question);
  const clean=values=>[...new Map((values||[]).filter(value=>value.trim()).map(value=>[value.trim().toLowerCase(),value.trim()])).values()].slice(0,3);
  const withOptions=entry=>{
    if(!entry)return null;
    if(entry.samples?.length)return {...entry,options:entry.options.slice(0,3),samples:entry.samples.slice(0,3)};
    const sameQuestion=item=>item?.question&&questionKey(item.question)===questionKey(entry.question);
    const supplied=sameQuestion(data)?data.options:[];
    const descriptor=data?.information?.find(sameQuestion);
    const options=clean([...(supplied||[]),...(entry.options||[]),...(descriptor?.options||[])]);
    if(options.length||entry.questionKind==='explore')return {...entry,options};
    const question=entry.question;
    let presets=[];
    if(/\bcalculus\b/i.test(question))presets=['No calculus','Basic derivatives','Full derivation'];
    else if(asksAudience(question)&&/\b(?:explain|learn|teach|understand)\b/i.test(text))presets=['Middle school','High school','University'];
    else if(/\b(?:what matters most|prioritiz\w*)\b/i.test(question)&&/\b(?:trip|travel|itinerary)\b/i.test(text))presets=['Lower cost','Less travel time','More to see'];
    return {...entry,options:presets};
  };
  if(!data?.question?.trim())return withOptions(priority);
  // Missing learning context takes priority over an optional exploration.
  if(data.questionKind==='explore')return withOptions(priority||{question:data.question,questionKind:'explore',phrase:null,global:true,replace:false});
  const audience=asksAudience(data.question);
  const matching=entries.find(e=>questionKey(e.question)===questionKey(data.question))||
    (audience&&entries.find(e=>e.type==='audience'));
  if(matching)return matching.confirmed?null:withOptions({...matching,questionKind:'clarify'});
  const phrase=typeof data.phrase==='string'?data.phrase.trim():'';
  const start=phrase?text.indexOf(phrase):-1;
  const audienceChoice=audience?{
    type:'audience',value:'',annotation:'',unit:'',confirmed:false,
    ...(start>=0?{key:'audience:'+start}:{global:true})
  }:{};
  return withOptions({...audienceChoice,question:data.question,questionKind:'clarify',phrase:start>=0?phrase:null,
    ...(start>=0?{start,end:start+phrase.length}:{}),replace:false});
}
export function compactLiveAnswer(data){
  const text=(data.body?.join(' ')||'').replace(/\s+/g,' ').trim();
  const first=text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  if(first&&first.length<=160)return first;
  return text.length<=160?text:text.slice(0,157).replace(/\s+\S*$/,'')+'…';
}
export function isCurrentPreview(requestRevision, currentRevision, signal) {
  return requestRevision===currentRevision&&!signal?.aborted;
}
export function quickAnswer(text) {
  if(/projectile|trajectory|gravity/i.test(text))return 'In an ideal projectile, horizontal speed stays constant while gravity changes vertical speed. Together, they produce a curved path.';
  if(/\bphysics\b/i.test(text))return 'Physics studies how matter, motion and energy behave. A specific example can make the idea easier to explore.';
  if(/presentation|slides/i.test(text))return 'A useful starting point is one main idea, who it is for, and what you want them to take away.';
  if(/compar|versus|\bvs\b/i.test(text))return 'A clear comparison starts with the same criteria for both options. Decide what matters before choosing a winner.';
  return '';
}
export function trajectory(speed, angle, gravity) {
  const v = Math.max(1, Math.min(30, Number(speed) || 20));
  const a = Math.max(5, Math.min(85, Number(angle) || 45)) * Math.PI / 180;
  const g = Math.max(1, Math.min(25, Number(gravity) || 9.81));
  const duration = 2 * v * Math.sin(a) / g;
  const range = v * Math.cos(a) * duration;
  const height = (v * Math.sin(a)) ** 2 / (2 * g);
  const points = Array.from({length: 61}, (_, i) => {
    const t = duration * i / 60;
    return {x: v * Math.cos(a) * t, y: Math.max(0, v * Math.sin(a) * t - .5 * g * t * t)};
  });
  return {duration, range, height, points};
}
export function demoPreview(text, audience = '', format = 'Interactive page') {
  const physics = /projectile|trajectory|throw|launch|motion|gravity/i.test(text);
  const compare = /compar|versus|\bvs\b/i.test(text);
  const presentation = /presentation|slides|release process/i.test(text);
  const kind = physics ? 'projectile' : 'outline';
  const topic = physics ? 'Projectile motion' : compare ? 'Two approaches, side by side' : presentation ? 'A clearer release process' : 'Give your idea some shape';
  return {
    kind, title: topic,
    interpretation: physics ? 'Explore how launch speed, angle and gravity shape a trajectory.' : compare ? 'Compare two approaches using criteria you can edit.' : presentation ? 'Build a presentation you can arrange and refine.' : 'Explore an idea through a small, editable concept map.',
    audience, question: '', phrase:'', options: [],
    body: physics ? ['Horizontal motion stays uniform while gravity changes vertical velocity. Try changing one variable at a time.', 'This ideal model ignores air resistance and assumes launch and landing at the same height.'] : presentation ? ['Why this matters — define the purpose of the release process.', 'How work moves — describe the stages using your own team’s practices.', 'Who owns what — add the people responsible at each stage.', 'What happens next — agree on the next useful action.'] : ['Replace these starter labels with your own ideas.', 'Choose a part to explore it in more detail.'],
    nodes: physics ? ['Launch', 'Highest point', 'Landing'] : presentation ? ['Plan', 'Review', 'Release'] : ['The idea', 'What changes', 'What it means'],
    rows: [{criterion:'What matters most',a:'Add your criteria',b:'Add your criteria'},{criterion:'Trade-offs',a:'What do you gain?',b:'What do you give up?'},{criterion:'Next step',a:'What would you test?',b:'What would you test?'}]
  };
}
export function validPreview(v) {
  const short = (s, max) => typeof s === 'string' && s.length <= max;
  return !!v && (v.followUps===undefined||(Array.isArray(v.followUps)&&v.followUps.length<=3&&v.followUps.every(s=>short(s,90)))) && (v.slideOptions===undefined||validSlideOptions(v.slideOptions)) && (v.components===undefined||validComponents(v.components)) && (v.questionKind===undefined||['clarify','explore','none'].includes(v.questionKind)) && (v.completion===undefined||short(v.completion,180)) && (v.replacement===undefined||short(v.replacement,2000)) && (v.information===undefined||validInformation(v.information)) && ['projectile','outline','planner','kepler'].includes(v.kind)
    && (v.phrase===undefined||short(v.phrase,120)) && short(v.title,160) && short(v.interpretation,500) && short(v.audience,120) && short(v.question,200)
    && Array.isArray(v.options) && v.options.length <= 3 && v.options.every(s=>short(s,80))
    && Array.isArray(v.body) && v.body.length <= 6 && v.body.every(s=>short(s,700))
    && Array.isArray(v.nodes) && v.nodes.length <= 6 && v.nodes.every(s=>short(s,80))
    && Array.isArray(v.rows) && v.rows.length <= 6 && v.rows.every(r=>r && short(r.criterion,80)&&short(r.a,300)&&short(r.b,300));
}

// Pages with a visual keep prose short: an introduction plus up to three takeaways,
// each cut at a sentence boundary. Kepler and projectile pages keep their own rules.
const PAGE_TEXT_LIMIT=240;
function firstSentences(text,max=PAGE_TEXT_LIMIT){
 const value=text.trim();
 if(value.length<=max)return value;
 const cut=value.slice(0,max);
 const end=Math.max(...['. ','! ','? '].map(mark=>cut.lastIndexOf(mark)));
 return end>=40?cut.slice(0,end+1):value;
}
export function tidyPage(page){
 if(!page||!Array.isArray(page.body)||!page.components?.length)return page;
 const [intro='',...rest]=page.body;
 return {...page,body:[firstSentences(intro),...rest.slice(0,3).map(text=>firstSentences(text))].filter((text,i)=>i===0||text)};
}
