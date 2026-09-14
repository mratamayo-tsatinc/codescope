let ftsTokenSequence=0;

function ftsGenerationPolicy(profile,mode){
  const policies=profile.activity.generator.policies||{};
  const policy=policies[mode]||policies.default;
  if(!policy)throw new Error(`${profile.id}: no token-generation policy for '${mode}'`);
  return policy;
}

function ftsRandomInt(min,max){return min+Math.floor(seededRandom()*(max-min+1));}
function ftsShuffle(values){
  const copy=values.slice();
  for(let index=copy.length-1;index>0;index--){
    const swapIndex=Math.floor(seededRandom()*(index+1));
    [copy[index],copy[swapIndex]]=[copy[swapIndex],copy[index]];
  }
  return copy;
}

function ftsResolveCount(rule){
  if(Number.isInteger(rule))return rule;
  if(Number.isInteger(rule.exact))return rule.exact;
  return ftsRandomInt(rule.min,rule.max);
}

// The token-classification dependency remains the source of language rules
// and identifier/keyword examples. Other canonical categories are exposed so
// future profiles can compose them without changing this generator.
function ftsCanonicalPool(category,language){
  const rules=tcLanguage(language);
  const pools={
    'valid-identifier':rules.validNames,
    'invalid-identifier':rules.invalidNames,
    'reserved-word':rules.reservedNames,
    operator:['=','+=','-=','*=','/=','%=','==','&&','||'],
    literal:['0','7','42','3.14',"'A'",'true','false'],
    separator:[';',',','(',')','{','}']
  };
  return (pools[category]||[]).slice();
}

function ftsGenerateCategoryTokens(category,count,language){
  const pool=ftsShuffle(ftsCanonicalPool(category,language));
  if(!pool.length)throw new Error(`No canonical token pool for '${category}'`);
  const tokens=[];
  for(let index=0;index<count;index++){
    tokens.push({
      id:`fts-token-${++ftsTokenSequence}`,
      text:String(pool[index%pool.length]),
      category,
      language
    });
  }
  return tokens;
}

function ftsGenerateItem({profile,index,language}){
  const languageSnapshot=language==='c'?'c':'java';
  const modeSnapshot=state.mode==='exam'?'exam':'practice';
  const policy=ftsGenerationPolicy(profile,modeSnapshot);
  const tokens=[],counts={};
  profile.activity.buckets.forEach(bucket=>{
    const count=ftsResolveCount(policy.counts[bucket.category]);
    counts[bucket.category]=count;
    tokens.push(...ftsGenerateCategoryTokens(bucket.category,count,languageSnapshot));
  });
  const orderedTokens=policy.shuffle===false?tokens:ftsShuffle(tokens);
  return {
    activityKind:FALLING_TOKEN_SORT_MANIFEST.id,
    profileId:profile.id,
    itemNumber:index+1,
    language:languageSnapshot,
    generationMode:modeSnapshot,
    generatedCounts:counts,
    tokens:orderedTokens,
    cursor:0,
    placements:[],
    attempts:[],
    scoreResults:[],
    history:[],
    nextAttemptNumber:1,
    bucketCounts:Object.fromEntries(profile.activity.buckets.map(bucket=>[bucket.id,0])),
    lastResult:null,
    phase:'generated',
    checked:false,itemScore:null,points:null,maxPoints:null,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,
    showSolution:false,flagged:false,lockedAt:null,examActionLog:[]
  };
}
