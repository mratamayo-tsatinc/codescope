// ---------------------------------------------------------------------------
// "On-paper" assignment-line layout.
// ----------------------------------------------------------------------------
// A student working an expression out by hand writes the "TYPE varname ="
// left-hand side once, then just "= ..." underneath for every subsequent
// transformation, reading straight down the "=" column rather than
// re-parsing "int result" on every line. We mimic that here: the LHS label
// is shown only on the first evaluation row (the untouched source statement),
// while every derived row reserves the same blank width.
//
// The LHS text is now PER-ITEM, not a fixed constant: each generated item
// carries its own randomly (seeded) chosen assignment-target name (see
// generator.js's RESULT_NAMES/pickResultName, threaded onto item.resultName
// in state.js), so one item might read "int total = ..." while another
// reads "int outcome = ...". assignLineString() (language.js) mirrors this
// same name for the source panel's own assignment line.
//
// Because the label text now varies in length per item, its reserved width
// (in `ch` units) can no longer be a single module-level constant — it's
// computed once per render, from that item's own resultName, and passed
// into every renderAssignLabel() call for that item so every row (and the
// canonical-playback panel, which renders the very same item) reserves the
// identical width. That's still the important invariant: within one item's
// own rows, the width must never vary, or the "=" column drifts.
//
// Two things must stay a constant width on every row for the "=" to
// actually land in the same pixel column: this label, and the correctness
// badge (which only appears on some EVALUATE rows, after Check). Both are
// wrapped in fixed-width slots so their presence/absence never shifts
// anything to their right. This depends on .code-out having a single,
// non-varying font-size across done/current rows (see the CSS) — `ch` units
// are font-size-relative, so a size difference between rows would silently
// reintroduce misalignment even with these slots in place.
// ---------------------------------------------------------------------------
// labelText/labelCh are computed per-item by the caller (see renderSession
// and renderCanonicalPlayback below) from item.resultName, since the LHS
// text is no longer a fixed constant. Falls back to a bare space-reserving
// width of 0 if somehow not supplied, rather than throwing.
function renderAssignLabel(show, labelText, labelCh){
  const text = labelText || '';
  const ch = labelCh || 0;
  return h('span',{class:'assign-label', style:`display:inline-block;width:${ch}ch;`}, show ? text+' ' : '');
}
// 22px = .step-badge's own 15px width + 7px margin-right, so the slot holds
// the badge with no extra shift when one is present, and no gap collapse
// when one isn't.
function renderBadgeSlot(badge){
  return h('span',{class:'badge-slot', style:'display:inline-block;width:22px;'}, badge);
}

function renderInlineEvaluationActions(options){
  options=options||{};
  const actions=[];
  if(options.canUndo){
    actions.push(h('button',{class:'inline-eval-action inline-undo-action',type:'button',
      title:'Undo last action','aria-label':'Undo last action',onclick:handleUndo},
      h('i',{class:'fa-solid fa-rotate-left','aria-hidden':'true'})));
  }
  if(options.canCheck){
    actions.push(h('button',{class:'inline-eval-action inline-check-action',type:'button',
      title:'Check answer','aria-label':'Check answer',onclick:handleCheck},
      h('i',{class:'fa-solid fa-check','aria-hidden':'true'}),h('span',{},'Check')));
  }
  return actions.length ? h('span',{class:'inline-eval-actions'},...actions) : null;
}

function strictPracticeInvalidMessage(item){
  if(!item||!item.practiceInvalidExecution) return null;
  const labels={
    'operands-unresolved':'This operation cannot execute because one or both operand values are still unavailable.',
    'unary-operand-unresolved':'This unary operation cannot execute until its variable value is available.',
    'unary-target-unavailable':'This unary statement cannot execute because its target variable is not available in program memory.',
    'initializer-unresolved':'The declaration cannot assign a value until its initializer has been fully derived.',
    'assignment-value-unresolved':'The assignment cannot execute until its right-side expression has been fully derived.',
    'assignment-target-unread':'The compound assignment cannot execute until the variable’s current value is available.',
    'output-memory-unavailable':'The output value cannot be read before its variable is initialized.',
    'output-value-unread':'The placeholder cannot be resolved until its variable value is read from memory.',
    'output-unresolved':'The output command cannot execute until every dynamic value is resolved.',
    'output-order':'Output values must be resolved from left to right.',
    'division-by-zero':'This operation cannot execute because division or remainder by zero is undefined.'
  };
  return `${labels[item.practiceInvalidExecution.reason]||'This action cannot execute in the current program state.'} Use Undo to return to the executable state.`;
}

function invalidExecutionBelongsToStatement(item,statement){
  if(!item) return false;
  const failure=state.mode==='practice'
    ? item.practiceInvalidExecution : item.examSequenceFailure;
  if(!failure) return false;
  const renderedStatement=statement||(
    typeof currentProgramStatement==='function'?currentProgramStatement(item):null);
  if(!renderedStatement) return false;
  // Current records carry the precise origin. Older persisted attempts may
  // predate statementId; in that case the program cursor still identifies
  // the statement at which execution stopped.
  if(failure.statementId!=null) return failure.statementId===renderedStatement.id;
  const current=typeof currentProgramStatement==='function'
    ? currentProgramStatement(item) : null;
  return !!(current&&current.id===renderedStatement.id);
}

function renderInvalidExecutionAlert(item,statement){
  const belongs=invalidExecutionBelongsToStatement(item,statement);
  const practiceFailure=belongs&&state.mode==='practice'&&item&&item.practiceInvalidExecution;
  const examFailure=belongs&&state.mode==='exam'&&item&&item.examSequenceFailure
    &&item.examSequenceFailure.terminal;
  if(!practiceFailure&&!examFailure) return null;
  const title=practiceFailure?'Invalid execution':'Invalid execution — item ended';
  const message=practiceFailure
    ? strictPracticeInvalidMessage(item)
    : 'This item can no longer continue. Credit earned before this action has been recorded.';
  const action=practiceFailure
    ? h('button',{class:'invalid-execution-recovery',type:'button',onclick:handleUndo,
        'aria-label':'Undo invalid action and continue'},
        h('i',{class:'fa-solid fa-rotate-left','aria-hidden':'true'}),
        h('span',{},'Undo invalid action'))
    : null;
  return h('div',{class:`invalid-execution-alert ${practiceFailure?'recoverable':'terminal'}`,
      role:'alert','aria-live':'assertive'},
    h('div',{class:'invalid-execution-icon','aria-hidden':'true'},
      h('i',{class:`fa-solid ${practiceFailure?'fa-triangle-exclamation':'fa-circle-exclamation'}`})),
    h('div',{class:'invalid-execution-content'},
      h('div',{class:'invalid-execution-title'},title),
      h('div',{class:'invalid-execution-message'},message),
      action));
}

function bringInvalidExecutionAlertIntoView(){
  if(typeof document==='undefined') return;
  setTimeout(()=>{
    const alert=document.querySelector&&document.querySelector('.invalid-execution-alert');
    if(alert&&typeof alert.scrollIntoView==='function'){
      alert.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    }
  },0);
}

function renderItemResetControl(show){
  if(!show) return null;
  return h('div',{class:'item-reset-control'},
    h('button',{class:'item-reset-button',type:'button',onclick:handleReset},'Reset item'));
}

function renderExamItemBar(item){
  if(state.mode!=='exam'||state.examExpired) return null;
  const status=item.checked?'Answer locked':(item.flagged?'Flagged for review':(itemHasAttempt(item)?'In progress':'Unattempted'));
  const controls=[h('span',{class:'exam-item-status'+(item.checked?' locked':item.flagged?' flagged':'')},
    item.checked?h('i',{class:'fa-solid fa-lock'}):item.flagged?h('i',{class:'fa-solid fa-flag'}):h('i',{class:'fa-regular fa-circle'}),
    ' ',status)];
  if(activeExamPolicy().allowReviewFlags&&!item.checked){
    controls.push(h('button',{class:'exam-flag-btn'+(item.flagged?' active':''),type:'button',onclick:toggleCurrentItemFlag,
      title:item.flagged?'Remove review flag':'Flag this item for review','aria-pressed':item.flagged?'true':'false'},
      h('i',{class:'fa-solid fa-flag'}),item.flagged?' Unflag':' Flag'));
  }
  return h('div',{class:'exam-item-bar'},...controls);
}

// Compatibility helper retained for optional plugins that need a standalone
// source block. Built-in statements now place their authoritative source in
// the first evaluation row and do not call this helper.
function renderExpressionSourcePanel(title, lines, panelClass){
  const panel = h('div',{class:'source-panel'+(panelClass?' '+panelClass:'')});
  panel.appendChild(h('div',{class:'panel-title'},title));
  (lines || []).forEach(line=>{
    const value = typeof line==='string' ? line : line.text;
    const lineClass = typeof line==='string' ? 'active-line' : (line.className || 'active-line');
    panel.appendChild(h('div',{class:`code-line ${lineClass}`},value));
  });
  return panel;
}

