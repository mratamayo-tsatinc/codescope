// ============================================================================
// SHARED SELECTION STATEMENT CORE
// ----------------------------------------------------------------------------
// Parses and evaluates if, else-if, and switch conditions. Branch destinations
// are supplied by the program control-flow builder and selected here without UI
// knowledge.
// ============================================================================

function coreSelectionHeader(source){
  const text=String(source||'').trim().replace(/^}\s*/,'').replace(/\{\s*$/,'').trim();
  const conditional=/^(if|else\s+if)\s*\(([\s\S]+)\)$/.exec(text);
  if(conditional)return {selectionKind:conditional[1]==='if'?'if':'else-if',conditionSource:conditional[2].trim()};
  const switched=/^switch\s*\(([\s\S]+)\)$/.exec(text);
  return switched?{selectionKind:'switch',conditionSource:switched[1].trim()}:null;
}

function parseCoreSelectionStatement(request,symbols,location){
  const header=coreSelectionHeader(request.source);if(!header)return null;
  const parsed=coreParseExpression({language:request.language,source:header.conditionSource,symbols,location});
  return selectionStatement({selectionKind:header.selectionKind,condition:parsed.ir,
    conditionSource:header.conditionSource,branches:request.branches||[],sourceSpan:location});
}

function coreSwitchLabel(source,request,symbols,location){
  const text=String(source||'').trim();
  if(/^default\s*:$/.test(text))return {default:true,label:'default',value:null,expression:null};
  const match=/^case\s+([\s\S]+)\s*:$/.exec(text);if(!match)return null;
  const expressionSource=match[1].trim();
  const parsed=coreParseExpression({language:request&&request.language||'c',source:expressionSource,
    symbols:coreExpressionSymbolTable(symbols),location});
  const evaluated=coreEvaluateExpression({language:request&&request.language||'c',expression:parsed.ir,
    memory:coreExpressionSymbolTable(symbols)});
  if(evaluated.effects.some(effect=>effect.kind==='write'))
    throw new Error(`${location&&location.filename||'source'}:${location&&location.start&&location.start.line||1}: case label cannot modify memory`);
  if(!['number','string'].includes(typeof evaluated.value))
    throw new Error(`${location&&location.filename||'source'}:${location&&location.start&&location.start.line||1}: unsupported case label value`);
  return {default:false,label:`case ${expressionSource}`,value:evaluated.value,expression:parsed.ir};
}

function coreSelectBranch(statement,value){
  if(statement.selectionKind==='switch')return statement.branches.find(branch=>branch.value===value)
    ||statement.branches.find(branch=>branch.default)||statement.branches.find(branch=>branch.noMatch)||null;
  return Boolean(value)?statement.branches.find(branch=>branch.when===true)||null
    :statement.branches.find(branch=>branch.when===false)||null;
}

function evaluateCoreSelectionStatement(statement,memory,language){
  const evaluated=coreEvaluateExpression({language:language||'c',expression:statement.condition,memory});
  const branch=coreSelectBranch(statement,evaluated.value),effects=evaluated.effects
    .map(effect=>Object.assign({scope:'expression'},effect));
  if(branch)effects.push({kind:'flow',scope:'statement',flow:'branch',value:evaluated.value,
    label:branch.label||null,targetLine:branch.targetLine||null,
    nextStatementId:branch.nextStatementId||branch.targetStatementId||'$end'});
  return {value:evaluated.value,dependencies:evaluated.dependencies,effects,
    trace:[...evaluated.trace,{action:'BRANCH',value:evaluated.value,label:branch&&branch.label||null,
      targetLine:branch&&branch.targetLine||null,nextStatementId:branch&&(branch.nextStatementId||branch.targetStatementId)||null}]};
}
