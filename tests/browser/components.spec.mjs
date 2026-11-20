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
    return [...card.querySelectorAll('.dg-pin')].map(p=>({x:vx+parseFloat(p.style.left)/100*w,lat:90-(vy+parseFloat(p.style.top)/100*h)}));
  });
  // Places close together are drawn as a plan with longitude scaled by cos(latitude), so distances
  // are true; undo that to recover each longitude.
  const xs=items.map(i=>i.longitude+180),ys=items.map(i=>90-i.latitude);
  const close=Math.max(Math.max(...xs)-Math.min(...xs),(Math.max(...ys)-Math.min(...ys))*16/9)<1.5;
  const k=close?Math.cos((90-(Math.min(...ys)+Math.max(...ys))/2)*Math.PI/180):1,mid=(Math.min(...xs)+Math.max(...xs))/2;
  pins.forEach(p=>{p.lon=mid+(p.x-mid)/k-180;});
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

test('map: the coastline data loads on demand and every map draws its land',async({page})=>{
  const shortest=async selector=>Math.min(...await page.locator(selector).evaluateAll(paths=>paths.map(p=>(p.getAttribute('d')||'').length)));
  await expect(page.locator('.component-map .dg-land').first()).toBeAttached();
  await expect.poll(()=>shortest('.component-map .dg-land')).toBeGreaterThan(10000);   // the page map
  await page.goto(page.url().replace('/__dev/components','/__dev/controls'));
  await expect(page.locator('.control-map .dg-land').first()).toBeAttached();
  await expect.poll(()=>shortest('.control-map .dg-land')).toBeGreaterThan(10000);     // the place picker
});

// The map is drawn in the stage's real pixels: at any width, every arrow runs between node outlines
// and every label stays clear of the nodes, of the other labels and of the map's edges.
test('concept map and labelled diagram: arrows and labels never overlap the ideas, at this width',async({page})=>{
  for(const name of ['Concept map','Labelled diagram']){
    const c=card(page,name),count=data(name).items.length;
    for(let i=0;i<count;i++){
      await c.locator('.dg-node').nth(i).click();
      const problems=await c.locator('.dg-stage').evaluate(stage=>{
        const svg=stage.querySelector('svg'),frame=svg.getBoundingClientRect(),k=frame.width/svg.viewBox.baseVal.width;
        const nodes=[...stage.querySelectorAll('.dg-node')].map(n=>n.getBoundingClientRect());
        const hit=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
        const inside=(x,y)=>nodes.some(r=>x>r.left+1&&x<r.right-1&&y>r.top+1&&y<r.bottom-1);
        const out=[];
        for(const p of stage.querySelectorAll('.dg-link')){
          const a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());
          if(inside(frame.left+a.x*k,frame.top+a.y*k)||inside(frame.left+b.x*k,frame.top+b.y*k))out.push('arrow end under a node');
          if(p.getTotalLength()*k<16)out.push('arrow too short to read');
        }
        const labels=[...stage.querySelectorAll('.dg-edge-label.dg-on')];
        labels.forEach((t,j)=>{
          const r=t.getBoundingClientRect();
          if(nodes.some(n=>hit(r,n)))out.push(t.textContent+' covers a node');
          if(labels.some((o,m)=>m!==j&&hit(r,o.getBoundingClientRect())))out.push(t.textContent+' covers a label');
          if(r.left<frame.left-1||r.right>frame.right+1)out.push(t.textContent+' leaves the map');
          if(r.height<12)out.push(t.textContent+' is too small');
        });
        return out;
      });
      expect(problems,`${name}, idea ${i+1}`).toEqual([]);
    }
  }
});

test('spectrum: eight crowded markers keep their positions and their labels never overlap',async({page})=>{
  for(const width of [600,340]){
    const result=await page.evaluate(async width=>{
      const {renderComponent}=await import('/components/renderer.js');
      const host=document.createElement('div');host.style.width=width+'px';document.body.prepend(host);
      const values=[0,14,21,46,50,57,59,89];
      renderComponent(host,{id:'ph',type:'spectrum',title:'pH',prompt:'Acidic | Alkaline',
        items:values.map((value,i)=>({label:['Battery acid','Lemon juice','Vinegar','Milk','Pure water','Seawater','Baking soda solution','Household bleach'][i],detail:'x',value}))},{edits:{}},{onEdit(){},ask(){}});
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const stage=host.querySelector('.dg-stage').getBoundingClientRect(),track=host.querySelector('.dg-spectrum-track').getBoundingClientRect();
      const labels=[...host.querySelectorAll('.dg-mark .dg-label')].map(l=>l.getBoundingClientRect());
      const dots=[...host.querySelectorAll('.dg-mark-dot')].map(d=>{const r=d.getBoundingClientRect();return (r.x+r.width/2-track.x)/track.width*100;});
      const hit=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
      host.remove();
      return {overlaps:labels.filter((a,i)=>labels.some((b,j)=>j!==i&&hit(a,b))).length,
        outside:labels.filter(l=>l.left<stage.left-1||l.right>stage.right+1).length,
        offset:Math.max(...dots.map((d,i)=>Math.abs(d-values[i])))};
    },width);
    expect(result.overlaps,`labels overlap at ${width}px`).toBe(0);
    expect(result.outside,`labels leave the scale at ${width}px`).toBe(0);
    expect(result.offset).toBeLessThan(1);
  }
});


