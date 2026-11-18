// Capture explicit preferences independently of the visible draft or inferred intent.
export function confirmedChoices(entries=[]){return entries.filter(e=>e.confirmed).map(({type,phrase,value})=>({type,phrase,value}));}
export function requestContext({draft='',page='',confirmed=[],date='',timezone='',explicitIntent=''}){
 const context={explicitIntent:explicitIntent.slice(0,500),draft:draft.slice(0,2000),page:page.slice(0,3000),confirmed:confirmed.slice(-8),date,timezone};
 // Keep context parseable even for quotes, newlines and long documents.
 while(JSON.stringify(context).length>6000){if(context.page.length)context.page=context.page.slice(0,-300);else if(context.draft.length)context.draft=context.draft.slice(0,-300);else context.confirmed.shift();}
 return JSON.stringify(context);
}
