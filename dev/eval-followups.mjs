// Live multi-turn evaluation: create a page, then change it with follow-up instructions, and check
// after every step that (1) the instruction was followed and (2) the visualization is factually
// correct (real distances, coordinates, dates, shares). Drives the real app in Chrome; the page
// after each step is read through the app's own Export, so scoped merges are included.
//
// Usage (with `npm run dev` running and an OpenAI key configured):
//   npm run eval:followups
//   EVAL_ONLY=planets,nordic npm run eval:followups
// Results and screenshots go to artifacts/eval/followups-<timestamp>/ (ignored by Git).
import {chromium} from 'playwright';
import {mkdir, writeFile, readFile} from 'node:fs/promises';

// ── Reference data for correctness checks ────────────────────────────────────
const AU = {mercury: 0.39, venus: 0.72, earth: 1, mars: 1.52, jupiter: 5.2, saturn: 9.54, uranus: 19.2, neptune: 30.06};
const CITY = {oslo: [59.91, 10.75], stockholm: [59.33, 18.07], copenhagen: [55.68, 12.57], helsinki: [60.17, 24.94], reykjavik: [64.15, -21.94]};
const PH = [[/lemon/i, 2.2], [/stomach|gastric/i, 1.8], [/vinegar/i, 2.8], [/cola|soda drink|soft drink/i, 2.8], [/coffee/i, 5], [/milk/i, 6.6], [/pure water|distilled|^water$/i, 7], [/blood/i, 7.4], [/sea ?water|ocean/i, 8.1], [/baking soda/i, 8.4], [/soap/i, 10], [/ammonia/i, 11.5], [/bleach/i, 12.8], [/drain cleaner|lye/i, 13.8]];

// ── Helpers over the exported page ───────────────────────────────────────────
const blocks = page => page.component?.components || [];
const block = (page, type) => blocks(page).find(b => b.type === type);
const has = (page, type) => !!block(page, type);
const text = page => [page.title, ...(page.component?.body || []), ...blocks(page).flatMap(b => [b.title, b.prompt, ...b.items.flatMap(i => [i.label, i.detail])])].join(' ');
const close = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
const check = (name, ok, detail = '') => ({name, ok: !!ok, detail});