function programStatementSource(statement,item){
  if(statement&&typeof statement.sourceText==='string') return statement.sourceText;
  if(statement.kind==='declaration'){
    return `${declarationKeyword(statement)} ${statement.binding.name} = ${renderString(statement.runtime.originalTree)};`;
  }
  if(statement.kind==='assignment'){
    return `${statement.target} ${statement.operator} ${renderString(statement.runtime.originalTree)};`;
  }
  if(statement.kind==='unary-update') return unaryUpdateSource(statement);
  if(statement.kind==='output'&&typeof outputStatementSource==='function'){
    return outputStatementSource(statement,item);
  }
  const expression=renderString(item.originalTree);
  return typeof assignLineString==='function'
    ? assignLineString(expression,item.resultName)
    : `int ${item.resultName||'result'} = ${expression};`;
}

function programStatementDisplayNumber(statement,statementIndex){
  return statement&&Number.isInteger(statement.sourceLine)?statement.sourceLine:statementIndex+1;
}

function programSourceLanguageLabel(language){
  if(language==='c') return 'C';
  if(language==='java') return 'Java';
  return String(language||'Source').replace(/(^|-)([a-z])/g,(_,separator,letter)=>`${separator}${letter.toUpperCase()}`);
}

function programSourceFragments(line,language){
  if(language==='c'&&/^\s*#/.test(line)) return [h('span',{class:'program-source-syntax-prep'},line)];
  const fragments=[];
  const pattern=/\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:int|char|float|double|void|long|short|const|unsigned|signed|static|boolean|String|public|private|protected|class|final|new|return|if|else|for|while|do|break|continue|switch|case|default|package|import|throws|try|catch|finally)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\()/g;
  let cursor=0,match;
  while((match=pattern.exec(line))){
    if(match.index>cursor) fragments.push(line.slice(cursor,match.index));
    const token=match[0];
    const kind=token.startsWith('//')?'comment':/^[\'"]/.test(token)?'string':/^\d/.test(token)?'number'
      :/^(int|char|float|double|void|long|short|const|unsigned|signed|boolean|String)$/.test(token)?'type'
      :/^(static|public|private|protected|class|final|new|return|if|else|for|while|do|break|continue|switch|case|default|package|import|throws|try|catch|finally)$/.test(token)?'keyword':'function';
    fragments.push(h('span',{class:`program-source-syntax-${kind}`},token));
    cursor=match.index+token.length;
  }
  if(cursor<line.length) fragments.push(line.slice(cursor));
  return fragments.length?fragments:['\u00a0'];
}

function renderProgramSourceFilePanel(item,program){
  const display=item.sourceDisplay,statements=new Map(program.statements.map((statement,index)=>[statement.id,{statement,index}]));
  const active=program.statements[program.cursor],transition=item._sourceFlowTransition||null;
  const flowTiming=sourceFlowTimings();
  const panel=h('section',{class:'program-source-file-panel',
    'aria-label':`${programSourceLanguageLabel(item.language)} source file ${display.filename||item.filename||''}`});
  panel.appendChild(h('header',{class:'program-source-file-heading'},
    h('i',{class:'fa-solid fa-code','aria-hidden':'true'}),
    h('span',{class:'program-source-file-name'},display.filename||item.filename||'Source'),
    h('span',{class:'program-source-file-language'},programSourceLanguageLabel(item.language))));
  const source=h('div',{class:'program-source-file-code',
    style:`--program-flow-duration:${flowTiming.movementDurationMs}ms;`});
  display.lines.forEach(line=>{
    const entry=line.primary&&line.statementId?statements.get(line.statementId):null;
    const statement=entry&&entry.statement;
    const isOrigin=!!(statement&&transition&&statement.id===transition.originId);
    const isDestination=!!(statement&&transition&&statement.id===transition.destinationId);
    const isActive=!!(statement&&active&&statement.id===active.id&&program.status!=='complete'&&!transition);
    const interactive=isActive&&!item.checked,plan=interactive?statementInteractionPlan(item,statement):null;
    const interactionClass=plan?` interaction-${plan.mode}`:'',result=statementTraceResult(statement);
    const stateClass=statement
      ?(statement.status==='active'&&transition?'is-pending':`is-${statement.status}`)
      :'is-context';
    const transitionClass=isOrigin?` is-flow-origin is-${transition.phase}`:(isDestination?' is-flow-destination':'');
    const row=h(interactive?'button':'div',{class:`program-source-file-line ${stateClass}${interactive?' is-active':''}${interactionClass}${transitionClass}`,
      type:interactive?'button':null,'data-source-line':String(line.number),
      'data-statement-id':statement&&statement.id||null,
      'aria-label':interactive?`${plan.label}, line ${line.number}`:null,
      title:interactive?plan.label:null,
      onclick:interactive?(plan.mode==='direct'
        ?()=>handleTokenClick(plan.action)
        :event=>openProgramStatementTrace(item,statement.id,event.currentTarget)):null});
    row.appendChild(h('span',{class:'program-source-file-number','aria-hidden':'true'},String(line.number)));
    row.appendChild(h('code',{class:'program-source-file-text'},...programSourceFragments(line.text,item.language)));
    const state=h('span',{class:'program-source-file-state'});
    if(result!==null){
      const resultClass=statement.selectionKind==='switch'?'is-switch':(Boolean(statement.runtime.assignedValue)?'is-true':'is-false');
      state.appendChild(h('span',{class:`program-source-file-result ${resultClass}`},result));
    }else if(statement&&statement.status==='complete'){
      state.appendChild(h('i',{class:'fa-solid fa-check program-source-file-complete',title:'Completed','aria-label':'Completed statement'}));
    }
    if(plan){
      const icon=plan.mode==='direct'?'fa-play':'fa-up-right-and-down-left-from-center';
      state.appendChild(h('i',{class:`fa-solid ${icon} program-source-file-action ${plan.mode}-action`,'aria-hidden':'true'}));
    }
    row.appendChild(state);source.appendChild(row);
  });
  if(transition&&transition.phase==='moving'&&transition.destinationId){
    source.appendChild(h('span',{class:'program-source-flow-highlight','aria-hidden':'true'}));
  }
  panel.appendChild(source);
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(()=>{
    const highlight=panel.querySelector&&panel.querySelector('.program-source-flow-highlight');
    const origin=panel.querySelector&&panel.querySelector('.program-source-file-line.is-flow-origin');
    const destination=panel.querySelector&&panel.querySelector('.program-source-file-line.is-flow-destination');
    if(highlight&&origin&&destination){
      highlight.style.top=`${origin.offsetTop}px`;
      highlight.style.height=`${origin.offsetHeight}px`;
      highlight.style.width=`${Math.max(source.scrollWidth,origin.offsetWidth,destination.offsetWidth)}px`;
      highlight.style.setProperty('--program-flow-distance',`${destination.offsetTop-origin.offsetTop}px`);
      highlight.style.setProperty('--program-flow-target-height',`${destination.offsetHeight}px`);
      requestAnimationFrame(()=>highlight.classList.add('is-moving'));
      destination.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    }
    const current=panel.querySelector&&panel.querySelector('.program-source-file-line.is-active');
    if(current&&typeof current.scrollIntoView==='function') current.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  return panel;
}

function renderProgramSourceContextLine(line){
  const blank=!line.text;
  const card=h('section',{class:`program-statement program-source-context${blank?' blank':''}`,
    'data-source-line':String(line.number)});
  const timeline=h('div',{class:'timeline program-source-context-timeline'});
  const row=h('div',{class:'tl-row program-source-context-row'});
  row.appendChild(h('div',{class:'tl-dot statement-source-dot source-context-number',
    title:`Source line ${line.number}`},String(line.number)));
  row.appendChild(h('div',{class:'code-out program-source-context-code'},
    h('code',{},line.text||' ')));
  timeline.appendChild(row);card.appendChild(timeline);
  return card;
}

function renderProgramSourceFlow(container,item,program,services,renderStatement){
  if(!item||!item.sourceFlow||!item.sourceDisplay||!Array.isArray(item.sourceDisplay.lines)) return false;
  if(programUsesStatementTraceModal(item)){
    container.appendChild(renderProgramSourceFilePanel(item,program));
    return true;
  }
  const statements=new Map(program.statements.map((statement,index)=>[statement.id,{statement,index}]));
  const rendered=new Set();
  item.sourceDisplay.lines.forEach(line=>{
    const entry=line.primary&&line.statementId?statements.get(line.statementId):null;
    if(entry){
      renderStatement(entry.statement,entry.index);
      rendered.add(entry.statement.id);
    }else container.appendChild(renderProgramSourceContextLine(line));
  });
  program.statements.forEach((statement,index)=>{
    if(!rendered.has(statement.id)) renderStatement(statement,index);
  });
  return true;
}

let statementTraceModalState=null;
let statementTraceReturnFocus=null;
let sourceFlowTransitionTimer=null;

function stageSourceFlowTransition(item,originStatement,phase='waiting'){
  if(!item||!item.sourceFlow||!item.program||!originStatement||originStatement.status!=='complete') return null;
  const destination=item.program.status==='running'?item.program.statements[item.program.cursor]:null;
  if(!destination||destination.id===originStatement.id) return null;
  const transition={originId:originStatement.id,destinationId:destination.id,phase};
  item._sourceFlowTransition=transition;return transition;
}

function sourceFlowTimings(){
  const configured=DEFAULT_APP_SETTINGS&&DEFAULT_APP_SETTINGS.shell&&DEFAULT_APP_SETTINGS.shell.sourceFlow;
  return configured||{resultHoldMs:900,modalCloseSettleMs:320,movementDurationMs:1100,reducedMotionDurationMs:120};
}

function beginSourceFlowTransition(item,settleMs=0){
  const transition=item&&item._sourceFlowTransition;if(!transition)return false;
  if(sourceFlowTransitionTimer){clearTimeout(sourceFlowTransitionTimer);sourceFlowTransitionTimer=null;}
  const timing=sourceFlowTimings();
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const holdMs=Math.max(0,Number(settleMs)||0)+(reduced?Math.min(timing.resultHoldMs,450):timing.resultHoldMs);
  const movementMs=reduced?timing.reducedMotionDurationMs:timing.movementDurationMs;
  transition.phase='holding';render();
  sourceFlowTransitionTimer=setTimeout(()=>{
    if(item._sourceFlowTransition!==transition){sourceFlowTransitionTimer=null;return;}
    transition.phase='moving';render();
    sourceFlowTransitionTimer=setTimeout(()=>{
      if(item._sourceFlowTransition===transition)delete item._sourceFlowTransition;
      sourceFlowTransitionTimer=null;render();
      if(typeof document!=='undefined'&&document.querySelector){
        const next=document.querySelector('.program-source-file-line.is-active');
        if(next&&typeof next.focus==='function')next.focus();
      }
    },movementMs);
  },holdMs);
  return true;
}

function programTimelinePresentation(item){
  const profile=item&&PROFILES.find(candidate=>candidate.id===item.profileId);
  return profile&&profile.program&&profile.program.timelinePresentation||'inline';
}

function programUsesStatementTraceModal(item){
  return programTimelinePresentation(item)==='statement-modal';
}

function programStatementTraceOpenFor(item,statementId){
  return !!(statementTraceModalState&&statementTraceModalState.item===item
    &&statementTraceModalState.statementId===statementId);
}

function programStatementTraceOpenForItem(item){
  return !!(statementTraceModalState&&statementTraceModalState.item===item);
}

function statementTraceResult(statement){
  if(!statement||statement.kind!=='selection'||statement.status!=='complete'||!statement.runtime||!statement.runtime.checked) return null;
  if(statement.selectionKind==='switch') return `${formatValue(statement.runtime.assignedValue)} · ${statement.runtime.selectedLabel}`;
  return formatValue(Boolean(statement.runtime.assignedValue));
}

function openProgramStatementTrace(item,statementId,trigger){
  if(!item||!item.program||!programUsesStatementTraceModal(item)) return;
  const statement=item.program.statements.find(candidate=>candidate.id===statementId);
  if(!statement||statement.status==='locked'||statement.status==='blocked') return;
  const plan=statementInteractionPlan(item,statement);
  if(plan.mode!=='modal') return;
  statementTraceModalState={item,statementId,focus:plan.focus};
  statementTraceReturnFocus=trigger&&typeof trigger.focus==='function'?trigger:null;
  syncStatementTraceModal(item,true);
}

function closeProgramStatementTrace(restoreFocus=true){
  const request=statementTraceModalState,transitionItem=request&&request.item;
  const shouldAdvance=!!(transitionItem&&transitionItem._sourceFlowTransition
    &&transitionItem._sourceFlowTransition.phase!=='waiting-output');
  const fallbackFocus=typeof document!=='undefined'&&document.querySelector
    ? document.querySelector('.program-source-file-line.is-active, .statement-trace-source-row.current') : null;
  statementTraceModalState=null;
  const modal=document.getElementById('statementTraceModal');
  const overlay=document.getElementById('statementTraceOverlay');
  if(modal) modal.style.display='none';
  if(overlay) overlay.style.display='none';
  if(document.body&&document.body.classList) document.body.classList.remove('statement-trace-open');
  const focusTarget=statementTraceReturnFocus&&statementTraceReturnFocus.isConnected!==false
    ? statementTraceReturnFocus:fallbackFocus;
  if(shouldAdvance) beginSourceFlowTransition(transitionItem,sourceFlowTimings().modalCloseSettleMs);
  else if(restoreFocus&&focusTarget&&typeof focusTarget.focus==='function') focusTarget.focus();
  statementTraceReturnFocus=null;
}

function continueProgramStatementTrace(){closeProgramStatementTrace(true);}

function renderStatementTraceMemory(item){
  const section=h('aside',{class:'statement-trace-memory','aria-label':'Program memory'},
    h('div',{class:'statement-trace-context-title'},h('i',{class:'fa-solid fa-memory','aria-hidden':'true'}),' Program memory'));
  const list=h('div',{class:'statement-trace-memory-list'});
  const bindings=typeof ensureBindings==='function'?ensureBindings(item):[];
  item.program.statements.filter(statement=>statement.kind==='declaration').forEach(statement=>{
    const name=statement.binding.name,memory=item.program.memory&&item.program.memory[name];
    const binding=bindings.find(candidate=>candidate.name===name);
    const pending=binding&&binding._modalTransferPending;
    const value=pending?(pending.hasValue?pending.value:'—'):(memory&&memory.initialized?memory.value:'—');
    const card=renderValueCard({id:`vff-${name}`,name,value,
      kind:statement.binding.kind==='constant'?'constant':'variable',color:null,isFlash:false});
    list.appendChild(card);
  });
  section.appendChild(list);return section;
}

function renderStatementTraceOutput(item){
  if(typeof renderProgramOutputPanel==='function'){
    const panel=renderProgramOutputPanel(item,item.program,{surface:'modal'});
    if(panel&&panel.classList) panel.classList.add('statement-trace-output');
    return panel;
  }
  const text=(item.program.events||[]).filter(event=>event&&event.type==='OUTPUT').map(event=>event.text).join('');
  return h('aside',{class:'program-output-screen statement-trace-output','aria-label':'Program output'},
    h('div',{class:'program-output-screen-title'},h('i',{class:'fa-solid fa-display','aria-hidden':'true'}),h('span',{},'Program Output')),
    h('div',{class:'program-output-screen-body'},h('pre',{class:'program-output-screen-text'},text),
      h('span',{class:'program-output-cursor','aria-hidden':'true'},'▌')));
}

function syncStatementTraceModal(item,moveFocus=false){
  const modal=document.getElementById('statementTraceModal');
  const overlay=document.getElementById('statementTraceOverlay');
  const body=document.getElementById('statementTraceBody');
  const title=document.getElementById('statementTraceTitle');
  const back=document.getElementById('statementTraceBack');
  const continueButton=document.getElementById('statementTraceContinue');
  if(!modal||!overlay||!body||!title) return;
  const request=statementTraceModalState;
  if(!request||request.item!==item||!item||!item.program||!programUsesStatementTraceModal(item)){
    closeProgramStatementTrace(false);return;
  }
  const statementIndex=item.program.statements.findIndex(candidate=>candidate.id===request.statementId);
  const statement=item.program.statements[statementIndex];
  const isActive=statementIndex===item.program.cursor&&item.program.status!=='complete';
  const completed=!!(statement&&statement.status==='complete');
  const waitingForOutput=!!(completed&&item._sourceFlowTransition&&item._sourceFlowTransition.phase==='waiting-output');
  if(!statement||(!isActive&&!completed)||statement.status==='invalid'){
    closeProgramStatementTrace(false);return;
  }
  body.innerHTML='';
  const trace=h('div',{class:'statement-trace-detail'});
  const renderer=statementRendererRegistry.get(statement.kind);
  if(typeof renderer!=='function') throw new Error(`No renderer registered for statement kind '${statement.kind}'`);
  renderer({container:trace,item,program:item.program,statement,statementIndex,isActive:!completed,
    services:{statementTraceModal:true,expressionOnly:request.focus==='condition-expression',
      preserveCompletedTimeline:completed}});
  if(completed) trace.appendChild(h('div',{class:'statement-trace-complete-note',role:'status'},
    h('i',{class:'fa-solid fa-circle-check','aria-hidden':'true'}),
    h('span',{},'Evaluation complete. Review the result, then continue to the next statement.')));
  const context=h('div',{class:'statement-trace-context'},renderStatementTraceMemory(item));
  if(item.program.statements.some(candidate=>candidate.kind==='output')) context.appendChild(renderStatementTraceOutput(item));
  body.appendChild(h('div',{class:'statement-trace-layout'},trace,context));
  const line=programStatementDisplayNumber(statement,statementIndex);
  const kindLabel={declaration:'Declaration',assignment:'Assignment','unary-update':'Update',output:'Output',selection:'Condition'}[statement.kind]||'Statement';
  title.textContent=`${kindLabel} trace · Line ${line}${completed?' · Complete':''}`;
  modal.classList.toggle('is-complete',completed);
  if(back){back.disabled=false;back.querySelector('span').textContent=completed?'Back to source':'Close evaluation';}
  if(continueButton){continueButton.disabled=!completed||waitingForOutput;
    continueButton.setAttribute('aria-disabled',completed&&!waitingForOutput?'false':'true');
    const label=continueButton.querySelector('span');if(label)label.textContent=waitingForOutput?'Finishing output…':'Continue program';}
  modal.style.display='flex';overlay.style.display='block';
  if(document.body&&document.body.classList) document.body.classList.add('statement-trace-open');
  if(moveFocus&&back&&typeof back.focus==='function') back.focus();
  else if(completed&&continueButton&&typeof continueButton.focus==='function') continueButton.focus();
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(()=>{
    if(typeof drawConnectorLines==='function') drawConnectorLines(item);
    if(typeof drawDeclarationConnectorLines==='function') drawDeclarationConnectorLines(item);
  });
}

function renderProgramStatementTraceSource(statement,statementIndex,item,isActive){
  const number=programStatementDisplayNumber(statement,statementIndex),complete=statement.status==='complete';
  const result=statementTraceResult(statement),canOpen=isActive&&!item.checked;
  const card=h('section',{class:`program-statement statement-trace-source-line ${statement.status}${canOpen?' trace-ready':''}`,
    'data-statement-id':statement.id,'data-source-line':String(number)});
  const timeline=h('div',{class:'timeline program-summary-timeline'});
  const row=h('div',{class:`tl-row program-summary-row statement-trace-source-row ${complete?'done':(canOpen?'current':'waiting')}`});
  row.appendChild(h('div',{class:'tl-dot statement-source-dot',title:`Source line ${number}`},String(number)));
  const code=h('div',{class:'code-out program-summary-code statement-trace-source-code'},
    h('code',{},statement.sourceText||programStatementSource(statement,item)));
  if(result!==null){
    const resultClass=statement.selectionKind==='switch'?'is-switch':(Boolean(statement.runtime.assignedValue)?'is-true':'is-false');
    code.appendChild(h('span',{class:`statement-trace-inline-result ${resultClass}`},result));
  }
  if(complete) code.appendChild(h('i',{class:'fa-solid fa-circle-check program-summary-status',title:'Completed','aria-label':'Completed statement'}));
  if(canOpen){
    const open=h('button',{class:'statement-trace-launch',type:'button',title:`Trace line ${number}`,
      'aria-label':`Open statement trace for line ${number}`,
      onclick:event=>{if(event&&event.stopPropagation)event.stopPropagation();openProgramStatementTrace(item,statement.id,event&&event.currentTarget);}},
      h('i',{class:'fa-solid fa-up-right-and-down-left-from-center','aria-hidden':'true'}));
    code.appendChild(open);row.setAttribute('role','button');row.setAttribute('tabindex','0');
    row.setAttribute('aria-label',`Open statement trace for line ${number}`);
    row.onclick=()=>openProgramStatementTrace(item,statement.id,row);
    row.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openProgramStatementTrace(item,statement.id,row);}};
  }
  row.appendChild(code);timeline.appendChild(row);card.appendChild(timeline);return card;
}

if(typeof document!=='undefined'&&document.addEventListener){
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&statementTraceModalState)closeProgramStatementTrace();});
}

