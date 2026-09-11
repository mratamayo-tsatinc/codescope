function tcTokenInstruction(profile){return profile.activity.instructions||'Select a token and classify it.';}
function tcStatementTargetIds(item,statement){return item.targetIds.filter(id=>{const token=tcTokenById(item,id);return token&&token.statementId===statement.id;});}
function tcStatementIsComplete(item,statement){const ids=tcStatementTargetIds(item,statement);return ids.length>0&&ids.every(id=>!!tcResponseFor(item,id));}
function tcCorrectnessIsVisible(item){return state.mode!=='exam'||state.examSubmitted;}
function tcStatementState(item,statement){
  const ids=tcStatementTargetIds(item,statement),answered=ids.filter(id=>!!tcResponseFor(item,id));
  if(item.checked&&tcCorrectnessIsVisible(item)){return answered.some(id=>{const response=tcResponseFor(item,id);return response&&!response.wasCorrect;})?'checked-wrong':'checked-correct';}
  if(answered.length===ids.length&&ids.length)return 'answered';
  return answered.length?'partial':'unanswered';
}
function tcCurrentStatementIndex(item){const index=item.statements.findIndex(statement=>!tcStatementIsComplete(item,statement));return index<0?Math.max(0,item.statements.length-1):index;}
function tcStatementSource(statement){return statement.tokens.map((token,index)=>token.text+(statement.tokens[index+1]&&statement.tokens[index+1].role!=='separator'?' ':'')).join('');}
function tcHandleTokenClick(event,item,profile,token){
  if(item.checked||state.examSubmitted||item.invalidSelection)return;
  if(!tcSelectableIds(item,profile).includes(token.id))return;
  if(!item.targetIds.includes(token.id)){
    const result=tcApplyOffTarget(item,profile,token);
    if(result.applied){if(state.mode==='exam')recordExamAction(item,{type:'select-token'},{tokenId:token.id,wasCorrect:false,terminal:!!result.terminal});render();}
    return;
  }
  tcApplyAction({item,profile,action:{type:'SELECT_TOKEN',tokenId:token.id},state});
  tcOpenClassificationModal(item,profile,token,event.currentTarget);
}
function tcTokenShellClass(token,isSelectable,response,item){
  const classes=['tok','tc-token'];
  if(response){
    const def=TC_CATEGORY_DEFS[response.category];classes.push('tok-colored','tc-answered',`tc-category-${def.tone}`);
    if(item.checked&&tcCorrectnessIsVisible(item))classes.push(response.wasCorrect?'tc-answer-correct':'tc-answer-wrong');
  }
  else if(isSelectable)classes.push('tc-selectable');
  else classes.push('tc-static');
  return classes.join(' ');
}
function tcRenderToken(item,profile,token,hasTrailingGap){
  const response=tcResponseFor(item,token.id),selectable=!item.checked&&!item.invalidSelection&&tcSelectableIds(item,profile).includes(token.id);
  const attrs={class:`${tcTokenShellClass(token,selectable,response,item)}${hasTrailingGap?' tc-token-gap':''}`,'data-token-id':token.id,
    title:response?`Selected: ${TC_CATEGORY_DEFS[response.category].label}`:(selectable?'Select this token':'Reference token')};
  if(selectable){attrs.tabindex='0';attrs.role='button';attrs.onclick=event=>tcHandleTokenClick(event,item,profile,token);attrs.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();tcHandleTokenClick(event,item,profile,token);}};}
  return h('span',attrs,document.createTextNode(token.text));
}
function tcRenderStatement(item,profile,statement,index,isLast){
  const lineState=tcStatementState(item,statement),card=h('section',{class:`program-statement token-classification-statement expanded tc-line-${lineState}`,'data-statement-id':statement.id});
  const row=h('div',{class:'tc-editor-row'});
  row.appendChild(h('div',{class:'tc-line-number','aria-label':`Line ${index+1}: ${lineState.replace('-', ' ')}`},String(index+1)));
  const code=h('div',{class:'code-out tc-source-code'});
  statement.tokens.forEach((token,tokenIndex)=>{const next=statement.tokens[tokenIndex+1],hasGap=!!(next&&next.role!=='separator');code.appendChild(tcRenderToken(item,profile,token,hasGap));if(hasGap)code.appendChild(document.createTextNode(' '));});
  const allComplete=item.targetIds.every(id=>!!tcResponseFor(item,id));
  const actions=isLast&&!item.checked?renderInlineEvaluationActions({canUndo:examAllowsUndo()&&item.history.length>0,canCheck:allComplete&&!item.invalidSelection}):null;if(actions)code.appendChild(actions);
  row.appendChild(code);card.appendChild(row);
  return card;
}
function tcRenderInvalidSelection(item){
  if(!item.invalidSelection)return null;const terminal=!!item.invalidSelection.terminal;
  return h('div',{class:`invalid-execution-alert ${terminal?'terminal':'recoverable'}`,role:'alert','aria-live':'assertive'},
    h('div',{class:'invalid-execution-icon','aria-hidden':'true'},h('i',{class:`fa-solid ${terminal?'fa-circle-exclamation':'fa-triangle-exclamation'}`})),
    h('div',{class:'invalid-execution-content'},h('div',{class:'invalid-execution-title'},terminal?'Invalid selection — item ended':'Invalid selection'),
      h('div',{class:'invalid-execution-message'},terminal?'This item cannot continue. Credit earned before this selection has been retained.':'This token is not an assessed target under the current profile.'),
      !terminal&&state.mode==='practice'?h('button',{class:'invalid-execution-recovery',type:'button',onclick:handleUndo},h('i',{class:'fa-solid fa-rotate-left'}),h('span',{},'Undo invalid selection')):null));
}
function tcToggleSolution(){const item=currentItem();if(!item||!item.activityKind||state.mode==='exam')return;item.showSolution=!item.showSolution;render();}
function tcRender({container,item,profile}){
  const currentIndex=tcCurrentStatementIndex(item);
  item.statements.forEach(statement=>{const lineState=tcStatementState(item,statement);statement.status=lineState==='checked-wrong'?'invalid':
    ((lineState==='answered'||lineState==='checked-correct')?'complete':(lineState==='partial'?'partial':'waiting'));});
  const flow=renderProgramWorkspaceShell(container,item,{statements:item.statements,cursor:currentIndex,status:item.checked?'complete':'running',progressMode:'completion'});
  if(flow.parentNode&&flow.parentNode.classList)flow.parentNode.classList.add('token-classification-workspace');
  item.statements.forEach((statement,index)=>flow.appendChild(tcRenderStatement(item,profile,statement,index,index===item.statements.length-1)));
  const invalid=tcRenderInvalidSelection(item);if(invalid)flow.appendChild(invalid);
  if(item.checked&&state.mode==='exam'&&!state.examSubmitted&&!item.invalidSelection)container.appendChild(h('div',{class:'exam-answer-recorded'},h('i',{class:'fa-solid fa-lock'}),h('span',{},h('b',{},'Answer recorded and locked.'),' Correctness and score are withheld until the exam is submitted.')));
  tcSyncDrawers(item,profile);
  if(item.checked&&state.mode==='practice')container.appendChild(h('div',{class:'action-bar'},h('div',{class:'btn-group'},h('button',{class:'btn',onclick:handleRetrySameItem},h('i',{class:'fa-solid fa-rotate-right'}),' Try again'))));
  if(typeof renderVariableFinalFloat==='function')renderVariableFinalFloat(null);
}
