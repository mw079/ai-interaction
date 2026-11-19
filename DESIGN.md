# Design rules

These rules describe how AI Interaction should look and behave today. The history of how they came about is in Git; [STATE.md](STATE.md) describes the product.

## The core rule

**Interactive first, little text at once.** The Kepler slide sets the standard: each law has a tab that reveals one line, and the page ends with three bold-labelled one-sentence takeaways. A visual carries the explanation, and words come one at a time, attached to what you are looking at.

## Composer

- **Start with one empty field.** Partial intent never becomes a form to fill in.
- **Each kind of help has one place:**
  - one optional question above the field
  - one short live answer under it (one sentence, at most 160 characters). With a page open it previews what Send will do ("Will add a worked example…") instead of answering, since Send changes the page.
  - controls on highlighted phrases
  - a grey completion that is only inserted when you accept it with Tab
- **Ask at most one question, and only when it matters.**
  - A missing detail that changes the result comes first (clarify). Otherwise offer a concrete next direction (explore), or ask nothing.
  - When both are open, ask how to show it before who it is for.
  - Never ask again about something already decided this session.
- **One popover at a time,** anchored to its phrase. Hover is a shortcut, never the only way in: every control also opens with a click and from the keyboard (Alt+Down while typing). Escape and Close return focus to the draft.
- **Choosing is committing.** There is no "Use this" step.
  - A single choice applies and closes.
  - Multi-choices (lists, priorities, include/exclude) update the draft live and stay open.
  - A typed answer applies on Enter or the small arrow.
  - The highlighted option is the only indicator of the choice. Clicking it again clears it.
- **Choices stay visible and editable in the draft** as `phrase (value)`. A dotted underline marks a suggestion; a solid underline marks a choice you made.
- **Nothing you didn't do moves the layout.**
  - The field grows only for your own text.
  - Live help never resizes it.
  - With a page open, the screen is split: the page above, the dock below, never overlapping. The page area scrolls on its own and ends at a hairline; the dock holds the live question (above the field), the field and the live answer (below it), all as plain text without cards. Typing grows the dock and the page area shrinks; the page is never scaled or covered.
  - The answer strip under the field is reserved while typing, so an answer arriving never moves Send. Nothing empty is drawn.
  - An empty composer on an open page shrinks to a one-line bar.
- **Stale help never comes back.** Typing clears old answers and questions, and late results cannot overwrite newer input.

## Page

- **The first screen is the answer:** title, a one-sentence intro, the visual and its caption. Nothing should have to be scrolled to understand the point.
- **The visual carries the explanation.** Steps live in component items, and each item's one-sentence explanation shows only when it is selected.
- **Every component has the same anatomy:**
  - the stage, the visual itself, with one item in focus
  - one caption for that item
  - a quiet "2 / 5 ‹ ›" stepper that also responds to the arrow keys
- **Text is short and adds something.** Prose is limited to the intro and up to three "Label: one sentence" takeaways that say what the visual cannot, such as why it matters or a common misconception. The server enforces these limits. Text-first deliverables such as an email are the exception.
- **Say each idea once.** A second component must offer a different activity. Use a cycle only for real loops; one-way steps are a process.
- **Scrolling is optional depth.** Bigger topics continue through Go deeper, not longer pages. Go deeper answers are fetched ahead, open in place one at a time, and can be promoted to a full slide.
- **An interactive visual must be truthful.** When a control changes a quantity, the drawing changes in proportion, on a fixed scale that keeps the comparison readable. A visual must never redraw itself to fit, which hides the change, and only the numbers moving is not enough. Every interactive simulation has a browser test that measures the drawing itself, not just the readout.
- **Explanations sit next to what they explain.** Highlighting text shows an explanation that adds something new. It closes with ×, Escape or by clearing the highlight.

## Change and trust

- **Every change is reversible:** Undo for typing, ← → and History for page versions, Apply or Reject for suggested edits.
- **Suggestions never overwrite your work.**
  - A suggested edit is reviewed next to its passage before Apply.
  - A full page that arrives after you edited waits in a "new version is ready" box, says why, and offers Replace page or Keep current page.
- **Viewing is not editing.** Stepping through a diagram or moving Kepler's sliders never invalidates a pending result.
- **The model supplies data, never code.** Every response passes a strict schema and validation, and the app draws everything with its own components. Text in the page and notes is never treated as an instruction.

## Visual language

- **Each colour has one job.** If everything is coloured, nothing stands out, so colour is kept for meaning:
  - **Grey** for the whole interface: text, borders, cards, panels and the composer controls (pickers). Neutral greys, no tint, on a `#f8f8f8` page with white cards.
  - **Near-black** (`#1d1d1f`) for actions and choices: the primary button, selected picker options, ticked boxes, sliders.
  - **Blue** (`#2f5d8a`, soft `#e6eef6`) only inside visuals, meaning "this is what you are looking at": the selected step, the trajectory, the orbit point, the progress line. Keyboard focus rings use a lighter blue for the same reason. Being the only colour on the page, the visual gets attention first.
  - **Green** (`#2e7d4f`) and **red** (`#b4443c`) only for feedback: a correct or wrong answer, an error, deleted text in an edit review.
- **Colour is never the only signal.** A selected item is also filled, bold or outlined, so the page still reads in greyscale and for colour-blind readers. Blue was chosen over green for the visual accent because it stays distinct from grey, green and red for almost everyone.
- **One shape language:**
  - pill buttons and chips
  - rounded cards (12–18 px)
  - radio dots for single choices, checkboxes for multiple
- **One primary action at a time.** It's a solid near-black pill. Secondary actions are outlined or plain text.
- **Calm motion.** Short fades and slides (around 200–450 ms), all turned off when the system asks for reduced motion.
- **Readable at every size.** Components adapt to their container (visual column, full width or phone).
- **Text meets WCAG AA:** at least 4.5:1 on white and on the grey panels; the blue accent is 6.9:1 on white. Disabled controls, decorative icons and placeholders are the only exceptions.
- **Accessible names stay clean.** Decorative arrows are hidden from screen readers. Never add text to a control's name through CSS.

## References

These shaped the rules above; they are inspirations, not endorsements:

- Bret Victor's [explorable explanations](https://worrydream.com/ExplorableExplanations/): guide attention through a system instead of leaving people in a sandbox.
- Apple's [popover guidance](https://developer.apple.com/design/human-interface-guidelines/popovers) and progressive disclosure: one small surface, anchored to its source, that applies changes without extra confirmation.
- Airbnb's [visual language](https://medium.com/airbnb-design/building-a-visual-language-behind-the-scenes-of-our-airbnb-design-system-224748775e4e): one set of reusable components instead of competing styles.
- Stripe's [accessible colour systems](https://stripe.com/blog/accessible-color-systems): restrained colour with readable contrast.

## Open questions for user testing

- Do people state their intent with fewer corrections, without feeling interrupted?
- Does the live question change the result often enough to be worth showing?
- Does anyone scroll looking for the answer, or miss Go deeper?
- Do the components read without explanation, on desktop and on a phone?
- Is hover discoverable enough, and does anything get accepted by accident?