const SCENARIOS = [
  {id: 'kepler', steps: [
    {say: 'Explain Kepler’s three laws for high school students', checks: p => [check('orbit simulation', p.component.kind === 'kepler')]},
    {say: 'Make it simpler for a 10-year-old', checks: (p, prev) => [
      check('still the orbit simulation', p.component.kind === 'kepler'),
      check('no technical jargon', !/semi-major|eccentricit|proportional to the cube|ellipse with the Sun at a focus/i.test(p.component.body.join(' ')), p.component.body.join(' | ').slice(0, 220)),
      check('shorter or equal text', p.component.body.join(' ').length <= prev.component.body.join(' ').length * 1.15)]},
    {say: 'Instead compare Mercury and Neptune side by side', checks: p => {
      const c = block(p, 'comparison');
      return [check('comparison component', c), check('Mercury and Neptune compared', c && /mercury/i.test(c.items.map(i => i.label).join()) && /neptune/i.test(c.items.map(i => i.label).join()), c?.items.map(i => i.label).join(', '))];
    }}
  ]},
  {id: 'water', steps: [
    {say: 'Explain the water cycle for middle school students', checks: p => [check('cycle component', has(p, 'cycle'))]},
    {say: 'Add a short quiz so I can test myself', checks: p => [
      check('quiz added (prediction, flashcards or practice)', ['prediction', 'flashcards', 'practice'].some(t => has(p, t)), blocks(p).map(b => b.type).join(', ')),
      check('water cycle kept', has(p, 'cycle'))]},
    {promote: true}
  ]},
  {id: 'planets', steps: [
    {say: 'Show how far each planet is from the Sun in AU as a chart', checks: p => {
      const c = block(p, 'chart'), wrong = (c?.items || []).filter(i => { const k = Object.keys(AU).find(n => i.label.toLowerCase().includes(n)); return k && !close(i.value, AU[k], AU[k] * 0.1); });
      return [check('chart component', c), check('distances within 10 % of real values', c && !wrong.length, c?.items.map(i => `${i.label}=${i.value}`).join(', '))];
    }},
    {say: 'Only keep the four inner planets', checks: p => {
      const c = block(p, 'chart'), labels = (c?.items || []).map(i => i.label.toLowerCase());
      return [check('exactly Mercury, Venus, Earth, Mars', c && labels.length === 4 && ['mercury', 'venus', 'earth', 'mars'].every(n => labels.some(l => l.includes(n))), labels.join(', ')),
        check('values still correct', c && c.items.every(i => { const k = Object.keys(AU).find(n => i.label.toLowerCase().includes(n)); return k && close(i.value, AU[k], AU[k] * 0.1); }), c?.items.map(i => `${i.label}=${i.value}`).join(', '))];
    }}
  ]},
  {id: 'ww1', steps: [
    {say: 'What were the key events that led to World War 1? Show them as a timeline', checks: p => {
      const t = block(p, 'timeline'), years = (t?.items || []).map(i => +((i.label + ' ' + i.detail).match(/\b(18[7-9]\d|19[01]\d)\b/) || [])[1]);
      return [check('timeline component', t), check('every step dated 1870–1919', t && years.every(Boolean), years.join(', ')), check('in chronological order', years.every((y, i) => !i || y >= years[i - 1]), years.join(' → '))];
    }},
    {say: 'Put the year at the start of every step label', checks: p => {
      const t = block(p, 'timeline');
      return [check('labels start with a year', t && t.items.every(i => /^\s*(18|19)\d\d\b/.test(i.label)), t?.items.map(i => i.label).join(' | '))];
    }}
  ]},
  {id: 'nordic', steps: [
    {say: 'Show the capitals of Norway, Sweden, Denmark and Finland on a map', checks: p => {
      const m = block(p, 'map'), off = (m?.items || []).filter(i => { const k = Object.keys(CITY).find(n => i.label.toLowerCase().includes(n)); return !k || !close(i.latitude, CITY[k][0], 1) || !close(i.longitude, CITY[k][1], 1); });
      return [check('map component', m), check('coordinates within 1° of the real cities', m && !off.length, m?.items.map(i => `${i.label} ${i.latitude},${i.longitude}`).join('; '))];
    }},
    {say: 'Also add Reykjavik', checks: p => {
      const m = block(p, 'map'), r = m?.items.find(i => /reykjav/i.test(i.label));
      return [check('Reykjavik added at the right place', r && close(r.latitude, 64.15, 1) && close(r.longitude, -21.94, 1), r && `${r.latitude},${r.longitude}`), check('the four capitals kept', (m?.items.length || 0) >= 5)];
    }}
  ]},
  {id: 'air', steps: [
    {say: 'What is dry air made of?', checks: p => {
      const pr = block(p, 'proportion') || block(p, 'chart'), total = (pr?.items || []).reduce((s, i) => s + i.value, 0), share = n => (pr?.items.find(i => new RegExp(n, 'i').test(i.label))?.value || 0) / total * 100;
      return [check('proportion or chart', pr), check('nitrogen ≈ 78 %, oxygen ≈ 21 %', pr && close(share('nitrogen'), 78, 2) && close(share('oxygen'), 21, 2), pr?.items.map(i => `${i.label}=${i.value}`).join(', '))];
    }},
    {say: 'Show the same data as a bar chart instead', checks: p => {
      const c = block(p, 'chart'), n = c?.items.find(i => /nitrogen/i.test(i.label));
      return [check('bar chart now', c), check('same values (nitrogen ≈ 78)', n && close(n.value, 78, 1.5), c?.items.map(i => `${i.label}=${i.value}`).join(', '))];
    }}
  ]},
  {id: 'rent', steps: [
    {say: 'Compare renting and buying a home for a first-time buyer', checks: p => [check('comparison component', has(p, 'comparison'))]},
    {say: 'Turn this into a checklist I can work through before deciding', checks: p => [check('checklist component', has(p, 'checklist'), blocks(p).map(b => b.type).join(', '))]}
  ]},
  {id: 'matrix', steps: [
    {say: 'Help me prioritise my tasks this week using urgency and importance', checks: p => {
      const m = block(p, 'matrix');
      return [check('2×2 matrix', m && m.items.length === 4), check('axes are urgency and importance', m && /urgen/i.test(m.prompt) && /importan/i.test(m.prompt), m?.prompt)];
    }},
    {say: 'Rename the four quadrants to one word each', focus: 'matrix', checks: (p, prev) => {
      const m = block(p, 'matrix');
      return [check('one-word quadrant labels', m && m.items.every(i => i.label.trim().split(/\s+/).length === 1), m?.items.map(i => i.label).join(', ')),
        check('only the matrix changed (intro unchanged)', p.component.body[0] === prev.component.body[0])];
    }}
  ]},
  {id: 'german', steps: [
    {say: 'Explain photosynthesis for middle school students', checks: p => [check('has a visual', blocks(p).length > 0)]},
    {say: 'Translate the whole page into German', checks: p => {
      const words = (text(p).match(/\b(und|die|der|das|ist|mit|von|nicht|werden|Pflanzen|Licht)\b/g) || []).length;
      return [check('page is in German', words >= 8, `${words} German function words`), check('visual kept', blocks(p).length > 0)];
    }}
  ]},
  {id: 'sine', steps: [
    {say: 'Let me explore the sine function between -6 and 6', checks: p => {
      const f = block(p, 'function_plot');
      return [check('function plot of sine', f && f.prompt === 'sine'), check('domain −6 to 6', f && close(f.items[0].value, -6, 0.5) && close(f.items[1].value, 6, 0.5), f?.items.map(i => i.value).join(' to '))];
    }},
    {say: 'Change it to the square function from -3 to 3', checks: p => {
      const f = block(p, 'function_plot');
      return [check('square function', f && f.prompt === 'square'), check('domain −3 to 3', f && close(f.items[0].value, -3, 0.5) && close(f.items[1].value, 3, 0.5), f?.items.map(i => i.value).join(' to '))];
    }}
  ]},
  {id: 'projectile', steps: [
    {say: 'Let me explore ideal projectile motion', checks: p => [check('projectile simulation', p.component.kind === 'projectile')]},
    {say: 'Show the same launch on the Moon', checks: p => [
      check('still the simulation', p.component.kind === 'projectile'),
      check('simulation set to Moon gravity', close(p.component.physics?.gravity, 1.62, 0.01), `gravity ${p.component.physics?.gravity}`),
      check('page talks about the Moon', /moon/i.test(text(p)))]}
  ]},
  {id: 'ph', steps: [
    {say: 'Show where common substances sit on the pH scale', checks: p => {
      const s = block(p, 'spectrum'), known = (s?.items || []).map(i => [i, PH.find(([re]) => re.test(i.label))]).filter(([, m]) => m);
      const wrong = known.filter(([i, [, ph]]) => !close(i.value, ph / 14 * 100, 8));
      return [check('spectrum component', s), check('positions match real pH (±1)', s && known.length >= 3 && !wrong.length, known.map(([i, [, ph]]) => `${i.label}: ${i.value} (pH ${ph} → ${Math.round(ph / 14 * 100)})`).join('; '))];
    }},
    {say: 'Add seawater', checks: p => {
      const s = block(p, 'spectrum'), w = s?.items.find(i => /sea ?water|ocean/i.test(i.label));
      return [check('seawater added near pH 8', w && close(w.value, 8.1 / 14 * 100, 8), w && `${w.label}: ${w.value}`)];
    }}
  ]}
];

