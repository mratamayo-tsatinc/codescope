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
    runtime.checked=false;runtime.assignedValue=null;runtime.selectedTargetLine=null;runtime.selectedTargetText=null;runtime.selectedTargetStatementId=null;
    runtime.selectedLabel=null;runtime.correctSteps=0;runtime.totalOpSteps=0;runtime.wasCorrectAssignment=null;
    runtime.beforeEffectMemory=null;runtime.expressionEffects=[];
    return {applied:true};},
  reset(ctx){const runtime=ctx.statement.runtime;if(!runtime)return {applied:false};
    const changed=runtime.checked||runtime.trace.length>0;
    runtime.workingFlat=deepCloneFlat(runtime.originalFlat);runtime.history=[deepCloneFlat(runtime.originalFlat)];
    runtime.trace=[];runtime.checked=false;runtime.assignedValue=null;runtime.selectedTargetLine=null;runtime.selectedTargetStatementId=null;
    runtime.selectedTargetText=null;runtime.selectedLabel=null;runtime.correctSteps=0;runtime.totalOpSteps=0;
    runtime.wasCorrectAssignment=null;runtime.beforeEffectMemory=null;runtime.expressionEffects=[];return {applied:changed};},
  buildCanonicalTrace(ctx){const runtime=ctx.statement.runtime;
    return runtime.canonicalTrace.steps.map(step=>Object.assign({statementId:ctx.statement.id},step))
      .concat({type:'BRANCH',action:'BRANCH',statementId:ctx.statement.id,value:runtime.expectedValue});}
});
