import {expect,test} from '@playwright/test';
import {
  startFixtureServer,keplerDraft,keplerAudienceDraft,keplerAudienceQuestion,unfinishedComparison,unfinishedAnswer,unfinishedQuestion,
  completedComparison,comparisonAnswer,japanCheckpoint,japanQuestion,japanAnswer,travelDraft,travelQuestion,kyotoChoice,kyotoAnswer,
  requirementsDraft,requirementsQuestion,evaporationTitle,billDraft,lisbonDraft
} from './fixture-server.mjs';

let server;
test.beforeAll(async()=>{server=await startFixtureServer();});
test.afterAll(async()=>{await server?.close();});

test.beforeEach(async({page})=>{
  // Exercise the app's debounce and hover timers without wall-clock sleeps.
  await page.clock.install();
  await page.route('**/*',route=>new URL(route.request().url()).origin===server.url
    ? route.continue():route.abort());
  await page.goto(server.url);
  await expect(page.locator('body')).toHaveClass(/\blive\b/);   // the server key is available
});

const draft=page=>page.getByRole('textbox',{name:'Your next instruction'});
const quickAnswer=page=>page.getByRole('region',{name:'Quick answer'});
const advancePreview=page=>page.clock.runFor(1200);

async function expectSameGeometry(locator,before){
  const after=await locator.boundingBox();
  for(const key of ['x','y','width','height'])expect(Math.abs(after[key]-before[key]),key).toBeLessThanOrEqual(1);
}

test('Tab predicts the user’s next words inside the field: it finishes a half-typed word, follows typing and inserts once',async({page})=>{
  const field=draft(page);
  await field.fill(lisbonDraft);
  await advancePreview(page);
  const ghost=page.locator('.completion-text');
  await expect(ghost).toHaveText('ents for a relaxed weekend.');            // the overlap with "par" is removed
  const inside=await ghost.evaluate(el=>{const g=el.getBoundingClientRect(),f=document.getElementById('intent-input').getBoundingClientRect();return g.top>=f.top&&g.bottom<=f.bottom+1;});
  expect(inside).toBe(true);                                                 // in the field, not below it
  await field.pressSequentially('ents f');                                   // typing along the prediction keeps the rest
  await expect(ghost).toHaveText('or a relaxed weekend.');
  await field.press('Tab');
  await expect(field).toHaveValue(lisbonDraft+'ents for a relaxed weekend.');
  await expect(field).toBeFocused();
  await expect(page.locator('#completion-line')).toBeHidden();
});

test('a prediction too long for the field is not shown, and nothing appears below the field',async({page})=>{
  const initialReply=Promise.withResolvers();
  await page.route('**/api/preview',async route=>{
    if(route.request().postDataJSON().text===keplerDraft)await initialReply.promise;
    await route.fallback();
  });
  await draft(page).fill(keplerDraft);
  const composer=page.locator('.composer');
  // The typed draft can resize the field. Measure once that transition settles.
  await expect.poll(()=>composer.evaluate(el=>Math.abs(el.getBoundingClientRect().top-(innerHeight-el.offsetHeight)/2)))
    .toBeLessThanOrEqual(1);
  const before=await composer.boundingBox();
  const fieldBefore=await draft(page).boundingBox();
  initialReply.resolve();
  await advancePreview(page);
  await expect(quickAnswer(page)).toBeVisible();
  await expect(page.locator('.completion-text')).toBeHidden();
  await expect(page.locator('#completion-line')).toBeHidden();
  await expectSameGeometry(composer,before);
  await expectSameGeometry(draft(page),fieldBefore);
  await draft(page).press('Tab');                                            // Tab never inserts unseen text
  await expect(draft(page)).toHaveValue(keplerDraft);
});

test('an unfinished comparison still gets live help: an answer, a question about the second item and a Tab prediction',async({page})=>{
  const requests=[];
  page.on('request',request=>{
    if(request.url().endsWith('/api/preview'))requests.push(request.postDataJSON());
  });
  await draft(page).fill(unfinishedComparison);
  await advancePreview(page);
  await expect(quickAnswer(page)).toHaveText(unfinishedAnswer);
  await expect(page.getByRole('button',{name:'Clarifying question: '+unfinishedQuestion})).toBeVisible();
  expect(requests.map(request=>request.text)).toEqual([unfinishedComparison]);

  await draft(page).fill(completedComparison);
  await advancePreview(page);
  await expect(quickAnswer(page)).toHaveText(comparisonAnswer);
  expect(requests.map(request=>request.text)).toEqual([unfinishedComparison,completedComparison]);
});

