import {renderCatalogBlock} from '/component-renderer.js';

const item = (label, detail, value = 0) => ({label, detail, value, latitude: null, longitude: null});
const edge = (from, to, label = '') => ({from, to, label});

const SPECIMENS = [
  {
    name: 'Cycle', when: 'Steps that repeat: the last step leads back to the first.',
    block: {id: 'water-cycle', type: 'cycle', title: 'The water cycle', prompt: '', edges: [], items: [
      item('Evaporation', 'Sunlight warms oceans and lakes, and water escapes into the air as vapour.'),
      item('Condensation', 'Rising vapour cools and condenses into tiny droplets that form clouds.'),
      item('Precipitation', 'Droplets merge until they are heavy enough to fall as rain or snow.'),
      item('Collection', 'Water gathers in rivers, oceans and the ground, ready to evaporate again.')
    ]}
  },
  {
    name: 'Process', when: 'A one-way sequence of steps or events.',
    block: {id: 'vaccine-steps', type: 'timeline', title: 'From vaccine to immune memory', prompt: '', edges: [], items: [
      item('Vaccine introduces a target', 'The vaccine shows your body an antigen: a harmless piece of a germ, or instructions to make one.'),
      item('Immune cells activate', 'B and T cells recognise the antigen and start an immune response.'),
      item('Memory cells remain', 'Some of those cells stay behind as long-lived memory cells.'),
      item('The real germ appears', 'Memory cells recognise the germ quickly and launch a faster, stronger response.'),
      item('Protection is reinforced', 'Boosters remind the immune system, refreshing memory that fades over time.')
    ]}
  },
  {
    name: 'Comparison', when: 'Two or three alternatives read side by side.',
    block: {id: 'rent-buy', type: 'comparison', title: 'Renting or buying', prompt: '', edges: [], items: [
      item('Renting', 'Lower upfront cost and easy to move. Payments build no equity, and rent can rise.'),
      item('Buying', 'Builds equity and fixes your housing cost. Needs a deposit, and selling takes time and fees.')
    ]}
  },
  {
    name: 'Chart', when: 'Supplied or well-established numbers.',
    block: {id: 'planet-distance', type: 'chart', title: 'Average distance from the Sun (AU)', prompt: '', edges: [], items: [
      item('Mercury', 'The closest planet, about two-fifths of Earth’s distance.', 0.39),
      item('Venus', 'Nearly three-quarters of Earth’s distance.', 0.72),
      item('Earth', 'By definition, one astronomical unit.', 1),
      item('Mars', 'About one and a half times Earth’s distance.', 1.52),
      item('Jupiter', 'More than five times farther than Earth.', 5.2)
    ]}
  },
  {
    name: 'Hierarchy', when: 'Categories and what belongs in each.',
    block: {id: 'rock-types', type: 'hierarchy', title: 'Types of rock', prompt: '',
      items: [
        item('Rock', 'Rocks are grouped by how they formed.'),
        item('Igneous', 'Formed when molten rock cools and hardens.'),
        item('Sedimentary', 'Formed from layers of sediment pressed together over time.'),
        item('Metamorphic', 'Formed when heat and pressure change existing rock.'),
        item('Granite', 'An igneous rock that cooled slowly underground, so its crystals are large.'),
        item('Sandstone', 'A sedimentary rock made of cemented sand grains.')
      ],
      edges: [edge(0, 1), edge(0, 2), edge(0, 3), edge(1, 4), edge(2, 5)]}
  },
  {
    name: 'Decision tree', when: 'Choices and where each one leads.',
    block: {id: 'first-aid', type: 'decision_tree', title: 'Is the person responsive?', prompt: '',
      items: [
        item('Check for a response', 'Tap their shoulder and ask loudly if they are all right.'),
        item('Ask what happened', 'They are responsive: find out what is wrong and get help if needed.'),
        item('Check breathing', 'No response: open the airway and look for normal breathing for 10 seconds.'),
        item('Recovery position', 'Breathing normally: roll them onto their side and keep monitoring.'),
        item('Call and start CPR', 'Not breathing normally: call emergency services and begin chest compressions.')
      ],
      edges: [edge(0, 1, 'Responds'), edge(0, 2, 'No response'), edge(2, 3, 'Breathing'), edge(2, 4, 'Not breathing')]}
  },
  {
    name: 'Concept map', when: 'How ideas relate; labels appear for the focused idea.',
    block: {id: 'photosynthesis', type: 'graph', title: 'Photosynthesis', prompt: '',
      items: [
        item('Sunlight', 'Light energy captured by chlorophyll powers the reaction.'),
        item('Chlorophyll', 'The green pigment in chloroplasts that absorbs light.'),
        item('Water', 'Taken up by roots and split, releasing oxygen.'),
        item('Carbon dioxide', 'Taken in through leaf pores and built into sugar.'),
        item('Glucose', 'The sugar the plant uses for energy and growth.'),
        item('Oxygen', 'Released into the air as a by-product.')
      ],
      edges: [edge(0, 1, 'absorbed by'), edge(1, 4, 'powers making'), edge(2, 5, 'releases'), edge(3, 4, 'built into'), edge(2, 4, 'supplies hydrogen')]}
  }
];

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
