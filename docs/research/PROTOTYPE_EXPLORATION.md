# Interaction prototype exploration

2026-11-17. These are interactive browser-based concept studies, not implemented SwiftUI app features. All model-like additions use fixed sample data; no API calls, key access, real tools, or user-file changes occur in them.

## Three concepts available for comparison

The concepts use the same small workload fixture: Studio 12 hours/6 tasks, Research 18 hours/4 tasks, Support 9 hours/9 tasks. This keeps the interaction differences easier to assess.

| Concept | Interaction | Main design question |
| --- | --- | --- |
| Living document | Edit a note; request a sample table or process diagram; accept, discard or undo the addition | Does the document feel like shared work while user edits remain authoritative? |
| Selection workspace | Select teams; reveal a comparison; change its measure locally; annotate the result | Can pointing and clear actions replace corrective chat messages? |
| Composable canvas | Type a component hint; insert a sample table, diagram or checklist; add notes, reorder and remove blocks | Does an evolving workspace help users discover what they want without an initial complete specification? |

The concept collection is response content in the thread-scoped visualization directory, named `localmind-interaction-concepts.html`. It does not modify the running LocalMind app. Document/review state and selection/measure/annotation state can be restored by the conversation host. Canvas blocks remain session-only. Suggested components are keyword matches over a fixed catalog, not semantic interpretation by Luna. The accepted addition is local sample state, not a saved file. The diagram represents a review process, not measured workload or model reasoning.

Verified in the browser: document Suggest → Accept exposes the table and Undo; selection Compare exposes the selected rows; switching Hours to Completed tasks changes 12/18 to 6/4; typing diagram narrows available components; adding Review diagram creates the process block and editable note. Canvas layout inspected visually. This is functional concept verification, not a native accessibility review, latency benchmark, or real-model acceptance.

## Additional directions to explore

1. **Decision path:** choose among meaningful alternatives; reveal only the next relevant comparison or question. Back restores the previous branch. Avoid a rigid questionnaire or trapping people in system-proposed choices.
2. **Parameter studio:** the AI creates a reusable set of controls for a task. Sliders and selectors adjust a chart or simulation locally; language changes the analytical question or introduces a new parameter.
3. **Preview lens:** select or focus a source and inspect its evidence beside the current work. Pin useful material; dismissal restores the previous pane. Explanation remains an explicit action over granted content.
4. **Live intent strip:** a short, editable interpretation appears as a user types. Confirmed constraints and unresolved choices remain distinguishable. Begin with explicit Preview; any cloud drafting before Send needs a separate opt-in.

The three working concepts are deliberately distinct interaction experiments, not merely three visual themes. Start with the Living document and Selection workspace as the leading candidates; combine only the useful behaviors after review. The canvas is a broader exploration, not an instruction to build a general-purpose Notion clone.

## Reuse components and generate small changes

Prebuild native tables, charts, diagrams, editable blocks, choice fields, source previews and review controls. Define a small set of task templates that compose them. The model supplies validated data, suggested composition and targeted revisions instead of regenerating an entire interface or executable program.

For example, a diagram response can name supported nodes/edges and source references; the app handles layout and interaction. A table response can name columns and data references; sort and selection stay local. Keep a text fallback for an unsupported request. Unknown actions cannot become executable buttons merely because a model describes them.

This can reduce generated output and preserve predictable behavior. It is not a measured speed improvement yet. OpenAI's [latency optimization guidance](https://developers.openai.com/api/docs/guides/latency-optimization) recommends reducing unnecessary generation and avoiding model work where conventional code suffices. [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) remains the explicitly chosen cloud model; measure the actual product workload rather than promise a response time.

## API acceptance and next steps

After the user added the key and unlocked the Mac, the native connection check and two real Luna generations succeeded. A sample summary was correct; a component-shaped JSON response parsed successfully. The app showed 3.9 s / 5.1 s for the Medium summary and 2.6 s / 3.1 s for Off JSON (first visible answer / total). See the live smoke report (archived in `~/Documents/CS/ai/projects/localmind-swift-archive-2026-11-19.zip`) for evidence and limits. These are not repeated or matched latency baselines. No credential was displayed or extracted.

The user's subsequent note prioritizes human intent. The next experiment should be an [Intent preview](INTENT_PREVIEW.md): interpretation alternatives and a useful inline question while a request develops. Keep the three existing studies for comparison. A live model-driven preview, native shared task state, and schema-constrained UI updates remain unimplemented.

Keep three stages separate: choose an interaction using deterministic studies; implement a small native SwiftUI slice; then connect real Luna generation and measure structured-output reliability, revision handling, cancellation and latency. Preserve local 27B availability.
