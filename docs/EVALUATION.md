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

## Prompt redesign, 2026-11-19

The prompts were restructured around one input contract shared by all phases, with structured model input and an explicit order of authority. The before and after runs used the same day and server:

| Check | Before | After |
| --- | --- | --- |
| `eval:pages` | 100 % (61/61), median 8.8 s | 100 % (61/61), median 8.8 s, same components chosen |
| `test:luna` (3 prompts) | all pass | all pass |
| Precedence checks (3 cases × 2 runs: decided audience not re-asked, latest request overrides a decision, instructions in page notes ignored) | 6/6 | 6/6 |
| Model input for a typical draft | 434 bytes | 225 bytes |

**Result:** behaviour is unchanged on these measures. The gain is clarity and coverage. One documented order of precedence now reaches every phase, including page help, selections and Go deeper, which previously had no user-intent guidance. The duplicate draft and the nested context string are gone.

## Limits

The checks are rule-based. They cannot judge whether an explanation is correct, whether the chosen component is the *best* one, or whether the page looks good. Use the screenshots for that. Ten prompts is a small sample, so rerun it after every prompt or component change and compare.

## Follow-up instructions, 2026-11-19

`npm run eval:followups` builds a page, then sends follow-up instructions to it (simplify, add a quiz, filter, re-chart, add a map city, rename quadrants via Focus, translate, promote Go deeper, change a function, change projectile gravity). It checks both instruction following and data correctness against reference values (AU distances, capital coordinates, air composition, pH). Use `EVAL_ONLY=sine,projectile` to run some scenarios.

| Run | Result | Problem found and fix |
| --- | --- | --- |
| First full run (12 scenarios, 25 steps) | 43/45 checks | Every sine plot failed validation because the model wrote "sine (radians)"; function names are now normalised. A Moon follow-up said 1.62 m/s² while the simulator stayed on Earth; the model now sets the starting launch (speed, angle, world). |
| After fixes (sine, projectile) | 8/8, then 4/4 twice | — |

Regression re-run after the fixes: 46/48 checks across 26 steps; both misses were one undated step on the first WWI page, which the year-label follow-up then fixed. `test:luna` passed all three prompts.

Manual checks on a live page: a question typed into a passage was answered correctly and Undo restored the text; a composer rewrite changed only the intro; Back restored the earlier version. Manual testing also found six-step process labels overlapping in the visual column; steps now stack vertically when each would get under 90 px, with a browser test that measures the rendered text. History opened below the page, off-screen, so clicking it looked like nothing happened; it now opens under its button with focus on Close, and Restore brought back the earlier page while saving the current one. Highlighting a phrase gave a correct explanation that added something new, and Escape closed it.

## Live questions with a page open, 2026-11-20

Twelve drafts typed live (real model), counting whether a live question appeared. On the start screen 6 of 6 got one. With a Kepler page open, 0 of 6 open instructions did: the page-mode prompt described the preview line but not when to ask, and the input contract's "fill open choices with sensible defaults" won. After adding a page-mode question rule (ask when an open choice would visibly change the page, with options from the page; never for specific instructions):

| Draft (page open) | Before | After, run 1 | After, run 2 |
| --- | --- | --- | --- |
| Add an example / Make it more detailed / Compare two planets / Show it differently / Add a quiz | 0–2 of 5 | 5 of 5 | 5 of 5 |
| Very simple terms, what each law means (already specific) | none | none | none |
| Translate / shorten intro / remove the formula | none | none | none |
| Three-question quiz about the third law | none | asked | none |

Questions came with three options each, e.g. "How many quiz questions?" 3, 6 or 10.

## Full review and manual testing, 2026-11-20

New prompts typed by hand in the browser at 820 px and on a phone (375 px): a heat pump in winter (loop, then "Add a comparison with another heating system" → live question "Which heating system?" → electric resistance), inflation and central banks (concept map), the immune system (concept map, then "Add a short quiz" → "How many questions?" → 3), and the pH scale. Highlighting, Undo, Back, History and Go deeper were exercised on the live pages. Found and fixed:

| Found | Fix |
| --- | --- |
| Choosing "How would you like to explore this?" left keyboard focus nowhere, so typing went nowhere until a click | Focus returns to the draft |
| A Go deeper answer opened below the fold of the page card | It scrolls into view |
| A follow-up that added a quiz below the visual left the page at the top, so the change was off-screen | The page scrolls to the added part, highlights it and announces "… added" |
| An over-long live answer was cut mid-phrase ("…raise interest…") | It ends at the last clause break as a whole sentence |
| Concept maps were drawn at a fixed 600-unit size: on a phone, labels shrank to ~8 px and arrows disappeared under the pills; on a stage wider than ~660 px the drawing and the ideas no longer lined up | The map is laid out in real pixels (taller on narrow stages, compact ideas), arrows stop at each idea's outline, and each label takes the first spot clear of ideas, other labels and the map's edge, wrapping long ones onto two lines |
| "Add seawater" to a six-item pH scale failed validation (6 items maximum), so the whole request was refused | Chart, spectrum, map and timeline may grow to 8 when the user adds to them; new components still start at 6 or fewer, and the model is told to merge rather than exceed a limit |
| Crowded scale labels could overlap (water 50, seawater 57, baking soda 59) | Labels take the first free row, with a second row and a thin stem when crowded; end labels stay over the scale |

