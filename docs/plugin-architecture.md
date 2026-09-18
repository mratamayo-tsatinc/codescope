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

Each plugin owns its manifest, generation, canonical domain rules, actions,
scoring checks, solution trace, renderer, feedback content, styles, language
catalogs, and tests. Plugin CSS must be namespaced. The app-shell `js/` and
`css/` directories contain only shared orchestration and reusable services;
profile data in `js/profiles.js` is configuration, not plugin behavior.

Plugins may consume shell services such as session state, modal infrastructure,
drawers, persistence, Undo, Check, scoring aggregation, and design tokens. A
plugin must not import another plugin's private files. Future inter-plugin
dependencies must be declared against public capabilities.

The token-classification plugin exposes the shared identifier-language
capability used by Falling Token Sort: seeded candidate construction, C/Java
language definitions, and canonical lexical/contextual analysis. Falling Token
Sort declares that dependency in its manifest and consumes the public analysis
contract; it does not maintain a second answer list.

## Reference implementation

`plugins/falling-token-sort/`, `plugins/token-classification/`, and
`plugins/simulate-output/` are reference
directory boundaries for activity plugins. Their profiles are declared
globally in `js/profiles.js`; their plugin directories contain only the
behavior and presentation needed to execute those configurations.

Simulate Output owns a static C exercise bank with answer metadata, a synchronous
catalog for seeded item selection, answer comparison, and its response UI. It
uses the shell's login, navigation, Practice/Exam policy, persistence, scoring
summary, and drawers. See `docs/how-to-create-a-simulate-output-profile.md`.

The four existing statement plugins in `js/` are intentionally unchanged.
Their migration will be handled by a separate refactoring plan.

## Configuration rule

Plugin behavior is assembled through capabilities and generic selectors, not
profile-name checks. Profiles define named sets, per-mode selectable includes
and excludes, off-target outcomes, assessment actions, scoring weights, bonus
checks, response categories, and canonical answer resolvers. The plugin owns
the vocabulary and resolver implementations; the profile decides how they are
combined into an activity.
