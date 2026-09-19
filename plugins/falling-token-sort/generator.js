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
  if(Number.isInteger(rule.target))return rule.target;
  return ftsRandomInt(rule.min,rule.max);
}

function ftsCountBounds(rule){
  const exact=Number.isInteger(rule)?rule:rule?.exact??(
    rule?.min===undefined&&rule?.max===undefined?rule?.target:undefined);
  return Number.isInteger(exact)?{min:exact,max:exact}:{min:rule.min,max:rule.max};
}

function ftsResolveTokenCounts(policy,buckets){
  const categories=buckets.map(bucket=>bucket.category);
  const limits=Object.fromEntries(categories.map(category=>[category,ftsCountBounds(policy.counts[category])]));
  const counts=Object.fromEntries(categories.map(category=>[category,limits[category].min]));
  const target=ftsResolveCount(policy.totalTokens);
  let remaining=target-Object.values(counts).reduce((sum,count)=>sum+count,0);
  while(remaining>0){
    const available=categories.filter(category=>counts[category]<limits[category].max);
    if(!available.length)throw new Error(`Cannot allocate ${target} tokens within category count limits`);
    counts[available[Math.floor(seededRandom()*available.length)]]++;
    remaining--;
  }
  return {target,counts};
}

// Non-identifier categories remain finite canonical vocabularies. Identifier
// text is proposed procedurally and accepted only after canonical analysis.
function ftsConfiguredPool(profile,category,language){
  const configured=profile&&profile.activity&&profile.activity.generator
    &&profile.activity.generator.tokenPools&&profile.activity.generator.tokenPools[category];
  if(Array.isArray(configured))return configured.slice();
  if(configured&&typeof configured==='object'){
    const selected=configured[language]||configured.default;
    if(Array.isArray(selected))return selected.slice();
  }
  return [];
}

function ftsStaticPool(category,profile,language){
  const configured=ftsConfiguredPool(profile,category,language);
  if(configured.length)return configured;
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

function ftsGenerateCategoryTokens(category,count,language,configuration,generationContext,itemUsed,profile){
  if(ftsIdentifierCategory(category))return ftsGenerateIdentifierTokens(category,count,language,configuration,generationContext,itemUsed);
  const pool=ftsShuffle(ftsStaticPool(category,profile,language));
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
  const tokens=[],itemUsed=new Set(),identifierGeneration=profile.activity.generator.identifierGeneration||{};
  const {target,counts}=ftsResolveTokenCounts(policy,profile.activity.buckets);
  profile.activity.buckets.forEach(bucket=>{
    const count=counts[bucket.category];
    tokens.push(...ftsGenerateCategoryTokens(bucket.category,count,languageSnapshot,identifierGeneration,generationContext||{},itemUsed,profile));
  });
  const orderedTokens=policy.shuffle===false?tokens:ftsShuffle(tokens);
  return {
    activityKind:FALLING_TOKEN_SORT_MANIFEST.id,
    profileId:profile.id,
    itemNumber:index+1,
    language:languageSnapshot,
    generationMode:modeSnapshot,
    generatedTokenTarget:target,
    generatedCounts:counts,
    tokens:orderedTokens,
    cursor:0,
    selectedTokenId:null,
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
