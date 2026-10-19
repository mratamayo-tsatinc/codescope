function selectionExpressionResolved(statement){
  const runtime=statement.runtime;
  return !!(runtime&&runtime.workingFlat&&runtime.workingFlat.operands.length===1
    &&isFlatOperandReady(runtime.workingFlat.operands[0]));
}

function syncSelectionOperands(statement,program,semantics){
  semantics=semantics||programSemanticServices(program);
  if(statement.runtime.trace.length) return;
  if(statement.runtime.originalTree&&typeof applyProgramMemoryToTree==='function'){
    applyProgramMemoryToTree(statement.runtime.originalTree,program.memory);
    const semantic=semantics.execute(statement,program.memory);
    statement.runtime.expectedValue=semantic.value;
    statement.runtime.expectedEffects=semantic.effects.filter(effect=>effect.scope==='expression');
    statement.runtime.semanticTrace=semantic.trace;
    statement.runtime.canonicalTrace=buildCanonicalTrace(statement.runtime.originalTree);
  }
  statement.runtime.workingFlat.operands.forEach(function sync(operand){
    if(operand.kind==='unary') return sync(operand.inner);
    if(operand.kind==='variable'||operand.kind==='constant'){
      const binding=program.memory[operand.name];
      if(binding&&binding.initialized) operand.declaredValue=binding.value;
    }
  });
  statement.runtime.history[0]=deepCloneFlat(statement.runtime.workingFlat);
}

function completeSelection(statement,value,program,semantics){
  const runtime=statement.runtime,branch=semantics.selectBranch(statement,value);
  if(!branch) return {applied:false};
  const evaluations=runtime.trace.filter(step=>step.action==='EVALUATE');
  runtime.checked=true;runtime.assignedValue=value;runtime.selectedTargetLine=branch.targetLine;
  runtime.selectedTargetText=branch.targetText;runtime.selectedTargetStatementId=branch.nextStatementId;
  runtime.selectedLabel=branch.label;runtime.correctSteps=evaluations.filter(step=>step.wasCorrect).length;
  runtime.studentSelectedTargetStatementId=null;runtime.studentSelectedLabel=null;
  runtime.branchChoiceCorrect=null;
  runtime.totalOpSteps=evaluations.length;runtime.wasCorrectAssignment=value===runtime.expectedValue;
  const effects=typeof coreExpressionWriteEffectsFromTrace==='function'
    ?coreExpressionWriteEffectsFromTrace(runtime.trace,runtime.expectedEffects):[];
  runtime.beforeEffectMemory=typeof captureCoreMemoryTargets==='function'
    ?captureCoreMemoryTargets(program.memory,effects.map(effect=>effect.target)):null;
  runtime.expressionEffects=effects;
  if(typeof applyCoreExpressionEffects==='function')applyCoreExpressionEffects(program.memory,effects,statement.id);
  return {applied:true,completed:true,nextStatementId:branch.nextStatementId,
    event:{type:'BRANCH',action:'BRANCH',statementId:statement.id,value,
      targetLine:branch.targetLine,label:branch.label,effects,wasCorrect:runtime.wasCorrectAssignment}};
}

