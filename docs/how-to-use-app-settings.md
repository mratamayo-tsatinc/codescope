# How to Configure CodeScope

CodeScope separates deployment presentation settings from teaching policy.

- `DEFAULT_SHELL_SETTINGS` in `js/state.js` controls shared presentation such
  as animation, panels, zoom, pagination, and celebrations.
- A Profile Set JSON file controls the programming language, session timer,
  persistence, unified result retrieval, categories, profiles, interaction, feedback, retry, Undo,
  and scoring behavior.
- The login Settings panel manages saved device data only.

There is no global Practice or Exam switch.

## Session policy

Language, timer, persistence, and result retrieval belong to the Profile Set's top-level <code>session</code> object:

```json
{
  "session": {
    "language": "c",
    "timing": {
      "enabled": true,
      "minutes": 90,
      "allowReset": false
    },
    "persistence": {
      "enabled": true
    },
    "results": {
      "unified": true
    }
  }
}
```

These settings cannot be declared by a category or individual profile.

The session language must be <code>"c"</code> or <code>"java"</code>. It is
applied before exercise manifests load and remains fixed for the complete
session.

When <code>session.results.unified</code> is <code>true</code>, the header
exposes an additional session score and QR code. It sums every enabled category
and shows each category's contribution. Existing category score and QR controls
remain available. Set it to <code>false</code> when categories are separate
assessments.

The timer starts once when the student begins and continues across every
category, profile, and item. It never restarts during navigation. When it
expires, attempted work is scored and the complete session is locked.

When <code>session.timing.allowReset</code> is <code>true</code>, the signed-in
student receives a teacher-PIN guarded timer reset control. Each page load
uses the local machine timestamp to choose either YYMMDD or MMDDYY; the chosen
format and PIN are never persisted or shown in the interface. Resetting an
active timer grants the full configured duration and preserves all progress.
Reopening an expired session restores only items that timeout finalized, using
their pre-timeout checkpoints; items completed by the student remain completed.
Keep this option disabled for assessments whose duration must remain fixed.

When persistence is enabled, CodeScope saves the generated items, responses,
scores, active location, seed, and absolute timer deadline. Storage is scoped
to both the student and Profile Set:

```text
codescopeSessionProgress:<student-email>:<profile-set-id>
```

A saved session resumes only when the Profile Set ID and version match. Change
the set's `version` when a deployment should start a fresh session.

Legacy progress saved by builds that predate Profile Set-scoped storage is
migrated when its saved profile IDs match the selected Profile Set. Additive
session-policy changes, including enabling timer reset, therefore retain the
student's completed scores and original timer deadline.

The Profile Set ID and version form the persistence compatibility contract.
Older records whose saved global language differs are normalized when the ID
and version still match. Increment the version for an intentional language or
exercise change that must begin a new attempt.

## Per-profile teaching behavior

Each profile owns its activity behavior:

```json
{
  "behavior": {
    "interactionMode": "strict-sequence",
    "allowUndo": true,
    "allowRetry": true,
    "allowReviewFlags": false,
    "showNeutralGuidance": true,
    "showScores": true,
    "feedbackRelease": "immediate",
    "lockItemAfterCheck": false,
    "showCorrectSolution": true,
    "manualResponses": {
      "mode": "profile",
      "namedValueRate": 50,
      "operatorRate": 50
    }
  }
}
```

Use Profile Designer from the login screen to edit these fields. See
`docs/how-to-create-a-profile-set.md` for the complete authoring and deployment
workflow.

## Shell presentation settings

Edit `DEFAULT_SHELL_SETTINGS` in `js/state.js` for deployment-wide visual
behavior. These settings are application presentation rather than assessment
policy. They include:

- connector visibility and geometry;
- memory and output panel visibility;
- transfer and character animation speed;
- activity zoom limits;
- source-flow movement timing;
- pagination size;
- score-summary presentation;
- confetti and celebration counts.

Profile Set downloads do not duplicate these stable application settings.

## Clearing local data

The login Settings panel provides three explicit device actions:

- clear saved student sessions;
- reset device application settings;
- clear all local CodeScope data.

Clearing data does not modify Profile Set JSON files on the server.
