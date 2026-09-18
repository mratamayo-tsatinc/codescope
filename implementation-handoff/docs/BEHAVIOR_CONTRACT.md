# Behavior Contract

This document records observable product behavior. Refactors must preserve it
unless the user explicitly approves a change.

## Session modes

### Practice

- Guided and strict-sequence interaction are available.
- Guided exposes only the profile-defined intended targets/actions.
- Practice strict may expose a broader profile-defined scope. An invalid
  selection pauses the affected work, explains the problem, and offers Undo.
- Immediate correctness may be shown only where the selected profile and
  feedback policy allow it.
- Show correct solution is available only after Check and only in the Feedback
  drawer.
- Try again resets responses, check results, history, visual classifications,
  and completion state for the item. It is not a cosmetic unlock.

### Exam

- Exam policy is snapshotted when the attempt starts and restored with it.
- An active attempt persists its original generated items, item language,
  actions, responses, score state, current location, flags, and deadline.
- Reload or login resume must not regenerate seeded content.
- A terminal strict-sequence error ends the affected item, retains credit from
  earlier valid actions, and reveals no corrective teaching during the attempt.
- Correct solutions are never available during Exam.
- Feedback follows `feedbackRelease`; before release, drawers must not expose
  answers or correctness.

## Seed and language

- A fresh Practice session receives a fresh session seed and therefore a new
  permutation of generated items.
- Seeded generation is deterministic: the same seed and profile configuration
  reproduce the same item.
- Exam saves the generated item snapshot, not just the seed or progress.
- `state.language` selects C or Java at generation time.
- Every item captures its language. Changing the live setting must not alter an
  already-generated or restored item.

## Scoring principles

- Score semantic actions/checks once through the canonical assessment model.
- Do not infer correctness from DOM classes, colors, animations, or completion
  icons.
- Correct steps after an earlier non-terminal wrong-order step may still earn
  credit.
- An executable but lower-precedence operation is not automatically a terminal
  error. Genuinely unavailable operands or premature writes may be terminal
  under strict Exam policy.
- Final-value credit is independent of individual operation-order credit.
- Bonus checks are explicitly declared by a profile and remain visible in
  feedback as bonus checks.

## Student-derived values

- Manual response eligibility is controlled by session settings and profile
  quotas.
- Read responses do not change program memory.
- Declaration, assignment, and update responses write their submitted values to
  memory when the semantic action is a write.
- A syntactically valid but incorrect submitted value propagates through later
  work and is scored once.
- Declaration and plain `=` writes remain manually eligible when selected by
  the response plan.
- Boolean responses use an unselected TRUE/FALSE control. The selected option
  is filled with the relevant source operator, source binding, or destination
  binding color.

## Program statements

- A program advances only after the active statement reports completion.
- A completed statement's actionable elements are disabled before the next
  statement becomes active. Previously used `=` operators must not remain
  clickable.
- Declarations initialize memory; assignments update mutable memory; constants
  reject writes; unary `++`/`--` mutate memory.
- Logical `!` derives a Boolean without mutating its source variable. A resolved
  `!` operand therefore renders as the derived literal in later prompts.
- Resolved `++`/`--` results retain the variable identity and updated value.

## Token Classification

Canonical classification is contextual, not merely lexical.

- The analyzer knows lexical form, language reserved words, syntax position,
  contextual category, and structured violations.
- Example: Java `class` is lexically a reserved word. In a declaration-name
  position it is contextually an invalid identifier. A profile assessing that
  position expects `invalid-identifier`, not `reserved-word`.
- A reserved-word answer is valid only when the syntax position represents a
  reserved-word role.
- Semicolon is selectable where the profile includes it and is classified as
  `separator`.
- Students can change a token classification until Check.

### Identifier Position profile

- Guided exposes only the declaration-name target.
- The answer set is Valid Identifier or Invalid Identifier.
- Target selection is a one-weight bonus check; classification has weight two.
- Strict scope is profile-configurable. In the current profile, selecting an
  off-target token blocks with Undo in Practice and terminates the item in Exam.

### Declaration Token Classification

- Every configured syntax position is classified contextually.
- Current categories are valid identifier, invalid identifier, reserved word,
  operator, literal, and separator.

### Chained Statement Tokens

- Uses the same contextual rules across linked declarations and assignments.
- Declaration identifiers are reused intentionally by dependent assignment
  statements; this is program continuity, not a uniqueness failure.

## Falling Token Sort

- Buckets, categories, regions, order, item token targets, category limits,
  mode policies, and scoring are
  profile configuration rather than plugin-name conditions.
- The current profile shows three tokens at a time. Students drag an arrived
  token directly into a bucket; a newly available token appears after placement.
  Keyboard users can select a token, then choose a bucket.
- Profiles configured with one visible token retain direct bucket selection.
- Current buckets are Valid Identifier, Invalid Identifier, and Reserved Word,
  all in the left region.
- Each item receives one seeded token target before category counts are
  allocated within their configured limits. Current Practice targets exactly
  12 per item with 3–5 per category; Exam targets exactly 15 with 5 per category.
- The count badge reports tokens already placed into each bucket.
- The transfer uses the shared curved trailing-line visual language.
- Newly visible tokens enter one at a time from varied horizontal positions,
  fall slowly, and bounce on landing. Unsorted tokens pile where their landing
  positions overlap. A falling token can be selected and sorted before landing;
  scoring does not wait for the animation.
- Other scheduled tokens keep entering while one token is dragged. A drop
  outside a bucket or a rejected Practice placement continues the token's
  fall from its release point.
- Sorting one token preserves the positions and fall phases of the other
  visible tokens.
- The profile chooses `stack` or `pass-through` landing behavior. Stack leaves
  unsorted tokens at the bottom; pass-through repeats the fall from a new
  horizontal position until the token is sorted. Omitted behavior means stack.
- The Console drawer presents neutral C/Java identifier guidance and the actual
  reserved-word catalog without revealing the current token's answer.

## Feedback and solution disclosure

- Feedback auto-opens after Check when release policy permits.
- Show/Hide correct solution is the existing toggle in the Feedback drawer; do
  not add a duplicate control in the activity workspace.
- Exam never exposes this toggle.
- Activity feedback must be readable on desktop and mobile and must wrap rather
  than create horizontal overflow.
