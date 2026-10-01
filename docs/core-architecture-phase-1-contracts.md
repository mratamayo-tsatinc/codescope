# Core architecture migration: Phase 1 contracts

Phase 1 introduces the stable shell-owned boundary for later parser and
semantic migrations. It changes no active parser, evaluator, profile, scoring
rule or presentation.

## Public contract

`js/language-core.js` defines versioned entry points for:

- `coreParseExpression()`
- `coreParseStatement()`
- `coreEvaluateExpression()`
- `coreExecuteStatement()`
- `coreParseProgram()`

Implementations register once through `registerLanguageCoreService()`. Phase 1
does not register production implementations; existing compatibility paths
remain authoritative until their corresponding migration phase.

Every service returns a serializable result containing:

```js
{
  contractVersion,
  ir,
  diagnostics,
  dependencies,
  effects,
  trace,
  value // evaluation services when applicable
}
```

## Supporting contracts

- Source locations contain a filename and one-based start/end positions.
- Diagnostics have stable codes, severity, messages and optional locations.
- Effects describe observable reads, writes, output, input and flow changes.
- Trace events require a stable semantic action name.
- Dependency names are normalized and deduplicated.
- Expression and statement IR are validated before crossing the boundary.
- Program IR records its schema version and language.
- Expression, statement and program IR schema versions are declared centrally
  in `js/program-ir.js`.

Unknown statement extensions remain permitted during Phase 1. Input and
selection still carry plugin-owned fields until their semantics migrate into
the core in later phases.

## Compatibility rule

Existing source parsers and generated activities do not call the new services
yet. This is intentional: Phase 1 establishes and tests the destination
contract without changing runtime behavior. Each later phase replaces one
compatibility path and adds equivalence tests before removing old code.

## Regression gate

```sh
node tests/phase0-baseline.js --check
node tests/run-tests.js
```

The compatibility suite verifies contract validation, serialization,
dependency normalization, structured diagnostics, explicit unary write
effects and service registration. The Phase 0 baseline is refreshed only for
the reviewed addition of the new core script.