async function exportPage(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-button').click()]);
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

async function send(page, say, focus) {
  if (focus) {
    // Focus lives in the expanded composer; the one-line bar hides it until clicked.
    await page.getByRole('textbox', {name: 'Your next instruction'}).click();
    await page.locator('#composer-scope').click();
    const title = await page.locator(`.component-block.component-${focus} .component-title`).first().textContent();
    await page.locator('#intent-popover').getByRole('button', {name: new RegExp('^' + (title || focus).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))}).first().click();
  }
  const composer = page.getByRole('textbox', {name: 'Your next instruction'});
  await composer.click();
  await composer.fill(say);
  const started = Date.now();
  await page.keyboard.press('Meta+Enter');
  await page.waitForFunction(() => document.querySelector('.document-panel')?.hasAttribute('data-generating'), null, {timeout: 10000}).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.document-panel')?.hasAttribute('data-generating'), null, {timeout: 90000});
  let proposal = false;
  if (await page.locator('#proposal').isVisible()) { proposal = true; await page.locator('#accept-button').click(); }
  await page.waitForTimeout(800);
  return {ms: Date.now() - started, proposal};
}

async function run() {
  const base = new URL(process.env.EVAL_BASE_URL || 'http://127.0.0.1:4317');
  const config = await fetch(new URL('/api/config', base)).then(r => r.json()).catch(() => null);
  if (!config?.serverKey) throw new Error('Start the local app with an OpenAI key before running this check.');
  const only = process.env.EVAL_ONLY?.split(',');
  const dir = new URL(`../artifacts/eval/followups-${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url);
  await mkdir(dir, {recursive: true});
  const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  const report = [];
  for (const scenario of SCENARIOS.filter(s => !only || only.includes(s.id))) {
    const context = await browser.newContext({viewport: {width: 1280, height: 860}, acceptDownloads: true});
    const page = await context.newPage();
    await page.goto(base.href);
    let previous = null;
    for (const [index, step] of scenario.steps.entries()) {
      const label = `${scenario.id} ${index + 1}`;
      try {
        let timing;
        if (step.promote) {
          const tab = page.getByRole('tab').first();
          await tab.click();
          await page.waitForFunction(() => document.querySelector('.atlas-next-answer')?.textContent.trim().length > 20, null, {timeout: 30000});
          const question = await tab.textContent(), answer = await page.locator('.atlas-next-answer').textContent();
          await page.getByRole('button', {name: 'Make this the main slide'}).click();
          await page.waitForFunction(() => document.querySelector('.document-panel')?.hasAttribute('data-generating'), null, {timeout: 10000}).catch(() => {});
          await page.waitForFunction(() => !document.querySelector('.document-panel')?.hasAttribute('data-generating'), null, {timeout: 90000});
          const exported = await exportPage(page);
          const words = question.toLowerCase().match(/[a-z]{5,}/g) || [];
          const results = [check('Go deeper answer shown in place', answer.trim().length > 20, answer.slice(0, 140)),
            check('promoted slide is about the question', words.some(w => text(exported).toLowerCase().includes(w)), `Q: ${question} → "${exported.title}"`),
            check('opened as the next slide', (await page.locator('#page-position').textContent()).trim().startsWith(String(index + 1)))];
          report.push({step: label, say: `[Go deeper] ${question}`, title: exported.title, results});
          previous = exported;
        } else {
          timing = await send(page, step.say, step.focus);
          const exported = await exportPage(page);
          const results = step.checks(exported, previous);
          if (timing.proposal) results.push(check('applied without a review box', false, 'arrived as a proposal'));
          report.push({step: label, say: step.say, title: exported.title, seconds: +(timing.ms / 1000).toFixed(1), types: [exported.component.kind, ...blocks(exported).map(b => b.type)].join('+'), results, page: exported});
          previous = exported;
        }
        await page.screenshot({path: new URL(`${scenario.id}-${index + 1}.png`, dir).pathname, fullPage: true});
      } catch (error) {
        report.push({step: label, say: step.say || 'promote', results: [check('step completed', false, error.message.split('\n')[0])]});
        await page.screenshot({path: new URL(`${scenario.id}-${index + 1}-error.png`, dir).pathname}).catch(() => {});
        break;
      }
      const last = report.at(-1);
      console.log(`${last.step.padEnd(13)} ${last.results.every(r => r.ok) ? 'PASS' : 'FAIL'}  ${last.say.slice(0, 60).padEnd(60)} ${last.types || ''} ${last.seconds ? last.seconds + ' s' : ''}`);
      for (const r of last.results.filter(r => !r.ok)) console.log(`               ✗ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    }
    await context.close();
  }
  await browser.close();
  const all = report.flatMap(r => r.results);
  console.log(`\n${all.filter(r => r.ok).length}/${all.length} checks passed across ${report.length} steps`);
  await writeFile(new URL('results.json', dir), JSON.stringify(report, null, 2));
  console.log('Report and screenshots:', dir.pathname);
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
