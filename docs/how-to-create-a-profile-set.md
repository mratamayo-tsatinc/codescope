# How to Create and Deploy a Profile Set

A **Profile Set** is one complete selectable CodeScope configuration. It owns:

- Profile Set identity and version;
- the shared session timer and persistence policy;
- profile categories;
- the profiles inside those categories.

An individual **profile** still represents one activity configuration.

## Create or edit a set

1. Open CodeScope's login screen.
2. Select **Profiles** to open Profile Designer.
3. Open **Session policy**.
4. Enter a stable Set ID, visible name, version, and description.
5. Configure the shared timer and persistence behavior.
6. Add or edit categories and profiles.
7. Select **Validate**.
8. Select **Download Profile Set**.

The downloaded filename is `<set-id>.json`.

## Deploy the file

Copy the downloaded JSON file into `profile-sets/`, then add it to
`profile-sets/manifest.json`:

```json
{
  "schemaVersion": 1,
  "defaultSetId": "codescope-default",
  "sets": [
    {
      "id": "codescope-default",
      "name": "CodeScope Default",
      "description": "Default teaching activities.",
      "file": "codescope-default.json",
      "enabled": true
    },
    {
      "id": "prelim-examination",
      "name": "Prelim Examination",
      "description": "Timed preliminary assessment.",
      "file": "prelim-examination.json",
      "enabled": true
    }
  ]
}
```

The manifest entry ID must exactly match the JSON file's top-level `id`.
`defaultSetId` determines the initial login selection. Disabled entries are
not shown.

## Student selection

The login form loads the manifest and displays every enabled Profile Set. The
selected set is loaded and validated before **Begin Session** becomes
available. The selection is remembered on that browser.

Once a session begins, its Profile Set is fixed. The student must log out to
start or resume a different set.

## Version and persistence

Persistence is configured only at `session.persistence.enabled`. Categories
and profiles do not have persistence fields.

Saved progress is keyed by student email and Profile Set ID. CodeScope also
records the set version and refuses to restore a record created by another
version. Increase `version` after changes that should invalidate earlier saved
sessions.

## Exercise files

Profiles continue to reference exercise libraries and exercise-set names.
Deploy those exercise files and manifests before offering the Profile Set to
students. CodeScope validates registered activities and loads their content
before login can begin.

## Current default

`profile-sets/codescope-default.json` contains the configuration that was
previously hardcoded in `js/profiles.js`. It is registered as the default in
`profile-sets/manifest.json`.
