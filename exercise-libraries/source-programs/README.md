# Source Program Exercise Library

This library contains complete C and Java programs consumed by source-backed
CodeScope profiles. It is content rather than plugin behavior.

The directory contract is:

```text
source-programs/<language>/<exercise-set>/manifest.json
source-programs/<language>/<exercise-set>/<source-file>
```

Changing an exercise set requires two deliberate steps:

1. Add or edit the source file in the appropriate language and exercise-set
   directory.
2. Add, remove, or reorder its filename in that directory's `manifest.json`.

Only manifest-listed files are loaded. Source files absent from the manifest
remain inactive. The active CodeScope language chooses the language directory.
Complete-source profiles select the set through
`content.source.exerciseSet`; activity profiles such as Simulate Output use
`activity.generator.exerciseSet`. Both select this library with the
`source-programs` ID registered by `library.js`.

Simulate Output source files are ordinary programs. They must not contain
`@output` or `@variables` answer blocks. The shared source pipeline parses
the current file and generates expected terminal output and final initialized
mutable memory from language-core effects. A core diagnostic rejects the
exercise so unsupported source cannot silently produce a partial answer key.

The current `it3-midterm-a` bank is C-only. A Java profile needs a matching
`java/<exercise-set>/manifest.json` and Java source files.