// Explicit source-program termination. C source adapters map authored
// `return 0;` to this statement so the learner chooses when execution ends.
registerStatementPlugin({
  kind:'program-return',

  interactionPlan(ctx){
    return {mode:'direct',action:{type:'return-program',statementId:ctx.statement.id},label:'End program'};
  },

  applyAction(ctx){
    const {statement,action}=ctx;
    if(action.type!=='return-program'||statement.runtime.checked) return {applied:false};
    statement.runtime.checked=true;
    return {applied:true,completed:true,nextStatementId:'$end',
      event:{type:'RETURN',action:'RETURN',statementId:statement.id,value:statement.value,wasCorrect:true}};
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
    return [{type:'RETURN',action:'RETURN',statementId:ctx.statement.id,value:ctx.statement.value}];
  }
});

function renderProgramReturnStatement(ctx){
  const {container,item,statement,statementIndex,isActive}=ctx;
  const actionable=isActive&&!statement.runtime.checked&&!item.checked&&!examInteractionLocked();
  const card=h('section',{class:`program-statement program-return-statement ${statement.status}`,
    'data-statement-id':statement.id});
  const timeline=h('div',{class:'timeline program-summary-timeline'});
  const row=h('div',{class:`tl-row program-summary-row ${actionable?'current':(statement.status==='complete'?'done':'waiting')}`});
  row.appendChild(h('div',{class:'tl-dot statement-source-dot',title:`Source line ${programStatementDisplayNumber(statement,statementIndex)}`},
    String(programStatementDisplayNumber(statement,statementIndex))));
  const source=statement.sourceText||`return ${statement.value};`;
  const code=h('div',{class:'code-out program-summary-code'});
  code.appendChild(h(actionable?'button':'code',{class:`program-return-control${actionable?' actionable':''}`,
    type:actionable?'button':null,title:actionable?'End program':null,'aria-label':actionable?'Execute return 0 and end program':null,
    onclick:actionable?()=>handleTokenClick({type:'return-program',statementId:statement.id}):null},source));
  if(statement.status==='complete') code.appendChild(h('i',{class:'fa-solid fa-circle-check program-summary-status',
    title:'Program ended','aria-label':'Program ended'}));
  row.appendChild(code);timeline.appendChild(row);card.appendChild(timeline);container.appendChild(card);
}

registerStatementRenderer('program-return',renderProgramReturnStatement);
