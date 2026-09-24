# How to Create a Profile

A profile is one JavaScript object added to the `PROFILES_RAW` array in
`js/profiles.js`. This file holds *only* profile data, with zero generation
logic in it. Expression generation lives in `js/generator.js`; activity-specific
generation lives in its matching `plugins/<plugin-id>/` directory. You never
need to add profile configuration inside a plugin directory.

After adding a profile, put its `meta.id` in exactly one category's
`profileIds` array in `PROFILE_CATEGORIES`, also in `js/profiles.js`.
Categories determine the expandable sidebar groups and the scope of each
category's score summary and QR code. To create a new category, add an object
with a stable `id`, visible `name`, `enabled` switch, and `profileIds` array. A
profile without a category, or listed in two categories, fails validation at
load time.

## Show or hide profiles and categories

Every profile and category has an `enabled` boolean in `js/profiles.js`:

```js
{
  enabled: false, // hides only this profile
  meta: { id: 'division-practice', name: 'Division Practice', description: '...' },
  // ...
}

{
  id: 'expressions',
  name: 'Expressions',
  enabled: false, // hides this category and every profile assigned to it
  profileIds: ['division-practice'],
}
```

Set the value to `false` to remove that content from the student session. A
hidden profile is omitted from the sidebar, item generation, saved session
scope, category score, overall score, score breakdown, and QR total. Hiding a
category does the same for all of its profiles. Re-enabling a profile does not
make it visible while its category remains disabled.

Omitting `enabled` is supported and defaults to `true`, but keeping it explicit
makes deployment configuration easier to audit. Configuration changes apply to
new sessions. When a saved session is resumed, hidden profiles are discarded
from the restored session and no longer contribute points.

This guide covers expression and statement-sequence profiles. Activity profiles
use the same global catalog and the same `meta` and `scoring` conventions, but
replace expression fields with an `activity` block:

```js
{
  enabled: true,
  meta: { id, name, description },
  scoring: { itemCount, pointsPerItem },
  activity: { kind: 'plugin-id', ...pluginConfiguration },
}
```

For the complete activity-profile example, see
`docs/how-to-create-a-falling-token-sort-profile.md`.

The remainder of this guide builds an expression profile from
the simplest possible version
up to full atomic control, with a working example at every step. Each
level only adds ONE new idea on top of the last — skip ahead if you
already know the basics.

Every profile has six core parts and two optional capability blocks:

```js
{
  enabled:   true,                                // deployment visibility
  meta:      { id, name, description },        // display text
  shape:     { operandSources, operandRange, allowNegativeOperands },
  operators: { allowed, exclude, constraints }, // which operators, and rules on picking them
  extras:    { unaryWrap },                     // ++/--/! behavior (optional, omit if unused)
  scoring:   { itemCount, pointsPerItem },       // how many items, how much each is worth
  template:  '...',                              // the shape of the generated expression
  program:   { ... },                            // sequential statements (optional)
  manualResponses: { ... },                      // student-derived values (optional)
}
```

`template` is the part that actually determines what the student sees.
Everything else configures what fills it in.

---

## Level 1 — The simplest possible profile

Every new profile starts from this shape. Nothing here is optional —
these are the minimum fields a profile needs to generate anything.

```js
{
  enabled: true,
  meta: {
    id: 'division-practice',
    name: 'Division Practice',
    description: 'Straightforward left-to-right division and subtraction.',
  },
  shape: {
    operandSources: { literal: 4 },
    operandRange: { min: 1, max: 20 },
    allowNegativeOperands: false,
  },
  operators: {
    allowed: ['-', '/'],
  },
  template: 'operand op operand op operand op operand',
  scoring: { itemCount: 5, pointsPerItem: 1 },
}
```

Walking through it:

- **`meta.id`** must be unique — used everywhere else (sidebar, saved
  progress, scoring) to refer to this profile. Lowercase, hyphenated, no
  spaces.
- **`shape.operandSources: { literal: 4 }`** — 4 plain number operands,
  no variables or constants. The count here must always match how many
  *unpinned* operand slots the template has (more on "pinned" in Level 6)
  — 4 in this case.
- **`operators.allowed`** — a plain array of operator symbols. No named
  constant needed; see Level 7 for when a name is worth introducing.