test('choosing an option with a slide open preserves draft focus and the refreshed answer',async({page},info)=>{
  await draft(page).fill('Show me an adjustable Kepler orbit.');
  await page.getByRole('button',{name:'Explore interactively'}).click();
  await expect(page.getByRole('slider',{name:'Eccentricity'})).toBeVisible();

  await draft(page).fill(travelDraft);
  await advancePreview(page);
  await page.getByRole('button',{name:'Clarifying question: '+travelQuestion}).click();
  const option=page.getByRole('button',{name:kyotoChoice,exact:true});
  await expect(option).toBeVisible();
  const paper=page.locator('.paper');
  if(info.project.name==='desktop'){
    const optionBounds=await option.boundingBox();
    const slide=await paper.boundingBox();
    const x=optionBounds.x+optionBounds.width/2,y=optionBounds.y+optionBounds.height/2;
    expect(x).toBeGreaterThan(slide.x);
    expect(x).toBeLessThan(slide.x+slide.width);
    expect(y).toBeGreaterThan(slide.y);
    expect(y).toBeLessThan(slide.y+slide.height);
  }

  await option.click();
  await expect(draft(page)).toBeFocused();
  // On narrow screens the picker may sit below the slide. Enter the slide
  // with the pointer in both layouts to exercise the delayed hover.
  await page.mouse.move(0,0);
  await paper.hover();
  await page.clock.runFor(200);
  await expect(page.locator('body')).toHaveClass(/composer-active/);
  await advancePreview(page);
  await expect(draft(page)).toBeFocused();
  await expect(draft(page)).toHaveValue(/\(Focus on Kyoto\)/);
  await expect(quickAnswer(page)).toHaveText(kyotoAnswer);
  await expect(quickAnswer(page)).toBeVisible();

  await page.getByRole('textbox',{name:'Editable explanation'}).click();
  await expect(quickAnswer(page)).toBeHidden();
});

test('refresh keeps the old preview and exact repeats make no request',async({page})=>{
  const requests=[];
  page.on('request',request=>{
    if(request.url().endsWith('/api/preview')&&request.postDataJSON().phase==='preview')requests.push(request.postDataJSON().text);
  });
  await draft(page).fill(travelDraft);
  await page.clock.runFor(250);
  await expect(page.getByRole('button',{name:'Clarifying question: '+travelQuestion})).toBeEnabled();
  await expect(quickAnswer(page)).toBeVisible();
  const previousAnswer=await page.locator('#quick-answer').textContent();
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+500));
  await draft(page).fill(completedComparison.slice(0,-1));
  await page.clock.runFor(249);
  await expect(quickAnswer(page)).toContainText(previousAnswer);
  await expect(quickAnswer(page)).toHaveAttribute('data-updating','');
  await expect(page.getByRole('button',{name:'Clarifying question: '+travelQuestion})).toBeDisabled();
  expect(requests).toEqual([travelDraft]);

  await draft(page).fill(completedComparison);
  await page.clock.runFor(250);
  await expect(quickAnswer(page)).toHaveText(comparisonAnswer);
  await expect(quickAnswer(page)).not.toHaveAttribute('data-updating','');
  await draft(page).fill(travelDraft);
  await expect(quickAnswer(page)).toHaveText(previousAnswer);
  await expect(page.getByRole('button',{name:'Clarifying question: '+travelQuestion})).toBeEnabled();
  await advancePreview(page);
  expect(requests).toEqual([travelDraft,completedComparison]);
});

