// ============================================================================
// LANGUAGE CORE CONTRACTS
// ----------------------------------------------------------------------------
// Stable boundary for generated content, source adapters, execution services
// and activity presentations. Phase 1 defines the contract only; later phases
// register production parsers and evaluators while compatibility paths remain
// operational.
// ============================================================================

const LANGUAGE_CORE_CONTRACT_VERSION=1;
const LANGUAGE_CORE_SERVICE_NAMES=Object.freeze([
  'parseExpression','parseStatement','evaluateExpression','executeStatement','parseProgram'
]);
const languageCoreServiceRegistry=new Map();

function languageCorePlainObject(value,label){
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function languageCorePositiveInteger(value,fallback,label){
  const result=value==null?fallback:Number(value);
  if(!Number.isInteger(result)||result<1) throw new Error(`${label} must be a positive integer`);
  return result;
}

function languageCoreSourcePosition(value,fallback,label){
  value=value||{};
  return Object.freeze({
    line:languageCorePositiveInteger(value.line,fallback.line,`${label}.line`),
    column:languageCorePositiveInteger(value.column,fallback.column,`${label}.column`)
  });
}

function languageCoreSourceLocation(spec){
  spec=spec||{};
  const start=languageCoreSourcePosition(spec.start||spec,{line:1,column:1},'sourceLocation.start');
  const end=languageCoreSourcePosition(spec.end||start,start,'sourceLocation.end');
  if(end.line<start.line||(end.line===start.line&&end.column<start.column))
    throw new Error('sourceLocation.end must not precede sourceLocation.start');
  return Object.freeze({filename:spec.filename==null?null:String(spec.filename),start,end});
}

function languageCoreDiagnostic(spec){
  languageCorePlainObject(spec,'Diagnostic');
  const severity=spec.severity||'error';
  if(!['error','warning','info'].includes(severity)) throw new Error(`Unsupported diagnostic severity '${severity}'`);
  if(typeof spec.code!=='string'||!spec.code.trim()) throw new Error('Diagnostic requires a code');
  if(typeof spec.message!=='string'||!spec.message.trim()) throw new Error('Diagnostic requires a message');
  return Object.freeze({
    code:spec.code.trim(),severity,message:spec.message.trim(),
    location:spec.location?languageCoreSourceLocation(spec.location):null,
    recoverable:spec.recoverable===true
  });
}

function languageCoreEffect(spec){
  languageCorePlainObject(spec,'Effect');
  if(typeof spec.kind!=='string'||!spec.kind.trim()) throw new Error('Effect requires a kind');
  return Object.freeze(Object.assign({},spec,{kind:spec.kind.trim()}));
}

function languageCoreTraceEvent(spec){
  languageCorePlainObject(spec,'Trace event');
  if(typeof spec.action!=='string'||!spec.action.trim()) throw new Error('Trace event requires an action');
  return Object.freeze(Object.assign({},spec,{action:spec.action.trim()}));
}

function languageCoreResult(spec){
  spec=spec||{};
  const result={
    contractVersion:LANGUAGE_CORE_CONTRACT_VERSION,
    ir:Object.prototype.hasOwnProperty.call(spec,'ir')?spec.ir:null,
    diagnostics:Object.freeze((spec.diagnostics||[]).map(languageCoreDiagnostic)),
    dependencies:Object.freeze([...new Set((spec.dependencies||[]).map(value=>String(value)))]),
    effects:Object.freeze((spec.effects||[]).map(languageCoreEffect)),
    trace:Object.freeze((spec.trace||[]).map(languageCoreTraceEvent))
  };
  if(Object.prototype.hasOwnProperty.call(spec,'value')) result.value=spec.value;
  return Object.freeze(result);
}

function assertExpressionIr(expression,path){
  path=path||'expression';
  languageCorePlainObject(expression,path);
  switch(expression.kind){
    case 'literal':
      if(!Object.prototype.hasOwnProperty.call(expression,'value')) throw new Error(`${path} literal requires a value`);
      break;
    case 'identifier':
      if(typeof expression.name!=='string'||!expression.name) throw new Error(`${path} identifier requires a name`);
      break;
    case 'unary':
      if(typeof expression.operator!=='string'||!expression.operator) throw new Error(`${path} unary expression requires an operator`);
      if(expression.form!=null&&!['prefix','postfix'].includes(expression.form))
        throw new Error(`${path} unary form must be prefix or postfix`);
      assertExpressionIr(expression.operand,`${path}.operand`);
      break;
    case 'binary':
      if(typeof expression.operator!=='string'||!expression.operator) throw new Error(`${path} binary expression requires an operator`);
      assertExpressionIr(expression.left,`${path}.left`);
      assertExpressionIr(expression.right,`${path}.right`);
      break;
    default:
      throw new Error(`${path} has unsupported kind '${expression.kind}'`);
  }
  if(expression.sourceSpan) languageCoreSourceLocation(expression.sourceSpan);
  return expression;
}

function assertStatementIr(statement,path){
  path=path||'statement';
  languageCorePlainObject(statement,path);
  if(typeof statement.kind!=='string'||!statement.kind) throw new Error(`${path} requires a kind`);
  if(statement.sourceSpan) languageCoreSourceLocation(statement.sourceSpan);
  if(statement.kind==='declaration'){
    if(!statement.binding||typeof statement.binding.name!=='string'||!statement.binding.name)
      throw new Error(`${path} declaration requires a binding`);
    if(statement.initialized!==false) assertExpressionIr(statement.initializer,`${path}.initializer`);
  }else if(statement.kind==='assignment'){
    if(typeof statement.target!=='string'||!statement.target) throw new Error(`${path} assignment requires a target`);
    if(!ASSIGNMENT_OPERATORS.includes(statement.operator)) throw new Error(`${path} has unsupported assignment operator '${statement.operator}'`);
    assertExpressionIr(statement.value,`${path}.value`);
  }else if(statement.kind==='unary-update'){
    if(typeof statement.target!=='string'||!statement.target) throw new Error(`${path} unary update requires a target`);
    if(!['++','--'].includes(statement.operator)) throw new Error(`${path} has unsupported unary update operator '${statement.operator}'`);
    if(!['prefix','postfix'].includes(statement.form)) throw new Error(`${path} unary update requires prefix or postfix form`);
  }else if(statement.kind==='expression'){
    assertExpressionIr(statement.expression,`${path}.expression`);
  }else if(statement.kind==='output'){
    if(!Array.isArray(statement.parts)||!statement.parts.length) throw new Error(`${path} output requires parts`);
    statement.parts.forEach((part,index)=>{
      if(part.kind==='text') return;
      if(part.kind==='expression') return assertExpressionIr(part.expression,`${path}.parts[${index}].expression`);
      throw new Error(`${path}.parts[${index}] has unsupported kind '${part.kind}'`);
    });
  }else if(statement.kind==='input'){
    if(!Array.isArray(statement.reads)||!statement.reads.length) throw new Error(`${path} input requires reads`);
    statement.reads.forEach((read,index)=>{
      if(!read||typeof read.target!=='string'||!read.target) throw new Error(`${path}.reads[${index}] requires a target`);
    });
  }else if(statement.kind==='selection'){
    if(!['if','else-if','switch'].includes(statement.selectionKind)) throw new Error(`${path} has unsupported selection kind`);
    assertExpressionIr(statement.condition,`${path}.condition`);
    if(!Array.isArray(statement.branches)) throw new Error(`${path} selection requires branches`);
  }else if(statement.kind==='loop'){
    if(!['while','do','do-while','for'].includes(statement.loopKind)) throw new Error(`${path} has unsupported loop kind`);
    if(statement.loopKind!=='do')assertExpressionIr(statement.condition,`${path}.condition`);
    if(statement.initializer)assertStatementIr(statement.initializer,`${path}.initializer`);
    if(statement.update)assertStatementIr(statement.update,`${path}.update`);
    if(!Array.isArray(statement.branches)) throw new Error(`${path} loop requires branches`);
  }
  // Future statement extensions keep their current fields until their
  // semantics migrate into the core.
  return statement;
}

function languageCoreProgramIr(spec){
  languageCorePlainObject(spec,'Program IR');
  if(typeof spec.language!=='string'||!spec.language.trim()) throw new Error('Program IR requires a language');
  if(!Array.isArray(spec.statements)||!spec.statements.length) throw new Error('Program IR requires statements');
  spec.statements.forEach((statement,index)=>assertStatementIr(statement,`program.statements[${index}]`));
  return Object.freeze({
    schemaVersion:spec.schemaVersion||PROGRAM_IR_SCHEMA_VERSION,
    language:spec.language.trim().toLowerCase(),
    statements:Object.freeze(spec.statements.slice()),
    source:spec.source==null?null:String(spec.source),
    metadata:spec.metadata&&typeof spec.metadata==='object'?Object.freeze(Object.assign({},spec.metadata)):null
  });
}

function registerLanguageCoreService(name,handler){
  if(!LANGUAGE_CORE_SERVICE_NAMES.includes(name)) throw new Error(`Unknown language-core service '${name}'`);
  if(typeof handler!=='function') throw new Error(`Language-core service '${name}' requires a function`);
  if(languageCoreServiceRegistry.has(name)) throw new Error(`Language-core service '${name}' is already registered`);
  languageCoreServiceRegistry.set(name,handler);
  return handler;
}

function languageCoreService(name){return languageCoreServiceRegistry.get(name)||null;}

function languageCoreRequest(spec,requiresSource){
  languageCorePlainObject(spec,'Language-core request');
  if(typeof spec.language!=='string'||!spec.language.trim()) throw new Error('Language-core request requires a language');
  if(requiresSource&&typeof spec.source!=='string') throw new Error('Language-core parse request requires source text');
  return Object.assign({},spec,{language:spec.language.trim().toLowerCase()});
}

function invokeLanguageCoreService(name,spec,requiresSource){
  const handler=languageCoreService(name);
  if(!handler) throw new Error(`Language-core service '${name}' is not registered`);
  const result=languageCoreResult(handler(languageCoreRequest(spec,requiresSource))||{});
  if(name==='parseExpression'&&result.ir) assertExpressionIr(result.ir);
  if(name==='parseStatement'&&result.ir) assertStatementIr(result.ir);
  if(name==='parseProgram'&&result.ir) languageCoreProgramIr(result.ir);
  return result;
}

function coreParseExpression(spec){return invokeLanguageCoreService('parseExpression',spec,true);}
function coreParseStatement(spec){return invokeLanguageCoreService('parseStatement',spec,true);}
function coreEvaluateExpression(spec){
  const request=languageCoreRequest(spec,false);assertExpressionIr(request.expression);
  return invokeLanguageCoreService('evaluateExpression',request,false);
}
function coreExecuteStatement(spec){
  const request=languageCoreRequest(spec,false);assertStatementIr(request.statement);
  return invokeLanguageCoreService('executeStatement',request,false);
}
function coreParseProgram(spec){return invokeLanguageCoreService('parseProgram',spec,true);}
