// ============================================================================
// PROGRAM CORE — statement-agnostic orchestration
// ----------------------------------------------------------------------------
// An activity item may represent a whole program. Program Core owns ordering,
// dispatch, and access to shell language semantics. Registered adapters own
// learner interaction and presentation for each statement kind. Existing
// profiles are wrapped as one `legacy-expression` statement so their behavior
// and persisted item fields remain unchanged.
// ============================================================================

const PROGRAM_SCHEMA_VERSION = 1;
const statementPluginRegistry = new Map();
const statementRendererRegistry = new Map();

// Statement adapters control learner interaction and presentation. They
// receive language meaning exclusively through this shell-owned service.
// Keeping this boundary explicit prevents a presentation plugin from growing
// its own evaluator or control-flow implementation.
function programSemanticServices(program){
  const activeProgram=program||{language:'c',memory:{}};
  const unavailable=name=>{throw new Error(`Program semantic service '${name}' is unavailable`);};
  return Object.freeze({
    execute(statement,memory,options){
      if(typeof coreExecuteStatement!=='function') return unavailable('executeStatement');
      options=options||{};
      return coreExecuteStatement({language:options.language||activeProgram.language||'c',statement,
        memory:memory||activeProgram.memory||{},phase:options.phase});
    },
    evaluateAndApply(statement,memory,options){
      if(typeof evaluateAndApplyCoreStatement!=='function') return unavailable('evaluateAndApplyStatement');
      options=options||{};
      return evaluateAndApplyCoreStatement(statement,memory||activeProgram.memory||{},
        options.language||activeProgram.language||'c',options.statementId||statement.id,options.mode);
    },
    applyEffects(memory,effects,statementId,mode){
      if(typeof applyCoreStatementEffects!=='function') return unavailable('applyStatementEffects');
      return applyCoreStatementEffects(memory||activeProgram.memory||{},effects,statementId,mode);
    },
    selectBranch(statement,value){
      if(typeof coreSelectBranch!=='function') return unavailable('selectBranch');
      return coreSelectBranch(statement,value);
    },
    assignmentValue(operator,currentValue,rhsValue){
      if(typeof coreApplyAssignmentOperator!=='function') return unavailable('assignmentOperator');
      return coreApplyAssignmentOperator(operator,currentValue,rhsValue);
    },
    declarationEffect(statement,value,initialized){
      if(typeof coreDeclarationEffect!=='function') return unavailable('declarationEffect');
      return coreDeclarationEffect(statement,value,initialized);
    },
    writeEffect(statement,previousValue,nextValue){
      if(typeof coreWriteEffect!=='function') return unavailable('writeEffect');
      return coreWriteEffect(statement,previousValue,nextValue);
    }
  });
}

function programSemanticsForContext(ctx){
  return ctx&&ctx.semantics||programSemanticServices(ctx&&ctx.program);
}

function assertStatementKind(kind){
  if(typeof kind !== 'string' || !kind.trim()) throw new Error('A statement plugin requires a non-empty kind');
}

function registerStatementPlugin(plugin){
  if(!plugin || typeof plugin !== 'object') throw new Error('Statement plugin must be an object');
  assertStatementKind(plugin.kind);
  if(statementPluginRegistry.has(plugin.kind)) throw new Error(`Statement plugin '${plugin.kind}' is already registered`);
  statementPluginRegistry.set(plugin.kind, Object.freeze(Object.assign({}, plugin)));
  return plugin;
}

function registerStatementRenderer(kind, renderer){
  assertStatementKind(kind);
  if(typeof renderer !== 'function') throw new Error(`Renderer for '${kind}' must be a function`);
  statementRendererRegistry.set(kind, renderer);
  return renderer;
}

