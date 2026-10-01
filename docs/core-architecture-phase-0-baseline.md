# Core architecture migration: Phase 0 baseline

Phase 0 records the behavior and content that the core-language migration must
preserve. It deliberately changes no application behavior.

## Automated baseline

`tests/phase0-baseline.json` records:

- every authored profile, its enabled state, category, activity/content route,
  template and scoring configuration;
- every category and its ordered profile membership;
- browser script load order;
- plugin directories and their non-exercise files;
- every source exercise manifest, its ordered filenames and a normalized hash
  of each live exercise file;
- the deterministic generated-expression snapshot hash already exercised by
  the compatibility suite.

Run both baseline gates from the repository root:

```sh
node tests/phase0-baseline.js --check
node tests/run-tests.js
```

When an architecture or authored exercise change is intentional, review its
diff first and then refresh the inventory:

```sh
node tests/phase0-baseline.js --write
node tests/run-tests.js
```

Refreshing the manifest is not a substitute for updating focused semantic
tests. A changed evaluation result, trace, score, persistence record or UI
contract needs a corresponding reviewed test change.

## Current responsibility baseline

| Area | Current owner at Phase 0 |
|---|---|
| Generated expression shape | `js/generator.js` and `js/template-engine.js` |
| Expression nodes and evaluation | `js/engine.js` and `js/flat-model.js` |
| Program envelope and dispatch | `js/program-core.js` and `js/program-ir.js` |
| Declaration semantics | `js/declaration-statement-plugin.js` |
| Assignment semantics | `js/assignment-statement-plugin.js` |
| Standalone unary updates | `js/unary-update-statement-plugin.js` |
| Source expression parsing | `plugins/program-output/content.js` |
| Complete source/control-flow parsing | `plugins/code-simulator/content.js` |
| Input parsing and interaction | `plugins/program-input` |
| Output interaction and presentation | `plugins/program-output` |
| Metadata-graded output prediction | `plugins/simulate-output` |
| Token classification and falling sort | Their respective activity plugins |

The migration may move these responsibilities, but each phase must preserve
the recorded behavior until an explicitly reviewed feature change replaces it.

## Existing automated behavior coverage

The compatibility suite currently locks the following behavior:

- deterministic generation for the original expression profiles;
- precedence, parentheses, unary evaluation and canonical playback;
- declarations, assignments, compound assignments and standalone unary
  updates;
- program statement dispatch, scoring and advancement;
- formatted output, multiple placeholders and character playback;
- sourced program rendering, contextual unsupported lines and `return 0`;
- input conversion, virtual-keyboard playback and writes to memory;
- `if`, `else if`, `else`, switch, `break` and switch fall-through;
- practice/exam policy, timeout locking and mode-scoped persistence;
- profile/category score isolation;
- connector coordinates under activity zoom;
- activity plugin isolation for simulate-output, token classification and
  falling-token-sort.

## Known language gaps at Phase 0

These constructs occur in the simulate-output C bank but do not yet have a
complete shared-core representation and execution path:

- character arrays initialized from string literals;
- `%s` output placeholders;
- object-like numeric and string `#define` constants;
- literal or compound-expression arguments passed directly to `printf`;
- width/flag forms such as `%0.4f`.

Unary operands are not a language gap. Generated activities already evaluate
prefix and postfix unary operands. The migration must make that existing core
capability reachable from every expression-bearing source statement.

## Manual UI smoke-test matrix

Run this matrix at the end of every migration phase that changes runtime or
presentation wiring.

| Surface | Desktop check | Mobile check |
|---|---|---|
| Shell | Header, sidebar and category navigation | Collapsible header, logo trigger and hidden unused console drawer |
| Generated expression | Timeline, substitution, operator connectors | Horizontal fit, local zoom and reachable actions |
| Complete source program | Single active highlight and animated movement | Manual scrolling does not fight automatic flow |
| Modal evaluation | Memory/output routing and manual close actions | Context panel stays above interaction and remains sticky |
| Memory | Correct names, casing, values and arrival animation | Portrait cards fit four variables in one row when space permits |
| Output | Character playback and inline Enter cue | Automatic tab switch and visible playback |
| Input | Keyboard playback, Enter and value-to-memory trail | Numeric keyboard remains reachable without covering context |
| Selection | Condition result and branch destination | Modal closes intentionally before flow advances |
| Switch | `break` exit and missing-`break` fall-through | Highlight visibly follows every executed case |
| Completion | Explicit `return 0`, score and confetti | Item navigation remains accessible after completion |

## Phase 0 exit criteria

- The baseline checker passes.
- The complete compatibility suite passes.
- The baseline manifest is committed and reviewable.
- Known language gaps are documented without being misclassified as existing
  core capabilities.
- No runtime, profile, scoring or presentation behavior has changed.