test('concept map: at any width, arrows reach their ideas and long labels stay apart and inside the map',async({page})=>{
  for(const width of [860,600,300]){
    const problems=await page.evaluate(async width=>{
      const {renderComponent}=await import('/components/renderer.js');
      const host=document.createElement('div');host.style.width=width+'px';document.body.prepend(host);
      renderComponent(host,{id:'inflation',type:'graph',title:'How the forces connect',prompt:'',
        items:['Strong demand','Supply shocks','Expectations','Inflation','Higher rates'].map(label=>({label,detail:'x',value:0})),
        edges:[{from:0,to:3,label:'pushes prices up'},{from:4,to:0,label:'restrains spending'},{from:1,to:3,label:'raises costs'},{from:2,to:3,label:'feed wage demands'}]},{edits:{}},{onEdit(){},ask(){}});
      const out=[];
      for(let i=0;i<5;i++){
        host.querySelectorAll('.dg-node')[i].click();
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const frame=host.querySelector('svg').getBoundingClientRect();
        const nodes=[...host.querySelectorAll('.dg-node')].map(n=>n.getBoundingClientRect());
        const labels=[...host.querySelectorAll('.dg-edge-label.dg-on')].map(t=>t.getBoundingClientRect());
        const hit=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
        // Each arrow end lies just outside a node: drawing and nodes share one coordinate system.
        const svg=host.querySelector('svg'),m=svg.getScreenCTM();
        const gap=(x,y)=>Math.min(...nodes.map(r=>Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom))));
        for(const p of host.querySelectorAll('.dg-link')){
          for(const at of [0,p.getTotalLength()]){
            const q=p.getPointAtLength(at).matrixTransform(m);
            if(gap(q.x,q.y)>16)out.push(`idea ${i+1}: an arrow ends ${Math.round(gap(q.x,q.y))}px from any idea`);
          }
        }
        labels.forEach((r,j)=>{
          if(nodes.some(n=>hit(r,n)))out.push(`idea ${i+1}: label covers a node`);
          if(labels.some((o,m)=>m!==j&&hit(r,o)))out.push(`idea ${i+1}: labels overlap`);
          if(r.left<frame.left-1||r.right>frame.right+1)out.push(`idea ${i+1}: label leaves the map`);
        });
      }
      host.remove();
      return out;
    },width);
    expect(problems,`${width}px`).toEqual([]);
  }
});

test('concept map: ideas on the ring never overlap each other',async({page})=>{
  for(const width of [860,600,300]){
    const overlaps=await page.evaluate(async width=>{
      const {renderComponent}=await import('/components/renderer.js');
      const host=document.createElement('div');host.style.width=width+'px';document.body.prepend(host);
      renderComponent(host,{id:'forces',type:'graph',title:'Forces',prompt:'',
        items:['Strong demand','Supply shocks','Expectations','Inflation','Higher rates','Slower spending'].map(label=>({label,detail:'x',value:0})),
        edges:[{from:0,to:3,label:'pushes'},{from:5,to:0,label:'eases'}]},{edits:{}},{onEdit(){},ask(){}});
      let count=0;
      for(let i=0;i<6;i++){
        host.querySelectorAll('.dg-node')[i].click();
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const nodes=[...host.querySelectorAll('.dg-node')].map(n=>n.getBoundingClientRect());
        count+=nodes.filter((a,j)=>nodes.some((b,k)=>k>j&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)).length;
      }
      host.remove();
      return count;
    },width);
    expect(overlaps,`${width}px`).toBe(0);
  }
});

test('route map: numbered stops are joined in travel order and the way so far ends at the selected stop',async({page})=>{
  const c=card(page,'Route map'),count=data('Route map').items.length;
  await c.scrollIntoViewIfNeeded();
  await expect(c.locator('.dg-pin-dot')).toHaveText(Array.from({length:count},(_,i)=>String(i+1)));
  const centres=async()=>c.locator('.dg-pin-dot').evaluateAll(d=>d.map(e=>{const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];}));
  const points=async selector=>c.locator(selector).evaluate(path=>{const m=path.getScreenCTM(),list=path.getAttribute('d').match(/-?[\d.]+ -?[\d.]+/g);
    return list.map(pair=>{const [x,y]=pair.split(' ').map(Number);const q=new DOMPoint(x,y).matrixTransform(m);return [q.x,q.y];});});
  const pins=await centres(),route=await points('.dg-route:not(.dg-route-done)');
  expect(route).toHaveLength(count);
  route.forEach(([x,y],i)=>{near(x,pins[i][0],3);near(y,pins[i][1],3);});          // the line runs through every stop, in order
  await c.locator('.dg-pin').nth(1).click();
  const done=await points('.dg-route-done');
  expect(done).toHaveLength(2);near(done[1][0],pins[1][0],3);near(done[1][1],pins[1][1],3);
});

