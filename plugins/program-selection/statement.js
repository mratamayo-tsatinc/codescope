function selectionExpressionResolved(statement){
  const runtime=statement.runtime;
  return !!(runtime&&runtime.workingFlat&&runtime.workingFlat.operands.length===1
    &&isFlatOperandReady(runtime.workingFlat.operands[0]));
}

function syncSelectionOperands(statement,program){
  if(statement.runtime.trace.length) return;
  statement.runtime.workingFlat.operands.forEach(function sync(operand){
    if(operand.kind==='unary') return sync(operand.inner);
    if(operand.kind==='variable'||operand.kind==='constant'){
      const binding=program.memory[operand.name];
      if(binding&&binding.initialized) operand.declaredValue=binding.value;
    }
  });
  statement.runtime.history[0]=deepCloneFlat(statement.runtime.workingFlat);
}

function selectionDecision(statement,value){
  if(statement.selectionKind==='switch'){
    const matched=statement.branches.find(branch=>branch.value===value)
      ||statement.branches.find(branch=>branch.default);
    return matched||null;
  }
  return value?statement.branches.find(branch=>branch.when===true)
    :statement.branches.find(branch=>branch.when===false);
}

function completeSelection(statement,value){
  const runtime=statement.runtime,branch=selectionDecision(statement,value);
  if(!branch) return {applied:false};
  const evaluations=runtime.trace.filter(step=>step.action==='EVALUATE');
  runtime.checked=true;runtime.assignedValue=value;runtime.selectedTargetLine=branch.targetLine;
  runtime.selectedTargetText=branch.targetText;runtime.selectedTargetStatementId=branch.nextStatementId;
  runtime.selectedLabel=branch.label;runtime.correctSteps=evaluations.filter(step=>step.wasCorrect).length;
  runtime.totalOpSteps=evaluations.length;runtime.wasCorrectAssignment=value===runtime.expectedValue;
  return {applied:true,completed:true,nextStatementId:branch.nextStatementId,
    event:{type:'BRANCH',action:'BRANCH',statementId:statement.id,value,
      targetLine:branch.targetLine,label:branch.label,wasCorrect:runtime.wasCorrectAssignment}};
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
    syncSelectionOperands(statement,program);
    if(action.type==='commit-branch') return selectionExpressionResolved(statement)
      ?completeSelection(statement,flatOperandValue(runtime.workingFlat.operands[0])):{applied:false};
    const apply=ctx.services&&ctx.services.applyExpressionAction;
    if(typeof apply!=='function'||!apply(runtime,action)) return {applied:false};
    return selectionExpressionResolved(statement)
      ?completeSelection(statement,flatOperandValue(runtime.workingFlat.operands[0])):{applied:true};
  },
  canUndo(ctx){return !!(ctx.statement.runtime&&!ctx.statement.runtime.checked&&ctx.statement.runtime.history.length>1);},
  undo(ctx){const undo=ctx.services&&ctx.services.undoExpressionAction;
    return typeof undo==='function'?{applied:!!undo(ctx.statement.runtime)}:{applied:false};},
  rollbackCompletion(ctx){const runtime=ctx.statement.runtime;if(!runtime||!runtime.checked)return {applied:false};
    runtime.checked=false;runtime.assignedValue=null;runtime.selectedTargetLine=null;runtime.selectedTargetText=null;runtime.selectedTargetStatementId=null;
    runtime.selectedLabel=null;runtime.correctSteps=0;runtime.totalOpSteps=0;runtime.wasCorrectAssignment=null;
    return {applied:true};},
  reset(ctx){const runtime=ctx.statement.runtime;if(!runtime)return {applied:false};
    const changed=runtime.checked||runtime.trace.length>0;
    runtime.workingFlat=deepCloneFlat(runtime.originalFlat);runtime.history=[deepCloneFlat(runtime.originalFlat)];
    runtime.trace=[];runtime.checked=false;runtime.assignedValue=null;runtime.selectedTargetLine=null;runtime.selectedTargetStatementId=null;
    runtime.selectedTargetText=null;runtime.selectedLabel=null;runtime.correctSteps=0;runtime.totalOpSteps=0;
    runtime.wasCorrectAssignment=null;return {applied:changed};},
  buildCanonicalTrace(ctx){const runtime=ctx.statement.runtime;
    return runtime.canonicalTrace.steps.map(step=>Object.assign({statementId:ctx.statement.id},step))
      .concat({type:'BRANCH',action:'BRANCH',statementId:ctx.statement.id,value:runtime.expectedValue});}
});