test('continuous typing starts Luna and keeps usable phrase options until resolved',async({page})=>{
  const requests=[];
  page.on('request',request=>{
    if(request.url().endsWith('/api/preview')&&request.postDataJSON().phase==='preview')requests.push(request.postDataJSON().text);
  });
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+400));
  const editor=draft(page);
  const resume=server.holdPreview(japanCheckpoint);
  try{
    await editor.pressSequentially(japanCheckpoint+' ');
    await expect.poll(()=>requests).toEqual([japanCheckpoint]);
    await editor.pressSequentially('with my kids ');
    resume();

    // No pause timer has elapsed. The answer belongs to the prefix and its anchor still exists.
    await expect(page.locator('#quick-answer')).toHaveText(japanAnswer);
    const question=page.getByRole('button',{name:'Clarifying question: '+japanQuestion});
    await expect(question).toBeEnabled();
    await expect(page.locator('#input-mirror mark')).toHaveText('Japan');
    await question.click();
    await expect(page.getByText('Kyoto and Osaka',{exact:true})).toBeVisible();
    await editor.focus();
    await editor.pressSequentially('focused on Kyoto');
    await expect(question).toBeHidden();
    await expect(page.locator('#input-mirror mark')).toHaveCount(0);
    expect(requests).toEqual([japanCheckpoint]);
    await page.clock.runFor(300);
    await expect(page.locator('#quick-answer')).toHaveText('With kids, Kyoto is a good base for a week.');
    expect(requests).toEqual([japanCheckpoint,japanCheckpoint+' with my kids focused on Kyoto']);
  }finally{resume();}
});

test('the intent icon opens the editable summary and leaves live help visible',async({page})=>{
  await draft(page).fill(travelDraft);
  await advancePreview(page);
  const icon=page.getByRole('button',{name:'Review intent',exact:true});
  const details=page.getByRole('dialog',{name:'Your intent and editable details'});
  const edit=page.getByRole('button',{name:'Edit your intent'});
  const question=page.getByRole('button',{name:'Clarifying question: '+travelQuestion});
  await expect(icon).toBeVisible();
  await expect(icon).toHaveText('');
  await expect(question).toBeEnabled();
  await expect(quickAnswer(page)).toBeVisible();
  await expect(details).toBeHidden();
  await icon.focus();
  await icon.press('Enter');
  await expect(details).toContainText('Compare Tokyo and Kyoto for an April trip.');
  await expect(icon).toHaveAttribute('aria-expanded','true');
  await expect(edit).toBeFocused();
  await edit.press('Escape');
  await expect(details).toBeHidden();
  await expect(icon).toBeFocused();
  await icon.click();
  await edit.click();
  await expect(page.getByRole('textbox',{name:'What do you want to achieve?'})).toHaveValue('Compare Tokyo and Kyoto for an April trip.');
});

test('a visible audience choice applies and closes even after the live preview refreshes',async({page})=>{
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+400));
  const editor=draft(page);
  const followUp=keplerAudienceDraft+' with one example';
  const resumeEarly=server.holdPreview(keplerAudienceDraft);
  const resumeLatest=server.holdPreview(followUp);
  const previewRequest=text=>page.waitForRequest(request=>request.url().endsWith('/api/preview')&&request.postDataJSON().text===text);
  try{
    const earlyRequest=previewRequest(keplerAudienceDraft);
    await editor.pressSequentially(keplerAudienceDraft+' ');
    await earlyRequest;
    await page.keyboard.insertText('with one example');
    const latestRequest=previewRequest(followUp);
    await page.clock.runFor(300);
    resumeEarly();
    await latestRequest;
    await page.getByRole('button',{name:'Clarifying question: '+keplerAudienceQuestion}).click();
    const picker=page.locator('#intent-popover');
    const choice=picker.getByRole('button',{name:'High school',exact:true});
    await expect(picker.locator('.control-option')).toHaveText(['Middle school','High school','University']);
    await expect(picker.getByRole('searchbox')).toHaveCount(0);
    await expect(picker.getByRole('button',{name:'Use this value'})).toHaveCount(0);
    await expect(picker.getByRole('button',{name:'Type your own answer'})).toBeVisible();
    await expect(choice).toBeVisible();
    resumeLatest();
    await expect(quickAnswer(page)).toContainText('Imagine an oval orbit around the Sun.');
    await expect(choice).toBeVisible();
    const chosen=followUp.replace('simply','simply (High school)');
    const renewedRequest=previewRequest(chosen);
    await choice.click();
    await expect(picker).toBeHidden();
    await expect(editor).toHaveValue(chosen);
    await expect(editor).toBeFocused();
    const {context}= (await renewedRequest).postDataJSON();
    expect(JSON.parse(context).confirmed).toContainEqual({type:'audience',phrase:'simply',value:'High school'});
    await expect(quickAnswer(page)).toContainText('At high-school level');

    await page.getByRole('button',{name:'Review intent',exact:true}).click();
    await page.getByRole('button',{name:'Audience: simply, High school',exact:true}).click();
    // The chosen option reads like the others: its label right after the radio dot, not pushed right.
    const labelGap=await picker.locator('.control-option').evaluateAll(options=>options.map(o=>{const r=o.getBoundingClientRect(),t=document.createRange();t.selectNodeContents(o);const rects=[...t.getClientRects()].filter(x=>x.width>0);return Math.round(rects.at(-1).left-r.left);}));
    expect(Math.max(...labelGap)-Math.min(...labelGap)).toBeLessThanOrEqual(2);
    await picker.getByRole('button',{name:'Type your own answer'}).click();
    const custom=picker.locator('#popover-custom');
    await custom.fill('Adults new to astronomy');
    await custom.press('Enter');
    await expect(picker).toBeHidden();
    await expect(editor).toHaveValue(followUp.replace('simply','simply (Adults new to astronomy)'));
    await expect(editor).toBeFocused();
  }finally{
    resumeEarly();
    resumeLatest();
  }
});

