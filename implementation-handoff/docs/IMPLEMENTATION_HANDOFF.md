# Implementation Handoff

Last consolidated: 2026-09-21

## Current baseline

- Product name: **CodeScope**.
- Temporary icon/logo: original **Precedify** artwork pending an approved
  CodeScope replacement.
- Runtime: static vanilla HTML/CSS/classic JavaScript.
- Profile count: 35, all in `js/profiles.js`.
- Activity plugins: `token-classification` 1.1.0 and `falling-token-sort` 1.7.0.
- Statement plugins: legacy expression, declaration, assignment, unary update,
  and Program Output.
- Persistence: browser localStorage; no backend database.
- Full test command: `node tests/run-tests.js`.

## Recently completed foundations

### Activity plugin boundary

- Added a separate `plugins/` directory and one subdirectory per new activity
  plugin.
- Kept plugin-specific JavaScript and CSS inside each plugin.
- Centralized every profile in `js/profiles.js`.
- Removed Token Classification's plugin-local profile files and obsolete
  registration path.
- Left the four existing statement plugins in `js/` for a future separately
  approved refactor.

### Program Output content sources

- Added the generic profile content-provider boundary in `js/activity-core.js`.
- Program Output can use profile-selected `source-files` or `generated` content
  without changing its statement interaction contract.
- C and Java source banks live under
  `plugins/program-output/exercises/<language>/<exerciseSet>/`; each
  `manifest.json` alone controls membership and order.
- Runtime parsing supports the current beginner declaration, expression,
  assignment, unary update, `printf`, and `System.out.print/println` subset,
  including multiple identifiers in one output statement.
- Source-backed items store serializable Program IR and retain the established
  final expression check.
- The complete metadata-free source is displayed read-only; source structures
  without registered behavior remain muted. Output variables can be read in
  any order, Guided unlocks their matching combine controls, and Strict exposes
  all unresolved controls. Consumed identifiers remain visible in later rows.

### Identifier activities

- Added Identifier Position, Declaration Token Classification, Chained
  Statement Tokens, and Falling Identifier Sort.
- Classification answers respect syntax position, not just lexical token form.
- Semicolon is supported as Separator.
- Guided/Strict selectable scope, target sets, categories, and consequences are
  granular profile configuration.
- Source UI follows the established IDE-like presentation, permits editing until
  Check, and fully resets on Try again.

### Identifier generation

- Replaced fixed valid/invalid name pools with procedural, seeded proposals.
- Separated generator, analyzer, and feedback responsibilities.
- Added role-based vocabulary, compatible templates, naming styles, invalid
  strategies, weighted selection, length constraints, and session uniqueness.
- C/Java generation and analysis share language catalogs.
- Practice reseeds; Exam persists generated item snapshots.

### Falling Token Sort

- Current profile uses Valid Identifier, Invalid Identifier, and Reserved Word
  buckets in the left region with three visible tokens.
- A mode policy sets one token target per item: a fixed target, an exact rule,
  or a seeded choice from min/max when no target is given. It then
  allocates the target within the category limits. Current Practice
  targets exactly 12 with 3–5 per category; Exam targets exactly 15 with 5 per
  category.
- Uses drag and drop for pointer input, with clickable buckets as a keyboard
  path and the shared trailing connector for that click path.
- Console drawer now contains concise C/Java rules, naming styles, category
  guidance, and the complete active-language reserved-word list.

### Shared shell work already present

- Practice and Exam settings/persistence policy in `js/state.js`.
- Manual student-derived values with responsive origin connectors.
- Compact memory panel and animation speed cycle.
- Strict-sequence invalid-execution policy.
- Feedback drawer auto-open and Practice-only solution toggle.
- Downloadable Score Summary PNG with export-safe score styling.

## Deliberate limitations and deferred work

- Falling Token Sort supports profile-configured visible token counts and
  direct dragging of any arrived token into a bucket. Keyboard users select a
  token before choosing a bucket. Tokens enter the fitted drop area one at a
  time and can be dragged during their slow fall; they bounce and stack at
  varied landing positions when motion is enabled. A profile may choose
  pass-through instead, making unsorted tokens exit below the lane and restart
  from new horizontal positions. A token released outside a bucket continues
  falling from its release point, including after a rejected Practice drop.
- Current statement plugins are not yet moved into plugin directories.
- C and Java identifier analysis intentionally follows the app's documented
  supported character patterns; advanced Unicode and implementation-reserved
  edge cases are outside the beginner profiles.
- There is no server-side account, scoring, or recovery service.
- Browser-local exam data cannot be recovered after local storage is purged.
- A final CodeScope logo has not been approved.

## Known contract discrepancy to verify next

- `plugins/token-classification/feedback.js` still invokes the shared
  `renderItemCelebration()` hook. The approved Token Classification visual
  contract says no confetti. A future implementation should remove or
  explicitly suppress that invocation for this activity after confirming the
  desired treatment of non-confetti achievement badges. Do not treat the
  current call as a product requirement.

## Do not regress

- Do not restore plugin-local profiles.
- Do not classify identifier-position keywords as Reserved Word when the
  contextual answer is Invalid Identifier.
- Do not restore fixed valid/invalid identifier pools.
- Do not regenerate an active Exam after refresh.
- Do not add a second solution control outside the Feedback drawer.
- Do not hide or heavily mute completed source lines.
- Do not leave a completed statement's operator clickable.
- Do not reintroduce purple activity styling or a large duplicated profile
  title.
- Do not make Try again preserve previous answers.

## Recommended first action for the next agent

1. Read root `AGENTS.md` and every linked contract.
2. Run `node tests/run-tests.js` before editing.
3. Inspect the task's relevant plugin/profile and confirm current behavior.
4. State which contract sections the task affects.
5. Implement with regression coverage and run the full suite again.
