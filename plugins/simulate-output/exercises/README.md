# Simulate Output exercise banks

Exercise content is organized as:

```text
<language>/<exercise-set>/manifest.json
<language>/<exercise-set>/<source files>
```

The language comes from CodeScope's global `state.language`. The exercise set
comes from `activity.generator.exerciseSet` in `js/profiles.js`.

For example, `state.language = 'c'` and `exerciseSet: 'printing'` load:

```text
c/printing/manifest.json
```

To edit a set, place its source files beside its manifest and list the desired
filenames in the manifest's `exercises` array. Files not listed there remain
inactive. No importer or generated catalog is required.
