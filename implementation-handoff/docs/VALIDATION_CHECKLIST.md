# Validation Checklist

## Automated gate

Run from the project root:

```bash
node tests/run-tests.js
```

The implementation is not complete unless the command exits successfully with:

```text
All CodeScope compatibility and extension tests passed.
```

Do not replace full-suite validation with a targeted test. Add targeted
coverage, then run the full suite.

## General regression checks

- [ ] `index.html` loads every classic script after its dependencies.
- [ ] All profiles are declared in `js/profiles.js`.
- [ ] No plugin contains a local `profiles/` directory.
- [ ] Legacy expression generation and snapshot hashes remain unchanged unless
      the task explicitly changes them.
- [ ] Practice and Exam settings are snapshotted at session start.
- [ ] Practice and Exam persistence switches operate independently. Disabled
      modes start fresh; enabled modes restore the same generated items,
      responses, policy, and item position.
- [ ] Existing saved Exam attempts resume without regenerated items.
- [ ] Console guidance remains neutral during unreleased Exam work.
- [ ] Correct solution remains unavailable in Exam.
- [ ] Desktop and mobile layouts have no page-level horizontal overflow.
- [ ] Mouse, keyboard, focus, and disabled states agree.

## Legacy/program activity scenarios

- [ ] Declaration followed by assignment disables the completed declaration's
      `=` control before the next statement activates.
- [ ] Compound assignment performs explicit read–modify–write and updates
      memory once.
- [ ] A valid wrong manual response propagates and receives one score result.
- [ ] Resolved logical `!` appears as a Boolean literal in later prompts.
- [ ] Resolved `++`/`--` retains the named binding and updated value.
- [ ] Boolean selected controls use a filled contextual accent color.
- [ ] Manual connectors start at the operator and end with a dot at the
      destination border.
- [ ] The Output Statements profile builds three declarations, four output
      statements, and the established final expression check in both languages.
- [ ] C requires memory read then `%d`; Java requires memory read then `+`.
- [ ] Each output command appends one persisted `PRINT` event, and Undo/Reset
      reconstruct the cumulative Program Output text.
- [ ] Character playback applies `\\n` as one newline and respects reduced
      motion; it never changes scoring.
- [ ] Program Output is beside the flow on desktop and above it near 390 px.
- [ ] Source-file mode loads only manifest-listed exercises from the active
      C/Java language folder and preserves manifest order unless seeded shuffle
      is configured.
- [ ] A Program Output statement with three identifiers creates three memory
      reads, three value-resolution steps, and one `PRINT` event.
- [ ] Guided permits output identifiers in any order and unlocks only the
      combine control paired with each retrieved value.
- [ ] Strict exposes unresolved identifiers, combine controls, and the output
      command; premature actions use strict invalid-execution handling.
- [ ] After one value resolves, its exposed source variable card retains both
      its name and value in every succeeding timeline row.
- [ ] Resolving an output placeholder connects the placeholder across rows and
      separately connects the retained variable to the inserted value along the
      bottom of the resulting row without crossing the transition line.
- [ ] Source Program Output renders the complete metadata-free file inside the
      statement flow with authored line numbers, indentation, whitespace, and
      blank lines.
- [ ] Headers/imports, wrappers, braces, returns, and unsupported statements
      remain in their source positions as muted read-only lines.
- [ ] Source Program Output adds no synthetic final assignment and finalizes
      scoring after the last authored executable statement.
- [ ] Source Program Output uses the Code Simulator provider with the
      `program-output` source library, preserves the formatted-output manifest
      order in C and Java, uses authored values, and opens multistep statements
      through statement-modal presentation.
- [ ] Generated Program Output mode still delegates to seeded profile
      generation and produces the same statement interaction contract.
- [ ] A serialized source-backed item contains complete Program IR and restores
      without reparsing changed source into the active Exam.
- [ ] `selection.count:'all'` with `scoring.itemCount:'manifest'` loads every
      current manifest entry and derives the item and category score totals from
      that manifest length.
- [ ] Editing a listed live source file changes newly generated statements and
      control-flow edges without a JavaScript catalog change; an unlisted file
      remains absent.
- [ ] Code Simulator accepts a manifest-listed program without requiring a
      declaration or selection statement. Declarations, assignments, unary
      updates, output, selections, and C return statements are interactive when
      present; unsupported source remains visible and muted.
- [ ] A file with no supported executable statement reports that specific
      limitation instead of requesting a lesson-specific statement shape.
