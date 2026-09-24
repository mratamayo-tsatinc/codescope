// Language-neutral output statement semantics. C placeholders and Java
// concatenation are two source renderings of the same read -> combine -> print
// learning sequence.

function programOutputDynamicParts(statement){
  return statement.parts.map((part,index)=>({part,index})).filter(entry=>entry.part.kind==='expression');
}

function programOutputPartName(part){
  return part&&part.expression&&part.expression.kind==='identifier'?part.expression.name:null;
}

function programOutputReadTokenId(statement,index){return `output-read-${statement.id}-${index}`;}
function programOutputResultTokenId(statement,index){return `output-result-${statement.id}-${index}`;}

function programOutputResolved(statement){
  return programOutputDynamicParts(statement).every(entry=>
    statement.runtime.parts[entry.index].resolvedValue!==null);
}

function programOutputStatementText(statement,expected){
  const runtime=statement.runtime;
  const text=statement.parts.map((part,index)=>{
    if(part.kind==='text') return part.value;
    const statePart=runtime.parts[index];
    const value=expected?statePart.expectedValue:statePart.resolvedValue;
    return value==null?'':String(value);
  }).join('');
  return text+(statement.newline?'\n':'');
}

function programOutputText(program){
  return (program.events||[]).filter(event=>event&&event.type==='OUTPUT')
    .map(event=>event.text).join('');
}

function programOutputRemoveEvent(program,statementId){
  for(let index=program.events.length-1;index>=0;index--){
    const event=program.events[index];
    if(event&&event.type==='OUTPUT'&&event.statementId===statementId){
      program.events.splice(index,1);
      return true;
    }
  }
  return false;
}

function programOutputCurrentPart(statement){
  return programOutputDynamicParts(statement).find(entry=>
    statement.runtime.parts[entry.index].resolvedValue===null)||null;
}

function programOutputPartEntry(statement,partIndex){
  return programOutputDynamicParts(statement).find(entry=>entry.index===partIndex)||null;
}

