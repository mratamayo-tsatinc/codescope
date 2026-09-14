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
embed profile configuration in their own directory. The older
`registerActivityProfiles()` entry point is retained only for compatibility
with activity profiles created before this rule and must not be copied by new
implementations.

Each plugin owns its manifest, generation, canonical domain rules, actions,
scoring checks, solution trace, renderer, feedback content, styles, language
catalogs, and tests. Plugin CSS must be namespaced. The app-shell `js/` and
`css/` directories contain only shared orchestration and reusable services;
profile data in `js/profiles.js` is configuration, not plugin behavior.

Plugins may consume shell services such as session state, modal infrastructure,
drawers, persistence, Undo, Check, scoring aggregation, and design tokens. A
plugin must not import another plugin's private files. Future inter-plugin
dependencies must be declared against public capabilities.

## Reference implementation

`plugins/falling-token-sort/` is the reference directory boundary for new
activity plugins. Its profile is declared globally in `js/profiles.js`; its
plugin directory contains only the behavior and presentation needed to execute
that configuration.

The token-classification activity predates the global-profile-location rule.
Its bundled profile files remain a compatibility case until that plugin is
handled by its separate refactoring plan.

The four existing statement plugins in `js/` are intentionally unchanged.
Their migration will be handled by a separate refactoring plan.

## Configuration rule

Plugin behavior is assembled through capabilities and generic selectors, not
profile-name checks. Profiles define named sets, per-mode selectable includes
and excludes, off-target outcomes, assessment actions, scoring weights, bonus
checks, response categories, and canonical answer resolvers. The plugin owns
the vocabulary and resolver implementations; the profile decides how they are
combined into an activity.
