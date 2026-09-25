# Project Foundation

## Product identity

CodeScope is an extensible web shell for interactive programming-learning
activities. Operator precedence was the original activity, but the shell must
not represent or assume that one subject. The original Precedify logo remains
the temporary app icon until a replacement CodeScope logo is explicitly
approved.

The application is intentionally implemented with vanilla HTML, CSS, and
classic JavaScript. It is served as static files and currently has no backend.
Student lookup uses `data/students.csv`; session settings and enabled mode
snapshots are stored in the browser.

## Product goals

- Teach programming concepts through visible, student-controlled semantic
  actions rather than passive answer submission.
- Support beginner guidance and stricter assessment from the same canonical
  activity model.
- Make new activity types additive through profiles and plugins.
- Keep generated content reproducible for assessment while permitting varied
  Practice sessions.
- Preserve the established visual and interaction language across activities.
- Keep scoring, persistence, drawers, settings, and accessibility reusable at
  the shell level.

## Vocabulary

| Term | Meaning |
|---|---|
| Shell | Shared login, session, profile navigation, settings, drawers, scoring aggregation, persistence, modal infrastructure, and design tokens. |
| Profile | Declarative configuration in `js/profiles.js` describing what an activity generates and assesses. |
| Activity plugin | Directory-isolated capability registered through `registerActivityPlugin()`. |
| Statement plugin | Semantic handler for one Program IR statement kind. |
| Renderer | Presentation layer that displays state and emits semantic actions; it does not own answers. |
| Canonical trace | Semantic correct-solution sequence used for checking, scoring, feedback, and Practice playback. |
| Guided | Profile-defined selectable scope restricts the learner to intended actions. |
| Strict sequence | Profile-defined broader scope exposes meaningful mistakes and applies Practice or Exam consequences. |

## Current architecture

| Layer | Primary files | Responsibility |
|---|---|---|
| Static shell | `index.html`, `css/`, shared `js/` | Application framing and reusable services. |
| Profile catalog | `js/profiles.js` | All 36 profile configurations. No plugin-local profiles. |
| Expression engine | `js/engine.js`, `flat-model.js`, `template-engine.js`, `generator.js` | Seeded expression construction and evaluation. |
| Program runtime | `js/program-ir.js`, `program-core.js`, `program-item-builder.js` | Ordered statement programs and dispatch. |
| Statement semantics | Existing statement files in `js/`; Program Output in `plugins/program-output/` | Expression, declaration, assignment, unary update, and language-neutral output behavior. |
| Activity orchestration | `js/activity-core.js` | Activity-plugin registry, profile content-provider registry, and shell lifecycle dispatch. |
| Token Classification | `plugins/token-classification/` | Language rules, identifier generation/analysis, syntax-position classification, modal, renderer, and feedback. |
| Falling Token Sort | `plugins/falling-token-sort/` | Configurable bucket sorting using Token Classification's public identifier capabilities. |
| Code Simulator | `plugins/code-simulator/` | Manifest-backed complete C/Java programs that dispatch every supported statement kind through Program Core. |
| Persistence | `js/settings-persistence.js`, `exam-persistence.js` | Device settings and independently configurable per-student Practice/Exam snapshots. |
| Verification | `tests/run-tests.js` | Full compatibility and extension suite. |

## Profile families

The global catalog currently contains:

- 18 original expression profiles.
- 12 additive declaration, assignment, unary-update, and student-derived-value
  profiles.
- 3 Token Classification profiles:
  - `token-identifier-position`
  - `token-declaration-complete`
  - `token-program-chain`
- 1 Falling Token Sort profile:
  - `falling-identifier-sort`
- 2 Program Output lesson profiles:
  - `program-output-basics`
  - `program-output-source-flow`
- Code Simulator backs these 2 complete-source profiles, overlapping the
  lesson families above:
  - `program-output-source-flow`
  - `selection-statements-source`

Do not duplicate these configurations inside plugin directories.

## Runtime loading model

The app uses classic `<script>` tags. Earlier scripts expose globals consumed by
later scripts. `index.html` is therefore an executable dependency manifest.
When adding or moving a file, preserve dependency order and add a load-order
test. Do not introduce an ES-module or build-system migration as an incidental
change.

Program Output registers a profile content provider for statement-oriented and
generated lessons. Code Simulator owns complete-source parsing. The Source
Program Output profile uses Code Simulator with `sourceLibrary:'program-output'`
so it reads the existing
`plugins/program-output/exercises/<language>/<exerciseSet>/manifest.json`
bank without duplicating the authored files. Program Output still owns output
statement behavior and rendering. Source-backed items persist the resulting
IR, so an active Exam restores its snapshot rather than rebuilding its
statements from changed source files.
Profiles that consume the complete bank use `selection.count:'all'` and
`scoring.itemCount:'manifest'`, allowing the current manifest to own both item
membership and score totals. Providers parse current fetched source for new
sessions; they do not maintain copied raw catalogs or fixed statement graphs.
`presentation:'source-flow'` interleaves supported statement renderers with
the file's complete contextual source, using authored line numbers and without
adding a synthetic final assignment. An authored exact C `return 0;` is parsed
as the explicit terminal action; Java does not receive a synthetic return.

## Shared services

Activity plugins may use these shell capabilities without reimplementing them:

- profile selection and item navigation;
- Practice/Exam session policy;
- scoring aggregation and Score Summary;
- Console and Feedback drawers;
- modal shell and connector conventions;
- activity-local sizing, per-student preference, and post-resize connector
  refresh;
- mode-scoped session persistence;
- Undo, Check, Try again, and solution disclosure policy;
- shared design tokens, accessibility primitives, and animation services.

See `docs/plugin-architecture.md`, `docs/statement-plugin-guide.md`,
`docs/how-to-create-a-program-output-profile.md`, and
`docs/how-to-use-app-settings.md` for implementation detail.
