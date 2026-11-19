// Shared building blocks for composer controls (public/controls.js, public/composer-extensions.js).
// Rule: choosing is committing. There is no separate "Use this" step; a typed answer applies on
// Enter or the small arrow, and the current value is always visible in the "In your draft" line.
export const make = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
export const button = (text, action, cls = '') => {
  const b = make('button', cls, text);
  b.type = 'button';
  b.onclick = action;
  return b;
};

// A single-line field that applies its value on Enter or the arrow button.
export function entry(label, {type = 'text', value = '', placeholder = '', maxLength = 160, onCommit, validate, goLabel = 'Apply'}) {
  const element = make('label', 'picker-entry');
  element.append(make('span', 'picker-entry-label', label));
  const row = make('span', 'picker-entry-row');
  const input = make('input');
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.maxLength = maxLength;
  const go = button('→', () => commit(), 'picker-go');
  go.setAttribute('aria-label', goLabel);
  const sync = () => { go.disabled = !input.value.trim(); };
  input.addEventListener('input', sync);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); commit(); }
  });
  function commit() {
    const v = input.value.trim();
    if (!v) return;
    const problem = validate?.(v);
    input.setCustomValidity(problem || '');
    if (problem) { input.reportValidity(); return; }
    onCommit(v);
  }
  row.append(input, go);
  element.append(row);
  sync();
  return {element, input, commit};
}

// "In your draft: value · Clear". Updates live for controls that stay open.
export function currentLine(item, onChoose) {
  const element = make('div', 'picker-current');
  element.setAttribute('aria-live', 'polite');
  const label = make('span', 'picker-current-label', 'In your draft');
  const value = make('strong', 'picker-current-value');
  const clear = button('Clear', () => onChoose('', {keepOpen: false}), 'picker-current-clear');
  element.append(label, value, clear);
  const set = text => {
    value.textContent = text || '';
    element.hidden = !text;
  };
  set(item.confirmed ? item.value : '');
  return {element, set};
}
