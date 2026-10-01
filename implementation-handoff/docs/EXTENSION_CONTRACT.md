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
| Shell | Session, mode, navigation, persistence, drawers, shared modal, shared Program Terminal surface, total scoring, design tokens. |
| Profile | Which capabilities, targets, categories, counts, policies, and checks compose this lesson. |
| Language core | Supported program syntax, evaluation, effects, diagnostics, and semantic traces. |
| Plugin | Activity-domain rules plus learner interaction, checking, feedback, and presentation over canonical state. |
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
plugins are legacy expression, declaration, assignment, unary update, input,
output, selection, program break, and program return. One profile can generate a sequence that uses
several statement kinds.

Program Output lives in `plugins/program-output/` and renders the same
language-neutral output IR as C `printf` or Java
`System.out.print`/`System.out.println`. Profiles select a source-file exercise
set or a generated recipe; they do not embed source text, canonical answers, or
language-specific interaction logic.

The language core converts emitted text into canonical terminal state through
`coreTerminalScreen()` in `js/output-statement-core.js`. The shell-owned
`js/program-terminal.js` renders that state, positions the insertion cursor,
plays input/output events, and applies newline, carriage return, and backspace.
Output plugins may render statement controls and timelines and emit `OUTPUT`
events; they must not implement a private terminal buffer, cursor, or
control-character interpreter. This keeps direct, modal, Code Simulator,
Program Output, Program Input, and future compatible activities on the same
terminal behavior.

Simulate Output lives in `plugins/simulate-output/` and owns prediction input,
answer comparison, feedback, and response presentation. It loads a registered
exercise library through `activity.generator.library` and
`activity.generator.exerciseSet`. Its source files must not embed
`@output` or `@variables` answer blocks. The shared source pipeline parses
each manifest-listed program and generates expected terminal output and final
initialized mutable memory from language-core effects. Any core diagnostic must
reject the exercise; the plugin must not add fallback parsing or accept a
partial generated answer.

Program Input lives in `plugins/program-input/`. It hydrates the interaction
runtime from canonical Input IR and owns the keyboard/timeline presentation.
The language core parses and executes `scanf` and `Scanner.nextInt()`; Code
Simulator consumes that same IR and must not reimplement input grammar or
semantics. Exercise files define each
input with `@input target=<name> value=<integer> min=<integer> max=<integer>`;
profiles choose authored or seeded materialization with
`content.values.input`.

Code Simulator source files own exercise-specific value seeding. Their leading
`@codescope` block may explicitly allowlist literal integer declarations with
`@seed <name> min=<integer> max=<integer>`. The profile only selects authored or
seeded rendering through `content.values.variables`; it must not redefine the
per-binding ranges. Unlisted bindings remain authored. The content provider
must reject malformed ranges, duplicate or unknown names, and annotated
nonliteral initializers before an item enters a session.

Code Simulator lives in `plugins/code-simulator/`. It owns complete-source
interaction and presentation. The shell source pipeline owns loading,
materialization, and control-flow parsing, while adapters consume Program Core
semantics. The content adapter must accept any manifest-listed program that
contains at least one supported executable statement; it must not require a
declaration, selection, output, or return statement merely because an exercise
set previously focused on that lesson. It currently recognizes declarations,
assignments, standalone unary updates, input, output, selections, switch
`break;`, and C `return 0;`.
Unsupported source remains visible, muted context. Condition evaluation
delegates to the shared expression runtime, and output delegates to Program
Output.

A complete-source profile may select an approved exercise library through
`content.source.library`. Library owners register their logical ID, physical root, and
supported languages with the shared exercise-library registry. The canonical
`source-programs` library resolves beneath
`exercise-libraries/source-programs/` and contains the formatted-output,
selection-basics, and output-basics sets. It is independent of the plugins that
parse or present it. Providers must reject unknown library names and must not
copy exercise files into a plugin directory. Profiles use the canonical
`source-programs` ID.

The provider must derive supported statement order and control-flow edges from
the current fetched source. This includes sequential successors, branch entry
targets, clause exits, and the statement after the complete decision. Do not
encode an expected statement count, copied source text, or filename-specific
jump table in plugin JavaScript. `selection.count:'all'` pairs with
`scoring.itemCount:'manifest'` when a manifest owns the complete activity.

Complete-source profiles may set
`presentation.timeline:'statement-modal'`. This is a shell presentation
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

The shared `program-break` statement plugin represents an authored `break;`
inside a supported switch case. It supplies one direct `break-control` action,
emits `BREAK`, and follows the enclosing switch adapter's `nextStatementId` to
the first executable statement after that switch. The Code Simulator adapter
owns fall-through edges: when a case has no authored `break;`, its final
executable statement advances to the first executable statement in the next
case body.

External profile content is registered through the generic content-provider
API in `js/activity-core.js`. A provider owns configuration validation, content
loading, parsing, and item construction. It returns the same serializable item
contract as generated content, uses the seeded random source for selection,
and leaves restored Exam snapshots authoritative. The shell does not know a
provider's manifest layout or source grammar.

For source exercise banks, the manifest is the complete membership and order
authority. Do not restore generated catalogs or copied `raw` source attributes.
Files absent from a manifest remain inactive.

Add new program syntax and meaning to the appropriate shell language-core
service, then add or extend interaction and rendering separately. Never place
a second parser or evaluator in a presentation plugin.

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
9. Run `node tests/release-gate.js` and the applicable manual checklist.
