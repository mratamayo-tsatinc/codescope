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
| Activity plugin | Directory-isolated activity interaction and presentation registered through `registerActivityPlugin()`. |
| Statement adapter | Interaction handler for one Program IR statement kind; it consumes shell-owned semantics. |
| Renderer | Presentation layer that displays state and emits semantic actions; it does not own answers. |
| Canonical trace | Semantic correct-solution sequence used for checking, scoring, feedback, and Practice playback. |
| Guided | Profile-defined selectable scope restricts the learner to intended actions. |
| Strict sequence | Profile-defined broader scope exposes meaningful mistakes and applies Practice or Exam consequences. |

## Current architecture

| Layer | Primary files | Responsibility |
|---|---|---|
| Static shell | `index.html`, `css/`, shared `js/` | Application framing and reusable services. |
| Profile catalog | `js/profiles.js` | All 41 profile configurations. No plugin-local profiles. |
| Generated expression content | `js/engine.js`, `flat-model.js`, `template-engine.js`, `generator.js` | Seeded legacy expression construction and compatibility presentation data. |
| Language core | `js/language-core.js`, expression/statement services, `program-parser.js` | Canonical C/Java parsing, evaluation, effects, diagnostics, and traces. |
| Source pipeline | `js/source-program-pipeline.js` | Manifest validation, metadata, seeding, and live-source conversion to Program IR. |
| Program runtime | `js/program-ir.js`, `program-core.js`, `program-item-builder.js` | Ordered programs, semantic service access, interaction dispatch, and generated-item adaptation. |
| Program terminal | `js/output-statement-core.js`, `js/program-terminal.js`, shared terminal styles in `css/styles.css` | Canonical terminal state plus the shared screen, cursor, control-character playback, and input/output event surface. |
| Activity orchestration | `js/activity-core.js` | Activity-plugin registry, profile content-provider registry, and shell lifecycle dispatch. |
| Token Classification | `plugins/token-classification/` | Language rules, identifier generation/analysis, syntax-position classification, modal, renderer, and feedback. |
| Falling Token Sort | `plugins/falling-token-sort/` | Configurable bucket sorting using Token Classification's public identifier capabilities. |
| Code Simulator | `plugins/code-simulator/` | Complete-source interaction and presentation over canonical Program IR. |
| Program Input | `plugins/program-input/` | Enter-gated input interaction, virtual keyboard, console transfer, and timeline presentation over core Input IR. |
| Persistence | `js/settings-persistence.js`, `exam-persistence.js` | Device settings and independently configurable per-student Practice/Exam snapshots. |
| Verification | `tests/release-gate.js` | Release gate over syntax, assets, content, architecture, responsive contracts, and the compatibility suite. |

## Profile families

The 41-profile global catalog is grouped into six categories:

- 1 Input Statements profile;
- 4 Output Statements profiles, including complete-source Code Simulator
  presentations;
- 18 Expressions profiles;
- 12 Program Statements profiles;
- 5 Identifier Activities profiles, including two Falling Token Sort lessons;
- 1 Simulate Output profile.

Do not duplicate these configurations inside plugin directories.

## Runtime loading model

The app uses classic `<script>` tags. Earlier scripts expose globals consumed by
later scripts. `index.html` is therefore an executable dependency manifest.
When adding or moving a file, preserve dependency order and add a load-order
test. Do not introduce an ES-module or build-system migration as an incidental
change.

Program Output registers a content adapter for statement-oriented and generated
lessons. Code Simulator adapts complete-source Program IR for its workspace.
Both receive source through the shell-owned source pipeline and program parser.
The Source Program Output profile uses the declarative `source-programs`
library configuration.
The independent exercise library resolves to
`exercise-libraries/source-programs/<language>/<exerciseSet>/manifest.json`.
Neither plugin owns or hardcodes that content path. Program Output owns the
statement-specific interaction and timeline. The language core owns output
meaning and terminal-state semantics, while the shell-owned Program Terminal
renders the shared screen, cursor, and playback consumed by compatible
activities.
Source-backed items persist the resulting
IR, so an active Exam restores its snapshot rather than rebuilding its
statements from changed source files.
Profiles that consume the complete bank use `selection.count:'all'` and
`scoring.itemCount:'manifest'`, allowing the current manifest to own both item
membership and score totals. The source pipeline parses current fetched source
for new sessions; adapters do not maintain copied raw catalogs or fixed
statement graphs.
`presentation:{workspace:'source-program',timeline:'statement-modal'}` combines
the complete source view with registered statement renderers, using authored line numbers and without
adding a synthetic final assignment. An authored exact C `return 0;` is parsed
as the explicit terminal action; Java does not receive a synthetic return.

## Shared services

Activity plugins may use these shell capabilities without reimplementing them:

- profile selection and item navigation;
- Practice/Exam session policy;
- scoring aggregation and Score Summary;
- Console and Feedback drawers;
- modal shell and connector conventions;
- the Program Terminal screen, cursor, input/output event playback, and control
  characters such as newline, carriage return, and backspace;
- activity-local sizing, per-student preference, and post-resize connector
  refresh;
- mode-scoped session persistence;
- Undo, Check, Try again, and solution disclosure policy;
- shared design tokens, accessibility primitives, and animation services.

See `docs/plugin-architecture.md`, `docs/statement-plugin-guide.md`,
`docs/how-to-create-a-program-output-profile.md`, and
`docs/how-to-use-app-settings.md` for implementation detail.