function renderProgramWorkspaceShell(container,item,program){
  container.appendChild(h('div',{class:'session-bar'},
    h('div',{class:'session-meta'},h('b',{},`Item ${state.itemIndex+1}`),` / ${state.items.length}  ·  ${currentProfile().name}`)));
  const examBar=renderExamItemBar(item);
  if(examBar) container.appendChild(examBar);
  const workspace=h('section',{class:'program-workspace'+(item.sourceFlow?' source-program-workspace':''),
    'aria-label':'Program execution'});
  const completionMode=program.progressMode==='completion';
  const completedStatements=program.statements.filter(statement=>statement.status==='complete'||statement.status==='invalid').length;
  const progress=h('div',{class:'program-progress-visual',role:'progressbar',
    'aria-label':completionMode?`${completedStatements} of ${program.statements.length} statements completed`:`Program statement ${Math.min(program.cursor+1,program.statements.length)} of ${program.statements.length}`,
    'aria-valuemin':completionMode?'0':'1','aria-valuemax':String(program.statements.length),
    'aria-valuenow':String(completionMode?completedStatements:Math.min(program.cursor+1,program.statements.length))});
  program.statements.forEach((statement,index)=>{
    const status=statement.status==='complete'?'complete'
      :(statement.status==='invalid'?'invalid':(statement.status==='blocked'?'blocked'
        :(statement.status==='partial'?'partial':(index===program.cursor?'current':'waiting'))));
    progress.appendChild(h('span',{class:`program-progress-dot ${status}`,
      title:`Line ${programStatementDisplayNumber(statement,index)}: ${status}`,'aria-hidden':'true'}));
  });
  workspace.appendChild(progress);
  const flow=h('div',{class:'program-statement-flow'});
  const hasOutput=program.statements.some(statement=>statement.kind==='output')
    &&DEFAULT_APP_SETTINGS.shell.outputPanel.visible;
  if(hasOutput&&typeof renderProgramOutputPanel==='function'){
    workspace.appendChild(h('div',{class:'program-workspace-layout'},flow,renderProgramOutputPanel(item,program)));
  }else workspace.appendChild(flow);
  container.appendChild(workspace);
  return flow;
}

