# Phase 8: duplicate code removal

Phase 8 removes the transitional paths that remained after the shared parser,
semantics, content pipeline, plugin boundary, and profile schema migrations.
Every supported construct now enters the application through its canonical
core parser.

## Removed paths

- Deleted the obsolete `js/profiles_.js` catalog copy.
- Removed explicit `content.provider` selection from Activity Core.
- Removed the retired `program-selection` provider alias.
- Removed the `program-output` and `code-simulator` aliases for the
  `source-programs` exercise library.
- Removed flat profile source fields and the legacy `program` configuration
  translation layer.
- Removed the generated-program builder's old assignment, unary, mixed, and
  output lesson key adapter.
- Removed Program Output's private program-body scanner, statement splitter,
  expression parser wrapper, and C/Java output parser wrappers.
- Removed Code Simulator's statement and output fallback reparsing.
- Replaced Program Input's source-line reparse with runtime hydration of the
  canonical input Statement IR.

## Canonical flow

```text
live source file
  -> sourceProgramParseExercise()
  -> coreParseProgram()
  -> canonical Statement IR
  -> content adapter adds interaction runtime
  -> statement presentation plugin
```

Content adapters may attach lesson state, source display data, and interaction
runtime. They may not tokenize or parse a supported statement again. Program
Output and Code Simulator now use the statement objects produced by the shared
program parser.

The `legacy-expression` statement remains because it is the active interaction
and presentation adapter for the original generated expression activities. It
does not provide a second C or Java parser or semantic implementation.

## Migration rule

External profile catalogs must use the Phase 7 schema. Use
`content.source.library`, `content.source.exerciseSet`, `content.values`,
`lesson`, `interaction`, `presentation`, and `scoring`. Retired aliases and
flat configuration fields now fail normal validation instead of silently
choosing another path.

## Completion gate

- There is one active profile catalog.
- Profiles cannot select content adapters explicitly.
- Current exercise libraries have one canonical ID.
- Source content adapters do not call the statement parser or maintain output
  parser fallbacks.
- Generated programs consume the current profile schema directly.
- Regression tests fail if removed functions, aliases, or catalog copies
  return.
- The compatibility baseline and full test suite pass.

