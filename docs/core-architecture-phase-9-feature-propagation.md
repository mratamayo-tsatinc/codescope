# Phase 9: feature propagation proof

Phase 9 proves the architectural goal: adding a supported construct to the
language core makes that construct available to every compatible activity
without another parser or semantic implementation in each plugin.

## Authored proof set

The regression suite uses the existing source files directly from the shared
`exercise-libraries/source-programs/c/it3-midterm-a/` bank:

| Exercise | Core behavior proved |
| --- | --- |
| `TaskPapa.c` | Prefix and postfix unary operators inside a declaration initializer |
| `TaskJuliet.c` | String values, C `char[]` initialization, `%s`, `%c`, and float precision |
| `TaskOscar.c` | Numeric and string `#define` constants and expressions that read them |
| `TaskSierra.c` | The combined declaration, expression, macro, string, and formatted-output path |

Each unchanged source file passes through four compatible consumers:

1. the shared Program parser and semantics directly;
2. Simulate Output's core-generated answer workflow;
3. Program Output's statement-oriented item builder; and
4. Code Simulator's complete-source item builder.

The test compares normalized semantic signatures from the canonical Program IR
seen by each consumer. It also verifies that Simulate Output derives exact
terminal output and final mutable memory from those semantics, then builds real
Program Output, Code Simulator, and Simulate Output items.

## Propagation correction

The proof exposed one remaining adapter constraint. Code Simulator previously
considered declarations only when the authored line ended in a semicolon.
Canonical `#define` declarations were therefore parsed by the core but omitted
from the simulator's runtime memory.

The adapter now discovers declarations from canonical Statement IR regardless
of source punctuation. `TAX_RATE` and `SHOP_NAME` consequently reach memory and
all dependent expressions without adding macro grammar to Code Simulator.

## Guaranteed results

- TaskPapa produces `p = 5`, `q = 5`, and `sum = 9` through shared unary
  semantics in Code Simulator.
- TaskJuliet exposes its string declaration and all `%s`, numeric, character,
  and precision formats to both output presentations.
- TaskOscar exposes immutable `#define` bindings to dependent declarations.
- TaskSierra produces the same complete console text in the core and Simulate
  Output answer workflow.
- Program Output receives output statements and its established final
  expression adapter.
- Code Simulator receives output statements and the authored return action.

## Completion gate

- The four authored files parse without core diagnostics.
- Every compatible consumer sees an equivalent semantic Program IR.
- Simulate Output's generated answer matches core output and final mutable
  memory for each exercise.
- Real items build successfully for all three activity presentations.
- The test contains no copied source strings or plugin-specific expected
  statement graph.
- The Phase 0 baseline and complete regression suite pass.

