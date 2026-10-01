# Phase 4B unsupported construct support

Phase 4B adds the source constructs identified in TaskJuliet, TaskOscar, and
TaskSierra to the shared language core.

## Added constructs

- double-quoted string literal Expression IR;
- C `char name[] = "value"` declarations;
- Java `String` declarations;
- object-like C `#define` constants with numeric, character, or string values;
- `%s` formatting;
- `%0.4f` and the existing precision-float forms;
- arbitrary supported expressions as `printf` arguments; and
- expression arguments in Java output concatenation.

String values retain quotes in expression and memory rendering. `%s` removes
those source-level quotes when writing to Program Output. Non-identifier output
arguments carry their authored source text and their core-evaluated value into
the output interaction runtime.

## Regression fixtures

The shared program parser executes the actual TaskJuliet, TaskOscar, and
TaskSierra files. Tests verify canonical declarations, macro constants, output
formats, calculated variables, exact console output, diagnostics, expression
arguments, and serializable IR.

Phase 9 extends this into a propagation proof: these files, together with
TaskPapa, build through Simulate Output, Program Output, and Code Simulator
from the same canonical Program IR.
