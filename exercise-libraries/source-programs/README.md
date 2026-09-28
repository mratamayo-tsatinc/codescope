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
remain inactive. The active CodeScope language chooses the language directory,
and a profile's `content.exerciseSet` chooses the exercise-set directory.

`library.js` registers the canonical `source-programs` ID. The former
`program-output` and `code-simulator` library IDs are compatibility aliases for
saved configuration; new profiles should use `source-programs`.