// Checked Practice items use one shell-owned retry placement: outside and
// directly below the activity/workspace card, aligned with its left edge.
// Renderers append this bar to their outer container, never to the workspace
// flow itself, so every activity gets the same visual hierarchy.
function renderPracticeRetryBar(){
  return h('div',{class:'action-bar practice-retry-bar'},
    h('div',{class:'btn-group'},
      h('button',{class:'btn',type:'button',onclick:handleRetrySameItem},
        h('i',{class:'fa-solid fa-rotate-right','aria-hidden':'true'}),' Try again')));
}

function appendPracticeRetryBar(container){
  if(!container) return null;
  const parent=container.parentNode;
  const insideWorkspaceFlow=parent&&parent.classList&&parent.classList.contains('program-workspace');
  const host=insideWorkspaceFlow&&parent.parentNode?parent.parentNode:container;
  const bar=renderPracticeRetryBar();
  host.appendChild(bar);
  return bar;
}

function toggleProgramStatementDetails(statement){
  if(!statement || statement.status!=='complete') return;
  const isOpen=!!(statement._uiExpanded||statement._uiJustCompleted);
  statement._uiJustCompleted=false;
  statement._uiExpanded=!isOpen;
  render();
}

function renderProgramStatementSummary(statement,statementIndex,source){
  const displayNumber=programStatementDisplayNumber(statement,statementIndex);
  const complete=statement.status==='complete';
  const blocked=statement.status==='blocked';
  const timeline=h('div',{class:'timeline program-summary-timeline'});
  const row=h('div',{class:`tl-row program-summary-row ${complete?'done':(blocked?'blocked':'waiting')}`});
  row.appendChild(h('div',{class:'tl-dot statement-source-dot',
    title:complete?'Completed statement':(blocked?'Not executed':'Waiting statement')},String(displayNumber)));
  const statusIcon=h('i',{class:`fa-solid ${complete?'fa-circle-check':(blocked?'fa-ban':'fa-lock')} program-summary-status`,
    title:complete?'Completed':(blocked?'Not executed after invalid action':'Waiting'),
    'aria-label':complete?'Completed statement':(blocked?'Statement not executed':'Waiting statement')});
  const action=complete?h('button',{class:'program-summary-toggle',type:'button',
    title:'Show evaluation steps','aria-label':`Show evaluation steps for line ${displayNumber}`,
    onclick:()=>toggleProgramStatementDetails(statement)},
    h('i',{class:'fa-solid fa-chevron-down','aria-hidden':'true'})):null;
  row.appendChild(h('div',{class:'code-out program-summary-code'},statusIcon,
    h('code',{},statement&&typeof statement.sourceText==='string'?statement.sourceText:source),action));
  timeline.appendChild(row);
  return timeline;
}