- **`template`** — 4 operand slots joined by 3 operator slots. `op` means
  "pick freely from whatever `operators.allowed` contains" — no
  precedence steering at all. This is the right default any time the
  lesson isn't specifically about controlling operator order.
- **`scoring.itemCount`** — how many generated items this profile
  produces per session. **`pointsPerItem`** — the point value each item
  is worth (explicit here; Level 8 covers letting this be computed
  instead).

That's the whole profile. Add it to `PROFILES_RAW` in `profiles.js` and
it works —
`validateProfiles()` runs automatically at load and will throw a clear
error if anything doesn't line up (see the checklist at the end).

---

## Level 2 — Mixing operand kinds

Real lessons often want variables and constants, not just plain numbers.
Change `operandSources` to a mix, and the pool is drawn randomly from it
in whatever proportion you specify:

```js
shape: {
  operandSources: { literal: 2, variable: 1, constant: 1 },
  operandRange: { min: 1, max: 20 },
  allowNegativeOperands: false,
},
```

The total (`2+1+1 = 4`) must still match the template's operand-slot
count. Nothing about the template changes — `operand` slots don't care
what kind fills them; the kind is decided per-slot at generation time
from this pool, shuffled fresh for every item.

`allowNegativeOperands: true` lets literal operands occasionally roll
negative (about 30% of the time) — only affects `literal`-kind operands,
never variables or constants.

---

## Level 3 — Deliberately controlling precedence

`op` (used so far) draws freely from `allowed` with no steering — fine
when you don't care which specific operator ends up where. When the
*lesson itself* is about precedence (a higher-tier operator must resolve
before a lower one, regardless of position), name the tier explicitly:

```js
operators: {
  allowed: ['+', '-', '*'],
  constraints: { requireMultipleTiers: true },
},
template: 'operand op operand op operand',
```

`requireMultipleTiers: true` rejects any generated instance that
accidentally used only one precedence tier (e.g. `3 + 5 - 2`, no
multiplication at all) — the generator silently retries until it gets a
genuine precedence-mixing example instead. Use this constraint whenever
`allowed` spans more than one tier and the lesson depends on that mix
actually showing up.

The six tier keywords, each filtering `allowed` down to one specific
precedence level:

| Keyword | Matches | Precedence |
|---|---|---|
| `op` | everything in `allowed` | (no filtering) |
| `low` | `+` `-` | 5 |
| `high` | `*` `/` `%` | 6 |
| `cmp` | `<` `>` `<=` `>=` | 4 |
| `eq` | `==` `!=` | 3 |
| `and` | `&&` | 2 |
| `or` | `\|\|` | 1 |

**Rule:** only use a specific tier keyword (`low`/`high`/etc.) when it
narrows `allowed` to a strict subset. If `allowed` is already single-tier
(e.g. `['+', '-']`), writing `low` there filters nothing — use `op`
instead. `validateProfiles()` warns if you use a tier keyword that isn't
actually narrowing anything, so this mistake won't go unnoticed.

---

## Level 4 — Forcing required parentheses

This is the first place templates do something a flat operator list
can't. **A flat run of tier tokens (no explicit grouping) can never
produce required parentheses** — precedence-climbing always builds the
one tree that already prints correctly without them, no matter what
operators or order it picks. To make a lesson specifically about
grouping overriding precedence, you need explicit `(` `)` in the
template:

```js
{
  meta: { id: 'basic-override', name: 'Basic Override',
    description: 'Explicit grouping overrides normal precedence.' },
  shape: { operandSources: { literal: 3 }, operandRange: { min: 1, max: 15 }, allowNegativeOperands: false },
  operators: { allowed: ['+', '-', '*'] },
  template: '(operand low operand) high operand',
  scoring: { itemCount: 5, pointsPerItem: 2 },
}
```

What happens: `(operand low operand)` is built *first*, as its own
complete piece — say `2 + 5` — then handed to the outer level as one
opaque unit, wrapped by `high`: `(2 + 5) * 3`. Because `+` (precedence 5)
sits where `*` (precedence 6) would normally expect something at least
as tight-binding, the parens are structurally *required* — not
decorative — and this happens on **every single generated instance**,
deterministically, because it's a mathematical fact about the two
operators' precedence, not a coin flip.

