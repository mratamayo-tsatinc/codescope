# Statement Plugin Guide

## Architectural rule

An activity item is a program. A program contains statements. Program Core
coordinates statement order but never implements the meaning or appearance of
a statement.

Three responsibilities stay separate:

1. A source adapter or generator produces Program IR.
2. A statement plugin validates and applies semantic actions.
3. A statement renderer displays state and emits semantic commands.

Canonical solving and scoring consume semantic events, never DOM clicks.

## Program shape

```js
const program = createProgram([
  declarationStatement({
    id: 's1',
    name: 'x',
    dataType: 'int',
    initializer: literalExpression(10)
  }),
  declarationStatement({
    id: 's2',
    name: 'y',
    dataType: 'int',
    initializer: binaryExpression(
      '+', identifierExpression('x'), literalExpression(5)
    )
  }),
  assignmentStatement({
    id: 's3',
    target: 'x',
    operator: '+=',
    value: identifierExpression('y')
  })
]);
```

The IR is language-neutral. A Java parser, C parser, profile generator or
external importer may all produce the same shape.

## Semantic plugin

```js
registerStatementPlugin({
  kind: 'declaration',

  validate({statement, program}) {},

  applyAction({statement, program, item, action, services}) {
    // Return {applied:false} when the action is unavailable.
    // Return {applied:true, event} after a valid state transition.
    // Add completed:true only when Program Core should advance.
  },

  check(context) {},

  buildCanonicalTrace(context) {
    return [];
  }
});
```

Plugins should emit normalized events such as `SUBSTITUTE`, `EVALUATE`,
`ASSIGN`, `READ_INPUT`, `PRINT`, `BRANCH` or `LOOP_TEST`. A plugin may
add event-specific details, but shared features should depend on stable event
names and fields.

## Renderer

```js
registerStatementRenderer('declaration', ({container, statement, program}) => {
  // Build DOM and dispatch semantic actions. Do not directly change memory,
  // score, cursor or statement status here.
});
```

CSS and animation remain renderer concerns. Assignment semantics remain plugin
concerns. The program runner owns only sequencing.

`renderExpressionEvaluationPanel` also owns row-local actions. Its trailing
action hook places an icon-only Undo control on the latest active line for
legacy expressions, declarations, and assignments. Only the final-expression
caller supplies Check, and only when its value is fully resolved. Reset remains
a separate low-emphasis item action because it affects the whole program rather
than the visible row.

## Declaration execution

The first implementation is available in `declaration-statement-plugin.js`,
`program-item-builder.js`, and `render-declaration.js`. It is enabled only by
the `declaration-chain` profile.

For `int y = x + 5;`, a declaration plugin should:

1. Require `x` to be initialized in program memory.
2. Let the expression capability substitute and evaluate the initializer.
3. Enable `COMMIT_ASSIGNMENT` when the initializer is one resolved value.
4. Store that value in `program.memory.y`.
5. Emit an `ASSIGN` event.
6. Return `completed:true` so Program Core unlocks the next statement.

A literal initializer such as `int x = 10;` begins at step 3.

## Assignment operators

`program-ir.js` and `assignment-statement-plugin.js` support:

```text
=  +=  -=  *=  /=  %=
```

The assignment plugin normalizes compound assignment semantically. For
example, `x += y` reads the current `x`, evaluates `x + y`, then commits the
result back to `x`. The parser and renderer preserve `+=` for source fidelity;
the evaluator may use the existing binary-operation service internally.

The learner performs that read–modify–write sequence explicitly. A compound
target starts as a clickable name; `reveal-assignment-target` reads its current
memory value into the shared variable-card UI. The compound operator activates
only after that target value and the RHS are resolved. Applying it produces one
updated target card, which is then written back through the existing
expression-to-memory animation. Plain `=` assignments retain the original
destination-and-RHS interaction and do not require a target read.

