# Core architecture migration: Phase 10 loop statements

Phase 10 moves C and Java loop control clauses into the app shell. `while`,
`do...while`, and `for` source now produce canonical Loop Statement IR and use
the shared expression and statement services.

## Core responsibilities

`js/loop-statement-core.js` owns:

- recognition of `while`, `do`, `do...while`, and `for` control clauses;
- safe splitting of the three `for` clauses;
- parsing `for` initialization and update clauses as ordinary canonical
  statements;
- condition evaluation through shared expression semantics;
- explicit initialization, condition, and update execution phases;
- loop branch effects for continue and exit destinations; and
- expression side effects without directly mutating caller memory.

Loop statements participate in `coreParseStatement()`,
`coreExecuteStatement()`, and `coreParseProgram()`. Presentation adapters may
attach body, repeat, exit, break, and continue destinations without redefining
the language rules.

## Regression gate

The suite verifies C and Java loop parsing, `for` declaration and assignment
initializers, unary updates, scoped effects, branch selection, source
locations, complete-program discovery, and serialization alongside all
existing activities.

```sh
node tests/phase0-baseline.js
node tests/run-tests.js
```
