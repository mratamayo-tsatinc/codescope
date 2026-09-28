// Explicit control-flow exit. Source adapters map an authored `break;` to this
// statement and assign its destination from the enclosing control structure.
registerStatementPlugin({
  kind:'program-break',

  interactionPlan(ctx){
    return {mode:'direct',action:{type:'break-control',statementId:ctx.statement.id},label:'Exit switch'};
  },

  applyAction(ctx){
    const {statement,action}=ctx;
    if(action.type!=='break-control'||statement.runtime.checked) return {applied:false};
    statement.runtime.checked=true;
    return {applied:true,completed:true,nextStatementId:statement.nextStatementId||'$end',
      event:{type:'BREAK',action:'BREAK',statementId:statement.id,
        nextStatementId:statement.nextStatementId||'$end',wasCorrect:true}};
  },

  rollbackCompletion(ctx){
    if(!ctx.statement.runtime.checked) return {applied:false};
    ctx.statement.runtime.checked=false;return {applied:true};
  },

  reset(ctx){
    const changed=!!ctx.statement.runtime.checked;
    ctx.statement.runtime.checked=false;return {applied:changed};
  },

  buildCanonicalTrace(ctx){
    return [{type:'BREAK',action:'BREAK',statementId:ctx.statement.id,
      nextStatementId:ctx.statement.nextStatementId||'$end'}];
  }
});

function renderProgramBreakStatement(ctx){
  const {container,item,statement,statementIndex,isActive}=ctx;
  const actionable=isActive&&!statement.runtime.checked&&!item.checked&&!examInteractionLocked();
  const card=h('section',{class:`program-statement program-break-statement ${statement.status}`,
    'data-statement-id':statement.id});
  const timeline=h('div',{class:'timeline program-summary-timeline'});
  const row=h('div',{class:`tl-row program-summary-row ${actionable?'current':(statement.status==='complete'?'done':'waiting')}`});
  row.appendChild(h('div',{class:'tl-dot statement-source-dot',title:`Source line ${programStatementDisplayNumber(statement,statementIndex)}`},
    String(programStatementDisplayNumber(statement,statementIndex))));
  const source=statement.sourceText||'break;';
  const code=h('div',{class:'code-out program-summary-code'});
  code.appendChild(h(actionable?'button':'code',{class:`program-break-control${actionable?' actionable':''}`,
    type:actionable?'button':null,title:actionable?'Exit switch':null,
    'aria-label':actionable?'Execute break and exit switch':null,
    onclick:actionable?()=>handleTokenClick({type:'break-control',statementId:statement.id}):null},source));
  if(statement.status==='complete') code.appendChild(h('i',{class:'fa-solid fa-circle-check program-summary-status',
    title:'Switch exited','aria-label':'Switch exited'}));
  row.appendChild(code);timeline.appendChild(row);card.appendChild(timeline);container.appendChild(card);
}

registerStatementRenderer('program-break',renderProgramBreakStatement);
