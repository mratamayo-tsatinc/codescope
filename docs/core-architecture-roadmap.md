# Core architecture migration roadmap

This document preserves the approved phase numbering. Smaller implementation
milestones are grouped beneath their owning phase and must not be presented as
new top-level phases.

| Phase | Purpose | Status |
| --- | --- | --- |
| 0 | Compatibility baseline | Complete |
| 1 | Core contracts | Complete |
| 2 | Shared expression parser | Complete |
| 3 | Shared expression semantics | Complete |
| 4A | Shared statement semantics | Complete |
| 4B | Unsupported construct support | Complete |
| 5 | Content pipeline separation | Complete |
| 6 | Plugin responsibility migration | Complete |
| 7 | Profile schema simplification | Complete |
| 8 | Duplicate-code removal | Complete |
| 9 | Feature propagation proof | Complete |
| 10 | Final regression and release | Complete |

## Phase 4A milestones

The statement parser, statement executor, output core, input core, selection
core, and loop core are internal milestones of Phase 4A. They are not Phases
4 through 10 of the approved roadmap.

Phase 4A owns the meaning of declarations, assignments, unary updates, input,
output, selection, switch labels and branch choice, `break`, return, and loop
control. Plugins decide when a learner performs an action and how it is shown,
then consume core values, effects, diagnostics, and traces.

## Phase 4A completion gate

- Every supported statement parses to canonical Statement IR.
- Every supported statement executes through `coreExecuteStatement()`.
- Source adapters do not parse switch label values or choose branches.
- Input writes apply core-produced effects.
- C and Java forms pass the same semantic conformance suite.
- All compatibility and authored-exercise regressions pass.

## Phase 5 completion gate

- Manifest validation and source normalization have one shell-owned implementation.
- `@codescope` metadata and source seeding are materialized before parsing.
- Program Output, Code Simulator, and Simulate Output send live source through
  `sourceProgramParseExercise()` and the canonical program parser.
- Content providers do not call `coreParseProgram()` or maintain private copies
  of the source seed materializer.
- Authored and seeded forms retain the authored template and produce the same
  canonical statement kinds.
- All compatibility and authored-exercise regressions pass.

## Phase 6 completion gate

- Program Core supplies one semantic service to statement interaction adapters.
- Interaction adapters do not call the language executor or branch selector
  directly and contain no fallback evaluator.
- Memory commits use effects created and applied by shell-owned semantics.
- Program Output, Program Input, and Code Simulator manifests identify
  `language-core` as their semantic owner and advertise presentation and
  interaction capabilities rather than language constructs.
- Source content adapters require shared statement semantics instead of
  silently switching to plugin-local calculations.
- Core statement behavior remains executable without loading a presentation
  plugin.
- All compatibility and authored-exercise regressions pass.

## Phase 7 completion gate

- Active profiles describe content, lesson focus, interaction, presentation,
  and scoring without naming a parser or provider.
- Content adapters match declarative profiles and ambiguous matches fail.
- The legacy `program` block is absent from the active catalog.
- Compatibility accessors continue to read older external profile catalogs.
- Profile authoring documentation and baseline fixtures use the current schema.
- All compatibility and authored-exercise regressions pass.

## Phase 8 completion gate

- Obsolete profile catalogs, provider aliases, and profile compatibility
  translations are removed.
- Program Output and Code Simulator consume canonical Statement IR without
  reparsing supported source statements.
- Program Input hydrates canonical input statements instead of parsing source
  lines again.
- Generated program construction consumes the current lesson and interaction
  schema directly.
- Regression checks prevent removed duplicate paths from returning.
- All compatibility and authored-exercise regressions pass.

## Phase 9 completion gate

- TaskPapa, TaskJuliet, TaskOscar, and TaskSierra use their existing authored
  source files as shared propagation fixtures.
- The core, Simulate Output, Program Output, and Code Simulator receive
  equivalent semantic Program IR for each compatible exercise.
- Simulate Output generates expected output and final mutable memory from the
  same core-produced effects used by the other compatible activities.
- Unary operands, strings, `char[]`, object-like `#define`, `%s`, expression
  output arguments, and precision floats require no plugin-local semantics.
- Regression checks build real items for every compatible presentation.
- All compatibility and authored-exercise regressions pass.

## Phase 10 completion gate

- One command validates syntax, browser asset order, source manifests,
  architecture boundaries, responsive presentation contracts, the Phase 0
  baseline, and the complete behavior suite.
- Every enabled source profile has a manifest for every language declared by
  its exercise library.
- The C and Java basic-output sets parse all authored print statements through
  the shared source pipeline without diagnostics.
- OneDrive conflict copies and removed compatibility catalogs are absent.
- Desktop and mobile source contracts for activity zoom, sticky context,
  memory/output tabs, navigation, and reduced motion remain present.
- All compatibility and authored-exercise regressions pass.
## Future improvements

### Unbraced selection statements

- Extend the shared program parser to recognize valid single-statement selection bodies without braces, including `if`, `if...else`, and `if...else if...else` forms.
- Preserve the authored source text, indentation, and line numbers while producing the same canonical Selection IR used by braced statements.
- Evaluate conditions in order, execute only the selected branch, and skip the remaining clauses when generating answer keys or simulating program flow.
- Implement this in the shared core so every compatible activity benefits without plugin-specific parsing or semantics.
- Add regression coverage for C and Java, nested selections, seeded values, and both assignment and output statement bodies.
