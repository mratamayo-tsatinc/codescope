# Core architecture migration: Phase 8 input statements

Phase 8 moved input language behavior from the Program Input plugin into the
app shell. The shared contract now covers typed C `scanf` and Java Scanner
reads, which produce canonical Input Statement IR and the same ordered
console-read and memory-write effects.

## Core responsibilities

`js/input-statement-core.js` now owns:

- C `scanf` parsing for `%d`, `%i`, `%f`, `%lf`, `%c`, and `%s`;
- multiple conversions with whitespace or authored literal separators;
- C leading format whitespace used to consume pending input whitespace;
- `&identifier` destination validation;
- Java `nextInt`, `nextFloat`, `nextDouble`, `next`, `nextLine`, and
  `next().charAt(0)` parsing;
- matching mutable target type validation;
- authored or seeded input value materialization supplied by a source adapter;
- raw console input construction;
- conversion trace events; and
- ordered destination write effects.

Input statements now participate in `coreParseStatement()`,
`coreExecuteStatement()`, and `coreParseProgram()`. Program parsing applies the
input writes to its expected-state memory, so later expressions and output
statements observe the entered values.

## Plugin boundary

Exercise metadata still decides authored values and seed ranges because that is
content configuration. The Program Input plugin owns presentation and learner
interaction: the keyboard indicator, persistent released/pressed Enter key,
placeholder transfer, address-token click, connector animation, undo, and
scoring.

The plugin no longer contains separate C and Java input grammars. Its parser is
a compatibility adapter that claims metadata definitions and attaches the
existing interaction runtime to core Input IR. Code Simulator declares shell
input semantics and Program Input timeline presentation as separate
dependencies.

## Regression gate

The suite verifies multi-value C input, Java Scanner input, raw console text,
target validation, conversion traces, memory effects, program-level
input-to-output propagation, seeded content, and all existing virtual keyboard
interactions.

```sh
node tests/phase0-baseline.js
node tests/run-tests.js
```