test('a long continued draft keeps live help visible until a newer response arrives',async({page})=>{
  await draft(page).fill(travelDraft);
  await advancePreview(page);
  const oldQuestion=page.getByRole('button',{name:'Clarifying question: '+travelQuestion});
  await expect(oldQuestion).toBeVisible();
  const previous=await page.locator('#quick-answer').textContent();
  const latest=travelDraft+' We enjoy walking slowly and having an open afternoon with enough time to read and rest.';
  const resume=server.holdPreview(latest);
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+500));
  try{
    await draft(page).fill(latest);
    await page.clock.runFor(99);
    await expect(oldQuestion).toBeVisible();
    await expect(quickAnswer(page)).toBeVisible();
    await expect(quickAnswer(page)).toHaveText(previous);
    await expect(quickAnswer(page)).toHaveAttribute('data-updating','');
    await page.clock.runFor(60);
    await expect(quickAnswer(page)).toContainText('Leave one quiet');
    await expect(oldQuestion).toBeVisible();
  }finally{resume();}
  await expect(quickAnswer(page)).toHaveText('Leave one quiet afternoon for gardens or a small museum.');
  await expect(page.getByRole('button',{name:'Clarifying question: Would you prefer gardens or museums?'})).toBeEnabled();
});

test('multi-select choices apply live in one step and the picker stays open',async({page})=>{
  const editor=draft(page);
  await editor.fill(requirementsDraft);
  await advancePreview(page);
  await page.getByRole('button',{name:'Clarifying question: '+requirementsQuestion}).click();
  const picker=page.locator('#intent-popover');
  await expect(picker.getByRole('button',{name:/^Use (this|these|\d)/})).toHaveCount(0);
  await expect(picker.getByLabel('Add your own')).toBeVisible();                          // its own entry…
  await expect(picker.getByRole('button',{name:'Type your own answer'})).toBeHidden();    // …so no second one
  await expect(picker.locator('#popover-custom')).toBeHidden();
  await picker.getByRole('button',{name:'Vegetarian meals',exact:true}).click();
  await expect(editor).toHaveValue(requirementsDraft+' (Vegetarian meals)');
  await expect(picker).toBeVisible();
  await picker.getByRole('button',{name:'Step-free access',exact:true}).click();
  await expect(editor).toHaveValue(requirementsDraft+' (Vegetarian meals; Step-free access)');
  await expect(picker.getByRole('button',{name:'Step-free access',exact:true})).toHaveAttribute('aria-pressed','true');
  await picker.getByRole('button',{name:'Vegetarian meals',exact:true}).click();
  await expect(editor).toHaveValue(requirementsDraft+' (Step-free access)');
  await expect(picker).toBeVisible();
});

