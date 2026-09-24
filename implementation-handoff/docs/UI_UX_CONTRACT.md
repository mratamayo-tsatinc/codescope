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
- Source-flow program activities render the immutable, metadata-free file in
  `program-statement-flow`. Each row uses its authored line number and preserves
  indentation and blank lines. Unsupported scaffolding or statements are muted
  but remain visible. Evaluation rows may show derived values, but retain
  consumed source identifiers so the authored command never appears to have
  changed.
- Resolving an output placeholder draws the timeline transition from that
  placeholder to its replacement in the next row. The resulting row also draws
  a binding-colored connector from the retained source variable card, including
  its name and value, to the inserted value. It is routed below the code to keep
  the two relationships visually separate.
- Classified tokens retain syntax-category colors before and after Check.
- After Check, use thin muted green or red underlines as an additional
  correctness cue. Incorrect tokens use a restrained wavy red underline.
- Completion is communicated through line/progress state; do not show a green
  correctness check before verification.
- Selection conditions reuse the expression timeline, value cards, step colors,
  line numbers, and connector curves. Opening and closing condition parentheses
  share one syntax treatment. Variable substitutions and operator reductions
  use the condition panel's local coordinate plane, and a derived value uses the
  same color as its producing operator and connector.
- After the last condition reduction, only the condition expression receives a
  color-coded rounded outline. The `if`/`else if`/`switch` keyword,
  parentheses, and block brace remain outside it. The derived Boolean or
  selector value appears as plain centered text below the condition, with no
  tab outline. Disable code-font ligatures and contextual alternates in active
  and completed conditions so `>=`, `<=`, and `!=` remain literal operators.
  Do not draw a branch connector. The selected statement uses its registered
  renderer; untaken branches remain readable muted source context.
- Shared top progress dots remain present where the established activity layout
  uses them.
- Complete-source lessons that opt into statement-modal presentation keep the
  full source visually stable inside one IDE-like file panel. Its header shows
  the actual exercise filename and language; a continuous gutter holds authored
  line numbers, and blank lines, indentation, syntax colors, and horizontal
  scrolling remain contained within the code viewport.
- Only the current executable source row receives an orange marker, restrained
  background, and trace action. The entire active row is one keyboard-accessible
  control. Completed state and retained condition results may appear in a small
  trailing status area without changing the source text or dividing the file
  into statement cards.

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
- The active source line uses a play cue when clicking it performs one direct
  statement action and an expand cue when clicking it opens a multistep trace.
- A statement trace modal is a close view of one active source statement. It
  uses the registered statement renderer, keeps the source line number and
  statement kind in its heading, and places focused memory and output context
  next to the trace on desktop. A selection close view renders the condition
  expression alone; it does not repeat `if`, parentheses, or the block brace.
- The statement trace modal is full-screen on narrow mobile viewports and has a
  backdrop plus a two-action footer. `Back to source` dismisses the close view;
  `Continue program` stays disabled until the statement and any output playback
  finish. Do not use an icon-only X or backdrop click as the primary close UI.
  Escape follows the Back behavior.
- Completing the active statement advances the semantic program while keeping
  the modal open as a read-only completed trace. A concise completion note asks
  the learner to review the result. Dismissal then starts a visible source-line
  transition and returns focus to its destination. Output playback remains
  visible in the main Program Output panel after the modal closes.
- Source flow never snaps directly between executable lines. A direct action
  completes its statement-to-memory transfer and value roll, or its output
  feedback, before any source rerender or line movement. A modal action waits for
  dismissal and a modal-close settling pause. The completed origin and derived
  result receive a readable hold before the full active-line highlight travels
  between authored line positions. The destination remains visually neutral
  until the highlight arrives, then becomes the sole active line. No separate
  line-number marker or simultaneous destination highlight is shown. The motion
  must represent branch skips and future backward loop edges. Reduced-motion
  mode preserves the same ordering with a short highlight fade.
- An active C `return 0;` source row uses the direct-action cue. Clicking it
  intentionally finishes the program and anchors the configured completion
  celebration at that source row.

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
- Memory cards map one-to-one to actual program storage bindings. Source-flow
  activities use the declarations parsed from the live exercise and do not add
  a synthetic result card; a generated legacy-expression target appears only
  when that statement is present and its identifier is not already declared.
- Variable and constant labels preserve the exact source spelling and casing.
  C and Java identifiers must never be uppercased for presentation.
- Per-card hint text/icons stay removed; animation and consistent color carry
  the context.
- The header animation control cycles Off → 1s → 2s → 3s → Off.
- Off disables transfer travel but not the value-roll update.
- Transfers in both directions use the selected duration.
- Programs containing output statements show one cumulative Program Output
  panel. Desktop places it beside the statement flow when space permits;
  mobile places it above the flow without horizontal page overflow.
- Output command execution reuses the curved transfer cue, then reveals text
  character by character. Escape notation is exposed before its control effect;
  reduced motion reveals the completed event immediately.
- Curved comet/trailing-line transfers should be reused by compatible plugin
  interactions rather than inventing a separate flight animation.
- Falling Token Sort uses the available vertical space for its token area.
  Tokens drop one at a time at varied horizontal positions, bounce, and stack
  when their landing positions overlap. Each token keeps its seeded text on one
  line at its natural width and can be dragged into a bucket while falling.
  Touch and mouse gestures use the same drop targets; keyboard selection and
  bucket activation remain available. Animation Off and reduced motion show
  the tokens at rest.
- Bucket regions use the available vertical span on the left or right and the
  available horizontal span on the top or bottom. Releasing a token outside a
  bucket, including a rejected Practice drop, continues its fall from there.
- The profile may instead use pass-through motion: a token leaves below the
  area and starts another fall at a new horizontal position. It remains
  draggable on every pass.

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

- The profile sidebar groups profiles under expandable categories. Each
  profile belongs to exactly one category configured in `js/profiles.js`.
- Category headers keep their names and score badges readable without breaking
  words. Their compact QR action has an accessible label and tooltip.
- Expanded profiles use an indented navigation rail. The current profile uses
  a restrained background and left marker instead of a second bordered card.
- Category score links open a score summary and QR code for that category's
  profiles. The header opens the overall summary across all active profiles.
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
