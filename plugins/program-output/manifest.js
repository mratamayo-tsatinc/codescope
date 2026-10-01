const PROGRAM_OUTPUT_PLUGIN_MANIFEST=Object.freeze({
  id:'program-output',
  version:'2.0.0',
  statementKind:'output',
  semanticOwner:'language-core',
  responsibilities:Object.freeze(['content-adapter','interaction','presentation','feedback','scoring']),
  languages:Object.freeze(['c','java']),
  capabilities:Object.freeze(['console-playback','timeline-presentation','generated-content-adapter',
    'source-content-adapter','order-independent-output-interaction','source-flow'])
});
