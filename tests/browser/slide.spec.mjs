import {expect,test} from '@playwright/test';
import {
  startFixtureServer,evaporationTitle,evaporationText,triangleTitle,slideAnswer,slideReplacement,windQuestion,windAnswer,windReplacement,
  vaccineTitle,vaccineFollowUps,deeperAnswer,projectileTitle
} from './fixture-server.mjs';

let server;
test.beforeAll(async()=>{server=await startFixtureServer();});
test.afterAll(async()=>{await server?.close();});
test.beforeEach(async({page})=>{
  await page.clock.install();
  await page.route('**/*',route=>new URL(route.request().url()).origin===server.url
    ? route.continue():route.abort());
  await page.goto(server.url);
  await expect(page.locator('#mode-label')).toHaveText('OpenAI configured');
});

const field=page=>page.getByRole('textbox',{name:'Editable explanation'});
const title=page=>page.getByRole('textbox',{name:'Document title'});
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const review=page=>page.clock.runFor(300);

async function send(page,text,expectedTitle){
  await page.getByRole('textbox',{name:'Your next instruction'}).fill(text);
  await button(page,'Explore interactively').click();
  await expect(title(page)).toHaveValue(expectedTitle);
}

test('undo restores typing bursts without resetting the orbit',async({page})=>{
  await send(page,'Show an adjustable orbit.','Kepler’s laws');
  const original=await field(page).inputValue();
  await field(page).fill('A planet moves');
  await page.keyboard.insertText(' around a star.');
  await expect(field(page)).toHaveValue('A planet moves around a star.');
  await page.clock.runFor(1000);
  await field(page).fill('Planets move around stars.');
  const orbit=page.getByRole('slider',{name:'Eccentricity'});
  await orbit.press('Home');
  await expect(field(page)).toHaveValue('Planets move around stars.');
  await button(page,'Undo direct edit').click();
  await expect(field(page)).toHaveValue('A planet moves around a star.');
  await expect(field(page)).toBeFocused();
  await expect(orbit).toHaveValue('0');
  await button(page,'Undo direct edit').click();
  await expect(field(page)).toHaveValue(original);
  await expect(button(page,'Undo direct edit')).toBeDisabled();
  await expect(orbit).toHaveValue('0');

  await field(page).evaluate(el=>{
    el.value='An edit reported without beforeinput.';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await button(page,'Undo direct edit').click();
  await expect(field(page)).toHaveValue(original);
});

test('a question shows its answer before review and Apply returns focus to the passage',async({page})=>{
  await send(page,'Create an evaporation slide.',evaporationTitle);
  const rough=evaporationText+' puddle dries on a cool day';
  await field(page).fill(rough);
  await review(page);
  await button(page,'Reject').click();
  await expect(field(page)).toHaveValue(rough);
  await expect(field(page)).toBeFocused();
  await expect(page.locator('#history-count')).toHaveText('0');

  const question=evaporationText+' Why below boiling?';
  const resume=server.holdPreview('Why below boiling?');
  const answer=page.getByRole('status',{name:'Answer'});
  try{
    await field(page).fill(question);
    await review(page);
    await expect(answer).toHaveText(/^Surface molecules/);
    await expect(answer).not.toHaveText(slideAnswer);
    await expect(button(page,'Review edit')).toBeHidden();
    await expect(button(page,'Apply')).toBeHidden();
    await expect(button(page,'Reject')).toBeHidden();
  }finally{resume();}
  await expect(answer).toHaveText(slideAnswer);
  await expect(field(page)).toHaveValue(question);
  await expect(button(page,'Apply')).toBeHidden();
  await button(page,'Review edit').click();
  await expect(answer).toBeVisible();
  await button(page,'Reject').click();
  await expect(answer).toHaveText(slideAnswer);
  await expect(field(page)).toHaveValue(question);
  await expect(field(page)).toBeFocused();

  await field(page).fill(question+' Still unclear.');
  await review(page);
  await button(page,'Review edit').click();
  await button(page,'Apply').click();
  await expect(field(page)).toHaveValue(slideReplacement);
  await expect(field(page)).toBeFocused();
  await expect(page.locator('#history-count')).toHaveText('1');
  await button(page,'Previous page').click();
  await expect(field(page)).toHaveValue(question+' Still unclear.');
  await button(page,'Next page').click();
  await expect(field(page)).toHaveValue(slideReplacement);
});

test('an answer opening under the intro does not move the intro',async({page})=>{
  await send(page,'Explain how vaccines work.',vaccineTitle);
  await expect(page.locator('.atlas-layout:not(.atlas-prose)')).toHaveCount(1);   // a page with a visual column
  // Position within the page, so scrolling the window does not count as movement.
  const top=()=>field(page).evaluate(f=>f.getBoundingClientRect().top-f.closest('.atlas-layout').getBoundingClientRect().top);
  await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished)));   // the page reveal has settled
  const before=await top();
  await field(page).fill('Vaccines teach the immune system to recognise a germ. Why below boiling?');
  await review(page);
  await expect(page.getByRole('status',{name:'Answer'})).toHaveText(/^Surface molecules/);
  expect(Math.abs(await top()-before)).toBeLessThanOrEqual(1);
});

