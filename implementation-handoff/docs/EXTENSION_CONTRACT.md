# Extension Contract

## Profiles are global and declarative

Every profile belongs in `PROFILES_RAW` in `js/profiles.js`, including profiles
executed by an activity plugin. The file is configuration, not activity logic.

A profile may declare:

- generation capabilities and policies;
- named token/statement sets;
- Guided and Strict selectable include/exclude selectors;
- off-target outcomes by mode;
- offered response categories;
- assessment actions, cardinality, weights, and bonus status;
- bucket category, region, order, and per-mode counts;
- feedback and retry policy.

A profile must not contain trusted canonical answers for generated content.

## Activity plugins

New activity plugins live in `plugins/<plugin-id>/` and own all plugin-specific
assets. A typical directory contains:

```text
plugins/<plugin-id>/
  manifest.js
  generator.js
  actions.js
  renderer.js
  feedback.js
  styles.css
  plugin.js
  languages/        # only when domain rules are language-specific
```

Do not create a `profiles/` directory inside a plugin. Do not put plugin styles
in `css/styles.css` or plugin behavior in general shell JavaScript.

The plugin registers lifecycle functions through `registerActivityPlugin()`.
The shell activates global profiles whose `activity.kind` matches the plugin
ID and asks the plugin to validate them.

## Agnostic responsibility boundary

| Component | Knows |
|---|---|
| Shell | Session, mode, navigation, persistence, drawers, shared modal, total scoring, design tokens. |
| Profile | Which capabilities, targets, categories, counts, policies, and checks compose this lesson. |
| Plugin | Canonical domain vocabulary, semantic actions, validation, generation contracts, checking, and solution trace. |
| Renderer | How current semantic state is displayed and which semantic action a user requests. |
| Generated item | Language snapshot, source data, required targets, canonical analysis, responses, and persisted progress. |

No layer may infer lesson purpose from a profile ID when the same decision can be
expressed as configuration.

## Identifier pipeline

Identifier work deliberately uses three independent stages:

```text
identifier generator → language/context analyzer → activity feedback
```

- The generator proposes text using language-supported templates, styles,
  invalid strategies, weights, length limits, and uniqueness policy.
- The analyzer independently derives lexical category, contextual category,
  and structured violations from text, language, and syntax position.
- Feedback explains analyzer output. It never trusts the generator's intended
  category as the answer.

This separation permits generator improvements—new vocabulary, trickier forms,
or more varied permutations—without rewriting analysis or feedback.

Language-specific generation support and canonical rules live in:

- `plugins/token-classification/languages/c.js`
- `plugins/token-classification/languages/java.js`

`state.language` selects the language, and the generated item captures it.

## Semantic vocabulary and generation

Use compatible semantic roles rather than one undifferentiated word list:

- modifiers: `total`, `min`, `max`, `avg`, ...
- measurements: `count`, `price`, `score`, ...
- entities: `student`, `item`, `user`, ...
- technical nouns: `buffer`, `index`, `data`, ...

Profiles compose templates such as modifier–measurement or entity–technical and
styles such as camel case, snake case, constant case, Pascal case, underscore
prefix, and digit suffix. Language definitions decide which styles and
characters are supported.

See `docs/identifier-generation.md` for the precise configuration contract.

## Statement plugins

Program Core dispatches each statement by `statement.kind`. Current statement
plugins are legacy expression, declaration, assignment, and unary update. One
profile can generate a sequence that uses several statement kinds.

Do not add I/O, selection, or loop semantics to an existing statement plugin.
Add a separate semantic registration and renderer. Do not refactor current
statement-plugin locations without a separately approved migration plan.

## Public dependencies

Plugins may depend only on declared public capabilities. Falling Token Sort
depends on Token Classification's `identifier-generation` and
`identifier-analysis` capabilities. It does not copy C/Java keyword lists or
maintain a competing identifier validator.

## New extension checklist

1. Define the domain capability and canonical semantic actions.
2. Decide whether an existing plugin already owns that capability.
3. Add profile configuration to `js/profiles.js`.
4. Add plugin files only under `plugins/<plugin-id>/`.
5. Namespace CSS and preserve mobile behavior.
6. Register dependencies and lifecycle functions.
7. Add canonical-trace, persistence, Practice, Exam, and accessibility tests.
8. Add script/style tags in dependency order.
9. Run the complete suite and the manual checklist.

