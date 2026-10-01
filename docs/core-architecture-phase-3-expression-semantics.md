# Core architecture migration: Phase 3 expression semantics

Phase 3 registers one canonical expression evaluator. It consumes Program IR
and returns the expression value, dependencies, semantic trace and explicit
memory effects without mutating caller memory.

## Unary value and write behavior

The shared `evaluateUnaryOperation()` primitive distinguishes expression value
from stored value:

| Form | Starting value | Expression value | Written value |
|---|---:|---:|---:|
| `++p` | 4 | 5 | 5 |
| `p++` | 4 | 4 | 5 |
| `--p` | 4 | 3 | 3 |
| `p--` | 4 | 4 | 3 |

The interactive engine, canonical evaluator and statement completion all use
this primitive.

## Effects

Evaluation returns ordered `read` and `write` effects. Statements commit write
effects only after the learner completes the containing declaration or
assignment. Completion records a memory snapshot so rollback restores both the
assignment target and every unary-mutated variable.

Source parsers also apply these effects to their private expected-state memory
while reading later statements. This keeps authored source internally
consistent without pre-applying anything to the learner's live Program Core
memory.

For:

```c
int p = 4;
int q = 4;
int sum = ++p + q++;
```

the evaluator returns value `9` and writes `p = 5`, `q = 5`. Committing the
declaration then stores `sum = 9`. Undoing completion restores `p = 4`,
`q = 4`, and removes `sum`.

## Compatibility

The existing timeline remains the presentation and interaction model. Its
completed unary trace supplies the actual write values, including manual
responses. The canonical evaluator supplies expected values and effects for
validation. Generated legacy activities retain their current item-local final
variable display; sequential program statements now commit the same semantics
to Program Core memory.

The regression suite parses the authored `TaskPapa.c` exercise through Code
Simulator and verifies the mixed prefix/postfix declaration, its two write
effects, and the resulting expected memory state.
