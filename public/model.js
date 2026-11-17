export const FORMATS = ['Interactive page', 'Diagram', 'Outline'];
export const EXAMPLES = {
  physics: 'Help me understand projectile motion.',
  presentation: 'Help me prepare a presentation about our release process.',
  comparison: 'Help me compare two approaches for our project.'
};
export function trajectory(speed, angle, gravity) {
  const v = Math.max(1, Math.min(30, Number(speed) || 20));
  const a = Math.max(5, Math.min(85, Number(angle) || 45)) * Math.PI / 180;
  const g = Math.max(1, Math.min(25, Number(gravity) || 9.81));
  const duration = 2 * v * Math.sin(a) / g;
  const range = v * Math.cos(a) * duration;
  const height = (v * Math.sin(a)) ** 2 / (2 * g);
  const points = Array.from({length: 61}, (_, i) => {
    const t = duration * i / 60;
    return {x: v * Math.cos(a) * t, y: Math.max(0, v * Math.sin(a) * t - .5 * g * t * t)};
  });
  return {duration, range, height, points};
}
export function demoPreview(text, audience = '', format = 'Interactive page') {
  const physics = /projectile|trajectory|throw|launch|motion|gravity/i.test(text);
  const compare = /compar|versus|\bvs\b/i.test(text);
  const presentation = /presentation|slides|release process/i.test(text);
  let kind = physics ? 'projectile' : compare ? 'comparison' : presentation ? 'outline' : 'diagram';
  if (format === 'Diagram') kind = 'diagram';
  if (format === 'Outline') kind = 'outline';
  const topic = physics ? 'Projectile motion' : compare ? 'Two approaches, side by side' : presentation ? 'A clearer release process' : 'Give your idea some shape';
  return {
    kind, title: topic,
    interpretation: physics ? 'Explore how launch speed, angle and gravity shape a trajectory.' : compare ? 'Compare two approaches using criteria you can edit.' : presentation ? 'Build a presentation you can arrange and refine.' : 'Explore an idea through a small, editable concept map.',
    audience, question: '', options: [],
    body: physics ? ['Horizontal motion stays uniform while gravity changes vertical velocity. Try changing one variable at a time.', 'This ideal model ignores air resistance and assumes launch and landing at the same height.'] : presentation ? ['Why this matters — define the purpose of the release process.', 'How work moves — describe the stages using your own team’s practices.', 'Who owns what — add the people responsible at each stage.', 'What happens next — agree on the next useful action.'] : ['Replace these starter labels with your own ideas.', 'Choose a part to explore it in more detail.'],
    nodes: physics ? ['Launch', 'Highest point', 'Landing'] : presentation ? ['Plan', 'Review', 'Release'] : ['The idea', 'What changes', 'What it means'],
    rows: [{criterion:'What matters most',a:'Add your criteria',b:'Add your criteria'},{criterion:'Trade-offs',a:'What do you gain?',b:'What do you give up?'},{criterion:'Next step',a:'What would you test?',b:'What would you test?'}]
  };
}
export function validPreview(v) {
  const short = (s, max) => typeof s === 'string' && s.length <= max;
  return !!v && ['projectile','outline','diagram','comparison'].includes(v.kind)
    && short(v.title,160) && short(v.interpretation,500) && short(v.audience,120) && short(v.question,200)
    && Array.isArray(v.options) && v.options.length <= 3 && v.options.every(s=>short(s,80))
    && Array.isArray(v.body) && v.body.length <= 6 && v.body.every(s=>short(s,700))
    && Array.isArray(v.nodes) && v.nodes.length <= 6 && v.nodes.every(s=>short(s,80))
    && Array.isArray(v.rows) && v.rows.length <= 6 && v.rows.every(r=>r && short(r.criterion,80)&&short(r.a,300)&&short(r.b,300));
}
