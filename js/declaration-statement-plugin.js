// ============================================================================
// DECLARATION STATEMENT PLUGIN
// ----------------------------------------------------------------------------
// Executes initializer expressions through the existing expression service,
// then commits the resolved value into Program Core memory when the student
// activates the declaration's assignment operator.
// ============================================================================

function declarationDependenciesReady(statement, program){
  return (statement.dependencies || []).every(name=>{
    const binding = program.memory[name];
    return binding && binding.initialized;
  });
}

function declarationInitializerResolved(statement){
  const runtime = statement.runtime;
  return !!(runtime && runtime.workingFlat && runtime.workingFlat.operands.length===1
    && isFlatOperandReady(runtime.workingFlat.operands[0]));
}

function declarationHasInitializer(statement){return statement&&statement.initialized!==false;}

function syncDeclarationOperandsFromMemory(statement, program){
  const runtime = statement.runtime;
  if(!runtime || runtime.trace.length>0) return;
  if(runtime.originalTree&&typeof applyProgramMemoryToTree==='function'){
    applyProgramMemoryToTree(runtime.originalTree,program.memory);
    runtime.expectedValue=evalTree(runtime.originalTree);
    runtime.canonicalTrace=buildCanonicalTrace(runtime.originalTree);
  }
  function syncOperand(operand){
    if(!operand) return;
    if(operand.kind==='unary'){
      syncOperand(operand.inner);
      return;
    }
    if(operand.kind==='variable' || operand.kind==='constant'){
      const binding = program.memory[operand.name];
      if(binding && binding.initialized) operand.declaredValue = binding.value;
    }
  }
  runtime.workingFlat.operands.forEach(syncOperand);
  runtime.history[0] = deepCloneFlat(runtime.workingFlat);
}

registerStatementPlugin({
  kind: 'declaration',
  scoresCommit: true,

  interactionPlan(ctx){
    if(!declarationHasInitializer(ctx.statement)){
      return {mode:'direct',action:{type:'declare-binding',statementId:ctx.statement.id},label:'Declare variable'};
    }
    const ready=declarationDependenciesReady(ctx.statement,ctx.program)
      &&declarationInitializerResolved(ctx.statement);
    return ready
      ? {mode:'direct',action:{type:'commit-assignment',statementId:ctx.statement.id},label:'Execute declaration'}
      : {mode:'modal',focus:'expression',label:'Evaluate declaration'};
  },

  classifyRejectedAction(ctx){
    if(ctx.action&&ctx.action.type==='commit-assignment'
      &&!declarationInitializerResolved(ctx.statement)) return 'initializer-unresolved';
    return null;
  },

  applyAction(ctx){
    const {statement, program, action} = ctx;
    const runtime = statement.runtime;
    if(!runtime || runtime.checked || !declarationDependenciesReady(statement, program)) return {applied:false};
    syncDeclarationOperandsFromMemory(statement, program);

    if(action.type==='declare-binding'&&!declarationHasInitializer(statement)){
      runtime.checked=true;
      runtime.wasCorrectAssignment=true;
      program.memory[statement.binding.name]={
        name:statement.binding.name,
        kind:statement.binding.kind,
        dataType:statement.binding.dataType,
        mutable:statement.binding.mutable,
        initialized:false,
        value:null,
        lastStatementId:statement.id
      };
      return {applied:true,completed:true,event:{
        type:'DECLARE',action:'DECLARE',statementId:statement.id,
        target:statement.binding.name,dataType:statement.binding.dataType,wasCorrect:true
      }};
    }

    if(action.type === 'commit-assignment'){
      if(!declarationInitializerResolved(statement)) return {applied:false};
      const derivedValue = flatOperandValue(runtime.workingFlat.operands[0]);
      const value = action.manualResponse ? action.manualResponse.value : derivedValue;
      const evalSteps = runtime.trace.filter(step=>step.action==='EVALUATE');
      runtime.checked = true;
      runtime.assignedValue = value;
      runtime.manualCommitResponse=action.manualResponse||null;
      runtime.correctSteps = evalSteps.filter(step=>step.wasCorrect).length;
      runtime.totalOpSteps = evalSteps.length;
      runtime.wasCorrectAssignment = value === runtime.expectedValue;
      program.memory[statement.binding.name] = {
        name:statement.binding.name,
        kind:statement.binding.kind,
        dataType:statement.binding.dataType,
        mutable:statement.binding.mutable,
        initialized:true,
        value,
        lastStatementId:statement.id
      };
      return {
        applied:true,
        completed:true,
        event:{
          type:'ASSIGN', action:'ASSIGN', statementId:statement.id,
          target:statement.binding.name, value,
          expectedValue:runtime.expectedValue,
          wasCorrect:runtime.wasCorrectAssignment
        }
      };
    }

    const apply = ctx.services && ctx.services.applyExpressionAction;
    return typeof apply === 'function'
      ? {applied:!!apply(runtime, action)}
      : {applied:false};
  },

  canUndo(ctx){
    const runtime = ctx.statement.runtime;
    return !!(runtime && !runtime.checked && runtime.history && runtime.history.length>1);
  },

  undo(ctx){
    const runtime = ctx.statement.runtime;
    const undo = ctx.services && ctx.services.undoExpressionAction;
    return typeof undo === 'function'
      ? {applied:!!undo(runtime)}
      : {applied:false};
  },

  rollbackCompletion(ctx){
    const runtime = ctx.statement.runtime;
    if(!runtime || !runtime.checked) return {applied:false};
    delete ctx.program.memory[ctx.statement.binding.name];
    runtime.checked = false;
    runtime.assignedValue = null;
    runtime.manualCommitResponse = null;
    runtime.wasCorrectAssignment = null;
    runtime.correctSteps = 0;
    runtime.totalOpSteps = 0;
    if(Array.isArray(ctx.item._bindings)){
      const binding = ctx.item._bindings.find(b=>b.statementId===ctx.statement.id);
      if(binding) binding._flashed = false;
    }
    for(let i=ctx.program.events.length-1; i>=0; i--){
      if(ctx.program.events[i].statementId === ctx.statement.id){
        ctx.program.events.splice(i,1);
        break;
      }
    }
    return {applied:true};
  },

  reset(ctx){
    const runtime = ctx.statement.runtime;
    if(!runtime) return {applied:false};
    const changed = runtime.checked || runtime.trace.length>0 || runtime.history.length>1;
    runtime.workingFlat = deepCloneFlat(runtime.originalFlat);
    runtime.history = [deepCloneFlat(runtime.originalFlat)];
    runtime.trace = [];
    runtime.checked = false;
    runtime.assignedValue = null;
    runtime.manualCommitResponse = null;
    runtime.wasCorrectAssignment = null;
    runtime.correctSteps = 0;
    runtime.totalOpSteps = 0;
    return {applied:changed};
  },

  buildCanonicalTrace(ctx){
    const runtime = ctx.statement.runtime;
    if(!runtime || !runtime.canonicalTrace) return [];
    if(!declarationHasInitializer(ctx.statement)) return [{
      type:'DECLARE',action:'DECLARE',statementId:ctx.statement.id,
      target:ctx.statement.binding.name,dataType:ctx.statement.binding.dataType,wasCorrect:true
    }];
    const steps = runtime.canonicalTrace.steps.map(step=>Object.assign({statementId:ctx.statement.id}, step));
    steps.push({
      type:'ASSIGN', action:'ASSIGN', statementId:ctx.statement.id,
      target:ctx.statement.binding.name,
      value:runtime.expectedValue,
      expectedValue:runtime.expectedValue,
      wasCorrect:true
    });
    return steps;
  }
});
