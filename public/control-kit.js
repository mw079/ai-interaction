// Shared building blocks for composer controls (public/controls.js, public/composer-extensions.js).
// Rule: choosing is committing. There is no separate "Use this" step; a typed answer applies on
// Enter or the small arrow, and the highlighted option shows the current choice.
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
