# AI Interaction

Current state as of 19 November 2026. The earlier milestone log (PLAN.md) is archived with the retired SwiftUI app in `~/Documents/CS/ai/projects/localmind-swift-archive-2026-11-19.zip`.

## Product direction

AI Interaction is the active web prototype. Its goal is to let people work with AI while a thought is taking shape, then turn that thought into an interactive page they can explore and edit. The SwiftUI LocalMind app has been retired and archived.

| Moment | User experience | Model |
| --- | --- | --- |
| While writing | A brief live answer, one useful question, and contextual choices on highlighted phrases | GPT-6 Luna |
| On Send | A fuller Atlas page shaped by the draft, confirmed choices, and any selected slide context | GPT-6.1 Terra |
| Inside the page | Explore a visual directly, select text for an explanation, or review a suggested change | Local controls and GPT-6 Luna |

These paths share one composer and workspace. Send is a deliberate request for a more substantial result. Slider moves, tab changes, and other direct controls respond immediately in the browser. The surrounding page gives “this paragraph” or “this diagram” a concrete meaning.

## Composer

- The opening screen has an empty, centered composer and a visible disabled Send arrow. After a page is generated, the composer docks below it. Focusing the composer makes the slide slightly smaller. Returning to the slide restores its reading area.
- **Live questions** appear above the field. Luna can ask for clarification or suggest a useful next direction. **Live answers** stream underneath in a brief form. The previous answer and still-relevant question stay visible during an update. New text gets a short, muted accent fade that respects reduced motion. Recognized answers in the draft retire their question, and a clearly unfinished comparison waits for its second subject.
- A **word-count trigger** lets help arrive during continuous typing. The first checkpoint is four completed words. Further checkpoints need four more words and at least 1.2 seconds since the previous request started. The composer keeps at most one preview in flight. It also refreshes on a 100 ms sentence-boundary pause or a 250 ms ordinary pause. Compatible additions allow a request to finish. A change of direction invalidates old work. Exact repeats can use a 20-entry memory cache.
- **Highlighted phrases** open contextual controls with reusable templates and model-supplied choices. Selecting an anchored choice inserts a parenthetical value beside the phrase, keeps the highlight editable, closes the picker, and returns focus to the draft. Unanchored choices travel as background context. A visible picker can accept a choice during a live refresh if its original phrase still matches.
- The school-level audience picker is a compact list with **Middle school**, **High school**, **University**, and **Type your own answer**. Custom entry opens on demand. A disappeared phrase closes its picker quietly.
- A small **Review intent** icon opens the summary and its Edit action. Editing the intent guides the live preview and Send. The full sentence lives inside the card.
- **Autocomplete** is optional to use. Ghost text stays distinct from typed text, Tab or its button accepts it, and Escape dismisses it. Long suggestions move below the field without resizing it. Repeated suggestions stay out of the draft.
- When the format matters, the composer can offer **up to three slide formats** from the library. The user can choose one or let Terra decide. Highlighting text in the composer can also request a focused explanation.

## Atlas interactive pages

- **Generation UI** shows “Creating…” with a small activity indicator and elapsed seconds after three seconds. The first slide opens without an empty card or placeholder title. During a follow-up, the current slide remains visible and notes are tucked away while Terra works.
- A page can combine editable prose and up to two validated interactive blocks. The library also has dedicated Kepler and projectile simulations. A text-first request can return prose. The model supplies content and chooses a component type, and the browser owns the renderer, controls, and behavior.
- **Kepler** has adjustable eccentricity and orbital phase, an equal-areas visualization, law controls, typeset MathML, and a disclosure for the full orbital-period equation. The overview presents three short editable takeaways under bold labels. They sit in columns on desktop and stack on narrow screens. MathML currently covers the built-in Kepler formulas.
- **Direct editing** works on slide text and in **Your notes**. Typing or highlighting triggers Luna after 250 ms. Answers stream near the selected or edited passage and render short lists and bold emphasis. Ordinary wording changes can stay quiet.
- **Rewrite review** distinguishes a question from a rewrite instruction. When a rewrite follows an earlier question in the same passage, Luna receives the latest instruction separately and the question as context. Apply and Reject appear only for a complete, current proposal. Typing again cancels the old stream and clears its controls. Slow explicit rewrites show “Preparing edit…” beside the target.
- **Apply** installs the change as a new page version and returns focus to the edited field. **Reject** preserves the exact typed text. If Luna returns both an explanation and an edit, the explanation appears first and **Review edit** opens the proposal.
- **Undo** reverses direct typing bursts. **Back**, **Forward**, and **History** restore versions and interactive state within the tab. Applying from an older page can preserve displaced newer versions in History. **Focus** can scope the next Send to a passage or component, and scoped updates keep the edited area visible.
- **Layout:** the first screen holds the answer (title, one-sentence intro, visual, caption); the window scrolls for takeaways and **Go deeper** tabs, whose short answers are prefetched in one Luna request and can be promoted to a full slide. An empty composer on an open page is a one-line bar. Choosing a step in a diagram is view state and never invalidates a pending follow-up.
- **Reload** intentionally returns to the empty composer and clears the workspace. JSON export offers a copy of the current page data. An import flow is a separate future decision.

## Component libraries

