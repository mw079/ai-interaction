# AI Interaction

A small website exploring three connected ideas: understanding intent during input, inline decisions, and a persistent interactive page instead of a sequence of chat replies.

For a current overview of the product, decisions and next milestone, see [STATE.md](STATE.md). Background research is in [docs/research](docs/research).

## Run locally

Requires Node 22 or later. The local app runs without installing dependencies.

```sh
cd /Users/mufwan/Documents/CS/ai/projects/localmind/ai-interaction
npm run dev
```

Open `http://127.0.0.1:4317`. Set `PORT` to use another port. Restart the server after source changes; it builds assets on startup. `npm test` runs the physics and API-boundary checks. `npm run build` creates a dependency-free Cloudflare Worker in `dist/server/index.js`, including browser assets and the Sites manifest.

## Test locally

Install the development dependencies with `npm ci`. Run the browser suite in an installed Google Chrome with `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. To use Playwright's Chromium, run `npx playwright install chromium` once, then `npm run test:browser`.

The browser tests start their own loopback fixture server. They cover wrapped autocomplete and Tab, unfinished comparisons, and focus after selecting a clarification. They also cover slide Undo, reset on reload, optional edit review, focus after Apply, and History recovery after branching, at 1280×720 and 390×720. They use fixed model responses and control the debounce and hover timers.

With the local app running and its OpenAI key configured, run `npm run test:luna` for the separate live smoke test. It checks that Luna's answers address the Kepler, evaporation and Kyoto prompts and reports time to first streamed answer text and completion. The test sends those three sample prompts through the local server to OpenAI. Set `LUNA_BASE_URL` if the app uses a different loopback port.

## Current flow

The empty composer starts in the center. Once a slide exists, it docks below the slide. While typing, one question can appear above the box, with editable intent, optional Tab completion, and a short streamed answer below. Luna first previews after four completed words, then after each four more words once at least 1.2 seconds have passed since the previous request started. It also refreshes after a 100 ms pause at the end of a sentence or a 250 ms ordinary pause. At most one preview is in flight, and the 20 most recent exact drafts are cached. Success does not trigger another request by itself.

Send uses Terra to create an Atlas page. The model can choose up to two composable interactive blocks from a validated catalog of 18 types, including cycles, graphs, timelines, comparisons, charts, worked examples, practice, clickable diagrams, parameter explorers, predictions, decision trees and maps. It can also suggest up to three of 20 slide format recipes. Kepler/projectile requests retain their trusted local simulations. Text-only is valid when that is the better answer. See [component contracts](docs/COMPONENT_LIBRARY.md).

Edit the slide title or a passage directly. After a brief pause, Luna uses the surrounding text and your changes to answer a typed question or propose requested wording. Highlighting text gives a brief explanation underneath. Routine wording edits can stay quiet.

Direct edits can be undone with **Undo** in the slide toolbar. Nearby typing in the same field is grouped, and up to 24 direct edits stay available on that slide until reload. An answer appears first when Luna also offers an edit. Use **Review edit** to see the proposal, then **Apply** or **Reject**. Apply returns focus to the updated passage. If you edit an older version, History keeps the later slides available to restore. The composer’s Focus control limits the next Send to the selected section. File attachments are unsupported.

While writing in the main composer, the page scales to 90%. Returning to the page restores full size and hides composer questions/answers. The page scrolls with the window, with no inner scroll area. Once a page is open, an empty composer shrinks to a one-line bar at the bottom and expands when clicked. Pages with a visual keep a one-sentence introduction and up to three "Label: sentence" takeaways (enforced on the server), and offer up to three **Go deeper** questions. Their short answers are prefetched in one Luna request after the page opens and appear as tabs below the page; **Make this the main slide** turns one into a full Terra slide. Motion respects reduced-motion preferences.

Back/Forward preserves edits, control settings, notes and reading position without clearing an unfinished instruction. Existing history, notes, export and composer selection help remain. Versions are tab-local and reset on reload; durable save/import is not yet implemented.

## Demo and live mode

Demo is the default and clearly labels its fixture responses. It recognizes a small set of examples; it does not perform web research, know a user's release process, or answer arbitrary questions. Network font loading does not transmit draft content.

**Demo mode → Connect & enable live preview** explicitly opts into sending the current draft, audience/format choices and selected text through the website server to OpenAI. Each tester supplies their own key. The browser holds it in module memory only, clears the input after connecting/closing, and forwards it in authorization headers. The app does not persist the API key or unsent draft. The composer, slides, notes and history stay in tab memory until reload. Hosting/network providers and OpenAI have their own data-handling policies; this is not local-only inference. The desktop Keychain entry is not accessed.

Live previews follow the word-count and pause triggers above; older preview results cannot replace current ones. IME composition is not submitted mid-composition. Preview requests use `gpt-6-luna`, thinking off, `store:false`, a 1,300-output-token limit and 25-second timeout. Explicit full-page requests use `gpt-6.1-terra`, low reasoning, a 3,400-token limit and 45-second timeout. Help on an existing slide uses Luna with a 2,200-token limit. All use the same strict, validated component schema. The UI caps each connection at 30 generation requests. This is a per-tab guard, not an account-wide budget. Reconnecting explicitly starts a new allowance. Model-access checking verifies both Luna and Terra, without generation.

No provider-owned/shared API key is deployed. No file uploads, browser agent, shell, external actions, analytics, account database, synchronized editing, or local 27B browser inference is implemented. Reload opens the empty composer and clears the workspace and its History. Export page data to keep a copy beyond the browser session.

## Source layout

- `public/`: page shell, styles, component renderers, fixtures and physics calculations.
- `api.mjs`: same-origin credential check and bounded Responses adapter.
- `prompts.mjs`: instructions for draft previews, slide generation and live slide help.
- `server.mjs`: local Node preview, bound to loopback.
- `build.mjs`: packs assets and API code into the Worker entry point.
- `.openai/hosting.json`: registered Sites identity; reuse it for future publications.
- `tests/`: Node unit and API-boundary checks with mocked API responses; `tests/browser/` holds Playwright fixtures.
- `STATE.md`: current product overview and next milestone.
- `docs/`: component contracts and `docs/research/` design research.

## Inspiration and differentiation

[Bruce Liu's Beyond Taking Turns](https://demos.liubruce.me/intra-turn/) supplies the feedforward and inline-clarification inspiration, credited in the footer and About panel. Direct manipulation, editable documents, interactive simulations and reusable UI components are established ideas too. This prototype does not claim academic novelty.

The product hypothesis is the combination: partial intent → small choices → an editable, interactive artifact whose state persists across questions and changes. A physics explanation is a parameterized experiment, not just streamed prose. Evaluate whether that helps people understand and complete tasks rather than counting messages or calling the interaction inherently better.

Design references: the user's `ed-sim/design-skills` collection, especially Emil's Apple Design and Impeccable's craft floor. Use their interaction/typography principles; none of their installers or hooks run in this project.

## Verification and limits

As of 2026-11-19, 91 Node checks and 40 browser tests (at 1280 and 390 px widths) pass. Earlier verification covered the ideal trajectory, demo/schema limits, input bounds, same-origin/key gates, strict Luna request configuration and safe refusal/error handling. Browser checks verified gravity-dependent results, keep-page state, direct explanation editing, selection-scoped questions, and demo inline replies. Desktop/mobile geometry is checked separately. The website's server-key path has now been exercised with the local `.env` key: Terra generated an Italy planner in 6.7 s and a contextual follow-up in 5.5 s. Browser BYOK and hosted live generation still need separate acceptance. HTTP fixtures do not establish live acceptance or preview latency. The initial empty screen, typing-stage answer/question, custom phrase clarification and explicit full-page transition were checked in the browser. The existing private deployment address is retained even though the product and Site display title are now AI Interaction.

## Server configuration and committed-page flow (2026-11-17)

Local development loads `OPENAI_API_KEY` from the ignored `ai-interaction/.env` file. The key is used only on the loopback server and is never embedded in browser assets, the build, or source commits. The UI says “OpenAI configured”; successful generation verifies actual access. Hosted runtime secrets are separate; the current private deployment has none and retains the per-tab key dialog. Configuring a hosted OpenAI secret requires the Sites/OpenAI Developers key workflow.

Send requires a live connection and no longer substitutes a generic demo page for arbitrary requests. The first generated page opens directly and the composer moves to a bottom dock. Follow-ups include bounded current-page context (including edited fields and notes). Typing previews and committed-page requests have separate cancellation, so typing cannot cancel page generation. Subsequent page replacements require review, preserve a History snapshot, and cannot apply over edits made after their request. A planner component supports travel/planning fields and concise next steps; it does not search hotels or check availability. Content is generated within five trusted component types, not arbitrary executable websites.

Live clarification now uses the model response for the entire current draft, with an optional exact phrase anchor. Hardcoded phrase rules are demo-only. Editing clears previous answers/questions immediately; stale or aborted responses cannot reappear. Routine model names, token counts and latency notices are removed from the writing surface; errors remain actionable.

## Contextual information controls (2026-11-18)

`public/intent.js` defines 28 information types and maps them to 16 app-owned control families; `public/controls.js` renders their reusable templates. The model returns bounded descriptors (type, exact phrase, question, contextual options, numerical unit) for up to four relevant refinements. It does not supply HTML, scripts, or widget implementations. There is no fixed production menu of places or example answers.

Types: output format, goal, audience, prior knowledge, depth, length, tone, language, date, date range, time, duration, location, geographic scope, budget, quantity, priorities, requirements, exclusions, comparison options, flexible dates, area map, assumption, goal comparison, audience and knowledge, example, include/exclude, trade-off. Families: choices, preview cards, searchable suggestions, number/unit entry, date/time pickers, editable lists, a depth slider, tone previews, flexible dates, area maps, assumptions, goal comparisons, audience and knowledge, examples, include/exclude and trade-offs. Location suggestions come from the model and are locally filterable, not a live geocoding service. Dates use native browser calendar controls; time includes an editable timezone. Budget supports bounds/currency, lists support multiple choices and custom additions, and priorities support reordering. Cards are schematic previews, not pre-generated final outputs.

Selecting a value inserts `phrase (choice)` and preserves the phrase as an editable highlighted anchor. Reopening it replaces the owned parentheses; Clear removes only that choice. Confirmed annotations survive new model responses and unrelated typing. Direct changes to the annotated phrase invalidate its stored control rather than editing unrelated parentheses. Choices are kept in tab memory; reload clears the draft and its choices. Hover/click the phrase or use the small accessible phrase buttons below the composer. Ordinary typing still invalidates unconfirmed suggestions and stale responses.

The default output preference is now Auto. Previously the hidden Interactive page default could accidentally tell the model that a user had already chosen a format. Explicit format choices remain authoritative.

Composer control gallery: http://127.0.0.1:4317/__dev/pickers shows all 28 information types and the slide format picker inside a replica of the real popover (development fixtures, available only from the local Node server). Single choices are radio rows, multi-select rows have checkboxes, priorities show a numbered order, and each control has one primary action. When both are open, the format question comes before the audience question; an audience chosen earlier in the session is not asked again. When the catalog had 20 types and six families, all 20 renderers were checked in the browser and each family was exercised with a chosen value. Live Kepler suggestions, selection/reselection and annotation survival after prefix editing were verified with OpenAI.


## Unified composer — current local experience

There is one interface and no Design selector. The unified composer combines the five design experiments. The original implementations are available in Git history.

- A genuinely useful optional question sits above the field; open it for choices or custom entry.
- A short live answer sits below the field.
- While editing, a compact intent summary sits inside the bottom edge. Hover to preview intent and editable details; click to keep the card open.
- Highlighted phrases open the 16 trusted control families. Confirmed values remain parenthetical and editable.
- A muted sage continuation appears inline while editing at the end of the draft, only if it fits within the existing text area. Tab/click accepts; Escape dismisses. Hidden suggestions do not capture Tab.

Optional controls are disclosed on demand, with click/keyboard alternatives to hover. Routine model attribution and token/timing diagnostics stay off the writing surface. The initial state is an empty field.

Luna supplies automatic draft help and scoped selection help. Send requests Terra. Page editing, inline suggestions, Apply and Reject, and History are available once a page exists.

Explicit choices are captured before clearing the composer and forwarded as background context. Unanchored clarifications can be answered without inserting a question/answer transcript; their choices remain editable in the intent card. Context stays valid JSON within the size limit. Preferences and pages remain tab-local; export before reloading.

Intent is editable: open its card, choose **Edit**, change the goal and select **Use this intent**. The card then says **Your intent**. Your correction guides live assistance and the longer Send response without rewriting the draft, and remains until you edit it or choose **Use suggested intent**. Unsaved edits can be cancelled; saved intent is tab-local and is cleared by reload.

Live draft assistance now uses SSE streaming from the Responses API through the local server. The brief answer and question appear progressively; choices/highlights activate after final schema validation. Saving an edited intent refreshes immediately. Learning requests with missing level get one optional audience question above the field; known audience is not re-asked. Live answers are capped at one short sentence (160 characters), and Luna runs with reasoning effort `none`. Send remains Terra and receives the same edited intent.

Live previews and Send retry temporary transport/server failures once after 800 ms. Typing invalidates old live work and pending retries; draft edits also prevent a pending Send retry. Key/access, quota/rate-limit, request and structured-output errors do not auto-retry. A successful response never starts another request on its own. Reload a previously open tab after a local server update to load new browser code.
