function programInputTokenId(statement,index){return `input-token-${statement.id}-${index}`;}
function programInputResultId(statement,index){return `input-result-${statement.id}-${index}`;}

function programInputCaptureMemory(statement,program){
  if(statement.runtime.memoryBefore) return;
  statement.runtime.memoryBefore={};
  statement.reads.forEach(read=>{
    const current=program.memory&&program.memory[read.target];
    statement.runtime.memoryBefore[read.target]=current?JSON.parse(JSON.stringify(current)):null;
  });
}

function programInputRestoreMemory(statement,program){
  const before=statement.runtime.memoryBefore||{};
  statement.reads.forEach((read,index)=>{
    const original=before[read.target];
    if(original) program.memory[read.target]=JSON.parse(JSON.stringify(original));
    else delete program.memory[read.target];
    if(statement.runtime.reads[index]&&statement.runtime.reads[index].written){
      program.memory[read.target]={name:read.target,kind:'variable',dataType:read.dataType,mutable:true,
        initialized:true,value:read.expectedValue,lastStatementId:statement.id};
    }
  });
}

function programInputRemember(statement){
  statement.runtime.history.push(programInputRuntimeSnapshot(statement.runtime));
}

function programInputRestoreSnapshot(statement,snapshot){
  const runtime=statement.runtime;
  runtime.started=snapshot.started;runtime.playbackComplete=snapshot.playbackComplete;
  runtime.submitted=snapshot.submitted;runtime.transferComplete=snapshot.transferComplete;
  runtime.transferAnimating=false;runtime.currentReadIndex=snapshot.currentReadIndex;
  runtime.checked=snapshot.checked;runtime.assignedValue=snapshot.assignedValue;
  runtime.wasCorrectAssignment=snapshot.wasCorrectAssignment;
  runtime.correctSteps=snapshot.correctSteps;runtime.totalOpSteps=snapshot.totalOpSteps;
  runtime.reads=snapshot.reads.map(read=>Object.assign({},read));
  runtime.trace=snapshot.trace.map(step=>Object.assign({},step));
  runtime.workingFlat=runtime.trace.length?{operands:[{id:runtime.trace[runtime.trace.length-1].resultNodeId}],operators:[]}:null;
}

function programInputRemoveEvents(program,statementId){
  program.events=(program.events||[]).filter(event=>!(event&&event.statementId===statementId
    &&(event.type==='INPUT'||event.type==='INPUT_WRITE')));
}

function programInputRebuildEvents(statement,program){
  programInputRemoveEvents(program,statement.id);
  if(statement.runtime.submitted) program.events.push({type:'INPUT',action:'INPUT_SUBMIT',statementId:statement.id,
    rawText:statement.rawInput,text:`${statement.rawInput}\n`,tokens:statement.reads.map(entry=>entry.expectedRaw),wasCorrect:true});
  statement.runtime.reads.forEach((state,index)=>{
    if(!state.written) return;
    const read=statement.reads[index];
    program.events.push({type:'INPUT_WRITE',action:'ASSIGN',statementId:statement.id,
      target:read.target,value:read.expectedValue,readIndex:index,wasCorrect:true});
  });
}

