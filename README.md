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

Start with only an empty text field. Typing reveals a brief provisional answer and at most one useful clarification. A highlighted phrase can be clarified through hover, click or the keyboard-accessible Clarify button, with options or custom input. Choices now appear only in one anchored popover, not as a second question form below the field. Custom entry is revealed through Something else; unsubmitted custom text survives dismissal in this tab. Nothing opens the longer page until **Explore interactively** is clicked. Existing page edits remain when the input changes.

## What works

- Editable intent input, format options and audience choices. Demo uses keyword-selected fixtures; it does not infer arbitrary intent.
- Interactive projectile motion: launch speed, angle and Earth/Moon/Mars gravity. Calculation and rendering happen locally without model requests. This is an ideal no-air-resistance, same-launch/landing-height simulation; chart axes rescale.
- Editable explanations. Select a passage and use **Ask about selected text** to ask a question within that page.
- Clickable/editable concept maps, editable comparisons, and outline sections with checkboxes and reorder controls.
- Keep/dismiss a suggested page; accepted state remains while another preview is prepared. History restores earlier accepted-page snapshots, including control values and explanation edits. History captures explicit changes, not every keystroke.
- Notes with selection-scoped explanation/diagram actions. JSON export includes page data, never API keys. No JSON import or standalone interactive-page export yet.
- Optional real OpenAI preview through the same-origin API. The model returns a strict schema; the host validates bounded data and uses trusted renderers. Model-generated code never executes.

## Demo and live mode

Demo is the default and clearly labels its fixture responses. It recognizes a small set of examples; it does not perform web research, know a user's release process, or answer arbitrary questions. Network font loading does not transmit draft content.

**Demo mode → Connect & enable live preview** explicitly opts into sending the current draft, audience/format choices and selected text through the website server to OpenAI. Each tester supplies their own key. The browser holds it in module memory only, clears the input after connecting/closing, and forwards it in authorization headers. The app does not write keys or prompts to disk, localStorage, cookies, source, or application logs. Hosting/network providers and OpenAI have their own data-handling policies; this is not local-only inference. The desktop Keychain entry is not accessed.

Live previews follow a 1.1-second typing pause; older preview results cannot replace current ones. IME composition is not submitted mid-composition. Preview requests use `gpt-6-luna`, thinking off, `store:false`, a 450-output-token limit and 25-second timeout. Explicit full-page requests use `gpt-6.1-terra`, low reasoning, a 2,400-token limit and 45-second timeout. Both use the same strict, validated component schema. The UI caps each connection at 30 generation requests. This is a per-tab guard, not an account-wide budget. Reconnecting explicitly starts a new allowance. Model-access checking verifies both Luna and Terra, without generation.

No provider-owned/shared API key is deployed. No file uploads, browser agent, shell, external actions, analytics, account database, synchronized editing, or local 27B browser inference is implemented. Reloading loses the session; export page data to retain it.

## Source layout

- `public/`: page shell, styles, component renderers, fixtures and physics calculations.
- `api.mjs`: same-origin credential check and bounded Responses adapter.
- `server.mjs`: local Node preview, bound to loopback.
- `build.mjs`: packs assets and API code into the Worker entry point.
- `.openai/hosting.json`: registered Sites identity; reuse it for future publications.
- `tests/`: meaningful physics and request/error boundary checks with mocked API responses.

## Inspiration and differentiation

[Bruce Liu's Beyond Taking Turns](https://demos.liubruce.me/intra-turn/) supplies the feedforward and inline-clarification inspiration, credited in the footer and About panel. Direct manipulation, editable documents, interactive simulations and reusable UI components are established ideas too. This prototype does not claim academic novelty.

The product hypothesis is the combination: partial intent → small choices → an editable, interactive artifact whose state persists across questions and changes. A physics explanation is a parameterized experiment, not just streamed prose. Evaluate whether that helps people understand and complete tasks rather than counting messages or calling the interaction inherently better.

Design references: the user's `ed-sim/design-skills` collection, especially Emil's Apple Design and Impeccable's craft floor. Use their interaction/typography principles; none of their installers or hooks run in this project.

## Verification and limits

Fourteen Node checks pass for the ideal trajectory, demo/schema limits, input bounds, same-origin/key gates, strict Luna request configuration and safe refusal/error handling. Browser checks verified gravity-dependent results, keep-page state, direct explanation editing, selection-scoped questions, and demo inline replies. Desktop/mobile geometry is checked separately. The native LocalMind app's real Luna generation was verified previously; this website's BYOK live path has not yet been exercised with a valid key. HTTP fixtures do not establish live acceptance or preview latency. The initial empty screen, typing-stage answer/question, custom phrase clarification and explicit full-page transition were checked in the browser. The existing private deployment address is retained even though the product and Site display title are now AI Interaction.
