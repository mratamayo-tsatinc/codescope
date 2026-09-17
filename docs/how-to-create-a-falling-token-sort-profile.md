# How to Create a Falling Token Sort Profile

Falling Token Sort presents a configurable number of tokens and asks the student
to send each one to a configured category bucket. The token follows the shared curved
transfer animation into the selected bucket. Practice and Exam behavior, token
counts, scoring, feedback, bucket positions, and category choices all come from
the profile rather than from a profile-name check.

## Where the profile belongs

Add the profile object to `PROFILES_RAW` in `js/profiles.js`.

Do not create a profile file inside `plugins/falling-token-sort/`. That directory
owns the activity's behavior and assets; the global profile catalog owns the
configuration used to compose activities.

## Complete current profile

```js
{
  meta: {
    id: 'falling-identifier-sort',
    name: 'Falling Identifier Sort',
    description: 'Sort standalone names as valid identifiers, invalid identifiers, or reserved words.',
  },
  scoring: {
    itemCount: 5,
    pointsPerItem: 3,
  },
  activity: {
    kind: 'falling-token-sort',
    instructions: 'Select a token, then send it to the bucket that correctly classifies it.',
    buckets: [
      { id: 'valid', category: 'valid-identifier', region: 'left', order: 1 },
      { id: 'invalid', category: 'invalid-identifier', region: 'left', order: 2 },
      { id: 'reserved', category: 'reserved-word', region: 'left', order: 3 },
    ],
    dropArea: {
      visibleTokens: 3,
    },
    generator: {
      capability: 'analyzed-token-generation',
      identifierGeneration: {
        templates: [
          'modifier-measurement',
          'entity-measurement',
          'entity-technical',
        ],
        styles: [
          'camel-case',
          'snake-case',
          'constant-case',
          'pascal-case',
          'underscore-prefix',
          'digit-suffix',
          'dollar-prefix',
          'case-mutated-reserved',
        ],
        invalidStrategies: [
          'leading-digit',
          'illegal-character',
          'embedded-space',
          'punctuation',
          'reserved-as-identifier',
        ],
        weights: {
          templates: {
            'modifier-measurement': 3,
            'entity-measurement': 3,
            'entity-technical': 2,
          },
          styles: {
            'camel-case': 3,
            'snake-case': 2,
            'constant-case': 2,
          },
          invalidStrategies: {
            'leading-digit': 3,
            'illegal-character': 3,
            'embedded-space': 2,
          },
        },
        length: { min: 3, max: 32 },
        uniqueness: {
          scope: 'profile-session',
          reuse: 'avoid-until-exhausted',
        },
      },
      policies: {
        practice: {
          counts: {
            'valid-identifier': { min: 3, max: 5 },
            'invalid-identifier': { min: 3, max: 5 },
            'reserved-word': { min: 3, max: 5 },
          },
          shuffle: true,
        },
        exam: {
          counts: {
            'valid-identifier': { exact: 5 },
            'invalid-identifier': { exact: 5 },
            'reserved-word': { exact: 5 },
          },
          shuffle: true,
        },
      },
    },
    assessment: {
      action: 'SORT_TOKEN',
      cardinality: 'per-token',
      scoreAttempt: 'first',
      completion: 'all-tokens-placed',
    },
    response: {
      policies: {
        practice: { incorrectPlacement: 'return-token' },
        exam: { incorrectPlacement: 'accept' },
      },
    },
    feedback: {
      practice: 'immediate-return',
      exam: 'deferred-until-submit',
    },
  },
},
```

The profile follows the same shell conventions as older activities:

- `meta.id` is the unique persistence and navigation key.
- `meta.name` and `meta.description` supply the profile-list text.
- `scoring.itemCount` controls how many items the session generates.
- `scoring.pointsPerItem` controls each item's maximum score.
- `activity.kind` selects the plugin that interprets the remaining fields.

## Configure buckets

Every bucket needs four fields:

| Field | Meaning |
|---|---|
| `id` | Unique action and count key within the profile. |
| `category` | Canonical token category accepted by the bucket. |
| `region` | `top`, `left`, `right`, or `bottom`. |
| `order` | Numeric order among buckets occupying the same region. |

The current canonical categories support:

| Category | Typical tokens |
|---|---|
| `valid-identifier` | `score`, `studentCount` |
| `invalid-identifier` | `2ndScore`, `student-name` |
| `reserved-word` | `class`, `while` |
| `operator` | `=`, `+=`, `&&` |
| `literal` | `7`, `3.14`, `'A'`, `true` |
| `separator` | `;`, `,`, `(`, `)` |

Only configured categories appear in an activity. The app does not add an
identifier, operator, literal, or separator bucket automatically.

Valid and invalid identifiers are procedurally proposed from the selected
templates and styles, then independently accepted or rejected by the active
C/Java analyzer. Reserved words come from the language's canonical reserved
set. The generator's intended strategy is never treated as an answer key.

