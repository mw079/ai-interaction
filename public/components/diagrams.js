// Prebuilt diagram components. The model supplies validated content (items, edges, prompt);
// these renderers own geometry, interaction and visual quality.
//
// Shared anatomy, modelled on the Kepler slide:
//   stage   – the visual itself; one item is in focus, the rest stay as quiet context
//   caption – one line of explanation for the focused item (the existing `detail` element)
//   stepper – "2 / 5" with previous/next, plus ←/→ on the stage
import {SVG, el, svgEl, pct, arrowMarker, nextMarkerId, frame, nodeButton, canvas} from './kit.js';
import {INTERACTIVES} from './interactives.js';

/* ── Cycle: steps on a ring, the loop is the point ─────────────────────────── */
function renderCycle(content, block, saved, onEdit, detail) {
  const {items} = block;
  const n = items.length;
  const W = 600, H = 380, cx = 300, cy = 190, rx = 180, ry = 135;
  const f = frame(content, detail, block, saved, onEdit);
  const svg = canvas(f.stage, W, H, 'dg-cycle');
  const id = nextMarkerId();
  arrowMarker(svg, id);
  const angle = i => -Math.PI / 2 + i * 2 * Math.PI / n;
  const at = a => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  svg.append(svgEl('ellipse', {cx, cy, rx, ry, class: 'dg-track'}));
  const gap = Math.min(0.42, Math.PI / n * 0.62);
  const arcs = items.map((_, i) => {
    const a0 = angle(i) + gap, a1 = angle(i + 1) - gap;
    const pts = Array.from({length: 25}, (_, k) => at(a0 + (a1 - a0) * k / 24));
    const path = svgEl('path', {d: 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L'), class: 'dg-arc', 'marker-end': `url(#${id})`});
    svg.append(path);
    return path;
  });
  const hub = el('div', 'dg-hub');
  const hubNum = el('span', 'dg-hub-num');
  hub.append(el('span', 'dg-hub-icon', '↻'), hubNum);
  hub.style.left = pct(cx, W);
  hub.style.top = pct(cy, H);
  f.stage.append(hub);
  const nodes = items.map((item, i) => {
    const [x, y] = at(angle(i));
    const b = nodeButton(item.label, x, y, W, H, () => f.select(i), i + 1);
    f.stage.append(b);
    return b;
  });
  f.onPaint(i => {
    nodes.forEach((b, j) => { b.setAttribute('aria-pressed', String(i === j)); });
    arcs.forEach((a, j) => {
      const on = j === i;
      a.classList.toggle('dg-on', on);
      a.setAttribute('marker-end', `url(#${id}${on ? '-on' : ''})`);
    });
    hubNum.textContent = `Step ${i + 1} of ${n}`;
  });
  f.paint();
}

/* ── Process: a one-way sequence on a track with progress ──────────────────── */
function renderProcess(content, block, saved, onEdit, detail) {
  const {items} = block;
  const f = frame(content, detail, block, saved, onEdit);
  f.stage.classList.add('dg-process');
  const track = el('ol', 'dg-track-list');
  // The track line and progress are positioned from the step count, so the stage needs it too.
  f.stage.style.setProperty('--n', items.length);
  track.style.setProperty('--n', items.length);
  const fill = el('div', 'dg-progress');
  const nodes = items.map((item, i) => {
    const li = el('li');
    const b = el('button', 'dg-node dg-stop');
    b.type = 'button';
    b.append(el('span', 'dg-dot', String(i + 1)), el('span', 'dg-label', item.label));
    b.onclick = () => f.select(i);
    li.append(b);
    track.append(li);
    return b;
  });
  f.stage.append(fill, track);
  // Stack vertically when a step would get less than ~90 px: labels must never overlap.
  const fit = () => f.stage.classList.toggle('dg-vertical', f.stage.clientWidth > 0 && f.stage.clientWidth / items.length < 90);
  new ResizeObserver(fit).observe(f.stage);
  fit();
  f.onPaint(i => {
    nodes.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(i === j));
      b.classList.toggle('dg-past', j < i);
    });
    f.stage.style.setProperty('--p', items.length > 1 ? i / (items.length - 1) : 0);
  });
  f.paint();
}

