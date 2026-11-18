# Atlas component library

The model selects up to two visual blocks per page. A block has a stable `id`, a supported `type`, a title, a practice prompt, 2–6 items (`label`, `detail`, numeric `value`), and up to eight indexed connections (`from`, `to`, `label`). The server validates this contract; the browser maps it to trusted renderers. No generated HTML, event handlers or model-supplied code is executed.

| Family | Current interaction |
| --- | --- |
| cycle | Select a step to reveal its explanation; follow the loop |
| graph | Select nodes or labelled relationships to explore connected concepts |
| timeline | Select an ordered event and see its detail |
| comparison | Select an alternative to inspect its explanation |
| chart | Inspect numerical bars and select categories for exact values/details; signed values use a zero baseline |
| worked_example | Explore worked steps; write a separate learner explanation and ask for feedback |

Existing Kepler and projectile renderers remain available for their specific trusted simulations. The generic families are intentionally bounded; they are not an arbitrary chart editor or generated website runtime. Visuals are preferred where they help explain the request; text-only remains appropriate for writing tasks.

The schema and model-facing descriptions live in `public/component-catalog.js`; rendering and local state in `public/component-renderer.js`. Components use plain DOM/SVG and the existing Atlas style, with no new framework dependencies. Add a new type to the schema, validator, descriptions and renderer together. Component IDs must stay stable when a model proposes modifying an existing block.

## Questions and changes

- Typing directly in page text is a user edit, not an instruction to the model. It no longer triggers automatic proofreading.
- Each editable passage and component has **Ask or change this**. This opens an attached field explicitly labelled **Your question or instruction**. The request carries instruction and target content in separate fields. Selected text and learner practice are additional quoted context, not accepted model prose.
- After a 700 ms pause, Luna answers the question. It may also propose a replacement passage or component. It must not copy the question into the replacement or merely correct its grammar.
- Proposed text appears as an inline diff with insertion/deletion colours; components preview on a labelled proposal surface. Accepted page data is unchanged. **Original** compares the old text, **Reject** discards the proposal, and **Apply** creates an undoable page version.
- Preview component controls operate on separate temporary state. Applying merges validated blocks by ID, within the two-block limit. Page edits, newer instructions, navigation or disconnected targets invalidate old proposals. Apply verifies the original target and page revision again.
- Back/Forward can undo and restore an applied text or component change. Page versions remain tab-local.
