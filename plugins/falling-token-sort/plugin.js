function ftsValidateCountRule(profile,category,rule,path){
  if(Number.isInteger(rule)&&rule>0)return;
  if(!rule||typeof rule!=='object')throw new Error(`${profile.id}: ${path}.${category} must be a count rule`);
  if(Number.isInteger(rule.exact)&&rule.exact>0)return;
  if(!Number.isInteger(rule.min)||!Number.isInteger(rule.max)||rule.min<1||rule.max<rule.min)
    throw new Error(`${profile.id}: ${path}.${category} requires exact or valid min/max values`);
}
function ftsValidateProfile(profile){
  const activity=profile.activity;
  if(!activity||!Array.isArray(activity.buckets)||!activity.buckets.length)throw new Error(`${profile.id}: buckets are required`);
  if(!activity.generator||activity.generator.capability!=='canonical-token-pools')
    throw new Error(`${profile.id}: unknown generator capability '${activity.generator&&activity.generator.capability}'`);
  if(!activity.dropArea||!Number.isInteger(activity.dropArea.visibleTokens)||activity.dropArea.visibleTokens<1)
    throw new Error(`${profile.id}: dropArea.visibleTokens must be a positive integer`);
  if(activity.dropArea.visibleTokens!==1)throw new Error(`${profile.id}: version 1 supports one visible token; multi-token selection is reserved for a later capability`);
  const ids=new Set(),categories=new Set();
  activity.buckets.forEach(bucket=>{
    if(!bucket.id||ids.has(bucket.id))throw new Error(`${profile.id}: bucket ids must be unique`);ids.add(bucket.id);
    if(!TC_CATEGORY_DEFS[bucket.category])throw new Error(`${profile.id}: unknown category '${bucket.category}'`);
    if(categories.has(bucket.category))throw new Error(`${profile.id}: duplicate category bucket '${bucket.category}'`);categories.add(bucket.category);
    if(!['left','right','top','bottom'].includes(bucket.region))throw new Error(`${profile.id}: invalid bucket region '${bucket.region}'`);
    if(!Number.isFinite(bucket.order))throw new Error(`${profile.id}: bucket order is required`);
    if(!ftsCanonicalPool(bucket.category,'java').length||!ftsCanonicalPool(bucket.category,'c').length)
      throw new Error(`${profile.id}: category '${bucket.category}' has no canonical language pool`);
  });
  const policies=activity.generator&&activity.generator.policies;
  if(!policies||!policies.practice||!policies.exam)throw new Error(`${profile.id}: Practice and Exam generator policies are required`);
  Object.entries(policies).forEach(([mode,policy])=>{
    if(!policy.counts)throw new Error(`${profile.id}: ${mode}.counts is required`);
    categories.forEach(category=>ftsValidateCountRule(profile,category,policy.counts[category],`${mode}.counts`));
  });
  if(!activity.assessment||activity.assessment.action!=='SORT_TOKEN'||activity.assessment.cardinality!=='per-token')
    throw new Error(`${profile.id}: assessment must score SORT_TOKEN per token`);
  if(!['first','latest'].includes(activity.assessment.scoreAttempt))throw new Error(`${profile.id}: unsupported scoreAttempt`);
  if(activity.assessment.completion!=='all-tokens-placed')throw new Error(`${profile.id}: unsupported completion policy`);
  const responsePolicies=activity.response&&activity.response.policies;
  if(!responsePolicies||!responsePolicies.practice||!responsePolicies.exam)throw new Error(`${profile.id}: Practice and Exam response policies are required`);
  Object.entries(responsePolicies).forEach(([mode,policy])=>{
    if(!['return-token','accept'].includes(policy.incorrectPlacement))
      throw new Error(`${profile.id}: invalid ${mode} incorrectPlacement policy`);
  });
  if(!activity.feedback||!['immediate-return','deferred'].includes(activity.feedback.practice)
    ||!['deferred-until-submit','never'].includes(activity.feedback.exam))
    throw new Error(`${profile.id}: invalid feedback policy`);
}

const fallingTokenSortPlugin=registerActivityPlugin({
  id:FALLING_TOKEN_SORT_MANIFEST.id,manifest:FALLING_TOKEN_SORT_MANIFEST,validateProfile:ftsValidateProfile,
  generateItem:ftsGenerateItem,render:ftsRender,
  applyAction:ftsApplyAction,check:ftsCheck,undo:ftsUndo,reset:ftsReset,retry:ftsRetry,
  buildConsoleContent:ftsBuildConsoleContent,buildFeedback:ftsBuildFeedback,
  hasAttempt({item}){return !!(item&&item.attempts&&item.attempts.length);}
});
