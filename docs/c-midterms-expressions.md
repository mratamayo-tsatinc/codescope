# C - Midterms: Expressions

This bundled Profile Set is available from the login screen as **C - Midterms:
Expressions**.

## Session policy

- Language: C
- Time limit: 100 minutes for the whole session
- Teacher-authorized timer management: enabled
- Persistent student progress: enabled
- Unified session score and QR code: enabled
- Category scores and QR codes: retained

The Profile Set ID is `c-midterms-expressions`. Its configuration is stored in
`profile-sets/c-midterms-expressions.json`.

## Category order

1. Direct Output Commands
2. Output and Variable State
3. Declaration and Assignment Statements
4. Unary and Logical Evaluation

The first two categories use the Simulate Output activity. The remaining
categories use seeded generated expressions and program statements ported from
the legacy midterms profiles.

## Source exercise banks

- `midterms-direct-output`: 7 programs assessed from terminal output
- `midterms-output-variable-state`: 12 programs assessed from terminal output
  and final mutable-variable state

Legacy embedded `@output` and `@variables` answer blocks were removed. The
current engine executes each source program to derive its answer key. Variable
programs use `@codescope` seed directives with bounded numeric ranges or typed
value choices. Calculated variables remain derived from program execution.

## Generated profiles

Declaration and Assignment Statements contains nine profiles covering
declarations, simple and compound assignments, dependent values, right-hand
expressions, and advanced chains. Unary and Logical Evaluation contains three
profiles covering standalone updates, mixed assignment/unary chains, and
relational/logical expressions.

Legacy item counts, item values, templates, operand ranges, operator limits,
and student-derived response percentages are preserved.

## Validation

Run the content guard after editing the set or either exercise bank:

```powershell
node tests/validate-midterms.js
```

The guard validates session policy, category order, profile membership, legacy
point totals, manifests, metadata conversion, seeded minimum/middle/maximum
variants, parser diagnostics, generated terminal output, and final variable
state.
