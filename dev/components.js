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

// Interface pieces: static replicas using the app's real classes (development fixtures).
const pieces = [
  ['Explanation', 'Shown under a highlighted passage; closes with × or by clearing the highlight.',
    `<div class="page-assistant"><button class="page-assistant-close" tabindex="-1" aria-label="Dismiss explanation">×</button><div class="page-response"><p><strong>Memory cells</strong> are long-lived immune cells that recognise a germ’s antigens and respond faster if it returns.</p></div></div>`],
  ['Answer with a suggested edit', 'The answer comes first; the edit is one click away.',
    `<div class="page-assistant"><button class="page-assistant-close" tabindex="-1" aria-label="Dismiss explanation">×</button><div class="page-response"><p>Puddles dry on cool days because the fastest surface molecules still escape.</p></div><button class="page-reject page-offer">Review edit</button></div>`],
  ['Edit review', 'Insertions are underlined in green, removals struck through.',
    `<div class="page-field"><div class="inline-diff">Water evaporates when <del>it boils</del><ins>its fastest surface molecules escape, even below boiling</ins>.</div></div><div class="page-assistant"><div class="page-review-actions"><button class="page-apply">Apply</button><button class="page-reject">Reject</button></div></div>`],
  ['Preparing an edit', 'Shown beside the passage while a rewrite is on its way.',
    `<div class="page-assistant"><p class="page-assistant-status">Preparing edit…</p></div>`],
  ['New version ready', 'A full-page result that arrived after you edited waits here.',
    `<section class="proposal"><div class="proposal-heading"><span class="suggestion-marker"></span><span>A new version is ready</span></div><p class="proposal-reason">You edited the page while this was being made, so it waits for you instead of replacing your work.</p><h3>How vaccines train the immune system</h3><p class="proposal-intro">Vaccines show the immune system a harmless target so it can respond faster later.</p><div class="proposal-parts"><span class="proposal-part">From vaccine to memory</span><span class="proposal-part">Safety</span><span class="proposal-part">Boosters</span></div><div class="proposal-actions"><span class="proposal-note">You can go back with ←</span><button class="proposal-secondary">Keep current page</button><button class="primary-button">Replace page</button></div></section>`],
  ['Toolbar', 'Navigation as one pill; secondary actions as quiet text.',
    `<div class="document-toolbar"><span class="document-location">Your interactive page</span><div class="document-actions"><button id="page-back" class="page-nav">←</button><button id="page-forward" class="page-nav" disabled>→</button><span id="page-position">2 / 2</span><button class="quiet-button" disabled>Undo</button><button class="quiet-button">History <span id="history-count">1</span></button><button class="quiet-button">Export</button></div></div>`],
  ['Notes', 'A quiet disclosure that opens into a soft card.',
    `<details class="page-notes" open><summary>Your notes</summary><div class="page-field"><textarea rows="2" placeholder="Ask a question, or highlight any passage to explore it."></textarea></div></details>`],
  ['Creating a page', 'A calm status while Terra works.',
    `<div class="document-panel" data-generating><div class="page-progress"><span class="page-spinner"></span><span>Creating…</span><span class="page-elapsed">4 s</span></div></div>`]
];
const interfaceHeading = document.createElement('h1');
interfaceHeading.textContent = 'Interface pieces';
interfaceHeading.style.marginTop = '56px';
root.after(interfaceHeading);
const interfaceRoot = document.createElement('div');
interfaceHeading.after(interfaceRoot);
for (const [name, when, html] of pieces) {
  const card = document.createElement('section');
  card.className = 'specimen';
  const meta = document.createElement('div');
  meta.className = 'specimen-meta';
  meta.innerHTML = '<h2></h2><p></p>';
  meta.querySelector('h2').textContent = name;
  meta.querySelector('p').textContent = when;
  const host = document.createElement('div');
  host.className = 'paper';
  host.style.cssText = 'padding:0;border:0;box-shadow:none';
  host.innerHTML = html;
  card.append(meta, host);
  interfaceRoot.append(card);
}
