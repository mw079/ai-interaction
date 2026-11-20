# Web-first interaction prototype

2026-11-17. The user moved the next interaction prototype from desktop to web for easier testing. Source lives in [`ai-interaction/`](../../README.md), not `website/`. The native LocalMind app and its local/cloud integrations remain intact.

## Intent-first revision

The website is now named **AI Interaction**, separate from the native LocalMind app. On load it shows only an empty text field. During typing it reveals a compact answer and a selective clarification, including an optional highlighted phrase with a hover/click/keyboard card and custom interpretation. The longer interactive page appears only after **Explore interactively**. Confirmed preferences update the same text rather than creating another chat message.

Live typing previews and inline questions route to `gpt-6-luna`; explicit full-page requests route to `gpt-6.1-terra`. Both use Responses and the validated component catalog. Luna uses none/450 output tokens/25 s; Terra uses low/2,400 output tokens/45 s. The connection check verifies access to both, without generation. Eleven automated checks pass. Browser checks covered the blank initial UI, quick example answer, custom phrase correction, resolved preference and explicit full-page transition. Automatic pointer-hover behavior is implemented; the observed card check used its keyboard/click-equivalent trigger. Both live website paths still need valid-key acceptance.

Official compatibility sources: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra). The model roles are a product experiment, not a measured latency/quality superiority claim.

## Clarification visual refinement

The latest pass removes the duplicated inline question/choice form. A single anchored choice popover serves the highlighted phrase or a general model question; its custom field is disclosed on demand. The writing surface stays at a fixed vertical origin, short answers remain glanceable below it, and the full-page action is a circular arrow within the composer. Escape/outside dismissal, focus return, per-question custom draft retention and viewport placement were covered in the design rules. Fourteen checks pass. This refines the same two-stage interaction and does not change the model/API contract.

## Product contract

1. **Intent:** help users express and refine a developing goal while they type.
2. **Inline decisions:** relevant questions and choices update the same task rather than requiring new chat turns.
3. **Interactive page:** turn the goal into a useful page whose text, controls, simulations, diagrams or tables can be manipulated and questioned directly.

The third part is central. A physics answer should offer an experiment, not merely another formatted paragraph. The first supported example is ideal projectile motion: speed, angle and gravity update a local trajectory and numeric readouts; users can edit its explanation and ask about selected text within the page. Colors map to the trajectory and highlighted point without being the sole source of meaning. Other supported components include an editable comparison table, clickable/editable concept map, and reorderable outline.

## Implemented and tested

- Separate zero-dependency web source, local Node preview and deployable Worker.
- Trusted component catalog with schema-validated Luna responses; no generated program execution.
- Default labeled demo fixtures; optional per-tester API key and explicit live-draft consent. No desktop Keychain access, shared deployed key or key persistence.
- Typing-pause previews with stale-result suppression, cancellation, input/output bounds and a per-connection UI request limit. User editing remains available during model work.
- Keep/dismiss proposed page; accepted interactive state remains independently editable; explicit replacement has prior-state history. Tab-only state and JSON data export.
- Direct explanation editing and selected-passage inline question entry. Demo answers are labeled examples; arbitrary live questions require Luna.
- Earlier checks: seven Node tests passed, including numerical trajectory checks and API boundary/error cases. Browser checks verified Moon versus Earth output, keeping the page, direct editing, selecting a passage and asking inline. Desktop 1280px and mobile 375px layout geometry had no horizontal overflow; responsive single-column layout verified through computed geometry.

The website BYOK live path has not been tested with a valid key. The earlier native-app Luna acceptance is separate. No arbitrary simulation generation, retrieval, user-file tools, computer use, backend task persistence or multi-user synchronization is implemented. This is a web interaction slice, not completion of the full agent, native M1b, or M2/M3 acceptance.

## Inspiration and originality

Credit [Bruce Liu's intra-turn experiments](https://demos.liubruce.me/intra-turn/) for feedforward and inline blanks, visibly in the site footer and About panel. Do not claim those techniques as LocalMind inventions. Interactive simulations, direct manipulation and shared documents are also established interaction approaches.

The testable product contribution is the connection between the three parts: developing intent creates an interactive artifact; direct edits, selection and questions continue within that artifact while context survives. This is a distinct product hypothesis, not proof of academic novelty. Evaluate usefulness against chat and the original interaction patterns instead of merely asserting the combination is new.

## Next checks

Test a real Luna preview and inline question in the web UI using explicit per-tester credentials; measure latency and structured-output reliability. Test revision races, denied/failed requests, keyboard and screen-reader usability, export expectations and preservation of edits. Observe a few users on the physics task before expanding the catalog. Keep arbitrary code generation and broad agent tools out of this first slice.

Sites registration starts owner-private. Publishing a working preview does not itself grant access to external testers. Record actual deployment/access state in PLAN.md; distinguish private review from shared usability testing.