/* ── Comparison: alternatives side by side ─────────────────────────────────── */
function renderComparison(content, block, saved, onEdit, detail) {
  const {items} = block;
  // Four or more items are criteria rather than alternatives: list them and show one at a time.
  if (items.length > 3) return renderCriteria(content, block, saved, onEdit, detail);
  const grid = el('div', 'dg-compare');
  grid.style.setProperty('--n', Math.min(items.length, 3));
  const cards = items.map((item, i) => {
    const card = el('button', 'dg-card');
    card.type = 'button';
    card.append(el('span', 'dg-card-label', item.label), el('span', 'dg-card-detail', item.detail));
    card.onclick = () => { saved.selected = i; paint(); };
    grid.append(card);
    return card;
  });
  content.append(grid);
  function paint() {
    const i = Math.max(0, Math.min(saved.selected ?? 0, items.length - 1));
    cards.forEach((c, j) => c.setAttribute('aria-pressed', String(i === j)));
  }
  paint();
}

function renderCriteria(content, block, saved, onEdit, detail) {
  const {items} = block;
  const f = frame(content, detail, block, saved, onEdit);
  f.stage.classList.add('dg-criteria');
  const list = el('div', 'dg-criteria-list');
  const rows = items.map((item, i) => {
    const b = el('button', 'dg-node dg-criterion');
    b.type = 'button';
    b.append(el('span', 'dg-num', String(i + 1)), el('span', 'dg-label', item.label));
    b.onclick = () => f.select(i);
    list.append(b);
    return b;
  });
  f.stage.append(list);
  f.onPaint(i => rows.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j))));
  f.paint();
}

/* ── Chart: labelled horizontal bars, readable at any width ────────────────── */
function renderChart(content, block, saved, onEdit, detail) {
  const {items} = block;
  const f = frame(content, detail, block, saved, onEdit);
  f.stage.classList.add('dg-chart');
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1e-9);
  const signed = items.some(i => i.value < 0);
  const fmt = new Intl.NumberFormat(undefined, {maximumFractionDigits: 2});
  const rows = items.map((item, i) => {
    const row = el('button', 'dg-node dg-bar-row');
    row.type = 'button';
    const bar = el('span', 'dg-bar-track' + (signed ? ' dg-signed' : ''));
    const fillEl = el('span', 'dg-bar');
    const share = Math.abs(item.value) / max * (signed ? 50 : 100);
    fillEl.style.width = share + '%';
    if (signed) fillEl.style[item.value < 0 ? 'right' : 'left'] = '50%';
    bar.append(fillEl);
    row.append(el('span', 'dg-bar-label', item.label), bar, el('span', 'dg-bar-value', fmt.format(item.value)));
    row.onclick = () => f.select(i);
    f.stage.append(row);
    return row;
  });
  f.onPaint(i => rows.forEach((r, j) => r.setAttribute('aria-pressed', String(i === j))));
  f.paint();
}

/* ── Tree: hierarchy or decision tree rooted at item 0 ─────────────────────── */
function treeLayout(items, edges) {
  const children = items.map(() => []);
  const parent = items.map(() => -1);
  const edgeLabel = new Map();
  edges.forEach(({from, to, label}) => {
    if (from === to || parent[to] !== -1 || to === 0 || !items[from] || !items[to]) return;
    parent[to] = from;
    children[from].push(to);
    edgeLabel.set(to, label);
  });
  // Unattached items hang from the root so nothing silently disappears.
  items.forEach((_, i) => { if (i && parent[i] === -1) { parent[i] = 0; children[0].push(i); } });
  const depth = items.map(() => 0);
  const x = items.map(() => 0);
  let leaf = 0;
  (function place(i, d, seen) {
    depth[i] = d;
    seen.add(i);
    const kids = children[i].filter(k => !seen.has(k));
    if (!kids.length) { x[i] = leaf++; return; }
    kids.forEach(k => place(k, d + 1, seen));
    x[i] = (x[kids[0]] + x[kids.at(-1)]) / 2;
  })(0, 0, new Set());
  return {children, parent, depth, x, leaves: Math.max(leaf, 1), levels: Math.max(...depth) + 1, edgeLabel};
}

