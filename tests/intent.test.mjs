import test from 'node:test';
import assert from 'node:assert/strict';
import {INFORMATION_TYPES,CONTROL_FAMILIES,validInformation,informationFor,chooseInformation,rebaseInformation,mergeInformation} from '../public/composer/intent.js';
const item=(type,phrase,options=['One','Two'])=>({type,phrase,question:'Which would help?',options,unit:''});
test('all information types map to the registered control families',()=>{
 assert.equal(Object.keys(INFORMATION_TYPES).length,28);
 assert.deepEqual([...new Set(Object.values(INFORMATION_TYPES).map(i=>i.family))].sort(),CONTROL_FAMILIES.toSorted());
 for(const type of Object.keys(INFORMATION_TYPES))assert.ok(validInformation([item(type,'topic')]));
 assert.equal(validInformation([item('arbitrary_script','topic')]),false);
 assert.equal(validInformation(Array(6).fill(item('goal','topic'))),true);assert.equal(validInformation(Array(7).fill(item('goal','topic'))),false);
 assert.equal(validInformation([item('goal','topic',['x'.repeat(101)])]),false);
});
test('confirmation keeps the phrase and replaces its owned parentheses on later choices',()=>{
 const text='Explain Kepler laws.';const entries=informationFor(text,[item('output_format','Kepler laws',['Orbit visualization','Mathematical explanation'])]);
 const first=chooseInformation(text,entries,entries[0].key,'Orbit visualization');
 assert.equal(first.text,'Explain Kepler laws (Orbit visualization).');assert.equal(first.entries[0].confirmed,true);
 const second=chooseInformation(first.text,first.entries,entries[0].key,'Mathematical explanation');
 assert.equal(second.text,'Explain Kepler laws (Mathematical explanation).');
 const clear=chooseInformation(second.text,second.entries,entries[0].key,'');assert.equal(clear.text,text);assert.equal(clear.entries[0].confirmed,false);
});
test('annotations survive unrelated typing, shift with prefixes and are invalidated by phrase edits',()=>{
 const text='Trip to Italy in spring.';const entries=informationFor(text,[item('location','Italy'),item('date_range','spring')]);
 const first=chooseInformation(text,entries,entries[0].key,'Florence');
 const next='Please '+first.text;const rebased=rebaseInformation(first.text,next,first.entries);
 assert.equal(rebased.length,2);assert.equal(next.slice(rebased[0].start,rebased[0].end),'Italy');
 assert.equal(rebaseInformation(first.text,first.text.replace('Italy','Spain'),first.entries).filter(e=>e.type==='location').length,0);
 const second=chooseInformation(first.text,first.entries,entries[1].key,'2027-04-01 to 2027-04-10');assert.ok(second.text.includes('spring (2027-04-01 to 2027-04-10)'));
});
test('new model suggestions cannot replace confirmed choices or annotate absent phrases',()=>{
 const text='Explore physics';const entries=informationFor(text,[item('output_format','physics')]);const selected=chooseInformation(text,entries,entries[0].key,'Interactive visualization');
 const merged=mergeInformation(selected.text,selected.entries,[item('goal','physics'),item('location','Japan')]);
 assert.equal(merged.length,1);assert.equal(merged[0].value,'Interactive visualization');
 assert.equal(chooseInformation(text.replace('physics','chemistry'),entries,entries[0].key,'A'),null);
});
test('user-written parentheses and repeated words are not overwritten or all replaced',()=>{
 const text='Italy (my favorite) or Italy?';const entries=informationFor(text,[item('location','Italy')]);
 const selected=chooseInformation(text,entries,entries[0].key,'Florence');assert.equal(selected.text,'Italy (Florence) (my favorite) or Italy?');
 assert.equal(chooseInformation(text,entries,entries[0].key,'x'.repeat(301)),null);
 assert.equal(chooseInformation(text,entries,entries[0].key,'a\nb'),null);
});

test('model cannot create a refinement inside parenthetical user choices',()=>{
 assert.equal(informationFor('physics (orbit diagram)',[item('goal','orbit diagram')]).length,0);
});

test('temporal quantities use duration controls rather than a count template',()=>{
 const entries=informationFor('We have one week',[{...item('quantity','one week'),unit:'days'}]);assert.equal(entries[0].type,'duration');
});

test('nested model phrases retain separate controls on exact uncovered text',()=>{
 const text='I want to understand Kepler laws. Please explain.';
 const entries=informationFor(text,[item('audience','understand Kepler laws',['School','University']),item('output_format','Kepler laws',['Diagram','Text'])]);
 assert.equal(entries.length,2);assert.equal(entries[0].phrase,'understand');assert.equal(entries[1].phrase,'Kepler laws');
 assert.ok(entries[0].end<=entries[1].start);assert.deepEqual(entries[0].options,['School','University']);
});

test('audience and format on the same topic can use a distinct teaching verb',()=>{
 const entries=informationFor('Explain Kepler laws',[item('audience','Kepler laws'),item('output_format','Kepler laws')]);
 assert.equal(entries.length,2);assert.equal(entries[0].phrase,'Explain');assert.equal(entries[1].phrase,'Kepler laws');
});

test('tone samples stay aligned with choices and are excluded from the applied draft',()=>{
 const item={type:'tone',phrase:'email',question:'Which tone?',options:['Warm','Formal'],samples:['Thanks for helping.','Thank you for your assistance.'],unit:''};
 const draft='Write an email';
 const entries=informationFor(draft,[item]);
 assert.deepEqual(entries[0].samples,item.samples);
 assert.equal(chooseInformation(draft,entries,entries[0].key,'Formal').text,'Write an email (Formal)');
 assert.equal(validInformation([{...item,samples:['One','Two','Unpaired']}]),false);
});
