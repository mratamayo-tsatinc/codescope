const CODE_SIMULATOR_PLUGIN_MANIFEST=Object.freeze({
  id:'code-simulator',version:'3.0.0',statementKind:'source-program',
  semanticOwner:'language-core',
  responsibilities:Object.freeze(['content-adapter','interaction','presentation','feedback','scoring']),
  languages:Object.freeze(['c','java']),
  dependencies:Object.freeze(['language-core:output-statements','program-output:timeline-presentation',
    'language-core:input-statements','program-input:timeline-presentation','language-core:selection-statements']),
  capabilities:Object.freeze(['selection-timeline-presentation','source-flow','source-value-seeding',
    'statement-trace-modal','flow-highlighting','memory-console-presentation'])
});
