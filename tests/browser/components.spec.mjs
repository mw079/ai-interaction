// Every interactive component is checked on what it draws, not only on its text: when a control
// changes, the visual must change in proportion to the data (see DESIGN.md, "truthful visuals").
// Uses the component gallery and its sample data (dev/component-fixtures.js).
import {expect,test} from '@playwright/test';
import {startFixtureServer} from './fixture-server.mjs';
import {SPECIMENS} from '../../dev/component-fixtures.js';

let server;
test.beforeAll(async()=>{server=await startFixtureServer();});
test.afterAll(async()=>{await server?.close();});
test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(server.url+'/__dev/components');
  await expect(page.locator('.dg-stage').first()).toBeVisible();
});

const data=name=>SPECIMENS.find(s=>s.name===name).block;
const card=(page,name)=>page.locator('.specimen').filter({has:page.getByRole('heading',{name,exact:true})});
const caption=(page,name)=>card(page,name).locator('.dg-caption');
const box=async locator=>{const b=await locator.boundingBox();return b;};
const near=(actual,expected,tolerance)=>expect(Math.abs(actual-expected),`${actual} ≈ ${expected}`).toBeLessThanOrEqual(tolerance);

test('cycle: the selected step, its outgoing arrow, the centre count and the caption move together',async({page})=>{
  const c=card(page,'Cycle'),block=data('Cycle');
  await c.getByRole('button',{name:/Precipitation/}).click();
  await expect(c.getByRole('button',{name:/Precipitation/})).toHaveAttribute('aria-pressed','true');
  expect(await c.locator('.dg-arc').evaluateAll(arcs=>arcs.findIndex(a=>a.classList.contains('dg-on')))).toBe(2);
  await expect(c.locator('.dg-hub-num')).toHaveText('Step 3 of 4');
  await expect(caption(page,'Cycle')).toHaveText(block.items[2].detail);
  await c.locator('.dg-stage').press('ArrowRight');
  await c.locator('.dg-stage').press('ArrowRight');
  await expect(c.locator('.dg-hub-num')).toHaveText('Step 1 of 4');   // the loop wraps around
});

test('process: the progress line reaches exactly the selected stop',async({page})=>{
  const c=card(page,'Process'),n=data('Process').items.length;
  for(const index of [0,2,4]){
    await c.locator('.dg-stop').nth(index).click();
    if(await c.locator('.dg-progress').isVisible()){
      const list=await box(c.locator('.dg-track-list')),progress=await box(c.locator('.dg-progress'));
      near(progress.width,(list.width-list.width/n)*index/(n-1),2);
      const dot=await box(c.locator('.dg-stop .dg-dot').nth(index));
      near(progress.x+progress.width,dot.x+dot.width/2,2);   // the line ends at the stop's centre
    }
    await expect(c.locator('.dg-stop').nth(index)).toHaveAttribute('aria-pressed','true');
    await expect(c.locator('.dg-stop.dg-past')).toHaveCount(index);
  }
});

test('process: six steps in a narrow column stack vertically and no labels overlap',async({page})=>{
  for(const width of [330,640]){
    const result=await page.evaluate(async width=>{
      const {renderComponent}=await import('/components/renderer.js');
      const host=document.createElement('div');host.style.width=width+'px';document.body.append(host);
      const labels=['Introduction','Committee review','Chamber votes','Resolve differences','President’s decision','Veto paths'];
      renderComponent(host,{id:'law',type:'timeline',title:'A bill’s path',prompt:'',items:labels.map(label=>({label,detail:label+'.',value:0})),edges:[]},{edits:{}},{onEdit(){},ask(){}});
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const stage=host.querySelector('.dg-process');
      // Measure the rendered words, not their boxes: long labels spill out of a narrow step.
      const boxes=[...stage.querySelectorAll('.dg-label')].flatMap(label=>{const range=document.createRange();range.selectNodeContents(label);return [...range.getClientRects()];});
      const overlap=boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1));
      host.remove();
      return {vertical:stage.classList.contains('dg-vertical'),overlap};
    },width);
    expect(result.overlap,`labels overlap at ${width}px`).toBe(false);
    expect(result.vertical).toBe(width<6*90+60);
  }
});

