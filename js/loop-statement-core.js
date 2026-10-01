// ============================================================================
// SHARED LOOP STATEMENT CORE
// ----------------------------------------------------------------------------
// Parses and evaluates C/Java while, do...while and for control clauses. The
// core reports condition, initializer, update and branch effects without
// knowing how an activity renders iterations or connector animations.
// ============================================================================

function coreLoopSplitFor(source){
  const parts=[];let buffer='',depth=0,quote=null,escaped=false;
  for(const character of String(source||'')){
    if(quote){buffer+=character;if(escaped)escaped=false;else if(character==='\\')escaped=true;
      else if(character===quote)quote=null;continue;}
    if(character==='"'||character==="'"){quote=character;buffer+=character;continue;}
    if(character==='('){depth++;buffer+=character;continue;}
    if(character===')'){depth--;buffer+=character;continue;}
    if(character===';'&&depth===0){parts.push(buffer.trim());buffer='';continue;}
    buffer+=character;
  }
  parts.push(buffer.trim());
  return parts;
}

function coreLoopHeader(source,options){
  const raw=String(source||'').trim(),text=raw.replace(/^}\s*/,'').replace(/\{\s*$/,'').replace(/;\s*$/,'').trim();
  if(/^do$/.test(text))return {loopKind:'do',conditionSource:null};
  const forMatch=/^for\s*\(([\s\S]*)\)$/.exec(text);
  if(forMatch){const parts=coreLoopSplitFor(forMatch[1]);if(parts.length!==3)return null;
    return {loopKind:'for',initializerSource:parts[0],conditionSource:parts[1],updateSource:parts[2]};}
  const whileMatch=/^while\s*\(([\s\S]+)\)$/.exec(text);
  if(!whileMatch)return null;
  return {loopKind:options&&options.doWhile?'do-while':'while',conditionSource:whileMatch[1].trim()};
}

function coreLoopControlStatement(source,request,symbols,location){
  if(!source)return null;
  const parsed=coreParseStatement(Object.assign({},request,{source,symbols,location,_skipLoop:true}));
  if(parsed.ir)return parsed.ir;
  const expression=coreParseExpression({language:request.language,source,symbols,location});
  return expressionStatement(expression.ir,{sourceSpan:location});
}

function parseCoreLoopStatement(request,symbols,location){
  const header=coreLoopHeader(request.source,{doWhile:request.doWhile===true});if(!header)return null;
  if(header.loopKind==='do')return loopStatement({loopKind:'do',branches:request.branches||[],sourceSpan:location});
  const initializer=header.loopKind==='for'
    ?coreLoopControlStatement(header.initializerSource,request,symbols,location):null;
  let expressionSymbols=symbols;
  if(initializer){
    expressionSymbols=coreExpressionSymbolTable(symbols);
    try{
      const preview=coreExecuteStatement({language:request.language,statement:initializer,memory:expressionSymbols});
      applyCoreStatementEffects(expressionSymbols,preview.effects,null,'bindings');
    }catch(error){
      // Parsing still reports the original statement error below if the
      // control clause cannot establish the identifiers used by the loop.
    }
  }
  const conditionSource=header.conditionSource||'true';
  const condition=coreParseExpression({language:request.language,source:conditionSource,symbols:expressionSymbols,location}).ir;
  const update=header.loopKind==='for'
    ?coreLoopControlStatement(header.updateSource,request,expressionSymbols,location):null;
  return loopStatement({loopKind:header.loopKind,condition,conditionSource:header.conditionSource,
    initializer,initializerSource:header.initializerSource,update,updateSource:header.updateSource,
    branches:request.branches||[],sourceSpan:location});
}

function coreSelectLoopBranch(statement,value){
  return Boolean(value)?statement.branches.find(branch=>branch.when===true)||null
    :statement.branches.find(branch=>branch.when===false)||null;
}

function coreLoopScopedResult(result,scope){
  return {value:result.value,dependencies:result.dependencies,
    effects:result.effects.map(effect=>Object.assign({},effect,{scope})),trace:result.trace.slice()};
}

function evaluateCoreLoopStatement(statement,memory,language,phase){
  phase=phase||'condition';
  if(phase==='initialize'){
    if(!statement.initializer)return {value:null,dependencies:[],effects:[],trace:[{action:'LOOP_INITIALIZE',skipped:true}]};
    const result=coreExecuteStatement({language:language||'c',statement:statement.initializer,memory});
    const scoped=coreLoopScopedResult(result,'loop-initializer');
    scoped.trace.push({action:'LOOP_INITIALIZE',value:result.value});return scoped;
  }
  if(phase==='update'){
    if(!statement.update)return {value:null,dependencies:[],effects:[],trace:[{action:'LOOP_UPDATE',skipped:true}]};
    const result=coreExecuteStatement({language:language||'c',statement:statement.update,memory});
    const scoped=coreLoopScopedResult(result,'loop-update');
    scoped.trace.push({action:'LOOP_UPDATE',value:result.value});return scoped;
  }
  const evaluated=statement.loopKind==='do'
    ?{value:true,dependencies:[],effects:[],trace:[]}
    :coreEvaluateExpression({language:language||'c',expression:statement.condition,memory});
  const branch=coreSelectLoopBranch(statement,evaluated.value);
  const effects=evaluated.effects.map(effect=>Object.assign({},effect,{scope:'expression'}));
  if(branch)effects.push({kind:'flow',scope:'statement',flow:'loop-branch',value:evaluated.value,
    label:branch.label||null,targetLine:branch.targetLine||null,
    nextStatementId:branch.nextStatementId||branch.targetStatementId||'$end'});
  return {value:evaluated.value,dependencies:evaluated.dependencies,effects,
    trace:[...evaluated.trace,{action:'LOOP_CONDITION',loopKind:statement.loopKind,value:evaluated.value,
      label:branch&&branch.label||null,targetLine:branch&&branch.targetLine||null,
      nextStatementId:branch&&(branch.nextStatementId||branch.targetStatementId)||null}]};
}
