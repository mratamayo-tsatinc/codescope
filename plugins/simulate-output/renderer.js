function soProgressSteps(item){
  const entered=soUserLines(item.response.output,item.expectedLines.length);
  const output=item.expectedLines.map((_,index)=>{
    if(item.checked&&soFeedbackReleased(item))return {status:item.result.outputResults[index]?'complete':'invalid'};
    return {status:entered[index]!==undefined&&entered[index]!==''?'complete':'waiting'};
  });
  const variables=item.variables.flatMap((variable,index)=>{
    const values=Array.isArray(variable.expected)?item.response.variables[index]:[item.response.variables[index]];
    const results=item.checked?item.result.variableResults[index]:null;
    return values.map((value,part)=>({status:item.checked&&soFeedbackReleased(item)
      ?(Array.isArray(results)?results[part]:results)?'complete':'invalid'
      :String(value).trim()?'complete':'waiting'}));
  });
  return output.concat(variables);
}

function soSyncProgress(item){
  const bar=document.querySelector('.simulate-output-workspace .program-progress-visual');
  if(!bar)return;
  const steps=soProgressSteps(item),dots=bar.querySelectorAll('.program-progress-dot');
  dots.forEach((dot,index)=>{dot.className=`program-progress-dot ${steps[index].status}`;});
  const complete=steps.filter(step=>step.status==='complete'||step.status==='invalid').length;
  bar.setAttribute('aria-valuenow',String(complete));
  bar.setAttribute('aria-label',`${complete} of ${steps.length} answers entered`);
  const reset=document.querySelector('.simulate-output-workspace .so-reset-button');
  if(reset)reset.disabled=!soHasResponse(item);
}

function soEdit(item,action){
  const result=applyActivityAction(item,action);
  if(!result.applied)return;
  soSyncProgress(item);
  if(typeof saveSessionProgress==='function') saveSessionProgress();
}

function soSourceFragments(line){
  if(/^\s*#/.test(line))return [h('span',{class:'so-syntax-prep'},line)];
  const fragments=[],pattern=/\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:int|char|float|double|void|long|short|const|unsigned|signed|static|return|if|else|for|while|do|break|continue|switch|case|default)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\()/g;
  let cursor=0,match;
  while((match=pattern.exec(line))){
    if(match.index>cursor)fragments.push(line.slice(cursor,match.index));
    const token=match[0];
    const kind=token.startsWith('//')?'comment':/^['"]/.test(token)?'string':/^\d/.test(token)?'number'
      :/^(int|char|float|double|void|long|short|const|unsigned|signed|static)$/.test(token)?'type'
      :/^(return|if|else|for|while|do|break|continue|switch|case|default)$/.test(token)?'keyword':'function';
    fragments.push(h('span',{class:`so-syntax-${kind}`},token));
    cursor=match.index+token.length;
  }
  if(cursor<line.length)fragments.push(line.slice(cursor));
  return fragments.length?fragments:['\u00a0'];
}

function soSourcePanel(item){
  const lines=item.source.split('\n');
  return h('section',{class:'so-source-panel','aria-label':'C source code'},
    h('div',{class:'so-panel-heading'},h('i',{class:'fa-solid fa-code','aria-hidden':'true'}),
      h('span',{},item.filename),h('span',{class:'so-language'},'C')),
    h('div',{class:'so-source-code'},...lines.map((line,index)=>h('div',{class:'so-source-line'},
      h('span',{class:'so-line-number','aria-hidden':'true'},String(index+1)),
      h('span',{class:'so-source-text'},...soSourceFragments(line))))));
}

function soOutputPanel(item){
  const input=h('textarea',{class:'so-output-input',rows:Math.max(4,Math.min(10,item.expectedLines.length+1)),
    wrap:'off',spellcheck:'false','aria-label':'Predicted console output',
    placeholder:'Type the program output, one line at a time',disabled:item.checked,
    oninput:event=>soEdit(item,{type:'SET_OUTPUT',value:event.currentTarget.value})},item.response.output);
  return h('section',{class:'so-answer-panel'},
    h('div',{class:'so-panel-heading'},h('i',{class:'fa-solid fa-terminal','aria-hidden':'true'}),
      h('span',{},'Predicted output')),
    h('p',{class:'so-answer-hint'},'Match the printed text and line breaks.'),input);
}

function soVariableInput(item,variable,index,part){
  const array=Array.isArray(variable.expected);
  const value=array?item.response.variables[index][part]:item.response.variables[index];
  const label=array?`${variable.name}[${part}]`:variable.name;
  return h('label',{class:'so-variable-row'},h('span',{class:'so-variable-name'},label),
    h('span',{class:'so-variable-equals','aria-hidden':'true'},'='),
    h('input',{class:'so-variable-input',type:'text',value,spellcheck:'false',
      autocomplete:'off','aria-label':`Final value of ${label}`,disabled:item.checked,
      oninput:event=>soEdit(item,{type:'SET_VARIABLE',index,element:array?part:undefined,
        value:event.currentTarget.value})}));
}

function soVariablesPanel(item){
  const rows=item.variables.flatMap((variable,index)=>Array.isArray(variable.expected)
    ?variable.expected.map((_,part)=>soVariableInput(item,variable,index,part))
    :[soVariableInput(item,variable,index)]);
  return h('section',{class:'so-answer-panel'},
    h('div',{class:'so-panel-heading'},h('i',{class:'fa-solid fa-list-ol','aria-hidden':'true'}),
      h('span',{},'Final variable values')),
    rows.length?h('div',{class:'so-variable-list'},...rows)
      :h('p',{class:'so-no-variables'},'No variables to report for this program.'));
}

function soRender({container,item,profile}){
  const steps=soProgressSteps(item),first=steps.findIndex(step=>step.status==='waiting');
  const flow=renderProgramWorkspaceShell(container,item,{statements:steps,
    cursor:first<0?steps.length-1:first,status:item.checked?'complete':'running',progressMode:'completion'});
  flow.parentNode.classList.add('simulate-output-workspace');
  flow.appendChild(h('div',{class:'so-instruction'},
    h('i',{class:'fa-solid fa-circle-info','aria-hidden':'true'}),
    h('span',{},profile.activity.instructions)));
  flow.appendChild(soSourcePanel(item));
  flow.appendChild(h('div',{class:'so-answer-grid'},soOutputPanel(item),soVariablesPanel(item)));
  if(item.checked&&state.mode==='exam'&&!state.examSubmitted){
    flow.appendChild(h('div',{class:'so-recorded',role:'status'},
      h('i',{class:'fa-solid fa-lock','aria-hidden':'true'}),
      ' Answer recorded. Results are available after exam submission if the exam policy permits.'));
  }
  if(!item.checked){
    const controls=h('div',{class:'so-controls'});
    if(state.mode==='practice')controls.appendChild(h('button',{
      class:'item-reset-button so-reset-button',type:'button',disabled:!soHasResponse(item),
      onclick:handleReset},'Reset item'));
    controls.appendChild(renderInlineEvaluationActions({canCheck:true}));
    flow.appendChild(controls);
  }else if(state.mode==='practice'){
    flow.appendChild(h('div',{class:'action-bar'},h('div',{class:'btn-group'},
      h('button',{class:'btn',type:'button',onclick:handleRetrySameItem},
        h('i',{class:'fa-solid fa-rotate-right','aria-hidden':'true'}),' Try again'))));
  }
  soSyncDrawers(item,profile);
}
