# Profile Sets

Each JSON file in this directory describes one complete CodeScope session:

- programming language, timer, persistence, and result retrieval policy
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

Language, timer, persistence, and unified result retrieval belong only to the top-level
session policy:

~~~json
{
  "session": {
    "language": "c",
    "timing": { "enabled": false, "minutes": 120, "allowReset": false },
    "persistence": { "enabled": true },
    "results": { "unified": false }
  }
}
~~~

Use <code>session.language</code> with <code>"c"</code> or
<code>"java"</code>. It selects exercise manifests, parsers, rendered syntax,
and generated content before the session loads. Older sets without the field
default to C.

Set <code>session.timing.allowReset</code> to <code>true</code> to show a timer
reset control guarded by a teacher PIN. During an active session it grants a
fresh full duration without changing work. After expiration it reopens the
session from a checkpoint taken immediately before timeout scoring, while
preserving items the student had already completed. Keep it <code>false</code>
for fixed-duration assessments.

Set <code>session.results.unified</code> to <code>true</code> to add one
aggregate session score and QR code with a category breakdown. Category scores
and QR codes remain available as fallback results.

Saved progress is isolated by student email and Profile Set ID. Increment the
Profile Set `version` after changes that should start a fresh student session.

## Bundled sets

- `codescope-default.json` is the default general teaching configuration.
- `c-semifinals-selection-statements.json` is the C selection-statements
  semifinals. Its assessment blueprint and content guard are documented in
  `docs/c-semifinals-selection-statements.md`.
- `c-midterms-expressions.json` is the C expressions midterms set. Its four
  ordered categories, seeded source libraries, and validation command are
  documented in `docs/c-midterms-expressions.md`.
