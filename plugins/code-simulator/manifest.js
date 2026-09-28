const CODE_SIMULATOR_PLUGIN_MANIFEST=Object.freeze({
  id:'code-simulator',version:'2.1.0',statementKind:'source-program',
  languages:Object.freeze(['c','java']),
  dependencies:Object.freeze(['program-output:source-output-parsing','program-input:source-input-parsing']),
  capabilities:Object.freeze(['declaration','assignment','unary-update','input','output','if','if-else','if-else-if',
    'switch-case','break','switch-fall-through','return','source-flow','source-value-seeding','statement-trace-modal'])
});