Every fix has a browser test that measures the result, and the new tests fail on the previous code (the Go deeper scroll check passes either way at the test window size). Live: page quality 10 prompts, follow-ups 26 steps and `test:luna` were re-run on the final code (results below).

Final re-run on the fixed code: follow-ups **48/48 checks across 26 steps** (pH "Add seawater" now passes; before the fixes 45/48 and 43/46), pages 98 % (69/70; the air page repeated one fact between intro and visual, model variance seen before), and `test:luna` answered all three prompts in under 2.1 s. Stating "up to 8" in the catalog made the model fill new components to 7–8 items, so it now says new components start at 6 or fewer: four pH and three WWI pages then all came back with 6 items.

## Richer pages: components by intent, up to three views, route maps, 2026-11-20

Twelve typical requests showed why pages looked alike: every plan or trip became the planner form of empty fields (the prompt said "Practical plans: use kind=planner"), the map was never used (not even for two trips or "biggest cities in Europe"), and no page had a second component (the prompt said "Use one primary visual"). The catalog listed all 24 components, but as one paragraph in the order they were built, explaining how to fill each rather than when to use it.

Changes: the component guide is ordered by what the user wants to see or do (places → map, schedules → timeline, choices → comparison, decision tree or matrix, numbers → chart, …) with one-line examples rather than example pages (full example pages were rejected on 2026-11-19 because the model copied their shape); plans show the plan itself (route map, days, checklist) and the form is kept only for a requested form; a page may have up to three components, shown as tabs, when each answers a different question; a map with prompt `route` numbers its stops, joins them and highlights the way so far; close-together stops become a plain plan with true distances and a scale bar.

