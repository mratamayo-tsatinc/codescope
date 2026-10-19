function selectionConditionText(statement){
  if(statement.conditionSource) return statement.conditionSource;
  const source=String(statement.sourceText||'').trim(),open=source.indexOf('('),close=source.lastIndexOf(')');
  return open>=0&&close>open?source.slice(open+1,close).trim():source;
}

function renderSelectionStatement(ctx){
  const {container,item,statement,statementIndex,isActive}=ctx,runtime=statement.runtime;
  const expressionOnly=!!(ctx.services&&ctx.services.expressionOnly);
  const preserveCompletedTimeline=!!(ctx.services&&ctx.services.preserveCompletedTimeline);
  const card=h('section',{class:`program-statement selection-statement ${statement.status}`,'data-statement-id':statement.id});
  if(statement.status==='complete'&&runtime.checked&&!preserveCompletedTimeline){
    const isSwitch=statement.selectionKind==='switch',truth=Boolean(runtime.assignedValue);
    const resultClass=isSwitch?'is-switch':(truth?'is-true':'is-false');
    const resultText=isSwitch?`${formatValue(runtime.assignedValue)} · ${runtime.selectedLabel}`:formatValue(truth);
    card.classList.add('selection-compact');
    card.appendChild(h('span',{class:'selection-compact-line'},String(programStatementDisplayNumber(statement,statementIndex))));
    card.appendChild(h('div',{class:'selection-compact-source'},
      h('span',{class:'selection-keyword'},statement.keyword||'if'),h('span',{class:'selection-paren'},' ('),
      h('span',{class:`selection-compact-box ${resultClass}`,'data-selection-compact-source':statement.id},
        h('code',{class:'selection-compact-code'},selectionConditionText(statement)),
        h('span',{class:'selection-result-value'},resultText)),
      h('span',{class:'selection-paren'},') {')));
    container.appendChild(card);return;
  }
  if(!isActive&&!preserveCompletedTimeline){card.appendChild(renderProgramStatementSummary(statement,statementIndex,statement.sourceText));container.appendChild(card);return;}
  card.classList.add('expanded');
  const keyword=statement.keyword||'if';
  card.appendChild(renderExpressionEvaluationPanel({runtime,title:null,panelClass:'selection-eval-panel program-expression-panel',statementId:statement.id,
    statementNumber:expressionOnly?null:programStatementDisplayNumber(statement,statementIndex),
    sourceIndent:expressionOnly?'':(statement.sourceIndent||''),continuationStyle:true,
    interactive:isActive&&!runtime.checked&&!item.checked&&!item.practiceInvalidExecution&&!examInteractionLocked(),revealCorrectness:runtime.checked&&profileFeedbackVisible(item),
    isFullyResolved:()=>selectionExpressionResolved(statement),
    renderPrefix:expressionOnly?()=>[]:()=>[h('span',{class:'selection-keyword'},keyword),h('span',{class:'selection-paren'},' (')],
    renderTerminator:expressionOnly?()=>null:()=>h('span',{class:'selection-paren'},') {'),
    renderTrailingActions:()=>renderInlineEvaluationActions({
      canUndo:canUndoForCurrentMode(item)&&!item.practiceInvalidExecution
    })
  }));
  const invalidExecutionAlert=renderInvalidExecutionAlert(item,statement);
  if(invalidExecutionAlert)card.appendChild(invalidExecutionAlert);
  if(isActive&&!runtime.checked&&!item.practiceInvalidExecution)
    card.appendChild(renderContextHelp('Evaluate the condition. Its final value automatically selects the next executable statement.'));
  container.appendChild(card);
}
registerStatementRenderer('selection',renderSelectionStatement);

function loopPhaseLabel(statement){
  const phase=statement.runtime&&statement.runtime.loopPhase;
  if(phase==='initialize-condition')return 'Initialize, then test condition';
  if(phase==='update-condition')return 'Update, then test condition';
  if(statement.loopKind==='do-while')return 'Test condition after body';
  return 'Test loop condition';
}

function renderLoopStatement(ctx){
  const {container,item,statement,statementIndex,isActive}=ctx,runtime=statement.runtime;
  const expressionOnly=!!(ctx.services&&ctx.services.expressionOnly);
  const preserveCompletedTimeline=!!(ctx.services&&ctx.services.preserveCompletedTimeline);
  const card=h('section',{class:`program-statement selection-statement loop-statement ${statement.status}`,
    'data-statement-id':statement.id});
  if(statement.loopKind==='do'){
    card.appendChild(renderProgramStatementSummary(statement,statementIndex,statement.sourceText));
    if(isActive&&!runtime.checked&&!item.practiceInvalidExecution)
      card.appendChild(renderContextHelp('Enter the do loop body before checking its condition.'));
    container.appendChild(card);return;
  }
  if(statement.status==='complete'&&runtime.checked&&!preserveCompletedTimeline){
    card.classList.add('selection-compact');
    card.appendChild(h('span',{class:'selection-compact-line'},String(programStatementDisplayNumber(statement,statementIndex))));
    card.appendChild(h('div',{class:'selection-compact-source'},
      h('span',{class:'loop-phase-label'},loopPhaseLabel(statement)),
      h('span',{class:`selection-compact-box ${Boolean(runtime.assignedValue)?'is-true':'is-false'}`},
        h('code',{class:'selection-compact-code'},statement.conditionSource||''),
        h('span',{class:'selection-result-value'},formatValue(Boolean(runtime.assignedValue))))));
    container.appendChild(card);return;
  }
  if(!isActive&&!preserveCompletedTimeline){card.appendChild(renderProgramStatementSummary(statement,statementIndex,statement.sourceText));container.appendChild(card);return;}
  card.classList.add('expanded');
  if(!expressionOnly)card.appendChild(h('div',{class:'loop-phase-label'},loopPhaseLabel(statement)));
  card.appendChild(renderExpressionEvaluationPanel({runtime,title:null,
    panelClass:'selection-eval-panel program-expression-panel',statementId:statement.id,
    statementNumber:expressionOnly?null:programStatementDisplayNumber(statement,statementIndex),
    sourceIndent:expressionOnly?'':(statement.sourceIndent||''),
    continuationStyle:true,interactive:isActive&&!runtime.checked&&!item.checked&&!item.practiceInvalidExecution&&!examInteractionLocked(),
    revealCorrectness:runtime.checked&&profileFeedbackVisible(item),isFullyResolved:()=>loopExpressionResolved(statement),
    renderPrefix:expressionOnly?()=>[]:()=>[h('span',{class:'selection-keyword'},statement.keyword||statement.loopKind),h('span',{class:'selection-paren'},' (')],
    renderTerminator:expressionOnly?()=>null:()=>h('span',{class:'selection-paren'},') {'),
    renderTrailingActions:()=>renderInlineEvaluationActions({canUndo:canUndoForCurrentMode(item)&&!item.practiceInvalidExecution})}));
  const invalidExecutionAlert=renderInvalidExecutionAlert(item,statement);
  if(invalidExecutionAlert)card.appendChild(invalidExecutionAlert);
  if(isActive&&!runtime.checked&&!item.practiceInvalidExecution)
    card.appendChild(renderContextHelp('Evaluate the condition. True enters or repeats the body; false exits the loop.'));
  container.appendChild(card);
}
registerStatementRenderer('loop',renderLoopStatement);
