# Phase 6: plugin responsibility migration

Phase 6 makes the ownership boundary enforceable at runtime. Language meaning
belongs to the shell. Activity plugins decide how a learner reveals, combines,
commits, retries, scores, and views that meaning.

## Semantic service

Program Core now supplies every dispatched statement action with a frozen
semantic service. The service exposes shell-owned operations for:

- executing canonical Statement IR;
- selecting a branch;
- calculating assignment results;
- creating declaration and write effects; and
- applying effects to program memory.

Direct calls remain available to the parser and content pipeline because they
are shell infrastructure. Statement interaction adapters consume the Program
Core service and do not include a fallback evaluator.

## Plugin contract

Program Output, Program Input, and Code Simulator declare `language-core` as
their semantic owner. Their manifests list responsibilities such as content
adaptation, interaction, presentation, feedback, and scoring. Their capability
lists describe UI behavior such as timeline presentation, console playback,
flow highlighting, and modal traces.

A plugin may choose when an authored value is revealed or committed. It may
also animate a core effect. It does not define what an operator means, format a
language value independently, choose a program branch, or decide the memory
result of a statement.

## Compatibility

Existing action names, timeline traces, scoring, undo, reset, modal behavior,
and source-flow rendering remain compatible. The test harness now loads the
semantic dependency closure whenever it exercises the generated program
adapter, matching the browser script contract.

Regression checks fail if an interaction adapter calls the language executor
or branch selector directly, reintroduces unary evaluation, or restores an
optional semantic fallback in a source content adapter.
