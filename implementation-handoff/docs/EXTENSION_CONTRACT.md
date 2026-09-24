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
- bucket category, region, order, per-mode item token targets, and category limits;
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
plugins are legacy expression, declaration, assignment, unary update, output,
selection, and program return. One profile can generate a sequence that uses
several statement kinds.

Program Output lives in `plugins/program-output/` and renders the same
language-neutral output IR as C `printf` or Java
`System.out.print`/`System.out.println`. Profiles select a source-file exercise
set or a generated recipe; they do not embed source text, canonical answers, or
language-specific interaction logic.

Code Simulator source files own exercise-specific value seeding. Their leading
`@codescope` block may explicitly allowlist literal integer declarations with
`@seed <name> min=<integer> max=<integer>`. The profile only selects authored or
seeded rendering through `content.sourceValueMode`; it must not redefine the
per-binding ranges. Unlisted bindings remain authored. The content provider
must reject malformed ranges, duplicate or unknown names, and annotated
nonliteral initializers before an item enters a session.

Code Simulator lives in `plugins/code-simulator/`. It owns complete-source
loading and control-flow parsing, while statement behavior stays in registered
Program Core plugins. The provider must accept any manifest-listed program that
contains at least one supported executable statement; it must not require a
declaration, selection, output, or return statement merely because an exercise
set previously focused on that lesson. It currently recognizes declarations,
assignments, standalone unary updates, output, selections, and C `return 0;`.
Unsupported source remains visible, muted context. Condition evaluation
delegates to the shared expression runtime, and output delegates to Program
Output.

A complete-source profile may select an approved exercise library through
`content.sourceLibrary`. The default `code-simulator` library resolves beneath
`plugins/code-simulator/exercises/`; `program-output` resolves beneath
`plugins/program-output/exercises/`. This permits Source Program Output to use
Code Simulator flow while retaining one live formatted-output manifest and
source bank. Providers must reject unknown library names and must not copy the
exercise files into a second plugin directory.

The provider must derive supported statement order and control-flow edges from
the current fetched source. This includes sequential successors, branch entry
targets, clause exits, and the statement after the complete decision. Do not
encode an expected statement count, copied source text, or filename-specific
jump table in plugin JavaScript. `selection.count:'all'` pairs with
`scoring.itemCount:'manifest'` when a manifest owns the complete activity.

Complete-source profiles may set
`program.timelinePresentation:'statement-modal'`. This is a shell presentation
choice: Program Core keeps the authored source stable and mounts the current
registered statement renderer inside the shared trace modal. Statement plugins
must not add modal-specific semantic paths or duplicate their renderer. The
default remains `'inline'`, preserving existing profiles.

A statement plugin may define `interactionPlan({item, program, statement})` for
the source-file presentation. Return `{mode:'direct', action}` only when the
source-line click is the statement's sole remaining action. Return
`{mode:'modal', focus}` for multistep work. The shell routes direct actions
through the normal semantic action handler and defaults plugins without this
hook to the modal. `focus:'condition-expression'` tells the selection renderer
to omit the already-visible control-statement wrapper from the close view.

The shared `program-return` statement plugin represents an authored exact C
`return 0;`. It supplies one direct `return-program` action and emits `RETURN`
with `nextStatementId:'$end'`. Content providers must not invent this statement
for Java or for source that does not author it.

External profile content is registered through the generic content-provider
API in `js/activity-core.js`. A provider owns configuration validation, content
loading, parsing, and item construction. It returns the same serializable item
contract as generated content, uses the seeded random source for selection,
and leaves restored Exam snapshots authoritative. The shell does not know a
provider's manifest layout or source grammar.

For source exercise banks, the manifest is the complete membership and order
authority. Do not restore generated catalogs or copied `raw` source attributes.
Files absent from a manifest remain inactive.

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
