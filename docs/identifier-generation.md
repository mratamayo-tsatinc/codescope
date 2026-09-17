# Procedural Identifier Generation

The identifier pipeline separates candidate construction, canonical analysis,
and student feedback. Updating how identifiers are composed does not change the
analyzer or feedback as long as the new candidates use already-supported
language rules.

## Module boundary

1. `identifier-generator.js` proposes seeded text and records its construction
   strategy. It does not assign a trusted category.
2. `classifier.js` analyzes that text using the selected C or Java rules and
   returns lexical category, contextual category, and structured violations.
3. Each activity's feedback module translates that analysis into its own UI.

The activity plugin coordinates these modules. The shell supplies only the
session seed, selected language, persistence, and an opaque per-profile
generation context used for uniqueness.

## Language definition

Each language file contains separate sections:

- Canonical rules: identifier start/continuation patterns and reserved words.
- Generation guidance: semantic vocabulary, compatible templates, supported
  styles, and characters that can deliberately corrupt a candidate.

The generator is language-aware so it can produce useful candidates. The
analyzer is language-authoritative and always determines the final answer.

For example, `$itemCount` is a valid Java candidate but an invalid standard C
candidate. The analyzer—not the strategy name—decides that result.

## Semantic vocabulary and templates

Vocabulary is divided by role instead of placed in one interchangeable list:

```js
vocabulary: {
  modifiers: ['total', 'min', 'max', 'avg'],
  measurements: ['count', 'price', 'score', 'value'],
  entities: ['student', 'item', 'user', 'product'],
  technicalNouns: ['buffer', 'index', 'data', 'result']
}
```

Templates declare compatible pairings:

```js
templates: {
  'modifier-measurement': ['modifiers', 'measurements'],
  'entity-measurement': ['entities', 'measurements'],
  'entity-technical': ['entities', 'technicalNouns']
}
```

This produces readable combinations such as `totalScore`, `studentCount`, and
`itemIndex` while avoiding arbitrary pairings such as `countTotal`.

## Naming styles

Profiles may enable any registered style:

- `camel-case`: `totalScore`
- `snake-case`: `total_score`
- `constant-case`: `TOTAL_SCORE`
- `pascal-case`: `TotalScore`
- `underscore-prefix`: `_totalScore`
- `digit-suffix`: `totalScore2`
- `dollar-prefix`: `$totalScore` when the language supports it
- `case-mutated-reserved`: `Class` or `RETURN`

Language-specific styles are filtered at generation time. A profile can remain
language-agnostic while Java enables `$` and C omits it.

## Invalid strategies

Invalid candidates are controlled mutations of readable candidates:

- `leading-digit`
- `illegal-character`
- `embedded-space`
- `punctuation`
- `reserved-as-identifier`

The strategy is only an intention. Every proposal is analyzed, and a candidate
is accepted into a requested category only when canonical analysis agrees.
Thus `item$count` may be rejected as an invalid Java proposal but accepted as
an invalid C proposal.

## Lexical versus contextual answers

The analyzer returns both categories. Standalone Falling Token Sort uses the
lexical category. Statement activities use the contextual category selected by
their answer resolver.

Java `class` is therefore:

- `reserved-word` as a standalone lexical token;
- `invalid-identifier` in a declaration-name position, with the violation
  `reserved-word-used-as-identifier`.

## Seed and uniqueness

Every random choice uses the shell's seeded generator. The same seed,
configuration, language, and generation order reproduce the same candidates.
Exam items store their final text, analysis, language, and progress, so resumed
exams do not regenerate or reinterpret identifiers.

Profiles configure uniqueness:

```js
uniqueness: {
  scope: 'profile-session',
  reuse: 'avoid-until-exhausted'
}
```

`item` prevents repetition inside one item. `profile-session` shares an opaque
set across every generated item in that profile. Assignment statements may
still intentionally reuse declaration names because they refer to the same
program entity rather than generating a new candidate.

Profiles may also set `length: { min, max }`. Proposals outside that inclusive
range are not accepted into the generated item.

## Strategy weights

Enabled templates, styles, and invalid strategies use equal probability unless
the profile supplies relative weights:

```js
weights: {
  templates: {
    'modifier-measurement': 3,
    'entity-measurement': 3,
    'entity-technical': 2
  },
  styles: {
    'camel-case': 3,
    'snake-case': 2,
    'constant-case': 2,
    'case-mutated-reserved': 1
  },
  invalidStrategies: {
    'leading-digit': 3,
    'illegal-character': 3,
    'embedded-space': 2,
    punctuation: 2,
    'reserved-as-identifier': 2
  }
}
```

Weights influence proposal frequency but never correctness. The analyzer still
accepts or rejects every result independently.

## Profile configuration

```js
identifierGeneration: {
  templates: [
    'modifier-measurement',
    'entity-measurement',
    'entity-technical'
  ],
  styles: [
    'camel-case',
    'snake-case',
    'constant-case',
    'pascal-case',
    'underscore-prefix',
    'digit-suffix',
    'dollar-prefix',
    'case-mutated-reserved'
  ],
  invalidStrategies: [
    'leading-digit',
    'illegal-character',
    'embedded-space',
    'punctuation',
    'reserved-as-identifier'
  ],
  weights: {
    templates: {
      'modifier-measurement': 3,
      'entity-measurement': 3,
      'entity-technical': 2
    },
    styles: {
      'camel-case': 3,
      'snake-case': 2,
      'constant-case': 2
    },
    invalidStrategies: {
      'leading-digit': 3,
      'illegal-character': 3,
      'embedded-space': 2
    }
  },
  length: { min: 3, max: 32 },
  uniqueness: {
    scope: 'profile-session',
    reuse: 'avoid-until-exhausted'
  }
}
```

The plugin validates all named capabilities during registration. Add new
combinations or styles only to the generator. Update the analyzer only when a
new canonical language rule is introduced, and update feedback only when a new
violation needs distinct wording.