registerStatementPlugin({
  kind:'selection',scoresCommit:true,
  interactionPlan(){
    return {mode:'modal',focus:'condition-expression',label:'Evaluate condition'};
  },
  classifyRejectedAction(ctx){
    if(ctx.action&&ctx.action.type==='commit-branch'&&!selectionExpressionResolved(ctx.statement))
      return 'condition-unresolved';
    return null;
  },
  applyAction(ctx){
    const {statement,program,action}=ctx,runtime=statement.runtime;
    if(!runtime||runtime.checked) return {applied:false};
    const semantics=programSemanticsForContext(ctx);
    syncSelectionOperands(statement,program,semantics);
    if(action.type==='commit-branch') return selectionExpressionResolved(statement)
      ?completeSelection(statement,flatOperandValue(runtime.workingFlat.operands[0]),program,semantics):{applied:false};
    const apply=ctx.services&&ctx.services.applyExpressionAction;
    if(typeof apply!=='function'||!apply(runtime,action)) return {applied:false};
    return selectionExpressionResolved(statement)
      ?completeSelection(statement,flatOperandValue(runtime.workingFlat.operands[0]),program,semantics):{applied:true};
  },
  canUndo(ctx){return !!(ctx.statement.runtime&&!ctx.statement.runtime.checked&&ctx.statement.runtime.history.length>1);},
  undo(ctx){const undo=ctx.services&&ctx.services.undoExpressionAction;
    return typeof undo==='function'?{applied:!!undo(ctx.statement.runtime)}:{applied:false};},
  rollbackCompletion(ctx){const runtime=ctx.statement.runtime;if(!runtime||!runtime.checked)return {applied:false};
    if(typeof restoreCoreMemoryTargets==='function')restoreCoreMemoryTargets(ctx.program.memory,runtime.beforeEffectMemory);
    for(let index=ctx.program.events.length-1;index>=0;index--){
      const event=ctx.program.events[index];
      if(event.statementId===ctx.statement.id&&(event.type==='BRANCH'||event.type==='BRANCH_CHOICE'))
        ctx.program.events.splice(index,1);
    }
    runtime.checked=false;runtime.assignedValue=null;runtime.selectedTargetLine=null;runtime.selectedTargetText=null;runtime.selectedTargetStatementId=null;
    runtime.selectedLabel=null;runtime.correctSteps=0;runtime.totalOpSteps=0;runtime.wasCorrectAssignment=null;
    runtime.studentSelectedTargetStatementId=null;runtime.studentSelectedLabel=null;runtime.branchChoiceCorrect=null;
    runtime.beforeEffectMemory=null;runtime.expressionEffects=[];
    return {applied:true,reopenFocus:'condition-expression'};},
  reset(ctx){const runtime=ctx.statement.runtime;if(!runtime)return {applied:false};
    const changed=runtime.checked||runtime.trace.length>0;
    runtime.workingFlat=deepCloneFlat(runtime.originalFlat);runtime.history=[deepCloneFlat(runtime.originalFlat)];
    runtime.trace=[];runtime.checked=false;runtime.assignedValue=null;runtime.selectedTargetLine=null;runtime.selectedTargetStatementId=null;
    runtime.selectedTargetText=null;runtime.selectedLabel=null;runtime.correctSteps=0;runtime.totalOpSteps=0;
    runtime.wasCorrectAssignment=null;runtime.studentSelectedTargetStatementId=null;runtime.studentSelectedLabel=null;
    runtime.branchChoiceCorrect=null;runtime.beforeEffectMemory=null;runtime.expressionEffects=[];
    delete runtime.rollbackReviewFocus;return {applied:changed};},
  buildCanonicalTrace(ctx){const runtime=ctx.statement.runtime;
    return runtime.canonicalTrace.steps.map(step=>Object.assign({statementId:ctx.statement.id},step))
      .concat({type:'BRANCH',action:'BRANCH',statementId:ctx.statement.id,value:runtime.expectedValue});}
});

function loopExpressionResolved(statement){
  if(statement.loopKind==='do')return true;
  return selectionExpressionResolved(statement);
}

function completeLoopFrame(ctx,value){
  const {statement,program}=ctx,runtime=statement.runtime,semantics=programSemanticsForContext(ctx);
  runtime.checked=true;runtime.assignedValue=value;
  const evaluations=(runtime.trace||[]).filter(step=>step.action==='EVALUATE');
  runtime.correctSteps=evaluations.filter(step=>step.wasCorrect).length;
  runtime.totalOpSteps=evaluations.length;runtime.wasCorrectAssignment=value===runtime.expectedValue;
  const effects=(runtime.expectedEffects||[]).map(effect=>Object.assign({},effect));
  runtime.beforeEffectMemory=typeof captureCoreMemoryTargets==='function'
    ?captureCoreMemoryTargets(program.memory,effects.map(effect=>effect.target).filter(Boolean)):null;
  semantics.applyEffects(program.memory,effects,statement.id,'bindings');
  return {applied:true,completed:true,nextStatementId:statement.nextStatementId,event:{
    type:'LOOP',action:'LOOP',statementId:statement.id,loopKind:statement.loopKind,
    phase:runtime.loopPhase,value,wasCorrect:runtime.wasCorrectAssignment,effects}};
}

