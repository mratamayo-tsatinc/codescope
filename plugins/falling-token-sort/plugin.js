function ftsValidateCountRule(profile,category,rule,path){
  if(Number.isInteger(rule)&&rule>0)return;
  if(!rule||typeof rule!=='object')throw new Error(`${profile.id}: ${path}.${category} must be a count rule`);
  if('exact' in rule){
    if(Number.isInteger(rule.exact)&&rule.exact>0)return;
    throw new Error(`${profile.id}: ${path}.${category}.exact must be a positive integer`);
  }
  if(!Number.isInteger(rule.min)||!Number.isInteger(rule.max)||rule.min<1||rule.max<rule.min)
    throw new Error(`${profile.id}: ${path}.${category} requires exact or valid min/max values`);
}
function ftsValidateTotalRule(profile,mode,rule){
  if(rule&&typeof rule==='object'&&'target' in rule
    &&!('min' in rule)&&!('max' in rule)&&!('exact' in rule)){
    if(Number.isInteger(rule.target)&&rule.target>0)return;
    throw new Error(`${profile.id}: ${mode}.totalTokens.target must be a positive integer`);
  }
  ftsValidateCountRule(profile,'totalTokens',rule,mode);
}
function ftsValidateProfile(profile){
  const activity=profile.activity;
  if(!activity||!Array.isArray(activity.buckets)||!activity.buckets.length)throw new Error(`${profile.id}: buckets are required`);
  if(!activity.generator||!['analyzed-token-generation','canonical-token-pools'].includes(activity.generator.capability))
    throw new Error(`${profile.id}: unknown generator capability '${activity.generator&&activity.generator.capability}'`);
  if(!activity.dropArea||!Number.isInteger(activity.dropArea.visibleTokens)||activity.dropArea.visibleTokens<1)
    throw new Error(`${profile.id}: dropArea.visibleTokens must be a positive integer`);
  if(activity.dropArea.landingBehavior!==undefined
    &&!['stack','pass-through'].includes(activity.dropArea.landingBehavior))
    throw new Error(`${profile.id}: dropArea.landingBehavior must be stack or pass-through`);
  const ids=new Set(),categories=new Set();
  activity.buckets.forEach(bucket=>{
    if(!bucket.id||ids.has(bucket.id))throw new Error(`${profile.id}: bucket ids must be unique`);ids.add(bucket.id);
    if(!TC_CATEGORY_DEFS[bucket.category])throw new Error(`${profile.id}: unknown category '${bucket.category}'`);
    if(categories.has(bucket.category))throw new Error(`${profile.id}: duplicate category bucket '${bucket.category}'`);categories.add(bucket.category);
    if(!['left','right','top','bottom'].includes(bucket.region))throw new Error(`${profile.id}: invalid bucket region '${bucket.region}'`);
    if(!Number.isFinite(bucket.order))throw new Error(`${profile.id}: bucket order is required`);
    if(!ftsIdentifierCategory(bucket.category)
      &&(!ftsStaticPool(bucket.category,profile,'c').length
        ||!ftsStaticPool(bucket.category,profile,'java').length))
      throw new Error(`${profile.id}: category '${bucket.category}' needs a canonical token source for C and Java`);
  });
  tcValidateIdentifierGeneration(profile,activity.generator.identifierGeneration,'activity.generator.identifierGeneration');
  const policies=activity.generator&&activity.generator.policies;
  if(!policies||!policies.practice||!policies.exam)throw new Error(`${profile.id}: Practice and Exam generator policies are required`);
  Object.entries(policies).forEach(([mode,policy])=>{
    if(!policy.counts)throw new Error(`${profile.id}: ${mode}.counts is required`);
    categories.forEach(category=>{
      const rule=policy.counts[category];
      ftsValidateCountRule(profile,category,rule,`${mode}.counts`);
      if(rule&&typeof rule==='object'&&'target' in rule)
        throw new Error(`${profile.id}: ${mode}.counts.${category}.target is only supported for totalTokens`);
    });
    ftsValidateTotalRule(profile,mode,policy.totalTokens);
    const bounds=[...categories].map(category=>ftsCountBounds(policy.counts[category]));
    const target=ftsCountBounds(policy.totalTokens);
    const fixedTarget=policy.totalTokens&&typeof policy.totalTokens==='object'?policy.totalTokens.target:undefined;
    if(fixedTarget!==undefined){
      if(!Number.isInteger(fixedTarget)||fixedTarget<target.min||fixedTarget>target.max
        ||'exact' in policy.totalTokens)
        throw new Error(`${profile.id}: ${mode}.totalTokens.target must be within min/max`);
      target.min=fixedTarget;target.max=fixedTarget;
    }
    const minimum=bounds.reduce((sum,rule)=>sum+rule.min,0);
    const maximum=bounds.reduce((sum,rule)=>sum+rule.max,0);
    if(target.min<minimum||target.max>maximum)
      throw new Error(`${profile.id}: ${mode}.totalTokens must stay within the category total ${minimum}-${maximum}`);
  });
  const tokenPools=activity.generator.tokenPools||{};
  Object.entries(tokenPools).forEach(([category,pool])=>{
    const variants=Array.isArray(pool)?[pool]:Object.values(pool||{});
    if(!TC_CATEGORY_DEFS[category]||!variants.length||variants.some(values=>!Array.isArray(values)||!values.length
      ||values.some(value=>typeof value!=='string'||!value.length)))
      throw new Error(`${profile.id}: tokenPools.${category} must contain non-empty token strings`);
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
    ||!['deferred-until-timeout','never'].includes(activity.feedback.exam))
    throw new Error(`${profile.id}: invalid feedback policy`);
}

const fallingTokenSortPlugin=registerActivityPlugin({
  id:FALLING_TOKEN_SORT_MANIFEST.id,manifest:FALLING_TOKEN_SORT_MANIFEST,validateProfile:ftsValidateProfile,
  generateItem:ftsGenerateItem,render:ftsRender,
  applyAction:ftsApplyAction,check:ftsCheck,undo:ftsUndo,reset:ftsReset,retry:ftsRetry,
  buildConsoleContent:ftsBuildConsoleContent,buildFeedback:ftsBuildFeedback,
  hasAttempt({item}){return !!(item&&item.attempts&&item.attempts.length);}
});
