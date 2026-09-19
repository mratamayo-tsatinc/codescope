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
  enabled: true,
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
    instructions: 'Drag a token into its matching bucket. Keyboard: select a token, then choose a bucket.',
    buckets: [
      { id: 'valid', category: 'valid-identifier', region: 'left', order: 1 },
      { id: 'invalid', category: 'invalid-identifier', region: 'left', order: 2 },
      { id: 'reserved', category: 'reserved-word', region: 'left', order: 3 },
    ],
    dropArea: {
      visibleTokens: 3,
      landingBehavior: 'pass-through',
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
          totalTokens: { target: 12 },
          counts: {
            'valid-identifier': { min: 3, max: 5 },
            'invalid-identifier': { min: 3, max: 5 },
            'reserved-word': { min: 3, max: 5 },
          },
          shuffle: true,
        },
        exam: {
          totalTokens: { exact: 15 },
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
      exam: 'deferred-until-timeout',
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
| `arithmetic-operator` | `+`, `-`, `*`, `/`, `%` |
| `relational-operator` | `<`, `>`, `<=`, `>=`, `==`, `!=` |
| `boolean-operator` | `&&`, `||`, `!` |
| `assignment-operator` | `=`, `+=`, `-=`, `*=`, `/=`, `%=` |
| `operator-distractor` | Profile supplied nonoperator tokens |
| `literal` | `7`, `3.14`, `'A'`, `true` |
| `separator` | `;`, `,`, `(`, `)` |

Only configured categories appear in an activity. The app does not add an
identifier, operator, literal, or separator bucket automatically.

Profiles can provide category vocabularies through `generator.tokenPools`:

```js
tokenPools: {
  'arithmetic-operator': ['+', '-', '*', '/', '%'],
  'operator-distractor': ['value', '42', ';'],
}
```

A pool can also use `{default: [...], c: [...], java: [...]}` when its tokens
differ by language. Generated items retain their C or Java language snapshot.

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

## Configure tokens per item

Each mode policy requires a `totalTokens` rule and a count rule for every
bucket category. The item total can be fixed while category counts vary:

```js
practice: {
  totalTokens: { target: 12 },
  counts: {
    'valid-identifier': { min: 3, max: 5 },
    'invalid-identifier': { min: 3, max: 5 },
    'reserved-word': { min: 3, max: 5 },
  },
}
```

- `totalTokens: { target: 12 }` generates exactly 12 tokens per item while the
  category mix varies within its limits. This is the current Practice setting:
  the three category counts can differ, but every item has 12 tokens.
- `totalTokens: { min: 9, max: 15, target: 12 }` is also accepted if you want
  to document explicit bounds around a fixed target. The target must lie
  within those bounds.
- `totalTokens: { min: 9, max: 15 }` uses the session seed to choose one target
  in that inclusive range for each item. Use this only when the total itself
  should vary between items. The chosen target is stored on the item.
- `totalTokens: { exact: 12 }` is also accepted as a fixed-total rule.
- A positive integer is also accepted in place of `{ exact: ... }` for either
  the item target or a category limit.
- `{ exact: 5 }` or the integer `5` fixes a category's count.
- `{ min: 3, max: 5 }` allows a category count between three and five; the
  generator allocates counts so they sum to the chosen item target.
- `shuffle: true` mixes the generated categories into a seeded order.
- `shuffle: false` preserves bucket/category generation order.

The sum of category minimums and maximums defines the feasible total. A fixed
`target` must be feasible; when total min/max bounds are also present, it must
lie within them. Without `target`, every value in the total's min/max range
must be feasible.
For example, three categories bounded 3–5 permit item targets from 9 through
15. Each item receives one definite total at generation;
`generatedTokenTarget` and `generatedCounts` record the result.

The generator reads the policy named for the current shell mode. Practice items
use the shell's fresh session seed. Exam items capture their chosen target,
generated token sequence, language, and mode inside the saved examination
state, so resuming an exam restores the original items together with student
progress.

## Configure visible tokens

```js
dropArea: { visibleTokens: 3, landingBehavior: 'stack' }
```

`visibleTokens` is a positive integer. Students drag any arrived token directly
into a bucket, including while it falls. After a placement, the next unplaced
token enters the visible area; tokens can be sorted in any order within that
area. Keyboard users select a token and then choose a bucket. A single visible
token also supports direct bucket selection. Selection is included in saved
Exam progress, while scoring applies only to each token's bucket attempts.

Newly visible tokens enter one at a time from varied horizontal positions,
fall slowly, and bounce at the bottom. Tokens whose landing positions overlap
stack. A token is selectable and sortable while falling; its seeded text stays
on one line at its natural width. Sorting does not wait for landing. Selecting
an already visible token does not replay its fall. After Try again, the sequence
starts over. Animation Off and reduced motion show all visible tokens at rest.
Other tokens keep arriving while one is held. A drop anywhere outside a bucket
or a rejected Practice placement continues falling from the release point.
Sorting one token preserves the positions and fall progress of the others.
Left and right bucket regions fill the stage height; top and bottom regions
divide its width among their buckets.

`landingBehavior` accepts `stack` or `pass-through`. With `stack`, tokens bounce
and remain where they land. With `pass-through`, a token exits below the drop
area and reappears above it at a new horizontal position for another fall;
this repeats until the token is sorted. Tokens remain draggable during every
pass. If the field is omitted, the plugin uses `stack` for compatibility with
existing profiles. Animation Off and reduced motion show tokens at rest in
either mode.

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
  exam: 'deferred-until-timeout',
}
```

Supported values are:

- Practice: `immediate-return` or `deferred`.
- Exam: `deferred-until-timeout` or `never`.

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
- Each policy has a `totalTokens` rule. Its fixed target, or its full random
  range when no target is given, must fit within the category limits.
- Fixed counts are positive; ranged counts have `min <= max`.
- `dropArea.visibleTokens` is a positive integer.
- `dropArea.landingBehavior`, when present, is `stack` or `pass-through`.
- Response, assessment, and feedback values use the supported capability names.
- No profile configuration was added inside the plugin directory.

Run the compatibility suite after editing:

```bash
node tests/run-tests.js
```

The plugin will reject an invalid profile during registration with a message
that identifies the profile and unsupported field.
