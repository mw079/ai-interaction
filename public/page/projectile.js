// The trusted projectile simulator, placed in the Atlas visual column.
//
// The plot uses one fixed scale, equal on both axes, sized so the largest possible throw at the
// current gravity fits. A faster launch is therefore visibly longer and a steeper one visibly
// taller and shorter. (An earlier version stretched every curve to fill the box, so the shape
// never changed.) On the Moon or Mars, a faint Earth curve with the same launch is the reference.
import {element as node} from '../shared/dom.js';
import {trajectory} from '../shared/model.js';

const SVG = 'http://www.w3.org/2000/svg';
const PLOT = {left: 44, right: 524, top: 18, bottom: 196};
const SPEED = {min: 5, max: 30};
const ANGLE = {min: 10, max: 80};
const EARTH = 9.81;
const GRAVITIES = [['9.81', 'Earth · 9.81 m/s²'], ['1.62', 'Moon · 1.62 m/s²'], ['3.71', 'Mars · 3.71 m/s²']];

// Metres per pixel for a gravity: the widest (45°) and tallest (ANGLE.max) throws at top speed fit.
function plotScale(gravity) {
  const widest = SPEED.max ** 2 / gravity;
  const tallest = (SPEED.max * Math.sin(ANGLE.max * Math.PI / 180)) ** 2 / (2 * gravity);
  const pixels = Math.min((PLOT.right - PLOT.left) / widest, (PLOT.bottom - PLOT.top) / tallest);
  return {pixels, widest, tallest};
}

// A round grid step (1, 2 or 5 × 10ⁿ metres) giving about five lines across the plot.
function gridStep(extent) {
  const raw = extent / 5, power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * power).find(step => step >= raw);
}

const format = metres => metres >= 100 || Number.isInteger(metres) ? String(Math.round(metres)) : metres.toFixed(1);

export function renderProjectile(p) {
  const sim = node('div', 'physics-simulation');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 540 230');
  svg.setAttribute('role', 'img');
  svg.classList.add('trajectory');
  const readings = node('div', 'physics-readings');
  readings.setAttribute('aria-live', 'polite');
  sim.append(svg, readings);

  const add = (tag, attrs, text) => {
    const n = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
    if (text) n.textContent = text;
    svg.append(n);
    return n;
  };

  function draw() {
    const {speed, angle, gravity} = p.physics;
    const r = trajectory(speed, angle, gravity);
    const {pixels, widest, tallest} = plotScale(gravity);
    const sx = x => PLOT.left + x * pixels;
    const sy = y => PLOT.bottom - y * pixels;
    const path = points => points.map((pt, i) => `${i ? 'L' : 'M'}${sx(pt.x).toFixed(2)},${sy(pt.y).toFixed(2)}`).join(' ');
    svg.replaceChildren();

    // Grid in metres, on the same scale as the curve.
    const step = gridStep(widest);
    for (let m = step; m <= widest * 1.001; m += step) {
      add('line', {x1: sx(m), x2: sx(m), y1: PLOT.top, y2: PLOT.bottom, class: 'plot-grid'});
      add('text', {x: sx(m), y: PLOT.bottom + 16, class: 'plot-label plot-tick'}, `${format(m)} m`);
    }
    for (let m = step; m <= tallest * 1.001; m += step) {
      add('line', {x1: PLOT.left, x2: PLOT.right, y1: sy(m), y2: sy(m), class: 'plot-grid'});
      add('text', {x: PLOT.left - 6, y: sy(m) + 4, class: 'plot-label plot-tick plot-tick-y'}, format(m));
    }
    add('line', {x1: PLOT.left, y1: PLOT.bottom, x2: PLOT.right, y2: PLOT.bottom, class: 'plot-axis'});
    add('line', {x1: PLOT.left, y1: PLOT.top, x2: PLOT.left, y2: PLOT.bottom, class: 'plot-axis'});
    add('text', {x: PLOT.left - 6, y: PLOT.bottom + 16, class: 'plot-label plot-tick plot-tick-y'}, '0');

    // Earth reference when another gravity is selected.
    if (Math.abs(gravity - EARTH) > 0.01) {
      const earth = trajectory(speed, angle, EARTH);
      add('path', {d: path(earth.points), class: 'plot-ghost'});
      add('text', {x: sx(earth.range) + 4, y: PLOT.bottom - 6, class: 'plot-label plot-ghost-label'}, 'Earth');
    }

    add('path', {d: path(r.points), fill: 'none', class: 'plot-path', 'data-range': r.range.toFixed(2), 'data-height': r.height.toFixed(2)});
    add('circle', {cx: sx(r.range / 2), cy: sy(r.height), r: 5, class: 'plot-point'});
    add('text', {x: sx(r.range / 2), y: sy(r.height) - 10, class: 'plot-label plot-apex'}, `${format(r.height)} m peak`);
    add('circle', {cx: sx(r.range), cy: PLOT.bottom, r: 3.5, class: 'plot-landing'});
    svg.setAttribute('aria-label', `Ideal projectile trajectory: ${format(r.height)} m peak, ${format(r.range)} m range, ${r.duration.toFixed(2)} s in flight`);
    readings.textContent = `${r.duration.toFixed(2)} s in flight · ${format(r.range)} m horizontal distance · ${format(r.height)} m peak`;
  }

  const controls = node('div', 'simulation-controls');
  [['speed', 'Launch speed', SPEED, ' m/s'], ['angle', 'Launch angle', ANGLE, '°']].forEach(([key, title, limits, unit]) => {
    const label = node('label');
    const top = node('span', 'control-label');
    const out = node('output', '', `${p.physics[key]}${unit}`);
    top.append(node('span', '', title), out);
    const range = node('input');
    range.type = 'range';
    range.min = limits.min;
    range.max = limits.max;
    range.value = p.physics[key];
    range.setAttribute('aria-label', title);
    range.oninput = () => { p.physics[key] = Number(range.value); out.textContent = `${range.value}${unit}`; draw(); };
    label.append(top, range);
    controls.append(label);
  });
  const gravityLabel = node('label', 'gravity-control', 'Gravity');
  const gravity = node('select');
  gravity.setAttribute('aria-label', 'Gravity');
  GRAVITIES.forEach(([value, text]) => { const o = node('option', '', text); o.value = value; gravity.append(o); });
  gravity.value = String(p.physics.gravity);
  gravity.onchange = () => { p.physics.gravity = Number(gravity.value); draw(); };
  gravityLabel.append(gravity);
  controls.append(gravityLabel);
  sim.append(controls, node('p', 'simulation-note', 'Ideal model: no air resistance; launch and landing at the same height. Both axes use the same scale in metres; on the Moon or Mars the faint curve shows the same launch on Earth.'));
  draw();
  return sim;
}
