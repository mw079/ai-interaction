# A calm surface for developing intent

Design revision: 2026-11-17.

## Interaction decisions

Start with one empty field. Once someone types, keep the composer at the same vertical origin as short assistance appears below it. Do not turn partial intent into a form to complete.

Give each kind of help one place:

- The uncertain phrase has a subtle highlight and dotted underline. Hover can expose its interpretation choices. A small contextual Refine control in the composer provides the same action for click, touch, and keyboard. Alt+Down while typing is another keyboard route.
- One anchored nonmodal popover holds one question and a short vertical list of choices. Selecting a choice updates the same input and returns focus to writing. Do not duplicate the options below the composer or open a second clarification over the first.
- Custom input appears only after Something else. Unsubmitted custom text is retained per question in tab memory when the card is dismissed. It is not applied to the task or sent to a model until explicitly submitted.
- A brief provisional answer remains glanceable below the field, with an honest demo/live source label. It is capped at 240 characters with word-boundary truncation. Secondary status is available to assistive technology; errors remain visible.
- The circular arrow in the composer explicitly requests the full interactive page. It has an accessible action name, tooltip and keyboard shortcut. The small mode control sits beside it; connection settings explain privacy, models and budget.

The full-page components and Luna/Terra routing are unchanged by this visual pass. No automatic Terra invocation or new credential access is introduced.

## Popover behavior

Anchor to the highlighted phrase when opened through hover, or to the Refine control when clicked/focused. Choose above/below placement based on available space, clamp horizontal position, and point the arrow back toward its source. Reposition on viewport changes.

Keep the surface alive while the pointer moves from its anchor into the card, and while a custom field has focus. Do not rebuild it on every pointer movement. Ignore hover activation during text dragging and on touch. Escape and Close dismiss it and restore focus for explicit opens; outside clicks dismiss without stealing the new target's focus. Arrow keys navigate choices, native Enter activates them, and ordinary typing continues to edit the input. Reduced-motion users do not need to wait for decorative transitions.

Keep one transient choice style across demo phrase rules and live model questions. For a general question without a specific phrase, use the same Refine control as the anchor. On narrow screens the card fits inside viewport margins; essential functionality never depends on hover.

## References and application

