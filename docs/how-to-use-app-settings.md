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
  schemaVersion: 5,
  settingsPolicy: 'local-configurable', // or 'state-only'
  // ...
});
```

The policy itself is never loaded from local storage. A browser user therefore
cannot persistently switch a `state-only` deployment back to editable mode
through the normal settings interface.

## Important persistence rule

In `local-configurable` mode, changing defaults in `state.js` does **not**
overwrite settings already saved on a student machine. Saved settings remain
the device-level source until **Reset application settings** or **Clear all
local application data** removes them.

In `state-only` mode, saved settings are ignored immediately, but student exam
progress remains available. Changing the settings policy never deletes an
exam attempt.

Settings are captured as an immutable session policy when Practice starts or
an Exam attempt begins. Changing the configuration affects the next session,
not an already-running one. A resumed Exam restores the policy saved with that
attempt.

## Complete configuration

```js
const DEFAULT_APP_SETTINGS = Object.freeze({
  schemaVersion: 5,
  settingsPolicy: 'local-configurable',
  mode: 'practice',
  timerMinutes: 15,

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
    showScoresDuringExam: false,
    feedbackRelease: 'after-submit',
    lockItemAfterCheck: true,
    autoSubmitOnTimeout: true,
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
| `showScoresDuringExam` | Shows running scores before submission. |
| `feedbackRelease: 'after-submit'` | Releases scores and item results after final submission. |
| `feedbackRelease: 'never'` | Records submission without releasing item results. |

The following Exam rules are enforced invariants even if stale or manually
edited browser data says otherwise:

- `showCorrectSolution` is always `false`.
- `lockItemAfterCheck` is always `true`.
- `autoSubmitOnTimeout` is always `true`.

Exam items are generated from a per-student seed and saved locally. Reloading,
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

| Action | Settings | Saved login | All student Exam attempts |
|---|---:|---:|---:|
| Clear all exam progress | Keep | Keep | Delete |
| Reset application settings | Reset to `state.js` defaults | Keep | Keep |
| Clear all local application data | Delete/reset | Delete | Delete |

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
  showScoresDuringExam: false,
  feedbackRelease: 'after-submit',
  lockItemAfterCheck: true,
  autoSubmitOnTimeout: true,
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