function renderCollapseStatementAction(statement,statementIndex){
  const displayNumber=programStatementDisplayNumber(statement,statementIndex);
  return h('button',{class:'inline-eval-action program-collapse-action',type:'button',
    title:'Collapse evaluation steps','aria-label':`Collapse line ${displayNumber}`,
    onclick:()=>toggleProgramStatementDetails(statement)},
    h('i',{class:'fa-solid fa-chevron-up','aria-hidden':'true'}));
}

// Guidance stays available without occupying the learning surface. Native
// title handles mouse hover; details provides keyboard and touch disclosure.
function renderContextHelp(text){
  if(!text) return null;
  return h('details',{class:'context-help'},
    h('summary',{title:text,'aria-label':'Show guidance'},
      h('i',{class:'fa-solid fa-circle-info','aria-hidden':'true'})),
    h('div',{class:'context-help-popover'},text));
}

function renderSeededSourceDisclosure(decls){
  if(!Array.isArray(decls)||!decls.length) return null;
  return h('details',{class:'context-help seeded-source-help'},
    h('summary',{title:'Show seeded declarations','aria-label':'Show seeded declarations'},
      h('i',{class:'fa-solid fa-code','aria-hidden':'true'})),
    h('div',{class:'context-help-popover'},...decls.map(decl=>
      h('code',{class:'seeded-source-line'},declLine(decl,state.language)))));
}

// Full step detail as plain text only — used for a hover title / aria-label,
// never rendered as a visible line. The visible surface is just the badge
// (see .step-badge) plus the expression's own token colors.
function stepTooltip(t, revealCorrectness){
  if(t.action==='READ_TARGET') return `read current ${t.target} → ${formatValue(t.sourceValue)}`;
  if(t.action==='SUBSTITUTE') return `substitute ${t.target} → ${formatValue(t.sourceValue)}`;
  if(t.action==='UNARY') return `apply ${t.op} to ${t.target} → ${formatValue(t.result)}`;
  const order = (!revealCorrectness || t.wasCorrect==null) ? '' : (t.wasCorrect ? ' (correct order)' : ' (out of order)');
  return `evaluate ${formatValue(t.target.operands[0])} ${t.target.operator} ${formatValue(t.target.operands[1])} → ${formatValue(t.result)}${order}`;
}

// ---------------------------------------------------------------------------
// Answer-key playback controls (per item: {index, playing})
// ---------------------------------------------------------------------------
let activePlaybackTimer = null;
function playbackTogglePlay(){
  const item = currentItem();
  if(!item || !item.playback) return;
  const total = canonicalPlaybackTotal(item);
  if(item.playback.index >= total) item.playback.index = 0;
  item.playback.playing = !item.playback.playing;
  render();
}
function playbackStep(delta){
  const item = currentItem();
  if(!item || !item.playback) return;
  const total = canonicalPlaybackTotal(item);
  item.playback.playing = false;
  item.playback.index = Math.max(0, Math.min(total, item.playback.index+delta));
  render();
}
function playbackRestart(){
  const item = currentItem();
  if(!item || !item.playback) return;
  item.playback.index = 0;
  item.playback.playing = false;
  render();
}