test('the live-help panel is not drawn while it has nothing to show',async({page})=>{
  await draft(page).fill('Create an evaporation slide.');
  await page.getByRole('button',{name:'Explore interactively',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document title'})).toHaveValue(evaporationTitle);
  const answered=page.waitForResponse(r=>r.url().endsWith('/api/preview'));
  await draft(page).click();
  await draft(page).pressSequentially('rere');
  await advancePreview(page);
  await answered;
  await page.clock.runFor(300);
  // No answer: nothing visible is drawn. The strip under the field stays reserved (so Send never
  // moves) but is empty and has no card.
  await expect(quickAnswer(page)).toBeHidden();
  expect(await page.locator('#typing-assistance').evaluate(e=>{const s=getComputedStyle(e);return s.backgroundColor+' '+s.borderTopWidth+' '+e.innerText.trim();})).toBe('rgba(0, 0, 0, 0) 0px ');
  await draft(page).pressSequentially(' and how does evaporation work?');
  await advancePreview(page);
  await expect(quickAnswer(page)).toBeVisible();
  await expect(page.locator('#typing-assistance')).toBeVisible();  // an answer brings the panel back
});

test('with a page open, the live question sits above the composer and the answer below, as plain text',async({page})=>{
  await draft(page).fill('Create an evaporation slide.');
  await page.getByRole('button',{name:'Explore interactively',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document title'})).toHaveValue(evaporationTitle);
  await draft(page).click();
  const send=page.getByRole('button',{name:'Explore interactively',exact:true});
  await draft(page).pressSequentially(japanCheckpoint+' ');
  await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished)));   // the dock has finished opening
  const sendBefore=await send.boundingBox();
  await advancePreview(page);
  await expect(page.locator('#quick-answer')).toHaveText(japanAnswer);
  const question=page.getByRole('button',{name:'Clarifying question: '+japanQuestion});
  await expect(question).toBeInViewport();
  await expect(page.locator('#quick-answer')).toBeInViewport();
  const composer=await page.locator('.composer').boundingBox();
  expect((await page.locator('#quick-answer').boundingBox()).y).toBeGreaterThanOrEqual(composer.y+composer.height);
  expect((await question.boundingBox()).y+(await question.boundingBox()).height).toBeLessThanOrEqual(composer.y);
  for(const panel of ['#typing-assistance','.live-question']){
    const look=await page.locator(panel).evaluate(e=>{const s=getComputedStyle(e);return s.backgroundColor+' '+s.borderTopWidth;});
    expect(look,panel+' has no card').toBe('rgba(0, 0, 0, 0) 0px');
  }
  await expectSameGeometry(send,sendBefore);   // the answer appearing never moves Send
  // The longest answer allowed (160 characters) is read whole: no scrolling, and Send still stays put.
  await page.locator('#quick-answer').evaluate(e=>{e.textContent=('Will add a worked example for each law, with Earth at T = 1 year and a = 1 AU, then what every symbol means and how Mars compares with Earth in each.').padEnd(160,'.').slice(0,160);});
  expect(await page.locator('#typing-assistance').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'answer fits without scrolling').toBe(true);
  await expect(page.locator('#quick-answer')).toBeInViewport({ratio:1});
  await expectSameGeometry(send,sendBefore);
});

test('a chosen way to explore it is listed under What I understand and can be changed',async({page})=>{
  await draft(page).click();
  await draft(page).pressSequentially(billDraft);
  await advancePreview(page);
  const question=page.getByRole('button',{name:/How would you like to explore this\?/});
  await expect(question).toBeVisible();
  await question.click();
  await page.locator('#popover-options').getByRole('button',{name:/See the steps/}).click();
  await expect(question).toBeHidden();                                   // decided: not asked again
  await expect(page.locator('#live-question')).toBeHidden();             // and the row does not echo the answer
  await expect(draft(page)).toBeFocused();                                // typing can go on without a click
  await page.getByRole('button',{name:'Review intent'}).click();
  const details=page.getByRole('dialog',{name:'Your intent and editable details'});
  const choice=details.getByRole('button',{name:'How would you like to explore this?: See the steps'});
  await expect(choice).toBeVisible();                                     // the choice is visible
  await choice.click();                                                   // ...and reopens the picker to change it
  const picker=page.locator('#popover-options');
  await expect(picker.getByRole('button',{name:/See the steps/})).toHaveAttribute('aria-pressed','true');
  await picker.getByRole('button',{name:/Compare side by side/}).click();
  await page.getByRole('button',{name:'Review intent'}).click();
  await expect(details.getByRole('button',{name:'How would you like to explore this?: Compare side by side'})).toBeVisible();
});

test('Send carries the preview the user read, and only a preview of exactly that text',async({page})=>{
  const sent=[];
  page.on('request',request=>{if(request.url().endsWith('/api/preview')&&request.postDataJSON().phase==='page')sent.push(request.postDataJSON());});
  await draft(page).fill('Create an evaporation slide.');
  await page.getByRole('button',{name:'Explore interactively',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document title'})).toHaveValue(evaporationTitle);
  await draft(page).click();
  await draft(page).pressSequentially('Add a short quiz.');
  await advancePreview(page);
  await expect(quickAnswer(page)).toBeVisible();
  const shown=(await page.locator('#quick-answer').textContent()).trim();
  await page.getByRole('button',{name:'Explore interactively',exact:true}).click();
  await expect.poll(()=>sent.length).toBe(2);
  expect(sent[1].promised).toBe(shown);                       // the line the user read
  const resume=server.holdPreview('Add a map.');                  // this text's preview never finishes
  try{
    await draft(page).click();
    await draft(page).pressSequentially('Add a map.');
    await advancePreview(page);
    await page.getByRole('button',{name:'Explore interactively',exact:true}).click();
    await expect.poll(()=>sent.length).toBe(3);
    expect(sent[2].promised).toBeUndefined();                     // an unfinished preview is not a promise
  }finally{resume();}
});

test('with a page open, the page card is a rounded box that scrolls inside and shrinks while typing',async({page})=>{
  await draft(page).fill('Explain all three Kepler laws.');
  await page.getByRole('button',{name:'Explore interactively',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document title'})).not.toHaveValue('');
  const card=page.locator('.paper');
  const reading=await card.boundingBox();
  await draft(page).click();
  await draft(page).pressSequentially('Add a worked example.');
  await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished)));
  const typing=await card.boundingBox();
  expect(typing.height).toBeLessThan(reading.height);                     // the card gives the dock room
  const look=await page.evaluate(()=>{const p=document.querySelector('.paper'),s=getComputedStyle(p),c=document.querySelector('.composer').getBoundingClientRect();
    return {radius:s.borderBottomLeftRadius,scrolls:s.overflowY==='auto'&&p.scrollHeight>p.clientHeight,aboveField:p.getBoundingClientRect().bottom<=c.top,line:getComputedStyle(document.querySelector('.intent-panel')).borderTopWidth,windowScroll:document.documentElement.scrollHeight-innerHeight};});
  expect(look).toEqual({radius:'18px',scrolls:true,aboveField:true,line:'0px',windowScroll:0});
});

test('with a page open, a live question appearing or going away does not move the page card',async({page})=>{
  await draft(page).fill('Explain all three Kepler laws.');
  await page.getByRole('button',{name:'Explore interactively',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Document title'})).not.toHaveValue('');
  await draft(page).click();
  await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished)));
  const card=page.locator('.paper');
  const before=await card.boundingBox();
  await draft(page).pressSequentially(japanCheckpoint+' ');
  await advancePreview(page);
  const question=page.getByRole('button',{name:'Clarifying question: '+japanQuestion});
  await expect(question).toBeInViewport();
  await expectSameGeometry(card,before);                          // the question used reserved space
  await draft(page).fill('');
  await draft(page).pressSequentially('Add a worked example.');
  await advancePreview(page);
  await expect(question).toBeHidden();
  await expect(page.getByRole('button',{name:/^Clarifying question/})).toHaveCount(0);   // the empty row is not announced
  await expectSameGeometry(card,before);
});

test('when a live answer fails, the question that was showing stays usable',async({page})=>{
  const editor=draft(page);
  await editor.fill(requirementsDraft);
  await advancePreview(page);
  const question=page.getByRole('button',{name:'Clarifying question: '+requirementsQuestion});
  await expect(question).toBeEnabled();
  await editor.pressSequentially(' break it');
  await advancePreview(page);
  await expect(page.locator('#status')).toBeVisible();                       // the error is shown…
  await expect(question).toBeEnabled();                                      // …and the question still works
  await question.click();
  await expect(page.locator('#intent-popover')).toBeVisible();
});

