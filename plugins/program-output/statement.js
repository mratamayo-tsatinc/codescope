// Language-neutral output statement semantics. C placeholders and Java
// concatenation are two source renderings of the same read -> combine -> print
// learning sequence.

function programOutputDynamicParts(statement){
  return statement.parts.map((part,index)=>({part,index})).filter(entry=>entry.part.kind==='expression');
}

function programOutputPartName(part){
  return part&&part.expression&&part.expression.kind==='identifier'?part.expression.name:null;
}

function programOutputPartSource(part){
  if(!part||part.kind!=='expression')return '';
  if(part.source)return part.source;
  const render=expression=>{
    if(expression.kind==='identifier')return expression.name;
    if(expression.kind==='literal'){
      if(expression.dataType==='string')return `"${String(expression.value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`;
      return formatValue(expression.value,expression.dataType);
    }
    if(expression.kind==='unary')return expression.form==='postfix'
      ?`${render(expression.operand)}${expression.operator}`:`${expression.operator}${render(expression.operand)}`;
    return `(${render(expression.left)} ${expression.operator} ${render(expression.right)})`;
  };
  return render(part.expression);
}

function programOutputReadTokenId(statement,index){return `output-read-${statement.id}-${index}`;}
function programOutputResultTokenId(statement,index){return `output-result-${statement.id}-${index}`;}
function programOutputConcatTokenId(statement,separatorIndex){return `output-concat-${statement.id}-${separatorIndex}`;}

function programOutputJavaSeparators(statement){
  return statement.parts.slice(1).map((part,index)=>index+1);
}

function programOutputJavaConcatResolved(statement,separatorIndex,trace){
  return (trace||statement.runtime.trace).some(step=>step.action==='EVALUATE'
    &&step.outputAction==='CONCATENATE_VALUE'&&step.separatorIndex===separatorIndex);
}

function programOutputJavaConcatReady(statement,separatorIndex,partStates,trace){
  const states=partStates||statement.runtime.parts,steps=trace||statement.runtime.trace;
  if(separatorIndex<1||separatorIndex>=statement.parts.length
    ||programOutputJavaConcatResolved(statement,separatorIndex,steps))return false;
  if(separatorIndex>1&&!programOutputJavaConcatResolved(statement,separatorIndex-1,steps))return false;
  const required=[];
  if(separatorIndex===1&&statement.parts[0].kind==='expression')required.push(0);
  if(statement.parts[separatorIndex].kind==='expression')required.push(separatorIndex);
  return required.every(index=>states[index]
    &&(states[index].stagedValue!==null||states[index].resolvedValue!==null));
}

function programOutputResolved(statement,language){
  const dynamicReady=programOutputDynamicParts(statement).every(entry=>{
    const state=statement.runtime.parts[entry.index];
    return state.stagedValue!==null||state.resolvedValue!==null;
  });
  if(String(language||'c').toLowerCase()!=='java')
    return programOutputDynamicParts(statement).every(entry=>
      statement.runtime.parts[entry.index].resolvedValue!==null);
  return dynamicReady&&programOutputJavaSeparators(statement).every(separatorIndex=>
    programOutputJavaConcatResolved(statement,separatorIndex));
}

function programOutputFormatValue(value,format){
  return coreFormatOutputValue(value,format);
}