- [Apple: Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers): small temporary tasks, source anchoring, one surface at a time, appropriate dismissal and preservation of work. Applied to the clarification lifecycle rather than copying native visual chrome.
- [Airbnb Design: Building a Visual Language](https://medium.com/airbnb-design/building-a-visual-language-behind-the-scenes-of-our-airbnb-design-system-224748775e4e): cohesive reusable components and shared foundations. Applied to one consistent choice control instead of independent chips, forms and hover cards competing for attention.
- [Stripe: Designing accessible color systems](https://stripe.com/blog/accessible-color-systems): readable contrast and meaningful color use. Applied to the restrained green/neutral palette; labels and underline also communicate state.
- User-supplied local references: Emil's Apple Design and Impeccable's craft floor under `ed-sim/design-skills`. No installers or hooks run.

These are implementation choices inspired by those resources, not claims that the companies evaluated or endorsed this design. Verify usability with actual users.

## Verification for this revision

Fourteen Node checks pass, including three viewport-placement cases. Browser verification covered an initially empty field, no inline choices after typing, Alt+Down opening, Escape/focus restoration, custom draft retention after dismissal, applying custom input to the current thought, and the full-page arrow transition. The composer top remained exactly the same before and after typing. At a 375px viewport the popover stayed within the viewport and document width equaled viewport width. Checked text/foreground contrast pairs range from 4.53:1 to 10.57:1; the main action is 8.35:1. Hover activation is implemented through pointer hit testing; the automation checked the equivalent keyboard/click route. Live-model/API behavior is unchanged and was not newly exercised with a key.

Committed requests turn the output into the main canvas: a page-wide artifact with a bottom input dock. The first result opens directly. Later changes are suggestions with explicit replacement and undo. Text, edited fields and notes feed the next request; quick typing previews remain small. Travel/planning gets editable preferences, not a decorative diagram. Missing preferences stay empty and suggestions belong in the explanatory content. The user retains a text input alongside direct manipulation.

Information controls are semantic templates: one stable family per information type, populated with contextual model suggestions. Preserve a confirmed phrase and its parenthetical value as an editable anchor. Dotted underlines indicate proposed refinements; solid underlines indicate explicit choices. Neither an answer transcript nor a hidden assumed format should replace intent. Offer a small number of useful details rather than displaying the full catalog. Native dates and numerical entry handle validation; all families retain custom entry.

Next proposed living-page behavior: immediate deterministic controls; Luna for a committed inline semantic edit or question; Terra for a main-composer Send. Both model-driven paths should preserve history and revert, and use page revisions so late results cannot overwrite newer edits. This routing is a proposed next increment, not claimed as implemented.

The local comparison now contains five working variants, not simulated screens. Focus keeps the baseline quiet; Complete prioritizes a continuation over redundant live-answer text; Lens scopes help to a selection; Notebook moves local revision suggestions to a margin; Canvas exposes a proposed structure and reading/exploring views. Design switching preserves the common task state. A preferred-design choice persists only the design identifier, not document content. Model-driven local edits remain explicit, bounded and undoable.

## One composer — 2026-11-18

The current app merges the experiments into one composer. Questions above; short answers below; intent summary inside the bottom edge; refinements on phrases; sage continuation when editing at the end. A question is not required just because an optional preference could be refined. The intent card provides access to all current controls without a duplicated phrase rail. Hover is an accelerator, with click and keyboard alternatives.

Do not make every feature visible simultaneously. Autocomplete yields to an open popover or selection help; only one question is shown. The live outline is deferred to avoid duplicating answers. Assistance immediately clears after typing changes, and old model results cannot reappear over newer input. Existing living-page capabilities are preserved without extending their scope in this pass.

Potential next composer experiments, not implemented: (1) a tiny preview on hovering a response-format option; (2) a subtle contradiction marker with two ways to resolve it; (3) an “only this request” versus remembered preference choice; (4) an undo for the last refinement or accepted completion; (5) a per-request pause for live help. Keep these contextual rather than adding five toolbar buttons.

Next usability check: compare whether people can state intent with fewer corrections without feeling interrupted. Watch irrelevant questions, layout movement, accidental acceptance, hover discoverability, mobile access and the time to reach a useful answer. No usability benefit is claimed as proven by implementation.

### Composer stability correction

Autocomplete belongs on the existing text layer, not a conditional row that moves controls on focus changes. Show it only when the full suggestion fits; otherwise suppress it. Reserve the footer geometry even while help is hidden. Resize the field for user-authored text, never for model output. Click on a hover-opened intent card pins it open rather than toggling it closed. Escape/outside click dismisses. These behaviors fix the interaction, not only the styling.

### Compact starting height

The composer starts with one 28 px text line, plus its stable footer. Measure only typed text for growth; remove the two-row native default and fixed 104 px text-area minimum. Collapsing before measurement allows shrinking after deletion as well as growth. Autocomplete remains an overlay and yields when it cannot fit rather than adding empty space.

Editable intent separates inference from confirmation. Keep the inferred summary quiet, expose Edit in its card, and label a saved correction Your intent. Model refreshes must not overwrite explicit user intent or unsaved editor text. Save updates the background task context and triggers fresh assistance; Cancel changes nothing; Use suggested intent removes the override. The main writing surface keeps its dimensions throughout.

### Streaming and clarifying questions

Show one optional, useful question above the composer; teaching audience or knowledge level often matters before response format. Read the whole draft, edited intent and confirmed choices before asking. A known level is not a reason to repeat a level question. Model-generated contextual descriptors provide the questions and choices; a hidden control is not a visible question.

Stream bounded answer/question text through SSE. Before final validation, streamed question text is provisional and its button is disabled. Final structured validation enables the appropriate controls and highlights; a failed stream clears provisional help. Existing revision/abort guards apply to every partial update. This improves time to first visible assistance without executing generated markup or growing the composer.

When two model descriptors overlap, retain exact source anchors where possible: a teaching verb can anchor audience while the topic anchors format; otherwise use an uncovered exact fragment. This is placement repair for existing model-provided controls, not generation of new questions or hardcoded response options. Do not force extra controls when the intent already resolves them.

### One question, two purposes

The composer has one question slot above the field. A missing detail that changes the answer takes priority (`clarify`). When intent is sufficiently clear, Luna can offer a concrete next direction (`explore`). Empty is valid: avoid filler questions for greetings and fully exhausted directions. Open choices only on hover/click; keep choices in request context, rather than appending a Q/A transcript. An exploratory choice steers the next preview and Send without executing a page update.

Live answer, question, refinements and optional completion share a request after 1.1 seconds of inactivity. Typing invalidates the previous preview. The answer and question stream; completed, validated options and completion activate afterwards. Completion is never inserted without acceptance.
