# How to Create a Program Output Profile

Program Output can obtain its items from authored C or Java source files or
from the existing seeded generator. The profile stays in `js/profiles.js` and
selects the content mode. The Program Output plugin owns source loading,
parsing, interaction, and rendering.

## Source file mode

Configure the profile with a language independent exercise set name:

```js
{
  enabled:true,
  meta:{id:'program-output-basics',name:'Output Statements',description:'...'},
  content:{
    provider:'program-output',
    mode:'source-files',
    recipe:'formatted-values',
    exerciseSet:'formatted-output',
    selection:{count:5,shuffle:false},
  },
  scoring:{itemCount:5,pointsPerItem:2},
  program:{declarations:'interactive',outputLesson:'formatted-values',scoreAssignments:true},
  // shape, operators, and template remain available for generated mode.
}
```

The global app language selects the language folder. The profile's
`exerciseSet` selects the folder beneath it:

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

`selection.count` is a positive integer or `"all"`; when omitted, it defaults
to `scoring.itemCount`. The selected total must equal `scoring.itemCount` so
category maximum scores stay accurate, and it must not exceed the manifest
size. `selection.shuffle:true` uses CodeScope's seeded random source, so an Exam
snapshot restores the chosen items and order.

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
- `@result` selects the declaration used by the established final expression
  check. Without it, the last declared variable is used.

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

The complete metadata-free source is retained in the item and shown above the
interactive execution flow. Lines converted to registered Program IR remain
readable there; includes, imports, class or method scaffolding, braces, returns,
and statements without a registered capability remain muted and read-only.
Unsupported statements do not disappear and do not gain invented behavior.
Structural errors that prevent the source from being read still fail content
loading with the exercise filename.

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

Verify both global languages, manifest order, multi-variable output, Undo,
refresh persistence, and the final expression check.
