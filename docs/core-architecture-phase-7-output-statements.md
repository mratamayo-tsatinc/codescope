# Core architecture migration: Phase 7 output statements

Phase 7 moves output language behavior from the Program Output plugin into the
app shell. C `printf` and Java `System.out.print/println` now produce the same
canonical Output Statement IR and console-output effects.

## Core responsibilities

`js/output-statement-core.js` now owns:

- C `printf` argument splitting and adjacent string literals;
- `%d`, `%i`, `%c`, `%f`, precision forms such as `%.2f`, and `%%`;
- Java string concatenation for `System.out.print` and
  `System.out.println`;
- escape decoding and newline behavior;
- output value formatting;
- variable-read effects; and
- the final console-output effect and semantic trace.

Output statements participate in `coreParseStatement()`,
`coreExecuteStatement()`, and `coreParseProgram()` alongside declarations,
assignments, and unary updates.

## Plugin boundary

The Program Output plugin now owns the learning interaction and presentation:
reading variables, inserting formatted values, printing one character at a
time, connector animation, undo, scoring, and rendering. Its source parser is a
compatibility adapter that converts core Output IR into that timeline runtime.

Code Simulator depends on the shell's output-statement capability and the
Program Output timeline presentation separately. This makes the architectural
boundary explicit and allows another activity to reuse output semantics without
copying the plugin parser.

## Regression gate

The suite verifies equivalent C and Java Output IR, placeholders, precision,
characters, escaped newlines, concatenation, dependencies, read effects,
console-output effects, invalid formats, and every existing Program Output and
Code Simulator exercise.

```sh
node tests/phase0-baseline.js
node tests/run-tests.js
```
