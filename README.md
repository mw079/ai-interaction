# AI Interaction

A small website exploring three connected ideas: understanding intent during input, inline decisions, and a persistent interactive page instead of a sequence of chat replies.

## Run locally

Requires Node 22 or later. No dependency installation.

```sh
cd /Users/mufwan/Documents/CS/ai/projects/localmind/ai-interaction
npm run dev
```

Open `http://127.0.0.1:4317`. Set `PORT` to use another port. Restart the server after source changes; it builds assets on startup. `npm test` runs the physics and API-boundary checks. `npm run build` creates a dependency-free Cloudflare Worker in `dist/server/index.js`, including browser assets and the Sites manifest.

## Current flow

The composer starts near the bottom. Focus/type to raise it to a stable position, with one question above, editable intent/phrase refinements, optional sage completion (Tab accepts), and a short streamed answer below in a bounded scroll region. It uses one Luna request after a 1.1-second pause. Success does not trigger another request by itself.

Send uses Terra to create an Atlas page. The model can choose up to two composable interactive blocks from a validated catalog: cycles, graphs, timelines, comparisons, charts and worked examples. Kepler/projectile requests retain their trusted local simulations. Text-only is valid when that is the better answer. See [component contracts](docs/COMPONENT_LIBRARY.md).

Edit the slide title or a passage directly. After a brief pause, Luna uses the surrounding text and your changes to answer a typed question or propose requested wording. Highlighting text gives a brief explanation underneath. Routine wording edits can stay quiet.

Proposed wording appears in the passage itself with insertion and deletion color and **Apply** and **Reject** underneath. Apply saves a new page version. Reject keeps your original text. Typing again dismisses the proposal and refreshes the response. The composer’s plus opens follow-up scope once a slide exists. File attachments are unsupported.

While writing in the main composer, the page scales to 90%. Returning to the page restores full size and hides composer questions/answers. Long pages and live answers have bounded scroll regions. Motion respects reduced-motion preferences.

Back/Forward preserves edits, control settings, notes and reading position without clearing an unfinished instruction. Existing history, notes, export and composer selection help remain. Versions are tab-local and reset on reload; durable save/import is not yet implemented.

## Demo and live mode

Demo is the default and clearly labels its fixture responses. It recognizes a small set of examples; it does not perform web research, know a user's release process, or answer arbitrary questions. Network font loading does not transmit draft content.

**Demo mode → Connect & enable live preview** explicitly opts into sending the current draft, audience/format choices and selected text through the website server to OpenAI. Each tester supplies their own key. The browser holds it in module memory only, clears the input after connecting/closing, and forwards it in authorization headers. The app does not write keys or prompts to disk, localStorage, cookies, source, or application logs. Hosting/network providers and OpenAI have their own data-handling policies; this is not local-only inference. The desktop Keychain entry is not accessed.

Live previews follow a 1.1-second typing pause; older preview results cannot replace current ones. IME composition is not submitted mid-composition. Preview requests use `gpt-6-luna`, thinking off, `store:false`, a 1,300-output-token limit and 25-second timeout. Explicit full-page requests use `gpt-6.1-terra`, low reasoning, a 2,400-token limit and 45-second timeout. Both use the same strict, validated component schema. The UI caps each connection at 30 generation requests. This is a per-tab guard, not an account-wide budget. Reconnecting explicitly starts a new allowance. Model-access checking verifies both Luna and Terra, without generation.

No provider-owned/shared API key is deployed. No file uploads, browser agent, shell, external actions, analytics, account database, synchronized editing, or local 27B browser inference is implemented. Reloading loses the session; export page data to retain it.

## Source layout

- `public/`: page shell, styles, component renderers, fixtures and physics calculations.
- `api.mjs`: same-origin credential check and bounded Responses adapter.
- `prompts.mjs`: instructions for draft previews, slide generation and live slide help.
- `server.mjs`: local Node preview, bound to loopback.
- `build.mjs`: packs assets and API code into the Worker entry point.
- `.openai/hosting.json`: registered Sites identity; reuse it for future publications.
- `tests/`: meaningful physics and request/error boundary checks with mocked API responses.

## Inspiration and differentiation