function createProgram(statements, opts){
  opts = opts || {};
  if(!Array.isArray(statements) || statements.length===0) throw new Error('A program requires at least one statement');
  const normalized = statements.map((statement, index)=>{
    if(!statement || typeof statement !== 'object') throw new Error(`Statement ${index} must be an object`);
    assertStatementKind(statement.kind);
    const normalizedStatement = Object.assign({}, statement);
    if(!normalizedStatement.id) normalizedStatement.id = `stmt-${index+1}`;
    if(!normalizedStatement.status) normalizedStatement.status = index===0?'active':'locked';
    return normalizedStatement;
  });
  return {
    schemaVersion: PROGRAM_SCHEMA_VERSION,
    id: opts.id || null,
    language: opts.language || 'java',
    statements: normalized,
    cursor: Math.max(0, Math.min(normalized.length-1, opts.cursor || 0)),
    status: opts.status || 'running',
    memory: opts.memory || {},
    events: opts.events || [],
    executionHistory: Array.isArray(opts.executionHistory)?opts.executionHistory.slice():[]
  };
}

// Compatibility adapter. Runtime expression data deliberately stays on the
// item in its original shape: every existing renderer, persistence record and
// feedback calculation therefore reads the same fields it did before.
function ensureProgramEnvelope(item){
  if(!item || typeof item !== 'object') return null;
  if(!item.program || !Array.isArray(item.program.statements) || item.program.statements.length===0){
    item.program = createProgram([
      {id:'expression', kind:'legacy-expression', status:'active'}
    ], {
      id: item.profileId ? `${item.profileId}-item` : null,
      language: (typeof state === 'object' && state && state.language) || 'java'
    });
  }
  if(item.program.schemaVersion == null) item.program.schemaVersion = PROGRAM_SCHEMA_VERSION;
  if(!item.program.memory) item.program.memory = {};
  if(!Array.isArray(item.program.events)) item.program.events = [];
  if(!Array.isArray(item.program.executionHistory)) item.program.executionHistory = [];
  return item.program;
}

function itemHasInteractiveProgram(item){
  return !!(item && item.program && item.program.mode);
}

function currentProgramStatement(item){
  const program = ensureProgramEnvelope(item);
  if(!program) return null;
  return program.statements[program.cursor] || null;
}

function statementPluginFor(statement){
  return statement ? statementPluginRegistry.get(statement.kind) || null : null;
}

function programDeclarationGroup(program,statement){
  if(!program||!statement||statement.kind!=='declaration'
    ||!Array.isArray(statement.declarationGroupStatementIds)
    ||statement.declarationGroupStatementIds.length<2) return [];
  const byId=new Map(program.statements.map(candidate=>[candidate.id,candidate]));
  return statement.declarationGroupStatementIds.map(id=>byId.get(id)).filter(Boolean);
}

// Source-flow presentations ask the owning statement plugin how a line should
// respond. This keeps the shell free of declaration/output/selection rules.
function statementInteractionPlan(item,statement){
  const program=ensureProgramEnvelope(item),plugin=statementPluginFor(statement);
  if(!program||!plugin||typeof plugin.interactionPlan!=='function'){
    return {mode:'modal',focus:'statement',label:'Open statement trace'};
  }
  // A completed multi-step statement that was rolled back still contains its
  // learner derivation. Reopen that derivation before considering a direct
  // commit plan, including declarations that belong to one source-line group.
  const rollbackFocus=statement.runtime&&statement.runtime.rollbackReviewFocus;
  if(rollbackFocus){
    return {mode:'modal',focus:rollbackFocus,label:'Review and correct statement'};
  }
  const declarationGroup=programDeclarationGroup(program,statement);
  if(declarationGroup.length&&declarationGroup[0]===statement){
    const plans=declarationGroup.map(candidate=>plugin.interactionPlan({item,program,statement:candidate})||{});
    if(plans.every(plan=>plan.mode==='direct'&&plan.action)){
      return {mode:'direct',action:{type:'commit-declaration-group',statementId:statement.id},
        label:'Execute declarations'};
    }
  }
  const plan=plugin.interactionPlan({item,program,statement})||{};
  if(plan.mode==='direct'&&plan.action){
    return {mode:'direct',action:plan.action,label:plan.label||'Execute statement'};
  }
  return {mode:'modal',focus:plan.focus||'statement',label:plan.label||'Open statement trace'};
}

