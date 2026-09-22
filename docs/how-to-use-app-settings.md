# How to Use App Settings

App settings control how a session behaves. They do not define expression
content; profiles do that in `profiles.js`. The built-in defaults and the
deployment policy live in `DEFAULT_APP_SETTINGS` in `js/state.js`.

## Where settings come from

The source depends on `settingsPolicy`:

| Policy | Session settings source | Login settings panel |
|---|---|---|
| `local-configurable` | Browser-saved settings, falling back to `state.js` defaults | Editable |
| `state-only` | `state.js` only; browser-saved settings are ignored | Visible but locked |

Use `local-configurable` when a teacher may configure the current device from
the login form. Use `state-only` when the deployed copy must always follow the
hardcoded configuration.

```js
const DEFAULT_APP_SETTINGS = Object.freeze({
  schemaVersion: 7,
  settingsPolicy: 'local-configurable', // or 'state-only'
  persistence: Object.freeze({practice:false, exam:true}),
  // ...
});
```

## Content visibility

Profile and category availability is configured in `js/profiles.js`, alongside
the content it controls. Set a profile's root-level `enabled` value to `false`
to hide that profile. Set a `PROFILE_CATEGORIES` entry's `enabled` value to
`false` to hide the category and every profile assigned to it. Hidden content
is excluded from item generation, persistence, sidebar navigation, and score
totals. See `docs/how-to-create-a-profile.md` for examples and scoring details.

The policy itself is never loaded from local storage. A browser user therefore
cannot persistently switch a `state-only` deployment back to editable mode
through the normal settings interface.

## Important persistence rule

In `local-configurable` mode, changing defaults in `state.js` does **not**
overwrite settings already saved on a student machine. Saved settings remain
the device-level source until **Reset application settings** or **Clear all
local application data** removes them.

In `state-only` mode, saved settings are ignored immediately. Student progress
remains in browser storage until explicitly cleared. Changing settings policy
does not delete a saved attempt.

Settings are captured as an immutable session policy when Practice starts or
an Exam attempt begins. Changing the configuration affects the next session,
not an already-running one. A resumed session restores the policy saved with
that attempt.

## Per-mode session persistence

Edit `DEFAULT_APP_SETTINGS.persistence` in `js/state.js`:

```js
persistence: Object.freeze({
  practice: false, // set true to resume Practice after refresh or login
  exam: true        // set false to start a fresh Exam after refresh or login
}),
```

These two switches are independent and deployment-owned. Browser-saved app
settings and the login Settings panel cannot override them. The defaults keep
the previous behavior: Practice starts fresh; Exam resumes. When enabled, a
mode stores each student's generated items, responses, scores, active profile,
item position, seed, and policy in a mode-specific localStorage record. Exam
also stores its deadline and timeout lock state. Turning a switch off stops reads
and writes for that mode; it does not delete its existing records. The other
mode's records are unaffected. **Clear all local application data** deletes
both modes' records.

## Complete configuration

```js
const DEFAULT_APP_SETTINGS = Object.freeze({
  schemaVersion: 7,
  settingsPolicy: 'local-configurable',
  persistence: Object.freeze({practice:false, exam:true}),
  mode: 'practice',
  timerMinutes: 15,

  shell: DEFAULT_SHELL_SETTINGS,

  practice: Object.freeze({
    interactionMode: 'guided',
    manualResponses: Object.freeze({
      mode: 'profile',
      namedValueRate: 50,
      operatorRate: 50,
    }),
  }),

  exam: Object.freeze({
    interactionMode: 'guided',
    allowUndo: true,
    allowReviewFlags: true,
    showNeutralGuidance: false,
    showScoresDuringExam: true,
    feedbackRelease: 'after-timeout',
    lockItemAfterCheck: true,
    autoLockOnTimeout: true,
    showCorrectSolution: false,
    manualResponses: Object.freeze({
      mode: 'profile',
      namedValueRate: 50,
      operatorRate: 50,
    }),
  }),
});
```

## General settings

| Setting | Allowed values | Effect |
|---|---|---|
| `mode` | `practice`, `exam` | Selects the activity mode used after login. |
| `timerMinutes` | Integer `1`–`999` | Sets the total Exam duration. It is ignored by Practice. |

## Shell and animation settings

Shared presentation defaults are centralized in `DEFAULT_SHELL_SETTINGS` in
`js/state.js`, then exposed as `DEFAULT_APP_SETTINGS.shell`. These values are
deployment-owned: the login Settings modal does not edit them, and saved
browser settings do not override them.