test('a newer slide remains in History when applying a change from Back',async({page})=>{
  await send(page,'Create an evaporation slide.',evaporationTitle);
  await send(page,'Create a triangle slide.',triangleTitle);
  await button(page,'Previous page').click();
  await expect(title(page)).toHaveValue(evaporationTitle);
  await field(page).fill(evaporationText+' use a cool day as the example');
  await review(page);
  await button(page,'Apply').click();
  await expect(field(page)).toHaveValue(slideReplacement);
  await expect(button(page,'Next page')).toBeDisabled();
  await expect(title(page)).toHaveValue(evaporationTitle);
  await page.getByRole('button',{name:/^History /}).click();
  // History opens under its button, inside the window, and says it is open.
  await expect(page.locator('#history-panel')).toBeInViewport();
  await expect(page.locator('#history-button')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#close-history')).toBeFocused();
  const entry=page.locator('.history-row').filter({hasText:triangleTitle});
  await expect(entry).toContainText('Later version');
  await entry.getByRole('button',{name:'Restore'}).click();
  await expect(title(page)).toHaveValue(triangleTitle);
});

test('a slide with long notes sends structured follow-up context',async({page})=>{
  await send(page,'Create an evaporation slide.',evaporationTitle);
  const edited='Evaporation is a change at the surface of a liquid.';
  await field(page).fill(edited);
  await page.getByText('Your notes',{exact:true}).click();
  const notes=page.getByRole('textbox',{name:'Write in your document'});
  const longNotes=('Notes about "liquids" and 🌗.\n').repeat(525);
  await notes.fill(longNotes);
  const requestPromise=page.waitForRequest(request=>
    request.url().endsWith('/api/preview')&&request.postDataJSON().phase==='page');
  await page.getByRole('textbox',{name:'Your next instruction'}).fill('Give me a slightly different example.');
  await button(page,'Explore interactively').click();
  const {context}= (await requestPromise).postDataJSON();
  expect(Buffer.byteLength(context)).toBeLessThanOrEqual(6000);
  const {page:slide}=JSON.parse(context);
  expect(slide.title).toBe(evaporationTitle);
  expect(slide.page.body[0]).toBe(edited);
  expect(slide.notes).toContain('Notes about "liquids"');
});

test('Luna answers complete questions typed into a passage and long notes',async({page})=>{
  await send(page,'Show an adjustable orbit.','Kepler’s laws');
  const passage=await field(page).inputValue()+'\n\nWhat is an astronomical';
  await field(page).fill(passage);
  await review(page);
  await field(page).fill(passage+' unit?');
  await review(page);
  await expect(page.getByRole('status',{name:'Answer'})).toHaveText('One AU is roughly the distance from Earth to the Sun.');
  await expect(button(page,'Apply')).toBeHidden();

  await page.getByText('Your notes',{exact:true}).click();
  const notes=page.getByRole('textbox',{name:'Write in your document'});
  const longNotes='A note about orbits.\n'.repeat(140);
  const resume=server.holdPreview('What is an ellipse?');
  const notesAnswer=page.locator('.page-notes').getByRole('status',{name:'Answer'});
  try{
    await notes.fill(longNotes+'\nWhat is an ellipse?');
    await review(page);
    await expect(notesAnswer).toHaveText(/^An ellipse/);
    await expect(notesAnswer).not.toHaveText('An ellipse is an oval with two foci.');
  }finally{resume();}
  await expect(notesAnswer).toHaveText('An ellipse is an oval with two foci.');
  await expect(notes).toHaveValue(longNotes+'\nWhat is an ellipse?');
  await expect(button(page,'Review edit')).toBeHidden();
});

test('reload returns to the empty composer and clears slide history',async({page})=>{
  await send(page,'Create an evaporation slide.',evaporationTitle);
  await send(page,'Create a triangle slide.',triangleTitle);
  await field(page).fill('An unsaved slide edit');
  await page.getByText('Your notes',{exact:true}).click();
  await page.getByRole('textbox',{name:'Write in your document'}).fill('A private note');
  const composer=page.getByRole('textbox',{name:'Your next instruction'});
  await composer.fill('An unfinished follow-up');
  await page.reload();
  await expect(composer).toHaveValue('');
  await expect(button(page,'Explore interactively')).toBeDisabled();
  await expect(page.getByRole('region',{name:'Interactive page'})).toBeHidden();
  await expect(page.locator('#document-input')).toHaveValue('');
  await expect(page.locator('#history-count')).toHaveText('0');
});

for(const location of ['slide','notes']){
  test('editing '+location+' during streaming cancels the old response and reviews only the latest edit',async({page})=>{
    await send(page,'Create an evaporation slide.',evaporationTitle);
    if(location==='notes')await page.getByText('Your notes',{exact:true}).click();
    const editor=location==='slide'?field(page):page.getByRole('textbox',{name:'Write in your document'});
    const original=await editor.inputValue();
    const oldQuestion='Why below boiling?';
    const answer=page.getByRole('status',{name:'Answer'});
    const reviewEdit=button(page,'Review edit'),apply=button(page,'Apply'),reject=button(page,'Reject');
    const isHelp=(request,text)=>request.url().endsWith('/api/preview')&&
      request.postDataJSON().phase==='page-help'&&request.postDataJSON().text===text;
    const resumeOld=server.holdPreview(oldQuestion);
    const resumeLatest=server.holdPreview(windQuestion);
    try{
      await editor.fill(original+'\n'+oldQuestion);
      await review(page);
      await expect(answer).toHaveText(/^Surface molecules/);
      const failed=page.waitForEvent('requestfailed',{predicate:request=>isHelp(request,oldQuestion)});
      // Reverting to the original text with a space invalidates the stream even if no new request is needed.
      await editor.evaluate((element,value)=>{
        element.value=value;
        element.dispatchEvent(new InputEvent('input',{bubbles:true}));
      },original+' ');
      await expect(answer).toBeHidden({timeout:1000});
      expect((await failed).failure()?.errorText).toBe('net::ERR_ABORTED');

      const latestText=original+'\n'+windQuestion;
      await editor.fill(latestText);
      await review(page);
      await expect(answer).toHaveText(/^Moving air/);
      resumeOld();
      await expect(answer).not.toHaveText(slideAnswer);
      await expect(reviewEdit).toBeHidden();
      await expect(apply).toBeHidden();
      await expect(reject).toBeHidden();
      resumeLatest();
      await expect(answer).toHaveText(windAnswer);
      await reviewEdit.click();
      const proposed=page.getByRole('status',{name:'Proposed wording'}).locator('ins');
      await expect(proposed).toContainText('Wind can make a puddle evaporate faster.');
      await expect(proposed).not.toContainText('A puddle can dry on a cool day.');
      await expect(editor).toHaveValue(latestText);
      if(location==='slide'){
        await apply.click();
        await expect(editor).toHaveValue(windReplacement);
      }else{
        await reject.click();
        await expect(editor).toHaveValue(latestText);
        await expect(answer).toHaveText(windAnswer);
      }
    }finally{
      resumeOld();
      resumeLatest();
    }
  });
}

test('an appended Kepler rewrite takes priority over the earlier inline question',async({page})=>{
  await send(page,'Show an adjustable orbit.','Kepler’s laws');
  const editor=field(page);
  const withQuestion=await editor.inputValue()+'\n\nWhat is an astronomical unit?';
  await editor.fill(withQuestion);
  await review(page);
  await expect(page.getByRole('status',{name:'Answer'})).toContainText('Earth to the Sun');

  const rejected='An astronomical unit measures distances in the Solar System.';
  const accepted='An astronomical unit is about 150 million kilometers.';
  const instruction='Replace this entire paragraph with exactly this sentence: ';
  const apply=button(page,'Apply'),reject=button(page,'Reject');
  for(const [separator,wording,action] of [[' ',rejected,reject],['\n',accepted,apply]]){
    const typed=withQuestion+separator+instruction+wording;
    await editor.fill(typed);
    await review(page);
    await expect(page.getByRole('status',{name:'Proposed wording'})).toContainText(wording);
    await expect(apply).toBeVisible();
    await expect(reject).toBeVisible();
    await action.click();
    await expect(editor).toHaveValue(action===apply?wording:typed);
  }
});

test('editing a pending notes rewrite shows only the latest proposal',async({page})=>{
  await send(page,'Show an adjustable orbit.','Kepler’s laws');
  await page.getByText('Your notes',{exact:true}).click();
  const notes=page.getByRole('textbox',{name:'Write in your document'});
  const pending=page.getByText('Preparing edit…',{exact:true});
  const apply=button(page,'Apply'),reject=button(page,'Reject');
  const question='What is an ellipse?';
  const prefix='Replace this entire note with exactly this sentence: ';
  const old=prefix+'An ellipse is an oval.';
  const revised='An ellipse is a closed curve with two foci.';
  const latest=prefix+revised;
  const resumeOld=server.holdPreview(old),resumeLatest=server.holdPreview(latest);
  const isRewrite=(request,text)=>request.url().endsWith('/api/preview')&&
    request.postDataJSON().target?.mode==='rewrite'&&request.postDataJSON().text===text;
  try{
    await notes.fill(question+'\n'+old);
    await page.clock.runFor(600);
    await expect(pending).toBeVisible();
    await expect(notes).toBeFocused();
    await expect(apply).toBeHidden();
    await expect(reject).toBeHidden();

    const aborted=page.waitForEvent('requestfailed',{predicate:request=>isRewrite(request,old)});
    await notes.fill(question+'\n'+latest);
    expect((await aborted).failure()?.errorText).toBe('net::ERR_ABORTED');
    await page.clock.runFor(600);
    await expect(pending).toBeVisible();
    resumeOld();
    await expect(page.getByRole('status',{name:'Proposed wording'})).toBeHidden();
    await expect(apply).toBeHidden();
    await expect(reject).toBeHidden();

    resumeLatest();
    const proposed=page.locator('.page-notes').getByRole('status',{name:'Proposed wording'});
    await expect(proposed).toContainText(revised);
    await expect(proposed).not.toContainText('An ellipse is an oval.');
    await expect(pending).toBeHidden();
    await expect(apply).toBeVisible();
    await expect(reject).toBeVisible();
    await notes.press('Tab');
    await expect(apply).toBeFocused();
    await apply.press('Enter');
    await expect(notes).toHaveValue(revised);
    await expect(notes).toBeFocused();
  }finally{
    resumeOld();
    resumeLatest();
  }
});

test('generation shows a quiet loading state, then reveals the page and typeset equations',async({page})=>{
  const prompt='Show an adjustable orbit.';
  const composer=page.getByRole('textbox',{name:'Your next instruction'});
  const notes=page.getByText('Your notes',{exact:true});
  const progress=page.getByText('Creating…',{exact:true});
  const resume=server.holdPreview(prompt);
  try{
    await composer.fill(prompt);
    await button(page,'Explore interactively').click();
    await expect(progress).toBeVisible();
    await expect(page.locator('#page-progress .page-spinner')).toBeVisible();
    await expect(page.locator('.paper')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    await expect(notes).toBeHidden();
    await expect(title(page)).toBeHidden();
    await expect(button(page,'Previous page')).toBeHidden();
    await expect(page.locator('#page-progress .page-elapsed')).toBeHidden();
    await page.clock.runFor(3100);
    await expect(page.locator('#page-progress .page-elapsed')).toHaveText(/^3 s$/);
    await expect(page.locator('#page-progress .page-elapsed')).toBeVisible();
  }finally{resume();}
  await expect(title(page)).toHaveValue('Kepler’s laws');
  await expect(progress).toBeHidden();
  await expect(notes).toBeVisible();
  await expect(page.locator('.atlas-equation:visible mfrac')).toBeVisible();
  await button(page,'Orbital periods').click();
  await expect(page.locator('.atlas-equation:visible > math msup')).toHaveCount(2);
  const full=page.getByText('Full equation',{exact:true});
  await full.click();
  await expect(page.locator('.atlas-equation-details mfrac')).toBeVisible();
  await page.getByRole('slider',{name:'Eccentricity'}).press('Home');
  await expect(page.locator('.atlas-equation-details mfrac')).toBeVisible();

  const update='Show a new example of the same orbit.';
  const resumeUpdate=server.holdPreview(update);
  try{
    await composer.fill(update);
    await button(page,'Explore interactively').click();
    await expect(progress).toBeVisible();
    await expect(notes).toBeHidden();
    await expect(title(page)).toBeVisible();
  }finally{resumeUpdate();}
  await expect(notes).toBeVisible();
  await expect(progress).toBeHidden();
});

test('one over-long takeaway label does not turn the other takeaways back into prose',async({page})=>{
  await send(page,'Explain the water cycle with one long label.','The water cycle');
  const headings=page.locator('.atlas-body .atlas-law-heading');
  await expect(headings).toHaveText(['Energy','Gravity']);
  await expect(page.locator('.atlas-body')).toHaveClass(/atlas-law-overview/);
  await expect(page.getByRole('textbox',{name:'Page paragraph 3'})).toHaveValue('Not all water follows the same path: Some stays underground for centuries.');
  await expect(page.getByRole('textbox',{name:'Page paragraph 2'})).toHaveValue('The Sun drives evaporation.');
});

test('Kepler takeaways have bold labels and a plain editable body, and notes answers format emphasis safely',async({page})=>{
  await send(page,'Explain all three Kepler laws.','Kepler’s laws');
  const cards=page.locator('.atlas-law-overview .atlas-law-heading');
  await expect(cards).toHaveText(['Orbital shape','Equal areas','Orbital period']);
  await expect(page.getByRole('textbox',{name:'Page paragraph 2'})).toHaveValue('An orbit is an ellipse with the Sun at a focus.');
  await page.getByText('Your notes',{exact:true}).click();
  await page.getByRole('textbox',{name:'Write in your document'}).fill('Explain again in very simple terms.');
  await review(page);
  const answer=page.locator('.page-notes').getByRole('status',{name:'Answer'});
  await expect(answer.locator('ol li')).toHaveCount(2);
  await expect(answer.locator('strong')).toHaveText(['Shape.','Speed.']);
  await expect(answer).not.toContainText('**');
});

test('go deeper tabs show prefetched answers in place and can still open a full slide',async({page})=>{
  const deeper=[];
  page.on('request',request=>{if(request.url().endsWith('/api/preview')&&request.postDataJSON().phase==='deeper')deeper.push(request.postDataJSON().followUps);});
  await send(page,'Explain how vaccines work.',vaccineTitle);
  await expect(page.getByRole('heading',{name:'Safety'})).toBeVisible();
  await expect.poll(()=>deeper).toEqual([vaccineFollowUps]);
  const tab=page.getByRole('tab',{name:vaccineFollowUps[1]});
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected','true');
  await expect(page.getByText(deeperAnswer(vaccineFollowUps[1]))).toBeVisible();
  await page.getByRole('tab',{name:vaccineFollowUps[0]}).click();
  await expect(page.getByText(deeperAnswer(vaccineFollowUps[0]))).toBeVisible();
  await expect(page.getByText(deeperAnswer(vaccineFollowUps[1]))).toBeHidden();
  await page.getByRole('tab',{name:vaccineFollowUps[0]}).click();
  await expect(page.getByText(deeperAnswer(vaccineFollowUps[0]))).toBeHidden();
  expect(deeper).toHaveLength(1);
  await page.getByRole('tab',{name:vaccineFollowUps[1]}).click();
  await button(page,'Make this the main slide').click();
  await expect(page.getByText('2 / 2')).toBeVisible();
});

test('the projectile curve itself changes with speed, angle and gravity',async({page})=>{
  await send(page,'Show projectile motion.',projectileTitle);
  const curve=page.locator('.trajectory .plot-path');
  const box=async()=>{const b=await curve.boundingBox();return {width:b.width,height:b.height};};
  const start=await box();
  await page.getByRole('slider',{name:'Launch speed'}).fill('30');
  const faster=await box();
  expect(faster.width).toBeGreaterThan(start.width*1.8);   // range grows with speed squared
  expect(faster.height).toBeGreaterThan(start.height*1.8);
  await page.getByRole('slider',{name:'Launch angle'}).fill('75');
  const steeper=await box();
  expect(steeper.height).toBeGreaterThan(faster.height);
  expect(steeper.width).toBeLessThan(faster.width);
  await expect(page.locator('.trajectory .plot-ghost')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Gravity'}).selectOption('1.62');
  await expect(page.locator('.trajectory .plot-ghost')).toHaveCount(1);
  await expect(page.locator('.physics-readings')).toContainText('s in flight');
});

test('the Kepler orbit is drawn to the physics: shape, focus, timing, equal areas and speed',async({page})=>{
  await send(page,'Explain all three Kepler laws.','Kepler’s laws');
  const orbit=page.locator('.atlas-orbit');
  const geometry=()=>orbit.evaluate(svg=>{
    const track=svg.querySelector('.atlas-track'),sun=svg.querySelector('.atlas-sun'),planet=svg.querySelector('.atlas-planet');
    return {cx:+track.getAttribute('cx'),rx:+track.getAttribute('rx'),ry:+track.getAttribute('ry'),sun:+sun.getAttribute('cx'),px:+planet.getAttribute('cx')};
  });
  const near=(a,b,t)=>expect(Math.abs(a-b),`${a} ≈ ${b}`).toBeLessThanOrEqual(t);
  for(const e of [0.2,0.6]){
    await page.getByRole('slider',{name:'Eccentricity'}).fill(String(Math.round(e*100)));
    await page.getByRole('slider',{name:'Time through orbit'}).fill('0');
    let g=await geometry();
    near(g.ry/g.rx,Math.sqrt(1-e*e),0.005);          // first law: an ellipse of this eccentricity
    near(g.sun-g.cx,g.rx*e,0.5);                      // with the Sun at a focus
    near(g.px,g.cx+g.rx,0.5);                         // time 0 is perihelion, nearest the Sun
    await expect(page.locator('.atlas-orbit-caption')).toContainText(`Relative speed ${Math.sqrt((1+e)/(1-e)).toFixed(2)}×`);
    await page.getByRole('slider',{name:'Time through orbit'}).fill('50');
    g=await geometry();
    near(g.px,g.cx-g.rx,0.5);                         // half the period later: aphelion
    await expect(page.locator('.atlas-orbit-caption')).toContainText(`Relative speed ${Math.sqrt((1-e)/(1+e)).toFixed(2)}×`);
  }
  await page.getByRole('button',{name:'Equal areas'}).click();
  const areas=await orbit.evaluate(svg=>[...svg.querySelectorAll('.atlas-sector')].map(path=>{
    const n=400,length=path.getTotalLength(),pts=Array.from({length:n},(_,i)=>path.getPointAtLength(length*i/n));
    return Math.abs(pts.reduce((s,p,i)=>{const q=pts[(i+1)%n];return s+p.x*q.y-q.x*p.y;},0)/2);
  }));
  expect(areas).toHaveLength(2);
  near(areas[0]/areas[1],1,0.02);                     // second law: equal areas in equal times
});