test('chart: bar lengths are proportional to the values',async({page})=>{
  const c=card(page,'Chart'),values=data('Chart').items.map(i=>i.value),max=Math.max(...values);
  const widths=await c.locator('.dg-bar').evaluateAll(bars=>bars.map(b=>b.getBoundingClientRect().width));
  const track=(await box(c.locator('.dg-bar-track').first())).width;
  values.forEach((v,i)=>near(widths[i],track*v/max,1.5));
  await c.getByRole('button',{name:/Jupiter/}).click();
  await expect(caption(page,'Chart')).toHaveText(data('Chart').items[4].detail);
});

test('proportion: segments are proportional to their shares and the percentages are right',async({page})=>{
  const c=card(page,'Proportion'),items=data('Proportion').items,total=items.reduce((s,i)=>s+i.value,0);
  const widths=await c.locator('.dg-seg-part').evaluateAll(parts=>parts.map(p=>p.getBoundingClientRect().width));
  const bar=await box(c.locator('.dg-stack'));
  const gaps=2*(items.length-1),usable=bar.width-gaps;
  // Large shares are exact; tiny shares get a visible minimum width, so allow for what they take.
  const minimum=6,tiny=items.filter(i=>i.value/total*usable<minimum).length;
  items.forEach((item,i)=>{if(item.value/total>0.05)near(widths[i],item.value/total*usable,tiny*minimum+1);});
  await expect(c.locator('.dg-legend-row .dg-bar-value')).toHaveText(['78%','21%','0.9%','0.04%']);
});

test('hierarchy and decision tree: the highlighted path leads from the root to the selection',async({page})=>{
  const c=card(page,'Decision tree');
  await c.getByRole('button',{name:'Call and start CPR'}).click();
  await expect(c.locator('.dg-link.dg-on')).toHaveCount(2);              // root → breathing → CPR
  await expect(c.locator('.dg-edge-label.dg-on')).toHaveText(['No response','Not breathing']);
  await expect(c.locator('.dg-trail')).toHaveText(['Check for a response','Check breathing']);
  const h=card(page,'Hierarchy');
  await h.getByRole('button',{name:'Granite'}).click();
  await expect(h.locator('.dg-link.dg-on')).toHaveCount(2);
});

test('concept map and labelled diagram: the selected idea moves to the centre with only its own connections',async({page})=>{
  for(const [name,node] of [['Concept map','Glucose'],['Labelled diagram','Lungs']]){
    const c=card(page,name),block=data(name),index=block.items.findIndex(i=>i.label===node);
    const edges=block.edges.filter(e=>e.from===index||e.to===index);
    await c.getByRole('button',{name:node,exact:true}).click();
    await page.waitForTimeout(600);
    const stage=await box(c.locator('.dg-stage')),pressed=await box(c.locator('.dg-node[aria-pressed="true"]'));
    near(pressed.x+pressed.width/2,stage.x+stage.width/2,2);
    near(pressed.y+pressed.height/2,stage.y+stage.height/2,2);
    await expect(c.locator('.dg-link')).toHaveCount(edges.length);
    await expect(c.locator('.dg-edge-label')).toHaveText(edges.map(e=>e.label).filter(Boolean),{useInnerText:false});
    const neighbours=new Set(edges.flatMap(e=>[e.from,e.to]));
    await expect(c.locator('.dg-node.dg-dim')).toHaveCount(block.items.length-neighbours.size);
  }
});

test('parameter explorer and linked scenarios: the slider sets the readout and the outcome',async({page})=>{
  const p=card(page,'Parameter explorer');
  await p.getByRole('slider').fill('2');
  await expect(p.locator('.dg-readout')).toHaveText('3,000 m');
  await expect(caption(page,'Parameter explorer')).toHaveText(data('Parameter explorer').items[2].detail);
  const s=card(page,'Linked scenarios');
  await s.getByRole('slider').fill('2');
  await expect(s.locator('.dg-readout')).toHaveText('500 €');
  await expect(s.locator('.dg-lane-text')).toHaveText(['about 63,000 €','about 81,900 €']);
});