Nesting works the same way, recursively — a group can contain another
group:

```js
template: '(operand low (operand high operand)) high operand'
```

builds the inner `(operand high operand)` first, embeds it inside the
outer low-then-high group, then wraps the whole thing again.

**Checking your work:** always verify a parens-forcing template actually
produces parens before shipping it — it's easy to get the nesting
direction backwards and accidentally build something that never needs
grouping (see Level 6's worked example, where this exact mistake is
caught and fixed).

---

## Level 5 — Unary operators (`++`, `--`, `!`)

Unary wrap is configured in `extras`, and only applies to slots the
template explicitly tags `:unary`:

```js
extras: {
  unaryWrap: { enabled: true, operators: ['++', '--'], forms: ['prefix', 'postfix'], fraction: 0.6 },
},
template: 'operand:unary op operand:unary op operand:unary',
```

- **`fraction`** — the probability *each* `:unary`-tagged variable slot
  independently gets wrapped. `1.0` means always; `0.6` means roughly
  60% of the time, so some items have every variable wrapped and others
  don't.
- **`:unary` is load-bearing** — only tagged operand slots are ever
  eligible, even if they resolve to a `variable` kind. An untagged
  `operand` slot that happens to land on a variable is never wrapped,
  regardless of `fraction`. Tag every slot you want eligible; leave
  untagged the ones you never want wrapped.
- `!` is different from `++`/`--`: it's the *only* unary operator that
  can wrap a **boolean** variable (see Level 6), and its `forms` is
  always just `['prefix']` — there's no postfix `!`.

---

## Level 6 — Pinned operands, booleans, and comparisons

Everything so far used *unpinned* `operand` slots — kind decided
randomly from the pool. Sometimes a lesson needs a **specific** slot to
be a specific kind, not left to chance. Pin it with `:lit`, `:var`, or
`:const`:

```js
template: '(operand:lit cmp operand:lit) and operand:var:bool or operand:var:bool'
```

- `operand:lit` — this exact slot is always a literal, generated
  directly — **not** counted in `shape.operandSources`, since it never
  draws from the free pool.
- `operand:var:bool` — always a variable, and always boolean-valued
  (`true`/`false`), not numeric.
- `shape.operandSources` only needs to size the *remaining* unpinned
  slots. If every slot in a template is pinned, `operandSources` can be
  omitted entirely.

**Comparisons need care**, because `<`/`>`/`<=`/`>=` only accept numeric
operands, while `==`/`!=` accept *either* two numerics or two booleans —
mixing types is a genuine Java/C compile error the generator actively
prevents (`inferType`, a generation-time safety check — see the checklist).
`constraints.maxComparisons` caps how many comparison-tier operators
(`cmp` *and* `eq` combined) may appear in one item — start at `1` unless
you specifically need more, and if you do, `maxComparisons: 2`+ is safe
precisely because `inferType` rejects anything that wouldn't actually
compile.

### Full worked example: building a comparison-and-boolean profile from scratch

Say the goal is: one comparison, combined with a boolean variable via
`&&`/`||`, where the comparison result gets grouped with one connective
before the other — a genuine required-parens teaching moment.

**First attempt** — looks reasonable, but doesn't actually do what it
promises:

```js
template: '(operand:lit cmp operand:lit) and operand:var:bool or operand:var:bool'
```

Trace it: this template has **no nested grouping** — it's one flat chain
(the outer parens just wrap the comparison alone, which was already
going to bind tightest anyway). Precedence-climbing this produces
`(cmp && var0) || var1` — and because `&&` naturally outranks `||`,
**this never needs parens at all**. The explicit `(` here was decorative,
not structural. This is the single most common mistake when writing a
parens-forcing template: adding parens somewhere that precedence would
already have put there for free changes nothing.

**Fix** — force the *lower*-precedence operator (`or`) to sit where the
*higher*-precedence one (`and`) would normally be expected, by grouping
the comparison together with `or`, not `and`:

```js
template: '(operand:lit cmp operand:lit or operand:var:bool) and operand:var:bool'
```

Now the group `(cmp || var0)` is built first as its own subtree, then
wrapped by `and`. Since `||` (precedence 1) is lower than what `&&`'s
left-hand context requires (precedence 2), the parens are now
structurally required — every time. Verify it actually works before
trusting it (see the checklist below) — don't just eyeball the template
string, run it.