function advanceProgram(program,nextStatementId){
  const current = program.statements[program.cursor];
  const requestedNext=nextStatementId===undefined&&current?current.nextStatementId:nextStatementId;
  if(current){
    if(!Array.isArray(program.executionHistory)) program.executionHistory=[];
    program.executionHistory.push(current.id);
    current.status = 'complete';
    // Keep the completed derivation visible long enough for its result and
    // memory handoff to be perceived. The next valid statement action clears
    // this transient presentation flag.
    current._uiJustCompleted = true;
  }
  if(requestedNext==='$end'){
    program.status='complete';
  }else if(typeof requestedNext==='string'){
    const nextIndex=program.statements.findIndex(statement=>statement.id===requestedNext);
    if(nextIndex<0) throw new Error(`Unknown next statement '${requestedNext}'`);
    program.statements.forEach((statement,index)=>{
      if(index>program.cursor&&index<nextIndex) statement.status='blocked';
    });
    program.cursor=nextIndex;
    program.statements[program.cursor].status='active';
  }else if(program.cursor < program.statements.length-1){
    program.cursor++;
    program.statements[program.cursor].status = 'active';
  } else {
    program.status = 'complete';
  }
}

// Commands are semantic objects such as SUBSTITUTE, EVALUATE or, in future,
// COMMIT_ASSIGNMENT. The core never interprets them itself.
function dispatchProgramAction(item, action, services){
  const program = ensureProgramEnvelope(item);
  const statement = currentProgramStatement(item);
  if(action&&action.statementId&&(!statement||action.statementId!==statement.id)){
    return {applied:false,ignored:true,reason:'non-current-statement'};
  }
  const plugin = statementPluginFor(statement);
  if(!plugin || typeof plugin.applyAction !== 'function') return {applied:false, reason:'unsupported-statement'};
  if(action&&action.type==='commit-declaration-group'){
    const group=programDeclarationGroup(program,statement);
    if(!group.length||group[0]!==statement)return {applied:false,reason:'invalid-declaration-group'};
    const events=[],effects=[];let wasCorrect=true;
    for(const candidate of group){
      if(currentProgramStatement(item)!==candidate)return {applied:false,reason:'declaration-group-out-of-sequence'};
      const candidatePlugin=statementPluginFor(candidate);
      const plan=candidatePlugin&&candidatePlugin.interactionPlan
        ?candidatePlugin.interactionPlan({item,program,statement:candidate}):null;
      if(!plan||plan.mode!=='direct'||!plan.action)return {applied:false,reason:'declaration-group-requires-detail'};
      const result=candidatePlugin.applyAction({program,statement:candidate,item,action:plan.action,
        services:services||{},semantics:programSemanticServices(program)})||{applied:false};
      if(!result.applied||!result.completed)return {applied:false,reason:'declaration-group-action-failed'};
      const resultEvents=result.event?[result.event]:(Array.isArray(result.events)?result.events:[]);
      resultEvents.forEach(event=>{events.push(event);if(event.effects)effects.push(...event.effects);
        if(event.wasCorrect===false)wasCorrect=false;});
      const binding=program.memory[candidate.binding&&candidate.binding.name];
      if(binding&&typeof binding==='object')binding.lastStatementId=statement.id;
      if(result.event)program.events.push(result.event);
      if(Array.isArray(result.events))program.events.push(...result.events);
      advanceProgram(program,result.nextStatementId);
    }
    program.statements.forEach(candidate=>{
      if(!group.includes(candidate))candidate._uiJustCompleted=false;
    });
    return {applied:true,completed:true,events,event:{type:'ASSIGN',action:'ASSIGN',
      statementId:statement.id,targets:group.map(candidate=>candidate.binding.name),effects,wasCorrect}};
  }
  const result = plugin.applyAction({program, statement, item, action, services:services||{},
    semantics:programSemanticServices(program)}) || {applied:false};
  if(result.applied){
    program.statements.forEach(candidate=>{
      if(candidate!==statement) candidate._uiJustCompleted=false;
    });
  }
  if(result.event) program.events.push(result.event);
  if(Array.isArray(result.events)) program.events.push(...result.events);
  if(result.completed){
    if(statement.runtime)delete statement.runtime.rollbackReviewFocus;
    advanceProgram(program,result.nextStatementId);
  }
  return result;
}

