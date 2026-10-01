// ============================================================================
// SHARED SIMPLE STATEMENT SEMANTICS
// ----------------------------------------------------------------------------
// Evaluates canonical Statement IR without mutating caller memory. Activities
// decide when learner actions commit the returned effects and how to present
// the trace.
// ============================================================================

function coreApplyAssignmentOperator(operator,currentValue,rhsValue){
  if(operator==='=') return rhsValue;
  return evalOp(operator.slice(0,-1),currentValue,rhsValue);
}

function coreStatementBinding(memory,name){
  return coreExpressionMemory(memory)[name]||null;
}

function coreStatementExpressionResult(expression,memory,language){
  const result=coreEvaluateExpression({language:language||'c',expression,memory});
  return {
    value:result.value,
    dependencies:result.dependencies,
    effects:result.effects.map(effect=>Object.assign({scope:'expression'},effect)),
    trace:result.trace.slice()
  };
}

function coreDeclarationEffect(statement,value,initialized){
  if(!statement||statement.kind!=='declaration'||!statement.binding)
    throw new Error('Declaration effect requires canonical declaration IR');
  return {kind:'declare',scope:'statement',target:statement.binding.name,
    previousValue:undefined,nextValue:value,initialized:initialized!==false,
    binding:Object.assign({},statement.binding)};
}

function coreWriteEffect(statement,previousValue,nextValue){
  if(!statement||!['assignment','unary-update'].includes(statement.kind))
    throw new Error('Write effect requires canonical assignment or unary-update IR');
  return {kind:'write',scope:'statement',target:statement.target,previousValue,nextValue,
    operator:statement.operator,form:statement.form};
}

function executeCoreStatement(request){
  const statement=request.statement,memory=request.memory||{},language=request.language||'c';
  if(statement.kind==='loop')return evaluateCoreLoopStatement(statement,memory,language,request.phase);
  if(statement.kind==='selection')return evaluateCoreSelectionStatement(statement,memory,language);
  if(statement.kind==='input')return evaluateCoreInputStatement(statement,memory,language);
  if(statement.kind==='output')return evaluateCoreOutputStatement(statement,memory,language);
  if(statement.kind==='declaration'){
    const current=coreStatementBinding(memory,statement.binding.name);
    if(current) throw new Error(`Duplicate declaration '${statement.binding.name}'`);
    const expression=statement.initialized!==false
      ?coreStatementExpressionResult(statement.initializer,memory,language)
      :{value:undefined,dependencies:[],effects:[],trace:[]};
    const effect=coreDeclarationEffect(statement,expression.value,statement.initialized!==false);
    return {value:expression.value,dependencies:expression.dependencies,
      effects:[...expression.effects,effect],trace:[...expression.trace,{action:'DECLARE',
        target:statement.binding.name,value:expression.value,initialized:statement.initialized!==false}]};
  }
  if(statement.kind==='assignment'){
    const target=coreStatementBinding(memory,statement.target);
    if(!target||target.mutable===false||target.kind==='constant')
      throw new Error(`Assignment requires mutable variable '${statement.target}'`);
    if(statement.operator!=='='&&(target.initialized===false||target.value===undefined))
      throw new Error(`'${statement.target}' is used before it is initialized`);
    const expression=coreStatementExpressionResult(statement.value,memory,language);
    const value=coreApplyAssignmentOperator(statement.operator,target.value,expression.value);
    const effect=coreWriteEffect(statement,target.value,value);
    return {value,dependencies:[...new Set([statement.target,...expression.dependencies])],
      effects:[...expression.effects,effect],trace:[...expression.trace,{action:'ASSIGN',
        target:statement.target,operator:statement.operator,beforeValue:target.value,
        rhsValue:expression.value,result:value}]};
  }
  if(statement.kind==='unary-update'){
    const target=coreStatementBinding(memory,statement.target);
    if(!target||target.initialized===false||target.value===undefined)
      throw new Error(`'${statement.target}' is used before it is initialized`);
    if(target.mutable===false||target.kind==='constant')
      throw new Error(`Unary update requires mutable variable '${statement.target}'`);
    const outcome=evaluateUnaryOperation(statement.operator,statement.form,target.value);
    return {value:outcome.writeValue,dependencies:[statement.target],effects:[
      {kind:'read',scope:'expression',target:statement.target,value:target.value},
      coreWriteEffect(statement,target.value,outcome.writeValue)
    ],trace:[
      {action:'SUBSTITUTE',target:statement.target,targetKind:'variable',sourceValue:target.value},
      {action:'UNARY',target:statement.target,operator:statement.operator,op:statement.operator,
        form:statement.form,sourceValue:target.value,result:outcome.writeValue,writeValue:outcome.writeValue}
    ]};
  }
  if(statement.kind==='program-break') return {value:null,dependencies:[],effects:[
    {kind:'flow',scope:'statement',flow:'break',nextStatementId:statement.nextStatementId||'$end'}
  ],trace:[{action:'BREAK',nextStatementId:statement.nextStatementId||'$end'}]};
  if(statement.kind==='program-return') return {value:statement.value,dependencies:[],effects:[
    {kind:'flow',scope:'statement',flow:'return',value:statement.value,nextStatementId:'$end'}
  ],trace:[{action:'RETURN',value:statement.value}]};
  throw new Error(`Statement semantics do not support '${statement.kind}'`);
}

function applyCoreStatementEffects(memory,effects,statementId,mode){
  (effects||[]).forEach(effect=>{
    if(effect.kind!=='write'&&effect.kind!=='declare') return;
    const current=memory[effect.target];
    const useObjects=mode==='bindings'||(mode!=='raw'&&current&&typeof current==='object'&&!Array.isArray(current));
    if(!useObjects){memory[effect.target]=effect.nextValue;return;}
    const binding=effect.binding||{};
    memory[effect.target]=Object.assign({},current&&typeof current==='object'?current:{},binding,{
      name:effect.target,value:effect.nextValue,
      initialized:effect.kind==='declare'?effect.initialized!==false:true,
      kind:binding.mutable===false?'constant':((current&&current.kind)||'variable'),
      mutable:binding.mutable===false?false:((current&&current.mutable)!==false),
      lastStatementId:statementId||null
    });
  });
  return memory;
}

function evaluateAndApplyCoreStatement(statement,memory,language,statementId,mode){
  const result=coreExecuteStatement({language:language||'c',statement,memory});
  applyCoreStatementEffects(memory,result.effects,statementId,mode);
  return result;
}

registerLanguageCoreService('executeStatement',executeCoreStatement);