- [ ] The current selection-basics manifests produce four ordered C or Java
      source-backed items:
      `if`, `if/else`, `if/else if`, and `switch`.
- [ ] In seeded source mode, each `@seed` binding stays within its embedded
      inclusive range; the same session seed reproduces the same materialized
      source, and another seed can change it.
- [ ] Unlisted variables and constants keep their authored values. Derived
      initializers keep their expressions and recalculate from seeded values.
- [ ] Authored source mode ignores random replacement while still validating
      malformed, duplicate, unknown, and nonliteral `@seed` directives.
- [ ] The source shown to the learner, Program IR, memory, conditions, canonical
      results, and persisted item snapshot contain the same materialized values.
- [ ] Relational and Boolean conditions use the shared expression timeline;
      variable and operator connectors stay within that panel's coordinate
      plane, and derived values match their producing operation color.
- [ ] The final condition reduction advances automatically. The completed
      condition expression alone receives a result-colored rounded outline;
      source keyword, parentheses, and brace remain outside. The centered
      result appears below as unboxed text, and multi-character operators such
      as `>=`, `<=`, and `!=` remain literal characters. There is no separate
      branch button.
- [ ] No connector is drawn between the completed condition and its selected
      executable statement. The target uses its registered renderer; untaken
      branch lines remain visible, muted, and inert.
- [ ] A false first condition advances to the next `else if`; a true condition
      exits the chain. Switch selects the matching case or `default` and honors
      explicit `break` without fall-through.
- [ ] The Code Simulator profile renders one stable, complete source program and
      exposes an action only on the current executable line; no expression
      timeline is inserted into the main source flow.
- [ ] The complete source is one bordered file panel showing the real exercise
      filename, language, every authored line and blank line, preserved
      indentation, syntax highlighting, and a continuous IDE-style gutter.
- [ ] The active source row is the sole keyboard-accessible trace control and
      uses a restrained full-row highlight. Horizontal scrolling stays inside
      the source viewport on desktop and near 390 px width.
- [ ] A literal declaration and literal-only output statement execute directly
      from their active source line, advance once, and preserve their memory or
      Program Output animation origin. They do not open the trace modal.
- [ ] A multistep active line mounts its existing registered renderer in the
      shared statement modal with focused memory and Program Output context.
      Memory-to-expression transfers use the modal memory cards.
- [ ] During modal evaluation, write-back travel and value rolls end at the
      modal memory card, while output-command travel, character playback, and
      newline cues occur in the modal Program Output mirror. The main panels
      synchronize without duplicate travel or playback. Direct source actions
      still target the main panels.
- [ ] On desktop, program Memory and Program Output are both docked beside the
      statement flow and the memory panel cannot be dragged over activity
      content.
- [ ] Near 390 px, Memory and Output share one tabbed context panel in the main
      workspace and statement modal. Manual switching works; a binding read or
      write selects Memory, and print execution selects Output before its
      transfer and character animation begin.
- [ ] A selection trace renders only its condition or selector expression; the
      modal does not duplicate the source `if`/`else if`/`switch` wrapper.
- [ ] Completing a statement leaves the trace modal open in a read-only
      completed state with its final derivation visible. `Continue program` is
      disabled until evaluation and output playback finish. Dismissal starts
      the transition to the next executable source line and leaves the source
      structure stable.
- [ ] The modal has labeled `Back to source` and `Continue program` actions,
      no icon-only X, and no backdrop dismissal. Escape follows the Back
      behavior; the modal becomes full-screen and remains usable near 390 px.
- [ ] A direct action completes its memory or character output feedback before
      the source highlight moves. A modal action waits for dismissal and a
      settling pause. The completed result remains emphasized during its hold.
      The full row highlight moves from origin to destination; no line-number
      dot or second highlighted row appears. The destination stays neutral
      until arrival, then becomes the only active line for a sequential step,
      branch skip, or backward edge. Reduced motion uses a short fade.
- [ ] A declaration or assignment comet starts at the producing statement and
      reaches the live memory card. Source-flow rerenders do not detach that
      card or redirect the path toward the viewport origin.
- [ ] Source-flow memory renders every declared variable or constant exactly
      once, adds no synthetic result binding, and preserves the identifier's
      authored casing in the docked panel and statement trace modal.
- [ ] In C source flow, authored `return 0;` is the final direct action. Before
      it is clicked the program remains running; clicking it completes the item
      and triggers the configured completion celebration. Java receives no
      synthesized return statement.
