// Prebuilt interactive components: activities and explorers. Same rules as diagrams.js:
// the model supplies validated content; these renderers own layout, motion and state.
// Choosing what to look at is view state (no onEdit); only learner writing is a page edit.
import {SVG, el, svgEl, pct, frame} from './kit.js';
import {paintLand} from './maps.js';

const fmt = new Intl.NumberFormat(undefined, {maximumFractionDigits: 2});
const button = (cls, text, onClick) => {
  const b = el('button', cls, text);
  b.type = 'button';
  if (onClick) b.onclick = onClick;
  return b;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const parts = text => text.split(' | ').map(s => s.trim());

// A compact "2 / 5 ‹ ›" stepper for components that show their own content instead of a caption.
function miniStepper(count, current, select) {
  const nav = el('div', 'dg-nav');
  const index = el('span', 'dg-index');
  const prev = button('dg-step', '‹', () => select(current() - 1));
  const next = button('dg-step', '›', () => select(current() + 1));
  prev.setAttribute('aria-label', 'Previous');
  next.setAttribute('aria-label', 'Next');
  nav.append(index, prev, next);
  return {nav, paint: () => { index.textContent = `${current() + 1} / ${count}`; }};
}

// Learner writing shared by worked examples and practice. This text is page content.
function practiceField(content, block, saved, onEdit, ctx, placeholder) {
  const wrap = el('div', 'dg-practice');
  const label = el('label', 'dg-practice-label', 'Your explanation');
  const field = el('textarea', 'learner-practice');
  field.dataset.editKey = 'practice:' + block.id;
  field.rows = 3;
  field.maxLength = 1500;
  field.value = saved.practice || '';
  field.placeholder = placeholder || 'Explain it in your own words…';
  field.setAttribute('aria-label', 'Your explanation for ' + block.title);
  field.oninput = () => { saved.practice = field.value; onEdit(); send.disabled = !field.value.trim(); };
  label.append(field);
  const send = button('dg-primary', 'Get feedback', () => ctx.ask?.(ctx.section, block, field.value));
  send.disabled = !field.value.trim();
  wrap.append(label, send);
  content.append(wrap);
}

/* ── Parameter explorer: one input, a readout that moves, and its outcome ─── */
function renderParameter(content, block, saved, onEdit, detail) {
  const {items, prompt} = block;
  const f = frame(content, detail, block, saved, onEdit);
  f.stage.classList.add('dg-param');
  const head = el('div', 'dg-param-head');
  head.append(el('span', 'dg-eyebrow', prompt));
  const readout = el('div', 'dg-readout');
  head.append(readout);
  const range = el('input', 'dg-range');
  range.type = 'range';
  range.min = '0';
  range.max = String(items.length - 1);
  range.step = '1';
  range.setAttribute('aria-label', prompt);
  range.oninput = () => f.select(Number(range.value));
  const ticks = el('div', 'dg-ticks');
  ticks.style.setProperty('--n', items.length);
  const tickButtons = items.map((item, i) => {
    const t = button('dg-tick', item.label, () => f.select(i));
    ticks.append(t);
    return t;
  });
  f.stage.append(head, range, ticks);
  f.onPaint(i => {
    readout.textContent = items[i].label;
    range.value = String(i);
    range.setAttribute('aria-valuetext', items[i].label);
    tickButtons.forEach((t, j) => t.setAttribute('aria-pressed', String(i === j)));
  });
  f.paint();
}

/* ── Prediction: commit to a guess, then see why ──────────────────────────── */
function renderPrediction(content, block, saved, onEdit, detail) {
  const {items, prompt} = block;
  const correct = items.findIndex(i => i.value === 1);
  const card = el('div', 'dg-quiz');
  card.append(el('p', 'dg-quiz-question', prompt));
  const options = el('div', 'dg-quiz-options');
  const letters = 'ABCDEF';
  const buttons = items.map((item, i) => {
    const b = button('dg-option', '', () => { if (saved.revealed) return; saved.guess = i; paint(); });
    b.append(el('span', 'dg-letter', letters[i]), el('span', 'dg-label', item.label));
    options.append(b);
    return b;
  });
  const footer = el('div', 'dg-quiz-footer');
  const result = el('p', 'dg-quiz-result');
  result.setAttribute('aria-live', 'polite');
  const check = button('dg-primary', 'Check answer', () => { saved.revealed = true; paint(); });
  const retry = button('dg-secondary', 'Try again', () => { saved.revealed = false; saved.guess = undefined; paint(); buttons[0].focus(); });
  footer.append(result, check, retry);
  card.append(options, footer);
  content.append(card);
  function paint() {
    const guess = Number.isInteger(saved.guess) && items[saved.guess] ? saved.guess : null;
    const shown = !!saved.revealed && guess !== null;
    buttons.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === guess));
      b.classList.toggle('dg-right', shown && i === correct);
      b.classList.toggle('dg-wrong', shown && i === guess && guess !== correct);
      b.disabled = shown && i !== guess && i !== correct;
    });
    check.hidden = shown;
    check.disabled = guess === null;
    retry.hidden = !shown;
    result.textContent = !shown ? (guess === null ? 'Pick the answer you expect.' : '') :
      (guess === correct ? 'Correct. ' : 'Not quite. ') + items[guess === correct ? guess : correct].detail;
    result.classList.toggle('dg-good', shown && guess === correct);
  }
  paint();
}