function renderTree(content, block, saved, onEdit, detail) {
  const {items, edges} = block;
  const t = treeLayout(items, edges);
  const W = 600, rowH = 118, H = Math.max(2, t.levels) * rowH;
  const f = frame(content, detail, block, saved, onEdit);
  const svg = canvas(f.stage, W, H, 'dg-tree');
  const px = i => W * (t.x[i] + 0.5) / t.leaves;
  const py = i => rowH * (t.depth[i] + 0.5);
  const links = new Map();
  items.forEach((_, i) => {
    const p = t.parent[i];
    if (p < 0) return;
    const [x0, y0, x1, y1] = [px(p), py(p) + 22, px(i), py(i) - 22];
    const my = (y0 + y1) / 2;
    const path = svgEl('path', {d: `M${x0} ${y0} C${x0} ${my} ${x1} ${my} ${x1} ${y1}`, class: 'dg-link'});
    svg.append(path);
    let text;
    const label = t.edgeLabel.get(i);
    if (label) {
      text = svgEl('text', {x: (x0 + x1) / 2, y: my + 4, class: 'dg-edge-label'});
      text.textContent = label;
      svg.append(text);
    }
    links.set(i, {path, text});
  });
  const nodes = items.map((item, i) => {
    const b = nodeButton(item.label, px(i), py(i), W, H, () => f.select(i));
    if (i === 0) b.classList.add('dg-root');
    f.stage.append(b);
    return b;
  });
  f.onPaint(i => {
    const onPath = new Set();
    for (let k = i; k > 0 && t.parent[k] >= 0 && !onPath.has(k); k = t.parent[k]) onPath.add(k);
    nodes.forEach((b, j) => {
      b.setAttribute('aria-pressed', String(i === j));
      b.classList.toggle('dg-trail', j !== i && (j === 0 || [...onPath].some(k => t.parent[k] === j)));
    });
    links.forEach(({path, text}, k) => {
      path.classList.toggle('dg-on', onPath.has(k));
      text?.classList.toggle('dg-on', onPath.has(k));
    });
  });
  f.paint();
}

/* ── Concept map: relationships, revealed one node at a time ───────────────── */
function renderConceptMap(content, block, saved, onEdit, detail) {
  const {items, edges} = block;
  const n = items.length;
  const W = 600, H = 380, cx = 300, cy = 190, rx = 240, ry = 150;
  const f = frame(content, detail, block, saved, onEdit);
  const svg = canvas(f.stage, W, H, 'dg-map-graph');
  const id = nextMarkerId();
  arrowMarker(svg, id);
  // Focus layout: the selected idea sits in the centre and its relationships radiate
  // out as labelled spokes, so lines never cross. Other ideas wait quietly on the ring.
  const valid = edges.filter(e => items[e.from] && items[e.to] && e.from !== e.to);
  const layer = svgEl('g');
  svg.append(layer);
  // Distance from a pill-shaped node's centre to its outline in direction (dx, dy).
  const reach = (dx, dy) => {
    const a = 60, b = 22, len = Math.hypot(dx, dy) || 1, c = dx / len, s = dy / len;
    return a * b / Math.hypot(b * c, a * s);
  };
  const nodes = items.map((item, i) => {
    const b = nodeButton(item.label, cx, cy, W, H, () => f.select(i));
    b.classList.add('dg-moving');
    f.stage.append(b);
    return b;
  });
  f.onPaint(i => {
    const others = items.map((_, j) => j).filter(j => j !== i);
    const pos = new Map([[i, [cx, cy]]]);
    others.forEach((j, k) => {
      const a = -Math.PI / 2 + k * 2 * Math.PI / others.length;
      pos.set(j, [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    });
    const near = new Set([i]);
    layer.replaceChildren();
    valid.filter(e => e.from === i || e.to === i).forEach(e => {
      near.add(e.from);
      near.add(e.to);
      const [x0, y0] = pos.get(e.from), [x1, y1] = pos.get(e.to);
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const r0 = reach(dx, dy) + 6, r1 = reach(dx, dy) + 10;
      const sx = x0 + dx / len * r0, sy = y0 + dy / len * r0, ex = x1 - dx / len * r1, ey = y1 - dy / len * r1;
      layer.append(svgEl('path', {d: `M${sx} ${sy} L${ex} ${ey}`, class: 'dg-link dg-on', 'marker-end': `url(#${id}-on)`}));
      if (e.label) {
        const text = svgEl('text', {x: (sx + ex) / 2, y: (sy + ey) / 2 + 5, class: 'dg-edge-label dg-on'});
        text.textContent = e.label;
        layer.append(text);
      }
    });
    nodes.forEach((b, j) => {
      const [x, y] = pos.get(j);
      b.style.left = pct(x, W);
      b.style.top = pct(y, H);
      b.setAttribute('aria-pressed', String(i === j));
      b.classList.toggle('dg-dim', !near.has(j));
    });
  });
  f.paint();
}

const RENDERERS = {
  cycle: renderCycle,
  timeline: renderProcess,
  comparison: renderComparison,
  chart: renderChart,
  hierarchy: renderTree,
  decision_tree: renderTree,
  graph: renderConceptMap,
  hotspot_diagram: renderConceptMap,
  ...INTERACTIVES
};

export function renderDiagram(content, block, saved, onEdit, detail, ctx = {}) {
  const render = RENDERERS[block.type];
  if (!render || !Array.isArray(block.items) || !block.items.length) return false;
  render(content, block, saved, onEdit, detail, ctx);
  return true;
}