- [ ] A program profile without `timelinePresentation:'statement-modal'`
      continues to render its timeline inline.

## Token Classification scenarios

- [ ] Initial code is comfortably readable and every line remains visible.
- [ ] Learners can answer lines in the profile-configured order.
- [ ] Responses remain editable until Check.
- [ ] Java `class` in a declaration-name position expects Invalid Identifier.
- [ ] A semicolon target expects Separator.
- [ ] Guided Identifier Position exposes only the declaration name.
- [ ] Practice strict off-target selection blocks and Undo restores work.
- [ ] Exam strict off-target selection terminates the item and preserves earlier
      credit without giving the solution.
- [ ] Checked tokens retain category colors and receive thin correct/incorrect
      underlines; wrong tokens receive a restrained red wave.
- [ ] Try again removes every previous answer and checked visual.
- [ ] Feedback opens automatically and owns Show correct solution.

## Falling Token Sort scenarios

- [ ] Each seeded item has one stored token target, and its generated category
      counts sum to that target while staying within their configured limits.
- [ ] Current Practice targets exactly 12 tokens with 3–5 per category; Exam targets
      exactly 15 tokens with 5 per category.
- [ ] Profile validation rejects targets whose exact value or min/max range
      cannot be allocated within the category limits, or whose explicit target
      falls outside its declared min/max bounds.
- [ ] A fresh Practice session changes the permutation.
- [ ] An Exam refresh restores the exact token order and placements.
- [ ] Bucket counts increase after accepted placements.
- [ ] With multiple visible tokens, selecting and sorting out of order refills
      the visible area; Undo restores the selected token and its place in it.
- [ ] Tokens enter one at a time at varied positions, fall slowly, bounce and
      stack on overlap; a falling token remains selectable and sortable.
- [ ] Mouse and touch drags sort with one gesture, including midfall. Releasing
      outside a bucket leaves scoring unchanged; keyboard selection still works.
- [ ] Another token appears on schedule during a long drag; releasing anywhere
      outside an accepted bucket continues falling from the release point.
- [ ] Sorting or rejecting one token does not jump, restart, or reposition the
      other visible falling or stacked tokens.
- [ ] Left/right buckets fill their lane height, while top/bottom buckets
      divide the available width.
- [ ] Stack mode leaves tokens at the bottom; pass-through mode moves them
      below the lane and restarts at new horizontal positions until sorted.
- [ ] Seeded token text stays on one line at content width. Selecting a token
      does not restart its fall; Animation Off and reduced motion show the
      visible tokens at rest.
- [ ] On a desktop viewport, the drop area, landed tokens, and buckets remain
      above the fixed item pager; resizing and scrolling keep the stage usable.
- [ ] A one-token profile still accepts direct bucket selection.
- [ ] Wrong Practice placement follows the configured return policy.
- [ ] Console guidance switches between C and Java.
- [ ] The reserved-word list exactly matches the active analyzer catalog.
- [ ] Current-token classification is not disclosed by neutral guidance.
- [ ] Bucket layout and Console content remain usable around 390 px width.

## Score Summary scenarios

- [ ] On-screen score is visible.
- [ ] Downloaded PNG contains the same score.
- [ ] Practice and Exam solid backgrounds remain distinguishable in the PNG.
- [ ] Download action is prominent and keyboard accessible.

## Activity size scenarios

- [ ] Decrease and increase stop at 80% and 140% and move in 10% steps; the
      percentage action and `Alt+0` restore 100%.
- [ ] `Alt+-` and `Alt++` work during a session but do not intercept typing in
      an input, textarea, select, or editable element.
- [ ] The app header, sidebar, pagination, drawers, modal frame/actions,
      legacy floating-memory frame, and Activity size toolbar do not change
      size.
- [ ] The main activity, statement modal trace, docked memory, and legacy
      floating-memory contents use the selected size. Expression, assignment,
      output, and falling-token connectors remain attached after each change.
- [ ] The preference survives reload for the same student, does not carry to a
      different student, and is removed by Clear all local application data.
- [ ] Around 390 px, the label is hidden, every control remains reachable, and
      enlarging the activity creates no page-level horizontal overflow.

## Handoff report

Every completed implementation should state:

- outcome;
- touched files;
- tests executed and result;
- manual checks performed;
- known limitation or deferred follow-up;
- whether any contract document changed and why.
