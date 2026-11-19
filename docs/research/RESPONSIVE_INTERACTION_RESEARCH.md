# Responsive interaction: intent, selection and living responses

Research date: 2026-11-18. Scope: design and request architecture recommendations for AI Interaction. This is a research synthesis, not an implementation report. No deployment or model/API configuration changes.

## Recommendation

Use a persistent shared page and evolving intent state. Luna offers provisional help while the user types and focused assistance for selected objects. Terra handles explicitly submitted broader revisions. Ordinary controls and verified computations respond locally. A response can be an explanation, a clarification, an example, a comparison, a visualization, or a bounded reversible edit. Automatic activity should support the current task without moving the caret, stealing focus, changing confirmed intent, or replacing the page being read.

The three live functions—answer, question and choices—are useful independent presentation channels. They do not imply three requests on every edit. Start with one bounded structured draft-analysis response; use a separate request for an explicit selection action or committed page edit. Compare this with split calls empirically rather than assuming that either grouping or separation is always faster.

## Research and evidence boundaries

1. [Horvitz, Principles of Mixed-Initiative User Interfaces (CHI 1999)](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/chi99horvitz.pdf). Connects automated assistance to direct manipulation, uncertainty about goals, interruption cost, efficient correction and shared recent context. This is a foundational design account, not evidence that this application's particular timing policy improves outcomes.
2. [Amershi et al., Guidelines for Human-AI Interaction (CHI 2019), guideline poster](https://www.microsoft.com/en-us/research/uploads/prod/2019/01/AI-Guidelines-poster_PrintQuality.pdf). Supports relevant timing, dismissal, correction, cautious adaptation and communicating consequences. [Project overview](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/overview/) describes the validation process. Guidelines are design inputs, not a productivity guarantee.
3. [DirectGPT (CHI 2024), full paper](https://arxiv.org/html/2310.03691v2). Makes generated objects directly addressable, reuses commands and supports undo. Its controlled editing study reported faster completion and fewer/shorter prompts than its ChatGPT baseline. Those results concern its selected tasks, participants and older model/interface conditions; they do not establish the same effect size for our product.
4. [Potluck, Ink & Switch (2022)](https://www.inkandswitch.com/potluck/). Demonstrates gradual enrichment of freeform documents with computed annotations and widgets. Its separation of source text and computational annotations is particularly relevant to our parenthetical choices. It is a research prototype/essay rather than a comparative LLM user trial.
5. [Bret Victor, Explorable Explanations (2011, with later postscript)](https://worrydream.com/ExplorableExplanations/). Proposes active reading through reactive assumptions, explorable examples and contextual information. Useful as a design direction; an interactive widget alone does not establish comprehension gains.
6. [Sensecape (UIST 2023), full paper](https://arxiv.org/html/2305.11483v2). Explores nonlinear sensemaking and multiple levels of abstraction. Its study supports examining overview-to-detail interactions, with limited task/study generality.
7. [Luminate (CHI 2024), full paper](https://arxiv.org/html/2310.12953v3). Explores alternatives along explicit design dimensions, including a study with 14 professional writers. Supports trying side-by-side concrete alternatives rather than expecting a perfect initial description. Creative-writing results do not automatically transfer to science education.
8. [AI Chains (CHI 2022), conference record](https://programs.sigchi.org/chi/2022/program/content/72178). Studies editable intermediate results and controllability with 20 participants. Relevant to exposing useful intermediate decisions; it does not imply that every UI feature needs its own sequential inference call.
9. [Structured Uncertainty guided Clarification for LLM Agents, revised April 2026](https://arxiv.org/html/2511.08798v2). Structures missing tool arguments and selects clarification with explicit stopping criteria. Its ClarifyBench evidence uses simulated users and scoped models/domains. This motivates a question policy; it does not validate a free-form model confidence score as a calibrated probability.
10. [Google PAIR, Feedback + Control](https://pair.withgoogle.com/chapter/feedback-controls/). Distinguishes explicit and implicit feedback and connects controls to visible effects. Applying a task-local preference is different from training the model or silently saving a permanent preference.
11. [Nielsen Norman Group, Four Dimensions of Tone of Voice](https://www.nngroup.com/articles/tone-of-voice-dimensions/). Treats formality, humor, respectfulness and enthusiasm as separable. Appropriate tone choices depend on the task; they do not authorize changes to the underlying facts.
12. [Interaction-Required Suggestions (In2Writing 2025 workshop)](https://arxiv.org/abs/2504.08726). Explores revision interactions that preserve active human involvement. This is exploratory workshop work, not strong comparative evidence for automatic live assistance.
13. [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs.md). Supplies the contract mechanism for bounded response fields and component descriptors. Schema validity does not guarantee sensible choices or accurate facts; errors, refusals and incomplete results still need handling.
14. [OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization.md). Recommends measuring complete user-visible waits, token volume and request structure. Supports experimenting with fewer calls and using local computation for deterministic controls.

Bruce Liu's [Beyond Taking Turns](https://escholarship.org/uc/item/28d8b7wd) and [intra-turn demo](https://demos.liubruce.me/intra-turn/) remain the project's original inspiration. The dissertation abstract describes parallel communication, proactive participation and persistent shared spaces. The demo and full dissertation could not be newly retrieved through the research browser in this pass; no new claims about the demo's prompts, source code or exact implementation are inferred from that access failure or from screenshots.

Jelly's [paper record](https://doi.org/10.1145/3706598.3713285) is a further lead for malleable task interfaces. Full-text retrieval failed here; it is not used as verified evidence for an empirical claim in this recommendation.

## What defines a response? Proposed product model

This taxonomy is our synthesis, not a standard adopted verbatim from one paper.

| Dimension | What can differ | Contextual clarification example |
| --- | --- | --- |
| Purpose | Explain, explore, compare, decide, draft, check | Understand the idea or solve an exercise? |
| Audience and background | Who reads it; what they already know | Assume basic algebra? |
| Scope | A word, selected paragraph, object, section, whole page | Change this paragraph only? |
| Depth | Intuition, worked examples, derivation | Show why the orbit is an ellipse? |
| Representation | Text, table, diagram, simulation, mixed media | Explain in words or explore an orbit? |
| Structure | Overview-first, steps, comparison, reference | Walk through the laws one at a time? |
| Tone | Formality, warmth, humor, enthusiasm | Compare two short sample openings |
| Language and terminology | Language, notation, jargon, units | Everyday language or physics notation? |
| Length and pace | Quick answer, expandable detail, guided stages | One-minute overview or step-by-step exploration? |
| Interaction | Read, manipulate, predict, practice, ask locally | Try changing eccentricity or watch an example? |
| Evidence and assumptions | Sources, model assumptions, verified versus unknown | Ideal two-body model or real-planet departures? |
| Action and persistence | Suggest, stage, apply; temporary or saved | Show a suggested edit or apply it with Undo? |

These dimensions complement the implemented 20 information types. They should not become another mandatory questionnaire. Surface a dimension when it affects the next useful outcome. Some settings are preferences; some are constraints; factual accuracy is not a selectable style. Keep accessibility and keyboard operation as baseline product requirements rather than something a user must request.

For every preference retain the value, its scope, and its origin: explicit user text, explicit choice, tentative inference or unknown. A provisional assumption must not look like a confirmed choice. A one-off casual draft must not silently become a persistent preference for all future work.

## Policy for live questions

A bare request to ask clarifying questions invites unnecessary questions. Instead evaluate a decision:

1. Read the complete current draft and the page/task state.
2. Identify what is already specified, including later text and confirmed choices.
3. Identify missing information whose answer would materially change the next output or action.
4. If a safe, easy-to-correct default is adequate, proceed and expose that assumption unobtrusively when useful.
5. Ask at most one high-value question visibly. Other relevant editable controls can remain attached to phrases.
6. Return no question when none is needed. Supply a short useful answer even if an optional preference remains unresolved.
7. Resolve factual unknowns with evidence or an honest limitation, not by asking the user to choose what should be true.

A conceptual criterion is expected improvement in the outcome versus the attention cost of asking. This is a design heuristic unless we actually build and calibrate a decision model; do not display invented confidence percentages.

Proposed Luna instruction (not yet applied):

> Read the entire latest draft, confirmed choices, selected scope and current page. Determine whether missing information would materially change the next useful response. If so, return one concise, answerable clarification with contextual options and an exact anchor. Otherwise return no question. Provide a short provisional answer when useful. Respect later details and confirmed preferences. Distinguish factual uncertainty from unknown preferences. Never invent ambiguity to fill the UI. Do not modify user content while analyzing the draft.

## Suggested interaction contract

- Draft analysis: Luna returns a short answer, optional question, typed choices, and optional editable assumptions in one structured response. Keep these semantically separate, with independent display and dismissal rules.
- Selection help: after a completed selection gesture, show a small contextual affordance. Luna may provide a short transient explanation in an explicit live-help mode; visible content changes require an action such as Explain, Simplify, Compare, Ask here or Replace.
- Committed local edit: Luna receives the selected block/object and enough surrounding context, with an explicit operation. Return a bounded patch, not a whole new page.
- Broad revision: Terra receives the latest task/page revision after Send and returns a larger staged update.
- Direct control: deterministic slider changes, arithmetic and verified simulations update locally. Inference can interpret the result on demand or after a committed gesture; never call an LLM for every animation frame.

Every model result should identify the draft/page revision it belongs to. Stale results are discarded or offered as old suggestions, never silently applied over newer edits. Both Luna and Terra edits need history, visible affected scope and revert. Selection must have stable block/object identity plus selected range; a copied string alone may refer to multiple places.

## Additional prototypes worth testing

1. Selection lens: a small explanation beside a selected term; closes without changing the document. Works in the composer and page, with explicit scope and copy still available.
2. Concrete format previews: two tiny previews of the same content, such as paragraph versus orbit diagram. User preference can emerge from comparison instead of an abstract settings question.
3. Editable assumptions: a quiet line such as “Using a beginner explanation”; click to adjust or dismiss. Distinct styling for inferred versus user-confirmed values.
4. Semantic zoom: one-sentence overview → selected concept → worked example or derivation. Keep one coherent page rather than append a new long answer at each depth.
5. Pin and protect: user-written or accepted blocks can be locked against regeneration. Request a separate suggestion if a change conflicts with a lock.
6. Linked views: selecting an equation highlights the corresponding orbit segment and explanation. A graph, table and prose share verified state rather than making independent model claims.
7. What-if branch: compare two assumptions without losing the current answer; restore or merge deliberately. Simple scenarios first, not an elaborate node editor.
8. Predict then reveal: for learning, ask a small optional prediction before showing a verified simulation result. Measure understanding rather than assume animation teaches better.
9. Local critique: mark “unclear here” or “needs a source here” on an exact passage. Respond in place; use retrieval for actual evidence, not fabricated citation styling.
10. Scope-aware follow-up: selecting a graph object makes “why does this change?” refer to that object and its current parameters. Cursor position alone is insufficient evidence of user intent.

## Guardrails for a calm interface

Selection does not automatically authorize editing. Hover does not imply acceptance. Suggestions must not steal focus, move the caret, reorder controls beneath the pointer, or reflow the whole page during reading. Preserve confirmed choices when answers refresh. Allow pauses, dismissal, manual mode and keyboard access. Show only task-relevant controls; do not expose every information type. Do not pretend a decorative diagram is a valid scientific simulation.

Our current plain textarea plus mirrored annotations is an incremental prototype. A later structured editor could store annotations separately from source text, while serializing explicit choices for the model. That would reduce raw offset and parenthesis bookkeeping without removing freeform editing.

## Build and evaluate next

1. Selection-scoped help in both composer and page; same interaction language, different scope.
2. Structured question policy with valid no-question output and explicit/inferred preference origins.
3. Bounded Luna patches with preview/apply/revert and stable page revisions.
4. Matched trials: ordinary chat; current live composer; selection-aware living page. Include clearly specified requests, vague requests, late disambiguation, a request needing no visualization, and edits during pending generation.
5. Measure task success, correction burden, redundant/wrong questions, retained human edits, comprehension where relevant, perceived distraction/control, p50/p95 time to useful assistance and cost per finished task. Compare grouped draft-analysis calls with split requests on the same tasks. Track confirmed preferences violated and stale updates applied as failures, not only latency.

Nothing in this note establishes that all proposed features improve user experience. The most defensible next test is whether a user can get a relevant response, correct its format or scope, and refine a selected part without losing work or writing another full prompt.

## Follow-up: concrete automatic writing interactions (2026-11-18)

The product distinction is automatic small-model assistance during composition versus explicitly submitted larger-model generation. Automatically showing a suggestion and automatically inserting it are different interactions. Keep the former while requiring acceptance for the latter.

Additional sources reviewed for this pass:

- [Gmail Smart Compose, KDD 2019](https://research.google/pubs/gmail-smart-compose-real-time-assisted-writing/): real-time writing suggestions are an established deployable interaction pattern. Email completion evidence does not establish the value of generating whole new user intentions.
- [CoAuthor, CHI 2022, full paper](https://arxiv.org/html/2201.06796v2): 63 writers and 1,445 sessions demonstrate a range of suggestion acceptance/editing behaviors. It is a dataset/interface contribution, not proof that automatic next-sentence prompting is universally beneficial.
- [Wordcraft professional-writer study](https://arxiv.org/html/2211.05030v1): 13 professional writers used assistance for different purposes, with limitations in voice and contextual understanding. Preserve user direction and support optional suggestions.
- [Predictive Text Encourages Predictable Writing, IUI 2020](https://kgajos.seas.harvard.edu/papers/arnold20predictive.pdf): an image-captioning experiment found that suggestions changed written content as well as speed. Its task and suggestion system differ from today's LLM assistants.
- [Suggestion Lists vs Continuous Generation, MuC 2022](https://arxiv.org/abs/2208.00870): an 18-participant mobile study found different authorship/editing effects across suggestion selection and continuous generation. Do not equate more automatic generation with a better experience.
- [Reactive Writers, CHI 2026, full paper](https://arxiv.org/html/2603.10374v1): interviews with 19 participants and analysis of 1,291 sessions examine how attention can shift toward evaluating suggestions. Its deliberately opinionated, frequent-completion setting limits generalization. Useful design implication: distinguish helping express an existing idea from introducing a new direction; do not make every new idea an inline default.

Concrete candidates beyond the three existing live features:

| Candidate | Automatic visible behavior | User control |
| --- | --- | --- |
| Ghost sentence | One suggested next sentence after a writing pause, visually distinct from authored text | Tab or explicit touch acceptance; Escape dismiss; ordinary typing continues |
| Intent mirror | One-line interpretation of the goal updates with the whole draft | User corrects the draft or a persistent preference; inferred intent remains tentative |
| Live outline | Two or three headings preview the larger response as the draft evolves | Changing the request changes the proposed structure before Send |
| Selection lens | A brief explanation appears beside a selected phrase/object | Transient help only; no automatic rewriting |
| Live example | One concrete example appears when an abstract concept is introduced | Expand only when useful; do not replace the user's current task |
| Consistency check | A small targeted notice when current constraints conflict | User resolves the conflict; no guessed correction |
| Live sketch | A compact preview of the likely diagram/table/itinerary | Provisional until explicit generation; no factual or executable claims from decorative previews |
| Contextual recall | Relevant earlier confirmed choices are surfaced as the user refers to them | User can detach or change them; no silent permanent preference storage |

Start by comparing ghost sentence, intent mirror, live outline and selection lens as separate prototypes. They are alternatives to assess, not four panels to display simultaneously. Use a quiet priority policy: a high-value clarification can temporarily take precedence over a completion; show at most one attention-seeking intervention near the caret.

The in-conversation studies are deterministic, example-based interaction mockups, not OpenAI-backed implementations. They demonstrate typing, explicit completion acceptance, interpretation/outline updates, selection-scoped help and the separate Send action. They make no model-latency claim. App code, API configuration and hosting are unchanged in this pass.

Acceptance details for a real implementation: no completions during IME composition; accept Tab only when a valid suggestion is visible and the caret is at the intended insertion point; preserve ordinary keyboard navigation otherwise; never auto-insert suggestions; suppress stale results; do not constantly announce changing text to screen readers; provide a pause/manual mode and touch alternatives. Measure task relevance, interruption burden and authorship/control, as well as completion acceptance and speed. Proposed debounce intervals are experiments, not measured model performance.

## Simplification and ten further design experiments (2026-11-18)

Clarification after user feedback: ghost sentence is ordinary sentence autocomplete; intent mirror is a short restatement of inferred intent; selection help is the live answer scoped to a selected passage. These should not be treated as three permanent panels. The current app has live answers, live questions and phrase choices. Autocomplete, intent mirror and live outline remain concepts. Selection Q&A exists only as a button-driven, explicit-question path in editable explanations; automatic selection help in both editor and page is not implemented.

Proposed default: one composer, one compact shared live-help region, phrase-local popovers, and optional inline completion. A selected passage redirects the shared live answer. A high-value question takes priority over completion. Keep a dedicated intent restatement and live outline off by default; expose an assumption only when it affects the task.

Research added in this pass:

- [DynaVis, CHI 2024, full paper](https://arxiv.org/html/2401.10880v1): combines language edits with persistent synthesized widgets; its 24-participant visualization-editing study motivates reusable controls for repeat edits. The paper also discusses widget accumulation. It does not establish that unlimited dynamic controls suit this product.
- [PromptCharm, CHI 2024, full paper](https://arxiv.org/html/2403.04014v1) and [Promptify, full preprint](https://arxiv.org/html/2304.09337v1): multimodal feedback and concrete generated examples help explore/refine visual intent in their image-generation contexts. Adapting example-based steering to explanation style is a proposed transfer, not a validated result of those studies.
- [Embark](https://www.inkandswitch.com/embark/) and [Malleable Software](https://www.inkandswitch.com/essay/malleable-software/): motivate shared data, multiple views and evolving tools within documents. These are research prototypes/design essays, not comparative evidence of better learning or agent performance.
- [Patchwork research update](https://www.inkandswitch.com/newsletter/dispatch-004/): describes lightweight branches, grouped changes and history experiments. Relevant to temporary previews and bounded changes without a growing chat transcript.
- Revisited [Reactive Writers](https://arxiv.org/html/2603.10374v1): supports caution about attention-capturing inline suggestions, especially when they introduce new stances or ideas; its experimental setting limits generalization.

Ten candidate interactions beyond the current live answer/question/choice flow. These are research-inspired product ideas, not claims of original invention or validated UX gains:

1. **Hold to preview:** press and hold a candidate such as Diagram; temporarily see its effect on the affected output area, release to restore, click/tap explicitly to keep. Preview asynchronously when needed; do not imply instant inference.
2. **Resize for detail:** drag a selected explanation's detail handle toward a concise summary or expanded worked example. Prepare a scoped model revision and keep the old version available. The gesture controls detail, not merely font size.
3. **Show an example:** drop a sample paragraph or diagram and select what to borrow—tone, structure, or visual form. Explicitly avoid importing its facts as user preferences or evidence.
4. **Trace a choice to its effects:** focus a confirmed phrase; highlight the page blocks that declare a dependency on that preference. Use actual recorded dependencies, not model attention or an invented causal explanation.
5. **Balance constraints visually:** when days, budget and activities conflict, show the trade-off in a compact schedule or allocation control. User chooses what can move; the system does not silently relax constraints.
6. **Draw to specify:** sketch a rough orbit, sequence or layout; use it as spatial intent alongside text. For science, validate any resulting quantitative model instead of interpreting the sketch as a physical truth.
7. **Turn a repeated correction into a tool:** after the user repeatedly adjusts the same aspect, offer one reusable local control (for instance, terminology level) rather than requiring the same natural-language request again. Keep it dismissible and scoped to this task.
8. **Set the reach of a preference:** a small scope control on a chosen value distinguishes this passage, this page, or future tasks. Persist broad preferences only with explicit choice; one-off tone must not become a global default.
9. **Edit through either representation:** change a flowchart relation or table value and update the corresponding explanation from shared structured state. Validate semantics, show the affected area, and keep the update reversible.
10. **Pause around attention:** while the user is selecting, reading or editing a block, freeze automatic replacements in that area and coalesce pending updates. Resume quietly when appropriate; do not equate lack of typing with permission to rewrite visible content.

Prioritize hold-to-preview, example-based steering and reusable controls after repeated corrections as small experiments. An attention-aware update policy is foundational behavior. Keep most features latent until an action makes them relevant. No new application behavior or deployment was performed for this brainstorming pass.
