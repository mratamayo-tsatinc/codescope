const PROGRAM_INPUT_PLUGIN_MANIFEST=Object.freeze({
  id:'program-input',version:'2.1.0',statementKind:'input',
  semanticOwner:'language-core',
  responsibilities:Object.freeze(['metadata-adapter','interaction','presentation','feedback','scoring']),
  languages:Object.freeze(['c','java']),
  capabilities:Object.freeze(['timeline-presentation','seeded-input-adapter','typed-input',
    'input-console-playback','input-console-indicator','keyboard-indicator','persistent-enter-control'])
});
