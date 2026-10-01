# Simulate Output profiles

Simulate Output asks students to predict a program's terminal output and final
variable values. Authored source lives in the shared `source-programs` exercise
library. The shell parses and executes the source to generate the answer key;
the plugin owns response editing, comparison, scoring, source display, and
feedback.

## Profile configuration

Declare the activity in `js/profiles.js`:

```js
{
  enabled:true,
  meta:{id:'c-simulate-output',name:'Simulate Output',description:'...'},
  scoring:{itemCount:'manifest',pointsPerItem:'generated-answer'},
  activity:{
    kind:'simulate-output',
    instructions:'Read the source program, then predict its console output and final variable values.',
    generator:{library:'source-programs',exerciseSet:'it3-midterm-a',shuffle:false}
  }
}
```

The global app language and the registered library resolve this example to:

```text
exercise-libraries/source-programs/c/it3-midterm-a/manifest.json
```

`itemCount:'manifest'` loads every listed file. `pointsPerItem:'generated-answer'`
means the maximum is derived from the generated output lines and initialized
mutable variables. `shuffle:false` preserves manifest order; `true` produces a
seeded order that is retained in persisted sessions.

## Authoring workflow

Changing an activity requires exactly two manual steps:

1. Add or edit a source file in
   `exercise-libraries/source-programs/<language>/<exercise-set>/`.
2. Add, remove, or reorder its filename in that folder's `manifest.json`.

The manifest owns the title, membership, and order:

```json
{
  "title": "C - Simulate Output",
  "exercises": ["TaskAlpha.c", "TaskBravo.c"]
}
```

Files absent from the manifest are inactive. A missing listed file stops
loading. There is no generated catalog, copied `raw` field, importer, or build
step.

### Seed values at an authored scale

An exercise that enables seeded variable values may constrain a numeric range
to meaningful increments with the optional `step` field:

```c
/*
@codescope
@seed balance min=1000 max=1400 step=100
@seed serviceFee min=15 max=35 step=5
*/
```

`balance` can become `1000`, `1100`, `1200`, `1300`, or `1400`. The range is
inclusive when `max` lies on the step sequence; otherwise the largest generated
value is the last step below `max`. Omitting `step` preserves the existing
smallest-unit behavior, so `@seed x min=3 max=7` still produces every integer
from `3` through `7`. A step must be positive and must be a whole number for an
`int` declaration. Floating point steps use the directive's `decimals` value,
or the precision inferred from the range, step, and authored initializer.
Each name in a comma separated declaration is matched independently, so
`int balance = 1200, deposit = 350;` may provide separate `@seed balance` and
`@seed deposit` directives while preserving the authored source line.

## Exercise source

Exercise files contain ordinary source code. Do not add `@output` or
`@variables` answer blocks:

```c
#include <stdio.h>

int main() {
    int score = 75;
    score += 5;
    printf("Score: %d\n", score);
    return 0;
}
```

For each new session, CodeScope:

1. fetches the manifest-listed file without using a cache;
2. sends it through the shared source pipeline and canonical program parser;
3. executes supported statements through the language core;
4. derives the final terminal screen, including newline and carriage-return
   behavior; and
5. derives initialized mutable variable values from final program memory.

Constants are not requested as final variable state. Arrays are represented by
one response per element when the core returns an array value. Any parser or
execution diagnostic rejects the exercise instead of producing a partial or
incorrect answer key. Add support for a missing construct to the language core;
do not add answer parsing or fallback evaluation to Simulate Output.

The current `it3-midterm-a` bank is C-only. A Java deployment must add the same
exercise-set directory and manifest beneath `source-programs/java/` before this
profile can be used with Java.

## Scoring and persistence

Each generated output line and final variable value is one point. Trailing
output whitespace is ignored, while leading spaces, punctuation, and line order
remain significant. One accidental final Enter is ignored; extra output lines
reduce output credit. Variable responses are trimmed and compared with their
generated values.

Students may revise responses until Check. Practice supports Reset, Try again,
and solution disclosure through Feedback. Exam snapshots retain the generated
answer with the item, so editing a source file cannot change an active saved
attempt. Newly generated sessions always use the current manifest and source.
