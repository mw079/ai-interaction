// Live, opt-in check of which picker (information type) the live-help model attaches to a
// phrase. Each case is a draft written so that one picker type clearly fits; the check passes
// when that type is among the highlighted phrases. Two sets: "tuned" was used while writing the
// prompt's picker examples, "unseen" was not, so a gap between them shows overfitting.
//
// Usage (with the local app running and an OpenAI key configured):
//   npm run eval:pickers                  # both sets
//   EVAL_ONLY=unseen npm run eval:pickers
// Each case sends one live-help request (Luna) through the local server; 48 requests in all.
// Results go to artifacts/eval/pickers-<timestamp>/ (ignored by Git).
import {mkdir, writeFile} from 'node:fs/promises';
import {informationFor, INFORMATION_TYPES} from '../public/composer/intent.js';

export const SETS = {
  tuned: [
    ['output_format', 'Give me an overview of the causes of World War 1'],
    ['goal', 'I want to get better at public speaking'],
    ['audience', 'Explain black holes for my 8 year old'],
    ['prior_knowledge', 'Teach me SQL, I already know Excel well'],
    ['depth', 'Explain quantum entanglement briefly'],
    ['length', 'Write a short bio for my LinkedIn profile'],
    ['tone', 'Write a message to my boss asking for a raise'],
    ['language', 'Translate my welcome speech into another language'],
    ['date', 'Remind me what to prepare before my exam on March 3'],
    ['date_range', 'Plan my vacation from July 10 to July 20'],
    ['time', 'Find a good time for a team call tomorrow afternoon'],
    ['duration', 'Plan a 3-day trip to Vienna'],
    ['location', 'Find good coffee shops in Berlin'],
    ['location', 'Compare healthcare systems across Europe'],
    ['budget', 'Plan a birthday party for under 300 euros'],
    ['quantity', 'Give me 10 ideas for team building activities'],
    ['priorities', 'Help me choose a laptop that is light, fast and cheap'],
    ['requirements', 'Plan a trip that must be wheelchair accessible and pet friendly'],
    ['requirements', 'Suggest dinner recipes but no nuts or shellfish'],
    ['comparison_options', 'Compare Netflix, Disney+ and HBO Max'],
    ['flexible_dates', 'Plan a trip to Japan sometime in spring'],
    ['area_map', 'Find a quiet neighborhood to stay near the old town'],
    ['assumption', 'Plan my commute to the new office'],
    ['goal_comparison', 'Should I study for the exam or focus on the project?'],
    ['audience', 'Prepare a talk about climate change for my colleagues'],
    ['example', 'Explain recursion with an example'],
    ['include_exclude', 'Summarize the history of Rome, maybe including the Byzantine Empire'],
    ['goal_comparison', 'Should I take the faster flight with a layover or the slower direct train?']
  ],
  unseen: [
    ['output_format', 'Explain the French Revolution as a short presentation'],
    ['goal', 'I want to finally understand my taxes'],
    ['audience', 'Explain inflation for a group of retirees'],
    ['prior_knowledge', 'Teach me React, I have only used jQuery before'],
    ['depth', 'Give me a detailed explanation of how vaccines work'],
    ['length', 'Write a one-paragraph description of my bakery'],
    ['tone', 'Write a reply to an angry customer about a late delivery'],
    ['language', 'Write a birthday card in Italian'],
    ['date', 'What should I do to prepare for my wedding on June 14?'],
    ['date_range', 'Plan a conference schedule from 3 to 5 October'],
    ['time', 'Suggest a workout I can do early in the morning'],
    ['duration', 'Plan a six-month savings challenge'],
    ['location', 'Recommend museums in Amsterdam'],
    ['location', 'Which countries in South America are safest for backpackers?'],
    ['budget', 'Find a gift for my dad around 40 dollars'],
    ['quantity', 'Plan meals for a family of five'],
    ['priorities', 'Find an apartment that is quiet, bright and near a park'],
    ['requirements', 'Find a hotel with free parking and a pool'],
    ['requirements', 'Plan a menu without dairy or gluten'],
    ['comparison_options', 'Compare Spotify, Apple Music and Tidal'],
    ['flexible_dates', 'Book a city break sometime next summer'],
    ['area_map', 'Find a hotel close to the river in Prague'],
    ['assumption', 'Help me plan my move to a new apartment'],
    ['goal_comparison', 'Should I focus on getting promoted or on finding a new job?'],
    ['audience', 'Prepare a training on cybersecurity for our sales team'],
    ['example', 'Explain opportunity cost and illustrate it'],
    ['include_exclude', 'Give me an overview of jazz, perhaps also covering its links to blues'],
    ['goal_comparison', 'Should I take the job with higher pay but a longer commute?']
  ]
};

async function run() {
  const base = new URL(process.env.EVAL_BASE_URL || 'http://127.0.0.1:4317');
  if (base.hostname !== '127.0.0.1') throw new Error('Use the loopback address 127.0.0.1 so the local key is used.');
  const config = await fetch(new URL('/api/config', base)).then(r => r.json()).catch(() => null);
  if (!config?.live) throw new Error('Start the local app with an OpenAI key before running this check.');
  const only = process.env.EVAL_ONLY?.split(',');
  const unknown = Object.values(SETS).flat().map(([type]) => type).filter(type => !INFORMATION_TYPES[type]);
  if (unknown.length) throw new Error('Unknown picker types in the cases: ' + unknown.join(', '));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = new URL(`../artifacts/eval/pickers-${stamp}/`, import.meta.url);
  await mkdir(dir, {recursive: true});
  const report = {};
  for (const [name, cases] of Object.entries(SETS)) {
    if (only && !only.includes(name)) continue;
    const results = [];
    for (let i = 0; i < cases.length; i += 7) {   // a few at a time, like several people typing
      results.push(...await Promise.all(cases.slice(i, i + 7).map(async ([expected, text]) => {
        const response = await fetch(new URL('/api/preview', base), {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({text, audience: '', format: 'Auto', phase: 'preview', context: JSON.stringify({date: new Date().toISOString().slice(0, 10)})})});
        const data = await response.json().catch(() => ({}));
        const found = data.preview ? informationFor(text, data.preview.information || []).map(entry => ({phrase: entry.phrase, type: entry.type})) : [];
        return {expected, text, ok: found.some(entry => entry.type === expected), found, error: data.preview ? undefined : data.error || 'HTTP ' + response.status};
      })));
    }
    report[name] = results;
    const passed = results.filter(r => r.ok).length;
    console.log(`\n${name}: ${passed}/${results.length}`);
    for (const r of results.filter(r => !r.ok))
      console.log(`  ✗ ${r.expected.padEnd(18)} ${JSON.stringify(r.text).slice(0, 60).padEnd(61)} ${r.error || r.found.map(f => f.phrase + '→' + f.type).join(' | ') || 'nothing highlighted'}`);
  }
  await writeFile(new URL('results.json', dir), JSON.stringify(report, null, 2));
  console.log('\nReport:', dir.pathname);
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
