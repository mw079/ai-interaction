# Interactive task workspace: research and next milestone

Research/design proposal: 2026-11-17. This document specifies planned work; it does not describe an implemented agent or a tested Codex integration.

Follow-up: [continuous interaction and generative-interface research](GENERATIVE_INTERACTION_RESEARCH.md) expands the product direction to clicks, selections, direct editing and task-specific generated views. Keep the workspace as the primary interaction surface and chat as an optional input/history view.

## Recommendation

Design the SwiftUI workspace and agent contract together. Make the shared object a versioned task, containing the user's current instructions, unresolved choices, selected resources, work in progress, and artifacts. A transcript is useful history, but cannot be the only source of task state.

Prioritize M1b: one working interaction from editable intent through an interactive result. Evaluate Codex as a reusable cloud execution engine before building another general coding harness. Own LocalMind's task state, native component catalog, permission broker, and evaluations. Retain the existing local 27B path and one active agent. Reusing an engine is compatible with owning the product's behavior and enforcement boundaries.

The existing app has local/cloud text generation and selected-file attachments. It does not yet have active-task revisions, tool execution, mid-generation edits, a component schema, or an OS-enforced agent sandbox. Update: live valid-key Luna text and JSON smoke checks now pass; see the report (archived in `~/Documents/CS/ai/projects/localmind-swift-archive-2026-11-19.zip`). Agent/tool and interaction acceptance remain pending. UI/source inspection, not a new inference benchmark, informed this proposal.

## What to borrow from the reference

Bruce Liu's [Beyond Taking Turns](https://demos.liubruce.me/intra-turn/) separates two interactions:

- [Feedforward](https://demos.liubruce.me/intra-turn/app.html): expose the interpretation before execution. During inspection, the trip example offered an editable answer-format choice, including itinerary, ideas, route, and a custom answer.
- [Leaving Blanks](https://demos.liubruce.me/intra-turn/blanks.html): represent missing details as inline controls that can be answered without a new chat exchange.

These are useful design demonstrations, not evidence that continuous inference will be fast on our M3. Adopt their interaction principles rather than promise their apparent latency.

Three different uncertainties need different responses:

| Uncertainty | LocalMind response |
| --- | --- |
| User intent: audience, desired comparison, destination | An editable choice or blank; preserve the user's answer |
| Facts: whether a claim is supported | Retrieve/check evidence and expose its source; do not ask the user to guess |
| Execution: whether a tool action succeeded | Observe and verify the outcome; show failure/recovery honestly |

Ask when the answer changes consequential or expensive work. A missing audience need not block calculating a table; a missing destination must block exporting it. Mark reversible defaults as assumptions. Do not turn every prompt into a questionnaire or invent confidence percentages.

## Research that adds useful interaction ideas

The applications below are design proposals for LocalMind, not features validated by those studies. Results from bounded editing and visualization tasks do not establish success for a general autonomous assistant.

| Primary resource | Research contribution | Application to LocalMind |
| --- | --- | --- |
| [DirectGPT, CHI 2024](https://arxiv.org/html/2310.03691v2) | Direct manipulation of persistent outputs, scoped edits, reusable commands, and undo; a 12-person editing study | Select a paragraph, chart element, or file and apply an instruction to that object. Keep other user edits intact. |
| [DynaVis, CHI 2024](https://arxiv.org/html/2401.10880v1) | Persistent widgets for repeated visualization edits, combining language with direct feedback; 24-person study | A request such as “compare by team” can introduce a reusable grouping control. Subsequent presentation changes update locally without another model request. Use trusted native components rather than arbitrary generated widget code. |
| [Data Formulator 2, CHI 2025](https://arxiv.org/html/2408.16119v2) | Blended graphical/language input and data threads for revisiting and extending analysis; eight-participant study | Preserve artifact versions and transformation lineage. Revise an earlier choice or branch an analysis without losing the original. |
| [AI Chains, CHI 2022](https://arxiv.org/abs/2110.01691) | Editable intermediate results and modular steps; 20-person study | Let users correct the extracted facts or comparison criteria before regenerating the dependent summary. This does not require multiple agents. |
| [Graphologue, UIST 2023](https://arxiv.org/abs/2305.11473) | Interactive diagrams as a non-linear way to explore generated explanations | Use a diagram when relationships matter. Selecting a node scopes a follow-up. Attach evidence; generated structure is not proof of correctness. |
| [Magentic-UI, Microsoft Research, 2025](https://www.microsoft.com/en-us/research/blog/magentic-ui-an-experimental-human-centered-web-agent/) and [CowPilot, 2025](https://arxiv.org/html/2501.16609v1) | Editable plans, human participation, and handoff during browser work | Show the actual controlled session and provide takeover/resume with fresh observations. Borrow the interactions, not Magentic-UI's multi-agent architecture. |
| [Horvitz, Principles of Mixed-Initiative User Interfaces, CHI 1999](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/chi99horvitz.pdf) | Combine direct control with automation while considering intent uncertainty, interruption costs, and correction | Let people change the level of involvement. Ask focused questions at useful moments; make stopping and refining easy. These are foundational principles, not contemporary LLM performance results. |

Also relevant is [Interaction, Process, Infrastructure: A Unified Framework for Human–Agent Collaboration](https://www.microsoft.com/en-us/research/wp-content/uploads/2025/12/Human_Agent_Framework.pdf). It argues for inspectable process representations connecting interface and infrastructure. It is a conceptual framework, not evidence that a particular interface works. Its discussion of representation overhead is a useful caution: expose the few decisions the user needs, not an obligatory workflow graph.

## Proposed native interface

Keep the current compact composer, model control, and ordinary chat. Add a workspace view for tasks that benefit from persistent objects:

1. **Editable instruction:** the current goal remains editable while work runs. Apply updates explicitly; chat remains available for additional guidance.
2. **Interpretation:** a short sentence with only relevant inline choices and visible assumptions. Hide additional settings until needed.
3. **Working result:** a persistent document, table, chart, file preview, or browser surface. Work updates the affected object instead of continually appending replacement answers.
4. **Compact activity:** show actual steps, pending questions, and whether a change is pending or applied. Keep the detailed event history behind disclosure.

Avoid a permanent wall of panels or floating cards. Continue the approved quiet label/value styling. Use color for a small set of meaningful states, with text labels. Hover previews must also open through focus/click, allow scrolling and pinning, and restore the previous view on dismissal. No essential action should depend on hover.

Start the component catalog with `IntentField`, `InlineChoice`, `TaskActivity`, `SourceReference`, `FilePreview`, `ResultTable`, and `ChartSpec`. Add change review and browser ownership when their enforcement/tools exist. The model may suggest a validated descriptor; host code chooses a trusted renderer and owns action handlers. Unknown components, oversized payloads, and invalid references fail safely. Model content cannot mint resource grants or render its own approval dialog.

Use Swift Charts for the first supported chart types. Changes to sorting, display grouping over already computed data, or chart presentation should be deterministic whenever possible. Changing the analytical question may require another model/tool step and should say so. Visualizations should clarify data or relationships; text remains appropriate for simple answers.

## Editing earlier text and steering

Separate the living instruction document from the immutable event history. Each applied edit creates a new revision with a stable ID. Historical messages remain accurate records; the user may edit the current task or explicitly branch from an earlier revision.

The UI must distinguish **draft**, **queued**, **applied**, **stale**, and **completed**. An acknowledged edit is not necessarily already influencing the model. Never overwrite a focused field with a generated suggestion. Preserve user changes, cursor position, and scroll position.

Tie every pending result and action to its input revision and dependencies. When instructions change, invalidate affected pending work; retain independent valid results. Older output can remain in history, but cannot silently replace the current artifact. An edit cannot undo a tool action that already occurred. External undo requires a real compensating operation and permission; restoring a UI version alone is insufficient.

Keep one agent and serialize local model computation. Initially, local steering can cancel and restart at a verified safe boundary using the latest task state. Do not promise live insertion into PrismML's ongoing decoding. The current Stop unloads the model, so a cheaper cancellation path is a separate implementation/measurement task.

For feedforward, first provide an explicit Preview action. Later test coalesced typing-pause previews, discarding superseded requests. Native text editing should remain immediate even when a model preview takes seconds. Cloud previews before Send change the privacy contract: they transmit draft text. Keep them off by default and require a clear opt-in describing what goes to OpenAI; existing Send consent does not cover this behavior. Do no external work merely because someone starts typing.

## Reuse Codex or build a harness?

Start with an integration experiment, not a second general coding agent. OpenAI presents Codex as a reusable harness and distinguishes task automation from richer client integration in [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform).

[Codex app-server](https://learn.chatgpt.com/docs/app-server) supports custom clients through bidirectional events, approvals, user questions, and active-turn steering. Its default stdio JSON-lines transport fits a Swift child process. Treat question handling and steering as primitives; they do not automatically implement non-blocking blanks or editable artifacts. Pin the protocol/version and audit its authentication persistence before assuming LocalMind's Keychain-only credential policy carries over.

[Authentication documentation](https://learn.chatgpt.com/docs/auth) supports API-key access for local Codex work, billed through the API organization. This is distinct from ChatGPT subscription access. An API key does not give LocalMind all capabilities of the Codex desktop application. Inspect actual model/tool availability; do not assume browser or macOS control comes bundled. Verify Luna availability and a real response with the user's configured credentials before claiming acceptance.

The local path remains a separate adapter. Our PrismML endpoint is Chat Completions-based; Codex integration requires compatible Responses behavior, not merely an OpenAI-shaped endpoint. [Gateway compatibility requirements](https://learn.chatgpt.com/docs/enterprise/gateway-compatibility) make that distinction explicit. Neither Bonsai tool-call reliability nor a Codex-to-PrismML bridge has been validated here.

An alternative is extending the direct OpenAI adapter: [Responses mid-turn steering](https://developers.openai.com/api/docs/guides/steering) uses a WebSocket and distinguishes queued guidance from its application in a successor response. It cannot erase previous output or undo started tools. Our current HTTP streaming adapter does not implement it. This route entails more harness work; evaluate it if Codex's extension/enforcement boundaries do not fit.

Proposed separation:

```text
SwiftUI workspace + trusted component catalog
                    ↕
LocalMind task store: revisions, dependencies, artifacts, events
                    ↕
TaskRuntime adapter (one active agent)
  ├─ Codex app-server: cloud integration experiment
  └─ local runtime: existing inference + bounded task loop
                    ↕
LocalMind permission broker → restricted tools/workers
```

Keep `InferenceBackend` for model generation. Add a distinct `TaskRuntime` contract for start, update, answer-choice, cancel, observe events, and report capabilities. Normalize provider events into task-level IDs/revisions, artifact patches, missing-input requests, and action proposals. Backend differences remain visible through capabilities instead of pretending all models steer identically.

All actual execution paths must respect the permission boundary. A broker is ineffective if an embedded agent can bypass it with shell, filesystem, network, or alternate tools. Start with synthetic/read-only fixtures and no unrestricted execution. Audit Codex's tool routing and OS restrictions against M2 before enabling user-resource access; configuration allowlists alone are not an OS sandbox. Stage changes and bind approval to the exact operation/content/version. Revisions invalidate affected approvals. No permission is granted through a timeout.

## Next increments and acceptance

### M1b.1 — Design contract and synthetic SwiftUI workflow

Use one small, public/synthetic CSV. Request: “Compare workload across teams and make a short summary.” Show an editable interpretation, a choice of hours versus completed tasks, and an unresolved audience field. Compute the table independently of the audience; defer audience-dependent prose. Render a source preview and a supported chart.

While simulated work is running, change the instruction and fill the blank without sending another chat message. Keep the source and unaffected results. Change chart presentation directly, inspect the source, and restore/branch a prior revision. Label all fixture-driven behavior as simulated; no model or agent claim yet. This replaces the earlier PDF-organization prototype as the first design scenario because it tests the requested visualization interactions more directly. File organization remains a later M2 scenario.

Acceptance: editable input during activity; no lost edits or focus stealing; visible draft/applied/stale states; targeted artifact updates; keyboard/VoiceOver access; ordinary chat retained; no user-file mutations. Aim for under 100 ms native feedback on deterministic controls and measure it rather than claim it from this document.

### M1b.2 — Engine integration experiment

Test a pinned Codex app-server in an isolated configuration without importing the user's existing Codex sessions or credentials. Check initialization, model listing and configured-key auth, streaming, active-task updates, inline questions, and host-tool integration. Verify denied requests stay denied and credential handling meets LocalMind's policy. Use synthetic resources first. Live cloud checks depend on a valid key; the synthetic UI milestone does not.

Record a go/no-go decision for Codex and the local compatibility gap. Keep the existing local chat path operational. Do not silently substitute a different cloud model or route local content to the cloud.

### M1b.3 — Real model task and minimum M2 grants

Connect the same workspace contract to a real cloud run, then the 27B adapter with its supported cancellation/restart behavior. Supply only explicitly selected, bounded resource snapshots. Record actual structured-output reliability and recovery. No unrestricted shell, filesystem, browser profile, or writes in this slice.

Done when both backends can complete the scenario with their actual supported semantics, inline answers and revisions work, stale output cannot win, and no unauthorized effects occur. Report each backend independently; a scripted preview is not real-model acceptance. Follow with M2 write review and M3's bounded web/browser workflow using the same task contract.

### Interaction evaluation baseline

Before comparing interfaces, freeze the same CSV, task, model settings, and correctness rubric. Record task completion time, time to useful preview, corrective chat messages, lost edits, stale updates, wasted/recomputed model work, request/token cost, and permission failures. Compare ordinary chat with the workspace on the same tasks. No numerical interaction baseline has been measured yet. A small formative usability study can identify problems, but cannot support broad productivity claims.

Keep the existing 5.54 tok/s local decode baseline unchanged. The experimental 10 tok/s target is separate from this interaction milestone.