Full profile:

```js
{
  meta: { id: 'compare-and-boolean', name: 'Compare + Boolean',
    description: 'A comparison combined with a boolean via && / ||, requiring explicit grouping.' },
  shape: { operandRange: { min: 1, max: 20 }, allowNegativeOperands: false },
  operators: { allowed: ['<', '>', '<=', '>=', '==', '!=', '&&', '||'] },
  template: '(operand:lit cmp operand:lit or operand:var:bool) and operand:var:bool',
  scoring: { itemCount: 5, pointsPerItem: 3 },
}
```

---

## Level 7 — Full atomic control over operators

`operators.allowed` accepts three forms, cheapest to most bespoke:

**1. A named constant**, for a standard, recognizable, reusable group:

```js
operators: { allowed: OPS.ARITH_ALL }   // + - * /
```

**2. A plain literal array**, for a one-off combination that doesn't
deserve a name:

```js
operators: { allowed: ['*', '%'] }
```

**3. Spread composition**, to reuse a common group plus one exception:

```js
operators: { allowed: [...OPS.ARITH_ALL, '%'] }   // + - * / %
```

**4. `exclude`**, to start broad and carve one operator back out:

```js
operators: { allowed: OPS.ARITH_ALL, exclude: ['/'] }   // + - *
```

**When to name a constant vs. inline it:** only add to `OPS` if the group
is either (a) a real, recognizable domain concept a teacher would know by
name (e.g. "comparison operators"), or (b) reused verbatim by 2+
profiles. A one-off combination invented for a single profile should be a
literal array or spread — inventing a name for it just adds an
indirection the next reader has to go look up.

`ENGINE_OPERATORS` (in `generator.js`) is the full list of operators the
engine actually recognizes — anything in `allowed` outside that set is
rejected at load time with a clear error, not a mysterious failure deep
in generation.

---

## Level 8 — Scoring: explicit or derived

`scoring.pointsPerItem` can be left out entirely, in which case it's
computed from the profile's own complexity (operator count, parens
usage, unary usage, how many distinct operand kinds are involved):

```js
scoring: { itemCount: 5 }   // pointsPerItem auto-derived
```

Specify it explicitly any time you want a specific value regardless of
what the formula would produce:

```js
scoring: { itemCount: 5, pointsPerItem: 3 }   // always exactly 3, no matter what
```

---

## Level 9 — Interactive declaration and assignment chains

Profiles remain single-expression activities unless they explicitly opt into
interactive declarations:

```js
program: {
  declarations: 'interactive',
  dependencyMode: 'previous',
  scoreAssignments: true,
}
```

The generated variable and constant operands become executable declarations.
The first receives its seeded value directly. Each later declaration uses the
previous declaration in its initializer while preserving its own seeded value.
Only after the declarations are committed does the existing final-expression
activity unlock.

For a clear declaration-chain lesson, use named operands in
`shape.operandSources`:

```js
shape: {
  operandSources: { variable: 3, constant: 1 },
  operandRange: { min: 2, max: 15 },
  allowNegativeOperands: false,
}
```

Profiles that omit `program`, including the original profiles, keep their
declarations preinitialized and retain the previous scoring behavior.

To select one of the built-in progressive assignment generators, add
`assignmentLesson` while retaining interactive declarations:

```js
program: {
  declarations: 'interactive',
  assignmentLesson: 'add-sub',
  scoreAssignments: true,
}
```

Available lesson keys are `basic-set`, `add-sub`, `multiply`,
`divide-remainder`, `rhs-expression`, `sequential`, `dependent`, and
`advanced`. These generate ordinary `assignment` IR statements; evaluation,
rendering, memory animation, undo, scoring, and persistence are supplied by
the registered capabilities rather than duplicated in the profile.

Only select a lesson key that already exists in `program-item-builder.js`.
Adding a new key is not a data-only profile change: it requires a new Program
IR builder or statement plugin behavior and corresponding tests.

### Standalone `++` and `--` statements

To place unary updates between declarations and the final expression, use:

```js
program: {
  declarations: 'interactive',
  unaryUpdateLesson: 'standalone-sequence',
  scoreAssignments: true,
}
```

