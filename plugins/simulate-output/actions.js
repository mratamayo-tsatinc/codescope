function soHasResponse(item){
  return !!(item.response.output.trim()||item.response.variables.some(value=>
    Array.isArray(value)?value.some(part=>String(part).trim()):String(value).trim()));
}

function soApplyAction({item,action}){
  if(!item||item.checked||!action)return {applied:false};
  if(action.type==='SET_OUTPUT'&&typeof action.value==='string'){
    item.response.output=action.value;return {applied:true};
  }
  if(action.type!=='SET_VARIABLE'||!Number.isInteger(action.index)
    ||action.index<0||action.index>=item.variables.length||typeof action.value!=='string')return {applied:false};
  const answer=item.variables[action.index].expected;
  if(Array.isArray(answer)){
    if(!Number.isInteger(action.element)||action.element<0||action.element>=answer.length)return {applied:false};
    item.response.variables[action.index][action.element]=action.value;
  }else{
    if(action.element!==undefined)return {applied:false};
    item.response.variables[action.index]=action.value;
  }
  return {applied:true};
}

function soUserLines(output,expectedCount){
  if(!output.replace(/\s+$/,'').length)return [];
  const lines=output.replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/\s+$/,''));
  if(lines.length>expectedCount&&lines[lines.length-1]==='')lines.pop();
  return lines;
}

function soScoreResponse(item){
  const lines=soUserLines(item.response.output,item.expectedLines.length);
  const outputResults=item.expectedLines.map((expected,index)=>
    index<lines.length&&lines[index]===expected.replace(/\s+$/,''));
  const outputCorrect=Math.max(0,outputResults.filter(Boolean).length
    -Math.max(0,lines.length-item.expectedLines.length));
  const variableResults=item.variables.map((variable,index)=>{
    const response=item.response.variables[index];
    return Array.isArray(variable.expected)
      ?variable.expected.map((expected,part)=>String(response[part]).trim()===expected)
      :String(response).trim()===variable.expected;
  });
  const variableCorrect=variableResults.reduce((sum,result)=>sum+
    (Array.isArray(result)?result.filter(Boolean).length:Number(result)),0);
  const variableTotal=item.variables.reduce((sum,variable)=>sum+
    (Array.isArray(variable.expected)?variable.expected.length:1),0);
  const total=item.expectedLines.length+variableTotal;
  return {lines,outputResults,variableResults,outputCorrect,variableCorrect,
    correct:outputCorrect+variableCorrect,total};
}

function soCheck({item,profile,state}){
  if(!item||item.checked)return {applied:false};
  const result=soScoreResponse(item);
  item.result=result;item.checked=true;
  item.correctSteps=result.correct;item.totalOpSteps=result.total;
  item.wasCorrectFinal=result.correct===result.total;
  item.points=result.correct;
  item.maxPoints=result.total;
  item.itemScore=item.points/item.maxPoints;
  item.lockedAt=state.mode==='exam'?Date.now():null;
  return {applied:true,completed:true};
}

function soResetResponse(item){
  item.response={output:'',variables:item.variables.map(variable=>
    Array.isArray(variable.expected)?variable.expected.map(()=>''):'')};
  item.result=null;item.showSolution=false;item._feedbackAnimated=false;
}

function soReset({item}){
  if(!item||item.checked)return {applied:false};
  const changed=soHasResponse(item);soResetResponse(item);return {applied:changed};
}

function soRetry({item}){
  if(!item||!item.checked)return {applied:false};
  soResetResponse(item);item.checked=false;item.itemScore=null;item.points=null;
  item.maxPoints=null;item.correctSteps=0;item.totalOpSteps=0;
  item.wasCorrectFinal=null;item.lockedAt=null;
  return {applied:true,resetAttempt:true};
}
