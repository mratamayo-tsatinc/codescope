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
  provider:'code-simulator',
  mode:'source-files',
  library:'source-programs',
  exerciseSet:'selection-basics',
  sourceValueMode:'seeded', // or 'authored'
  inputValueMode:'seeded',  // or 'authored'
  presentation:'source-flow',
  selection:{count:'all',shuffle:false},
},
program:{
  declarations:'interactive',
  scoreAssignments:true,
  timelinePresentation:'statement-modal',
}
```

Use `scoring.itemCount:'manifest'` when the manifest owns the complete set.

All complete-source profiles use the independently registered
`source-programs` library. The exercise set selects `selection-basics`,
`formatted-output`, `output-basics`, or another authored set without coupling
the content to its consumer plugin. The former `code-simulator` and
`program-output` library IDs, and the `sourceLibrary` field name, remain
temporary compatibility aliases for saved configuration.

## Supported source behavior

A file may contain any combination of currently registered simulator behavior:

- initialized integer declarations and constants;
- `=`, `+=`, `-=`, `*=`, `/=`, and `%=` assignments;
- standalone prefix or postfix `++` and `--`;
- C `printf` or Java `System.out.print`/`System.out.println`;
- C `scanf` with `%d`/`%i` or Java `Scanner.nextInt()` when matching
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

The leading metadata block may allowlist literal integer declarations:

```c
/*
@codescope
@title Attendance qualification
@seed score min=60 max=100
@seed absences min=0 max=10
*/
```

With `sourceValueMode:'seeded'`, each listed binding uses its inclusive range.
Bindings absent from `@seed` remain authored. With `'authored'`, every source
initializer remains unchanged. Malformed, duplicate, unknown, and nonliteral
seed targets are load errors.

Input values use separate `@input target=<name> value=<integer> min=<integer>
max=<integer>` directives. `inputValueMode` selects the authored value or its
inclusive source-local range. See
`docs/how-to-create-a-program-input-profile.md` for the interaction contract.

## Compatibility

The current catalog retains profile ID `selection-statements-source` so saved
Practice and Exam progress can still resolve it. Its provider and visible name
are Code Simulator. `program-selection` remains accepted only as a legacy
provider alias for older saved configurations.
