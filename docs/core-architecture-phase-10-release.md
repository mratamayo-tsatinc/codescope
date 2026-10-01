# Phase 10: final regression and release

Phase 10 turns the migration checks into a repeatable release gate. Run:

```sh
node tests/release-gate.js
```

The gate validates:

- JavaScript syntax across shell, plugins, and exercise libraries;
- local script and stylesheet references plus semantic load order;
- every source manifest, listed file, and safe unique filename;
- every enabled source profile against every language declared by its library;
- removal of legacy catalogs, plugin reparsing paths, and OneDrive conflict copies;
- activity-local zoom, sticky program context, mobile memory/output tabs,
  responsive navigation, and reduced-motion source contracts;
- the locked Phase 0 architecture and content baseline; and
- the complete compatibility, semantic, plugin, scoring, persistence, source
  loading, and presentation contract suite.

The release audit found that the enabled `output-basics` profile had C content
but no Java exercise set even though `source-programs` declares both languages.
Phase 10 adds a Java counterpart for all seven exercises. Regression coverage
parses every C and Java file through the shared source pipeline and verifies
that every authored print call becomes canonical output IR without diagnostics.

## Completion evidence

- 92 JavaScript files compile.
- 91 indexed scripts and 11 stylesheets resolve in load order.
- 9 manifests and 55 authored exercises pass integrity checks.
- 5 enabled source profiles resolve in C and Java.
- All compatibility and extension tests pass.
- `git diff --check` passes.

