# Atlas component library

The model selects up to two visual blocks per page. A block has a stable `id`, a supported `type`, a title, a `prompt`, 2–6 items (`label`, `detail`, numeric `value`, and `latitude`/`longitude`, which are null except for maps), and up to eight indexed connections (`from`, `to`, `label`). The server validates this contract; the browser maps it to trusted renderers. No generated HTML, event handlers or model-supplied code is executed.

There are 18 block types:

| Type | Use it for |
| --- | --- |
| cycle | Repeated steps, such as the Feynman technique; select a step to reveal its explanation |
| graph | Explicit relationships; select nodes or labelled edges to explore connected concepts |
| timeline | Ordered events; select one to see its detail |
| comparison | Alternatives; select one to inspect its explanation |
| chart | Supplied or justified numbers only; select categories for exact values, with a zero baseline for signed values |
| worked_example | Selectable worked steps plus optional learner practice and feedback |
| practice | A learner explanation activity with two or more prompts or self-check hints and a feedback field |
| hotspot_diagram | A clickable labelled diagram whose edges show real connections |
| parameter_explorer | Varying one numerical input; items are 2–6 scenarios in increasing order with supported outcomes |
| prediction | One question with 2–6 answers, exactly one correct, each with an explanation |
| decision_tree | One rooted tree from item 0; edge labels are branch choices |
| before_after | Two items in before/after order |
| hierarchy | One rooted tree from item 0 |
| sorting | Category headings (value 1) and examples (value 0), each example linked to its correct group |
| function_plot | One of linear, square, cube, absolute or sine, over a numeric domain within −100 to 100 |
| evidence | Claims linked to provided sources; never invented evidence |
| map | Places with accurate latitude and longitude |
| linked_scenarios | One shared parameter with two named outcomes per input value |

Dedicated Kepler and projectile renderers remain available for their specific trusted simulations. The generic families are intentionally bounded; they are not an arbitrary chart editor or generated website runtime. Visuals are preferred where they help explain the request; text-only remains appropriate for writing tasks.

## Slide format recipes

`SLIDE_RECIPES` defines 20 slide formats that the composer can offer (up to three at a time) before Send: cycle, example, practice, relationships, timeline, compare, chart, hotspots, parameter, prediction, decision, reveal, hierarchy, sorting, function, evidence, map, scenarios, orbit and projectile. The user can pick one or let Terra decide.

## Where the code lives

The schema, validators, recipes and model-facing descriptions live in `public/component-catalog.js`. `public/component-renderer.js` sets up each block and its local state; the per-type renderers are in `public/slide-interactions.js` and `public/slide-extensions.js`. Components use plain DOM/SVG and the existing Atlas style, with no new framework dependencies. Add a new type to the schema, validator, descriptions and renderer together. Component IDs must stay stable when a model proposes modifying an existing block.

## Questions and changes

- Typing directly in page text is a user edit, not an instruction to the model. It no longer triggers automatic proofreading.
- Each editable passage and component has **Ask or change this**. This opens an attached field explicitly labelled **Your question or instruction**. The request carries instruction and target content in separate fields. Selected text and learner practice are additional quoted context, not accepted model prose.
- After a 700 ms pause, Luna answers the question. It may also propose a replacement passage or component. It must not copy the question into the replacement or merely correct its grammar.
- Proposed text appears as an inline diff with insertion/deletion colours; components preview on a labelled proposal surface. Accepted page data is unchanged. **Original** compares the old text, **Reject** discards the proposal, and **Apply** creates an undoable page version.
- Preview component controls operate on separate temporary state. Applying merges validated blocks by ID, within the two-block limit. Page edits, newer instructions, navigation or disconnected targets invalidate old proposals. Apply verifies the original target and page revision again.
- Back/Forward can undo and restore an applied text or component change. Page versions remain tab-local.
