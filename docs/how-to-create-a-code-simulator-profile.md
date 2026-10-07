# How to create a Code Simulator profile

Code Simulator loads complete C or Java programs from live source files. The
content workflow always has two explicit steps:

1. Add or edit source files in the selected language and exercise-set folder.
2. Add, remove, or reorder their filenames in that folder's `manifest.json`.

Only manifest-listed files become activities. Source is fetched with
`cache:'no-store'` and parsed when new session content is generated; no copied
`raw` catalog is maintained in JavaScript.

## Directory layout

```text
exercise-libraries/source-programs/
  c/<exercise-set>/
    manifest.json
    Example.c
  java/<exercise-set>/
    manifest.json
    Example.java
```

The profile selects the same `<exercise-set>` name for whichever global
language is active:

```js
content:{
  mode:'source-files',
  source:{library:'source-programs',exerciseSet:'selection-basics'},
  values:{variables:'seeded',input:'seeded'}, // either may be 'authored'
  selection:{count:'all',shuffle:false},
},
lesson:{focus:'program-flow',constructs:['selection']},
interaction:{declarations:'interactive'},
presentation:{workspace:'source-program',timeline:'statement-modal'},
scoring:{itemCount:'manifest',pointsPerItem:2,statementCommits:true}
```

Use `scoring.itemCount:'manifest'` when the manifest owns the complete set.

All complete-source profiles use the independently registered
`source-programs` library. The exercise set selects `selection-basics`,
`formatted-output`, `output-basics`, or another authored set without coupling
the content to its consumer plugin. Use the canonical `source-programs`
library ID and nested `content.source` fields.

## Supported source behavior

A file may contain any combination of currently registered simulator behavior:

- initialized integer declarations and constants;
- `=`, `+=`, `-=`, `*=`, `/=`, and `%=` assignments;
- standalone prefix or postfix `++` and `--`;
- C `printf` or Java `System.out.print`/`System.out.println`;
- typed C `scanf` or Java Scanner reads when matching
  source-owned `@input` metadata is present;
- `if`, `if/else`, ordered `else if`, and `switch` conditions;
- explicit `break;` inside switch cases;
- C `return 0;`.

No statement kind is mandatory. For example, a literal-only output program can
be a valid activity without a declaration or selection. Lines for which no
statement handler exists remain visible and muted to preserve complete-program
context. A file is rejected only when it has no supported executable statement
or when recognized source/metadata contains an invalid reference or value.

## Optional source-owned seeding

The leading metadata block may allowlist literal declarations. Numeric values
use an inclusive range, while Boolean, character, and string values use
`values=` choices:

```c
/*
@codescope
@title Attendance qualification
@seed score min=60 max=100
@seed absences min=0 max=10
@seed balance min=1000 max=1400 step=100
@seed member values=true|false
*/
```

With `content.values.variables:'seeded'`, each listed binding uses its inclusive range.
An optional positive `step` restricts generated values to the sequence beginning
at `min`; omitted integer steps default to `1`.
Bindings absent from `@seed` remain authored. With `'authored'`, every source
initializer remains unchanged. Malformed, duplicate, unknown, and nonliteral
seed targets are load errors.

Input values use separate `@input` directives. Numeric inputs support
`value`, inclusive `min`/`max`, optional `step`, and optional `decimals`.
Character and string inputs use quoted `value` plus `choices` (or `values`).
`content.values.input` selects the authored value or a source-local seeded value. See
`docs/how-to-create-a-program-input-profile.md` for the interaction contract.

## Saved progress

The current catalog retains profile ID `selection-statements-source` so saved
Practice and Exam progress can still resolve it. Its presentation is Code
Simulator. Saved progress uses the stable profile ID and does not depend on a
provider alias.