This produces statements such as `x++;`, `--y;`, and `++x;`. Their memory
writes, value cards, connectors, animation, undo, and scoring reuse the same
unary semantics used by legacy expressions.

### Mixed assignment and unary chains

The built-in advanced mixed lesson is selected with:

```js
program: {
  declarations: 'interactive',
  mixedUpdateLesson: 'advanced-assignment-unary',
  scoreAssignments: true,
}
```

It combines declarations, compound assignments, standalone unary updates,
and a final expression that reads the resulting memory. Choose exactly one of
`assignmentLesson`, `unaryUpdateLesson`, or `mixedUpdateLesson` in a profile.
These options describe alternative statement-sequence builders, not features
that should be stacked in one object.

### C and Java output statements

Program Output supports source-file and generated content. Source-file mode is
recommended when a teacher should be able to change the exact program without
recreating JavaScript data:

```js
{
  meta:{id:'program-output-basics',name:'Output Statements',description:'...'},
  shape:{operandSources:{variable:3},operandRange:{min:2,max:12},allowNegativeOperands:false},
  operators:{allowed:OPS.ADD_SUB},
  template:'operand op operand op operand',
  scoring:{itemCount:'manifest',pointsPerItem:2},
  content:{
    provider:'program-output',
    mode:'source-files',
    recipe:'formatted-values',
    exerciseSet:'formatted-output',
    selection:{count:'all',shuffle:false},
  },
  program:{
    declarations:'interactive',
    outputLesson:'formatted-values',
    scoreAssignments:true,
  },
}
```

The plugin loads the matching
`plugins/program-output/exercises/<language>/<exerciseSet>/manifest.json` and
parses only the source files listed there. Set `content.mode:'generated'` to use
the seeded `shape`/`template` path instead. Both modes produce the same Program
IR and use the established Check, feedback, scoring, persistence, and
correct-solution flow.

Use Code Simulator for a stable complete-source view:

```js
content:{
  provider:'code-simulator',
  mode:'source-files',
  sourceLibrary:'program-output',
  exerciseSet:'formatted-output',
  sourceValueMode:'authored',
  presentation:'source-flow',
  selection:{count:'all',shuffle:false},
}
```

This is the current `program-output-source-flow` configuration. It reads the
same Program Output exercise files while Code Simulator owns complete-program
parsing and flow.

`outputLesson` names a builder in `program-item-builder.js`; adding another
lesson key requires a builder and tests. Output source syntax and interaction
semantics remain in `plugins/program-output/`, not in the profile.

See `docs/how-to-create-a-program-output-profile.md` for the source directory,
manifest, metadata, supported syntax, selection, and language rules.

`scoreAssignments: true` includes declaration/assignment commit checks in the
item's existing point budget. Setting it to `false` leaves those writes
instructional but does not award assignment-check credit.

### Code Simulator source programs

A Code Simulator profile selects a language-specific exercise directory and
chooses whether embedded declaration ranges are applied:

See `docs/how-to-create-a-code-simulator-profile.md` for the complete two-step
file/manifest workflow, supported statements, and metadata rules.

```js
content:{
  provider:'code-simulator',
  mode:'source-files',
  sourceLibrary:'code-simulator',
  exerciseSet:'selection-basics',
  sourceValueMode:'seeded', // or 'authored'
  presentation:'source-flow',
  selection:{count:'all',shuffle:false},
}
```

Each manifest-listed source file is parsed independently. It may contain any
combination of supported declarations, assignments, standalone `++`/`--`,
output statements, selections, and C `return 0;`. No individual statement kind
is mandatory. Unsupported lines remain visible as muted context. A file is
rejected only when it contains no supported executable statement or has invalid
manifest/seed metadata or invalid references inside recognized statements.

For a source-backed profile whose entire manifest is the activity, use
`selection.count:'all'` with `scoring.itemCount:'manifest'`. The manifest then
owns both membership and the score maximum; adding or removing a manifest entry
does not require a matching profile edit. Use numeric values only when the
profile intentionally selects a fixed subset.

For a complete source program, keep the source rows stable and open the active
statement's evaluation in the shared trace modal:

```js
program:{
  declarations:'interactive',
  scoreAssignments:true,
  timelinePresentation:'statement-modal',
}
```

Omit `timelinePresentation`, or set it to `'inline'`, to retain the established
inline timeline used by other profiles. This option changes presentation only;
the same statement renderer, actions, scoring, Undo, persistence, memory, and
Program Output behavior are reused.

In the source panel, the active statement plugin determines the click behavior.
A play icon marks a statement with one immediately available action, such as a
literal declaration or literal-only output command; clicking the line executes
it without opening a modal. An expand icon marks a multistep statement. Its
registered renderer opens in the trace modal. Selection modals show the
condition expression alone while the complete control statement remains visible
in the source file.

The source file, rather than the profile, owns each allowed range:

```text
@seed score min=60 max=100
@seed absences min=0 max=10
```

Only listed literal integer declarations are randomized. Variables and
constants absent from `@seed` keep their authored values. Derived initializers
keep their expressions and recalculate from any seeded dependencies.

---

## Level 10 — Student-derived values

Profiles can request manual answers for a seeded percentage of named-value
reads and operator results:

```js
manualResponses: {
  enabled: true,
  namedValueRate: 50,
  operatorRate: 50,
}
```

- `namedValueRate` controls variable/constant reads, including the current
  target read required by compound assignments.
- `operatorRate` controls binary/unary results and eligible declaration or
  assignment commits.
- Rates are integers from `0` to `100`.
- Selection uses the session's seeded random generator and an exact quota
  across all generated items in this profile. For example, a 50% rate chooses
  half of the eligible actions across the five-item profile, rounded to the
  nearest whole action. It is not an independent coin flip on every click.
- Numeric prompts accept signed integers. Boolean prompts present explicit
  `TRUE` and `FALSE` choices.
- A valid but incorrect manual answer is allowed to continue. It changes the
  expression result, but a variable read does not overwrite program memory.
  A later declaration, assignment, or unary write does update memory with the
  student-derived value.
- Manual correctness adds scored checks inside the same
  `scoring.pointsPerItem` budget; it does not increase the profile's maximum
  points.

This block supplies the profile default only. The login settings can use the
profile value, force automatic derivation, or replace it with application-wide
custom rates. See `how-to-use-app-settings.md`.

Profiles that omit `manualResponses` remain automatic when the application is
configured to use profile settings.

---

## Level 11 — Complete modern examples

### Sequential assignment and unary activity

```js
{
  meta: {
    id: 'assignment-unary-review',
    name: 'Assignment + Unary Review',
    description: 'Apply memory-changing statements before solving the final expression.',
  },
  shape: {
    operandSources: { variable: 3, constant: 1 },
    operandRange: { min: 3, max: 12 },
    allowNegativeOperands: false,
  },
  operators: {
    allowed: ['+', '-', '*'],
    constraints: { requireMultipleTiers: true },
  },
  template: 'operand op operand op operand op operand',
  scoring: { itemCount: 5, pointsPerItem: 7 },
  manualResponses: { enabled: true, namedValueRate: 50, operatorRate: 50 },
  program: {
    declarations: 'interactive',
    mixedUpdateLesson: 'advanced-assignment-unary',
    scoreAssignments: true,
  },
}
```

### Single relational/logical expression

```js
{
  meta: {
    id: 'logical-self-check',
    name: 'Logical Self-Check',
    description: 'Derive selected comparison and logical results manually.',
  },
  shape: { operandRange: { min: 1, max: 20 }, allowNegativeOperands: false },
  operators: { allowed: [...OPS.COMPARISON, ...OPS.LOGICAL] },
  extras: {
    unaryWrap: { enabled: true, operators: ['!'], forms: ['prefix'], fraction: 0.5 },
  },
  template: '(operand:lit cmp operand:lit) and operand:var:bool:unary or operand:var:bool:unary',
  scoring: { itemCount: 5, pointsPerItem: 4 },
  manualResponses: { enabled: true, namedValueRate: 50, operatorRate: 50 },
}
```

---

## Activity-plugin profiles

Activity plugins use the same global profile registration system but own their
domain capabilities. The profile composes those capabilities declaratively;
the shell and plugin must never branch on a profile ID.

The `token-classification` reference plugin separates five concerns:

- `generator` chooses a registered content generator and pattern.
- `sets` builds named token sets with reusable include/exclude selectors.
- `interaction.policies` independently controls clickability and off-target
  consequences for each Practice/Exam interaction mode.
- `assessment.checks` declares actions, answer resolvers, weights, and bonuses.
- `response.categories` declares the choices presented by the modal.

Identifier-based generators may also declare `generator.identifierGeneration`
to select semantic templates, naming styles, invalid-mutation strategies, and
the uniqueness scope. Generated text is always reclassified by the canonical
language analyzer; profile configuration never supplies an answer key. See
`docs/identifier-generation.md` for the complete contract.

Selectors may match `positions`, `roles`, `statementKinds`, or contextual
`categories`. A selection policy may include a named set and then exclude any
other selector:

```js
sets: {
  everyToken: { include: [{ source: 'all' }] },
  names: { match: { positions: ['declaration-name'] } }
},
interaction: {
  policies: {
    'practice:guided': {
      selectable: { include: [{ set: 'names' }], exclude: [] },
      onOffTarget: 'ignore'
    },
    'practice:strict-sequence': {
      selectable: {
        include: [{ set: 'everyToken' }],
        exclude: [{ match: { positions: ['separator'] } }]
      },
      onOffTarget: 'block-until-undo'
    }
  }
}
```

Available off-target outcomes are `ignore`, `warn`, `block-until-undo`, and
`terminate-item`. Profiles select them; Guided and Strict do not imply any
fixed behavior by themselves.

Canonical answer keys are not written into profiles. A check refers to a
plugin resolver such as `contextual-category`. This resolver evaluates both
the token and its syntax position, so a Java keyword such as `class` in a
declaration-name position is an `invalid-identifier`, while `char` in the type
position is a `reserved-word`.

```js
assessment: {
  targets: { set: 'names' },
  checks: [
    {
      id: 'target-selection',
      action: 'SELECT_TOKEN',
      targets: { set: 'names' },
      cardinality: 'once',
      weight: 1,
      bonus: true
    },
    {
      id: 'classification',
      action: 'CLASSIFY_TOKEN',
      targets: { set: 'names' },
      cardinality: 'per-target',
      answerResolver: 'contextual-category',
      weight: 2
    }
  ]
}
```

See the three `activity.kind: 'token-classification'` entries in
`js/profiles.js` for complete configurations.

## Checklist before shipping a new profile

1. **Does `shape.operandSources` sum to exactly the template's unpinned
   (free) operand-slot count?** `validateProfiles()` checks this
   automatically at load — if it's wrong, you'll get an error naming the
   profile and the exact mismatch, not a silent bug.
2. **Does every tier keyword you used actually narrow `allowed`?** A
   warning (not an error) prints if a tier keyword resolves to the same
   set `allowed` already was.
3. **If the profile needs required parens, does it actually produce
   them?** Generate a handful of instances and check by eye — or better,
   automate it:

   ```js
   initializeSeededRandom(1);
   for (let i = 0; i < 20; i++) {
     const inst = generateInstance(myProfile);
     console.log(renderString(inst.tree));
   }
   resetRandomGenerator();
   ```

   If none of the samples show parens but you expected them, the
   template's grouping is in the wrong place — see Level 6's worked
   example for the most common way this goes wrong.
4. **If mixing `cmp`/`eq` operators, is `maxComparisons` set high enough
   for what the template actually needs?** Count total comparison-tier
   operators in the template (not just how many *kinds* of comparison
   keyword appear) — `(cmp) eq (cmp)` is 3 operators total (2 relational
   + 1 equality), not 2.
5. **Every operator in `allowed` recognized?** Checked automatically —
   a typo like `'=+'` fails immediately at load, not 300 retries deep in
   generation.
6. **Did you choose only one program lesson selector?** Use one of
   `assignmentLesson`, `unaryUpdateLesson`, or `mixedUpdateLesson`.
7. **Do manual-response rates match the learning goal?** Verify the exact
   seeded quota across the complete item set, not just one sample item.
8. **Did you run the compatibility tests?** From the project directory:

   ```bash
   node tests/run-tests.js
   ```

   A profile is ready only when validation, generation, canonical playback,
   scoring, and legacy compatibility still pass.
