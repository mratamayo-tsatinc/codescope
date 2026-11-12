# C Final Exam

`profile-sets/c-final-exam.json` defines the C-only final examination profile
set. It is registered as an enabled, non-default option in
`profile-sets/manifest.json`.

## Session policy

- C language only
- 90-minute timer with no teacher reset
- persistent student progress
- unified result summary
- no retry after checking an item
- checked items lock immediately
- feedback is deferred until timeout
- correct solutions are never available

## Assessment order

The four categories appear in this order:

1. Trace
2. Code Ordering
3. Complete the Code
4. Simulate

Each category contains one profile backed by exactly five exercises. Every
manifest and profile disables shuffling so the authored easy-to-hard order is
stable. Items 1–3 use narrow seed ranges. Items 4–5 use broader, bounded ranges
for `continue`, `break`, and nested-loop reasoning.

The fixed item budgets are:

- Trace: 2 points
- Code Ordering: 3 points
- Complete the Code: 4 points
- Simulate: 5 points

## Exercise banks

The C sources live under `exercise-libraries/source-programs/c/`:

- `final-exam-trace`
- `final-exam-ordering`
- `final-exam-completion`
- `final-exam-simulate`

Trace, Code Ordering, and Simulate use source-owned `@seed` metadata. Where a
raw program used a literal loop boundary directly, a named boundary with the
same authored value was introduced so the source pipeline can seed it safely.
Complete the Code contains only `@codescope` titles and explicitly selects
authored variable and input values.

Each activity retains its detailed checks, but partial correctness is scaled
into that activity's fixed item maximum.

## Validation

Run:

```bash
node tests/validate-final-exam.js
node tests/validate-code-completion.js
```

The final-exam validator checks profile policy, category and manifest order,
metadata, minimum/midpoint/maximum seeded execution, authored completion
execution, and fixed Simulate scoring. The completion validator also generates
all five final-exam completion items and confirms that they retain authored
values.