| | Before | After |
| --- | --- | --- |
| Plans and trips as a form | 4 of 12 | 0 of 12 |
| Map used | 0 | 3 (both trips as routes, Europe's cities) |
| Pages with 2–3 views | 0 | 5 |
| Component types across the set | 7 | 9 |

`eval:pages` gained five plan and trip prompts with checks (no form, uses a map, the map is a route) and reports component variety: 99 % (97/98), 10 different components, 5 pages with views; the one miss was a repeated phrase on the dinner page. Pages with two views take longer (12–17 s instead of 5–11 s). `eval:followups`: 45/46 at first; the miss was the eval clicking the first tab on the page, now a view tab, so Go deeper's tab list is named and the eval targets it; the re-run passed 10/10.

## More views in the background, 2026-11-20

Pages with two views took 12–17 s, because one request wrote both. Now a new page asks for its main view only, and right after it appears a second, background request (Luna) sees the page and adds 0–2 views that answer a different question; the component title turns into the first tab in the same place, so nothing moves, and views arriving after an edit are dropped.

Live, ten requests: every page got 1–2 fitting extra views 2.2–4.3 s after it appeared, for example a cycle plus a labelled diagram of the parts (heat pump), a chart plus a map (Europe's cities), a comparison plus a "choose by priority" matrix (iPhone vs Pixel), and a cooking timeline plus quantities and a checklist (dinner). `eval:pages`, now waiting for the background views: 99 % (97/98), median 8.1 s to the first page (Rome and Venice 11.9 s instead of 15.3 s), 13 different components, 12 of 15 pages with views. `eval:followups`: 48/48. Cost: a page with one view makes one more request.

## Views across domains, 2026-11-20

22 new requests in the real app (investing, the heart, a California road trip, adopting a cat, chess openings, EU vaccine approval, electric vs hybrid cars, a wedding toast, the French Revolution, balcony tomatoes, supply and demand, athlete meal prep, the stock market, Alps packing, neural networks, Greek islands), at 1280 and 390 px, with screenshots of every view. Every page loaded with no script errors; all except the wedding toast (correctly a text page) gained 1–2 fitting views 2.5–5 s after the page appeared, using 14 different components (map, timeline, checklist, comparison, matrix, decision tree, hierarchy, graph, worked example, key numbers, practice, prediction, cycle, chart).

Found on the phone and fixed: tabs scrolled out of view ("c vs hybrid") and now wrap; decision-tree branch labels were 8 px and are now at least 12 px, placed above their answers so siblings never collide; the selected place's name on a map covered neighbouring stops and now goes on the freest side inside the map; a tapped tab showed the generic grey button hover. A row of three long tab names wraps to more lines than the title it replaces, so on a phone the page then moves down when views arrive.

## Examples for every component and picker, 2026-11-20

Audit: all 24 components had a when-to-use line but only 9 had an example; 22 of 28 picker types were named in the live-help prompt (language, date_range, geographic_scope, exclusions, comparison_options were not) and few had a when-to-use line. Four component examples were almost the same requests as `eval:pages` prompts (Rome and Venice, a 5K plan, dinner for six, Europe's biggest cities), which flattered that eval; all examples now use other topics, and picker examples use phrases that differ from the test drafts.

Now every component has a one-line request → component example, and every picker type a "type, when (“example phrase”)" line, plus cues for overlapping types ("no / without" is exclusions; "X but Y" is a trade-off). A unit test fails if a component or picker type is added without its line.

| Picker test (28 drafts, one per type, live) | Before | After |
| --- | --- | --- |
| Original drafts | 18/28 | 24/28 |
| New drafts, never seen by the prompt | — | 24/28 |

Remaining misses are mostly overlapping types (audience vs audience and knowledge; depth or length vs output format) plus "in Italian" not highlighted as a language. All 28 pickers write a correct value when used in a browser. `eval:pages` with the new component examples: 99 %, 13 components, 13 of 15 pages with views (same as before, without the eval-matching examples); `eval:followups` 48/48. Cost: the longer live-help prompt moved the first answer from 0.87 s to 1.01 s and the complete answer from 2.32 s to 2.58 s (medians of 11–12).

## Fewer, clearer pickers and a permanent picker check, 2026-11-20

Most remaining picker misses were between types that overlap, so four were merged (28 → 24): exclusions into requirements ("must-haves and must-nots"), audience and prior knowledge into audience (prior knowledge stays its own picker), trade-off into goal comparison ("a choice between two options that each gain one thing and cost another"), and geographic scope into location (the same control). The two controls only those types used (audience-with-knowledge and the two-column trade-off) were removed.

`npm run eval:pickers` now runs both 28-draft sets through the local app (`dev/eval-pickers.mjs`); a unit test keeps every case on an existing type and every type covered.

| Picker check | 28 types, before examples | 28 types, with examples | 24 types |
| --- | --- | --- | --- |
| Tuned set | 18/28 | 24/28 | 25/28 |
| Unseen set | — | 24/28 | 26/28 |

Remaining misses: "an overview" read as depth, "across Europe" and "in Italian" not highlighted, "near the old town" read as a place, "a family of five" read as a duration. Live-help timing: first answer 0.81 s, complete 2.67 s (medians of 12).

## End-to-end review across 20 domains, 2026-11-20

Twenty requests from separate domains (balcony garden, squeaky brakes, exam stress, a German tenant deposit, a startup pitch, seasons, piano scales, exposure in photography, a Tuscan wedding, protein for lifting, kitchen or bathroom first, a Python bug, impressionism, the greenhouse effect, a career switch, fractions for a 9-year-old, wine pairing, a marathon plan, Copenhagen with kids, an emergency fund), each as a full journey in the real app: typed character by character, live question, answer, highlights and Tab, one picker opened, Send, the background views, one follow-up, and Go deeper. Screenshots of every stage at 1280 px (all 20) and 390 px (6), inspected by eye. No script errors; every page gained views; first page 4.9–16 s.

Found and fixed:
- Follow-ups changed more than asked: adding a timeline to the wedding page silently dropped its map and rewrote the takeaways; on the photo and Python pages a follow-up replaced the whole page with one view. Follow-ups now keep the title, introduction, takeaways and other views; with three views already, the preview names the one replaced. Re-run: every follow-up kept the page and added or updated the asked part.
- A view changed in place (new checklist items) gave no sign; it now opens its tab, is highlighted and announced ("Get growing updated").
- Highlights on the main question itself ("What makes impressionism different from realism") or on question words ("How do I"), and audience for non-people ("Italian dishes"): the prompt now forbids these, and a highlight made only of question words is dropped in the app.
- The live answer was cut to its first sentence even when both fitted (the greenhouse answer lost its point); now the whole answer shows when it fits in 160 characters.
- Thin background views (a two-node diagram): a view needs at least three items.
- Found by the follow-up eval afterwards: the 6-item rule made the model merge planets ("Earth and Mars = 1.52"); a chart, spectrum, map or timeline may have 7–8 when the data needs them, and two things never share an item.

Left as is: a question shown while typing can be replaced once right after typing stops, when the answer for the full text arrives (showing questions only for the full text would remove help during typing). Evals afterwards: pickers 25/28 tuned and 25/28 unseen, pages 99 %, follow-ups 47/48 and then 11/11 on the affected scenarios after the item fix.

## Pages that appear while they are written, 2026-11-20

After Send, a new page used to show only "Creating…" for 6–16 s. Pages now stream: the model writes the title first, then the introduction, and the app shows both in their final places with a "Building the visual…" placeholder; the finished page replaces only the placeholder. Measured in the app: title on screen after 1.4–3.5 s, full page after 6–11 s, title moved 0.0 px when the page arrived (desktop and phone). Writing the title first did not slow the page (Athens 13.0 s before, 7–11 s after). Also fixed: sending with ⌘+Enter left the field in its typing state, so the dock jumped down when the page arrived.