function renderSession(container){
  const item = currentItem();
  const profile = currentProfile();
  const embeddedProgram=itemHasInteractiveProgram(item)&&item.program.statements.length>1;

  // This item's own assignment-target label text/width — see the header
  // comment above. Computed once per render and threaded through every
  // renderAssignLabel() call below (and into renderCanonicalPlayback, which
  // renders this same item's derivation) so the "=" column lines up
  // consistently across every row for THIS item.
  const assignLabelText = 'int ' + (item.resultName || 'result');
  const assignLabelCh = assignLabelText.length + 1; // +1 for the space before '='

  // Mode tag, links toggle, and exam timer are global app settings, not
  // per-profile — they now live in the static app header (index.html) and
  // are kept in sync by main.js's syncGlobalHeaderUI(), not rebuilt here.
  if(!embeddedProgram){
    container.appendChild(h('div',{class:'session-bar'},
      h('div',{class:'session-meta'}, h('b',{}, `Item ${state.itemIndex+1}`), ` / ${state.items.length}  ·  ${profile.name}`)
    ));
    const examBar=renderExamItemBar(item);
    if(examBar) container.appendChild(examBar);
  }
  const hasInteractiveDeclarations = itemHasInteractiveProgram(item);
  const expressionStatement=item.program&&Array.isArray(item.program.statements)
    ? item.program.statements.find(statement=>statement.kind==='legacy-expression')
    : null;
  let evaluationHost=container;
  if(embeddedProgram){
    evaluationHost=h('section',{class:'program-statement legacy-program-statement active expanded',
      'data-statement-id':'expression'});
    container.appendChild(evaluationHost);
  }
  if(!hasInteractiveDeclarations){
    const seededSource=renderSeededSourceDisclosure(item.decls);
    if(seededSource) evaluationHost.appendChild(seededSource);
  }

  // The same renderer is used by declaration initializers; this invocation
  // preserves the legacy item as the reference behavior.
  const evalPanel = renderExpressionEvaluationPanel({
    runtime:item,
    labelText:assignLabelText,
    labelCh:assignLabelCh,
    title:embeddedProgram?null:'Evaluation',
    panelClass:'eval-panel'+(embeddedProgram?' program-expression-panel final-expression-panel':''),
    statementId:embeddedProgram?'expression':null,
    statementNumber:embeddedProgram?item.program.cursor+1:null,
    continuationStyle:true,
    interactive:!item.checked&&!item.practiceInvalidExecution&&!examInteractionLocked(),
    revealCorrectness:item.checked&&state.mode!=='exam',
    isFullyResolved:()=>itemFullyResolved(item),
    renderTrailingActions:()=>renderInlineEvaluationActions({
      canUndo:canUndoForCurrentMode(item)&&!item.practiceInvalidExecution,
      canCheck:!item.checked&&!examInteractionLocked()&&itemFullyResolved(item)
    })
  });
  evaluationHost.appendChild(evalPanel);
  const invalidExecutionAlert=renderInvalidExecutionAlert(item,expressionStatement);
  if(invalidExecutionAlert) evaluationHost.appendChild(invalidExecutionAlert);
  const canReset = state.mode==='practice' && !item.checked && (
    item.trace.length>0 || (item.program && item.program.cursor>0));
  const resetControl=renderItemResetControl(canReset);
  if(resetControl) evaluationHost.appendChild(resetControl);

  if(!item.practiceInvalidExecution&&!itemFullyResolved(item) && !item.checked
    &&(state.mode!=='exam'||activeExamPolicy().showNeutralGuidance)){
    const unresolvedCount = collectUnresolvedFlat(item.workingFlat,[]).length;
    if(unresolvedCount>0){
      evaluationHost.appendChild(renderContextHelp(`Resolve ${unresolvedCount} more highlighted token${unresolvedCount>1?'s':''} (variable, constant, or unary) before operators become active.`));
    } else {
      evaluationHost.appendChild(renderContextHelp('Tap any highlighted operator to evaluate it — you choose the order. Wrong order is allowed; you\'ll see how it plays out.'));
    }
  }

  // feedback
  const examFeedbackDeferred=state.mode==='exam'&&!examFeedbackVisible();
  if(item.checked&&examFeedbackDeferred){
    if(!(item.examSequenceFailure&&item.examSequenceFailure.terminal)){
      container.appendChild(h('div',{class:'exam-answer-recorded'},
        h('i',{class:'fa-solid fa-lock'}),
        h('span',{},h('b',{},'Answer recorded and locked.'),' Correctness and score are withheld until time expires.')));
    }
    if(typeof clearFeedbackDrawerContent==='function'){
      try{
        clearFeedbackDrawerContent();
        if(typeof hideFeedbackDrawerTab==='function') hideFeedbackDrawerTab();
        if(typeof closeFeedbackDrawer==='function') closeFeedbackDrawer();
      }catch(e){ /* no-op */ }
    }
  } else if(item.checked){
    const correct = item.wasCorrectFinal;
    // The whole session view is torn down and rebuilt on every render() call
    // (including once per second while answer-key playback is auto-advancing),
    // so a brand-new .feedback DOM node is created every single tick even
    // though the box itself never actually re-appears. An unconditional
    // "pop in" animation class would therefore replay on every tick, making
    // the whole box look like it's blinking. `_feedbackAnimated` is a plain
    // flag on the persistent item object (not the DOM), so it survives
    // across rebuilds and the entrance animation fires exactly once, right
    // when Check is first pressed.
    // Also doubles as the "should the feedback drawer auto-open?" signal
    // below — both questions are really the same one ("has feedback for
    // THIS check already been shown to the student"), so they share the
    // one flag rather than tracking it twice.
    const isFirstFeedbackShow = !item._feedbackAnimated;
    const fbEnterCls = item._feedbackAnimated ? '' : ' feedback-enter';
    item._feedbackAnimated = true;
    const fb = h('div',{class:'feedback '+(correct?'correct':'incorrect')+fbEnterCls});
    fb.appendChild(h('div',{class:'feedback-head'}, h('i',{class:'fa-solid '+(correct?'fa-circle-check':'fa-circle-xmark')}), correct ? ' Correct' : ' Incorrect'));
    const terminalSequenceFailure=item.examSequenceFailure&&item.examSequenceFailure.terminal;
    fb.appendChild(h('div',{class:'feedback-body'},
      terminalSequenceFailure
        ? h('span',{},'This item ended when an operation was selected before its required value was available. Credit was retained only for the correct sequence completed before that attempt.')
        : (correct
          ? h('span',{}, 'Your derived result matches the independently calculated answer: ', h('span',{class:'num'}, String(item.correctFinalValue)), '.')
          : h('span',{}, 'Your derived result was ', h('span',{class:'num'}, String(item.studentFinal)), '. The correct result is ', h('span',{class:'num'}, String(item.correctFinalValue)), '.'))
    ));
    fb.appendChild(h('div',{class:'feedback-stats'},
      item.examSequenceFailure
        ? h('div',{class:'stat'},h('div',{class:'sv'},`${item.examSequenceFailure.correctPrefixChecks}/${item.examSequenceFailure.totalChecks}`),h('div',{class:'sl'},'credited sequence checks'))
        : h('div',{class:'stat'}, h('div',{class:'sv'}, `${item.correctSteps}/${item.totalOpSteps}`), h('div',{class:'sl'},'steps in correct order')),
      item.programScoreFacts && item.programScoreFacts.programTotalChecks>0
        ? h('div',{class:'stat'},
            h('div',{class:'sv'}, `${item.programScoreFacts.programCorrectChecks}/${item.programScoreFacts.programTotalChecks}`),
            h('div',{class:'sl'},'program statement checks'))
        : null,
      h('div',{class:'stat'}, h('div',{class:'sv'}, `${Math.round(item.itemScore*100)}%`), h('div',{class:'sl'},'item score'))
    ));
    // Additive hook for the moment-to-moment feedback module
    // (js/moment-feedback.js) — entirely optional. If that script isn't
    // loaded, or it fails for any reason, this is a silent no-op and the
    // feedback card renders exactly as it did before that module existed.
    if(typeof renderMomentFeedbackBlock === 'function'){
      let mfBlock = null;
      try{ mfBlock = renderMomentFeedbackBlock(item); }catch(e){ mfBlock = null; }
      if(mfBlock) fb.appendChild(mfBlock);
    }
    if(state.mode==='practice'){
      fb.appendChild(h('button',{class:'solution-toggle', onclick:toggleSolution}, item.showSolution ? 'Hide correct solution' : 'Show correct solution'));
      if(item.showSolution){
        fb.appendChild(hasInteractiveDeclarations
          ? renderCanonicalProgramPlayback(item, assignLabelText, assignLabelCh)
          : renderCanonicalPlayback(item, assignLabelText, assignLabelCh));
      }
    }
    // Feedback now lives in the toggleable feedback drawer (feedback-drawer.js)
    // instead of inline below the action bar — same content/behavior as
    // before, just relocated to cut down on page scrolling. Fully guarded:
    // if feedback-drawer.js isn't loaded (or setFeedbackDrawerContent
    // throws for any reason), fall straight back to the original inline
    // placement so a missing/broken drawer module can never hide the
    // student's result.
    let placedInDrawer = false;
    if(typeof setFeedbackDrawerContent === 'function'){
      try{
        setFeedbackDrawerContent(fb);
        placedInDrawer = true;
      }catch(e){ placedInDrawer = false; }
    }
    if(!placedInDrawer) container.appendChild(fb);

    // Additive hook for the juice/feel module (js/juice.js) — entirely
    // optional. fb must already be attached to the live DOM (true either
    // way above — the drawer's content div is part of the live document
    // once setFeedbackDrawerContent has run) for spawnConfetti's
    // positioning to be accurate. If the script isn't loaded, or it fails
    // for any reason, this is a silent no-op.
    if(typeof renderItemCelebration === 'function'){
      try{
        const celebration = renderItemCelebration(item, fb);
        if(celebration) fb.appendChild(celebration);
      }catch(e){ /* silent no-op */ }
    }

    if(placedInDrawer){
      // Keep the tab visible and its correct/incorrect dot in sync, and
      // auto-open the drawer the FIRST time this item's feedback is shown
      // (mirroring the one-shot behavior isFirstFeedbackShow/
      // _feedbackAnimated already governs for the entrance animation).
      // Later re-renders of the SAME check — e.g. the once-a-second
      // re-renders that happen while the answer-key playback below is
      // auto-advancing — never force it back open if the student closed
      // it; a fresh item (item.checked false again) resets the flag via
      // the branch below, so the NEXT check still auto-opens.
      if(typeof showFeedbackDrawerTab === 'function') showFeedbackDrawerTab();
      if(typeof setFeedbackDrawerStatus === 'function') setFeedbackDrawerStatus(correct);
      if(isFirstFeedbackShow && typeof openFeedbackDrawer === 'function') openFeedbackDrawer();
    }

    if(state.mode==='practice'){
      appendPracticeRetryBar(container);
    }
  } else if(typeof clearFeedbackDrawerContent === 'function'){
    // This item hasn't been checked yet — make sure feedback left over
    // from a PREVIOUS item (or a previous attempt at this one, after
    // Reset/Try again) doesn't linger visible in the drawer. Guarded like
    // every other call into feedback-drawer.js: a missing/broken module
    // here is a silent no-op, never a thrown error.
    try{
      clearFeedbackDrawerContent();
      if(typeof setFeedbackDrawerStatus === 'function') setFeedbackDrawerStatus(null);
      if(typeof hideFeedbackDrawerTab === 'function') hideFeedbackDrawerTab();
      if(typeof isFeedbackDrawerOpen === 'function' && isFeedbackDrawerOpen()
         && typeof closeFeedbackDrawer === 'function') closeFeedbackDrawer();
    }catch(e){ /* no-op */ }
  }
}

// assignLabelText/assignLabelCh are passed in from renderSession (computed
// from this same item's item.resultName) rather than recomputed here, so
// the canonical-playback panel's "=" column lines up with exactly the same
// reserved width the live session panel above it used for this item.
function renderPlaybackControls(item,total){
  const pb=item.playback;
  return h('div',{class:'playback-controls'},
    h('button',{class:'btn playback-btn', disabled:pb.index<=0, onclick:()=>playbackStep(-1)}, h('i',{class:'fa-solid fa-backward-step'}), ' Prev'),
    h('button',{class:'btn btn-primary playback-btn', onclick:playbackTogglePlay},
      pb.playing ? h('span',{}, h('i',{class:'fa-solid fa-pause'}), ' Pause') : (pb.index>=total ? h('span',{}, h('i',{class:'fa-solid fa-rotate-right'}), ' Replay') : h('span',{}, h('i',{class:'fa-solid fa-play'}), ' Play'))),
    h('button',{class:'btn playback-btn', disabled:pb.index>=total, onclick:()=>playbackStep(1)}, 'Next ', h('i',{class:'fa-solid fa-forward-step'})),
    h('span',{class:'playback-progress'}, `${pb.index} / ${total} steps`));
}

