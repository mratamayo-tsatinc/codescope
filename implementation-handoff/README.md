# CodeScope implementation handoff

CodeScope is an extensible shell for interactive programming activities. Read
[`AGENTS.md`](AGENTS.md) and the contracts under [`docs/`](docs/) before making
changes. Those documents are the durable project handoff.

## Current architecture

- `js/profiles.js` is the single declarative profile catalog. Profiles describe
  content, lesson focus, interaction, presentation, and scoring. They do not
  select a parser, semantic engine, or content adapter.
- `js/language-core.js`, the shared expression and statement services, and
  `js/program-parser.js` own supported C/Java syntax and meaning.
- `js/source-program-pipeline.js` owns manifest validation, metadata, seeded
  source materialization, and the single path from a live exercise file to
  canonical Program IR.
- Program Core owns ordered execution and supplies shell semantics to statement
  interaction adapters.
- Plugins own activity interaction and presentation. They consume canonical IR,
  effects, diagnostics, and traces instead of implementing language semantics.
- Source libraries own authored files. A manifest is the only membership and
  ordering authority; files are parsed at runtime for each new session.

Generated legacy expressions remain supported through the
`legacy-expression` interaction adapter. Declaration, assignment, unary,
input, output, selection, switch, `break`, return, and loop constructs share
the same core behavior across compatible activities.

## Release validation

Run the complete gate from the repository root:

```sh
node tests/release-gate.js
```

It validates JavaScript syntax, browser asset order, exercise manifests,
language coverage, architecture boundaries, responsive presentation contracts,
the compatibility baseline, and the full behavior suite. The approved Phase
0–10 migration is recorded in `docs/core-architecture-roadmap.md` and
`docs/core-architecture-phase-10-release.md`.