/* ── Before / after: one version at a time with a segmented switch ───────── */
function renderBeforeAfter(content, block, saved) {
  const {items} = block;
  const seg = el('div', 'dg-segmented');
  seg.setAttribute('role', 'tablist');
  const thumb = el('span', 'dg-seg-thumb');
  seg.append(thumb);
  const tabs = items.map((item, i) => {
    const t = button('dg-seg', i === 0 ? 'Before' : 'After', () => select(i));
    t.setAttribute('role', 'tab');
    seg.append(t);
    return t;
  });
  const card = el('div', 'dg-version');
  card.setAttribute('role', 'tabpanel');
  const title = el('strong', 'dg-version-title');
  const body = el('p', 'dg-version-body');
  card.append(title, body);
  content.append(seg, card);
  seg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select(1 - (saved.selected ?? 0)); tabs[saved.selected].focus(); }
  });
  function select(i) { saved.selected = i; paint(); }
  function paint() {
    const i = clamp(saved.selected ?? 0, 0, 1);
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
    seg.style.setProperty('--i', i);
    card.classList.toggle('dg-after', i === 1);
    title.textContent = items[i].label;
    body.textContent = items[i].detail;
    card.animate?.([{opacity: .4, transform: 'translateY(3px)'}, {opacity: 1, transform: 'none'}], {duration: 220, easing: 'ease-out'});
  }
  paint();
}