function renderCanonicalPlayback(item, assignLabelText, assignLabelCh, options){
  options=options||{};
  const pb = options.playback || item.playback;
  const total = item.canonicalTrace.steps.length;

  const wrap = h('div',{class:'solution-playback'+(options.embedded?' canonical-final-playback':''),
    'data-canonical-visible':pb.index});
  if(!options.hideControls) wrap.appendChild(renderPlaybackControls(item,total));

  const timeline = h('div',{class:'timeline solution-timeline'});

  const state0Row = h('div',{class:'tl-row'+(pb.index===0?' current':' done')});
  state0Row.appendChild(h('div',{class:'tl-dot', style:'background:#4b5364;'}));
  const pend0 = pendingNodeId(item.canonicalTrace.steps[0], item.canonicalTrace.treeStates[0]);
  state0Row.appendChild(h('div',{class:'code-out'+(pb.index===0?' row-enter':'')}, renderAssignLabel(true, assignLabelText, assignLabelCh),
    h('span',{class:'source-assignment-equals',title:'Assignment operator'},'='),' ',
    renderStaticExpr(item.canonicalTrace.treeStates[0], 0, new Map(), null, pend0,
      stepVisualColor(item.canonicalTrace.steps[0],0)), ';'));
  timeline.appendChild(state0Row);

  // Loop over EVERY step (0..total-1), not just the ones revealed so far.
  // A row for a not-yet-reached step is still built — same markup, same
  // font-size, same height — so the timeline's total height is fixed at its
  // maximum on the very first render of this panel. Only its visibility
  // (via the .tl-future class) changes as pb.index advances; nothing is
  // ever appended afterward, so nothing below this panel has to shift.
  for(let i=0; i<total; i++){
    const revealed = i < pb.index;
    const t = item.canonicalTrace.steps[i];
    const isLast = i === pb.index-1;
    const color = stepVisualColor(t,i);
    const row = h('div',{class:'tl-row'+(isLast?' current':' done')+(revealed?'':' tl-future')});
    row.appendChild(h('div',{class:'tl-dot', style:`background:${color};`+(isLast&&revealed?`box-shadow:0 0 0 4px ${hexToRgba(color,0.25)};`:''), title: revealed ? stepTooltip(t) : null}));
    // Unrevealed rows get no color map / pending preview / flash — they're
    // laid out (for height) but must not visually leak the upcoming value.
    const colorMap = revealed ? buildColorMap(item.canonicalTrace.steps, i+1) : new Map();
    const nextStep = item.canonicalTrace.steps[i+1];
    const pendId = revealed && nextStep ? pendingNodeId(nextStep, item.canonicalTrace.treeStates[i+1]) : null;
    row.appendChild(h('div',{class:'code-out'+(isLast&&revealed?' row-enter':'')}, renderAssignLabel(false, assignLabelText, assignLabelCh),
      h('span',{class:'continuation-equals',title:'Equivalent evaluation step'},'='),' ',
      renderStaticExpr(item.canonicalTrace.treeStates[i+1], 0, colorMap, isLast&&revealed ? t.resultNodeId : null, pendId,
        revealed&&nextStep ? stepVisualColor(nextStep,i+1) : null)));
    timeline.appendChild(row);
  }

  wrap.appendChild(timeline);
  return wrap;
}

// Shared live-expression renderer. Legacy items and declaration initializers
// both pass their expression-shaped runtime into this one implementation, so
// row spacing, LHS reservation, equals alignment, cards, colors, transitions
// and connector lookup attributes cannot drift between profile types.
function renderExpressionEvaluationPanel(options){
  const runtime = options.runtime;
  const labelText = options.labelText || '';
  const labelCh = options.labelCh == null ? labelText.length+1 : options.labelCh;
  const resolved = ()=>!!options.isFullyResolved(runtime);
  const canInteract = options.interactive !== false;
  const equalsNode = (ready,context)=>typeof options.renderEquals==='function'
    ? options.renderEquals(ready,context) : '=';
  const prefixNodes = context=>typeof options.renderPrefix==='function'
    ? options.renderPrefix(context)
    : [renderAssignLabel(context.showLabel,labelText,labelCh),
      h('span',{class:context.isSource?'source-assignment-equals':'continuation-equals',
        title:context.isSource?'Assignment operator':'Equivalent evaluation step'},equalsNode(context.ready,context)),' '];
  const terminator = context=>typeof options.renderTerminator==='function'
    ? options.renderTerminator(context)
    : (options.continuationStyle?(context.isSource?';':''):';');
  const trailingActions = context=>typeof options.renderTrailingActions==='function'
    ? options.renderTrailingActions(context) : null;
  // Statement adapters may replace only the fully-resolved final value while
  // retaining this renderer's source row, intermediate rows, alignment,
  // animation lifecycle and connector IDs. Standalone unary updates use this
  // to show the updated named memory slot instead of a context-free literal;
  // ordinary/legacy expressions do not supply the hook and remain unchanged.
  const finalValueNode = context=>typeof options.renderFinalValue==='function'
    ? options.renderFinalValue(context) : null;
  const panelAttrs = {class:(options.panelClass || 'eval-panel')+' expression-scroll-surface'};
  if(options.statementId) panelAttrs['data-statement-id'] = options.statementId;
  const panel = h('div',panelAttrs);
  if(options.title!==null) panel.appendChild(h('div',{class:'panel-title'},options.title || 'Evaluation'));
  if(options.beforeTimeline) panel.appendChild(options.beforeTimeline);
  const timeline = h('div',{class:'timeline expression-timeline'});

  const initRow = h('div',{class:'tl-row source-row'+(runtime.trace.length>0||options.rowsComplete?' done':' current')});
  initRow.appendChild(h('div',{class:'tl-dot'+(options.statementNumber?' statement-source-dot':''),
    style:'background:#4b5364;',title:'Original statement'},options.statementNumber?String(options.statementNumber):null));
  if(runtime.trace.length===0){
    const unresolved = collectUnresolvedFlat(runtime.workingFlat,[]).length>0;
    const ready = canInteract && resolved();
    initRow.appendChild(h('div',{class:'code-out'},renderBadgeSlot(null),options.sourceIndent||'',
      prefixNodes({showLabel:true,isSource:true,ready,isCurrent:true,isFinalRow:resolved(),activeColor:stepColor(0),
        stepCount:0,pendingStep:null,currentStep:null,flashId:null}),
      canInteract
        ? renderInteractiveFlatExpr(runtime.workingFlat,new Map(),stepColor(0),null,unresolved)
        : renderStaticFlatExpr(runtime.workingFlat,new Map(),null,null),terminator({isSource:true}),
      trailingActions({isCurrent:true,isFinalRow:resolved(),runtime})));
  } else {
    const firstColor = stepVisualColor(runtime.trace[0],0);
    const pending = pendingFlatWithColor(runtime.trace[0],firstColor);
    initRow.appendChild(h('div',{class:'code-out'},renderBadgeSlot(null),options.sourceIndent||'',
      prefixNodes({showLabel:true,isSource:true,ready:false,isCurrent:false,isFinalRow:false,activeColor:firstColor,
        stepCount:0,pendingStep:runtime.trace[0],currentStep:null,flashId:null}),
      renderStaticFlatExpr(runtime.originalFlat,new Map(),null,pending),terminator({isSource:true})));
  }
  timeline.appendChild(initRow);

  runtime.trace.forEach((step,index)=>{
    const isLast = index===runtime.trace.length-1;
    const isCurrent=isLast&&!options.rowsComplete;
    const row = h('div',{class:'tl-row'+(isCurrent?' current':' done')});
    const color = stepVisualColor(step,index);
    const tip = stepTooltip(step,options.revealCorrectness);
    row.appendChild(h('div',{class:'tl-dot',style:`background:${color};`+(isCurrent?`box-shadow:0 0 0 4px ${hexToRgba(color,0.25)};`:''),title:tip}));
    const badge = step.action==='EVALUATE' && options.revealCorrectness
      ? h('span',{class:'step-badge '+(step.wasCorrect?'ok':'warn'),title:tip,'aria-label':tip,role:'img'},
          h('i',{class:'fa-solid '+(step.wasCorrect?'fa-check':'fa-exclamation')})) : null;
    const colors = buildColorMap(runtime.trace,index+1);
    const flashId = step._flashed || !isCurrent ? null : step.resultNodeId;
    step._flashed = true;
    const isFinalRow = isLast && resolved();
    if(isLast){
      const unresolved = collectUnresolvedFlat(runtime.workingFlat,[]).length>0;
      const enterClass = step._entered || !isCurrent ? '' : ' row-enter';
      step._entered = true;
      const customFinalValue=isFinalRow ? finalValueNode({
        runtime,step,index,flashId,color,isCurrent,isFinalRow
      }) : null;
      row.appendChild(h('div',{class:'code-out'+enterClass},renderBadgeSlot(badge),options.sourceIndent||'',
        prefixNodes({showLabel:false,isSource:false,ready:canInteract&&isFinalRow,isCurrent:true,isFinalRow,
          activeColor:stepColor(runtime.trace.length),stepCount:index+1,pendingStep:null,
          currentStep:step,flashId}),
        customFinalValue || (canInteract
          ? renderInteractiveFlatExpr(runtime.workingFlat,colors,stepColor(runtime.trace.length),flashId,unresolved)
          : renderStaticFlatExpr(runtime.workingFlat,colors,flashId,null)),terminator({isSource:false,isFinalRow}),
        trailingActions({isCurrent:true,isFinalRow,runtime})));
    } else {
      const nextStep = runtime.trace[index+1];
      const nextColor = stepVisualColor(nextStep,index+1);
      const pending = pendingFlatWithColor(nextStep,nextColor);
      row.appendChild(h('div',{class:'code-out'},renderBadgeSlot(badge),options.sourceIndent||'',
        prefixNodes({showLabel:false,isSource:false,ready:false,isCurrent:false,isFinalRow:false,activeColor:nextColor,
          stepCount:index+1,pendingStep:nextStep,currentStep:step,flashId}),
        renderStaticFlatExpr(runtime.history[index+1],colors,flashId,pending),terminator({isSource:false,isFinalRow:false})));
    }
    timeline.appendChild(row);
  });

  if(typeof options.renderAfterRows==='function') options.renderAfterRows(timeline,{runtime,resolved:resolved()});

  panel.appendChild(timeline);
  return panel;
}

