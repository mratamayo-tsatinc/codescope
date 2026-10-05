# CodeScope Plugin Architecture

New activity plugins live in `plugins/<plugin-id>/`. The app-shell `js/` and
`css/` folders are reserved for orchestration, shared services, design tokens,
and reusable UI primitives. Plugin-specific behavior and presentation must not
be added to those folders.

## Required boundary

A plugin registers through the shell's `registerActivityPlugin()` contract and
the shell may call its public lifecycle functions, but it must not depend on
private plugin modules.

All profile configuration belongs in the global `PROFILES_RAW` catalog in
`js/profiles.js`, including profiles backed by an activity plugin. A global
activity profile remains dormant when its matching plugin is unavailable and is
activated and plugin-validated when that plugin registers. New plugins must not
embed profile configuration in their own directory. Plugins register only
their capabilities; the shell activates matching global profiles through each
profile's `activity.kind` value.

Each activity plugin owns its manifest, activity-domain generation and rules,
actions, scoring checks, solution trace, renderer, feedback, styles, and tests.
Program-language syntax and semantics remain in the shell language core so a
new construct propagates to every compatible activity. Plugin CSS must be
namespaced. The app-shell `js/` and
`css/` directories contain only shared orchestration and reusable services;
profile data in `js/profiles.js` is configuration, not plugin behavior.

Plugins may consume shell services such as session state, modal infrastructure,
drawers, persistence, Undo, Check, scoring aggregation, and design tokens. A
plugin must not import another plugin's private files. Future inter-plugin
dependencies must be declared against public capabilities.

### Shared Practice retry placement

Checked Practice items place **Try again** outside and directly below the
activity workspace, aligned to the workspace's left edge. This keeps retry as
a page-level action instead of making it look like part of the submitted
answer surface. Complete-source items place **Reset item** at that same item
level while work is in progress; statement modals never own whole-item reset.
For source-backed items, Try again rebuilds only the current manifest item with
a fresh seed, while Reset item preserves the already materialized source.

Renderers must append the shell-owned retry bar to their outer `container`:

```js
if (item.checked && state.mode === 'practice') {
  appendPracticeRetryBar(container);
}
```

The helper detects when a statement renderer received the inner workspace
`flow` and promotes the retry bar to the workspace's outer container. Do not
construct or append a retry button directly. The shared placement helper owns
the hierarchy, markup, accessibility attributes, spacing, and alignment so
legacy activities and plugins follow the same UI standard.

The token-classification plugin exposes the shared identifier-language
capability used by Falling Token Sort: seeded candidate construction, C/Java
language definitions, and canonical lexical/contextual analysis. Falling Token
Sort declares that dependency in its manifest and consumes the public analysis
contract; it does not maintain a second answer list.

## Reference implementation

`plugins/falling-token-sort/`, `plugins/token-classification/`,
`plugins/simulate-output/`, `plugins/program-output/`, and
`plugins/program-input/` are reference
directory boundaries for activity plugins. Their profiles are declared
globally in `js/profiles.js`; their plugin directories contain only the
behavior and presentation needed to execute those configurations.

Program Output is a statement interaction and presentation capability. It
consumes canonical Output IR and shell-produced effects, then renders the
read, format, and print workflow. Its content adapter can consume a
manifest-selected C or Java bank or seeded generated content. Both converge on
the same serializable Program IR through the shared source pipeline.

Program Output does not own the terminal emulator. Canonical text-to-screen
state, including newline, carriage return, backspace, overwrite behavior, and
cursor coordinates, lives in `js/output-statement-core.js`. The shared
`js/program-terminal.js` service owns the Program Terminal DOM, playback, and
cursor presentation. Plugins emit semantic input/output events and may render
their statement-specific interaction; they must not duplicate the terminal
buffer or special-case escape characters locally.

Program Input follows the same composition boundary. The core parses and
executes typed C `scanf` and Java Scanner reads. The plugin hydrates their interaction
runtime and owns the submitted-input workflow, keyboard indicator,
conversion visualization, destination-write interaction, and rendering. Code
Simulator receives those statements from the shared program parser and routes
their IR through Program Core. Input and Output share a
shell-owned Program Terminal surface, while their semantic event types remain separate. See
`docs/how-to-create-a-program-input-profile.md`.

`js/activity-core.js` owns the generic profile content-provider registry. The
shell asks registered providers to validate profiles, load external content,
and construct items. It does not know source formats or exercise-set layouts.
See `docs/how-to-create-a-program-output-profile.md` for the Program Output
provider contract.

`js/source-library-registry.js` owns logical exercise-library registration and
manifest URL resolution. The independent
`exercise-libraries/source-programs/library.js` registration owns its relative
root and supported languages. Source-backed adapters consume
`content.source.library` and `content.source.exerciseSet`; they must not
hardcode another plugin's directory. Current profiles use the canonical
`source-programs` ID and nested `content.source` fields.

Simulate Output owns answer entry, comparison, feedback, and response UI over
canonical program results. Its exercises live in the registered
`source-programs` library, use the same language and exercise-set directory
contract as other source-backed activities, and contain ordinary source code
without embedded answer metadata. The shared source pipeline parses each
manifest-listed file and generates expected terminal output and final mutable
memory from language-core effects. Any core diagnostic rejects the exercise so
an incomplete answer key is never accepted. The shell waits for plugin content
loading before it generates a session. Each set manifest is the only exercise
membership and ordering source; files absent from the manifest remain inactive.
See `docs/how-to-create-a-simulate-output-profile.md`.

Statement adapters may live in `js/` or a presentation plugin, but they must
consume Program Core semantics and must not carry fallback language parsers or
evaluators.

## Configuration rule

Plugin behavior is assembled through capabilities and generic selectors, not
profile-name checks. Profiles define named sets, per-mode selectable includes
and excludes, off-target outcomes, assessment actions, scoring weights, bonus
checks, response categories, and canonical answer resolvers. The plugin owns
the vocabulary and resolver implementations; the profile decides how they are
combined into an activity.
