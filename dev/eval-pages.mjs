// Live, opt-in page quality check. Drives the real local app in Chrome with a fixed set of
// prompts, captures each generated page and a screenshot, and scores it against the design
// rules: the answer fits the first screen, a visual carries the explanation, text stays short,
// nothing is said twice, and Go deeper offers next steps.
//
// Usage (with `npm run dev` running and an OpenAI key configured):
//   npm run eval:pages                 # all prompts
//   EVAL_ONLY=kepler,email npm run eval:pages
// Sends each prompt through the local server to OpenAI (Terra for the page, Luna for previews
// and Go deeper). Results go to artifacts/eval/<timestamp>/ (ignored by Git).
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';

const PROMPTS = [
  {id: 'kepler', text: 'Explain Kepler’s three laws of planetary motion for high school students'},
  {id: 'feynman', text: 'Teach me the Feynman technique for learning'},
  {id: 'vaccines', text: 'Explain how vaccines train the immune system for high school students'},
  {id: 'photosynthesis', text: 'Explain how photosynthesis works for middle school students'},
  {id: 'rent-buy', text: 'Compare renting and buying a home for a first-time buyer'},
  {id: 'bill-law', text: 'How does a bill become a law in the United States?'},
  {id: 'python-js', text: 'Should I learn Python or JavaScript first as a beginner programmer?'},
  {id: 'air', text: 'What is dry air made of?'},
  {id: 'priorities', text: 'Help me prioritise my tasks this week using urgency and importance'},
  {id: 'email', text: 'Write a short thank-you email to my team for finishing the launch', textFirst: true},
  // Plans and trips show the plan itself (a route map, the days or weeks), never a form of fields.
  {id: 'rome-venice', text: 'Plan three days in Rome and Venice', expect: {uses: ['map'], route: true, noForm: true}},
  {id: 'lisbon', text: 'Plan a weekend trip to Lisbon with my parents', expect: {uses: ['map'], noForm: true}},
  {id: 'run-5k', text: 'Make a 4-week running plan to go from zero to 5k', expect: {noForm: true}},
  {id: 'dinner', text: 'I want to cook a vegetarian dinner for six friends tonight', expect: {noForm: true}},
  {id: 'europe-cities', text: 'What are the biggest cities in Europe by population?', expect: {uses: ['chart']}}
];

