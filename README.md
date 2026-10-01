# CodeScope — Interactive Programming Activities

CodeScope is an extensible shell for interactive programming activities. It
preserves the original operator-precedence activity while supporting opt-in
declaration and assignment chains and isolated activity plugins such as token
classification.

## What remains unchanged

- The 18 current profiles and seeded expression generation
- Student-controlled substitution and operator selection
- Precedence checking and canonical playback
- Practice/exam rules, timer, persistence and score formulas
- Drawers, connector lines, variable-state display and animations

Existing generated items are automatically wrapped as one
`legacy-expression` statement. Their original fields remain authoritative, so
the compatibility layer does not translate or duplicate active expression
state.

## Profiles

The original 18 profiles are unchanged and still use one
`legacy-expression` statement. `declaration-chain` teaches executable
declarations. Eight additive assignment profiles progress through `=`, `+=`,
`-=`, `*=`, `/=`, `%=` and dependent mixed chains before unlocking the same
final-expression evaluator.

Compound assignments use an explicit read–modify–write interaction: the
student reveals the target's current memory value, resolves the RHS, then
applies the compound operator. The two values converge into one updated target
card before the existing expression-to-memory animation writes it back. Plain
`=` assignments keep the original compact destination-and-RHS behavior.

For a dependent declaration such as `int y = x + 5;`, the student substitutes
the initialized value of `x`, evaluates the initializer, and clicks `=` to
commit `y` to program memory. Declaration evaluation and assignment checks are
included in the same per-item point budget.

## Extensible foundation

- `js/program-ir.js` defines language-neutral statement/expression shapes.
- `js/language-core.js` defines versioned parser, evaluator, diagnostics,
  effects and trace contracts for the core migration.
- `js/expression-parser.js` owns the shared C/Java expression grammar and
  produces canonical expression IR for source-backed activities.
- `js/expression-semantics.js` evaluates canonical expressions and reports
  ordered reads, unary writes and trace events without mutating caller memory.
- `js/output-statement-core.js` owns C/Java output grammar, formatting, and
  console-output effects, including `%s`, precision floats, and expression
  arguments.
- `js/input-statement-core.js` owns C/Java integer input grammar, conversion,
  console-read effects, and destination writes.
- `js/selection-statement-core.js` owns `if`, `else if`, and `switch`
  condition parsing, evaluation, and branch selection.
- `js/loop-statement-core.js` owns `while`, `do...while`, and `for` control
  clauses, condition branches, initialization, and iteration updates.
- `js/statement-parser.js` owns shared C/Java grammar for declarations,
  assignments, unary updates, `break`, and the C `return 0` marker.
- `js/statement-semantics.js` produces the values, ordered memory effects, and
  trace events for those canonical statements.
- `js/program-parser.js` scans complete C/Java source files and composes the
  shared statement services into source-positioned Program IR.
- `js/source-program-pipeline.js` owns source normalization, CodeScope
  metadata, seeded source materialization, manifest validation, and the single
  entry into the shared program parser.
- `js/program-core.js` owns ordered programs, statement/renderer registries,
  and the semantic service passed to interaction adapters.
- `js/legacy-expression-plugin.js` adapts the existing activity to the new
  dispatch contract.
- `renderProgramItem()` is now the main rendering entry point.
- Existing saved items without a program envelope are upgraded in memory when
  restored.
- Declaration, assignment, unary, input, output, selection, `break`, and
  return adapters control learner interactions while consuming values,
  effects, traces, and control-flow decisions from the core semantic service.
- `js/program-item-builder.js` adapts generated operands into dependency chains.
- `js/render-declaration.js` and `js/render-assignment.js` are thin adapters
  over the shared legacy expression timeline.
- Program profiles describe `content`, `lesson`, `interaction`,
  `presentation`, and `scoring`. Content adapters match those capabilities;
  active profiles do not select providers, parsers, or semantic engines.
- Source-backed adapters consume the canonical Statement IR produced by the
  shared program parser. They attach interaction runtime without reparsing
  supported C or Java statements.
- TaskPapa, TaskJuliet, TaskOscar, and TaskSierra serve as propagation fixtures:
  the same shared-library source files build through Simulate Output, Program
  Output, and Code Simulator with core-owned syntax and semantics. Simulate
  Output generates its expected terminal output and mutable final memory from
  those semantics instead of embedded answer metadata.

See `docs/statement-plugin-guide.md` for the extension boundary and planned
declaration and assignment flow.

The approved migration sequence and current phase status are recorded in
`docs/core-architecture-roadmap.md`.

## Run

Serve this directory over HTTP. The existing login loader expects
`data/students.csv` with two columns:

```csv
email,studentNumber
student@example.edu,2026-0001
```

The real student list is intentionally not included.

## Tests

Run:

```sh
node tests/release-gate.js
```

For focused development checks, run:

```sh
node tests/phase0-baseline.js --check
node tests/run-tests.js
```

The suite checks syntax/load ordering, deterministic generation parity against
the original supplied files, compatibility-envelope behavior, plugin dispatch,
statement advancement, all assignment operators, immutable-target rejection,
multi-statement scoring, and preservation of legacy generated output.

The Phase 0 baseline also locks the current profile/category catalog, browser
script order, plugin inventory, exercise manifests and normalized authored
exercise contents. See `docs/core-architecture-phase-0-baseline.md` before
refreshing it for an intentional architecture or exercise change.

`tests/release-gate.js` is the final release command. It adds repository-wide
syntax, asset-order, manifest, language-coverage, architecture-cleanup, and
responsive-presentation checks before running both focused suites. See
`docs/core-architecture-phase-10-release.md` for the complete gate.
