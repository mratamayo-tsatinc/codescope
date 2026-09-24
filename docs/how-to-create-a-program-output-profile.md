# How to Create a Program Output Profile

Program Output can obtain its items from authored C or Java source files or
from the existing seeded generator. The profile stays in `js/profiles.js` and
selects the content mode. Program Output owns output-statement semantics and
rendering. Code Simulator owns complete-source parsing and program flow.

## Source file mode

Configure the profile with a language independent exercise set name:

```js
{
  enabled:true,
  meta:{id:'program-output-source-flow',name:'Source Program Output',description:'...'},
  content:{
    provider:'code-simulator',
    mode:'source-files',
    sourceLibrary:'program-output',
    exerciseSet:'formatted-output',
    sourceValueMode:'authored',
    presentation:'source-flow',
    selection:{count:'all',shuffle:false},
  },
  scoring:{itemCount:'manifest',pointsPerItem:2},
  program:{
    declarations:'interactive',
    outputLesson:'formatted-values',
    scoreAssignments:true,
    timelinePresentation:'statement-modal',
  },
  // shape, operators, and template remain available for generated mode.
}
```

The global app language selects the language folder. `sourceLibrary` keeps the
existing Program Output exercise bank as the single authored copy, while Code
Simulator parses and executes its complete programs. The profile's
`exerciseSet` selects the folder beneath that library:

```text
plugins/program-output/exercises/
  c/formatted-output/manifest.json
  c/formatted-output/BasicValues.c
  java/formatted-output/manifest.json
  java/formatted-output/BasicValues.java
```

Changing the activity requires two deliberate edits:

1. Add or edit a source file in the appropriate language and exercise-set
   folder.
2. Add its filename to that folder's `manifest.json`.

The manifest is the membership and ordering authority. A file that exists in
the folder but is absent from the manifest is not loaded or shown. No catalog
file, copied `raw` string, or preprocessing command is required.

```json
{
  "title": "C Formatted Output",
  "exercises": ["BasicValues.c", "MultipleValues.c"]
}
```

Use `selection.count:'all'` with `scoring.itemCount:'manifest'` when every
manifest entry is an activity item. The loaded manifest length then determines
the profile and category maximum scores. Adding, removing, or reordering a
listed source file requires no profile edit. A positive numeric count remains
available for profiles that intentionally choose a fixed subset; in that case
the numeric `scoring.itemCount` must match it and cannot exceed the manifest
size. `selection.shuffle:true` uses CodeScope's seeded random source, so an Exam
snapshot restores the chosen items and order.

The browser fetches every listed source file when the session is generated and
Code Simulator parses that current text into Program IR. Statement order and
supported control flow therefore come from the loaded file. The provider must not keep a
second raw-source catalog, expected statement list, or hardcoded jump target.
Persisted Exam attempts continue to restore their saved item snapshot so an
in-progress assessment cannot change when a teacher later edits a file.

## Exercise metadata

Put optional CodeScope metadata in the leading block comment:

```c
/*
@codescope
@title Multiple values in one printf
@result z
*/
#include <stdio.h>

int main() {
    int x = 12;
    int y = 8;
    int z = x + y;
    printf("Value of x is %d\nand value of y is %d\nand their sum is %d", x, y, z);
    return 0;
}
```

- `@title` supplies the exercise title.
- `@result` identifies the exercise's result binding. Without it, the last
  declared variable is used. A `source-flow` profile does not add a fabricated
  assignment or final-expression line to the authored program.

The parser currently accepts the beginner subset used by Program Core:

- initialized `int` declarations and C `const int` or Java `final int`;
- integer expressions with identifiers, literals, parentheses, `+`, `-`, `*`,
  `/`, and `%`;
- simple and compound assignments;
- prefix and postfix `++` and `--`;
- C `printf` string literals with `%d`, `%%`, and common escapes;
- Java `System.out.print` and `System.out.println` with string and identifier
  concatenation.

Each `%d` must have a matching initialized identifier. A Java output expression
must likewise be an initialized identifier. One output statement may reference
multiple variables; each produces its own memory read and replacement step.

With `presentation:'source-flow'`, the complete metadata-free source becomes
the interactive program statement flow. Each authored source line occupies its
actual position and displays its actual line number. Leading indentation, blank
lines, braces, headers/imports, and wrappers remain visible. An exact C
`return 0;` becomes the final direct action and must be clicked to finish the
program; Java has no synthesized return action. Lines converted to registered
Program IR retain their established interactions;
unsupported lines remain muted and read-only. No separate source overview and
no synthetic result assignment are added. Structural errors that prevent the
source from being read still fail content loading with the exercise filename.

When the profile also uses `program.timelinePresentation:'statement-modal'`, a
literal-only output statement executes directly from its source line and sends
its text to Program Output. An output statement with identifiers still opens
the trace modal because memory reads and placeholder or concatenation steps
remain for the learner to perform.

The `program-output-basics` profile continues to use the Program Output content
provider for its statement-oriented lesson. The complete-source profile uses
Code Simulator so future supported statements in the same authored files join
the program flow without another profile migration.

For an output statement with several variables, Guided mode allows every
unread variable to be selected in any order. Reading one variable unlocks only
its matching `%d` or concatenation operator. Strict mode exposes all unresolved
variables, placeholders or concatenation operators, and the output command;
premature actions follow the configured strict invalid-execution policy.
Resolved timeline rows retain the original variable as a muted source token so
the authored command never appears to lose an argument.

Create equivalent exercise sets under `c/` and `java/` when students may switch
the global language. Their manifests should provide the intended lesson
coverage for each language.

## Generated mode

To retain seeded generation, change only the content mode:

```js
content:{provider:'program-output',mode:'generated',recipe:'formatted-values'}
```

Generated mode uses the profile's existing `shape`, `operators`, `template`,
`scoring`, and `program.outputLesson` fields. This is also the pattern future
content providers should follow: the profile chooses the source, while the
plugin converts either source into the same persisted item and Program IR.

## Validation

Serve the repository over HTTP so `fetch()` can load manifests and source
files, then run the complete automated gate:

```text
node tests/run-tests.js
```

Verify both global languages, manifest order, source line numbers and spacing,
multi-variable output, Undo, manual modal dismissal, explicit C `return 0;`
completion, and refresh persistence.
