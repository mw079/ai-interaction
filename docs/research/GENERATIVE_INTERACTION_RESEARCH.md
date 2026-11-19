# Continuous interaction and generative interfaces

Research and design proposal: 2026-11-17. No generated-interface runtime was implemented in this research pass.

## Product direction

Make LocalMind a persistent workspace whose content and useful controls adapt to the user's actions. Text is one input alongside selection, clicking, direct editing, dragging, and structured choices. The user should not have to wait for an answer to finish before contributing. Keep normal chat available as an optional interface and inspectable history.

The social-search analogy combines recognition rather than recall, incremental query formulation, immediate feedback, and suggestions that reveal available possibilities. It is a strong direction, but not a universal rule that more suggestions are better. Poorly ranked, distracting, or misleading suggestions can add work and steer people toward the system's assumptions. Distinguish suggestions from user input and keep custom input possible.

Separate three kinds of action:

| Action | Expected response |
| --- | --- |
| Change a filter, sort existing data, select a result, edit text | Immediate local state change; usually no model call |
| Ask for a new comparison, explanation, representation, or missing information | Model/tool work updates the affected region asynchronously |
| Save, send, delete, or otherwise act outside the workspace | Real capability-backed operation, subject to the permission broker and appropriate approval |

Continuous interaction is an experience built over events and persistent state. It does not require continuous model inference, sending every cursor movement, or eliminating backend request boundaries.

## Foundational principles and concrete analogies

The applications here are LocalMind design proposals, not claims that research has validated this exact product.

| Principle | Familiar analogy | LocalMind application |
| --- | --- | --- |
| Recognition rather than recall | Search suggestions show a person before the full name is typed | Show relevant resources, interpretations and actions; let the user choose or type something else |
| Incremental, reversible exploration | A property-search price slider changes the visible map | Let users adjust comparison criteria and inspect the effect without rewriting a prompt |
| Direct manipulation and reference | Select text and choose a formatting operation | Select two results and ask “compare these”; attach the instruction to stable object IDs |
| Progressive disclosure | A basic print dialog reveals specialist settings on demand | Show the current result and a few useful controls; disclose sources, methods and advanced options when requested |
| Clear expectations before acting | A link label indicates the page it will open | Prefer “Compare selected papers” to “Continue”; show what information/action the next region will contain |
| Stable objects and spatial continuity | A spreadsheet keeps the selected cell while formulas recalculate | Preserve object IDs, selected items, focused text, scroll position and user edits during AI updates |
| Multiple representations of the same data | Calendar day/week/list views | Switch table/chart/timeline while retaining selection, facts, annotations and provenance |
| Externalize work and memory | A design canvas keeps alternatives visible | Pin candidates, retain intermediate results, and branch from a version without reconstructing a conversation |
| Adjustable initiative | Autocomplete offers a completion but waits for acceptance | Offer a small number of reversible suggestions; explicit input and approvals determine commitments |
| Show actual effects and support recovery | Undo, Back and document version history | Separate draft/applied/stale/failed work; distinguish restoring a view from undoing an external action |

### Primary and authoritative foundations