const STOP = new Set('a an the and or of to in on for with is are be it its this that as by at from can into than then their they you your we our when how what why which who more most less not no do does'.split(' '));
const words = text => new Set((text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter(w => !STOP.has(w)));
function overlap(a, b) {
  const A = words(a), B = words(b);
  if (A.size < 4 || B.size < 4) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

// Scores one generated page. Pure, so it can be unit-tested without a browser.
export function scorePage(page, {fitsFirstScreen = null, textFirst = false, expect = null} = {}) {
  const body = Array.isArray(page.body) ? page.body : [];
  const components = Array.isArray(page.components) ? page.components : [];
  const intro = body[0] || '';
  const rest = body.slice(1);
  const takeaways = rest.map(t => t.match(/^([^:\n]{1,32}):\s+(\S[\s\S]*)$/)).filter(Boolean);
  const visual = components.length > 0 || ['kepler', 'projectile'].includes(page.kind);
  const details = components.flatMap(c => c.items.map(i => i.detail));
  const labels = components.flatMap(c => c.items.map(i => i.label.toLowerCase()));
  const prose = [intro, ...rest];
  const repeats = [];
  prose.forEach(text => details.forEach(detail => { if (overlap(text, detail) >= 0.6) repeats.push([text.slice(0, 60), detail.slice(0, 60)]); }));
  const duplicateLabels = labels.filter((l, i) => labels.indexOf(l) !== i);
  const checks = textFirst ? {
    'text-first: deliverable present': body.join(' ').length >= 80,
    'text-first: no visual forced': !visual
  } : {
    'has a visual': visual,
    'fits first screen': fitsFirstScreen !== false,
    'intro ≤ 160 chars': intro.length <= 160,
    'takeaways are Label: sentence': rest.length === takeaways.length,
    '≤ 3 takeaways, each ≤ 140 chars': takeaways.length <= 3 && takeaways.every(m => m[2].length <= 140),
    'no repeated content': repeats.length === 0 && duplicateLabels.length === 0,
    '2–3 Go deeper questions': (page.followUps?.length || 0) >= 2 && page.followUps.length <= 3,
    '≤ 3 views': components.length <= 3
  };
  if (expect?.noForm) checks['shows the plan, not a form'] = page.kind !== 'planner';
  for (const type of expect?.uses || []) checks[`uses ${type}`] = components.some(c => c.type === type);
  if (expect?.route) checks['map is a route'] = components.some(c => c.type === 'map' && /^route$/i.test(c.prompt.trim()));
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    checks, passed, total: Object.keys(checks).length,
    types: page.kind === 'outline' ? components.map(c => c.type) : [page.kind, ...components.map(c => c.type)],
    introChars: intro.length, takeaways: takeaways.map(m => m[1]), repeats, followUps: page.followUps || []
  };
}

async function run() {
  const base = new URL(process.env.EVAL_BASE_URL || 'http://127.0.0.1:4317');
  if (base.hostname !== '127.0.0.1') throw new Error('Use the loopback address 127.0.0.1 so the local key is used.');
  const config = await fetch(new URL('/api/config', base)).then(r => r.json()).catch(() => null);
  if (!config?.live) throw new Error('Start the local app with an OpenAI key before running this check.');
  const only = process.env.EVAL_ONLY?.split(',');
  const prompts = PROMPTS.filter(p => !only || only.includes(p.id));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = new URL(`../artifacts/eval/${stamp}/`, import.meta.url);
  await mkdir(dir, {recursive: true});
  const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  const results = [];
  for (const prompt of prompts) {
    const context = await browser.newContext({viewport: {width: 1280, height: 800}});
    const page = await context.newPage();
    let generated = null;
    page.on('response', async response => {
      if (!response.url().endsWith('/api/preview')) return;
      try { if (response.request().postDataJSON().phase === 'page') generated = (await response.json()).preview; } catch {}
    });
    await page.goto(base.href);
    const started = Date.now();
    await page.getByRole('textbox', {name: 'Your next instruction'}).fill(prompt.text);
    await page.keyboard.press('Meta+Enter');
    try {
      await page.waitForFunction(() => document.querySelector('.document-panel.has-slide:not([data-generating])'), null, {timeout: 90000});
    } catch {
      results.push({...prompt, error: 'No page within 90 s'});
      await context.close();
      continue;
    }
    const ms = Date.now() - started;
    await page.waitForTimeout(600);
    // First screen: the hero (title, intro, visual, caption) ends above the floating composer.
    const fitsFirstScreen = await page.evaluate(() => {
      const hero = document.querySelector('.atlas-layout');
      const composer = document.querySelector('.composer');
      if (!hero) return null;
      return hero.getBoundingClientRect().bottom <= (composer?.getBoundingClientRect().top ?? innerHeight);
    });
    // More views arrive in the background a few seconds later: wait for them (or 10 s), then read
    // which components the page shows, so variety counts the whole page.
    await page.waitForSelector('[role=tablist][aria-label=Views]', {timeout: 10000}).catch(() => {});
    const views = await page.evaluate(() => [...document.querySelectorAll('.atlas-visual .component-block')]
      .map(block => [...block.classList].find(c => c.startsWith('component-') && c !== 'component-block')?.slice(10)));
    await page.screenshot({path: new URL(`${prompt.id}.png`, dir).pathname});
    const score = generated ? scorePage(generated, {fitsFirstScreen, textFirst: prompt.textFirst, expect: prompt.expect}) : null;
    results.push({...prompt, ms, title: generated?.title, score, page: generated, views});
    console.log(`${prompt.id.padEnd(15)} ${score ? `${score.passed}/${score.total}` : 'no data'}  ${(ms / 1000).toFixed(1)} s  ${(views.length ? views : score?.types || []).join(' · ')}`);
    await context.close();
  }
  await browser.close();
  const scored = results.filter(r => r.score);
  const summary = {
    when: new Date().toISOString(), prompts: results.length,
    passRate: scored.reduce((s, r) => s + r.score.passed, 0) / Math.max(1, scored.reduce((s, r) => s + r.score.total, 0)),
    medianSeconds: [...scored.map(r => r.ms / 1000)].sort((a, b) => a - b)[Math.floor(scored.length / 2)] ?? null,
    failures: Object.fromEntries(scored.map(r => [r.id, Object.entries(r.score.checks).filter(([, ok]) => !ok).map(([name]) => name)]))
  };
  await writeFile(new URL('results.json', dir), JSON.stringify({summary, results}, null, 2));
  // Variety: pages should not all look alike.
  summary.componentTypes = [...new Set(scored.flatMap(r => r.views?.length ? r.views : r.score.types))].sort();
  summary.multiView = scored.filter(r => (r.views?.length || 0) > 1).length;
  console.log(`\nPass rate ${(summary.passRate * 100).toFixed(0)} %, median ${summary.medianSeconds?.toFixed(1)} s`);
  console.log(`${summary.componentTypes.length} different components (${summary.componentTypes.join(', ')}); ${summary.multiView} pages with 2–3 views`);
  console.log('Failed checks:', JSON.stringify(summary.failures, null, 1));
  console.log('Report and screenshots:', dir.pathname);
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
