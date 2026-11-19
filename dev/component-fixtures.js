// Sample model output for every prebuilt component. Used by the gallery and checked by tests.
const item = (label, detail, value = 0) => ({label, detail, value, latitude: null, longitude: null});
const edge = (from, to, label = '') => ({from, to, label});

export const SPECIMENS = [
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
    name: 'Comparison criteria', when: 'Four or more aspects of one decision, shown one at a time.',
    block: {id: 'rent-buy-criteria', type: 'comparison', title: 'How renting and buying differ', prompt: '', edges: [], items: [
      item('Upfront costs', 'Renting needs a deposit; buying needs a down payment plus closing costs.'),
      item('Monthly costs', 'Rent covers housing; owners also pay interest, taxes, insurance and upkeep.'),
      item('Flexibility', 'Renters can move at the end of a lease; selling a home takes months and fees.'),
      item('Repairs', 'Landlords usually handle major repairs; owners pay for them.'),
      item('Building equity', 'Mortgage payments build ownership over time; rent does not.')
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


const place = (label, detail, latitude, longitude) => ({label, detail, value: 0, latitude, longitude});

SPECIMENS.push(
  {
    name: 'Labelled diagram', when: 'Parts of a system and how they connect.',
    block: {id: 'heart-flow', type: 'hotspot_diagram', title: 'How blood moves through the heart', prompt: '',
      items: [
        item('Right atrium', 'Receives oxygen-poor blood from the body.'),
        item('Right ventricle', 'Pumps that blood to the lungs.'),
        item('Lungs', 'Blood picks up oxygen and releases carbon dioxide.'),
        item('Left atrium', 'Receives oxygen-rich blood from the lungs.'),
        item('Left ventricle', 'Pumps oxygen-rich blood out to the body.')
      ],
      edges: [edge(0, 1, 'tricuspid valve'), edge(1, 2, 'pulmonary artery'), edge(2, 3, 'pulmonary veins'), edge(3, 4, 'mitral valve')]}
  },
  {
    name: 'Parameter explorer', when: 'One input changes; the outcome follows.',
    block: {id: 'boiling-altitude', type: 'parameter_explorer', title: 'Boiling point and altitude', prompt: 'Altitude', edges: [], items: [
      item('Sea level', 'Water boils at 100 °C under normal air pressure.', 0),
      item('1,500 m', 'Lower pressure lets water boil at about 95 °C.', 1500),
      item('3,000 m', 'Water boils near 90 °C, so pasta takes longer to cook.', 3000),
      item('8,849 m', 'On Everest water boils at roughly 70 °C.', 8849)
    ]}
  },
  {
    name: 'Prediction', when: 'Commit to a guess before seeing the answer.',
    block: {id: 'falling-objects', type: 'prediction', title: 'Predict the landing', prompt: 'A bowling ball and a tennis ball fall from the same height with no air resistance. Which lands first?', edges: [], items: [
      item('The bowling ball', 'Heavier objects are pulled harder, but they also need more force to accelerate, so it does not land first.', 0),
      item('They land together', 'Without air resistance every object falls with the same acceleration, about 9.8 m/s².', 1),
      item('The tennis ball', 'A lighter object does not fall faster; without air both accelerate equally.', 0)
    ]}
  },
  {
    name: 'Before / after', when: 'Two versions of the same thing.',
    block: {id: 'sentence-revision', type: 'before_after', title: 'Tightening a sentence', prompt: '', edges: [], items: [
      item('First draft', 'In order to be able to understand the results, it is important that we first take a look at the data.'),
      item('Revision', 'To understand the results, look at the data first.')
    ]}
  },
  {
    name: 'Sorting', when: 'Place each example in its group.',
    block: {id: 'states-of-matter', type: 'sorting', title: 'Solid, liquid or gas?', prompt: '',
      items: [
        item('Solid', 'Keeps its own shape.', 1),
        item('Liquid', 'Takes the shape of its container.', 1),
        item('Gas', 'Spreads out to fill any space.', 1),
        item('Ice cube', 'Ice keeps its own shape, so it is a solid.'),
        item('Olive oil', 'Oil flows and takes the shape of its bottle, so it is a liquid.'),
        item('Steam', 'Steam spreads out to fill the room, so it is a gas.')
      ],
      edges: [edge(3, 0), edge(4, 1), edge(5, 2)]}
  },
  {
    name: 'Function plot', when: 'Drag along a curve to read values.',
    block: {id: 'square-curve', type: 'function_plot', title: 'The square function', prompt: 'square', edges: [], items: [
      item('Start', 'Left end of the domain.', -3),
      item('End', 'Right end of the domain.', 3)
    ]}
  },
  {
    name: 'Evidence', when: 'A claim and the sources that support it.',
    block: {id: 'sleep-memory', type: 'evidence', title: 'Sleep and memory', prompt: '',
      items: [
        item('Sleep helps memory', 'Sleeping after learning helps people remember it better.'),
        item('Recall test', 'People who slept after studying word pairs recalled more of them the next day.'),
        item('Brain recordings', 'During deep sleep, the brain replays patterns seen while learning.')
      ],
      edges: [edge(0, 1, 'Supplied study'), edge(0, 2, 'Supplied review')]}
  },
  {
    name: 'Map', when: 'Real places, framed around the ones that matter.',
    block: {id: 'kyoto-sights', type: 'map', title: 'Three days around Kyoto', prompt: '', edges: [], items: [
      place('Kyoto', 'Temples, gardens and historic streets; a calm base for the trip.', 35.0116, 135.7681),
      place('Nara', 'Deer park and Todai-ji, an easy day trip by train.', 34.6851, 135.8048),
      place('Osaka', 'Street food and nightlife, 15 minutes by fast train.', 34.6937, 135.5023)
    ]}
  },
  {
    name: 'Linked scenarios', when: 'One shared input, two outcomes side by side.',
    block: {id: 'savings-rate', type: 'linked_scenarios', title: 'Saving for ten years', prompt: 'Monthly savings', edges: [], items: [
      item('100 €', 'Cash account: about 12,600 € | Index fund: about 16,400 €', 100),
      item('300 €', 'Cash account: about 37,800 € | Index fund: about 49,100 €', 300),
      item('500 €', 'Cash account: about 63,000 € | Index fund: about 81,900 €', 500)
    ]}
  },
  {
    name: 'Worked example', when: 'Reveal one step at a time, then try it yourself.',
    block: {id: 'percent-change', type: 'worked_example', title: 'Percentage change', prompt: 'A price goes from 40 € to 50 €. What is the percentage change?', edges: [], items: [
      item('Find the change', '50 − 40 = 10 €.'),
      item('Divide by the start value', '10 ÷ 40 = 0.25.'),
      item('Turn it into a percentage', '0.25 × 100 = 25 %, an increase.')
    ]}
  },
  {
    name: 'Practice', when: 'A prompt, hints on request, and feedback.',
    block: {id: 'explain-seasons', type: 'practice', title: 'Explain the seasons', prompt: 'Explain why it is warmer in summer than in winter.', edges: [], items: [
      item('Tilt.', 'Think about the tilt of Earth’s axis, not its distance from the Sun.'),
      item('Sun height.', 'How high the Sun climbs changes how concentrated its light is.')
    ]}
  },
  {
    name: 'Proportion', when: 'Parts of one whole.',
    block: {id: 'air-composition', type: 'proportion', title: 'What dry air is made of', prompt: '', edges: [], items: [
      item('Nitrogen', 'About 78 % of dry air; mostly unreactive.', 78),
      item('Oxygen', 'About 21 %; the part we need to breathe.', 21),
      item('Argon', 'Just under 1 %; a noble gas.', 0.93),
      item('Carbon dioxide', 'About 0.04 %, yet it matters for climate.', 0.04)
    ]}
  },
  {
    name: 'Matrix', when: 'Four quadrants on two dimensions.',
    block: {id: 'priorities', type: 'matrix', title: 'Urgent or important?', prompt: 'Urgency | Importance', edges: [], items: [
      item('Plan it', 'Important but not urgent: schedule time for it.'),
      item('Do it now', 'Important and urgent: handle it first.'),
      item('Drop it', 'Neither urgent nor important: let it go.'),
      item('Delegate it', 'Urgent but not important: hand it to someone else.')
    ]}
  },
  {
    name: 'Checklist', when: 'Practical steps to tick off.',
    block: {id: 'move-in', type: 'checklist', title: 'Before you sign a lease', prompt: '', edges: [], items: [
      item('Read the whole lease', 'Check the length, notice period and what happens if you leave early.'),
      item('Inspect the flat', 'Photograph any damage so it is not charged to you later.'),
      item('Confirm the costs', 'Ask which bills are included and how the deposit is protected.'),
      item('Check the landlord', 'Make sure the person renting it out has the right to.')
    ]}
  },
  {
    name: 'Flashcards', when: 'Recall first, then flip to check.',
    block: {id: 'cell-parts', type: 'flashcards', title: 'Parts of a cell', prompt: '', edges: [], items: [
      item('What does the mitochondrion do?', 'It releases energy from food through cellular respiration.'),
      item('What is the cell membrane for?', 'It controls what enters and leaves the cell.'),
      item('Where is DNA kept?', 'In the nucleus of plant and animal cells.')
    ]}
  },
  {
    name: 'Spectrum', when: 'Where each item sits on a scale.',
    block: {id: 'ph-scale', type: 'spectrum', title: 'The pH scale', prompt: 'Acidic | Alkaline', edges: [], items: [
      item('Lemon juice', 'pH about 2: strongly acidic.', 14),
      item('Coffee', 'pH about 5: mildly acidic.', 36),
      item('Pure water', 'pH 7: neutral.', 50),
      item('Baking soda', 'pH about 9: mildly alkaline.', 64),
      item('Bleach', 'pH about 13: strongly alkaline.', 93)
    ]}
  },
  {
    name: 'Key numbers', when: 'A few figures that tell the story.',
    block: {id: 'earth-numbers', type: 'key_numbers', title: 'Earth in numbers', prompt: '', edges: [], items: [
      item('days in a year', 'One orbit around the Sun takes about 365.25 days.', 365.25),
      item('km to the Sun', 'In millions; light covers it in about 8 minutes.', 149.6),
      item('degrees of tilt', 'The axial tilt that gives us seasons.', 23.4)
    ]}
  }
);