test('function plot: the point stays on the curve and the readout matches the formula',async({page})=>{
  const c=card(page,'Function plot'),stage=c.locator('.dg-plot');
  await stage.focus();
  for(let i=0;i<10;i++)await stage.press('ArrowRight');
  const readout=await c.locator('.dg-readout').textContent();
  const [x,y]=readout.match(/-?\d+(?:\.\d+)?/g).map(Number);
  near(y,x*x,0.02);
  const onCurve=await c.evaluate(card=>{
    const dot=card.querySelector('.dg-dot-point'),path=card.querySelector('.dg-curve');
    const cx=+dot.getAttribute('cx'),cy=+dot.getAttribute('cy');
    const points=path.getAttribute('d').slice(1).split('L').map(p=>p.trim().split(' ').map(Number));
    return Math.min(...points.map(([px,py])=>Math.hypot(px-cx,py-cy)));
  });
  expect(onCurve).toBeLessThan(2);
});

test('map: every pin sits at its latitude and longitude',async({page})=>{
  const c=card(page,'Map'),items=data('Map').items;
  const pins=await c.evaluate(card=>{
    const [vx,vy,w,h]=card.querySelector('.dg-svg').getAttribute('viewBox').split(' ').map(Number);
    return [...card.querySelectorAll('.dg-pin')].map(p=>({lon:vx+parseFloat(p.style.left)/100*w-180,lat:90-(vy+parseFloat(p.style.top)/100*h)}));
  });
  items.forEach((item,i)=>{near(pins[i].lon,item.longitude,0.01);near(pins[i].lat,item.latitude,0.01);});
});

test('spectrum: each marker sits at its value on the scale',async({page})=>{
  const c=card(page,'Spectrum'),items=[...data('Spectrum').items].sort((a,b)=>a.value-b.value);
  const track=await box(c.locator('.dg-spectrum-track'));
  const dots=await c.locator('.dg-mark-dot').evaluateAll(d=>d.map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2;}));
  items.forEach((item,i)=>near((dots[i]-track.x)/track.width,item.value/100,0.01));
});

test('checklist: the progress bar and count follow the ticked steps',async({page})=>{
  const c=card(page,'Checklist'),n=data('Checklist').items.length;
  await c.getByRole('button',{name:'Done: Read the whole lease'}).click();
  await c.getByRole('button',{name:'Done: Confirm the costs'}).click();
  await expect(c.locator('.dg-index')).toHaveText(`2 of ${n} done`);
  const bar=await box(c.locator('.dg-meter')),fill=await box(c.locator('.dg-meter-fill'));
  near(fill.width,bar.width*2/n,1.5);
  await c.getByRole('button',{name:'Done: Read the whole lease'}).click();
  await expect(c.locator('.dg-index')).toHaveText(`1 of ${n} done`);
});

test('prediction: checking reveals the right answer and the reason',async({page})=>{
  const c=card(page,'Prediction'),items=data('Prediction').items;
  await c.getByRole('button',{name:/The bowling ball/}).click();
  await c.getByRole('button',{name:'Check answer'}).click();
  await expect(c.locator('.dg-option.dg-wrong')).toContainText('The bowling ball');
  await expect(c.locator('.dg-option.dg-right')).toContainText('They land together');
  await expect(c.locator('.dg-quiz-result')).toHaveText('Not quite. '+items[1].detail);
  await c.getByRole('button',{name:'Try again'}).click();
  await c.getByRole('button',{name:/They land together/}).click();
  await c.getByRole('button',{name:'Check answer'}).click();
  await expect(c.locator('.dg-quiz-result')).toHaveText('Correct. '+items[1].detail);
});

