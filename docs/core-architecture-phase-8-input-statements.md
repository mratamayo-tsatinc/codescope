# Core architecture migration: Phase 8 input statements

Phase 8 moves input language behavior from the Program Input plugin into the
app shell. C `scanf` and Java Scanner `nextInt()` now produce canonical Input
Statement IR and the same ordered console-read and memory-write effects.

## Core responsibilities

`js/input-statement-core.js` now owns:

- C integer `scanf` parsing for `%d` and `%i`;
- whitespace-separated multiple conversions;
- `&identifier` destination validation;
- Java `target = scanner.nextInt()` parsing;
- mutable integer target validation;
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
interaction: the virtual keyboard, slower key playback, explicit Enter press,
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
