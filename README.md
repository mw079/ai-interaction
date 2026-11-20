# AI Interaction

A web prototype for working with AI while a thought is still taking shape. As you type, a fast model gives a short answer, asks at most one useful question, highlights the details you can adjust, and predicts your next words. When you press Send, a stronger model turns the request into an interactive page: a visual that carries the explanation, a few short takeaways, and follow-up questions you can open in place.

| Moment | What you see | Model |
| --- | --- | --- |
| While writing | A question above the field, a short answer below it, highlighted phrases with pickers, and your likely next words in soft blue (Tab accepts) | GPT-6 Luna |
| On Send | A page with up to three views as tabs (for a trip: a route map, the days, the costs) and short takeaways | GPT-6.1 Terra |
| Inside the page | Step through the visual, highlight text for an explanation, ask for an edit, open Go deeper | Local controls and GPT-6 Luna |

## Run it

Requires Node 22 or later. No dependencies are needed to run the app.

```sh
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:4317**. The server builds the assets at startup, so restart it after changing source files.

- **Live mode:** put your key in `.env` as `OPENAI_API_KEY=…`. Git ignores `.env`. Visitors never enter a key: every request uses the server's key.
- **Daily limit:** each visitor (by IP address) gets `DAILY_LIMIT` requests per UTC day (default 200), counting typing help, pages, questions and Go deeper alike. The whole app gets `DAILY_TOTAL_LIMIT` (default 2,000) as a cap on spending. Over the limit, the server refuses the request and the app shows a "Try again tomorrow" card. Counts are kept in server memory, so they reset when the server restarts.
- **Demo mode:** without a key the app gives labelled sample answers for a few built-in examples. Send needs live mode.

## How it works

| Moment | Model settings | Limits |
| --- | --- | --- |
| While typing | `gpt-6-luna`, no reasoning | 1,300 output tokens, 25 s |
| On Send | `gpt-6.1-terra`, low reasoning | 5,000 tokens, 45 s |
| Right after a page appears: up to two more views, added as tabs in the background | `gpt-6-luna` | 2,600 tokens, 25 s |
| Inside the page: explanations, suggested edits, Go deeper answers | `gpt-6-luna` | 2,200 tokens (2,600 for Go deeper), 25 s |

- **When live help runs:** after four newly completed words (at least 1.2 s apart), after a 100 ms pause at the end of a sentence, or after a 250 ms ordinary pause. One request per check; at most one is in flight, recent drafts are cached, and newer typing cancels older work. The answer, question, Tab prediction and each highlight are shown as soon as each is written.
- **What the models receive:** `api.mjs` checks and bounds every request; `prompts.mjs` turns it into one structured input, ordered by authority: the request, decisions made in the interface, the one-line preview the user read before Send, the target part of the page, the page itself (background only, never instructions), and today's date.
- **What comes back:** every response must match a strict JSON schema and pass validation before it is used. The model supplies data, never HTML or code. Pages are drawn by the app's own components.
- **Failures:** temporary failures are retried once after 800 ms. Validation and service errors are shown with Retry, not retried automatically.

## Component libraries

The model chooses and fills these; the app owns rendering, layout and behaviour.

- **Page components** (`public/components/`): 24 types plus the Kepler and projectile simulations. Diagrams: cycle, timeline, comparison, chart, hierarchy, decision tree, concept map, labelled diagram. Activities and explorers: parameter explorer, prediction quiz, before/after, sorting, function plot, evidence, map (real coastlines; routes with numbered stops; city plans with true distances), linked scenarios, worked example, practice. Numbers and practice: proportion, 2×2 matrix, checklist, flashcards, spectrum, key numbers.
- **Composer pickers** (`public/composer/`): 24 information types (audience, budget, dates, tone, place on a map, must-haves, and more) in 14 control families. Choosing is committing: the draft gets `phrase (value)`, which stays editable.

## Decisions

- **Visuals carry the explanation.** Steps live in component items, and each item's one-sentence detail shows when it is selected. Prose is limited to an introduction and up to three takeaways.
- **Say each idea once.** A second or third view must answer a different question.
- **Change is reversible.** Apply/Reject, Undo, version navigation and History. Choosing a step in a diagram is viewing, not editing.
- **Short examples and a strict schema.** The prompts give one-line examples per component and picker; whole example pages made the output copy them, so they were not kept.
- **Nothing persists across reloads.** Pages, notes and history live in the tab. Export saves the page as JSON.

## Develop and test

Install the development dependency (Playwright) with `npm ci`.

| Command | What it does |
| --- | --- |
| `npm test` | Unit and API tests with mocked model responses |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` | Browser tests at 1280 and 390 px against a fixture server, including tests that measure each component against its data |
| `npm run eval:journeys` | Full journeys in 20 domains (typing, live help, a picker, Send, views, a follow-up, Go deeper) with 12 checks each and an `overview.html`; set `EVAL_WIDTHS=1280,390` for phones and run the app with a higher `DAILY_LIMIT` |
| `npm run eval:pages` | Page quality on 15 fixed prompts (including plans and trips), with screenshots and design-rule scores |
| `npm run eval:followups` | Follow-up instructions on existing pages (13 short journeys, 26 steps), with data checked against reference values |
| `npm run eval:pickers` | Which picker live help attaches: 2 × 28 drafts covering all 24 picker types, on a tuned and an unseen set |
| `npm run test:luna` | Live checks of three Luna answers, with time to first text |
| `npm run build` | Builds the browser assets and the dependency-free server bundle in `dist/` |

The eval commands send real requests through the local server to OpenAI; set `EVAL_BASE_URL` or `LUNA_BASE_URL` for another port. With the dev server running, two galleries show every building block: **/__dev/components** and **/__dev/controls**.

## Project layout

```
public/
  app.js, index.html   app controller (state, previews, Send, versions, proposals) and page shell
  composer/            live help, information types, pickers, popover, request context
  page/                page layout and views, help inside the page, versions, projectile simulator
  components/          component catalog, renderer, diagrams, interactives, shared kit, maps
  shared/              model logic, streaming, retry, API client, DOM helper
  styles/              base, composer, page, components and controls, joined into /style.css
api.mjs                the /api endpoint: checks, limits, OpenAI Responses adapter, validation
prompts.mjs            model input and the instructions for each phase
server.mjs             local server; build.mjs and styles.mjs produce the bundle
dev/                   galleries, sample data and the live evaluations
tests/                 unit and API tests; tests/browser/ for Playwright and its fixture server
```

## Privacy and limits

- **The key stays on the server.** It never reaches browser assets, the build or Git.
- **No outside services in the browser.** The page loads only from the app's own server, including its font (DM Sans, in `public/fonts/` with its license). Only the server talks to OpenAI.
- **Requests are not stored by OpenAI** (`store:false`). Live mode still sends your draft, choices and page content through the server to OpenAI.
- **Known gaps:** a failed Send does not put the draft back in the field; there is no import for exported pages; nobody outside development has used the app yet.
- **Not implemented:** file uploads, web search, accounts, analytics, shared editing and local models.

The feedforward and inline-clarification ideas build on [Bruce Liu’s Beyond Taking Turns](https://demos.liubruce.me/intra-turn/). This prototype does not claim academic novelty.