- [NN/g: Memory Recognition and Recall in User Interfaces](https://www.nngroup.com/articles/recognition-and-recall/) explains why visible choices can reduce memory demands. [Apple's search design session](https://developer.apple.com/videos/play/wwdc2026/292/) specifically recommends relevant predictive suggestions, a clear distinction between entered text and predictions, and a limited suggestion set.
- [Shneiderman: Dynamic Queries for Visual Information Seeking, 1994](https://www.cs.umd.edu/~ben/papers/Shneiderman1994Dynamic.pdf) describes rapid visual updates in response to sliders and selections. Its central lesson is incremental exploration and visible consequences, not an LLM request per gesture. Its approximately 100 ms update objective concerns those dynamic-query interactions, not a universal deadline for AI generation.
- [Beaudouin-Lafon: Instrumental Interaction](https://perso.lisn.upsaclay.fr/mbl/INSTR/eintroduction.html) treats tools as mediators between people and domain objects. Our application is to make generated controls reusable instruments over persistent results.
- [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) and [Information Scent](https://www.nngroup.com/articles/information-scent/) explain why secondary detail can remain available without dominating the initial view, and why labels must communicate what follows a click.
- [Microsoft HAX guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/) provide an evidence-based checklist spanning initial use, ongoing interaction, errors and adaptation. Use them when reviewing the prototype, including correction and recovery, rather than evaluating only the attractive success path.

## Research directly related to generated screens

### Jelly: evolving task data and malleable interfaces

[Generative and Malleable User Interfaces with Generative and Evolving Task-Driven Data Model, CHI 2025](https://arxiv.org/html/2503.04084v1) is particularly relevant. Jelly combines prompting and direct editing over an evolving data model, with traceable versions and switchable list/table/map representations. Its eight-participant exploratory study supports investigating this interaction; its pipeline primarily used generated data. It does not establish trustworthy real-world retrieval or production performance.

LocalMind implication: preserve task objects and data independently of their current representation. Generate and revise the view over those objects. Treat sourcing actual information as a separate requirement.

### Generative Interfaces for Language Models

[Chen et al., Generative Interfaces for Language Models](https://arxiv.org/html/2508.19227v1) uses structured interaction flows and component state machines to guide interface generation. Its evaluation uses pairwise human preference judgments, not a deployment study of long-running autonomous work. Some conversational baseline artifacts were removed. Avoid translating preference results into claims of productivity or claiming every answer needs a custom interface.

LocalMind implication: specify how an interface behaves, not only how it looks. A generated control needs defined inputs, allowed events, state transitions and error handling.

### Google's click-to-generated-screen prototype

[Simulating a neural operating system with Gemini 2.5 Flash-Lite, June 2025](https://developers.googleblog.com/en/simulating-a-neural-operating-system-with-gemini-2-5-flash-lite/) is a close example of the proposed interaction. It sends structured click/input events and interaction traces to generate subsequent screens. The prototype also describes caching generated screens to preserve session consistency. It is a simulated operating system; a rendered Save button is not evidence of a real save operation.

LocalMind implication: model a click as a semantic event over known objects, retain revisitable state, and connect any real action to host-owned capabilities.

### Google Research: generative UI

[Generative UI: A rich, custom, visual interactive user experience for any prompt, November 2025](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/) describes generated tools, simulations and tailored visual experiences. Its reported preference evaluation explicitly excludes generation speed. It supports exploring task-specific interfaces, not promising instant generation on our M3.

LocalMind implication: allow generated task surfaces, but measure waiting time and correctness as well as visual preference. Simple text can still be the appropriate result.

### Pointing plus language

[PUMICE, UIST 2019](https://arxiv.org/html/1909.00031v1) combines language with GUI demonstrations to resolve unclear concepts and tasks. It is a bounded mobile-agent study, not proof that arbitrary cursor motion communicates intent reliably.

LocalMind implication: allow “make this shorter” over an explicit selection or “use these” over selected files. Use selection, focus and deliberate gestures as context. Hover alone is exploration, not an instruction or permission.

The earlier [interactive workspace research](INTERACTIVE_WORKSPACE.md) adds DirectGPT, DynaVis, Data Formulator 2, AI Chains and Graphologue. Together they motivate scoped edits, persistent controls, lineage, editable intermediate results and non-linear exploration.

## Four implementation levels

| Level | What the AI supplies | Suitability now |
| --- | --- | --- |
| Adapt existing views | Content, choices, recommended actions | Start here; native, bounded, easy to validate |
| Compose trusted components | A declarative arrangement of tables, fields, charts and previews | Next step; expressive task surfaces with host-owned behavior |
| Generate a small application | HTML/CSS/JavaScript or another executable program | Later optional experiment requiring execution isolation, explicit capabilities and separate evaluation |
| Generate pixels/whole screens continuously | A learned or simulated visual environment | Research reference; not a substitute for real tools, accessible semantics or durable state |

Recommend the first two levels for M1b. AI-generated composition can still feel new and responsive without compiling arbitrary SwiftUI or rebuilding an entire screen after each click. Keep navigation, model/privacy controls, source inspection, Undo/Back and approvals in predictable native locations. Expand unknown tasks through text rather than fabricate a working control.

[A2UI's official overview](https://a2ui.org/concepts/overview/) describes catalog-validated UI descriptions, native rendering, local bound-state changes and action messages returning to the agent. [AG-UI](https://docs.ag-ui.com/introduction) addresses the event connection between frontend and agent, rather than defining the same UI-description layer. Evaluate their patterns or a narrow compatible subset; no library adoption or SwiftUI implementation quality is validated here. Neither protocol is the permission broker or a required second agent.

## Example experience: a research workspace

1. Type “Find research about interactive AI interfaces.” Useful suggestions reveal possible scopes such as examples, evaluation methods, or papers. User-entered words remain distinct from suggestions.
2. Begin the task. Retrieved results appear as persistent objects with citations. Missing constraints remain editable inline rather than triggering a full questionnaire.
3. Select two papers. A clear “Compare selected papers” action becomes available. Clicking it creates a comparison region while the source list and selections remain.
4. Click a comparison criterion and type “focus on latency and user control.” Update that region using the same selected objects and evidence; do not start a visibly separate conversation.
5. Switch the comparison from table to a relationship view where appropriate. Preserve facts and source links. A presentation switch does not require another model call when existing data is sufficient.
6. Edit an earlier constraint or replace a selected source. Invalidate dependent comparisons, keep independent work, and show which updates are pending.
7. Pin the useful result. Export only through an actual supported operation and the relevant permission/approval flow.

This is a product illustration, not an implemented web-search capability. Keep M1b.1's small synthetic CSV as the first technical acceptance scenario; it tests the same selection, editing and view-update contract with fewer confounding tools. Use real research retrieval later in M3.

## Proposed interaction contract

```text
Text / selection / click / edit
              ↓
Semantic event + object IDs + base revision
              ↓
LocalMind task store and event router
  ├─ deterministic view/data change → native update
  ├─ new interpretation/work → single agent → validated artifact/UI patch
  └─ external action → permission broker → restricted tool → verified result
              ↓
Updated region, preserved task context and inspectable history
```

Use semantic actions such as `compareSelected`, with object IDs and current values. Do not infer every click afresh from a screenshot or ship a raw pointer stream to a cloud model. Text editing, selection and clicks are inputs to the same task state. Backend generation requests can still have boundaries; users need not experience them as alternating conversational turns.

Persist canonical task state and ordered events outside the model context window: objects, revisions, current constraints, explicit choices, unresolved questions, resource grants and provenance. Keep exact user edits authoritative. Build bounded model context from current state, relevant evidence and selected history; summaries are aids, not substitutes for source records. Keep persistence local by default, define retention/deletion, and expose a way to inspect and correct saved context. Background context must not mean unbounded memory or undisclosed cloud transmission.

Generated patches must name a base revision and stable target IDs. Validate component types, payload bounds, references and actions before mounting them. Incomplete streamed descriptions can show placeholders, but must not enable an unvalidated action. Reject or recompute conflicting patches; never overwrite a focused user edit. Preserve source/version links so a polished visualization cannot disguise unsupported facts.

Maintain separate feedback speeds: acknowledge the user's gesture immediately, apply deterministic changes locally, and show honest pending state for model/tool work. Coalesce semantic preview requests and discard stale output. Cancellation must stop applicable pending work; no inference-speed guarantee follows from an interactive frontend. Existing cloud consent at Send does not cover automatic draft upload or continuous background observation.

## Design experiments and evaluation

Extend M1b.1 with one stable artifact surface, an explicit selected object, one click-generated region, and a text edit scoped to that region. Use labeled fixtures before real inference. Test whether users understand what each action will do, can find the same object after updates, and can return to a prior version without losing edits.

Compare chat-only, a fixed interactive view, and a generated-composition view on identical tasks. Measure correctness, completion time, recovery, model/tool latency, user editing effort, wasted work, unintended actions and request cost. Count clicks and chat messages as descriptive metrics, not success by themselves: fewer messages can still mean worse understanding. Evaluate suggestions for relevance, correction effort and distraction. Include wrong suggestions, stale revisions, denied actions, unavailable tools, keyboard navigation and VoiceOver.

No interaction benchmark or generated-UI latency has been measured. The existing local 27B throughput baseline remains unchanged. Fully generated executable interfaces are not required to complete this milestone.