function programOutputStatementText(statement,expected){
  const runtime=statement.runtime;
  const text=statement.parts.map((part,index)=>{
    if(part.kind==='text') return part.value;
    const statePart=runtime.parts[index];
    const value=expected?statePart.expectedValue
      :(statePart.resolvedValue!==null?statePart.resolvedValue:statePart.stagedValue);
    return value==null?'':programOutputFormatValue(value,part.format);
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


function programOutputStudentResponsePlanned(item,statement){
  return typeof manualOutputResponsePlanned==='function'&&manualOutputResponsePlanned(item,statement);
}

function normalizeProgramOutputStudentText(value){
  return String(value==null?'':value).replace(/\r\n?/g,'\n');
}

function programOutputPartEntry(statement,partIndex){
  return programOutputDynamicParts(statement).find(entry=>entry.index===partIndex)||null;
}

registerStatementPlugin({
  kind:'output',
  scoresCommit:true,

  interactionPlan(ctx){
    if(programOutputStudentResponsePlanned(ctx.item,ctx.statement)){
      return {mode:'direct',action:{type:'begin-output-response',statementId:ctx.statement.id},
        label:ctx.statement.runtime.manualOutputActive?'Enter complete output':'Predict complete output'};
    }
    return programOutputResolved(ctx.statement,ctx.program.language)
      ? {mode:'direct',action:{type:'emit-output',statementId:ctx.statement.id},label:'Run output statement'}
      : {mode:'modal',focus:'output-values',label:'Evaluate output statement'};
  },

  classifyRejectedAction(ctx){
    const action=ctx.action||{};
    if(action.type==='emit-output'&&!programOutputResolved(ctx.statement,ctx.program.language)) return 'output-unresolved';
    if(action.type==='resolve-output-concatenation'){
      if(String(ctx.program.language).toLowerCase()!=='java'
        ||programOutputJavaConcatResolved(ctx.statement,action.separatorIndex))return 'output-order';
      if(!programOutputJavaConcatReady(ctx.statement,action.separatorIndex))return 'output-value-unread';
    }
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

    if(action.type==='begin-output-response'){
      if(!programOutputStudentResponsePlanned(ctx.item,statement))return {applied:false};
      runtime.manualOutputActive=true;runtime._focusManualOutput=true;
      if(runtime.manualOutputDraft==null)runtime.manualOutputDraft='';
      return {applied:true};
    }

    if(action.type==='cancel-output-response'){
      if(!runtime.manualOutputActive)return {applied:false};
      runtime.manualOutputActive=false;runtime._focusManualOutput=false;
      return {applied:true};
    }

    if(action.type==='emit-student-output'){
      if(!programOutputStudentResponsePlanned(ctx.item,statement)||!runtime.manualOutputActive)
        return {applied:false};
      const text=normalizeProgramOutputStudentText(action.text);
      const semantic=programSemanticsForContext(ctx).execute(statement,program.memory);
      const expectedText=semantic.value,wasCorrect=text===expectedText;
      runtime.manualOutputDraft=text;runtime.manualOutputActive=false;runtime._focusManualOutput=false;
      runtime.checked=true;runtime.assignedValue=text;runtime.wasCorrectAssignment=wasCorrect;
      runtime.correctSteps=0;runtime.totalOpSteps=0;
      const event={type:'OUTPUT',action:'PRINT',statementId:statement.id,text,expectedText,
        effects:semantic.effects,wasCorrect,studentDerived:true};
      runtime.trace.push(event);
      return {applied:true,completed:true,event};
    }

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
      runtime.trace.push({type:'EVALUATE',action:'EVALUATE',outputAction:'FORMAT_VALUE',
        statementId:statement.id,partIndex:entry.index,result:partState.resolvedValue,wasCorrect:true,
        sourceBinding:programOutputPartName(entry.part),sourceBindingKind:'variable',
        sourceNodeId:programOutputReadTokenId(statement,entry.index),
        resultNodeId:programOutputResultTokenId(statement,entry.index)});
      return {applied:true};
    }

    if(action.type==='resolve-output-concatenation'){
      const separatorIndex=Number(action.separatorIndex);
      if(String(program.language).toLowerCase()!=='java'
        ||!programOutputJavaConcatReady(statement,separatorIndex))return {applied:false};
      statement.parts.slice(0,separatorIndex+1).forEach((part,index)=>{
        if(part.kind==='expression'&&runtime.parts[index].stagedValue!==null)
          runtime.parts[index].resolvedValue=runtime.parts[index].stagedValue;
      });
      const sourceIndex=statement.parts[separatorIndex].kind==='expression'
        ?separatorIndex:(separatorIndex===1&&statement.parts[0].kind==='expression'?0:null);
      const sourcePart=sourceIndex==null?null:statement.parts[sourceIndex];
      const result=statement.parts.slice(0,separatorIndex+1).map((part,index)=>part.kind==='text'
        ?part.value:programOutputFormatValue(runtime.parts[index].stagedValue,part.format)).join('');
      runtime.trace.push({type:'EVALUATE',action:'EVALUATE',outputAction:'CONCATENATE_VALUE',
        statementId:statement.id,separatorIndex,partIndex:sourceIndex,result,wasCorrect:true,
        sourceBinding:sourcePart?programOutputPartName(sourcePart):null,
        sourceBindingKind:sourcePart?'variable':null,
        sourceNodeId:sourcePart?programOutputReadTokenId(statement,sourceIndex)
          :programOutputConcatTokenId(statement,separatorIndex-1),
        resultNodeId:programOutputConcatTokenId(statement,separatorIndex)});
      return {applied:true};
    }

    if(action.type==='emit-output'){
      if(!programOutputResolved(statement,program.language)) return {applied:false};
      const text=programOutputStatementText(statement,false);
      const semantic=programSemanticsForContext(ctx).execute(statement,program.memory);
      const expectedText=semantic.value;
      runtime.checked=true;
      runtime.assignedValue=text;
      runtime.wasCorrectAssignment=text===expectedText;
      const evaluations=runtime.trace.filter(step=>step.action==='EVALUATE');
      runtime.correctSteps=evaluations.filter(step=>step.wasCorrect).length;
      runtime.totalOpSteps=evaluations.length;
      const event={type:'OUTPUT',action:'PRINT',statementId:statement.id,text,
        expectedText,effects:semantic.effects,wasCorrect:runtime.wasCorrectAssignment};
      runtime.trace.push(event);
      return {applied:true,completed:true,event};
    }
    return {applied:false};
  },

  canUndo(ctx){
    return !!(ctx.statement.runtime&&(ctx.statement.runtime.trace.length||ctx.statement.runtime.manualOutputActive));
  },

  undo(ctx){
    const runtime=ctx.statement.runtime;
    if(!runtime)return {applied:false};
    if(runtime.manualOutputActive&&!runtime.trace.length){
      runtime.manualOutputActive=false;runtime._focusManualOutput=false;return {applied:true};
    }
    if(!runtime.trace.length)return {applied:false};
    const step=runtime.trace.pop();
    if(step.action==='PRINT'){
      programOutputRemoveEvent(ctx.program,ctx.statement.id);
      runtime.checked=false;runtime.assignedValue=null;runtime.wasCorrectAssignment=null;
      runtime.correctSteps=0;runtime.totalOpSteps=0;
    }else if(step.action==='EVALUATE'){
      runtime.parts.forEach(part=>{part.resolvedValue=null;});
      runtime.trace.filter(entry=>entry.action==='EVALUATE').forEach(entry=>{
        if(entry.outputAction==='CONCATENATE_VALUE'&&entry.separatorIndex!=null){
          statement.parts.slice(0,entry.separatorIndex+1).forEach((part,index)=>{
            if(part.kind==='expression'&&runtime.parts[index].stagedValue!==null)
              runtime.parts[index].resolvedValue=runtime.parts[index].stagedValue;
          });
        }else if(entry.partIndex!=null&&runtime.parts[entry.partIndex])
          runtime.parts[entry.partIndex].resolvedValue=runtime.parts[entry.partIndex].stagedValue;
      });
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
    if(programOutputStudentResponsePlanned(ctx.item,ctx.statement)){runtime.manualOutputActive=true;runtime._focusManualOutput=true;}
    return {applied:true,reopenFocus:programOutputStudentResponsePlanned(ctx.item,ctx.statement)?null:'output-values'};
  },

  reset(ctx){
    const runtime=ctx.statement.runtime;
    if(!runtime) return {applied:false};
    const changed=runtime.trace.length>0||runtime.checked;
    runtime.parts.forEach(part=>{part.stagedValue=part.initialStagedValue==null?null:part.initialStagedValue;
      part.resolvedValue=null;});
    runtime.trace=[];runtime.checked=false;runtime.assignedValue=null;
    runtime.wasCorrectAssignment=null;runtime.correctSteps=0;runtime.totalOpSteps=0;
    runtime.manualOutputActive=false;runtime.manualOutputDraft='';runtime._focusManualOutput=false;
    delete runtime.rollbackReviewFocus;
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
      if(String(ctx.program.language).toLowerCase()!=='java')
        events.push({type:'EVALUATE',action:'EVALUATE',outputAction:'FORMAT_VALUE',
          statementId:ctx.statement.id,partIndex:entry.index,result:value,wasCorrect:true,
          sourceBinding:name,sourceBindingKind:'variable',
          sourceNodeId:programOutputReadTokenId(ctx.statement,entry.index),
          resultNodeId:programOutputResultTokenId(ctx.statement,entry.index)});
    });
    if(String(ctx.program.language).toLowerCase()==='java'){
      programOutputJavaSeparators(ctx.statement).forEach(separatorIndex=>{
        const sourceIndex=ctx.statement.parts[separatorIndex].kind==='expression'
          ?separatorIndex:(separatorIndex===1&&ctx.statement.parts[0].kind==='expression'?0:null);
        const sourcePart=sourceIndex==null?null:ctx.statement.parts[sourceIndex];
        const result=ctx.statement.parts.slice(0,separatorIndex+1).map((part,index)=>part.kind==='text'
          ?part.value:programOutputFormatValue(ctx.statement.runtime.parts[index].expectedValue,part.format)).join('');
        events.push({type:'EVALUATE',action:'EVALUATE',outputAction:'CONCATENATE_VALUE',
          statementId:ctx.statement.id,separatorIndex,partIndex:sourceIndex,result,wasCorrect:true,
          sourceBinding:sourcePart?programOutputPartName(sourcePart):null,
          sourceBindingKind:sourcePart?'variable':null,
          sourceNodeId:sourcePart?programOutputReadTokenId(ctx.statement,sourceIndex)
            :programOutputConcatTokenId(ctx.statement,separatorIndex-1),
          resultNodeId:programOutputConcatTokenId(ctx.statement,separatorIndex)});
      });
    }
    const text=programOutputStatementText(ctx.statement,true);
    events.push({type:'OUTPUT',action:'PRINT',statementId:ctx.statement.id,
      text,expectedText:text,wasCorrect:true});
    return events;
  }
});
