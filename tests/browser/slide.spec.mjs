import {expect,test} from '@playwright/test';
import {
  startFixtureServer,evaporationTitle,evaporationText,triangleTitle,slideAnswer,slideReplacement
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
const review=page=>page.clock.runFor(800);

async function send(page,text,expectedTitle){
  await page.getByRole('textbox',{name:'Your next instruction'}).fill(text);
  await button(page,'Explore interactively').click();
  await expect(title(page)).toHaveValue(expectedTitle);
}

test('undo restores typing bursts after reload without resetting the orbit',async({page})=>{
  await send(page,'Show an adjustable orbit.','Kepler’s laws');
  const original=await field(page).inputValue();
  await field(page).fill('A planet moves');
  await page.keyboard.insertText(' around a star.');
  await expect(field(page)).toHaveValue('A planet moves around a star.');
  await page.clock.runFor(1000);
  await field(page).fill('Planets move around stars.');
  const orbit=page.getByRole('slider',{name:'Eccentricity'});
  await orbit.press('Home');
  await page.reload();
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
  await field(page).fill(question);
  await review(page);
  const answer=page.getByRole('status',{name:'Answer'});
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
  await page.reload();
  await expect(title(page)).toHaveValue(evaporationTitle);
  await page.getByRole('button',{name:/^History /}).click();
  const entry=page.locator('.history-row').filter({hasText:triangleTitle});
  await expect(entry).toContainText('Later version');
  await entry.getByRole('button',{name:'Restore'}).click();
  await expect(title(page)).toHaveValue(triangleTitle);
});
