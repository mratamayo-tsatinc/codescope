# CodeScope Plugin Architecture

New activity plugins live in `plugins/<plugin-id>/`. The app-shell `js/` and
`css/` folders are reserved for orchestration, shared services, design tokens,
and reusable UI primitives. Plugin-specific behavior and presentation must not
be added to those folders.

## Required boundary

A plugin registers through the shell's `registerActivityPlugin()` contract and
may expose profiles through `registerActivityProfiles()`. The shell may call a
plugin's public lifecycle functions, but it must not depend on private plugin
modules.

Each plugin owns its manifest, profiles, generation, canonical domain rules,
actions, scoring checks, solution trace, renderer, feedback content, styles,
language catalogs, and tests. Plugin CSS must be namespaced.

Plugins may consume shell services such as session state, modal infrastructure,
drawers, persistence, Undo, Check, scoring aggregation, and design tokens. A
plugin must not import another plugin's private files. Future inter-plugin
dependencies must be declared against public capabilities.

## Reference implementation

`plugins/token-classification/` is the reference structure for new activity
plugins. Its three profiles demonstrate that profiles compose canonical plugin
capabilities without embedding answer keys or hardcoding Guided/Strict lesson
behavior into the shell.

The four existing statement plugins in `js/` are intentionally unchanged.
Their migration will be handled by a separate refactoring plan.

## Configuration rule

Plugin behavior is assembled through capabilities and generic selectors, not
profile-name checks. Profiles define named sets, per-mode selectable includes
and excludes, off-target outcomes, assessment actions, scoring weights, bonus
checks, response categories, and canonical answer resolvers. The plugin owns
the vocabulary and resolver implementations; the profile decides how they are
combined into an activity.
