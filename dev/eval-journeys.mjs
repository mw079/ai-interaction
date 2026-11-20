// Live, opt-in end-to-end check: full user journeys in the real app, one per domain. Each one
// types the request like a person, records the live help (question, answer, highlights, Tab),
// opens a picker, sends, watches the page appear (title first) and gain its views, makes one
// follow-up (preview, status line, result) and opens Go deeper. Every stage is screenshotted and
// scored with simple automatic checks; overview.html shows all stages side by side for review.
//
// Usage (with the local app running and an OpenAI key configured):
//   DAILY_LIMIT=3000 npm run dev        # a run makes ~10 requests per journey
//   npm run eval:journeys                                  # all journeys at 1280 px
//   EVAL_WIDTHS=1280,390 EVAL_ONLY=garden,wedding npm run eval:journeys
// Results go to artifacts/eval/journeys-<timestamp>/ (ignored by Git).
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';

const JOURNEYS = [
  ['garden', 'How do I start a vegetable garden on a small balcony in a shady spot', 'Add a watering schedule'],
  ['car', 'My car makes a squeaking noise when I brake, what could it be', 'Show me which parts to check first'],
  ['stress', 'How can I manage stress before exams', 'Make it simpler'],
  ['tenant', 'What are my rights if my landlord keeps my deposit in Germany', 'Add the steps to get it back'],
  ['pitch', 'Help me structure a pitch for a food delivery startup for investors', 'Add a part about competitors'],
  ['seasons', 'Why do we have seasons on Earth', 'Add a quiz'],
  ['scales', 'Explain how major and minor scales differ for a beginner pianist', 'Add an example in C'],
  ['photo', 'How do aperture, shutter speed and ISO work together', 'Compare settings for portraits and landscapes'],
  ['wedding', 'Plan a small wedding for 50 guests on a budget in Tuscany', 'Add a timeline for the day'],
  ['protein', 'How much protein do I need if I lift weights three times a week', 'Show it as a chart for different body weights'],
  ['kitchen', 'Should I renovate my kitchen or bathroom first', 'Add a cost comparison'],
  ['python', 'Why does my Python loop skip items when I remove them from a list', 'Show the fixed code step by step'],
  ['impressionism', 'What makes impressionism different from realism', 'Add three famous paintings'],
  ['greenhouse', 'How does the greenhouse effect warm the planet', 'Make it for 10-year-olds'],
  ['career', 'Should I switch from marketing to data analysis at 35', 'Add a 6-month learning plan'],
  ['fractions', 'Help my 9 year old understand fractions', 'Add practice questions'],
  ['wine', 'How do I pair wine with Italian dishes', 'Add a vegetarian option'],
  ['marathon', 'Make a 16-week training plan for my first marathon', 'Add tapering advice'],
  ['copenhagen', 'Plan a long weekend in Copenhagen with kids', 'Add a rainy day option'],
  ['savings', 'How do I build an emergency fund on a 2500 euro salary', 'Show what happens if I save 10 or 20 percent']
];

const QUESTION_WORDS = /^(?:how|why|what|when|where|which|who|do|does|can|should|i|me|my)(?:\s+(?:how|why|what|do|does|did|i|me|my|can|should|is|are|the|a))*$/i;

// Scores one journey's record. Pure, so it can be unit-tested.
export function scoreJourney(r) {
  if (r.failure) return {'journey completed': false};
  const t = r.typing, p = r.picker;
  return {
    'live answer shown, ≤ 160 chars': !!t.answer && t.answer.length <= 160,
    'picker offers 3 options or own entry': !p || p.options.length >= 3 || p.ownEntry,
    'highlights are short details': t.highlights.every(h => h.phrase.split(/\s+/).length <= 6 && !QUESTION_WORDS.test(h.phrase.trim())),
    'Tab never asks for something': !/\b(?:share|provide|paste|tell me|let me know)\b/i.test(t.tab),
    'title on screen within 5 s': r.titleSeconds !== null && r.titleSeconds <= 5,
    'page within 20 s': r.pageSeconds <= 20,
    'views added': r.views.length >= 2,
    'follow-up preview starts with Will': /^Will\b/.test(r.followTyping.preview),
    'status line while changing': !!r.followStatus,
    'follow-up keeps the page': r.after.views.length >= Math.min(r.views.length, 2) && !r.after.proposal && !r.after.error,
    'Go deeper answers': !r.deeper || (r.deeper.answer || '').length > 40,
    'no script errors': r.errors.length === 0
  };
}

