function tcValidateSelector(profile,selector,path){
  if(!selector||typeof selector!=='object')throw new Error(`${profile.id}: ${path} must be a selector object`);
  if(selector.set&&!profile.activity.sets[selector.set])throw new Error(`${profile.id}: ${path} references unknown set '${selector.set}'`);
}
function tcValidateProfile(profile){
  const activity=profile.activity;
  if(!activity||!activity.generator||!activity.sets||!activity.interaction||!activity.assessment||!activity.response)
    throw new Error(`${profile.id}: incomplete token activity configuration`);
  if(!TC_GENERATORS[activity.generator.capability])throw new Error(`${profile.id}: unknown generator capability '${activity.generator.capability}'`);
  tcValidateIdentifierGeneration(profile,activity.generator.identifierGeneration,'activity.generator.identifierGeneration');
  const categories=activity.response.categories;
  if(!Array.isArray(categories)||!categories.length)throw new Error(`${profile.id}: response categories are required`);
  categories.forEach(category=>{if(!TC_CATEGORY_DEFS[category])throw new Error(`${profile.id}: unknown category '${category}'`);});
  tcValidateSelector(profile,activity.assessment.targets,'assessment.targets');
  if(!Array.isArray(activity.assessment.checks)||!activity.assessment.checks.length)throw new Error(`${profile.id}: assessment checks are required`);
  activity.assessment.checks.forEach((check,index)=>{
    if(check.action!=='SELECT_TOKEN'&&check.action!=='CLASSIFY_TOKEN')throw new Error(`${profile.id}: unsupported check action '${check.action}'`);
    tcValidateSelector(profile,check.targets,`assessment.checks[${index}].targets`);
    if(check.action==='CLASSIFY_TOKEN'&&!TC_ANSWER_RESOLVERS[check.answerResolver])throw new Error(`${profile.id}: unknown answer resolver '${check.answerResolver}'`);
  });
  Object.entries(activity.interaction.policies).forEach(([key,policy])=>{
    (policy.selectable.include||[]).forEach((selector,index)=>tcValidateSelector(profile,selector,`${key}.include[${index}]`));
    (policy.selectable.exclude||[]).forEach((selector,index)=>tcValidateSelector(profile,selector,`${key}.exclude[${index}]`));
    if(!['ignore','warn','block-until-undo','terminate-item'].includes(policy.onOffTarget))throw new Error(`${profile.id}: invalid onOffTarget '${policy.onOffTarget}'`);
  });
}
const tokenClassificationPlugin=registerActivityPlugin({
  id:TOKEN_CLASSIFICATION_MANIFEST.id,manifest:TOKEN_CLASSIFICATION_MANIFEST,validateProfile:tcValidateProfile,
  generateItem:tcGenerateItem,render:tcRender,applyAction:tcApplyAction,check:tcCheck,undo:tcUndo,reset:tcReset,retry:tcRetry,
  buildConsoleContent:tcBuildConsoleContent,buildFeedback:tcBuildFeedback,
  hasAttempt({item}){return !!(item.responses.length||item.checkResults.length||item.history.length||item.invalidSelection);},
  buildCanonicalTrace({item,profile}){
    const activeProfile=profile||PROFILES.find(candidate=>candidate.id===item.profileId);
    const check=tcAssessmentChecks(activeProfile,'CLASSIFY_TOKEN')[0];
    return item.targetIds.map(id=>{const token=tcTokenById(item,id),category=tcResolveAnswer(check.answerResolver,{token,item,profile:activeProfile});
      return {action:'CLASSIFY_TOKEN',tokenId:id,category,position:token.position,reason:tcReason(token,category,item.language)};});
  }
});
