// Shared building blocks for prebuilt components (public/diagrams.js, public/interactives.js).
export const SVG = 'http://www.w3.org/2000/svg';
import {element} from '../shared/dom.js';
export const el = element;
export const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};
export const pct = (value, total) => (value / total * 100).toFixed(3) + '%';

export function arrowMarker(svg, id) {
  const defs = svgEl('defs');
  for (const [suffix, cls] of [['', 'dg-arrow'], ['-on', 'dg-arrow dg-arrow-on']]) {
    const marker = svgEl('marker', {id: id + suffix, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'});
    marker.append(svgEl('path', {d: 'M1 1 L9 5 L1 9', class: cls}));
    defs.append(marker);
  }
  svg.append(defs);
}

let markerCount = 0;
export const nextMarkerId = () => 'dg-m' + (++markerCount);

// A focusable stage with keyboard stepping and a caption/stepper footer.
export function frame(content, detail, block, saved, onEdit, {stepper = true} = {}) {
  const count = block.items.length;
  const stage = el('div', 'dg-stage');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', block.title + '. Use left and right arrow keys to step through.');
  const footer = el('div', 'dg-footer');
  const index = el('span', 'dg-index');
  const prev = el('button', 'dg-step', '‹');
  const next = el('button', 'dg-step', '›');
  prev.type = next.type = 'button';
  prev.setAttribute('aria-label', 'Previous');
  next.setAttribute('aria-label', 'Next');
  const nav = el('div', 'dg-nav');
  nav.append(index, prev, next);
  detail.classList.add('dg-caption');
  footer.append(detail);
  if (stepper && count > 1) footer.append(nav);
  content.append(stage, footer);
  const painters = [];
  const current = () => Math.max(0, Math.min(saved.selected ?? 0, count - 1));
  // Choosing what to look at is view state, not a page edit: it is saved with the page
  // but does not bump the page version, so pending follow-ups and explanations stay valid.
  const select = i => {
    saved.selected = (i + count) % count;
    paint();
  };
  function paint() {
    const i = current();
    index.textContent = `${i + 1} / ${count}`;
    detail.textContent = block.items[i].detail;
    painters.forEach(p => p(i));
  }
  prev.onclick = () => select(current() - 1);
  next.onclick = () => select(current() + 1);
  stage.addEventListener('keydown', event => {
    if (event.target !== stage && !event.target.classList?.contains('dg-node')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); select(current() + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); select(current() - 1); }
  });
  return {stage, select, current, onPaint: fn => painters.push(fn), paint};
}

// Absolutely positioned HTML node over an SVG layer, so labels wrap and stay accessible.
export function nodeButton(label, x, y, w, h, onClick, number) {
  const b = el('button', 'dg-node');
  b.type = 'button';
  if (number !== undefined) b.append(el('span', 'dg-num', String(number)));
  b.append(el('span', 'dg-label', label));
  b.style.left = pct(x, w);
  b.style.top = pct(y, h);
  b.onclick = onClick;
  return b;
}

export function canvas(stage, w, h, cls) {
  stage.classList.add(cls, 'dg-canvas');
  stage.style.aspectRatio = `${w} / ${h}`;
  const svg = svgEl('svg', {viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true', class: 'dg-svg'});
  stage.append(svg);
  return svg;
}
