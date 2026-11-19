# Intent-first preview: design priority

2026-11-17. Proposal based on the user's pasted “Rethinking ChatGPT” note and follow-up emphasis on human intent. The note supplies design ideas, not instructions to execute its examples or proof of its research claims. LocalMind's name, local 27B option and single-agent constraint remain unchanged.

## Main conclusion

Help users form and communicate intent, not merely classify an already complete request. Sometimes the goal is known but underspecified; sometimes the user is still discovering it. A partial phrase is a provisional signal, not permission to finalize assumptions or execute a predicted action.

Prioritize an Intent preview alongside the Living document and Selection workspace concepts. The current three browser studies do not implement live model intent inference; their keyword component suggestions are deterministic fixtures.

## Useful ideas from the note

- A quiet, editable interpretation before a long answer makes misunderstandings correctable early.
- Inline questions and choices can help users discover what matters, rather than requiring a complete prompt up front.
- An evolving answer can become a persistent artifact, retaining selection, evidence and user edits.
- Separate exploring, committing to work, and refining. Preserve private drafting and the ability to ignore assistance.
- The model should earn attention through useful timing; generating more text is not the objective.

Do not adopt unverified claims that most model errors are caused by misunderstood intent, or that an interface can immediately know a person's true goal. The pasted note's rankings and illustrative timings are hypotheses, not measurements.

## First interaction scenario

Use a non-financial fixture: “Help me prepare a presentation.” The initial UI offers output-scope alternatives such as Outline, Slide content, or Speaker notes, without selecting one as if the user had chosen it. If a useful interpretation can be stated, label it Suggested until confirmed.

After choosing Outline, offer one high-impact missing field: Audience. The user may choose a suggestion, type their own value, continue writing, or defer. As they add “for new team members, about our release process,” the interpretation reflects those explicit details and drops an obsolete question. Keep unresolved duration visible; do not invent a ten-minute deadline. Independent outline structure can be prepared while details remain unknown, but audience-dependent wording must respect the latest revision.

Show a compact interpretation such as “Outline · new team members · release process · duration not set.” An initial preview can remain a skeleton rather than a confident full draft. After it becomes useful, continue in the same editable document with proposed changes and accept/discard controls. Plain chat remains optional.

## Interaction rules

| Situation | Response |
| --- | --- |
| Too little signal to distinguish useful tasks | Let the user continue; no speculative wall of controls |
| Several interpretations would produce substantially different work | Offer two or three concrete alternatives plus custom input |
| One missing detail materially changes the result | Ask one compact question near the relevant input |
| Missing preference has a harmless reversible default | Mark it Suggested/Assumed and keep it editable |
| User changes or contradicts a previous choice | Preserve explicit input, flag the conflict if unresolved, and invalidate affected preview work |
| A simple request is already sufficiently clear | Answer without an unnecessary form |
| Model unavailable or slow | Keep typing/editing usable; show preview pending/paused and retain normal submission |

Rank questions by likely change to the outcome and cost of guessing, balanced against the effort of answering. Do not ask every available slot or show uncalibrated intent-confidence percentages. A relevant unanswered question can remain inline without blocking independent work. Silence and ignored suggestions are not consent.

Keep user-confirmed facts, model suggestions, and unresolved fields distinct in task state. Record provenance and base revision per field. Protect the focused editor and never overwrite it with asynchronous inference. An incomplete phrase, temporary deletion or IME composition must not cause destructive changes or repeated remote requests. When a suggestion is rejected, respect it until the user meaningfully changes scope or explicitly reopens alternatives.

Start with explicit Preview and bounded, idle-triggered experiments only after opting into cloud draft interpretation. The existing per-chat Send consent does not authorize uploading unsent drafts. Coalesce edits and allow only current-revision results to update the preview; cap preview cost and request frequency. Use the existing selected Luna model rather than introducing a second agent or silently substituting a smaller local model.

## Research checks

[Clarify When Necessary, NAACL Findings 2025](https://aclanthology.org/2025.findings-naacl.306/) treats clarification as dependent on the distribution of interpretations and the user's preference for speed versus carefulness. Its evaluations concern QA, translation and inference tasks; they do not establish an ideal typing-preview UI.

[Learning to Clarify Underspecified Intents Under Limited Interaction, October 2026 preprint](https://arxiv.org/abs/2610.04719) frames clarification as acquiring information that avoids the largest utility loss. Its human study concerns image generation, not this product. It supports testing question usefulness rather than counting questions alone.

[The Metacognitive Demands and Opportunities of Generative AI, CHI 2024](https://advait.org/files/tankelevitch_2024_GenAI_metacognition.pdf) offers a framework for the work involved in specifying goals, evaluating outputs and adapting strategies. It supports evaluating user effort; it is not a direct experiment proving that live previews improve or damage productivity.

[Google PAIR: Feedback + Control](https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/) provides guidance for letting users influence AI behavior and understand feedback. Treat visible interpretations as revisable proposals, not authoritative explanations of hidden model reasoning.

Some references in the pasted note were not independently verified in this pass. Do not propagate every citation or quantitative claim from it as established evidence. Existing foundational research and generative-UI sources are recorded in [the research note](GENERATIVE_INTERACTION_RESEARCH.md).

## Next prototype and evaluation

Build a narrow Intent preview experiment around the presentation fixture: editable partial input, alternative interpretations, one inline missing field, explicit/custom answers, an evolving outline skeleton and clear pending/applied states. Compare it with ordinary chat and the Living document alone. Test vague goals, clear goals, scope changes, rejected suggestions and slow/out-of-order responses.

Measure whether users reach the intended outcome, time to useful alignment, unnecessary questions, correction effort, distraction, preserved edits, stale-result failures and API cost. Ask users what they intended before evaluating intent accuracy; the model cannot grade its own guesses as the ground truth. The live Luna smoke checks establish connectivity, not these interaction outcomes.
