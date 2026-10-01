# Core architecture migration: Phase 4 shared statement parser

Phase 4 registers the shell-owned `parseStatement` service and removes the
duplicated simple-statement grammar from Program Output and Code Simulator.

## Core-owned syntax

The shared parser now recognizes the same supported forms for sourced C and
Java activities:

- initialized and uninitialized `int`, `float`, `double`, and `char`
  declarations;
- C `const` and Java `final` declarations;
- simple and compound assignments;
- prefix and postfix standalone `++` and `--` updates;
- `break` markers; and
- the C `return 0` program completion marker.

Every recognized statement is returned as canonical Statement IR with a source
location and normalized dependencies. The parser validates duplicate names,
immutable targets, uninitialized compound-assignment targets, and unary update
targets before an activity adapter builds its timeline runtime.

## Adapter boundary

Program Output and Code Simulator call `coreParseStatement()` and then add only
their activity runtime, source-row mapping, control-flow links, and presentation
state. They no longer contain independent declaration, assignment, or unary
statement regular expressions.

Input, output, selection, and loop syntax remain in their current adapters for
later phases. Syntax that belongs to one of those adapters returns a recoverable
`UNSUPPORTED_STATEMENT` diagnostic so another provider can claim it. For
example, Java `scanner.nextInt()` remains available to the Program Input parser.

## Regression gate

The compatibility suite checks equivalent C and Java Statement IR,
uninitialized declarations, constants, assignments, unary forms, source
locations, recoverable unsupported syntax, and semantic validation. Existing
sourced exercise suites, including `TaskPapa.c`, run through the same gate.

```sh
node tests/phase0-baseline.js
node tests/run-tests.js
```
