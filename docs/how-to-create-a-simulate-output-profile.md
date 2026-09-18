# Simulate Output profiles

The `simulate-output` plugin presents C programs and asks students to predict
printed output and final variable values. CodeScope owns login, mode, timer,
navigation, exam persistence, and score summary. The plugin owns the exercises,
answer parsing, response editing, scoring, source display, and feedback.

## Current profile

`c-simulate-output` is defined in `js/profiles.js`:

```js
{
  meta:{id:'c-simulate-output',name:'C Program Output',
    description:'Read C programs, predict their printed output, and give final variable values.'},
  scoring:{itemCount:19,pointsPerItem:10},
  activity:{
    kind:'simulate-output',language:'c',
    instructions:'Read the C source, then predict its console output and final variable values. Check when ready.',
    generator:{bank:'it3-midterm-a',shuffle:true}
  }
}
```

`itemCount` may be 1–19 for this bank. A seeded shuffle chooses that many
different exercises without replacement. The generated order is saved in the
Exam item snapshot. The exercise language is always C, regardless of the
session's general C/Java setting.

## Exercise source and answer format

The 19 imported programs are under `plugins/simulate-output/exercises/`. Each
file begins with a metadata comment followed by the C source:

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

Only the C source is shown to students. `@output` has one expected line per
printed line. `@variables` contains `name = value` entries; a placeholder
`(this program does not declare any variables)` means no variable answers.
An array value may use `{value1, value2}` and receives one check per element.

After editing or adding an exercise, run:

```bash
node plugins/simulate-output/import-exercises.cjs
node tests/run-tests.js
```

The importer rebuilds `catalog.js` for the classic-script runtime. Add a new
exercise to the bank by placing a `TaskName.c` file in the plugin's `exercises/`
directory, rebuilding the catalog, and adjusting `itemCount` if the profile
should include it. The profile contains no answer strings.

## Scoring and mode behavior

Each expected output line and final variable value is one check. Trailing
whitespace on output lines is ignored, but leading spaces, punctuation, and
line order matter. One accidental final Enter is ignored; extra printed lines
reduce output credit, down to zero. Variable responses are trimmed and compared
as text. The check ratio is scaled to the profile's `pointsPerItem` budget.

Students may edit responses until Check. Practice can reset an unchecked item
or use Try again after checking; the Feedback drawer offers the correct
solution. Exam responses are saved as they are typed and lock on Check.
Correctness remains withheld until Exam submission if the exam policy permits
release. The static client includes its answer bank, so browser source inspection
can expose answers; server-side answer secrecy would require a backend.
