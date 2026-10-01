# Phase 4A completion audit

Phase 4A consolidates statement meaning in the shell while preserving each
activity's interaction and presentation.

**Result: complete.** The architecture baseline and full compatibility suite
pass with statement parsing and expected semantics routed through the core.

## Shared semantic ownership

| Construct | Parser | Executor | Adapter responsibility |
| --- | --- | --- | --- |
| Declaration | Statement core | Statement core | Timeline and commit interaction |
| Assignment | Statement core | Statement core | Timeline and commit interaction |
| Prefix/postfix update | Expression and statement core | Expression and statement core | Timeline and feedback |
| Output | Output core | Output core | Read, format, and print interaction |
| Input | Input core | Input core | Keyboard, transfer, and staged writes |
| `if` / `else if` | Selection core | Selection core | Condition timeline and source movement |
| `switch`, `case`, `default` | Selection core | Selection core | Source layout and branch animation |
| `break` | Statement core | Statement core | Direct learner action |
| Return | Statement core | Statement core | Direct learner action and completion UI |
| Loops | Loop core | Loop core | Iteration presentation and source movement |

Switch label parsing now accepts core expression values, including negative
integers and character literals. Code Simulator supplies source positions and
branch destinations but no longer interprets case values. Program Input applies
the write effects returned by the core when the learner commits each staged
destination.

## Remaining roadmap boundary

String declarations, `char[]` initialization, `%s`, general output expression
arguments, and `%0.4f` belong to Phase 4B. Content-provider unification,
compatibility fallback removal, and profile simplification remain in their
approved later phases.