/* ── Sorting: place each example in its group and get feedback ────────────── */
function renderSorting(content, block, saved, onEdit, detail) {
  const {items, edges} = block;
  const groups = items.map((item, index) => ({item, index})).filter(g => g.item.value === 1);
  const examples = items.map((item, index) => ({item, index})).filter(g => g.item.value === 0);
  const answer = index => edges.find(e => e.from === index && items[e.to]?.value === 1)?.to;
  saved.sorted ??= {};
  const tray = el('div', 'dg-tray');
  const bins = el('div', 'dg-bins');
  bins.style.setProperty('--n', groups.length);
  const status = el('div', 'dg-sort-status');
  const progress = el('span', 'dg-sort-progress');
  const reset = button('dg-secondary', 'Start over', () => { saved.sorted = {}; saved.picked = undefined; detail.textContent = ''; paint(); });
  status.append(progress, reset);
  detail.classList.add('dg-caption');
  detail.setAttribute('aria-live', 'polite');
  content.append(el('p', 'dg-eyebrow', 'Select an example, then the group it belongs to.'), tray, bins, detail, status);
  const chip = ({item, index}) => {
    const c = button('dg-chip', item.label, () => { saved.picked = saved.picked === index ? undefined : index; paint(); });
    c.draggable = true;
    c.ondragstart = e => { e.dataTransfer.setData('text/plain', String(index)); saved.picked = index; };
    return c;
  };
  const place = (example, group) => {
    if (answer(example) === group) {
      saved.sorted[example] = group;
      detail.textContent = 'Correct. ' + items[example].detail;
      detail.classList.remove('dg-bad');
    } else {
      detail.textContent = `Not quite: ${items[example].label} doesn’t belong in ${items[group].label}. Try another group.`;
      detail.classList.add('dg-bad');
    }
    saved.picked = undefined;
    paint();
  };
  const binEls = groups.map(({item, index}) => {
    const bin = el('div', 'dg-bin');
    const head = button('dg-bin-head', item.label, () => { if (saved.picked !== undefined) place(saved.picked, index); });
    const list = el('div', 'dg-bin-list');
    bin.append(head, list);
    bin.ondragover = e => { e.preventDefault(); bin.classList.add('dg-over'); };
    bin.ondragleave = () => bin.classList.remove('dg-over');
    bin.ondrop = e => { e.preventDefault(); bin.classList.remove('dg-over'); const ex = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(ex)) place(ex, index); };
    bins.append(bin);
    return {bin, head, list, index};
  });
  function paint() {
    tray.replaceChildren(...examples.filter(e => saved.sorted[e.index] === undefined).map(e => {
      const c = chip(e);
      c.setAttribute('aria-pressed', String(saved.picked === e.index));
      return c;
    }));
    binEls.forEach(({bin, head, list, index}) => {
      head.disabled = saved.picked === undefined;
      bin.classList.toggle('dg-ready', saved.picked !== undefined);
      list.replaceChildren(...examples.filter(e => saved.sorted[e.index] === index).map(e => el('span', 'dg-chip dg-placed', '✓ ' + e.item.label)));
    });
    const done = Object.keys(saved.sorted).length;
    progress.textContent = done === examples.length ? `All ${done} sorted.` : `${done} of ${examples.length} sorted`;
    tray.hidden = done === examples.length;
    reset.hidden = done === 0;
  }
  paint();
}