| Setting | Default | Effect |
|---|---:|---|
| `connectors.visible` | `true` | Authoritative connector-line state when the user control is hidden; otherwise the initial state. |
| `connectors.userControlVisible` | `false` | Shows the student-facing Links toggle when `true`. When `false`, students cannot override `connectors.visible`. |
| `connectors.maxLeadPx` | `18` | Maximum straight lead used by connector curves. |
| `memoryPanel.visible` | `true` | Enables the floating memory panel. It is also the initial state when the user control is available. |
| `memoryPanel.displayPolicy` | `content-aware` | `content-aware` shows the panel only for compatible program items; `hidden` disables it for every item. |
| `memoryPanel.userControlVisible` | `false` | Shows the student-facing Vars toggle when `true`. When `false`, panel visibility follows the deployment configuration and active content. |
| `memoryPanel.transferAnimation.enabled` | `true` | Initial state of the memory transfer animation. |
| `memoryPanel.transferAnimation.durationMs` | `1000` | Initial transfer duration. Must match a speed level. |
| `memoryPanel.transferAnimation.speedLevelsMs` | `[1000, 2000, 3000]` | Durations cycled by the memory header control. |
| `memoryPanel.entranceDurationMs` | `220` | Memory-panel entrance duration. |
| `memoryPanel.valueRollDurationMs` | `420` | Duration of the old/new memory value roll. |
| `outputPanel.visible` | `true` | Shows the content-aware Program Output screen for programs containing output statements. |
| `outputPanel.characterAnimation` | `true` | Types each emitted output event into the screen instead of revealing it at once. Reduced-motion preference still disables the animation. |
| `outputPanel.characterDelayMs` | `55` | Delay between visible output characters. |
| `outputPanel.escapeDelayMs` | `320` | Total pause used to expose an escape such as `\\n` before applying its control effect. |
| `compoundAssignment.mergeDurationMs` | `2200` | Compound-assignment convergence duration. |
| `compoundAssignment.writebackDelayMs` | `2400` | Delay before the merged result is written to memory. Keep this greater than the merge duration. |
| `solutionPlayback.stepDurationMs` | `1000` | Correct-solution playback interval. |
| `liveStepScroll.maxWaitMs` | `900` | Maximum wait for guided auto-scroll to settle. |
| `liveStepScroll.bottomInsetPx` | `28` | Bottom breathing room for the active evaluation row. |
| `pagination.windowSize` | `5` | Maximum number of item buttons in the pagination window. |
| `scoreSummary.overallVisible` | `false` | Shows the header-level summary across every category. Category score and QR actions remain available when this is `false`. |
| `scoreSummary.pngScale` | `2` | Resolution multiplier used by the Score Summary PNG download. |
| `scoreSummary.filenamePrefix` | `codescope-score-summary` | Prefix used for downloaded Score Summary filenames. |
| `celebrations.enabled` | `true` | Master switch for shared celebration badges/effects. |
| `celebrations.confettiEnabled` | `true` | Confetti switch independent of celebration badges. |

The remaining values in `memoryPanel` and `celebrations` are timing safety
margins and burst counts. They are centralized beside the visible controls so
the shell no longer hides behavioral defaults inside renderer files.

### Removing student access without removing behavior

The default deployment keeps connector lines enabled, selects the variable
panel automatically from the active content, and removes the three global
header controls that students do not need:

```js
connectors: Object.freeze({
  visible: true,
  userControlVisible: false,
  maxLeadPx: 18,
}),
memoryPanel: Object.freeze({
  visible: true,
  displayPolicy: 'content-aware',
  userControlVisible: false,
  // animation settings...
}),
scoreSummary: Object.freeze({
  overallVisible: false,
  pngScale: 2,
  filenamePrefix: 'codescope-score-summary',
}),
```

This has the following effects:

- Connector lines remain on and the Links control is unavailable. Set
  `connectors.userControlVisible` to `true` to restore the control.
- The variable panel appears only for program items that provide compatible
  memory data. Activity plugins without that data do not receive an empty or
  ineffective panel. Set `memoryPanel.userControlVisible` to `true` to restore
  the Vars control, or set `memoryPanel.displayPolicy` to `hidden` to disable
  the panel completely.
- The header-level overall score action is unavailable. Category score links,
  category totals, PNG export, and category QR generation are unchanged. Set
  `scoreSummary.overallVisible` to `true` to restore the header action.

These are deployment-owned shell values. They are not exposed in the login
Settings modal and browser-saved settings cannot override them.

## Evaluation interaction

`practice.interactionMode` and `exam.interactionMode` accept:

- `guided`: unavailable elements remain locked. This preserves the original
  guided activity behavior.
- `strict-sequence`: operation candidates are selectable. Executable
  lower-precedence choices may continue and are scored per step. A genuinely
  unexecutable action is treated as an invalid execution.

The invalid-execution result differs by mode:

| Mode | Invalid execution behavior |
|---|---|
| Practice strict | Pauses the affected statement, shows a learning-oriented explanation, and provides Undo. |
| Exam strict | Terminates the affected item, communicates the critical stop without teaching the solution, and preserves credit already earned. |

Wrong precedence is not automatically a terminal error when the chosen
operation has available operands. Each operation step and the final value are
scored separately.

## Student-derived values

Both Practice and Exam use the same structure:

```js
manualResponses: {
  mode: 'profile',       // profile | off | custom
  namedValueRate: 50,   // 0..100
  operatorRate: 50,     // 0..100
}
```

| Mode | Behavior |
|---|---|
| `profile` | Uses each profile's `manualResponses` block. Profiles without one auto-derive. |
| `off` | Always auto-derives named values and operator results. |
| `custom` | Applies the two application rates to every profile. |

`namedValueRate` controls variable/constant reads. `operatorRate` controls
eligible operator results and writes. Rates use a seeded exact quota across
the generated item set for each profile, supporting repeatable and comparable
student attempts.

A manually entered number must be a signed integer. Boolean operations use a
TRUE/FALSE selector. A valid but wrong answer is allowed to propagate; only an
invalid execution blocks or terminates according to the interaction policy.

## Exam options

| Setting | Effect |
|---|---|
| `allowUndo` | Allows one-step Undo within the current unfinished statement. It cannot undo a checked item or a terminal strict-exam error. |
| `allowReviewFlags` | Lets students flag unfinished items for later review. |
| `showNeutralGuidance` | Shows interaction instructions without correctness feedback. |
| `showScoresDuringExam` | Shows the running score in each category's Score/QR summary. The default is `true`. |
| `feedbackRelease: 'after-timeout'` | Releases item results after the timer expires. Category Score/QR summaries remain available. |
| `feedbackRelease: 'never'` | Keeps item correctness hidden after timeout. Category Score/QR summaries remain available. |

The following Exam rules are enforced invariants even if stale or manually
edited browser data says otherwise:

- `showCorrectSolution` is always `false`.
- `lockItemAfterCheck` is always `true`.
- `autoLockOnTimeout` is always `true`.

Exam mode has no manual submission action. When the timer expires, the current
attempt stays on the session screen, all answer and scoring actions are locked,
and students use the Score/QR action beside each category to view its summary.

When Exam persistence is enabled, generated items are saved locally. Reloading,
logging out, or logging back in on the same browser resumes the same attempt
and original deadline; it does not regenerate questions or reset the timer.

## Using the login settings panel

1. Open **Session Settings** from the login form.
2. Select Practice or Exam.
3. Configure the options shown for that mode.
4. Select a student-derived-values policy.
5. Press **Save**.

The saved configuration is device/browser-wide, not keyed to one student. On
a shared laboratory computer, the next student receives the same session
configuration unless it is changed or reset.

When `settingsPolicy` is `state-only`, the same page remains accessible for
transparency and data management. Configuration fields and Save are locked,
and the page explains that the deployment controls them.

## Local data and the Danger Zone

| Action | Settings | Saved login | Exam attempts | Practice progress |
|---|---:|---:|---:|---:|
| Clear all exam progress | Keep | Keep | Delete | Keep |
| Reset application settings | Reset to `state.js` defaults | Keep | Keep | Keep |
| Clear all local application data | Delete/reset | Delete | Delete | Delete |

These actions affect only the current browser/device. The application has no
backend database or central dashboard, so clearing browser storage cannot be
recovered elsewhere.

## Recommended deployment examples

### Teacher-configurable Practice station

```js
settingsPolicy: 'local-configurable',
mode: 'practice',
practice: Object.freeze({
  interactionMode: 'guided',
  manualResponses: Object.freeze({mode:'profile',namedValueRate:50,operatorRate:50}),
}),
```

### Locked Exam deployment

```js
settingsPolicy: 'state-only',
mode: 'exam',
timerMinutes: 30,
exam: Object.freeze({
  interactionMode: 'strict-sequence',
  allowUndo: false,
  allowReviewFlags: true,
  showNeutralGuidance: false,
  showScoresDuringExam: true,
  feedbackRelease: 'after-timeout',
  lockItemAfterCheck: true,
  autoLockOnTimeout: true,
  showCorrectSolution: false,
  manualResponses: Object.freeze({mode:'custom',namedValueRate:50,operatorRate:50}),
}),
```

Keep every required property when replacing a nested Practice or Exam object.
After editing `state.js`, run:

```bash
node tests/run-tests.js
```

Do not change `schemaVersion` merely to force new defaults onto existing
browsers. Use the provided reset action for that purpose; reserve schema
changes for an actual persistence-format migration.