test('sorting: wrong placements are refused, right ones land in their group',async({page})=>{
  const c=card(page,'Sorting');
  await c.getByRole('button',{name:'Ice cube'}).click();
  await c.getByRole('button',{name:'Liquid'}).click();
  await expect(c.locator('.dg-caption')).toContainText('Not quite');
  await expect(c.locator('.dg-tray').getByRole('button',{name:'Ice cube'})).toBeVisible();
  for(const [example,group] of [['Ice cube','Solid'],['Olive oil','Liquid'],['Steam','Gas']]){
    await c.getByRole('button',{name:example}).click();
    await c.getByRole('button',{name:group}).click();
    await expect(c.locator('.dg-bin').filter({hasText:group}).locator('.dg-placed')).toContainText(example);
  }
  await expect(c.locator('.dg-sort-progress')).toHaveText('All 3 sorted.');
});

test('before/after, flashcards, worked example and practice reveal the right content',async({page})=>{
  const ba=card(page,'Before / after'),pair=data('Before / after').items;
  await ba.getByRole('tab',{name:'After'}).click();
  await expect(ba.locator('.dg-version-body')).toHaveText(pair[1].detail);
  const f=card(page,'Flashcards'),cards=data('Flashcards').items;
  await f.locator('.dg-flashcard').click();
  await expect(f.locator('.dg-flashcard')).toHaveClass(/dg-flipped/);
  await expect(f.locator('.dg-flash-back')).toContainText(cards[0].detail);
  await f.getByRole('button',{name:'Next'}).click();
  await expect(f.locator('.dg-flashcard')).not.toHaveClass(/dg-flipped/);   // a new card starts on its question
  await expect(f.locator('.dg-flash-front')).toContainText(cards[1].label);
  const w=card(page,'Worked example');
  await expect(w.locator('.dg-step-row:visible')).toHaveCount(1);
  await w.getByRole('button',{name:/Show step 2/}).click();
  await w.getByRole('button',{name:/Show step 3/}).click();
  await expect(w.locator('.dg-step-row:visible')).toHaveCount(3);
  await expect(w.getByRole('textbox',{name:/Your explanation/})).toBeVisible();
  const pr=card(page,'Practice');
  await pr.getByRole('button',{name:'Show a hint'}).click();
  await expect(pr.locator('.dg-hints li')).toHaveCount(1);
});

test('comparison, criteria, matrix and key numbers: selection and caption agree with the data',async({page})=>{
  for(const [name,label,index] of [['Comparison criteria','Repairs',3],['Matrix','Delegate it',3],['Key numbers','degrees of tilt',2]]){
    const c=card(page,name);
    await c.getByRole('button',{name:new RegExp(label)}).click();
    await expect(caption(page,name)).toHaveText(data(name).items[index].detail);
  }
  const cmp=card(page,'Comparison');
  await cmp.getByRole('button',{name:/Buying/}).click();
  await expect(cmp.getByRole('button',{name:/Buying/})).toHaveAttribute('aria-pressed','true');
});

test('concept map: a two-way relationship draws two arrows whose labels do not overlap',async({page})=>{
  for(const width of [600,340]){
    const result=await page.evaluate(async width=>{
      const {renderComponent}=await import('/components/renderer.js');
      const host=document.createElement('div');host.style.width=width+'px';document.body.prepend(host);
      renderComponent(host,{id:'orbit',type:'graph',title:'Speed along the orbit',prompt:'',
        items:[{label:'Farther away',detail:'Slow.',value:0},{label:'Closer to Sun',detail:'Fast.',value:0}],
        edges:[{from:0,to:1,label:'falls inward and speeds up'},{from:1,to:0,label:'moves away and slows'}]},{edits:{}},{onEdit(){},ask(){}});
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const labels=[...host.querySelectorAll('.dg-edge-label.dg-on')].map(t=>t.getBoundingClientRect());
      const arrows=[...host.querySelectorAll('.dg-link.dg-on')].map(p=>p.getBoundingClientRect());
      const hit=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
      host.remove();
      return {labels:labels.length,arrows:arrows.length,overlap:hit(labels[0],labels[1]),onArrow:labels.some(l=>arrows.some(a=>hit(l,{left:a.left-1,right:a.right+1,top:a.top,bottom:a.bottom})))};
    },width);
    expect(result).toEqual({labels:2,arrows:2,overlap:false,onArrow:false});
  }
});
