# CodeScope Agent Contract

This file is the mandatory starting point for every AI agent working in this
repository. It preserves the product and implementation decisions that must not
be reconstructed from chat history.

## Read before changing code

Read these files in order:

1. `docs/PROJECT_FOUNDATION.md`
2. `docs/BEHAVIOR_CONTRACT.md`
3. `docs/UI_UX_CONTRACT.md`
4. `docs/EXTENSION_CONTRACT.md`
5. `docs/IMPLEMENTATION_HANDOFF.md`
6. `docs/VALIDATION_CHECKLIST.md`

Then read the task-specific guide linked by those documents. Do not start from
screenshots or one renderer in isolation when a shared contract already exists.

## Sources of truth

- `js/profiles.js` is the only profile catalog.
- `js/state.js` owns shell defaults and session policy.
- `plugins/<plugin-id>/` owns an activity plugin's behavior and presentation.
- `tests/run-tests.js` is the compatibility gate.
- The contract documents above are normative product requirements. If current
  code and a contract disagree, report the conflict and determine whether it is
  a defect or an intentionally superseded decision. Never silently rewrite a
  contract to justify an implementation.

## Non-negotiable architecture

- CodeScope is an activity-agnostic shell, not an expression-only application.
- Profiles describe activities; plugins provide canonical domain behavior.
- Profiles never live inside plugin directories.
- Plugin-specific JavaScript, CSS, language catalogs, generators, renderers,
  feedback, and assets stay inside that plugin's directory.
- The shell may expose reusable services but must not hardcode a plugin's
  categories, targets, lesson purpose, or answers.
- Canonical answers come from domain analyzers, not profile-authored answer
  strings or renderer assumptions.
- Existing statement plugins in `js/` remain in place until a separately
  approved refactor. Do not opportunistically move them.
- Preserve classic-script ordering in `index.html`; there is no module bundler.

## Non-negotiable behavior

- Practice and Exam policies remain distinct.
- Exam restores both generated content and student progress; it must never
  regenerate an active saved attempt.
- Language is captured into each generated item and does not change mid-item.
- Students may revise an answer until Check. Try again is a true reset.
- Show correct solution is Practice-only and belongs in the Feedback drawer.
- Feedback auto-opens after Check when policy permits release.
- Scoring uses semantic checks/actions, not DOM state or animation completion.
- A valid but incorrect student-derived value propagates and is scored once.
- Execute `node tests/run-tests.js` after every implementation.

## UI obligations

- Reuse the established dark IDE-like visual language and shared design tokens.
- Do not introduce a new activity card, oversized repeated profile title,
  purple accent system, automatic confetti, or novel interaction styling.
- Maintain readable source code, compact token spacing, line numbers, progress
  dots where used by the shared activity pattern, responsive drawers, and
  accessible keyboard/focus behavior.
- Plugin CSS must be namespaced and must work on desktop and mobile.

## Work routine

1. Inspect the current implementation and unrelated local changes.
2. State the affected contract and files.
3. Make the smallest coherent change.
4. Add or update regression coverage.
5. Run the complete compatibility suite.
6. Report touched files, tests, and any remaining limitation.

When working in a user-selected local folder, edit that folder directly. Do not
create ZIP handoffs unless the user explicitly requests one.

