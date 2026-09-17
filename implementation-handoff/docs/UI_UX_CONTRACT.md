# UI/UX Contract

## Shared visual language

New activities must look like members of the existing application.

- Use the dark IDE-like canvas, mono source typography, thin borders, muted
  secondary text, orange active state, teal success, and red error tokens from
  the shell design variables.
- Do not introduce a separate purple visual system.
- Do not mirror the profile name as a large activity-card title. The shared
  session header already identifies the profile.
- Do not add decorative confetti to Token Classification or Falling Token Sort.
- Use Font Awesome icons already loaded by the shell; do not add another icon
  library for a plugin.
- Preserve the original Precedify icon until a CodeScope logo is explicitly
  approved.

## Source and code presentation

- Source text is readable from the initial state; inactive does not mean
  illegible.
- Tokens use light, visible separation so the line reads as one continuous code
  statement without appearing cramped.
- Multiple statements use IDE-style line numbers rather than colored numbered
  badges.
- Unanswered, partially answered, and fully answered line states may tint the
  line number, but should not overpower the active token.
- Completed statements remain readable. Do not aggressively collapse or mute
  them as though they are void.
- Classified tokens retain syntax-category colors before and after Check.
- After Check, use thin muted green or red underlines as an additional
  correctness cue. Incorrect tokens use a restrained wavy red underline.
- Completion is communicated through line/progress state; do not show a green
  correctness check before verification.
- Shared top progress dots remain present where the established activity layout
  uses them.

## Selectable elements

- Reuse the established muted-clickable token treatment, hover, focus, and
  dashed affordance. Do not introduce unrelated selectable-card styling.
- Guided mode exposes only profile-defined intended targets.
- Strict mode exposes only the profile-defined strict scope; strict never
  implies a hardcoded category set or universal all-token selection.
- Completed or consumed controls are disabled immediately. An element from a
  previous statement must not remain clickable.
- Keyboard activation and visible focus are required for every clickable token
  or bucket.

## Modal workflow

- Token Classification uses the existing origin-aware modal workflow rather
  than drag-and-drop.
- The modal grows from the selected source token and initially has no selected
  answer.
- Confirm remains disabled until the learner chooses an option.
- Modal source operands and operators are reference-only: no click, hover,
  focus, keyboard, or active-pointer affordance.
- Evaluation/update connectors begin at the actual source operator and curve to
  the destination border. They terminate with a dot, not an arrowhead, and use
  the relevant step color.
- Assign and Read use a single enlarged destination/named card. A plain assign
  does not show an invented source or connector.

## Drawers

- Profile navigation stays in the existing profile sidebar.
- The Console drawer provides neutral lesson/rule guidance. It must not reveal
  the current answer during an unreleased Exam.
- The Feedback drawer owns post-check analysis and correct-solution disclosure.
- Feedback auto-opens after Check when allowed.
- Drawer contents must wrap on small screens and avoid horizontal scrolling.
- Identifier activities hide the memory panel because lexical tokens are not
  runtime memory bindings.

## Memory panel and animation

- Constants appear before variables; mobile supports a compact four-column
  arrangement where content permits.
- Per-card hint text/icons stay removed; animation and consistent color carry
  the context.
- The header animation control cycles Off → 1s → 2s → 3s → Off.
- Off disables transfer travel but not the value-roll update.
- Transfers in both directions use the selected duration.
- Curved comet/trailing-line transfers should be reused by compatible plugin
  interactions rather than inventing a separate flight animation.
- Falling Token Sort uses the available vertical space for its token area.
  Tokens drop one at a time at varied horizontal positions, bounce, and stack
  when their landing positions overlap. Each token keeps its seeded text on one
  line at its natural width and remains selectable while falling. Animation Off
  and reduced motion show the tokens at rest.

## Actions and lifecycle

- Undo is an icon-only low-emphasis action at the latest active line when
  available.
- Check appears only when all required responses are complete and no known
  wrong-state UI is being misrepresented as merely “ready.”
- Learners may revise responses until Check.
- Try again appears after a checked Practice item and performs a full reset.
- Feedback, solution, and celebration state must clear when navigating or
  retrying.

## Score Summary

- The visible score is mandatory in both the dialog and its downloaded image.
- The PNG is a mirror of the capture element; export-specific styling must not
  hide or replace score text.
- Use solid export-safe colors. Avoid text gradients or transparent clipped
  text that `html2canvas` may omit.
- Practice and Exam summaries may use distinct solid backgrounds, and that
  distinction must appear in the downloaded PNG.
- The Download PNG action is visually prominent and keyboard accessible.

## Responsive acceptance

Every UI change must be checked at desktop width and at approximately 390 px
mobile width. Verify readable text, reachable actions, wrapping, modal fit,
drawer scrolling, and absence of page-level horizontal overflow.