async function journey(browser, base, dir, width, [id, request, followUp]) {
  const tag = `${width}-${id}`, out = {id, width, request, followUp, errors: [], shots: []};
  const page = await browser.newPage({viewport: {width, height: width < 500 ? 820 : 800}});
  page.on('pageerror', e => out.errors.push(e.message));
  const shot = async name => { const file = `${tag}-${name}.png`; await page.screenshot({path: new URL(file, dir).pathname}); out.shots.push(file); };
  try {
    await page.goto(base.href);
    const field = page.getByRole('textbox', {name: 'Your next instruction'});
    await field.click();
    await field.pressSequentially(request, {delay: 35});
    await page.waitForTimeout(4500);
    out.typing = await page.evaluate(() => {
      const visible = el => el && !el.hidden && el.getClientRects().length > 0;
      const q = document.querySelector('#live-question'), tab = document.querySelector('.completion-text');
      return {
        question: visible(q) ? q.textContent.trim() : '',
        answer: visible(document.getElementById('quick-preview')) ? document.getElementById('quick-answer').textContent.trim() : '',
        highlights: [...document.querySelectorAll('#intent-refinements .phrase-access')].map(b => { const [type, phrase = ''] = b.getAttribute('aria-label').split(': '); return {type, phrase}; }),
        tab: tab && !tab.hidden ? tab.textContent : ''
      };
    });
    await shot('1-typing');
    if (out.typing.question) await page.locator('#live-question button').click();
    else { const mark = page.locator('#input-mirror mark').first(); if (await mark.count()) { const b = await mark.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); } }
    await page.waitForTimeout(600);
    out.picker = await page.evaluate(() => {
      const p = document.getElementById('intent-popover');
      if (p.hidden) return null;
      return {question: document.getElementById('popover-question').textContent,
        options: [...document.querySelectorAll('#popover-options button')].filter(b => !b.closest('.control-entry')).map(o => o.textContent.trim()).filter(Boolean),
        ownEntry: !!p.querySelector('.control-entry input, #popover-custom-form:not([hidden]), #custom-answer-button:not([hidden])')};
    });
    await shot('2-picker');
    await page.keyboard.press('Escape');
    await field.focus();
    const t0 = Date.now();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
    out.titleSeconds = await page.waitForFunction(() => document.getElementById('document-title').value && document.querySelector('.document-panel.has-slide'), null, {timeout: 60000})
      .then(() => (Date.now() - t0) / 1000).catch(() => null);
    if (out.titleSeconds !== null && await page.locator('.atlas-visual-pending').count()) await shot('3-writing');
    await page.waitForFunction(() => document.querySelector('.document-panel.has-slide:not([data-generating])'), null, {timeout: 90000});
    out.pageSeconds = (Date.now() - t0) / 1000;
    await page.locator('textarea[data-passage-index="0"]').evaluate(el => el.blur()).catch(() => {});
    const views = await page.waitForSelector('[role=tablist][aria-label=Views]', {timeout: 12000}).then(() => true).catch(() => false);
    out.viewsSeconds = views ? (Date.now() - t0) / 1000 : null;
    const readViews = () => page.evaluate(() => [...document.querySelectorAll('.atlas-visual>.component-block')].map(b => [...b.classList].find(c => c.startsWith('component-') && c !== 'component-block').slice(10) + ': ' + b.getAttribute('aria-label')));
    out.title = await page.locator('#document-title').inputValue();
    out.views = await readViews();
    await shot('4-page');
    const tabs = page.getByRole('tablist', {name: 'Views'}).getByRole('tab');
    for (let i = 1; i < (views ? await tabs.count() : 1); i++) { await tabs.nth(i).click(); await page.waitForTimeout(500); await shot(`5-view${i + 1}`); }
    if (views) await tabs.first().click();
    await field.click();
    await field.pressSequentially(followUp, {delay: 35});
    await page.waitForTimeout(4500);
    out.followTyping = await page.evaluate(() => {
      const visible = el => el && !el.hidden && el.getClientRects().length > 0, q = document.querySelector('#live-question');
      return {question: visible(q) ? q.textContent.trim() : '', preview: visible(document.getElementById('quick-preview')) ? document.getElementById('quick-answer').textContent.trim() : ''};
    });
    await shot('6-follow-up');
    const t1 = Date.now();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
    await page.waitForTimeout(700);
    out.followStatus = await page.locator('#change-status').isVisible() ? await page.locator('#change-status').textContent() : '';
    await shot('7-changing');
    await page.waitForFunction(() => !document.querySelector('.document-panel')?.hasAttribute('data-generating'), null, {timeout: 90000});
    out.followSeconds = (Date.now() - t1) / 1000;
    await page.waitForTimeout(1500);
    out.after = {title: await page.locator('#document-title').inputValue(), views: await readViews(),
      update: await page.locator('#page-update').textContent(), proposal: await page.locator('#proposal').isVisible(),
      error: await page.locator('#page-progress button').isVisible().catch(() => false)};
    await shot('8-changed');
    const deeper = page.getByRole('tablist', {name: 'Go deeper'}).getByRole('tab').first();
    if (await deeper.count()) {
      await deeper.click();
      await page.waitForFunction(() => document.querySelector('.atlas-next-answer')?.textContent.trim().length > 20, null, {timeout: 30000}).catch(() => {});
      out.deeper = {question: (await deeper.textContent()).trim(), answer: await page.locator('.atlas-next-answer').textContent().catch(() => '')};
      await page.waitForTimeout(400);
      await shot('9-deeper');
    }
  } catch (e) { out.failure = e.message.split('\n')[0]; await shot('x-failure').catch(() => {}); }
  await page.close();
  out.checks = scoreJourney(out);
  return out;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function overview(results) {
  const rows = results.map(r => `<section><h2>${esc(r.id)} · ${r.width} px</h2>
  <p><b>Request:</b> ${esc(r.request)}<br><b>Question:</b> ${esc(r.typing?.question || '—')} ${r.picker ? '[' + esc(r.picker.options.join(' / ')) + ']' : ''}<br><b>Answer:</b> ${esc(r.typing?.answer)}<br>
  <b>Highlights:</b> ${esc((r.typing?.highlights || []).map(h => h.phrase + ' → ' + h.type).join(' · ') || '—')}<br><b>Tab:</b> ${esc(r.typing?.tab || '—')}<br>
  <b>Page:</b> ${esc(r.title)} · title ${r.titleSeconds ?? '—'} s · page ${r.pageSeconds ?? '—'} s · views: ${esc((r.views || []).join(' / '))}<br>
  <b>Follow-up:</b> ${esc(r.followUp)} → ${esc(r.followTyping?.preview || '—')} · status: ${esc(r.followStatus || '—')} · after: ${esc((r.after?.views || []).join(' / '))} ${esc(r.after?.update || '')}<br>
  <b>Go deeper:</b> ${esc(r.deeper?.question || '—')} → ${esc((r.deeper?.answer || '').slice(0, 160))}</p>
  <ul>${Object.entries(r.checks).map(([name, ok]) => `<li class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${esc(name)}</li>`).join('')}</ul>
  <div class="shots">${r.shots.map(s => `<figure><a href="${s}"><img src="${s}" loading="lazy"></a><figcaption>${esc(s.split('-').slice(2).join('-').replace('.png', ''))}</figcaption></figure>`).join('')}</div></section>`).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>Journeys</title><style>body{font:14px system-ui;margin:24px;color:#1d1d1f}section{margin:0 0 40px}h2{font-size:18px}p{line-height:1.6}ul{display:flex;flex-wrap:wrap;gap:4px 14px;list-style:none;padding:0}.ok{color:#2e7d4f}.bad{color:#b4443c;font-weight:600}.shots{display:flex;gap:10px;overflow-x:auto}figure{margin:0;flex:none}img{width:300px;border:1px solid #ddd;border-radius:6px}figcaption{font-size:12px;color:#666}</style>
  <h1>Journeys</h1>${rows}`;
}

async function run() {
  const base = new URL(process.env.EVAL_BASE_URL || 'http://127.0.0.1:4317');
  if (base.hostname !== '127.0.0.1') throw new Error('Use the loopback address 127.0.0.1 so the local key is used.');
  const config = await fetch(new URL('/api/config', base)).then(r => r.json()).catch(() => null);
  if (!config?.live) throw new Error('Start the local app with an OpenAI key before running this check.');
  if (config.limited) throw new Error('Today’s request limit is reached; start the app with a higher DAILY_LIMIT for this run.');
  const only = process.env.EVAL_ONLY?.split(','), widths = (process.env.EVAL_WIDTHS || '1280').split(',').map(Number);
  const list = JOURNEYS.filter(([id]) => !only || only.includes(id));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = new URL(`../artifacts/eval/journeys-${stamp}/`, import.meta.url);
  await mkdir(dir, {recursive: true});
  const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  const results = [];
  for (const width of widths)
    for (let i = 0; i < list.length; i += 4)   // four people at a time
      results.push(...await Promise.all(list.slice(i, i + 4).map(item => journey(browser, base, dir, width, item))));
  await browser.close();
  await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 1));
  await writeFile(new URL('overview.html', dir), overview(results));
  let passed = 0, total = 0;
  for (const r of results) {
    const failed = Object.entries(r.checks).filter(([, ok]) => !ok).map(([name]) => name);
    passed += Object.keys(r.checks).length - failed.length; total += Object.keys(r.checks).length;
    console.log(`${(r.id + ' ' + r.width).padEnd(20)} ${failed.length ? '✗ ' + failed.join(' · ') : '✓'}${r.failure ? '  (' + r.failure + ')' : ''}`);
  }
  console.log(`\n${passed}/${total} checks across ${results.length} journeys`);
  console.log('Overview:', new URL('overview.html', dir).pathname);
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
