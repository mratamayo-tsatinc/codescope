# Core architecture migration: Phase 5 shared statement semantics

Phase 5 registers the shell-owned `executeStatement` service for the simple
Statement IR introduced in Phase 4. The service is presentation independent and
does not mutate its input memory.

## Supported semantics

The shared executor now produces values, ordered effects, dependencies, and
trace events for:

- initialized and uninitialized declarations;
- simple and compound assignments;
- standalone prefix and postfix `++` and `--` updates;
- `break`; and
- `return 0`.

Expression reads and unary writes retain `scope: "expression"`. The final
declaration, assignment, unary write, or flow decision has
`scope: "statement"`. This lets an activity preserve learner-produced values
while still using the same expected semantic model.

## Runtime integration

Program Output and Code Simulator use the executor to build their private
expected-state memory while parsing authored files. Later statements therefore
observe declaration, assignment, and unary side effects in source order.

The declaration, assignment, and unary interaction plugins use the executor to
refresh expected values from live Program Core memory. Their existing timeline,
manual response, scoring, animation, undo, and rollback behavior remains the
presentation layer. Break and return events now include the core flow effects.

Generated assignment and unary statement chains also use the shared executor
when the service is available. Compatibility fallbacks remain temporarily for
isolated legacy harnesses that do not load the migration services.

## Regression gate

The suite verifies pure evaluation, ordered expression and statement effects,
binding-memory and raw-memory application, declaration and assignment values,
unary storage, immutable target rejection, and break/return flow effects.

```sh
node tests/phase0-baseline.js
node tests/run-tests.js
```
