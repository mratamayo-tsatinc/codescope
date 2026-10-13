# C Semifinals: Selection Statements

This bundled Profile Set is available from the login screen as **C Semifinals:
Selection Statements**.

## Session policy

- Language: C in the current deployment
- Time limit: 90 minutes for the whole session
- Persistence: enabled
- Feedback: released after the timer expires
- Correct solution: hidden
- Review flags: enabled
- Scores during the active session: hidden

The Profile Set ID is `c-semifinals-selection-statements`. Its configuration
is stored in `profile-sets/c-semifinals-selection-statements.json`.

## Assessment blueprint

| Category | Profiles | Items | Scoring |
|---|---:|---:|---:|
| Token Qualification | 1 | 20 tokens | 20 points |
| Trace Output Commands | 2 | 10 programs | 20 points |
| Relational and Boolean Expressions | 2 | 5 expressions | 10 points |
| Trace Selection Statements | 5 | 15 programs | 30 points |
| Simulate Selection Statements | 5 | 5 programs | Generated from assessed variable and output records |
| Order Selection Statements | 5 | 5 programs | Generated from assessed variable and output records |

The first four category totals are fixed. Simulate and Order retain the app's
record-based scoring contract, so their available points follow the observable
state required by each source program.

## Interaction policy

- Trace Output uses guided execution, 50% student-derived named values, and 50%
  student-derived operator results. Output commands are system rendered.
- Relational and Boolean Expressions use variable-only operands, guided
  evaluation, 50% student-derived values and results, Undo, and no retry.
- Trace Selection uses strict execution, 50% student-derived named values,
  50% student-derived operator results, 100% student-entered output emissions,
  Undo, and no retry.
- Simulate responses remain editable until Check and have no retry.
- Order activities score the final variable and screen states rather than the
  exact submitted line order and have no retry.

## Exercise banks

The set uses 17 C-only exercise directories under
`exercise-libraries/source-programs/c/`, all prefixed with `semifinals-`.
Together they contain 35 new source programs:

- 10 guided output and input/output traces;
- 15 strict selection traces;
- 5 medium simulation programs;
- 5 ordering programs.

Programs use realistic console labels and transaction contexts. They avoid
variable-dump output such as `x = 5`.

## Validation

Run the dedicated content guard after editing the set or any exercise:

```powershell
node tests/validate-semifinals.js
```

The guard validates Profile Set identity, session policy, profile and category
counts, fixed category totals, the 20-token distribution, generated
variable-only expression profiles, all manifests, seeded minimum/middle/maximum
variants, selection constructs, parser diagnostics, terminal output, and final
variable state.

