# Profile Sets

Each JSON file in this directory describes one complete CodeScope session:

- session timer and persistence policy
- profile categories
- activity profiles

`manifest.json` controls which Profile Sets appear on the login screen and
which one is selected by default.

## Add a Profile Set

1. Download the JSON file from Profile Designer.
2. Copy it into this directory.
3. Add an enabled entry to `manifest.json` whose `id` matches the JSON file's
   top-level `id`.
4. Reload CodeScope.

Persistence belongs only to the top-level session policy:

```json
{
  "session": {
    "timing": { "enabled": false, "minutes": 120 },
    "persistence": { "enabled": true }
  }
}
```

Saved progress is isolated by student email and Profile Set ID. Increment the
Profile Set `version` after changes that should start a fresh student session.

## Bundled sets

- `codescope-default.json` is the default general teaching configuration.
- `c-semifinals-selection-statements.json` is the C selection-statements
  semifinals. Its assessment blueprint and content guard are documented in
  `docs/c-semifinals-selection-statements.md`.
