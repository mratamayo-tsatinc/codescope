# Code Completion profiles

Code Completion presents a complete seeded source exercise with profile-selected
fragments removed. Students edit those fragments, run the resulting program
through the shared language core, and reproduce the visible target output,
selected final variables, or both. The model source remains hidden while its
observable target state stays visible.

The activity reuses Code Ordering's public program-playback capability for
statement transitions, memory and terminal trails, playback controls, and the
program-flow overlay. Parsing and execution remain owned by the language core.

## Focused profile example

```json
{
  "scoring": {"itemCount": 6, "pointsPerItem": "generated-answer"},
  "content": {"values": {"variables": "seeded", "input": "seeded"}},
  "activity": {
    "kind": "code-completion",
    "instructions": "Complete the loop update and reproduce the target state.",
    "generator": {
      "library": "source-programs",
      "exerciseSet": "loop-completion-basics",
      "shuffle": true
    },
    "completion": {"targets": [{"role": "loop-update"}]},
    "assessment": {
      "equivalence": {
        "output": {"required": true, "showTarget": true},
        "memory": {"required": true, "showTarget": true, "variables": {"select": "loop-control"}}
      }
    },
    "execution": {"loopGuard": {"maxIterations": 16, "detectCycles": true}}
  },
  "presentation": {"flowTrail": true}
}
```

Supported completion roles are `loop-initializer-value`,
`loop-condition-operator`, `loop-condition-boundary`, `loop-condition`, and
`loop-update`. Keep one role per focused profile; combine roles only for an
integrated challenge.

Code Completion uses its own `loop-completion-basics` exercise set. The C and
Java manifests contain parallel completion-specific source programs, keeping
existing activity exercise files and their manifests unchanged.

The target output is exact terminal-screen state. Memory assessment can select
the inferred `loop-control` variable, allowing source programs to use names
such as `i`, `count`, or `number` without profile-specific variable names.

Execution is exploratory. Syntax/runtime diagnostics and guarded loops do not
lock the item. Cycle detection reports a repeated program state; the iteration
budget reports only that the program did not terminate within the configured
limit. Students can revise and run again, and Check becomes available only
after playback reaches the end of an attempt.