registerStatementPlugin({
  kind:'loop',scoresCommit:true,
  interactionPlan(ctx){
    return ctx.statement.loopKind==='do'
      ?{mode:'direct',action:{type:'commit-loop-entry',statementId:ctx.statement.id},label:'Enter loop body'}
      :{mode:'modal',focus:'condition-expression',label:'Evaluate loop condition'};
  },
  classifyRejectedAction(ctx){
    if(ctx.action&&ctx.action.type==='commit-loop'&&!loopExpressionResolved(ctx.statement))return 'condition-unresolved';
    return null;
  },
  applyAction(ctx){
    const {statement,action}=ctx,runtime=statement.runtime;
    if(!runtime||runtime.checked)return {applied:false};
    if(statement.loopKind==='do'&&action.type==='commit-loop-entry')return completeLoopFrame(ctx,true);
    if(action.type==='commit-loop')return loopExpressionResolved(statement)
      ?completeLoopFrame(ctx,flatOperandValue(runtime.workingFlat.operands[0])):{applied:false};
    const apply=ctx.services&&ctx.services.applyExpressionAction;
    if(typeof apply!=='function'||!apply(runtime,action))return {applied:false};
    return loopExpressionResolved(statement)
      ?completeLoopFrame(ctx,flatOperandValue(runtime.workingFlat.operands[0])):{applied:true};
  },
  canUndo(ctx){const runtime=ctx.statement.runtime;return !!(runtime&&!runtime.checked&&runtime.history&&runtime.history.length>1);},
  undo(ctx){const undo=ctx.services&&ctx.services.undoExpressionAction;
    return typeof undo==='function'?{applied:!!undo(ctx.statement.runtime)}:{applied:false};},
  rollbackCompletion(ctx){const runtime=ctx.statement.runtime;if(!runtime||!runtime.checked)return {applied:false};
    if(typeof restoreCoreMemoryTargets==='function')restoreCoreMemoryTargets(ctx.program.memory,runtime.beforeEffectMemory);
    runtime.checked=false;runtime.assignedValue=null;runtime.correctSteps=0;runtime.totalOpSteps=0;
    runtime.wasCorrectAssignment=null;runtime.beforeEffectMemory=null;return {applied:true,reopenFocus:'condition-expression'};},
  reset(ctx){const runtime=ctx.statement.runtime;if(!runtime)return {applied:false};
    const changed=runtime.checked||(runtime.trace&&runtime.trace.length>0);
    if(runtime.originalFlat){runtime.workingFlat=deepCloneFlat(runtime.originalFlat);runtime.history=[deepCloneFlat(runtime.originalFlat)];}
    runtime.trace=[];runtime.checked=false;runtime.assignedValue=null;runtime.correctSteps=0;
    runtime.totalOpSteps=0;runtime.wasCorrectAssignment=null;runtime.beforeEffectMemory=null;return {applied:changed};},
  buildCanonicalTrace(ctx){const runtime=ctx.statement.runtime;
    if(ctx.statement.loopKind==='do')return [{type:'LOOP',action:'LOOP',statementId:ctx.statement.id,value:true}];
    return runtime.canonicalTrace.steps.map(step=>Object.assign({statementId:ctx.statement.id},step))
      .concat({type:'LOOP',action:'LOOP',statementId:ctx.statement.id,value:runtime.expectedValue});}
});