// Optional strict-assessment hook. Statement plugins own the meaning of a
// rejected command; the program core only routes the question so exam policy
// never needs declaration/assignment-specific branches.
function classifyRejectedProgramAction(item,action){
  const program=ensureProgramEnvelope(item);
  const statement=currentProgramStatement(item);
  const plugin=statementPluginFor(statement);
  if(!plugin||typeof plugin.classifyRejectedAction!=='function') return null;
  return plugin.classifyRejectedAction({program,statement,item,action,
    semantics:programSemanticServices(program)})||null;
}

function checkProgramItem(item, services){
  const program = ensureProgramEnvelope(item);
  const statement = currentProgramStatement(item);
  const plugin = statementPluginFor(statement);
  if(!plugin || typeof plugin.check !== 'function') return {applied:false, reason:'unsupported-statement'};
  const result = plugin.check({program, statement, item, services:services||{},
    semantics:programSemanticServices(program)}) || {applied:false};
  if(result.event) program.events.push(result.event);
  if(Array.isArray(result.events)) program.events.push(...result.events);
  if(result.completed) advanceProgram(program);
  return result;
}

function canUndoProgram(item){
  const program = ensureProgramEnvelope(item);
  const statement = currentProgramStatement(item);
  const plugin = statementPluginFor(statement);
  if(plugin && typeof plugin.canUndo === 'function' && plugin.canUndo({program, statement, item})) return true;
  return !!(program&&(program.executionHistory.length||program.cursor>0));
}

function undoProgramAction(item, services){
  const program = ensureProgramEnvelope(item);
  const statement = currentProgramStatement(item);
  const plugin = statementPluginFor(statement);
  if(plugin && typeof plugin.undo === 'function'){
    const local = plugin.undo({program, statement, item, services:services||{},
      semantics:programSemanticServices(program)}) || {applied:false};
    if(local.applied) return local;
  }
  if(!program) return {applied:false};

  const current = program.statements[program.cursor];
  const previousId=program.executionHistory.length?program.executionHistory[program.executionHistory.length-1]:null;
  const previousIndex=previousId==null?program.cursor-1
    :program.statements.findIndex(candidate=>candidate.id===previousId);
  if(previousIndex<0) return {applied:false};
  const previous = program.statements[previousIndex];
  const declarationGroup=programDeclarationGroup(program,previous);
  if(declarationGroup.length&&declarationGroup[declarationGroup.length-1]===previous){
    for(let index=declarationGroup.length-1;index>=0;index--){
      const candidate=declarationGroup[index],candidatePlugin=statementPluginFor(candidate);
      if(!candidatePlugin||typeof candidatePlugin.rollbackCompletion!=='function')return {applied:false};
      const rolledBack=candidatePlugin.rollbackCompletion({program,statement:candidate,item,
        services:services||{},semantics:programSemanticServices(program)})||{applied:false};
      if(!rolledBack.applied)return rolledBack;
      if(index===0&&candidate.runtime&&rolledBack.reopenFocus)
        candidate.runtime.rollbackReviewFocus=rolledBack.reopenFocus;
      if(program.executionHistory[program.executionHistory.length-1]===candidate.id)program.executionHistory.pop();
      candidate.status=index===0?'active':'locked';candidate._uiJustCompleted=false;
    }
    if(current&&!declarationGroup.includes(current))current.status='locked';
    program.cursor=program.statements.indexOf(declarationGroup[0]);program.status='running';
    return {applied:true};
  }
  const previousPlugin = statementPluginFor(previous);
  if(!previousPlugin || typeof previousPlugin.rollbackCompletion !== 'function') return {applied:false};
  const result = previousPlugin.rollbackCompletion({program, statement:previous, item, services:services||{},
    semantics:programSemanticServices(program)}) || {applied:false};
  if(!result.applied) return result;
  if(previous.runtime&&result.reopenFocus)previous.runtime.rollbackReviewFocus=result.reopenFocus;
  if(previousId!=null) program.executionHistory.pop();
  if(current) current.status = 'locked';
  previous.status = 'active';
  program.cursor=previousIndex;
  program.status = 'running';
  return result;
}