/* ── Function plot: drag along the curve to read values ──────────────────── */
const FUNCTIONS = {
  linear: {label: 'y = x', f: x => x},
  square: {label: 'y = x²', f: x => x * x},
  cube: {label: 'y = x³', f: x => x * x * x},
  absolute: {label: 'y = |x|', f: Math.abs},
  sine: {label: 'y = sin(x)', f: Math.sin}
};
function renderFunctionPlot(content, block, saved, onEdit, detail) {
  const fn = FUNCTIONS[block.prompt];
  const [min, max] = block.items.map(i => i.value);
  const W = 560, H = 300, L = 44, R = 20, T = 20, B = 36;
  const samples = Array.from({length: 241}, (_, i) => min + (max - min) * i / 240);
  const ys = samples.map(fn.f);
  const lo = Math.min(0, ...ys), hi = Math.max(0, ...ys);
  const px = x => L + (W - L - R) * (x - min) / (max - min);
  const py = y => T + (H - T - B) * (1 - (y - lo) / (hi - lo || 1));
  const stage = el('div', 'dg-stage dg-plot');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'slider');
  stage.setAttribute('aria-label', fn.label + '. Use arrow keys to move along the curve.');
  const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, class: 'dg-plot-svg'});
  const grid = svgEl('g', {class: 'dg-grid'});
  for (let k = 0; k <= 4; k++) {
    const y = T + (H - T - B) * k / 4;
    grid.append(svgEl('line', {x1: L, x2: W - R, y1: y, y2: y}));
    const t = svgEl('text', {x: L - 8, y: y + 4, class: 'dg-axis-text', 'text-anchor': 'end'});
    t.textContent = fmt.format(hi - (hi - lo) * k / 4);
    grid.append(t);
  }
  [min, (min + max) / 2, max].forEach(v => {
    const t = svgEl('text', {x: px(v), y: H - 12, class: 'dg-axis-text', 'text-anchor': 'middle'});
    t.textContent = fmt.format(v);
    grid.append(t);
  });
  svg.append(grid);
  if (min <= 0 && max >= 0) svg.append(svgEl('line', {x1: px(0), x2: px(0), y1: T, y2: H - B, class: 'dg-axis'}));
  svg.append(svgEl('line', {x1: L, x2: W - R, y1: py(0), y2: py(0), class: 'dg-axis'}));
  svg.append(svgEl('path', {d: 'M' + samples.map((x, i) => `${px(x).toFixed(1)} ${py(ys[i]).toFixed(1)}`).join(' L'), class: 'dg-curve'}));
  const guideX = svgEl('line', {class: 'dg-guide'}), guideY = svgEl('line', {class: 'dg-guide'});
  const dot = svgEl('circle', {r: 7, class: 'dg-dot-point'});
  svg.append(guideX, guideY, dot);
  stage.append(svg);
  const head = el('div', 'dg-param-head');
  const readout = el('div', 'dg-readout');
  head.append(el('span', 'dg-eyebrow', fn.label), readout);
  content.append(head, stage);
  saved.position ??= 0.5;
  function paint() {
    const x = min + (max - min) * saved.position, y = fn.f(x);
    readout.textContent = `x = ${fmt.format(x)} · y = ${fmt.format(y)}`;
    stage.setAttribute('aria-valuetext', readout.textContent);
    dot.setAttribute('cx', px(x)); dot.setAttribute('cy', py(y));
    guideX.setAttribute('x1', px(x)); guideX.setAttribute('x2', px(x)); guideX.setAttribute('y1', py(y)); guideX.setAttribute('y2', H - B);
    guideY.setAttribute('x1', L); guideY.setAttribute('x2', px(x)); guideY.setAttribute('y1', py(y)); guideY.setAttribute('y2', py(y));
  }
  const move = e => {
    const r = svg.getBoundingClientRect();
    const vx = (e.clientX - r.left) / r.width * W;
    saved.position = clamp((vx - L) / (W - L - R), 0, 1);
    paint();
  };
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); move(e); });
  svg.addEventListener('pointermove', e => { if (svg.hasPointerCapture(e.pointerId)) move(e); });
  stage.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); saved.position = clamp(saved.position + step, 0, 1); paint(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); saved.position = clamp(saved.position - step, 0, 1); paint(); }
  });
  paint();
}

/* ── Evidence: a claim and the sources that support it ───────────────────── */
function renderEvidence(content, block, saved) {
  const {items, edges} = block;
  const claims = [...new Set(edges.map(e => e.from))].filter(i => items[i]);
  const tabs = el('div', 'dg-tabs');
  const quote = el('blockquote', 'dg-claim');
  const sources = el('div', 'dg-sources');
  const tabButtons = claims.map((c, i) => {
    const t = button('dg-tab', items[c].label, () => { saved.selected = i; paint(); });
    tabs.append(t);
    return t;
  });
  if (claims.length > 1) content.append(tabs);
  content.append(quote, sources);
  function paint() {
    const i = clamp(saved.selected ?? 0, 0, claims.length - 1), claim = claims[i];
    tabButtons.forEach((t, j) => t.setAttribute('aria-pressed', String(i === j)));
    quote.replaceChildren(el('span', 'dg-eyebrow', 'Claim'), el('p', '', items[claim].detail || items[claim].label));
    sources.replaceChildren(...edges.filter(e => e.from === claim && items[e.to]).map(e => {
      const card = el('article', 'dg-source');
      card.append(el('span', 'dg-source-tag', e.label), el('strong', '', items[e.to].label), el('p', '', items[e.to].detail));
      return card;
    }));
  }
  paint();
}