registerStatementPlugin({
  kind:'output',
  scoresCommit:true,

  interactionPlan(ctx){
    return programOutputResolved(ctx.statement)
      ? {mode:'direct',action:{type:'emit-output',statementId:ctx.statement.id},label:'Run output statement'}
      : {mode:'modal',focus:'output-values',label:'Evaluate output statement'};
  },

  classifyRejectedAction(ctx){
    const action=ctx.action||{};
    if(action.type==='emit-output'&&!programOutputResolved(ctx.statement)) return 'output-unresolved';
    if(action.type==='resolve-output-part'){
      const entry=programOutputPartEntry(ctx.statement,action.partIndex);
      if(!entry||ctx.statement.runtime.parts[entry.index].resolvedValue!==null) return 'output-order';
      if(ctx.statement.runtime.parts[entry.index].stagedValue===null) return 'output-value-unread';
    }
    if(action.type==='read-output-value'){
      const entry=programOutputPartEntry(ctx.statement,action.partIndex);
      if(!entry||ctx.statement.runtime.parts[entry.index].resolvedValue!==null
        ||ctx.statement.runtime.parts[entry.index].stagedValue!==null) return 'output-order';
      const name=programOutputPartName(entry.part);
      const binding=name&&ctx.program.memory[name];
      if(!binding||!binding.initialized) return 'output-memory-unavailable';
    }
    return null;
  },

  applyAction(ctx){
    const {statement,program,action}=ctx;
    const runtime=statement.runtime;
    if(!runtime||runtime.checked) return {applied:false};

    if(action.type==='read-output-value'){
      const entry=programOutputPartEntry(statement,action.partIndex);
      if(!entry) return {applied:false};
      const name=programOutputPartName(entry.part);
      const binding=name&&program.memory[name];
      const partState=runtime.parts[entry.index];
      if(!binding||!binding.initialized||partState.stagedValue!==null
        ||partState.resolvedValue!==null) return {applied:false};
      partState.expectedValue=binding.value;
      partState.stagedValue=binding.value;
      runtime.trace.push({type:'READ',action:'READ_OUTPUT_VALUE',statementId:statement.id,
        partIndex:entry.index,target:name,targetKind:'variable',sourceValue:binding.value,
        resultNodeId:programOutputReadTokenId(statement,entry.index)});
      return {applied:true};
    }

    if(action.type==='resolve-output-part'){
      const entry=programOutputPartEntry(statement,action.partIndex);
      if(!entry) return {applied:false};
      const partState=runtime.parts[entry.index];
      if(partState.stagedValue===null||partState.resolvedValue!==null) return {applied:false};
      partState.resolvedValue=partState.stagedValue;
      runtime.trace.push({type:'EVALUATE',action:'EVALUATE',outputAction:
        program.language==='c'?'FORMAT_VALUE':'CONCATENATE_VALUE',statementId:statement.id,
        partIndex:entry.index,result:partState.resolvedValue,wasCorrect:true,
        sourceBinding:programOutputPartName(entry.part),sourceBindingKind:'variable',
        sourceNodeId:programOutputReadTokenId(statement,entry.index),
        resultNodeId:programOutputResultTokenId(statement,entry.index)});
      return {applied:true};
    }

    if(action.type==='emit-output'){
      if(!programOutputResolved(statement)) return {applied:false};
      const text=programOutputStatementText(statement,false);
      const expectedText=programOutputStatementText(statement,true);
      runtime.checked=true;
      runtime.assignedValue=text;
      runtime.wasCorrectAssignment=text===expectedText;
      const evaluations=runtime.trace.filter(step=>step.action==='EVALUATE');
      runtime.correctSteps=evaluations.filter(step=>step.wasCorrect).length;
      runtime.totalOpSteps=evaluations.length;
      const event={type:'OUTPUT',action:'PRINT',statementId:statement.id,text,
        expectedText,wasCorrect:runtime.wasCorrectAssignment};
      runtime.trace.push(event);
      return {applied:true,completed:true,event};
    }
    return {applied:false};
  },

  canUndo(ctx){
    return !!(ctx.statement.runtime&&ctx.statement.runtime.trace.length);
  },

  undo(ctx){
    const runtime=ctx.statement.runtime;
    if(!runtime||!runtime.trace.length) return {applied:false};
    const step=runtime.trace.pop();
    if(step.action==='PRINT'){
      programOutputRemoveEvent(ctx.program,ctx.statement.id);
      runtime.checked=false;runtime.assignedValue=null;runtime.wasCorrectAssignment=null;
      runtime.correctSteps=0;runtime.totalOpSteps=0;
    }else if(step.action==='EVALUATE'){
      runtime.parts[step.partIndex].resolvedValue=null;
    }else if(step.action==='READ_OUTPUT_VALUE'){
      runtime.parts[step.partIndex].stagedValue=null;
    }
    return {applied:true};
  },

  rollbackCompletion(ctx){
    const runtime=ctx.statement.runtime;
    if(!runtime||!runtime.checked) return {applied:false};
    programOutputRemoveEvent(ctx.program,ctx.statement.id);
    const printIndex=runtime.trace.map(step=>step.action).lastIndexOf('PRINT');
    if(printIndex>=0) runtime.trace.splice(printIndex,1);
    runtime.checked=false;runtime.assignedValue=null;runtime.wasCorrectAssignment=null;
    runtime.correctSteps=0;runtime.totalOpSteps=0;
    return {applied:true};
  },

  reset(ctx){
    const runtime=ctx.statement.runtime;
    if(!runtime) return {applied:false};
    const changed=runtime.trace.length>0||runtime.checked;
    runtime.parts.forEach(part=>{part.stagedValue=null;part.resolvedValue=null;});
    runtime.trace=[];runtime.checked=false;runtime.assignedValue=null;
    runtime.wasCorrectAssignment=null;runtime.correctSteps=0;runtime.totalOpSteps=0;
    return {applied:changed};
  },

  buildCanonicalTrace(ctx){
    const events=[];
    programOutputDynamicParts(ctx.statement).forEach(entry=>{
      const name=programOutputPartName(entry.part);
      const value=ctx.statement.runtime.parts[entry.index].expectedValue;
      events.push({type:'READ',action:'READ_OUTPUT_VALUE',statementId:ctx.statement.id,
        partIndex:entry.index,target:name,targetKind:'variable',sourceValue:value,
        resultNodeId:programOutputReadTokenId(ctx.statement,entry.index)});
      events.push({type:'EVALUATE',action:'EVALUATE',outputAction:
        ctx.program.language==='c'?'FORMAT_VALUE':'CONCATENATE_VALUE',
        statementId:ctx.statement.id,partIndex:entry.index,result:value,wasCorrect:true,
        sourceBinding:name,sourceBindingKind:'variable',
        sourceNodeId:programOutputReadTokenId(ctx.statement,entry.index),
        resultNodeId:programOutputResultTokenId(ctx.statement,entry.index)});
    });
    const text=programOutputStatementText(ctx.statement,true);
    events.push({type:'OUTPUT',action:'PRINT',statementId:ctx.statement.id,
      text,expectedText:text,wasCorrect:true});
    return events;
  }
});
