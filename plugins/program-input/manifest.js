const PROGRAM_INPUT_PLUGIN_MANIFEST=Object.freeze({
  id:'program-input',version:'2.0.0',statementKind:'input',
  semanticOwner:'language-core',
  responsibilities:Object.freeze(['metadata-adapter','interaction','presentation','feedback','scoring']),
  languages:Object.freeze(['c','java']),
  capabilities:Object.freeze(['timeline-presentation','seeded-input-adapter','input-console-playback','numeric-keyboard'])
});
