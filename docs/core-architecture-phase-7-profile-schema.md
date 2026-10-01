# Phase 7: profile schema simplification

Phase 7 makes profiles declarative. A profile describes the lesson and the
experience the learner should receive. It does not choose a parser, semantic
engine, or content adapter.

## Current schema

Program profiles may use these capability blocks:

```js
{
  content:{
    mode:'source-files',
    source:{library:'source-programs',exerciseSet:'selection-basics'},
    values:{variables:'seeded',input:'authored'},
    selection:{count:'all',shuffle:false}
  },
  lesson:{focus:'program-flow',variant:'...',constructs:['selection']},
  interaction:{declarations:'interactive'},
  presentation:{workspace:'source-program',timeline:'statement-modal'},
  scoring:{itemCount:'manifest',pointsPerItem:2,statementCommits:true}
}
```

- `content` describes where authored or generated items come from.
- `lesson` identifies the learning focus without naming an implementation.
- `interaction` describes learner actions that the lesson requires.
- `presentation` selects the workspace and timeline form.
- `scoring` contains assessment policy, including whether statement commits
  contribute to the item score.

The active catalog no longer uses `content.provider` or the legacy `program`
block.

## Adapter resolution

Content adapters register a `matches(profile)` predicate with Activity Core.
Activity Core resolves exactly one adapter from the declarative description.
No match is a configuration error, and multiple matches are rejected as
ambiguous. This keeps parser and provider identity out of author-facing
profiles.

Program Output matches output-focused generated or statement-flow content.
Code Simulator matches source-file content presented in the complete
`source-program` workspace. Their source loaders continue to send authored
files through the shared source pipeline and Program IR.

## Phase 8 migration boundary

Phase 7 temporarily accepted older external profile catalogs while the active
catalog moved to the declarative schema. Phase 8 removed that translation
layer. External catalogs must now use the current blocks shown above.

## Completion gate

- No active profile selects a content provider or parser.
- No active profile contains a legacy `program` configuration block.
- Generated and source-backed profiles retain their prior item count, scoring,
  interaction, and presentation behavior.
- The appropriate adapter is inferred from profile capabilities.
- Authoring guides and the Phase 0 snapshot describe the current schema.
- The complete regression suite passes.