function resetProgramAction(item, services){
  const program = ensureProgramEnvelope(item);
  if(!program) return {applied:false};
  let changed = program.cursor>0 || program.events.length>0;
  program.statements.forEach((statement, index)=>{
    const plugin = statementPluginFor(statement);
    if(plugin && typeof plugin.reset === 'function'){
      const result = plugin.reset({program, statement, item, services:services||{},
        semantics:programSemanticServices(program)}) || {applied:false};
      changed = changed || !!result.applied;
    }
    statement.status = index===0 ? 'active' : 'locked';
    statement._uiJustCompleted = false;
    statement._uiExpanded = false;
    if(statement.runtime)delete statement.runtime.rollbackReviewFocus;
  });
  program.cursor = 0;
  program.status = 'running';
  program.memory = {};
  program.events = [];
  program.executionHistory = [];
  if(item._sourceFlowTransition) delete item._sourceFlowTransition;
  return {applied:changed};
}

function renderProgramItem(container, item, services){
  const program = ensureProgramEnvelope(item);
  if(!program) return;
  // Interactive multi-statement items render inside one shared visual flow.
  // The optional presentation hook is defined by render-session.js; keeping
  // it optional preserves Program Core's DOM-agnostic testability and the
  // exact one-statement legacy fallback.
  const statementContainer = itemHasInteractiveProgram(item)
    && typeof renderProgramWorkspaceShell==='function'
      ? renderProgramWorkspaceShell(container,item,program)
      : container;
  const renderStatement=(statement,index)=>{
    const isActive=index===program.cursor&&program.status!=='complete';
    if(typeof programUsesStatementTraceModal==='function'&&programUsesStatementTraceModal(item)
      &&typeof renderProgramStatementTraceSource==='function'){
      statementContainer.appendChild(renderProgramStatementTraceSource(statement,index,item,isActive));
      return;
    }
    const renderer = statementRendererRegistry.get(statement.kind);
    if(typeof renderer !== 'function') throw new Error(`No renderer registered for statement kind '${statement.kind}'`);
    renderer({
      container:statementContainer, item, program, statement, statementIndex:index,
      isActive,
      services:services||{}
    });
  };
  if(item.sourceFlow&&typeof renderProgramSourceFlow==='function'
    &&renderProgramSourceFlow(statementContainer,item,program,services||{},renderStatement)) return;
  program.statements.forEach(renderStatement);
}

function buildCanonicalProgramTrace(item, services){
  const program = ensureProgramEnvelope(item);
  const events = [];
  program.statements.forEach(statement=>{
    const plugin = statementPluginFor(statement);
    if(!plugin || typeof plugin.buildCanonicalTrace !== 'function') return;
    const produced = plugin.buildCanonicalTrace({program, statement, item, services:services||{}});
    if(Array.isArray(produced)) events.push(...produced);
  });
  return events;
}
