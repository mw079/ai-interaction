import {INFORMATION_TYPES} from '/intent.js';
import {renderInformationControl, formatPreview} from '/controls.js';

// Sample model suggestions for every information type (development fixtures, not model output).
const F = (question, options = [], extra = {}) => ({question, options, ...extra});
const fixtures = {
  output_format: F('How should the answer look?', ['Interactive orbit diagram', 'Step-by-step explanation', 'Comparison table', 'Short summary']),
  goal: F('What do you want to get out of it?', ['Understand the idea', 'Prepare for an exam', 'Teach it to someone']),
  audience: F('Who is this explanation for?', ['Middle school', 'High school', 'University']),
  prior_knowledge: F('What do you already know?', ['New to the topic', 'Know the basics', 'Studied it before']),
  depth: F('How deep should it go?', ['Quick overview', 'Clear explanation', 'Full derivation']),
  length: F('How long should it be?', ['100', '300', '600'], {unit: 'words'}),
  tone: F('Which tone fits?', ['Friendly', 'Precise', 'Playful'], {samples: ['Planets move in ovals, not perfect circles.', 'Planetary orbits are ellipses with the Sun at one focus.', 'Planets don’t do circles — they’re into ovals.']}),
  language: F('Which language?', ['English', 'German', 'Spanish', 'Japanese']),
  date: F('Which day?', ['2027-04-01']),
  date_range: F('Which dates?', []),
  time: F('What time?', []),
  duration: F('How long is the trip?', ['5 days', '7 days', '10 days'], {unit: 'days'}),
  location: F('Where should it be?', ['Florence', 'Siena', 'Lucca', 'Pisa']),
  geographic_scope: F('Which region?', ['Tuscany', 'Northern Italy', 'All of Italy']),
  budget: F('What is the budget?', ['100 EUR per night', '150 EUR per night'], {unit: 'EUR per night'}),
  quantity: F('How many people?', ['2', '4']),
  priorities: F('What matters most?', ['Quiet surroundings', 'Easy transport', 'Lower cost']),
  requirements: F('Anything that must be included?', ['Vegetarian meals', 'Step-free access', 'Free cancellation']),
  exclusions: F('Anything to leave out?', ['No flights', 'No crowded attractions']),
  comparison_options: F('What should be compared?', ['Train', 'Rental car', 'Bus']),
  flexible_dates: F('When could you travel?', []),
  area_map: F('Where should we search?', ['Old town', 'Near the station']),
  assumption: F('Is this assumption right?', ['You are travelling in spring']),
  goal_comparison: F('Which goal fits better?', ['Learn the concepts', 'Pass the exam'], {samples: ['Focus on intuition and examples you can explain.', 'Focus on the question types and formulas that are tested.']}),
  audience_knowledge: F('Who is it for, and what do they know?', ['Students', 'Parents', 'Teachers']),
  example: F('Which example should it use?', ['A planet', 'A comet'], {samples: ['Earth’s nearly circular orbit shows the laws gently.', 'A comet’s long ellipse makes the speed change obvious.']}),
  include_exclude: F('Which topics should it cover?', ['Newton’s law of gravity', 'Historical background', 'Equations']),
  tradeoff: F('Which balance do you prefer?', ['Faster · less scenic', 'Slower · more scenic'], {samples: ['Arrive by noon | Mostly motorway', 'Arrive by evening | Coast road and villages']})
};

const grid = document.getElementById('grid');
for (const [type, info] of Object.entries(INFORMATION_TYPES)) {
  const fixture = fixtures[type] || F(info.label);
  const card = document.createElement('section');
  const meta = document.createElement('div');
  meta.className = 'specimen-meta';
  meta.innerHTML = '<h2></h2><code></code>';
  meta.querySelector('h2').textContent = info.label;
  meta.querySelector('code').textContent = info.family;
  const sample = document.createElement('div');
  sample.className = 'picker-sample';
  const heading = document.createElement('h3');
  heading.textContent = fixture.question;
  const options = document.createElement('div');
  options.className = 'popover-options';
  const chosen = document.createElement('p');
  chosen.className = 'chosen';
  sample.append(heading, options);
  card.append(meta, sample, chosen);
  grid.append(card);
  const item = {type, phrase: info.label, question: fixture.question, options: fixture.options, samples: fixture.samples || [], unit: fixture.unit || '', value: '', confirmed: false};
  renderInformationControl(options, item, value => {
    chosen.replaceChildren('Inserts: ', Object.assign(document.createElement('b'), {textContent: value || '(cleared)'}));
  });
}

// The slide format picker, which lives in app.js, shown with its previews.
const formats = [['See the steps', 'Follow the process one step at a time', 'steps'], ['Explore the connections', 'See how the ideas relate', 'visual'], ['Compare side by side', 'Inspect the differences', 'grid'], ['Explore the numbers', 'Inspect values in a chart', 'chart']];
const card = document.createElement('section');
card.innerHTML = '<div class="specimen-meta"><h2>Slide format</h2><code>slide picker</code></div>';
const sample = document.createElement('div');
sample.className = 'picker-sample popover-options';
sample.id = 'popover-options';
const heading = document.createElement('h3');
heading.textContent = 'How would you like to explore this?';
sample.append(heading);
formats.forEach(([label, detail, kind], i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'slide-option';
  b.setAttribute('aria-pressed', String(i === 0));
  const text = document.createElement('span');
  text.className = 'slide-option-text';
  text.innerHTML = '<span class="slide-option-title"></span><span class="slide-option-detail"></span>';
  text.firstChild.textContent = label;
  text.lastChild.textContent = detail;
  b.append(formatPreview(label, kind), text);
  sample.append(b);
});
card.append(sample);
grid.prepend(card);
