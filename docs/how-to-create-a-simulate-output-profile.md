# Simulate Output profiles

The `simulate-output` plugin presents source programs and asks students to predict
printed output and final variable values. CodeScope owns login, mode, timer,
navigation, exam persistence, and score summary. The plugin owns the exercises,
answer parsing, response editing, scoring, source display, and feedback.

## Current profile

`c-simulate-output` is defined in `js/profiles.js`:

```js
{
  enabled:true,
  meta:{id:'c-simulate-output',name:'Simulate Output',
    description:'Read source programs, predict their printed output, and give final variable values.'},
  scoring:{itemCount:'manifest',pointsPerItem:'exercise-metadata'},
  activity:{
    kind:'simulate-output',
    instructions:'Read the source program, then predict its console output and final variable values. Check when ready.',
    generator:{exerciseSet:'it3-midterm-a',shuffle:false}
  }
}
```

`exerciseSet` selects a named exercise folder. CodeScope combines it with the
global `state.language` value. With `state.language:'c'`, the example resolves
to:

`plugins/simulate-output/exercises/c/it3-midterm-a/manifest.json`

`itemCount:'manifest'` means every filename listed in that set's manifest is
one CodeScope item. `pointsPerItem:'exercise-metadata'` means the item maximum
is the number of expected output lines plus the number of final variable
values declared by that exercise. Nothing in `profiles.js` needs to change when
the exercise set changes.

`shuffle:false` preserves manifest order. Set it to `true` only when a seeded
random order is intentionally required. The generated order is saved in a
persisted session snapshot.

## Directory structure

Organize banks by language, then by named exercise set:

```text
plugins/simulate-output/exercises/
├── c/
│   ├── printing/
│   │   ├── manifest.json
│   │   ├── PrintLine.c
│   │   └── PrintFormat.c
│   ├── selection/
│   │   ├── manifest.json
│   │   └── IfElse.c
│   └── looping/
│       ├── manifest.json
│       └── ForLoop.c
└── java/
    ├── printing/
    │   ├── manifest.json
    │   └── PrintLine.java
    └── selection/
        ├── manifest.json
        └── IfElse.java
```

Language and set directory names must be lowercase slugs such as `c`, `java`,
`printing`, or `nested-loops`. The app's language is global; profiles select
exercise sets and never override that language.

## Change one exercise set

The authoring workflow has exactly two manual steps:

1. Add, edit, or remove source files in the chosen language and set directory.
2. Update the `exercises` array in that same directory's `manifest.json`.

The browser fetches the manifest and then fetches only the files listed in it,
in the listed order, when CodeScope starts. A source file that exists in the
directory but is absent from the manifest is not rendered. A manifest entry
whose file is missing stops initialization with a clear loading error. There
is no generated catalog, duplicated `raw` string, importer command, or build
step.

The manifest controls only the set title, membership, and order:

```json
{
  "title": "Printing Practice",
  "exercises": ["TaskAlpha.java", "TaskBravo.java"]
}
```

To add another activity bank, create the same set folder under each language
that deployment supports, then point a profile to the shared set name:

```js
generator:{exerciseSet:'printing',shuffle:false}
```

When the global language is `c`, this profile loads `exercises/c/printing/`.
When it is `java`, it loads `exercises/java/printing/`. A missing language/set
manifest or a missing listed source file stops initialization with a clear
error instead of silently loading another language.

## Exercise source and answer format

Each source file begins with a metadata comment followed by its source code:

```c
/*
@output
Printed line one
Printed line two
@variables
count = 2
*/
#include <stdio.h>
/* C program follows */
```

Only the source below the metadata is shown to students. `@output` has one expected line per
printed line. `@variables` contains `name = value` entries; a placeholder
`(this program does not declare any variables)` means no variable answers.
An array value may use `{value1, value2}` and receives one check per element.

The metadata is parsed directly from the fetched source file at runtime. Keep
the answer metadata in the source file; the profile and manifest contain no
answer strings.

## Scoring and mode behavior

Each expected output line and final variable value is one point. Trailing
whitespace on output lines is ignored, but leading spaces, punctuation, and
line order matter. One accidental final Enter is ignored; extra printed lines
reduce output credit, down to zero. Variable responses are trimmed and compared
as text. Therefore different exercise files can have different maximum scores,
matching the original standalone app.

Students may edit responses until Check. Practice can reset an unchecked item
or use Try again after checking; the Feedback drawer offers the correct
solution. Exam responses are saved as they are typed and lock on Check.
Correctness remains withheld until the Exam timer expires if the exam policy permits
release. The static client includes its answer bank, so browser source inspection
can expose answers; server-side answer secrecy would require a backend.
