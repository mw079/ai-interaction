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