/* ── Map: real coastlines, framed around the places that matter ───────────── */
function renderMap(content, block, saved, onEdit, detail) {
  const {items} = block;
  const xs = items.map(i => i.longitude + 180), ys = items.map(i => 90 - i.latitude);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // Pad, enforce a minimum span, then match a 16:9 frame so places never sit on the edge.
  let w = Math.max((x1 - x0) * 1.8, 16), h = Math.max((y1 - y0) * 1.9, 9);
  if (w / h > 16 / 9) h = w * 9 / 16; else w = h * 16 / 9;
  w = Math.min(w, 360); h = Math.min(h, 180);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const vx = clamp(cx - w / 2, 0, 360 - w), vy = clamp(cy - h / 2, 0, 180 - h);
  const f = frame(content, detail, block, saved, onEdit);
  f.stage.classList.add('dg-map', 'dg-canvas');
  f.stage.style.aspectRatio = `${w} / ${h}`;
  const svg = svgEl('svg', {viewBox: `${vx} ${vy} ${w} ${h}`, 'aria-hidden': 'true', class: 'dg-svg', preserveAspectRatio: 'xMidYMid slice'});
  const land = svgEl('path', {class: 'dg-land'});
  paintLand(land);
  svg.append(svgEl('rect', {x: 0, y: 0, width: 360, height: 180, class: 'dg-sea'}), land);
  f.stage.append(svg);
  const pins = items.map((item, i) => {
    const b = button('dg-node dg-pin', '', () => f.select(i));
    b.append(el('span', 'dg-pin-dot'), el('span', 'dg-label', item.label));
    b.style.left = pct(xs[i] - vx, w);
    b.style.top = pct(ys[i] - vy, h);
    f.stage.append(b);
    return b;
  });
  f.onPaint(i => pins.forEach((p, j) => p.setAttribute('aria-pressed', String(i === j))));
  f.paint();
}

/* ── Linked scenarios: one shared input, two outcomes side by side ───────── */
function renderScenarios(content, block, saved) {
  const {items, prompt} = block;
  const head = el('div', 'dg-param-head');
  const readout = el('div', 'dg-readout');
  head.append(el('span', 'dg-eyebrow', prompt), readout);
  const range = el('input', 'dg-range');
  range.type = 'range';
  range.min = '0';
  range.max = String(items.length - 1);
  range.setAttribute('aria-label', prompt);
  range.oninput = () => { saved.selected = Number(range.value); paint(); };
  const lanes = el('div', 'dg-lanes');
  const laneEls = [0, 1].map(() => {
    const lane = el('div', 'dg-lane');
    const name = el('span', 'dg-lane-name'), text = el('p', 'dg-lane-text');
    lane.append(name, text);
    lanes.append(lane);
    return {name, text, lane};
  });
  content.append(head, range, lanes);
  function paint() {
    const i = clamp(saved.selected ?? 0, 0, items.length - 1);
    range.value = String(i);
    readout.textContent = items[i].label;
    range.setAttribute('aria-valuetext', items[i].label);
    parts(items[i].detail).forEach((part, k) => {
      const colon = part.indexOf(':');
      laneEls[k].name.textContent = colon > 0 ? part.slice(0, colon) : (k ? 'Scenario B' : 'Scenario A');
      laneEls[k].text.textContent = colon > 0 ? part.slice(colon + 1).trim() : part;
      laneEls[k].lane.animate?.([{opacity: .5}, {opacity: 1}], {duration: 200});
    });
  }
  paint();
}