registerStatementPlugin({
  kind:'input',scoresCommit:true,

  interactionPlan(){return {mode:'modal',focus:'input-flow',label:'Trace input statement'};},

  classifyRejectedAction(ctx){
    const runtime=ctx.statement.runtime,action=ctx.action||{};
    if(action.type==='submit-input'&&!runtime.playbackComplete) return 'input-not-ready';
    if(action.type==='write-input'&&!runtime.transferComplete) return 'input-transfer-incomplete';
    return null;
  },

  applyAction(ctx){
    const {statement,program,action}=ctx,runtime=statement.runtime;
    if(!runtime||runtime.checked) return {applied:false};
    const index=runtime.currentReadIndex,read=statement.reads[index],readState=runtime.reads[index];
    if(action.type==='start-input'){
      if(runtime.started) return {applied:false};
      programInputCaptureMemory(statement,program);runtime.started=true;runtime.playbackComplete=false;
      runtime.trace.push({action:'CALL_INPUT',statementId:statement.id,resultNodeId:`input-call-${statement.id}`});
      programInputRemember(statement);
      return {applied:true};
    }
    if(action.type==='submit-input'){
      if(!runtime.started||!runtime.playbackComplete||runtime.submitted) return {applied:false};
      runtime.submitted=true;runtime.transferComplete=false;
      runtime.reads.forEach(state=>{state.tokenRead=true;state.converted=true;});
      runtime.trace.push({action:'CONVERT_INPUT_BATCH',statementId:statement.id,
        resultNodeId:`input-submit-${statement.id}`,transfers:statement.reads.map((entry,readIndex)=>({
          readIndex,rawValue:entry.expectedRaw,result:entry.expectedValue,target:entry.target}))});
      programInputRemember(statement);
      return {applied:true,event:{type:'INPUT',action:'INPUT_SUBMIT',statementId:statement.id,
        rawText:statement.rawInput,text:`${statement.rawInput}\n`,
        tokens:statement.reads.map(entry=>entry.expectedRaw),wasCorrect:true}};
    }
    if(!read||!readState) return {applied:false};
    if(action.readIndex!=null&&action.readIndex!==index) return {applied:false};
    if(action.type==='write-input'){
      if(!runtime.transferComplete||!readState.converted||readState.written) return {applied:false};
      readState.written=true;
      const semantics=programSemanticsForContext(ctx);
      const semantic=semantics.execute(statement,program.memory,{language:program.language||statement.inputSyntax});
      const writeEffect=semantic.effects.find(effect=>effect.kind==='write'&&effect.target===read.target);
      if(!writeEffect) throw new Error(`Input semantics did not produce a write for '${read.target}'`);
      const writtenValue=writeEffect.nextValue;
      semantics.applyEffects(program.memory,[writeEffect],statement.id,'bindings');
      if(program.memory[read.target]&&typeof program.memory[read.target]==='object')
        program.memory[read.target].dataType=read.dataType;
      runtime.trace.push({action:'WRITE_INPUT',statementId:statement.id,readIndex:index,
        resultNodeId:programInputResultId(statement,index),target:read.target,result:read.expectedValue,wasCorrect:true});
      const completed=index===statement.reads.length-1;
      if(completed){runtime.checked=true;runtime.assignedValue=read.expectedValue;runtime.wasCorrectAssignment=true;}
      else runtime.currentReadIndex++;
      programInputRemember(statement);
      return {applied:true,completed,event:{type:'INPUT_WRITE',action:'ASSIGN',statementId:statement.id,
        target:read.target,value:writtenValue,readIndex:index,effects:semantic.effects,wasCorrect:true}};
    }
    return {applied:false};
  },

  canUndo(ctx){return !!(ctx.statement.runtime&&ctx.statement.runtime.history.length>1&&!ctx.statement.runtime.checked);},

  undo(ctx){
    const runtime=ctx.statement.runtime;
    if(!runtime||runtime.history.length<=1||runtime.checked) return {applied:false};
    runtime.history.pop();programInputRestoreSnapshot(ctx.statement,runtime.history[runtime.history.length-1]);
    programInputRestoreMemory(ctx.statement,ctx.program);programInputRebuildEvents(ctx.statement,ctx.program);
    return {applied:true};
  },

  rollbackCompletion(ctx){
    if(!ctx.statement.runtime.checked) return {applied:false};
    programInputRestoreSnapshot(ctx.statement,ctx.statement.runtime.history[0]);
    ctx.statement.runtime.history=[programInputRuntimeSnapshot(ctx.statement.runtime)];
    programInputRestoreMemory(ctx.statement,ctx.program);programInputRemoveEvents(ctx.program,ctx.statement.id);
    return {applied:true};
  },

  reset(ctx){
    const runtime=ctx.statement.runtime,changed=runtime.started||runtime.trace.length>0||runtime.checked;
    programInputRestoreSnapshot(ctx.statement,runtime.history[0]);runtime.history=[programInputRuntimeSnapshot(runtime)];
    programInputRestoreMemory(ctx.statement,ctx.program);programInputRemoveEvents(ctx.program,ctx.statement.id);
    return {applied:changed};
  },

  buildCanonicalTrace(ctx){
    const statement=ctx.statement,steps=[{action:'CALL_INPUT',statementId:statement.id},
      {action:'INPUT_SUBMIT',statementId:statement.id,rawText:statement.rawInput},
      {action:'CONVERT_INPUT_BATCH',statementId:statement.id,
        transfers:statement.reads.map((read,index)=>({readIndex:index,rawValue:read.expectedRaw,value:read.expectedValue}))}];
    statement.reads.forEach((read,index)=>steps.push(
      {action:'ASSIGN',statementId:statement.id,readIndex:index,target:read.target,value:read.expectedValue}));
    return steps;
  }
});