That target read is recorded as a `READ_TARGET` trace entry with a matching
history snapshot. It therefore creates the same visible timeline progression
as an RHS substitution: preserved source row, new value-card row, step dot,
step color, connector line, memory-to-expression flight, and single-step Undo.
It remains a navigation/substitution action rather than an operator-order score.

The compound calculation uses a fixed instructional sequence—operand hold,
operator emphasis, convergence, result formation, and result hold—before the
write-back flight begins. Its timing is intentionally independent of the
memory-flight speed selector; that selector continues to control only travel
between the expression and memory panel.

During convergence, the source-faithful compound symbol changes only in the
temporary calculation view (`+=` to `+`, `-=` to `-`, and so on). The source
statement and clickable operator remain compound. The calculation and its
updated target card stay left-aligned with the evaluation rows rather than
moving to the center of the panel.

Assignments reject writes to immutable bindings and reads from
uninitialized bindings.

## Output statements

`plugins/program-output/` registers the `output` statement kind. Its IR stores
text and expression parts independently of source language. The renderer shows
those parts as `printf` with format placeholders in C or as
`System.out.print`/`System.out.println` concatenation in Java.

Items may come from the seeded `formatted-values` builder or from C/Java source
files selected by an exercise-set manifest. The runtime parser converts the
supported beginner source subset into the same declaration, assignment, unary,
and output IR. Source loading and parsing belong to
`plugins/program-output/content.js`; statement execution remains independent of
where the item came from.

The built-in `formatted-values` lesson follows this dependency model:

1. Read any referenced identifier from program memory.
2. Activate that identifier's `%d` in C or `+` in Java to combine the staged
   value with text.
3. Activate the output command to append one `PRINT` event.
4. Animate that event into Program Output one character at a time. A source
   `\\n` is shown as an escape cue before it becomes a real output newline.

The character animation is presentation only. Scoring and persistence use the
atomic semantic event and never depend on animation completion. Output events
form the reproducible runtime output buffer, so Undo and Reset can reconstruct
the exact screen contents.

Guided mode exposes all unread identifiers and only the combine controls whose
matching value has been read. Strict mode exposes every unresolved control so
the normal invalid-execution policy can assess premature actions. Timeline
derivations never remove consumed source identifiers; they remain visible in a
muted state while the derived value stays associated with its placeholder or
concatenation step.

The dedicated `program-output-source-flow` profile renders the complete
metadata-free file directly in `program-statement-flow`. Supported lines retain
their semantic renderers and use their authored line numbers. Headers/imports,
wrappers, braces, blank lines, and unsupported statements stay in place as
muted read-only source lines. In C source flow, an authored `return 0;` is a
direct terminal action: the learner clicks it to finish the program. Java
source flow finishes after its final authored executable statement. Neither
path appends a synthetic assignment.

## Selection statements

`plugins/program-selection/` registers the `selection` statement kind and a
source-backed content provider. Conditions use the shared expression runtime,
so identifier reads, relational and Boolean reductions, colors, value cards,
Undo, and connector geometry follow the same contract as declarations and
assignments.

Selection exercise files may define source-specific randomization in their
leading metadata:

```c
/*
@codescope
@title Attendance qualification
@seed score min=60 max=100
@seed absences min=0 max=10
*/
```

Each directive allowlists one literal initialized `int`, `const int`, or Java
`final int`. Its range is inclusive. Declarations without `@seed` remain
authored, and declarations such as `int total = x + y;` retain their expression
and recalculate normally. Duplicate directives, unknown names, reversed ranges,
and annotated nonliteral initializers are load errors.

The profile chooses `content.sourceValueMode:'seeded'` to apply these ranges or
`'authored'` to preserve all source initializers. The profile does not carry the
ranges. Seeded generation rewrites the displayed declaration before parsing so
the visible source, Program IR, memory, conditions, output, scoring, and saved
item snapshot share one value.

The final reduction chooses a branch and completes the selection statement in
the same semantic action. Program Core follows that branch's statement ID; no
extra branch-confirmation action is rendered. The completed condition
expression alone receives a result-colored rounded outline. Its source keyword,
parentheses, and brace remain outside the outline; the derived result is plain,
centered, unboxed text below the condition. Selection code disables font
ligatures so multi-character operators remain literal source characters. No
connector is drawn to the selected statement.