function canonicalProgramSegments(item){
  if(!itemHasInteractiveProgram(item)) return [];
  const segments=[];
  item.program.statements.forEach((statement,index)=>{
    if(statement.kind==='declaration'||statement.kind==='assignment'){
      const expressionSteps=(statement.runtime&&statement.runtime.canonicalTrace
        ? statement.runtime.canonicalTrace.steps.length : 0);
      const targetRead=statement.kind==='assignment'&&isCompoundAssignment(statement)?1:0;
      segments.push({kind:'statement',statement,index,targetRead,expressionSteps,
        length:targetRead+expressionSteps+1});
    } else if(statement.kind==='unary-update'){
      const expressionSteps=(statement.runtime&&statement.runtime.canonicalTrace
        ? statement.runtime.canonicalTrace.steps.length : 0);
      segments.push({kind:'statement',statement,index,targetRead:0,expressionSteps,
        length:expressionSteps});
    } else if(statement.kind==='legacy-expression'){
      segments.push({kind:'final',statement,index,length:item.canonicalTrace.steps.length});
    }
  });
  let start=0;
  segments.forEach((segment,index)=>{
    segment.start=start;
    start+=segment.length+(index<segments.length-1?1:0);
  });
  return segments;
}

function canonicalPlaybackTotal(item){
  const segments=canonicalProgramSegments(item);
  return segments.length ? segments[segments.length-1].start+segments[segments.length-1].length
    : (item&&item.canonicalTrace ? item.canonicalTrace.steps.length : 0);
}

function canonicalStatementRuntime(statement,localIndex){
  const source=statement.runtime;
  const compound=statement.kind==='assignment'&&isCompoundAssignment(statement);
  const readVisible=compound&&localIndex>0;
  const expressionVisible=Math.max(0,Math.min(source.canonicalTrace.steps.length,
    localIndex-(compound?1:0)));
  const flats=source.canonicalTrace.treeStates.map(tree=>flattenInstance(tree));
  const trace=[];
  const history=[deepCloneFlat(flats[0])];
  if(readVisible){
    trace.push({action:'READ_TARGET',target:statement.target,targetKind:'variable',
      sourceValue:source.expectedBefore,resultNodeId:assignmentTargetTokenId(statement),
      expressionBefore:flatToString(flats[0]),expressionAfter:flatToString(flats[0])});
    history.push(deepCloneFlat(flats[0]));
  }
  for(let i=0;i<expressionVisible;i++){
    trace.push(source.canonicalTrace.steps[i]);
    history.push(deepCloneFlat(flats[i+1]));
  }
  return Object.assign({},source,{
    originalFlat:deepCloneFlat(flats[0]),workingFlat:deepCloneFlat(flats[expressionVisible]),
    history,trace,targetRevealed:readVisible,targetReadValue:source.expectedBefore,
    checked:false,assignmentMergePending:false
  });
}

function canonicalAssignmentPrefix(statement,context){
  if(isCompoundAssignment(statement)) return renderCompoundAssignmentPrefix(statement,context,false);
  return [renderAssignLabel(context.showLabel,statement.target,statement.target.length+1),
    h('span',{class:context.isSource?'source-assignment-equals':'continuation-equals',
      'data-assignment-op-id':statement.id,title:'Assignment operator'},'='),' '];
}

function canonicalDeclarationPrefix(statement,labelText,labelCh,context){
  return [renderAssignLabel(context.showLabel,labelText,labelCh),
    h('span',{class:context.isSource?'source-assignment-equals':'continuation-equals',
      'data-assignment-op-id':statement.id,title:'Assignment operator'},'='),' '];
}

function appendCanonicalAssignmentResult(timeline,statement,runtime,isCurrent){
  if(statement.kind==='assignment'&&isCompoundAssignment(statement)){
    const completeStatement=Object.assign({},statement,{runtime:Object.assign({},runtime,{
      checked:true,beforeValue:runtime.expectedBefore,rhsValue:runtime.expectedRhs,
      assignedValue:runtime.expectedAfter,assignmentResultNodeId:assignmentResultTokenId(statement),
      assignmentMergePending:false
    })});
    appendCompoundAssignmentResult(timeline,completeStatement,{historical:!isCurrent});
    return;
  }
  const target=statement.kind==='declaration'?statement.binding.name:statement.target;
  const kind=statement.kind==='declaration'?statement.binding.kind:'variable';
  const value=statement.kind==='declaration'?runtime.expectedValue:runtime.expectedAfter;
  const resultId=`canonical-assignment-result-${statement.id}`;
  const color=stepVisualColor({action:'APPLY_ASSIGNMENT'},runtime.canonicalTrace.steps.length);
  const row=h('div',{class:`tl-row ${isCurrent?'current':'done'} canonical-assignment-result-row`});
  row.appendChild(h('div',{class:'tl-dot',style:`background:${color};${isCurrent?`box-shadow:0 0 0 4px ${hexToRgba(color,0.25)};`:''}`,
    title:`${target} now stores ${formatValue(value)}`}));
  const result=renderValueCard({id:resultId,name:target,value,kind,color,isFlash:isCurrent});
  row.appendChild(h('div',{class:'code-out'+(isCurrent?' row-enter':'')},renderBadgeSlot(null),result));
  timeline.appendChild(row);
}

function renderCanonicalStatementSegment(segment,localIndex,globalIndex){
  const statement=segment.statement;
  const sourceRuntime=statement.runtime;
  const runtime=canonicalStatementRuntime(statement,localIndex);
  const commitVisible=localIndex>=segment.length;
  const commitCurrent=commitVisible&&globalIndex===segment.start+segment.length;
  const labelText=statement.kind==='declaration'
    ? `${declarationKeyword(statement)} ${statement.binding.name}`
    : (statement.kind==='unary-update'?'':statement.target);
  const viewStatement=Object.assign({},statement,{runtime});
  const card=h('section',{class:`canonical-program-statement ${statement.kind}-statement`,
    'data-canonical-statement-id':statement.id});
  card.appendChild(renderExpressionEvaluationPanel({runtime,labelText,labelCh:labelText.length+1,
    title:null,panelClass:'canonical-program-expression-panel',statementId:statement.id,
    statementNumber:programStatementDisplayNumber(statement,segment.index),sourceIndent:statement.sourceIndent||'',
    continuationStyle:true,interactive:false,
    rowsComplete:commitVisible,
    isFullyResolved:()=>statement.kind==='unary-update'
      &&typeof unaryUpdateRuntimeResolved==='function'&&unaryUpdateRuntimeResolved(runtime),
    renderFinalValue:statement.kind==='unary-update'
      ? (context=>renderUnaryUpdateStoredResult(statement,runtime,context)) : null,
    renderPrefix:statement.kind==='unary-update'
      ? (()=>[])
      : (statement.kind==='declaration'
        ? (context=>canonicalDeclarationPrefix(statement,labelText,labelText.length+1,context))
        : (context=>canonicalAssignmentPrefix(viewStatement,context))),
    renderAfterRows:commitVisible&&statement.kind!=='unary-update'
      ? (timeline=>appendCanonicalAssignmentResult(timeline,statement,sourceRuntime,commitCurrent)):null}));
  return card;
}

function renderCanonicalProgramPlayback(item,assignLabelText,assignLabelCh){
  const segments=canonicalProgramSegments(item);
  const total=canonicalPlaybackTotal(item);
  const wrap=h('div',{class:'canonical-program-playback'});
  wrap.appendChild(renderPlaybackControls(item,total));
  wrap.appendChild(h('div',{class:'panel-title'},'Correct program sequence'));
  segments.forEach(segment=>{
    if(item.playback.index<segment.start) return;
    const localIndex=Math.min(segment.length,item.playback.index-segment.start);
    if(segment.kind==='statement') wrap.appendChild(renderCanonicalStatementSegment(segment,localIndex,item.playback.index));
    else wrap.appendChild(renderCanonicalPlayback(item,assignLabelText,assignLabelCh,{
      playback:{index:localIndex,playing:item.playback.playing},hideControls:true,embedded:true}));
  });
  return wrap;
}

// Program Core owns statement dispatch; this renderer remains the exact
// legacy session renderer for the compatibility statement kind.
registerStatementRenderer('legacy-expression', ({container,item,program,statement,statementIndex,isActive})=>{
  // A one-statement compatibility item renders exactly as before. In an
  // interactive program, the final expression remains visible as a compact
  // waiting line until Program Core advances to it.
  if(program.statements.length>1 && !isActive){
    const card=h('section',{class:`program-statement legacy-program-statement ${statement.status}`,
      'data-statement-id':statement.id});
    card.appendChild(renderProgramStatementSummary(statement,statementIndex,
      programStatementSource(statement,item)));
    container.appendChild(card);
    return;
  }
  renderSession(container);
});
