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

// Non-identifier categories remain finite canonical vocabularies. Identifier
// text is proposed procedurally and accepted only after canonical analysis.
function ftsStaticPool(category){
  const pools={
    operator:['=','+=','-=','*=','/=','%=','==','&&','||'],
    literal:['0','7','42','3.14',"'A'",'true','false'],
    separator:[';',',','(',')','{','}']
  };
  return (pools[category]||[]).slice();
}

function ftsIdentifierCategory(category){return ['valid-identifier','invalid-identifier','reserved-word'].includes(category);}

function ftsGenerateIdentifierTokens(category,count,language,configuration,generationContext,itemUsed){
  const resolved=tcIdentifierGenerationConfig(configuration,tcLanguage(language));
  const used=tcGenerationUsedSet(generationContext,resolved.uniqueness.scope,itemUsed),tokens=[];
  for(let index=0;index<count;index++){
    let accepted=null;
    for(let attempt=0;attempt<resolved.maxAttempts;attempt++){
      const candidate=tcProposeIdentifierCandidate({language,intent:category,configuration});
      const analysis=tcAnalyzeIdentifierText(candidate.text,language,{role:'word',position:'standalone'});
      if(analysis.lexicalCategory!==category||!tcIdentifierLengthAllowed(candidate.text,resolved)||used.has(candidate.text))continue;
      used.add(candidate.text);accepted={candidate,analysis};break;
    }
    if(!accepted&&resolved.uniqueness.reuse==='avoid-until-exhausted'){
      for(let attempt=0;attempt<resolved.maxAttempts;attempt++){
        const candidate=tcProposeIdentifierCandidate({language,intent:category,configuration});
        const analysis=tcAnalyzeIdentifierText(candidate.text,language,{role:'word',position:'standalone'});
        if(analysis.lexicalCategory!==category||!tcIdentifierLengthAllowed(candidate.text,resolved))continue;
        used.add(candidate.text);accepted={candidate,analysis};break;
      }
    }
    if(!accepted)throw new Error(`Unable to generate a unique ${category} for ${language} after ${resolved.maxAttempts} attempts`);
    tokens.push(Object.assign({
      id:`fts-token-${++ftsTokenSequence}`,
      text:accepted.candidate.text,
      category:accepted.analysis.lexicalCategory,
      language,
      role:'word',position:'standalone',generation:accepted.candidate
    },accepted.analysis));
  }
  return tokens;
}

function ftsGenerateCategoryTokens(category,count,language,configuration,generationContext,itemUsed){
  if(ftsIdentifierCategory(category))return ftsGenerateIdentifierTokens(category,count,language,configuration,generationContext,itemUsed);
  const pool=ftsShuffle(ftsStaticPool(category));
  if(!pool.length)throw new Error(`No canonical token source for '${category}'`);
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

function ftsGenerateItem({profile,index,language,generationContext}){
  const languageSnapshot=language==='c'?'c':'java';
  const modeSnapshot=state.mode==='exam'?'exam':'practice';
  const policy=ftsGenerationPolicy(profile,modeSnapshot);
  const tokens=[],counts={},itemUsed=new Set(),identifierGeneration=profile.activity.generator.identifierGeneration||{};
  profile.activity.buckets.forEach(bucket=>{
    const count=ftsResolveCount(policy.counts[bucket.category]);
    counts[bucket.category]=count;
    tokens.push(...ftsGenerateCategoryTokens(bucket.category,count,languageSnapshot,identifierGeneration,generationContext||{},itemUsed));
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
