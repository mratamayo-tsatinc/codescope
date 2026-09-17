# Validation Checklist

## Automated gate

Run from the project root:

```bash
node tests/run-tests.js
```

The implementation is not complete unless the command exits successfully with:

```text
All CodeScope compatibility and extension tests passed.
```

Do not replace full-suite validation with a targeted test. Add targeted
coverage, then run the full suite.

## General regression checks

- [ ] `index.html` loads every classic script after its dependencies.
- [ ] All profiles are declared in `js/profiles.js`.
- [ ] No plugin contains a local `profiles/` directory.
- [ ] Legacy expression generation and snapshot hashes remain unchanged unless
      the task explicitly changes them.
- [ ] Practice and Exam settings are snapshotted at session start.
- [ ] Existing saved Exam attempts resume without regenerated items.
- [ ] Console guidance remains neutral during unreleased Exam work.
- [ ] Correct solution remains unavailable in Exam.
- [ ] Desktop and mobile layouts have no page-level horizontal overflow.
- [ ] Mouse, keyboard, focus, and disabled states agree.

## Legacy/program activity scenarios

- [ ] Declaration followed by assignment disables the completed declaration's
      `=` control before the next statement activates.
- [ ] Compound assignment performs explicit read–modify–write and updates
      memory once.
- [ ] A valid wrong manual response propagates and receives one score result.
- [ ] Resolved logical `!` appears as a Boolean literal in later prompts.
- [ ] Resolved `++`/`--` retains the named binding and updated value.
- [ ] Boolean selected controls use a filled contextual accent color.
- [ ] Manual connectors start at the operator and end with a dot at the
      destination border.

## Token Classification scenarios

- [ ] Initial code is comfortably readable and every line remains visible.
- [ ] Learners can answer lines in the profile-configured order.
- [ ] Responses remain editable until Check.
- [ ] Java `class` in a declaration-name position expects Invalid Identifier.
- [ ] A semicolon target expects Separator.
- [ ] Guided Identifier Position exposes only the declaration name.
- [ ] Practice strict off-target selection blocks and Undo restores work.
- [ ] Exam strict off-target selection terminates the item and preserves earlier
      credit without giving the solution.
- [ ] Checked tokens retain category colors and receive thin correct/incorrect
      underlines; wrong tokens receive a restrained red wave.
- [ ] Try again removes every previous answer and checked visual.
- [ ] Feedback opens automatically and owns Show correct solution.

## Falling Token Sort scenarios

- [ ] Practice produces 3–5 tokens for each configured category.
- [ ] Exam produces exactly 5 tokens for each configured category.
- [ ] A fresh Practice session changes the permutation.
- [ ] An Exam refresh restores the exact token order and placements.
- [ ] Bucket counts increase after accepted placements.
- [ ] Wrong Practice placement follows the configured return policy.
- [ ] Console guidance switches between C and Java.
- [ ] The reserved-word list exactly matches the active analyzer catalog.
- [ ] Current-token classification is not disclosed by neutral guidance.
- [ ] Bucket layout and Console content remain usable around 390 px width.

## Score Summary scenarios

- [ ] On-screen score is visible.
- [ ] Downloaded PNG contains the same score.
- [ ] Practice and Exam solid backgrounds remain distinguishable in the PNG.
- [ ] Download action is prominent and keyboard accessible.

## Handoff report

Every completed implementation should state:

- outcome;
- touched files;
- tests executed and result;
- manual checks performed;
- known limitation or deferred follow-up;
- whether any contract document changed and why.