test('city route: close-together stops are spread out on a plain plan, not stacked on a world map',async({page})=>{
  const c=card(page,'City route');
  await c.scrollIntoViewIfNeeded();
  await expect(c.locator('.dg-stage>svg.dg-svg .dg-land')).toHaveCount(0);     // the plan itself (the locator inset has a coastline)
  // The scale bar is true to the drawing: its km per pixel matches the distance between two stops.
  const items=data('City route').items,scale=c.locator('.dg-scale');
  // The scale, the north arrow and the locator are drawn on top of the plan, not hidden under it.
  for(const part of ['.dg-scale','.dg-north','.dg-locator'])
    expect(await c.locator(part).evaluate(el=>{el.style.pointerEvents='auto';const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(3,r.height/2));el.style.pointerEvents='';return el===top||el.contains(top);}),part).toBe(true);
  const label=await scale.locator('.dg-scale-label').textContent(),metres=label.endsWith(' km')?parseFloat(label)*1000:parseFloat(label);
  const barPx=(await scale.boundingBox()).width,stage=await c.locator('.dg-stage').evaluate(el=>{const svg=el.querySelector('svg.dg-svg');return {px:el.clientWidth,deg:svg.viewBox.baseVal.width};});
  const metresPerPx=stage.deg*111200/stage.px;
  near(barPx*metresPerPx,metres,metres*0.06);
  const dots=await c.locator('.dg-pin-dot').evaluateAll(d=>d.map(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,r:r.width/2};}));
  const overlap=dots.some((a,i)=>dots.some((b,j)=>j>i&&Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r));   // round dots never touch
  expect(overlap).toBe(false);
});

test('city plan: stops are named where a name fits (always the selected one), never covering anything',async({page},testInfo)=>{
  const c=card(page,'City route'),pins=data('City route').items.length;
  await c.scrollIntoViewIfNeeded();
  for(let i=0;i<pins;i++){
    await c.locator('.dg-pin').nth(i).click();
    await page.waitForTimeout(120);
    const result=await c.locator('.dg-stage').evaluate(stage=>{
      const frame=stage.getBoundingClientRect(),hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const pins=[...stage.querySelectorAll('.dg-pin')],labels=pins.map(p=>p.querySelector('.dg-label').getBoundingClientRect());
      const dots=pins.map(p=>p.querySelector('.dg-pin-dot').getBoundingClientRect());
      const furniture=[...stage.querySelectorAll('.dg-scale-label,.dg-north,.dg-locator')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect());
      const shown=labels.filter((l,i)=>pins[i].dataset.label!=='hidden');
      return {named:shown.length,selectedNamed:pins.find(p=>p.getAttribute('aria-pressed')==='true').dataset.label!=='hidden',
        covers:labels.reduce((n,l,i)=>pins[i].dataset.label==='hidden'?n:n+dots.filter((d,j)=>j!==i&&hit(l,d)).length+labels.filter((o,j)=>j!==i&&pins[j].dataset.label!=='hidden'&&hit(l,o)).length+furniture.filter(f=>hit(l,f)).length,0),
        inside:shown.every(l=>l.left>=frame.left-1&&l.right<=frame.right+1&&l.top>=frame.top-1&&l.bottom<=frame.bottom+1),
        scale:furniture.length>=2};
    });
    expect({...result,named:undefined},`selected place ${i+1}`).toEqual({named:undefined,selectedNamed:true,covers:0,inside:true,scale:true});
    if(testInfo.project.name==='desktop')expect(result.named,'on a wide map every stop is named').toBe(pins);
    else expect(result.named,'on a phone most stops are named').toBeGreaterThanOrEqual(pins-1);
  }
});

test('decision tree: branch labels stay readable and apart when the tree is drawn small',async({page})=>{
  const sizes=await page.evaluate(async()=>{
    const {renderComponent}=await import('/components/renderer.js');
    const host=document.createElement('div');host.style.width='300px';document.body.prepend(host);
    renderComponent(host,{id:'ev',type:'decision_tree',title:'Electric or hybrid?',prompt:'',
      items:['Charging at home?','Electric car','Long trips often?','Mostly local trips','Frequent long trips'].map(label=>({label,detail:'x',value:0})),
      edges:[{from:0,to:1,label:'Yes'},{from:0,to:2,label:'No'},{from:2,to:3,label:'Mostly local'},{from:2,to:4,label:'Frequent long trips'}]},{edits:{}},{onEdit(){},ask(){}});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const rects=[...host.querySelectorAll('.dg-edge-label')].map(t=>t.getBoundingClientRect());host.remove();
    return {heights:rects.map(r=>r.height),overlaps:rects.filter((a,i)=>rects.some((b,j)=>j>i&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)).length};
  });
  expect(sizes.heights.length).toBe(4);
  for(const height of sizes.heights)expect(height).toBeGreaterThanOrEqual(12);
  expect(sizes.overlaps).toBe(0);                                            // sibling labels never collide
});

