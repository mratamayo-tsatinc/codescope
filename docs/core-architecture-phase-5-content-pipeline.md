# Phase 5: content pipeline separation

Phase 5 makes source acquisition separate from language interpretation. A
content provider may locate a manifest, fetch the listed files, and supply
activity metadata. It no longer owns a second source parser or seed
materializer.

## Shared pipeline

`js/source-program-pipeline.js` is the shell entry point for manifest-backed
programs. It performs these steps in order:

1. validate the manifest and its exercise filenames;
2. normalize file text and remove leading `@codescope` metadata;
3. read contextual `@seed` directives;
4. retain the authored template and materialize authored or seeded values;
5. call `coreParseProgram()` once; and
6. expose canonical Program IR, diagnostics, source lines, and statements by
   source line.

Variables absent from `@seed` remain authored. Seed directives remain local to
the exercise file, so a content provider does not decide meaningful ranges for
an unrelated program. Numeric ranges accept an optional positive `step`; the
shared materializer chooses only values in the `min + n × step` sequence, so
the same authored scale applies to every source-file activity.

## Provider boundary

Program Output, Code Simulator, and Simulate Output use the shared pipeline for
their sourced programs. Simulate Output derives expected terminal output and
final mutable memory from the canonical effects and Program IR produced by that
pipeline. Its source files contain no authored answer key, and a core diagnostic
rejects the exercise rather than allowing a partial generated answer.

The providers may still build activity-specific runtime and presentation data
from canonical statements. Moving those remaining responsibilities into
presentation plugins belongs to Phase 6.

## Regression coverage

The Phase 5 checks cover manifest traversal and duplicate rejection, metadata
removal, authored versus seeded source, retained templates, canonical statement
kinds, diagnostics, and provider use of the shared entry point. The Phase 0
baseline and complete compatibility suite remain release gates.
