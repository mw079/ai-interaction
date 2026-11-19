# AI Interaction

A web prototype for working with AI while a thought is still taking shape. As you type, a fast model gives a short answer, asks at most one useful question, and offers controls on highlighted phrases. When you press Send, a stronger model turns the request into an interactive page: a visual that carries the explanation, a few short takeaways, and follow-up questions you can open in place.

[STATE.md](STATE.md) describes the current product, its decisions and the next milestone. [DESIGN.md](DESIGN.md) holds the interaction and visual design rules.

## Run it

Requires Node 22 or later. No dependencies are needed to run the app.

```sh
npm run dev
```

Open **http://127.0.0.1:4317**. Set `PORT` to use another port. The server builds the assets at startup, so restart it after changing source files.

- **Live mode:** put `OPENAI_API_KEY=…` in `.env`, a file Git ignores. Visitors never enter a key: every request uses the server's key.
- **Daily limit:** each visitor (by IP address) gets `DAILY_LIMIT` requests per UTC day (default 200), counting typing help, pages, questions and Go deeper alike, and the whole app gets `DAILY_TOTAL_LIMIT` (default 2,000) as a cap on spending. Both can be set in `.env`. Over the limit, the server refuses the request and the app shows a "Try again tomorrow" card, with a slot for a short video. Counts are kept in server memory, so they reset on restart; a hosted deployment needs a shared store (KV or a Durable Object) for them.
- **Demo mode:** without a key the app gives labelled sample answers for a few built-in examples. Send needs live mode.

## Develop and test

Install the development dependency (Playwright) with `npm ci`.

| Command | What it does |
| --- | --- |
| `npm test` | Unit and API tests with mocked model responses |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` | Browser tests at 1280 and 390 px against a fixture server with fixed responses and controlled timers. They include measuring tests that check each interactive component and simulation draws what its data or physics says |
| `npm run eval:pages` | Live page quality: ten fixed prompts through the running app, screenshots and design-rule scores ([results](docs/EVALUATION.md)) |
| `npm run test:luna` | Live checks of three Luna answers, with time to first text |
| `npm run build` | Builds the dependency-free Worker in `dist/server/index.js` |

The live commands send real requests through the local server to OpenAI. Set `EVAL_BASE_URL` or `LUNA_BASE_URL` for another port.

With the dev server running, two galleries show every building block with sample content:

- **http://127.0.0.1:4317/__dev/components:** all page components, plus the interface pieces (explanations, edit review, toolbar, notes, loading).
- **http://127.0.0.1:4317/__dev/controls:** all composer controls inside a replica of the real popover.

## How it works

| Moment | What you see | Model | Limits |
| --- | --- | --- | --- |
| While typing | One short answer, at most one question, controls on phrases, an optional completion | `gpt-6-luna`, no reasoning | 1,300 output tokens, 25 s |
| On Send | An Atlas page built from the component catalog | `gpt-6.1-terra`, low reasoning | 3,400 tokens, 45 s |
| Inside the page | Explanations of highlighted text, answers and suggested edits, Go deeper answers | `gpt-6-luna` | 2,200 tokens (2,600 for Go deeper), 25 s |

- **When live help runs:** after four newly completed words (at least 1.2 s apart), after a 100 ms pause at the end of a sentence, or after a 250 ms ordinary pause. At most one preview is in flight, recent drafts are cached, and newer typing cancels older work.
- **What the models receive:** the browser sends the draft and request context to `api.mjs`, which validates and bounds it. `prompts.mjs` turns it into one structured input shared by both models, ordered by authority: request, decisions, target, page (background only), today. See [STATE.md](STATE.md#how-the-models-receive-user-information).
- **What comes back:** every response must match a strict JSON schema and pass validation before it is used. The model supplies data, never HTML or code. Pages are drawn by app-owned components from the catalog in `public/components/catalog.js` ([component contracts](docs/COMPONENT_LIBRARY.md)).
- **Failures:** temporary failures are retried once after 800 ms. Validation and service errors are shown, not retried. The daily limit is enforced on the server.

## Project layout

```
public/
  app.js, index.html   app controller (state, previews, Send, versions, proposals) and page shell
  composer/            live help, information types, composer controls, popover, request context
  page/                Atlas page, help inside the page, page versions, layout, projectile simulator
  components/          component catalog, renderer, diagrams, interactives, shared kit, maps
  shared/              model logic, streaming, retry, API client, DOM helper
  styles/              base, composer, page, components and controls, joined into /style.css
api.mjs                the /api endpoint: checks, bounds, OpenAI Responses adapter, validation
prompts.mjs            model input (buildModelInput) and the instructions for each phase
server.mjs             local loopback server; build.mjs and styles.mjs produce the Worker bundle
dev/                   galleries, their sample data, the page evaluation and the Luna smoke test
tests/                 unit and API tests; tests/browser/ for Playwright and its fixture server
docs/                  component contracts, evaluation results, design research
```

## Privacy and limits

- **The key stays out of the browser.** The `.env` key is used only by the server and never ends up in browser assets, the build or Git. Visitors cannot supply their own key; one sent by a browser is ignored.
- **Requests are not stored by OpenAI.** They use `store:false`. Live mode still sends your draft, choices and page content through the server to OpenAI, so this is not local inference.
- **Nothing persists across reloads.** Pages, notes, history and choices live in the tab and reload clears them. Export saves the page as JSON; there is no import yet.
- **Not implemented:** file uploads, web search, browser or desktop actions, accounts, analytics, shared editing and local models.

## Docs

- [STATE.md](STATE.md): current product, libraries, how user information reaches the models, known gaps, next milestone
- [DESIGN.md](DESIGN.md): interaction and visual design rules
- [docs/COMPONENT_LIBRARY.md](docs/COMPONENT_LIBRARY.md): the component data contract and every block type
- [docs/EVALUATION.md](docs/EVALUATION.md): page evaluation method and results
- [docs/research](docs/research): earlier design research

The feedforward and inline-clarification ideas build on [Bruce Liu’s Beyond Taking Turns](https://demos.liubruce.me/intra-turn/), credited in the app’s About panel. This prototype does not claim academic novelty; whether the interaction helps people understand faster still needs testing with users.