See `docs/identifier-generation.md` for vocabulary roles, styles, invalid
strategies, uniqueness, and the generator/analyzer/feedback boundary.

This example places three buckets along the left and two along the bottom:

```js
buckets: [
  { id: 'valid', category: 'valid-identifier', region: 'left', order: 1 },
  { id: 'invalid', category: 'invalid-identifier', region: 'left', order: 2 },
  { id: 'reserved', category: 'reserved-word', region: 'left', order: 3 },
  { id: 'operator', category: 'operator', region: 'bottom', order: 1 },
  { id: 'separator', category: 'separator', region: 'bottom', order: 2 },
],
```

`order` is local to a region. Reusing `order: 1` in different regions is valid.

## Configure token counts per category

Every configured bucket category requires its own count rule in every mode
policy. A rule can be fixed or ranged:

```js
counts: {
  operator: { exact: 4 },
  separator: { min: 2, max: 5 },
}
```

- `{ exact: 5 }` always generates five tokens for that category.
- `{ min: 3, max: 5 }` randomly selects an inclusive count from three to five.
- A positive integer such as `5` is also accepted as a fixed count.
- `shuffle: true` mixes the generated categories into a seeded order.
- `shuffle: false` preserves bucket/category generation order.

Counts are deliberately per category. There is no generic balance setting and
the plugin does not infer counts from the number of buckets.

The generator reads the policy named for the current shell mode. Practice items
use the shell's fresh session seed. Exam items capture their generated token
sequence, language, and mode inside the saved examination state, so resuming an
exam restores the original items together with student progress.

## Configure visible tokens

```js
dropArea: { visibleTokens: 3 }
```

`visibleTokens` is a positive integer. With more than one visible token, the
student selects a token before choosing a bucket. After a placement, the next
unplaced token enters the visible area; tokens can be sorted in any order within
that area. A single visible token retains the original direct bucket workflow.
Selection is included in saved Exam progress, while scoring still applies only
to each token's bucket attempts.

## Configure scoring

```js
assessment: {
  action: 'SORT_TOKEN',
  cardinality: 'per-token',
  scoreAttempt: 'first',
  completion: 'all-tokens-placed',
}
```

- `scoreAttempt: 'first'` scores the student's first bucket choice for each
  token, even when Practice returns an incorrectly placed token for correction.
- `scoreAttempt: 'latest'` scores the most recent remaining attempt.
- The item becomes checkable only after all tokens have been accepted into a
  bucket.
- The item score is proportional: correct scored tokens divided by total tokens,
  multiplied by `scoring.pointsPerItem`.

`action`, `cardinality`, and `completion` name capabilities implemented by this
plugin. The current version accepts `SORT_TOKEN`, `per-token`, and
`all-tokens-placed` respectively.

## Configure incorrect placements

Each mode independently chooses what happens after a wrong bucket selection:

```js
response: {
  policies: {
    practice: { incorrectPlacement: 'return-token' },
    exam: { incorrectPlacement: 'accept' },
  },
}
```

- `return-token` records the scored attempt but keeps the token in the drop area
  so the student can choose again.
- `accept` records the attempt, places the token in the selected bucket, and
  advances to the next token without revealing correctness.

These behaviors are not automatically tied to Practice or Exam. The profile
assigns either supported policy to either mode.

## Configure feedback

```js
feedback: {
  practice: 'immediate-return',
  exam: 'deferred-until-submit',
}
```

Supported values are:

- Practice: `immediate-return` or `deferred`.
- Exam: `deferred-until-submit` or `never`.

Practice feedback includes the existing Show/Hide correct solution control.
Exam feedback also respects the shell's exam feedback-release setting and never
reveals the correct solution during an active attempt.

## Language behavior

The plugin uses the shell's configured C or Java language when it generates an
item. It obtains valid names, invalid names, and reserved words from canonical
language rules rather than embedding answers in the profile. Each item stores a
language snapshot so changing a setting later cannot reinterpret an existing
item or resumed exam.

## Validation checklist

Before using a new profile, verify that:

- `meta.id` is unique across every profile.
- `scoring.itemCount` and `scoring.pointsPerItem` are present.
- `activity.kind` is exactly `falling-token-sort`.
- Every bucket has a unique `id` and category.
- Every bucket uses a supported `region` and numeric `order`.
- Every bucket category has a count rule in both Practice and Exam policies.
- Fixed counts are positive; ranged counts have `min <= max`.
- `dropArea.visibleTokens` is a positive integer.
- Response, assessment, and feedback values use the supported capability names.
- No profile configuration was added inside the plugin directory.

Run the compatibility suite after editing:

```bash
node tests/run-tests.js
```

The plugin will reject an invalid profile during registration with a message
that identifies the profile and unsupported field.
