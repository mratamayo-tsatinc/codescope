let tcTokenSequence=0;
function tcToken(text,role,statementId,position,extra){return Object.assign({id:`tc-token-${++tcTokenSequence}`,text:String(text),role,statementId,position,category:null},extra||{});}
function tcPick(list){return list[Math.floor(seededRandom()*list.length)];}
function tcGenerateIdentifierForCategory({language,category,position,configuration,generationContext,itemUsed}){
  const rules=tcLanguage(language),resolved=tcIdentifierGenerationConfig(configuration,rules);
  const used=tcGenerationUsedSet(generationContext,resolved.uniqueness.scope,itemUsed);
  const propose=requireUnique=>{
    const candidate=tcProposeIdentifierCandidate({language,intent:category,configuration});
    const analysis=tcAnalyzeIdentifierText(candidate.text,language,{role:'word',position});
    if(analysis.contextualCategory!==category||!tcIdentifierLengthAllowed(candidate.text,resolved)||(requireUnique&&used.has(candidate.text)))return null;
    used.add(candidate.text);
    return {text:candidate.text,generation:candidate,analysis};
  };
  for(let attempt=0;attempt<resolved.maxAttempts;attempt++){
    const accepted=propose(true);if(accepted)return accepted;
  }
  if(resolved.uniqueness.reuse==='avoid-until-exhausted'){
    for(let attempt=0;attempt<resolved.maxAttempts;attempt++){
      const accepted=propose(false);if(accepted)return accepted;
    }
  }
  throw new Error(`Unable to generate a unique ${category} for ${language} after ${resolved.maxAttempts} attempts`);
}
function tcLiteralFor(type){
  if(type==='boolean')return tcPick(['true','false']);
  if(type==='char')return tcPick(["'A'","'x'","'7'"]);
  if(type==='float'||type==='double')return `${randInt(1,20)}.${randInt(0,9)}`;
  return String(randInt(1,99));
}
function tcDeclaration(language,index,forceConstant,configuration,generationContext,itemUsed){
  const rules=tcLanguage(language),constant=forceConstant==null?seededRandom()<.35:forceConstant;
  const type=tcPick(language==='java'?['int','double','boolean','char']:['int','double','char','float']);
  const desiredCategory=seededRandom()<1/3?'valid-identifier':'invalid-identifier';
  const generated=tcGenerateIdentifierForCategory({language,category:desiredCategory,position:'declaration-name',configuration,generationContext,itemUsed});
  const name=generated.text,id=`stmt-${index+1}`,tokens=[];
  if(constant)tokens.push(tcToken(rules.constantKeyword,'word',id,'modifier'));
  tokens.push(tcToken(type,'word',id,'type'),tcToken(name,'word',id,'declaration-name',{generation:generated.generation}),
    tcToken('=','operator',id,'operator'),tcToken(tcLiteralFor(type),'literal',id,'literal'),tcToken(';','separator',id,'separator'));
  return {id,kind:'declaration',constant,name,tokens};
}
function tcAssignment(language,index,names){
  const id=`stmt-${index+1}`,left=tcPick(names);
  const right=seededRandom()<.5?tcPick(names):tcLiteralFor('int');
  const rightRole=/^(?:\d|['\"]|true$|false$)/.test(right)?'literal':'word';
  return {id,kind:'assignment',tokens:[tcToken(left,'word',id,'assignment-target'),tcToken(tcPick(['=','+=','-=','*=']),'operator',id,'operator'),
    tcToken(right,rightRole,id,'assignment-source'),tcToken(';','separator',id,'separator')]};
}
const TC_GENERATORS=Object.freeze({
  'statement-generator':({config,language,generationContext})=>{
    const itemUsed=new Set(),identifierGeneration=config.identifierGeneration||{};
    if(config.pattern==='statement-chain'){
      const first=tcDeclaration(language,0,false,identifierGeneration,generationContext,itemUsed);
      const second=tcDeclaration(language,1,true,identifierGeneration,generationContext,itemUsed);
      return [first,second,tcAssignment(language,2,[first.name,second.name]),tcAssignment(language,3,[first.name,second.name])];
    }
    return [tcDeclaration(language,0,null,identifierGeneration,generationContext,itemUsed)];
  }
});
function tcMatches(token,statement,match){
  if(!match)return true;
  if(match.source&&match.source!=='all')return false;
  if(Array.isArray(match.positions)&&!match.positions.includes(token.position))return false;
  if(Array.isArray(match.roles)&&!match.roles.includes(token.role))return false;
  if(Array.isArray(match.statementKinds)&&!match.statementKinds.includes(statement.kind))return false;
  if(Array.isArray(match.categories)&&!match.categories.includes(token.contextualCategory))return false;
  return true;
}
function tcResolveSelector(selector,sets,statements,resolving){
  const all=statements.flatMap(statement=>statement.tokens.map(token=>({token,statement})));
  if(!selector)return [];
  if(selector.set){
    if(resolving.has(selector.set))throw new Error(`Circular token set '${selector.set}'`);
    const definition=sets[selector.set];if(!definition)throw new Error(`Unknown token set '${selector.set}'`);
    resolving.add(selector.set);const result=tcResolveSetDefinition(definition,sets,statements,resolving);resolving.delete(selector.set);return result;
  }
  if(selector.source==='all')return all.map(entry=>entry.token);
  const match=selector.match||selector;
  return all.filter(entry=>tcMatches(entry.token,entry.statement,match)).map(entry=>entry.token);
}
function tcResolveSetDefinition(definition,sets,statements,resolving){
  const include=definition.include||[definition.match?{match:definition.match}:{source:'all'}];
  const exclude=definition.exclude||[];
  const selected=new Map();
  include.forEach(selector=>tcResolveSelector(selector,sets,statements,resolving).forEach(token=>selected.set(token.id,token)));
  exclude.forEach(selector=>tcResolveSelector(selector,sets,statements,resolving).forEach(token=>selected.delete(token.id)));
  return [...selected.values()];
}
function tcResolveNamedSet(profile,setName,statements){
  const sets=profile.activity.sets||{};
  return tcResolveSelector({set:setName},sets,statements,new Set());
}
function tcGenerateItem({profile,index,language,generationContext}){
  const selectedLanguage=language==='c'?'c':'java',config=profile.activity.generator;
  const generator=TC_GENERATORS[config.capability];if(!generator)throw new Error(`Unknown token generator '${config.capability}'`);
  const statements=generator({config,language:selectedLanguage,generationContext:generationContext||{}});
  statements.flatMap(statement=>statement.tokens).forEach(token=>tcAnalyzeToken(token,selectedLanguage));
  const targets=tcResolveNamedSet(profile,profile.activity.assessment.targets.set,statements);
  return {activityKind:TOKEN_CLASSIFICATION_MANIFEST.id,profileId:profile.id,itemNumber:index+1,language:selectedLanguage,
    statements,targetIds:targets.map(token=>token.id),responses:[],checkResults:[],history:[],checked:false,itemScore:null,points:null,maxPoints:null,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,showSolution:false,playback:null,flagged:false,lockedAt:null,examActionLog:[],invalidSelection:null};
}
