const BUG_CATCHER_MANIFEST=Object.freeze({
  id:'bug-catcher',version:'1.0.0',semanticOwner:'source-programs',
  responsibilities:Object.freeze(['interaction','presentation','feedback','scoring']),
  dependencies:Object.freeze(['source-programs:exercise-library']),
  shellCapabilities:['profiles','console-drawer','feedback-drawer','exam-persistence']
});
