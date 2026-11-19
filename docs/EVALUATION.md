# Page quality evaluation

`npm run eval:pages` (in `dev/eval-pages.mjs`) drives the real local app in Chrome with ten fixed prompts. It captures each generated page and a 1280×800 screenshot, and scores the page against the design rules. It needs `npm run dev` running with an OpenAI key, and it sends real requests: Terra for each page, Luna for previews and Go deeper. Set `EVAL_BASE_URL` for another loopback port and `EVAL_ONLY=id,id` to run a subset. Reports and screenshots go to `artifacts/eval/<timestamp>/`, which Git ignores.

## Checks

For pages with a visual:

- The page has a visual (a component, or the Kepler or projectile simulation).
- The first screen holds the answer: the title, intro, visual and caption end above the composer.
- The intro is at most 160 characters.
- Every passage after the intro is a takeaway in the form "Label: sentence".
- There are at most three takeaways, each at most 140 characters.
- Nothing repeats. No prose sentence shares 60 % or more of its meaningful words with an item explanation, and no label appears twice.
- There are two or three Go deeper questions.

For text-first requests, such as an email: the deliverable is present, and no visual is forced.

`scorePage` is pure and has a unit test, so the checks themselves are verified.

## Prompts

Kepler’s laws, the Feynman technique, vaccines, photosynthesis, renting vs. buying, how a bill becomes law, Python or JavaScript first, the composition of dry air, prioritising tasks by urgency and importance, and a thank-you email.

## Results, 2026-11-19

| Run | Pass rate | Median time to page | Notes |
| --- | --- | --- | --- |
| Baseline | 98 % (60/61) | 11.7 s | The photosynthesis intro restated its "Make sugar" step. |
| With two few-shot example pages | 98 % (60/61) | 8.1 s | Same components and the same repeat. Follow-ups drifted from mostly three to two and takeaway labels to one word, both copying the examples. The examples were removed. |
| Intro rule only (3 process prompts) | 100 % (21/21) | 10.2 s | The intro now gives the big picture "in different words from the visual". |

The model chose a fitting component for each prompt without being told: the Kepler orbit, a cycle (Feynman), a process (vaccines, photosynthesis, bill to law), comparison cards (renting vs. buying, Python vs. JavaScript), a proportion bar (air), a 2×2 matrix (priorities), and plain text for the email.

**Decision:** keep zero-shot instructions and the strict schema, and do not add few-shot pages. The rules and schema already produce Kepler-density pages. Examples added tokens and pulled the output toward their own shape. Timing differences between runs are within network variance; the longer prompt did not make pages slower.

## Limits

The checks are rule-based. They cannot judge whether an explanation is correct, whether the chosen component is the *best* one, or whether the page looks good. Use the screenshots for that. Ten prompts is a small sample, so rerun it after every prompt or component change and compare.