[Bruce Liu's Beyond Taking Turns](https://demos.liubruce.me/intra-turn/) supplies the feedforward and inline-clarification inspiration, credited in the footer and About panel. Direct manipulation, editable documents, interactive simulations and reusable UI components are established ideas too. This prototype does not claim academic novelty.

The product hypothesis is the combination: partial intent → small choices → an editable, interactive artifact whose state persists across questions and changes. A physics explanation is a parameterized experiment, not just streamed prose. Evaluate whether that helps people understand and complete tasks rather than counting messages or calling the interaction inherently better.

Design references: the user's `ed-sim/design-skills` collection, especially Emil's Apple Design and Impeccable's craft floor. Use their interaction/typography principles; none of their installers or hooks run in this project.

## Verification and limits

Sixteen Node checks pass for the ideal trajectory, demo/schema limits, input bounds, same-origin/key gates, strict Luna request configuration and safe refusal/error handling. Browser checks verified gravity-dependent results, keep-page state, direct explanation editing, selection-scoped questions, and demo inline replies. Desktop/mobile geometry is checked separately. The native LocalMind app's real Luna generation was verified previously; the website's server-key path has now been exercised with the local `.env` key: Terra generated an Italy planner in 6.7 s and a contextual follow-up in 5.5 s. Browser BYOK and hosted live generation still need separate acceptance. HTTP fixtures do not establish live acceptance or preview latency. The initial empty screen, typing-stage answer/question, custom phrase clarification and explicit full-page transition were checked in the browser. The existing private deployment address is retained even though the product and Site display title are now AI Interaction.

## Server configuration and committed-page flow (2026-11-17)

Local development loads `OPENAI_API_KEY` from the ignored `ai-interaction/.env` file. The key is used only on the loopback server and is never embedded in browser assets, the build, or source commits. The UI says “OpenAI configured”; successful generation verifies actual access. Hosted runtime secrets are separate; the current private deployment has none and retains the per-tab key dialog. Configuring a hosted OpenAI secret requires the Sites/OpenAI Developers key workflow.

Send requires a live connection and no longer substitutes a generic demo page for arbitrary requests. The first generated page opens directly and the composer moves to a bottom dock. Follow-ups include bounded current-page context (including edited fields and notes). Typing previews and committed-page requests have separate cancellation, so typing cannot cancel page generation. Subsequent page replacements require review, preserve a History snapshot, and cannot apply over edits made after their request. A planner component supports travel/planning fields and concise next steps; it does not search hotels or check availability. Content is generated within five trusted component types, not arbitrary executable websites.

Live clarification now uses the model response for the entire current draft, with an optional exact phrase anchor. Hardcoded phrase rules are demo-only. Editing clears previous answers/questions immediately; stale or aborted responses cannot reappear. Routine model names, token counts and latency notices are removed from the writing surface; errors remain actionable. Eighteen regression checks pass.

## Contextual information controls (2026-11-18)

`public/intent.js` defines 20 information types and maps them to six app-owned control families; `public/controls.js` renders their reusable templates. The model returns bounded descriptors (type, exact phrase, question, contextual options, numerical unit) for up to four relevant refinements. It does not supply HTML, scripts, or widget implementations. There is no fixed production menu of places or example answers.

Types: output format, goal, audience, prior knowledge, depth, length, tone, language, date, date range, time, duration, location, geographic scope, budget, quantity, priorities, requirements, exclusions, comparison options. Families: choices, preview cards, searchable suggestions, number/unit entry, date/time pickers, editable lists. Location suggestions come from the model and are locally filterable, not a live geocoding service. Dates use native browser calendar controls; time includes an editable timezone. Budget supports bounds/currency, lists support multiple choices and custom additions, and priorities support reordering. Cards are schematic previews, not pre-generated final outputs.

Selecting a value inserts `phrase (choice)` and preserves the phrase as an editable highlighted anchor. Reopening it replaces the owned parentheses; Clear removes only that choice. Confirmed annotations survive new model responses and unrelated typing. Direct changes to the annotated phrase invalidate its stored control rather than editing unrelated parentheses. Choices are kept in tab memory; a reload preserves only whatever draft you explicitly restore, not metadata. Hover/click the phrase or use the small accessible phrase buttons below the composer. Ordinary typing still invalidates unconfirmed suggestions and stale responses.

The default output preference is now Auto. Previously the hidden Interactive page default could accidentally tell the model that a user had already chosen a format. Explicit format choices remain authoritative.

Local template QA: http://127.0.0.1:4317/__dev/pickers (development fixtures, available only from the local Node server). All 20 renderers were checked in the browser; each of the six families was exercised with a chosen value. Live Kepler suggestions, selection/reselection and annotation survival after prefix editing were verified with OpenAI.


## Unified composer — current local experience

There is one interface and no Design selector. The five experimental modes have been combined; `prototypes.js` and its catalog are retained as historical experiments, not loaded by the app.

- A genuinely useful optional question sits above the field; open it for choices or custom entry.
- A short live answer sits below the field.
- While editing, a compact intent summary sits inside the bottom edge. Hover to preview intent and editable details; click to keep the card open.
- Highlighted phrases open the six trusted control families. Confirmed values remain parenthetical and editable.
- A muted sage continuation appears inline while editing at the end of the draft, only if it fits within the existing text area. Tab/click accepts; Escape dismisses. Hidden suggestions do not capture Tab.

Optional controls are disclosed on demand, with click/keyboard alternatives to hover. Routine model attribution and token/timing diagnostics stay off the writing surface. The initial state is an empty field.

Luna supplies automatic draft help and scoped selection help. Send requests Terra. Existing page editing, Read/Explore, bounded inline suggestions, review and History remain available once a page exists. The live outline is deferred rather than adding another permanent preview.

Explicit choices are captured before clearing the composer and forwarded as background context. Unanchored clarifications can be answered without inserting a question/answer transcript; their choices remain editable in the intent card. Context stays valid JSON within the size limit. Preferences and pages remain tab-local; export before reloading.

Intent is editable: open its card, choose **Edit**, change the goal and select **Use this intent**. The card then says **Your intent**. Your correction guides live assistance and the longer Send response without rewriting the draft, and remains until you edit it or choose **Use suggested intent**. Unsaved edits can be cancelled; saved intent is tab-local and is cleared by reload.

Live draft assistance now uses SSE streaming from the Responses API through the local server. The brief answer and question appear progressively; choices/highlights activate after final schema validation. Saving an edited intent refreshes immediately. Learning requests with missing level get one optional audience question above the field; known audience is not re-asked. Live answers are capped at one short sentence (160 characters), and Luna runs with reasoning effort `none`. Send remains Terra and receives the same edited intent.

Live previews and Send retry temporary transport/server failures once after 800 ms. Typing invalidates old live work and pending retries; draft edits also prevent a pending Send retry. Key/access, quota/rate-limit, request and structured-output errors do not auto-retry. A successful response never starts another request on its own. Reload a previously open tab after a local server update to load new browser code.