/* ── Worked example: reveal one step at a time, then try it yourself ─────── */
function renderWorkedExample(content, block, saved, onEdit, detail, ctx) {
  const {items, prompt} = block;
  const list = el('ol', 'dg-steps');
  const next = button('dg-primary', 'Show next step', () => { saved.revealed = (saved.revealed ?? 1) + 1; paint(); list.lastElementChild?.scrollIntoView?.({block: 'nearest', behavior: 'smooth'}); });
  const rows = items.map((item, i) => {
    const li = el('li', 'dg-step-row');
    li.append(el('span', 'dg-dot', String(i + 1)));
    const body = el('div');
    body.append(el('strong', '', item.label), el('p', '', item.detail));
    li.append(body);
    list.append(li);
    return li;
  });
  if (prompt) content.append(el('p', 'dg-quiz-question dg-problem', prompt));
  content.append(list, next);
  const practice = el('div');
  content.append(practice);
  let practiceShown = false;
  function paint() {
    const shown = clamp(saved.revealed ?? 1, 1, items.length);
    rows.forEach((r, i) => { r.hidden = i >= shown; r.classList.toggle('dg-current', i === shown - 1); });
    next.hidden = shown >= items.length;
    next.textContent = `Show step ${shown + 1} of ${items.length}`;
    if (shown >= items.length && !practiceShown) { practiceShown = true; practiceField(practice, block, saved, onEdit, ctx, 'Now try a similar problem, or explain the method in your own words…'); }
  }
  paint();
}

/* ── Practice: a prompt, hints on request, and feedback ───────────────────── */
function renderPractice(content, block, saved, onEdit, detail, ctx) {
  const {items, prompt} = block;
  const card = el('div', 'dg-practice-card');
  card.append(el('span', 'dg-eyebrow', 'Your turn'), el('p', 'dg-quiz-question', prompt || block.title));
  const hints = el('ul', 'dg-hints');
  const more = button('dg-secondary', '', () => { saved.hints = (saved.hints ?? 0) + 1; paint(); });
  card.append(hints, more);
  content.append(card);
  practiceField(content, block, saved, onEdit, ctx, 'Write your explanation…');
  function paint() {
    const n = clamp(saved.hints ?? 0, 0, items.length);
    hints.replaceChildren(...items.slice(0, n).map(i => {
      const li = el('li');
      li.append(el('strong', '', i.label + ' '), document.createTextNode(i.detail));
      return li;
    }));
    more.hidden = n >= items.length;
    more.textContent = n ? `Another hint (${n + 1} of ${items.length})` : 'Show a hint';
  }
  paint();
}

/* ── New: proportion – parts of a whole ───────────────────────────────────── */
const share = p => (p >= 10 ? Math.round(p) : p >= 1 ? p.toFixed(1) : p >= 0.1 ? p.toFixed(1) : p.toFixed(2)) + '%';
// Parts of one whole in the visual accent (blue), darkest first, then two neutral greys.
const RAMP = ['#2f5d8a', '#5b82ab', '#8fadcc', '#c3d4e6', '#8e8e93', '#c7c7cc'];
function renderProportion(content, block, saved, onEdit, detail) {
  const {items} = block;
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const f = frame(content, detail, block, saved, onEdit);
  f.stage.classList.add('dg-proportion');
  const bar = el('div', 'dg-stack');
  const legend = el('div', 'dg-legend');
  const segs = items.map((item, i) => {
    const s = button('dg-seg-part', '', () => f.select(i));
    s.style.flexGrow = String(item.value);
    s.style.background = RAMP[i % RAMP.length];
    s.setAttribute('aria-label', `${item.label}: ${share(item.value / total * 100)}`);
    bar.append(s);
    const row = button('dg-node dg-legend-row', '', () => f.select(i));
    const sw = el('span', 'dg-swatch');
    sw.style.background = RAMP[i % RAMP.length];
    row.append(sw, el('span', 'dg-label', item.label), el('span', 'dg-bar-value', share(item.value / total * 100)));
    legend.append(row);
    return {s, row};
  });
  f.stage.append(bar, legend);
  f.onPaint(i => segs.forEach(({s, row}, j) => {
    s.classList.toggle('dg-on', i === j);
    row.setAttribute('aria-pressed', String(i === j));
  }));
  f.paint();
}

