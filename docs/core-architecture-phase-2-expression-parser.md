# Core architecture migration: Phase 2 shared expression parser

Phase 2 moves expression grammar into the app shell. C and Java source-backed
activities now call one registered `parseExpression` service and receive
canonical Program IR.

## Supported shared grammar

- integer, floating-point, Boolean and character literals;
- variables and constants from a supplied symbol table;
- parentheses;
- arithmetic, relational and Boolean binary operators;
- logical prefix `!`;
- prefix and postfix `++` and `--`;
- existing precedence and left-associativity rules.

The parser distinguishes the prefix and postfix forms in IR. Mutation effects
will be committed by the shared evaluator in Phase 3; this phase establishes
recognition and canonical structure.

## Compatibility adapter

Existing timelines still consume the original engine-tree representation.
`coreExpressionIrToEngineTree()` adapts canonical IR to that representation at
the boundary. This keeps active rendering, scoring and persistence unchanged
while removing grammar ownership from activity plugins.

`plugins/program-output/content.js` and `plugins/code-simulator/content.js`
retain thin compatibility functions, but neither contains an expression
tokenizer or precedence parser.

## Equivalence gate

The compatibility suite verifies that generated and C/Java sourced versions
of this expression produce equivalent normalized IR:

```c
++p + q++
```

It also verifies the existing canonical interaction sequence, value `9` for
`p = 4` and `q = 4`, precedence, character literals, immutable unary rejection
and uninitialized identifier diagnostics.
