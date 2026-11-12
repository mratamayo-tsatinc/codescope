// Explicit loop continuation. The canonical program graph assigns the next
// condition (or do-while tail) for the nearest enclosing loop.
registerStatementPlugin({
  kind:'program-continue',

  interactionPlan(ctx){
    return {mode:'direct',action:{type:'continue-control',statementId:ctx.statement.id},label:'Continue loop'};
  },

  applyAction(ctx){
    const {statement,action,program}=ctx;
    if(action.type!=='continue-control'||statement.runtime.checked)return {applied:false};
    const semantic=programSemanticsForContext(ctx).execute(statement,program.memory);
    const flow=semantic.effects.find(effect=>effect.kind==='flow');
    statement.runtime.checked=true;
    return {applied:true,completed:true,nextStatementId:flow.nextStatementId,
      event:{type:'CONTINUE',action:'CONTINUE',statementId:statement.id,
        nextStatementId:flow.nextStatementId,effects:semantic.effects,wasCorrect:true}};
  },

  rollbackCompletion(ctx){
    if(!ctx.statement.runtime.checked)return {applied:false};
    ctx.statement.runtime.checked=false;return {applied:true};
  },

  reset(ctx){
    const changed=!!ctx.statement.runtime.checked;
    ctx.statement.runtime.checked=false;return {applied:changed};
  },

  buildCanonicalTrace(ctx){
    return [{type:'CONTINUE',action:'CONTINUE',statementId:ctx.statement.id,
      nextStatementId:ctx.statement.nextStatementId||'$end'}];
  }
});

function renderProgramContinueStatement(ctx){
  const {container,item,statement,statementIndex,isActive}=ctx;
  const actionable=isActive&&!statement.runtime.checked&&!item.checked&&!examInteractionLocked();
  const card=h('section',{class:`program-statement program-continue-statement ${statement.status}`,
    'data-statement-id':statement.id});
  const timeline=h('div',{class:'timeline program-summary-timeline'});
  const row=h('div',{class:`tl-row program-summary-row ${actionable?'current':(statement.status==='complete'?'done':'waiting')}`});
  row.appendChild(h('div',{class:'tl-dot statement-source-dot',title:`Source line ${programStatementDisplayNumber(statement,statementIndex)}`},
    String(programStatementDisplayNumber(statement,statementIndex))));
  const source=statement.sourceText||'continue;';
  const code=h('div',{class:'code-out program-summary-code'});
  code.appendChild(h(actionable?'button':'code',{class:`program-continue-control${actionable?' actionable':''}`,
    type:actionable?'button':null,title:actionable?'Continue with the next loop cycle':null,
    'aria-label':actionable?'Execute continue and advance the loop':null,
    onclick:actionable?()=>handleTokenClick({type:'continue-control',statementId:statement.id}):null},source));
  if(statement.status==='complete')code.appendChild(h('i',{class:'fa-solid fa-circle-check program-summary-status',
    title:'Loop continued','aria-label':'Loop continued'}));
  row.appendChild(code);timeline.appendChild(row);card.appendChild(timeline);container.appendChild(card);
}

registerStatementRenderer('program-continue',renderProgramContinueStatement);
