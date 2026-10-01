// ============================================================================
// SHARED EXPRESSION SEMANTICS
// ----------------------------------------------------------------------------
// Evaluates canonical expression IR without mutating caller memory. Observable
// reads and writes are returned as explicit effects; statement execution may
// commit those writes only after the learner completes the expression.
// ============================================================================

function coreExpressionMemory(memory){
  const result={};
  Object.entries(memory||{}).forEach(([name,row])=>{
    result[name]=row&&typeof row==='object'&&!Array.isArray(row)
      ?Object.assign({name,initialized:row.value!==undefined,mutable:row.kind!=='constant'},row)
      :{name,value:row,initialized:row!==undefined,mutable:true,kind:'variable'};
  });
  return result;
}

function evaluateCoreExpression(request){
  const expression=request.expression,memory=coreExpressionMemory(request.memory);
  const effects=[],trace=[];
  const evaluate=node=>{
    if(node.kind==='literal') return node.value;
    if(node.kind==='identifier'){
      const binding=memory[node.name];
      if(!binding||binding.initialized===false||binding.value===undefined)
        throw new Error(`Expression identifier '${node.name}' is used before it is initialized`);
      effects.push({kind:'read',target:node.name,value:binding.value});
      trace.push({action:'SUBSTITUTE',target:node.name,targetKind:binding.kind||node.bindingKind||'variable',sourceValue:binding.value});
      return binding.value;
    }
    if(node.kind==='unary'){
      const base=evaluate(node.operand),outcome=evaluateUnaryOperation(node.operator,node.form||'prefix',base);
      const target=node.operand&&node.operand.kind==='identifier'?node.operand.name:null;
      if(outcome.hasWrite){
        if(!target) throw new Error(`${node.operator} requires an identifier operand`);
        const binding=memory[target];
        if(!binding||binding.mutable===false||binding.kind==='constant')
          throw new Error(`${node.operator} requires a mutable variable`);
        effects.push({kind:'write',target,previousValue:base,nextValue:outcome.writeValue,
          operator:node.operator,form:node.form||'prefix'});
        memory[target]=Object.assign({},binding,{value:outcome.writeValue,initialized:true});
      }
      trace.push({action:'UNARY',operator:node.operator,op:node.operator,form:node.form||'prefix',
        target,result:outcome.expressionValue,writeValue:outcome.writeValue,sourceValue:base});
      return outcome.expressionValue;
    }
    const left=evaluate(node.left),right=evaluate(node.right),result=evalOp(node.operator,left,right);
    trace.push({action:'EVALUATE',operator:node.operator,target:{operator:node.operator,operands:[left,right]},result});
    return result;
  };
  return {
    value:evaluate(expression),
    dependencies:[...collectExpressionDependencies(expression)],
    effects,
    trace
  };
}

function coreExpressionWriteEffectsFromTrace(trace,fallback){
  const writes=(trace||[]).filter(step=>step&&step.action==='UNARY'
    &&(step.op==='++'||step.op==='--'||step.operator==='++'||step.operator==='--')
    &&step.target&&Object.prototype.hasOwnProperty.call(step,'writeValue'))
    .map(step=>({kind:'write',target:step.target,previousValue:step.sourceValue,nextValue:step.writeValue,
      operator:step.op||step.operator,form:step.form||'prefix'}));
  return writes.length?writes:(fallback||[]).filter(effect=>effect.kind==='write');
}

function captureCoreMemoryTargets(memory,names){
  const snapshot={};
  [...new Set(names||[])].forEach(name=>{
    snapshot[name]=Object.prototype.hasOwnProperty.call(memory,name)
      ?{exists:true,value:memory[name]&&typeof memory[name]==='object'
        ?Object.assign({},memory[name]):memory[name]}
      :{exists:false,value:null};
  });
  return snapshot;
}

function restoreCoreMemoryTargets(memory,snapshot){
  Object.entries(snapshot||{}).forEach(([name,row])=>{
    if(!row.exists) delete memory[name];
    else memory[name]=row.value&&typeof row.value==='object'?Object.assign({},row.value):row.value;
  });
}

function applyCoreExpressionEffects(memory,effects,statementId){
  (effects||[]).filter(effect=>effect.kind==='write').forEach(effect=>{
    const current=memory[effect.target];
    if(current&&typeof current==='object'&&!Array.isArray(current)){
      memory[effect.target]=Object.assign({},current,{value:effect.nextValue,initialized:true,
        lastStatementId:statementId||current.lastStatementId||null});
    }else memory[effect.target]=effect.nextValue;
  });
  return memory;
}

function evaluateAndApplyCoreExpression(expression,memory,language,statementId){
  const result=coreEvaluateExpression({language:language||'c',expression,memory});
  applyCoreExpressionEffects(memory,result.effects,statementId);
  return result;
}

registerLanguageCoreService('evaluateExpression',evaluateCoreExpression);