| Library | Inventory | Examples and purpose |
| --- | --- | --- |
| Composer | 28 information types across 16 reusable control families, plus the slide picker and Focus | Choices, preview cards, search, numeric and date controls, editable lists, a depth slider, tone previews, flexible dates, area maps, assumptions, goal comparisons, audience and prior knowledge, examples, include/exclude, and trade-offs |
| Atlas | 18 composable block types plus 2 dedicated simulations and 20 slide format recipes | Cycles, graphs, timelines, comparisons, charts, worked examples, practice, clickable diagrams, parameter explorers, prediction, decision trees, before/after, hierarchies, sorting, function plots, evidence, maps, linked scenarios, Kepler orbits, and projectile motion |

Composer information types also cover response format, goal, length, language, time, duration, location, geographic scope, budget, quantity, priorities, requirements, exclusions, and comparison options. A model response can reference a type and propose values. The app validates the descriptor and renders the matching control. [Composer types](public/intent.js) · [Atlas catalog](public/component-catalog.js)

## Decisions that shape the experience

- **One workspace.** Five composer experiments converged into one UI, and Atlas was chosen from the five slide studies. Live questions and answers are central to the experience. The intent summary opens on demand.
- **Fast help stays lightweight.** Reuse the same slots and exact phrase anchors as the draft grows. Keep the user’s wording visually dominant and preserve it until they choose an edit. A useful clarification should influence the output and disappear once resolved.
- **Visuals have a job.** Use a chart, diagram, or control when it helps someone compare, test, or understand. Reusable components provide stable interactions and validation. The prompt supplies the content and the app supplies the interface.
- **Change is reversible.** Keep the user in control with Apply, Reject, Undo, and version navigation. Proposed edits belong near the object they change, and keyboard focus returns to that object.
- **Test locally first.** AI Interaction is the web product name. Recent work runs on localhost. An older Sites preview was kept private at the user’s request. This work has stayed local.

The research that informed these choices includes [Bruce Liu’s intra-turn work](https://demos.liubruce.me/intra-turn/), [conversational grounding](https://www.cs.cmu.edu/~illah/CLASSDOCS/Clark91.pdf), [specific conversational repair](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0136100), and [direct manipulation](https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf). The project’s own research and design notes are in [docs/research](docs/research).

The visual design takes cues from Jobs’s focus on the user’s task, Apple’s progressive disclosure and feedback, Airbnb’s reusable design language, and Stripe’s clear action hierarchy. In practice that means a quiet canvas, small controls near the thing they change, muted emphasis, and a single prominent action where a decision is required. [Jobs at WWDC](https://allaboutstevejobs.com/videos/keynotes/wwdc_1997_closing_chat) · [Apple design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/) · [Airbnb design language](https://medium.com/airbnb-design/building-a-visual-language-behind-the-scenes-of-our-airbnb-design-system-224748775e4e) · [Stripe UI guidance](https://stripe.com/resources/more/mobile-checkout-ui)

## Implementation, checks, and limits

- The web app is a plain browser UI and a Node loopback server. OpenAI requests go through the server. The local server can use the ignored `.env` file. The web app also supports a per-tab key and labeled demo examples. Model-generated components are schema-validated, and follow-up context is bounded before JSON serialization.
- Luna uses reasoning effort `none` for live help. Terra uses `low` for Send. The API adapter preserves request cancellation, retries eligible temporary failures once, and enforces request bounds. The UI caps a connection at 30 generation attempts. Running the website locally still sends live model requests to OpenAI.
- The current web build has **91 unit checks and 40 browser tests** verified across 1280 and 390 px widths. Fixture tests exercise time, focus, stale results, editing, and layout. Live requests separately check answer quality and perceived latency. The most recent Kepler run kept the old answer and question visible until fresh text arrived and recorded a **480 ms accent fade** on both. It also surfaced a polish opportunity: a fade can begin on a very short streamed fragment, and the same answer can receive a second fade on completion.
- An earlier paired test of the ordinary pause measured median first fresh text at 1.55 seconds with 250 ms and 1.84 seconds with 550 ms. Steady typing made one request either way. Pauses lasting 375 ms started extra requests at 250 ms. That test predates the word-count trigger (now four words), and billing was not measured.
- This folder is its own Git repo. The latest checkpoint is `80b1f47`. Recent web improvements remain in the working tree.
- File attachments are intentionally outside the web scope. Local inference, web research, browser or desktop control, shared workspaces, and a permission broker are future capabilities.

Run the app with `npm run dev` and open [127.0.0.1:4317](http://127.0.0.1:4317/). Use that exact address: the server only uses the `.env` key for `127.0.0.1`, so `localhost` opens in demo mode.

| Command | Purpose |
| --- | --- |
| `npm test` | Unit and API regression tests |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` | Desktop and narrow browser fixtures with installed Chrome |
| `npm run test:luna` | Live Luna checks through the local server with an OpenAI key |
| `npm run build` | Build browser assets and the server bundle |
| `npm run eval:pages` | Live page-quality check: ten prompts, screenshots and design-rule scores ([results](docs/EVALUATION.md)) |

## Deferred work

- Web retrieval, browser automation, local inference, and a permission broker for agent actions would each need their own implementation and evaluation. None is planned for the current milestone.

## Next milestone

**Validate one complete input-to-exploration session.** Use Kepler as the reference flow and Feynman and Kyoto as transfer cases. Type naturally, see a helpful question and answer while writing, choose an option, press Send, then explore or revise the page. Measure how often the user has to repeat a choice, whether the live question changed the outcome, and how long it takes to see useful output.

Two follow-ups are worth testing in that flow. First, keep a selected passage or diagram explicit across Luna’s local answer and Terra’s next Send so “this” carries the same meaning. Second, show a tiny visual preview in the existing format picker when seeing the difference would help someone choose. Draft recovery after a failed Send and a clearer review path for full-page follow-ups remain open.
