export const PROTOTYPES=[
 {id:'focus',name:'Focus',hint:'Live help, kept quiet.'},
 {id:'complete',name:'Complete',hint:'A suggested next sentence. Tab to accept.'},
 {id:'lens',name:'Lens',hint:'Select words in the request or page for automatic help.'},
 {id:'notebook',name:'Notebook',hint:'Edit the page. Review a small suggestion in the margin.'},
 {id:'canvas',name:'Canvas',hint:'See a proposed structure; explore the page visually.'}
];
export const PROTOTYPE_IDS=PROTOTYPES.map(p=>p.id);
export function canAcceptCompletion({text,start,end,completion,composing=false,modified=false}){
 return !composing&&!modified&&typeof completion==='string'&&!!completion.trim()&&completion.length<=180&&start===end&&end===text.length&&text.length+completion.length+1<=4000;
}
export function validAssistResult(value){return !!value&&typeof value.answer==='string'&&value.answer.length<=700&&typeof value.replacement==='string'&&value.replacement.length<=2000;}
export function currentTarget({requestVersion,currentVersion,before,current,connected=true}){return connected&&requestVersion===currentVersion&&before===current;}
