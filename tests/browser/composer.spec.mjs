import {expect,test} from '@playwright/test';
import {
  startFixtureServer,keplerDraft,keplerCompletion,keplerFollowUp,unfinishedComparison,
  completedComparison,comparisonAnswer,travelDraft,travelQuestion,kyotoChoice,kyotoAnswer
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
  await expect(page.locator('#mode-label')).toHaveText('OpenAI configured');
});

const draft=page=>page.getByRole('textbox',{name:'Your next instruction'});
const quickAnswer=page=>page.getByRole('region',{name:'Quick answer'});
const advancePreview=page=>page.clock.runFor(1200);

async function expectSameGeometry(locator,before){
  const after=await locator.boundingBox();
  for(const key of ['x','y','width','height'])expect(Math.abs(after[key]-before[key]),key).toBeLessThanOrEqual(1);
}

test('wrapped autocomplete stays visible at the same geometry and Tab accepts it once',async({page})=>{
  await draft(page).fill(keplerDraft);
  const composer=page.locator('.composer');
  // The typed draft can resize the field. Measure once that transition settles.
  await expect.poll(()=>composer.evaluate(el=>Math.abs(el.getBoundingClientRect().top-(innerHeight-el.offsetHeight)/2)))
    .toBeLessThanOrEqual(1);
  const wrapped=page.locator('.completion-overflow');
  await expect(wrapped).toBeHidden();
  const before=await composer.boundingBox();
  const fieldBefore=await draft(page).boundingBox();
  await advancePreview(page);

  await expect(wrapped).toBeVisible();
  await expect(wrapped).toHaveText(keplerCompletion);
  await expect(page.getByRole('button',{name:'Accept suggestion: '+keplerCompletion})).toBeVisible();
  await expect(page.locator('.completion-text')).toBeHidden();
  await expectSameGeometry(composer,before);
  await expectSameGeometry(draft(page),fieldBefore);
  expect((await wrapped.boundingBox()).y).toBeGreaterThanOrEqual(before.y+before.height);

  await draft(page).press('Tab');
  const accepted=keplerDraft+' '+keplerCompletion;
  await expect(draft(page)).toHaveValue(accepted);
  await expect(draft(page)).toBeFocused();
  await advancePreview(page);
  await expect(quickAnswer(page)).toHaveText(keplerFollowUp);
  await expect(wrapped).toBeHidden();
  await expect(page.locator('#completion-line')).toBeHidden();
  await draft(page).press('Tab');
  await expect(draft(page)).not.toBeFocused();
  await expect(draft(page)).toHaveValue(accepted);
});

test('unfinished comparison waits and resumes when the second subject is typed',async({page})=>{
  const requests=[];
  page.on('request',request=>{
    if(request.url().endsWith('/api/preview'))requests.push(request.postDataJSON());
  });
  await draft(page).fill(unfinishedComparison);
  await advancePreview(page);
  await expect(page.locator('#input-state')).toHaveText('Waiting for the second item to compare');
  await expect(quickAnswer(page)).toBeHidden();
  await expect(page.locator('#live-question')).toBeHidden();
  await expect(page.locator('#completion-line')).toBeHidden();
  expect(requests).toHaveLength(0);

  await draft(page).fill(completedComparison);
  await advancePreview(page);
  await expect(quickAnswer(page)).toHaveText(comparisonAnswer);
  expect(requests.map(request=>request.text)).toEqual([completedComparison]);

  await draft(page).fill('Explain the difference between evaporation and');
  await advancePreview(page);
  await expect(quickAnswer(page)).toBeHidden();
  expect(requests).toHaveLength(1);
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
