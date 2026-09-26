# Behavior Contract

This document records observable product behavior. Refactors must preserve it
unless the user explicitly approves a change.

## Session modes

### Practice

- Practice progress resumes from the same per-student generated snapshot when
  deployment configuration enables Practice persistence. With persistence
  disabled, refresh or login starts a newly seeded Practice session.
- Guided and strict-sequence interaction are available.
- Guided exposes only the profile-defined intended targets/actions.
- Practice strict may expose a broader profile-defined scope. An invalid
  selection pauses the affected work, explains the problem, and offers Undo.
- Immediate correctness may be shown only where the selected profile and
  feedback policy allow it.
- Show correct solution is available only after Check and only in the Feedback
  drawer.
- Reset item returns the current materialized item to its initial state without
  changing its source values. In complete-source modal presentation, this is an
  item-level control below the source workspace and never appears inside a
  statement evaluation modal.
- Try again resets responses, check results, history, visual classifications,
  and completion state for the item. For a source-backed item it rebuilds only
  that manifest entry with a fresh retry seed. Embedded `@seed` directives may
  therefore produce new values; a file without seed directives reloads its
  authored code unchanged. It is not a cosmetic unlock.

### Exam

- Exam policy is snapshotted when the attempt starts. When Exam persistence is
  enabled, it is restored with the saved attempt.
- When enabled, Exam persistence saves original generated items, item language,
  actions, responses, score state, current location, flags, and deadline.
- A resumed saved attempt must not regenerate seeded content.
- A terminal strict-sequence error ends the affected item, retains credit from
  earlier valid actions, and reveals no corrective teaching during the attempt.
- Correct solutions are never available during Exam.
- Feedback follows `feedbackRelease`; before release, drawers must not expose
  answers or correctness.

## Seed and language

- A fresh Practice session receives a fresh session seed and therefore a new
  permutation of generated items. A persisted Practice resume retains its seed.
- Seeded generation is deterministic: the same seed and profile configuration
  reproduce the same item.
- When Exam persistence is enabled, it saves the generated item snapshot, not
  just the seed or progress.
- `state.language` selects C or Java at generation time.
- Every item captures its language. Changing the live setting must not alter an
  already-generated or restored item.

## Source-backed activities

- The active language manifest is the membership and order authority. A source
  file that is not listed is not an item.
- A new session fetches and parses the current listed source files. Supported
  statements, their order, and selection edges are derived from that text; a
  plugin must not rely on a copied raw catalog, fixed statement count, or
  hardcoded jump target.
- `selection.count:'all'` with `scoring.itemCount:'manifest'` makes the current
  manifest length the item and score total. Numeric counts remain valid only
  for an intentionally fixed subset.
- Persisted Exam attempts restore the saved item and Program IR snapshot. Live
  file edits apply to newly generated sessions, never midway through a saved
  attempt.

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
- Declarations with initializers write memory immediately. Mutable declarations
  without initializers create an unset binding that a later plain assignment may
  initialize. Their memory card does not appear before the declaration line is
  evaluated; that action transfers from the source line and inserts the unset
  card in Memory. Constants require initializers, assignments update mutable
  memory, and unary `++`/`--` mutate initialized numeric memory.
- Source-backed programs preserve `int`, `float`, `double`, and `char`
  binding types through expressions, assignments, timelines, and memory cards.
  Character literals keep their single quotes in every learning view except the
  Program Output screen, where only the emitted character is shown.
- Logical `!` derives a Boolean without mutating its source variable. A resolved
  `!` operand therefore renders as the derived literal in later prompts.
- Resolved `++`/`--` results retain the variable identity and updated value.
- Output statements read initialized values from program memory. C resolves
  format placeholders; Java resolves concatenation operators before printing.
- `printf`, `System.out.print`, and `System.out.println` append atomic `PRINT`
  events to the program output buffer. Character playback is presentation and
  does not create additional scoring checks.
- A displayed `\\n` escape cue becomes one real newline in Program Output.
- A Program Output source-file profile uses the active language folder and its
  configured exercise-set manifest. Only manifest-listed files become items,
  in manifest order unless seeded shuffle is enabled.
- Source files are parsed at runtime into the same Program IR used by generated
  items. A statement with multiple values requires a separate memory read and
  placeholder or concatenation resolution for every referenced identifier.
- Output identifiers may be read in any order. Guided unlocks only the matching
  placeholder or concatenation control after its identifier is read. Strict
  exposes every unresolved output control and applies the normal strict policy
  to premature actions.
- Resolving one output value does not remove its source identifier from later
  timeline rows. The exposed variable card retains its name and value while the
  derived value stays associated with its output position.