/* ── New: 2×2 matrix – four quadrants on two dimensions ───────────────────── */
function renderMatrix(content, block, saved, onEdit, detail) {
  const {items, prompt} = block;
  const [xAxis, yAxis] = parts(prompt);
  const f = frame(content, detail, block, saved, onEdit);
  f.stage.classList.add('dg-matrix');
  const grid = el('div', 'dg-quadrants');
  const cells = items.map((item, i) => {
    const c = button('dg-node dg-quadrant', '', () => f.select(i));
    c.append(el('span', 'dg-label', item.label));
    grid.append(c);
    return c;
  });
  const y = el('span', 'dg-axis-label dg-axis-y', yAxis + ' ↑');
  const x = el('span', 'dg-axis-label dg-axis-x', xAxis + ' →');
  f.stage.append(y, grid, x);
  f.onPaint(i => cells.forEach((c, j) => c.setAttribute('aria-pressed', String(i === j))));
  f.paint();
}

/* ── New: checklist – work through steps and track progress ───────────────── */
function renderChecklist(content, block, saved, onEdit, detail) {
  const {items} = block;
  saved.done ??= {};
  const f = frame(content, detail, block, saved, onEdit, {stepper: false});
  f.stage.classList.add('dg-checklist');
  const progress = el('div', 'dg-progress-row');
  const bar = el('div', 'dg-meter');
  const fill = el('div', 'dg-meter-fill');
  bar.append(fill);
  const count = el('span', 'dg-index');
  progress.append(bar, count);
  const rows = items.map((item, i) => {
    const row = el('div', 'dg-check-row');
    const box = button('dg-check', '', () => { saved.done[i] = !saved.done[i]; f.select(i); });
    box.setAttribute('aria-label', 'Done: ' + item.label);
    const label = button('dg-node dg-check-label', item.label, () => f.select(i));
    row.append(box, label);
    f.stage.append(row);
    return {row, box, label};
  });
  f.stage.prepend(progress);
  f.onPaint(i => {
    const done = items.filter((_, j) => saved.done[j]).length;
    rows.forEach(({row, box, label}, j) => {
      box.setAttribute('aria-pressed', String(!!saved.done[j]));
      row.classList.toggle('dg-done', !!saved.done[j]);
      label.setAttribute('aria-pressed', String(i === j));
    });
    fill.style.width = (done / items.length * 100) + '%';
    count.textContent = `${done} of ${items.length} done`;
  });
  f.paint();
}

/* ── New: flashcards – recall, then flip to check ─────────────────────────── */
function renderFlashcards(content, block, saved) {
  const {items} = block;
  const card = button('dg-flashcard', '', () => { saved.flipped = !saved.flipped; paint(); });
  const inner = el('span', 'dg-flash-inner');
  const front = el('span', 'dg-flash-face dg-flash-front');
  const back = el('span', 'dg-flash-face dg-flash-back');
  inner.append(front, back);
  card.append(inner);
  const footer = el('div', 'dg-footer');
  const hint = el('span', 'dg-caption', 'Recall the answer, then flip the card.');
  const current = () => clamp(saved.selected ?? 0, 0, items.length - 1);
  const step = miniStepper(items.length, current, i => { saved.selected = (i + items.length) % items.length; saved.flipped = false; paint(); });
  footer.append(hint, step.nav);
  content.append(card, footer);
  function paint() {
    const i = current();
    front.replaceChildren(el('span', 'dg-eyebrow', 'Question'), el('strong', '', items[i].label));
    back.replaceChildren(el('span', 'dg-eyebrow', 'Answer'), el('span', '', items[i].detail));
    card.classList.toggle('dg-flipped', !!saved.flipped);
    card.setAttribute('aria-label', saved.flipped ? 'Answer: ' + items[i].detail + '. Select to flip back.' : 'Question: ' + items[i].label + '. Select to reveal the answer.');
    step.paint();
  }
  paint();
}

