function tcAllTokens(item){return item.statements.flatMap(statement=>statement.tokens);}
function tcTokenById(item,id){return tcAllTokens(item).find(token=>token.id===id)||null;}
function tcResponseFor(item,id){return item.responses.find(response=>response.tokenId===id)||null;}
function tcInteractionKey(state){
  const interaction=state.mode==='practice'?activePracticePolicy().interactionMode:activeExamPolicy().interactionMode;
  return `${state.mode}:${interaction}`;
}
function tcInteractionPolicy(profile,state){
  const policies=profile.activity.interaction.policies||{};
  return policies[tcInteractionKey(state)]||policies.default||{selectable:{include:[{set:profile.activity.assessment.targets.set}],exclude:[]},onOffTarget:'ignore'};
}
function tcResolveSelectionRule(rule,profile,item){
  const selected=new Map(),sets=profile.activity.sets||{};
  (rule.include||[]).forEach(selector=>tcResolveSelector(selector,sets,item.statements,new Set()).forEach(token=>selected.set(token.id,token)));
  (rule.exclude||[]).forEach(selector=>tcResolveSelector(selector,sets,item.statements,new Set()).forEach(token=>selected.delete(token.id)));
  return [...selected.values()];
}
function tcSelectableIds(item,profile){return tcResolveSelectionRule(tcInteractionPolicy(profile,state).selectable||{},profile,item).map(token=>token.id);}
function tcAssessmentChecks(profile,actionType){return (profile.activity.assessment.checks||[]).filter(check=>check.action===actionType);}
function tcCheckKey(check,token){return check.cardinality==='once'?check.id:`${check.id}:${token.id}`;}
function tcRecordActionChecks(item,profile,actionType,token,response){
  tcAssessmentChecks(profile,actionType).forEach(check=>{
    const targetIds=tcResolveSelector(check.targets,profile.activity.sets,item.statements,new Set()).map(candidate=>candidate.id);
    if(!targetIds.includes(token.id))return;
    const key=tcCheckKey(check,token);if(item.checkResults.some(result=>result.key===key))return;
    const expected=actionType==='CLASSIFY_TOKEN'?tcResolveAnswer(check.answerResolver,{token,item,profile}):true;
    const actual=actionType==='CLASSIFY_TOKEN'?response.category:true;
    item.checkResults.push({key,checkId:check.id,tokenId:token.id,action:actionType,expected,actual,
      wasCorrect:actual===expected,weight:Number(check.weight)||1,bonus:!!check.bonus});
  });
}
function tcAssessmentUnits(item,profile){
  const units=[];
  (profile.activity.assessment.checks||[]).forEach(check=>{
    const tokens=tcResolveSelector(check.targets,profile.activity.sets,item.statements,new Set());
    if(check.cardinality==='once')units.push({key:check.id,weight:Number(check.weight)||1,bonus:!!check.bonus});
    else tokens.forEach(token=>units.push({key:`${check.id}:${token.id}`,weight:Number(check.weight)||1,bonus:!!check.bonus}));
  });
  return units;
}
function tcScoreCurrent(item,profile){
  const units=tcAssessmentUnits(item,profile),totalWeight=units.reduce((sum,unit)=>sum+unit.weight,0);
  const earnedWeight=units.reduce((sum,unit)=>{const result=item.checkResults.find(candidate=>candidate.key===unit.key);return sum+(result&&result.wasCorrect?unit.weight:0);},0);
  return {correct:item.checkResults.filter(result=>result.wasCorrect).length,total:units.length,
    points:roundPoints(totalWeight?profile.pointsPerItem*(earnedWeight/totalWeight):0),maxPoints:profile.pointsPerItem};
}
function tcTerminateItem(item,profile,token){
  const score=tcScoreCurrent(item,profile);
  item.invalidSelection={tokenId:token.id,reason:'off-target',terminal:true,timestamp:Date.now()};
  item.checked=true;item.lockedAt=Date.now();item.flagged=false;item.showSolution=false;
  item.correctSteps=score.correct;item.totalOpSteps=score.total;item.wasCorrectFinal=false;
  item.points=score.points;item.maxPoints=score.maxPoints;item.itemScore=score.maxPoints?score.points/score.maxPoints:0;
  item.examSequenceFailure={reason:'off-target-token',terminal:true,timestamp:Date.now(),tokenId:token.id,
    correctPrefixChecks:score.correct,totalChecks:score.total};
  return {applied:true,terminal:true};
}
function tcApplyOffTarget(item,profile,token){
  const outcome=tcInteractionPolicy(profile,state).onOffTarget||'ignore';
  if(outcome==='terminate-item')return tcTerminateItem(item,profile,token);
  if(outcome==='block-until-undo'||outcome==='warn'){
    item.invalidSelection={tokenId:token.id,reason:'off-target',terminal:false,timestamp:Date.now()};
    item.history.push({type:'invalid-selection',tokenId:token.id});return {applied:true,blocked:outcome==='block-until-undo'};
  }
  return {applied:false,reason:'off-target'};
}
function tcApplyAction({item,profile,action,state}){
  if(!item||item.checked||item.invalidSelection||!action)return {applied:false};
  const token=tcTokenById(item,action.tokenId);
  if(!token||!tcSelectableIds(item,profile).includes(token.id))return {applied:false,reason:'not-selectable'};
  if(!item.targetIds.includes(token.id))return tcApplyOffTarget(item,profile,token);
  if(action.type==='SELECT_TOKEN'){
    const before=item.checkResults.length;tcRecordActionChecks(item,profile,'SELECT_TOKEN',token,null);
    if(item.checkResults.length>before)item.history.push({type:'selection-check',tokenId:token.id});
    return {applied:true,token};
  }
  if(action.type!=='CLASSIFY_TOKEN')return {applied:false};
  if(!profile.activity.response.categories.includes(action.category))return {applied:false,reason:'category-not-offered'};
  const classificationCheck=tcAssessmentChecks(profile,'CLASSIFY_TOKEN').find(check=>
    tcResolveSelector(check.targets,profile.activity.sets,item.statements,new Set()).some(candidate=>candidate.id===token.id));
  if(!classificationCheck)return {applied:false,reason:'no-classification-check'};
  const expected=tcResolveAnswer(classificationCheck.answerResolver,{token,item,profile});
  const previous=tcResponseFor(item,token.id),previousResponse=previous?Object.assign({},previous):null;
  const previousChecks=item.checkResults.filter(result=>result.action==='CLASSIFY_TOKEN'&&result.tokenId===token.id).map(result=>Object.assign({},result));
  item.responses=item.responses.filter(candidate=>candidate.tokenId!==token.id);
  item.checkResults=item.checkResults.filter(result=>!(result.action==='CLASSIFY_TOKEN'&&result.tokenId===token.id));
  const response={tokenId:token.id,category:action.category,expectedCategory:expected,wasCorrect:action.category===expected,timestamp:Date.now(),required:true};
  item.responses.push(response);tcRecordActionChecks(item,profile,'CLASSIFY_TOKEN',token,response);
  item.history.push({type:'classification',tokenId:token.id,previousResponse,previousChecks});item.invalidSelection=null;
  if(state.mode==='exam')item.examActionLog.push({type:'classify-token',tokenId:token.id,category:action.category,wasCorrect:response.wasCorrect,timestamp:Date.now()});
  return {applied:true,response};
}
function tcUndo({item}){
  if(!item||item.checked||!item.history.length)return {applied:false};
  const last=item.history.pop();
  if(last.type==='classification'){
    item.responses=item.responses.filter(response=>response.tokenId!==last.tokenId);
    item.checkResults=item.checkResults.filter(result=>!(result.action==='CLASSIFY_TOKEN'&&result.tokenId===last.tokenId));
    if(last.previousResponse)item.responses.push(last.previousResponse);
    if(last.previousChecks)item.checkResults.push(...last.previousChecks);
  }
  if(last.type==='selection-check')item.checkResults=item.checkResults.filter(result=>!(result.action==='SELECT_TOKEN'&&result.tokenId===last.tokenId));
  if(last.type==='invalid-selection')item.invalidSelection=null;
  return {applied:true};
}
function tcReset({item}){const applied=!!(item.responses.length||item.checkResults.length||item.history.length||item.invalidSelection);item.responses=[];item.checkResults=[];item.history=[];item.invalidSelection=null;item.showSolution=false;return {applied};}
function tcRetry({item}){
  if(!item||!item.checked)return {applied:false};
  item.responses=[];item.checkResults=[];item.history=[];item.invalidSelection=null;item.showSolution=false;
  item.checked=false;item.itemScore=null;item.points=null;item.maxPoints=null;item.correctSteps=0;item.totalOpSteps=0;item.wasCorrectFinal=null;item.lockedAt=null;
  return {applied:true,resetAttempt:true};
}
function tcCheck({item,profile}){
  if(item.checked)return {applied:false};
  if(item.targetIds.some(id=>!tcResponseFor(item,id)))return {applied:false,reason:'incomplete'};
  item.checkResults=[];
  item.targetIds.forEach(id=>{
    const token=tcTokenById(item,id),response=tcResponseFor(item,id);
    const classificationCheck=tcAssessmentChecks(profile,'CLASSIFY_TOKEN').find(check=>
      tcResolveSelector(check.targets,profile.activity.sets,item.statements,new Set()).some(candidate=>candidate.id===token.id));
    if(classificationCheck){response.expectedCategory=tcResolveAnswer(classificationCheck.answerResolver,{token,item,profile});response.wasCorrect=response.category===response.expectedCategory;}
    tcRecordActionChecks(item,profile,'SELECT_TOKEN',token,null);
    tcRecordActionChecks(item,profile,'CLASSIFY_TOKEN',token,response);
  });
  const score=tcScoreCurrent(item,profile);
  item.checked=true;item.correctSteps=score.correct;item.totalOpSteps=score.total;item.wasCorrectFinal=score.correct===score.total;
  item.points=score.points;item.maxPoints=score.maxPoints;item.itemScore=score.maxPoints?score.points/score.maxPoints:0;item.lockedAt=state.mode==='exam'?Date.now():null;
  return {applied:true,completed:true};
}
