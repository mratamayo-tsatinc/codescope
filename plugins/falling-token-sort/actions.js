function ftsRemainingTokens(item){
  if(!item)return [];
  const placed=new Set(item.placements.map(placement=>placement.tokenId));
  return item.tokens.filter(token=>!placed.has(token.id));
}
function ftsVisibleTokens(item,profile){
  return ftsRemainingTokens(item).slice(0,profile.activity.dropArea.visibleTokens);
}
function ftsCurrentToken(item,profile){
  if(!item||!profile)return null;
  const visible=ftsVisibleTokens(item,profile);
  return visible.find(token=>token.id===item.selectedTokenId)
    ||(profile.activity.dropArea.visibleTokens===1?visible[0]:null);
}
function ftsBucketById(profile,bucketId){return profile.activity.buckets.find(bucket=>bucket.id===bucketId)||null;}
function ftsScoreResult(item,tokenId){return item.scoreResults.find(result=>result.tokenId===tokenId)||null;}
function ftsAttemptById(item,attemptId){return item.attempts.find(attempt=>attempt.id===attemptId)||null;}

function ftsModeResponsePolicy(profile,mode){
  const policies=profile.activity.response&&profile.activity.response.policies||{};
  return policies[mode]||policies.default||{incorrectPlacement:'accept'};
}

function ftsRecordScoredAttempt(item,profile,attempt){
  const strategy=profile.activity.assessment.scoreAttempt||'first';
  const previous=ftsScoreResult(item,attempt.tokenId);
  if(strategy==='latest'){
    item.scoreResults=item.scoreResults.filter(result=>result.tokenId!==attempt.tokenId);
    item.scoreResults.push(attempt);
  }else if(!previous)item.scoreResults.push(attempt);
}

function ftsApplyAction({item,profile,action,state}){
  if(!item||item.checked||!action)return {applied:false};
  if(action.type==='SELECT_TOKEN'){
    if(profile.activity.dropArea.visibleTokens===1)return {applied:false};
    const token=ftsVisibleTokens(item,profile).find(candidate=>candidate.id===action.tokenId);
    if(!token)return {applied:false,reason:'invalid-target'};
    item.selectedTokenId=token.id;item.lastResult=null;
    return {applied:true,token};
  }
  if(action.type!=='SORT_TOKEN')return {applied:false};
  const token=ftsCurrentToken(item,profile),bucket=ftsBucketById(profile,action.bucketId);
  if(!token||!bucket)return {applied:false,reason:'invalid-target'};
  if(action.tokenId&&action.tokenId!==token.id)return {applied:false,reason:'invalid-target'};
  const wasCorrect=bucket.category===token.category;
  const attempt={
    id:`fts-attempt-${item.nextAttemptNumber++}`,
    tokenId:token.id,bucketId:bucket.id,category:bucket.category,
    expectedCategory:token.category,wasCorrect,timestamp:Date.now()
  };
  item.attempts.push(attempt);ftsRecordScoredAttempt(item,profile,attempt);
  const responsePolicy=ftsModeResponsePolicy(profile,state.mode);
  const accepted=wasCorrect||responsePolicy.incorrectPlacement==='accept';
  item.lastResult={attemptId:attempt.id,tokenId:token.id,bucketId:bucket.id,wasCorrect,accepted};
  item.history.push({type:accepted?'placement':'rejected',attemptId:attempt.id,tokenId:token.id,bucketId:bucket.id});
  if(accepted){
    item.placements.push({attemptId:attempt.id,tokenId:token.id,bucketId:bucket.id,category:bucket.category});
    item.bucketCounts[bucket.id]=(item.bucketCounts[bucket.id]||0)+1;
    item.cursor++;
    item.selectedTokenId=null;
  }
  if(state.mode==='exam')item.examActionLog.push({type:'sort-token',attemptId:attempt.id,tokenId:token.id,
    bucketId:bucket.id,wasCorrect,timestamp:attempt.timestamp});
  return {applied:true,token,bucket,attempt,wasCorrect,accepted};
}

function ftsUndo({item}){
  if(!item||item.checked||!item.history.length)return {applied:false};
  const last=item.history.pop(),attempt=ftsAttemptById(item,last.attemptId);
  if(last.type==='placement'){
    item.cursor=Math.max(0,item.cursor-1);
    item.placements=item.placements.filter(placement=>placement.attemptId!==last.attemptId);
    item.bucketCounts[last.bucketId]=Math.max(0,(item.bucketCounts[last.bucketId]||0)-1);
    item.selectedTokenId=last.tokenId;
  }
  item.attempts=item.attempts.filter(candidate=>candidate.id!==last.attemptId);
  item.scoreResults=item.scoreResults.filter(result=>result.id!==last.attemptId);
  item.examActionLog=item.examActionLog.filter(entry=>entry.attemptId!==last.attemptId);
  item.lastResult=null;
  return {applied:true,attempt};
}

function ftsClearAttempt(item){
  item.cursor=0;item.placements=[];item.attempts=[];item.scoreResults=[];item.history=[];
  item.nextAttemptNumber=1;item.lastResult=null;item.showSolution=false;item.selectedTokenId=null;
  Object.keys(item.bucketCounts).forEach(bucketId=>{item.bucketCounts[bucketId]=0;});
  item.examActionLog=[];
  if(typeof ftsResetLandingAnimation==='function')ftsResetLandingAnimation(item);
}

function ftsReset({item}){
  if(!item||item.checked)return {applied:false};
  const changed=!!(item.cursor||item.selectedTokenId||item.attempts.length||item.history.length);
  ftsClearAttempt(item);return {applied:changed};
}

function ftsRetry({item}){
  if(!item||!item.checked)return {applied:false};
  ftsClearAttempt(item);item.checked=false;item.itemScore=null;item.points=null;item.maxPoints=null;
  item.correctSteps=0;item.totalOpSteps=0;item.wasCorrectFinal=null;item.lockedAt=null;
  return {applied:true,resetAttempt:true};
}

function ftsCheck({item,profile,state}){
  if(!item||item.checked)return {applied:false};
  if(item.cursor<item.tokens.length)return {applied:false,reason:'incomplete'};
  const total=item.tokens.length,correct=item.scoreResults.filter(result=>result.wasCorrect).length;
  const points=roundPoints(total?profile.pointsPerItem*(correct/total):0);
  item.checked=true;item.correctSteps=correct;item.totalOpSteps=total;item.wasCorrectFinal=correct===total;
  item.points=points;item.maxPoints=profile.pointsPerItem;item.itemScore=profile.pointsPerItem?points/profile.pointsPerItem:0;
  item.lockedAt=state.mode==='exam'?Date.now():null;item.lastResult=null;
  return {applied:true,completed:true};
}
