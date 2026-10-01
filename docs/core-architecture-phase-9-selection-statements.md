# Core architecture migration: Phase 9 selection statements

Phase 9 moves selection condition behavior into the app shell. C and Java
`if`, `else if`, and `switch` headers now produce canonical Selection Statement
IR and use the shared expression evaluator and branch-selection rules.

## Core responsibilities

`js/selection-statement-core.js` now owns:

- `if` and `else if` header recognition;
- `switch` header recognition;
- condition and selector expression parsing;
- condition evaluation through shared expression semantics;
- true and false branch selection;
- matching `case`, `default`, and no-match branches;
- expression side effects inside conditions; and
- branch flow effects containing the selected label, source line, and next
  statement ID.

Selection statements participate in `coreParseStatement()`,
`coreExecuteStatement()`, and `coreParseProgram()`. The complete-program scanner
preserves selection headers as source-positioned Statement IR.

## Code Simulator boundary

Code Simulator still builds the control-flow graph from the complete authored
source because it owns the current source-program activity presentation. It
assigns branch destination lines and statement IDs, switch fall-through edges,
and break destinations to the canonical selection statement.

The plugin retains the condition modal, step timeline, compact result display,
line highlighting, source transitions, scoring, and animation. Its selection
plugin delegates expected-value evaluation and branch choice to the shell.
Unary writes inside a condition are committed only when the branch is committed
and are restored by undo.

## Regression gate

The suite verifies `if`, `else if`, relational and Boolean conditions, switch
case/default selection, branch effects, source locations, dependencies, unary
condition writes, rollback support, and every existing selection and switch
exercise.

```sh
node tests/phase0-baseline.js
node tests/run-tests.js
```
