const SIMULATE_OUTPUT_MANIFEST=Object.freeze({
  id:'simulate-output',version:'2.0.0',semanticOwner:'language-core',
  responsibilities:Object.freeze(['interaction','presentation','feedback','scoring']),
  dependencies:Object.freeze(['language-core:program-semantics','source-programs:exercise-library']),
  shellCapabilities:['profiles','console-drawer','feedback-drawer','exam-persistence']
});