The provider parses supported branch bodies into existing Program IR kinds.
The initial C and Java lessons therefore run authored `printf` and
`System.out.print/println` lines through the Program Output plugin. Unsupported
branch statements remain visible source context until a matching statement
plugin is registered.

For each new session, the provider parses the current files listed by the
active language manifest. It derives sequential edges, branch entry targets,
clause exits, and the statement after each decision from source structure. A
source edit may add another supported decision or statement without changing a
JavaScript catalog or expected graph. Files absent from `manifest.json` remain
out of the activity. A restored Exam uses its persisted Program IR snapshot.

Complete-source profiles can keep that program view stable while the learner
examines one active statement in a close-view modal:

```js
program:{
  declarations:'interactive',
  scoreAssignments:true,
  timelinePresentation:'statement-modal',
}
```

`timelinePresentation` is optional. Omit it, or use `'inline'`, for the
established statement-by-statement layout. The modal mounts the same registered
renderer, so semantic actions, scoring, Undo, persistence, memory reads, and
Program Output events remain unchanged. A statement plugin must not add a
modal-only semantic path.

For a source-flow item, the statement-modal presentation uses the shell's
shared source-file panel. It renders `item.sourceDisplay.filename`, the item
language, and every `sourceDisplay.lines` row inside one continuous code
viewport. The panel does not reconstruct source from Program IR or insert
derived timeline rows.

The active line asks its statement plugin for an optional interaction plan:

```js
interactionPlan({statement, program}) {
  return alreadyResolved
    ? {mode:'direct', action:{type:'commit-assignment', statementId:statement.id}}
    : {mode:'modal', focus:'expression'};
}
```

Use `direct` only when the click represents the statement's sole remaining
action. The shell sends that semantic action through the normal action handler,
so scoring, persistence, animation, and interaction policies stay intact. Use
`modal` for statements that require learner choices or several derivation
steps. A selection statement uses `focus:'condition-expression'`; its modal
shows only the condition expression because the full `if`, `else if`, or
`switch` line remains visible in the source panel. Plugins without this hook
default to the modal.

Completing a multistep statement keeps the modal open in a read-only completed
state so the learner can connect the derived result to the source program. Its
footer has two labeled actions: `Back to source` and `Continue program`.
`Continue program` remains disabled until evaluation and any output playback
finish. There is no icon-only X or backdrop dismissal. Escape follows the Back
behavior. Direct actions do not open a modal.

Program Core advances semantically when an action completes, while the source
panel stages that change visually. A direct action first finishes its memory or
output feedback. A modal action waits for an explicit dismissal. The source
then retains the completed origin and emphasizes its derived result for the
configured hold. Its semantic destination remains neutral while one flow marker
moves between the authored line positions. The destination becomes active and
receives focus only after arrival. Branches may move past skipped lines, and
the same destination model permits a future loop to move upward. Reduced-motion
mode keeps the state sequence but shortens the movement.

The shared `program-return` statement kind handles an authored C `return 0;`.
Its source-line interaction emits the semantic `RETURN` event, finalizes the
item, and runs the configured completion celebration. It is not synthesized
for Java or for a C file that does not contain that exact terminal statement.

## Future statements

Input and looping should be separate registrations. Program
IR may later allow statement-owned blocks (`then`, `else`, `body`) while
Program Core grows a program-counter stack. Do not embed those semantics in the
declaration or expression plugins.

Input plugins should read from a deterministic runtime input queue. Output
statements append to the deterministic event buffer described above. This keeps
student execution and canonical execution reproducible.

## Compatibility promise

The original profiles use `legacy-expression`; they do not receive interactive
declarations or new scoring checks automatically. A profile selects the
multi-statement capability with `program.declarations: 'interactive'`. This
prevents the extension from changing deployed activities or saved scores.
