// ============================================================================
// DECLARATION STATEMENT ADAPTER
// ----------------------------------------------------------------------------
// Declaration semantics and program sequencing remain statement-specific.
// All expression-like presentation is delegated to the exact renderer used
// by legacy profiles (renderExpressionEvaluationPanel in render-session.js).
// ============================================================================

function declarationKeyword(statement){
  const type = statement.binding.dataType || 'int';
  return statement.binding.mutable ? type : `final ${type}`;
}

function renderDeclarationEquals(statement,ready,context,item,isActive){
  const strictCandidate=typeof strictSequenceEnabled==='function'&&strictSequenceEnabled()
    &&isActive&&context&&context.isCurrent&&!item.checked&&!item.practiceInvalidExecution;
  const actionable=isActive&&context&&context.isCurrent&&!item.checked&&!item.practiceInvalidExecution&&(ready||strictCandidate);
  if(!actionable) return h('span',{class:'declaration-equals tok tok-op-muted declaration-equals-static'},'=');
  return h('button',{class:'declaration-equals tok tok-op-active tok-colored ready'+(strictCandidate?' strict-sequence-candidate':''),
    title:`Assign the current value to ${statement.binding.name}`,
    'aria-label':`assign value to ${statement.binding.name}`,
    onclick:()=>handleTokenClick({type:'commit-assignment',statementId:statement.id})},'=');
}

function renderDeclarationStatement(ctx){
  const {container,item,program,statement,statementIndex,isActive} = ctx;
  const runtime = statement.runtime;
  const expanded=statement.status==='complete'&&!!(statement._uiExpanded||statement._uiJustCompleted);

  const card = h('section',{class:`program-statement declaration-statement ${statement.status}${state.mode==='practice'&&invalidExecutionBelongsToStatement(item,statement)?' practice-paused':''}`,
    'data-statement-id':statement.id});
  if(!isActive&&!expanded){
    card.appendChild(renderProgramStatementSummary(statement,statementIndex,
      programStatementSource(statement,item)));
    container.appendChild(card);
    return;
  }
  card.classList.add('expanded');

  if(!declarationHasInitializer(statement)){
    const timeline=h('div',{class:'timeline program-summary-timeline'});
    const row=h('div',{class:`tl-row program-summary-row ${runtime.checked?'done':'current'}`});
    row.appendChild(h('div',{class:'tl-dot statement-source-dot'},String(programStatementDisplayNumber(statement,statementIndex))));
    const source=h('code',{},programStatementSource(statement,item));
    const content=isActive&&!runtime.checked
      ?h('button',{class:'code-out program-summary-code declaration-direct-action',type:'button',
          title:`Declare ${statement.binding.name}`,'aria-label':`Declare ${statement.binding.dataType} ${statement.binding.name}`,
          onclick:()=>handleTokenClick({type:'declare-binding',statementId:statement.id})},source)
      :h('div',{class:'code-out program-summary-code'},
          h('i',{class:'fa-solid fa-circle-check program-summary-status','aria-hidden':'true'}),source,
          renderCollapseStatementAction(statement,statementIndex));
    row.appendChild(content);timeline.appendChild(row);card.appendChild(timeline);
    container.appendChild(card);return;
  }

  const labelText = `${declarationKeyword(statement)} ${statement.binding.name}`;
  card.appendChild(renderExpressionEvaluationPanel({
    runtime,
    labelText,
    labelCh:labelText.length+1,
    title:null,
    panelClass:'declaration-eval-panel program-expression-panel',
    statementId:statement.id,
    statementNumber:programStatementDisplayNumber(statement,statementIndex),sourceIndent:statement.sourceIndent||'',
    continuationStyle:true,
    interactive:isActive && !runtime.checked && !item.checked && !item.practiceInvalidExecution&&!examInteractionLocked(),
    revealCorrectness:runtime.checked&&state.mode!=='exam',
    isFullyResolved:()=>declarationInitializerResolved(statement),
    renderEquals:(ready,context)=>renderDeclarationEquals(statement,ready,context,item,isActive),
    renderTrailingActions:()=>isActive
      ? renderInlineEvaluationActions({canUndo:canUndoForCurrentMode(item)&&!item.practiceInvalidExecution})
      : renderCollapseStatementAction(statement,statementIndex)
  }));

  const invalidExecutionAlert=renderInvalidExecutionAlert(item,statement);
  if(invalidExecutionAlert) card.appendChild(invalidExecutionAlert);

  if(isActive&&!item.checked){
    const unresolved = collectUnresolvedFlat(runtime.workingFlat,[]).length>0;
    const ready = declarationInitializerResolved(statement);
    if(!item.practiceInvalidExecution&&(state.mode!=='exam'||activeExamPolicy().showNeutralGuidance)){
      card.appendChild(renderContextHelp(unresolved
        ? 'Substitute the initialized value from program memory before evaluating this initializer.'
        : (ready ? `The initializer is resolved. Click = to assign it to ${statement.binding.name}.`
          : 'Evaluate the highlighted operator.')));
    }
    const canReset = state.mode==='practice' && (program.cursor>0 || runtime.trace.length>0);
    const resetControl=renderItemResetControl(canReset&&!(ctx.services&&ctx.services.statementTraceModal));
    if(resetControl) card.appendChild(resetControl);
  }
  container.appendChild(card);
}

registerStatementRenderer('declaration',renderDeclarationStatement);
