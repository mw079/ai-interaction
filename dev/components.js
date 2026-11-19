import {renderCatalogBlock} from '/component-renderer.js';
import {SPECIMENS} from '/__dev/component-fixtures.js';

const root = document.getElementById('specimens');
for (const {name, when, block} of SPECIMENS) {
  const card = document.createElement('section');
  card.className = 'specimen';
  const meta = document.createElement('div');
  meta.className = 'specimen-meta';
  meta.innerHTML = '<h2></h2><code></code><p></p>';
  meta.querySelector('h2').textContent = name;
  meta.querySelector('code').textContent = block.type;
  meta.querySelector('p').textContent = when;
  const host = document.createElement('div');
  card.append(meta, host);
  root.append(card);
  renderCatalogBlock(host, block, {edits: {}}, {onEdit() {}, ask() {}});
}
