# Core architecture migration: Phase 6 shared program parser

Phase 6 registers the final service declared by the Phase 1 contract:
`parseProgram`.

## Program composition

The shell now scans complete C and Java source files while preserving authored
line locations. It composes the shared statement parser and executor to produce
canonical Program IR for every currently migrated simple statement:

- declarations;
- assignments;
- standalone unary updates;
- `break`; and
- `return 0`.

The scanner handles comments, quoted strings and characters, parentheses,
blocks, preprocessor lines, and switch `case`/`default` labels without treating
their punctuation as separate executable statements.

## Adapter integration

Program Output and Code Simulator parse each source file through
`coreParseProgram()` once and reuse the resulting Statement IR by source line.
They fall back to a contextual statement parse when a specialized provider has
changed the known memory state, such as after console input.

Rows owned by input, output, selection, switch, and future loop migrations emit
recoverable diagnostics from the shared parser. Their existing adapters still
build the specialized IR, flow edges, and presentation runtime. The program
parser's sequential preview memory is used only while composing migrated simple
statements; Code Simulator remains authoritative for branch-aware execution.

## Regression gate

The regression suite verifies C and Java program scanning, source locations,
stable statement IDs, mixed prefix/postfix side effects, recoverable specialized
rows, serialized Program IR, and adapter compatibility with all authored
exercise libraries.

```sh
node tests/phase0-baseline.js
node tests/run-tests.js
```