/* ── New: spectrum – where each item sits on a scale ──────────────────────── */
function renderSpectrum(content, block, saved, onEdit, detail) {
  const {prompt} = block;
  const [low, high] = parts(prompt);
  const order = block.items.map((item, i) => i).sort((a, b) => block.items[a].value - block.items[b].value);
  const f = frame(content, detail, {...block, items: order.map(i => block.items[i])}, saved, onEdit);
  f.stage.classList.add('dg-spectrum');
  const track = el('div', 'dg-spectrum-track');
  const marks = order.map((orig, k) => {
    const item = block.items[orig];
    const m = button('dg-node dg-mark', '', () => f.select(k));
    m.append(el('span', 'dg-mark-dot'), el('span', 'dg-label', item.label));
    m.style.left = clamp(item.value, 0, 100) + '%';
    track.append(m);
    return m;
  });
  const ends = el('div', 'dg-spectrum-ends');
  ends.append(el('span', '', low), el('span', '', high));
  f.stage.append(track, ends);
  // Labels never overlap: each goes in the first free row (above the track, then below, then a
  // second row further out on each side, joined to its dot by a thin stem).
  const place = () => {
    const width = track.clientWidth;
    if (!width) return;
    const rows = [-Infinity, -Infinity, -Infinity, -Infinity];
    let lift = 0;
    const tiers = marks.map(m => {
      const label = m.querySelector('.dg-label'), half = label.offsetWidth / 2;
      // A label near either end shifts inward to stay over the scale; its dot stays where it is.
      const dot = parseFloat(m.style.left) / 100 * width, x = Math.min(Math.max(dot, half - 8), width + 8 - half);
      label.style.setProperty('--shift', (x - dot) + 'px');
      lift = Math.max(lift, label.offsetHeight + 6);
      const free = rows.findIndex(end => x - half >= end + 6);
      const tier = free >= 0 ? free : rows.indexOf(Math.min(...rows));
      rows[tier] = x + half;
      return tier;
    });
    marks.forEach((m, k) => {
      m.classList.toggle('dg-below', tiers[k] % 2 === 1);
      m.querySelector('.dg-label').style.setProperty('--lift', (tiers[k] > 1 ? lift : 0) + 'px');
    });
    // Room only where labels are: no empty band below the scale when every label fits above it.
    track.style.marginBottom = (tiers.includes(1) ? 44 : 16) + (tiers.includes(3) ? lift : 0) + 'px';
    track.style.marginTop = 40 + (tiers.includes(2) ? lift : 0) + 'px';
  };
  let width = 0;
  new ResizeObserver(() => { if (track.clientWidth !== width) { width = track.clientWidth; place(); } }).observe(track);
  f.onPaint(i => marks.forEach((m, j) => m.setAttribute('aria-pressed', String(i === j))));
  f.paint();
}

/* ── New: key numbers – a few figures that tell the story ─────────────────── */
function renderStats(content, block, saved, onEdit, detail) {
  const {items, prompt} = block;
  const f = frame(content, detail, block, saved, onEdit, {stepper: false});
  f.stage.classList.add('dg-stats');
  f.stage.style.setProperty('--n', Math.min(items.length, 4));
  const tiles = items.map((item, i) => {
    const t = button('dg-node dg-stat', '', () => f.select(i));
    t.append(el('span', 'dg-stat-value', fmt.format(item.value) + (prompt ? ' ' + prompt : '')), el('span', 'dg-stat-label', item.label));
    f.stage.append(t);
    return t;
  });
  f.onPaint(i => tiles.forEach((t, j) => t.setAttribute('aria-pressed', String(i === j))));
  f.paint();
}

export const INTERACTIVES = {
  parameter_explorer: renderParameter,
  prediction: renderPrediction,
  before_after: renderBeforeAfter,
  sorting: renderSorting,
  function_plot: renderFunctionPlot,
  evidence: renderEvidence,
  map: renderMap,
  linked_scenarios: renderScenarios,
  worked_example: renderWorkedExample,
  practice: renderPractice,
  proportion: renderProportion,
  matrix: renderMatrix,
  checklist: renderChecklist,
  flashcards: renderFlashcards,
  spectrum: renderSpectrum,
  key_numbers: renderStats
};