- Source-backed items display the complete metadata-free source. Structures
  and statements without registered behavior remain present, muted, and
  read-only rather than disappearing or gaining inferred semantics.
- A source-flow profile renders those contextual lines directly within the
  ordered program statement flow, preserves authored line numbers and spacing,
  and adds no synthetic final assignment. In C, an authored exact `return 0;`
  is a direct terminal action that the learner must click; completing it emits
  `RETURN`, finalizes the item, and runs the configured program-completion
  celebration. Java completes after its final authored executable statement
  and does not receive a synthesized return.
- Generated Program Output remains selectable through profile configuration;
  changing content sources does not change statement actions, scoring, Undo,
  output playback, or persistence semantics.

## Selection statements

- Selection lessons are loaded from manifest-listed C or Java source files;
  the initial profile does not generate random selection programs.
- A selection source may opt individual literal `int` declarations into
  deterministic seeding with `@seed <name> min=<integer> max=<integer>` in its
  leading `@codescope` metadata. Unlisted variables and constants retain their
  authored initializers, while derived declarations retain their expressions
  and recalculate from seeded dependencies.
- The profile selects `sourceValueMode:'authored'` or `'seeded'`. Seeded mode
  updates the displayed source, Program IR, memory, conditions, and canonical
  results together. Persisted items retain the materialized source and values.
- `if`, `if/else`, and `else if` conditions reuse the established expression
  substitution and evaluation workflow for relational and Boolean expressions.
- The final condition reduction automatically transfers control to the selected
  authored statement. There is no separate branch button. The chosen branch
  statement uses its registered statement plugin, including the existing
  Program Output interaction for `printf` and `System.out.print/println`.
- A completed condition returns to one compact, source-faithful condition box.
  Only the condition expression is outlined; the statement keyword,
  parentheses, and block brace remain outside as ordinary source. The derived
  Boolean or selector result appears as plain, centered, unboxed text below the
  condition. Multi-character operators retain their literal source characters
  rather than font ligature glyphs. No branch connector is displayed;
  unselected branch content remains visible and read-only.
- Else-if conditions are visited in source order until a true condition is
  reached or the final else path is selected.
- `switch` evaluates its selector and traces to the matching explicit case or
  `default`. The initial lesson supports explicit `break` and does not model
  fall-through.
- A complete-source profile may opt into
  `program.timelinePresentation:'statement-modal'`. The authored source then
  remains one stable file view with its exercise filename, language, continuous
  line-number gutter, preserved whitespace, and source syntax highlighting.
  Only the current executable line is interactive, and evaluation rows are not
  inserted into the source. A statement with one immediately available action
  executes from that line. A statement with learner choices or derivation steps
  opens the detailed trace modal.
- The statement modal reuses the active statement's registered renderer and
  semantic actions. It shows focused program memory and a Program Output
  snapshot. After the statement completes, the modal remains open in a
  read-only completed state until the learner closes it with the visible close
  action or Escape. Closing returns focus to the next executable source line.
  While the modal is open, its memory and Program Output mirrors own value
  transfers, output-command travel, and character playback. The corresponding
  main panels synchronize to canonical program state without a duplicate
  animation. Statements executed directly from the source keep the main memory
  and Program Output panels as their animation destinations.
- Main program memory and Program Output share a docked context rail. At phone
  widths they share one tabbed viewport: binding reads and writes activate
  Memory, while `PRINT` activates Output. Learners may also switch either tab
  manually. The same semantic switching applies to the modal mirrors so a
  hidden panel is made visible before transfer endpoints are measured.
- A selection modal shows only the condition or selector expression. The full
  `if`, `else if`, or `switch` statement remains visible in the stable source
  view and is not duplicated inside the close view.
- Source flow auto reveal belongs only to the source code viewport. It runs only
  when the destination line is outside that viewport. Wheel, touch, scrollbar,
  or keyboard scrolling during a highlight transition transfers scroll control
  to the learner: the transition still completes, but its final render and focus
  preserve the learner's viewport instead of snapping to the active line.
- Profiles that omit `timelinePresentation` retain the established inline
  timeline.

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

## Activity size preference

- Activity zoom is presentation state. Changing it must not regenerate an
  item, change answers, advance program flow, affect scoring, or alter Practice
  or Exam persistence.
- The shell clamps the configured percentage to the declared minimum, maximum,
  and step. The preference is keyed by normalized student email and is restored
  when that student starts or resumes a session on the same browser.
- Clearing all local application data removes activity-size preferences and
  restores the configured default. Resetting only application settings does not
  impersonate or merge one student's preference with another student's.
