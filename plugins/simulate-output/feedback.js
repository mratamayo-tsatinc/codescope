function soFeedbackReleased(item){
  if(!item.checked)return false;
  if(state.mode==='practice')return true;
  return !!(state.examSubmitted&&activeExamPolicy().feedbackRelease==='after-submit');
}

function soBuildConsoleContent(){
  return h('div',{class:'so-console-guide'},
    h('h3',{},'Predict a C program'),
    h('p',{},'Read the source from top to bottom. Track each variable update and write only the text printed by the program.'),
    h('ul',{},
      h('li',{},'Use one output line for each printed line. Spaces and punctuation matter.'),
      h('li',{},'Enter final variable values after the program finishes.'),
      h('li',{},'You can revise answers until you press Check.')));
}

function soToggleSolution(){
  const item=currentItem();
  if(!item||item.activityKind!==SIMULATE_OUTPUT_MANIFEST.id||state.mode!=='practice'||!item.checked)return;
  item.showSolution=!item.showSolution;render();
}

function soBuildFeedback(item){
  const result=item.result,root=h('div',{class:'so-feedback'});
  const summary=h('div',{class:`feedback ${item.wasCorrectFinal?'correct':'incorrect'}`},
    h('div',{class:'feedback-head'},h('i',{class:`fa-solid ${item.wasCorrectFinal?'fa-circle-check':'fa-circle-xmark'}`,
      'aria-hidden':'true'}),item.wasCorrectFinal?' Correct':' Review needed'),
    h('div',{class:'feedback-body'},
      `${result.outputCorrect}/${item.expectedLines.length} output lines and `+
      `${result.variableCorrect}/${result.total-item.expectedLines.length} variable values correct.`),
    h('div',{class:'feedback-stats'},
      h('div',{class:'stat'},h('div',{class:'sv'},`${result.correct}/${result.total}`),
        h('div',{class:'sl'},'checks correct')),
      h('div',{class:'stat'},h('div',{class:'sv'},`${Math.round(item.itemScore*100)}%`),
        h('div',{class:'sl'},'item score'))));
  if(state.mode==='practice')summary.appendChild(h('button',{class:'solution-toggle',type:'button',
    onclick:soToggleSolution},item.showSolution?'Hide correct solution':'Show correct solution'));
  root.appendChild(summary);
  const output=h('section',{class:'so-result-section'},h('h3',{},'Your output'));
  for(let index=0;index<Math.max(item.expectedLines.length,result.lines.length);index++){
    const correct=result.outputResults[index]===true;
    output.appendChild(h('div',{class:`so-result-row ${correct?'so-result-correct':'so-result-incorrect'}`},
      h('span',{class:'so-result-marker','aria-label':correct?'Correct':'Incorrect'},correct?'✓':'×'),
      h('span',{class:'so-result-index'},String(index+1)),
      h('code',{},result.lines[index]||'(empty)')));
  }
  root.appendChild(output);
  if(item.variables.length){
    const values=h('section',{class:'so-result-section'},h('h3',{},'Your final values'));
    item.variables.forEach((variable,index)=>{
      const answers=Array.isArray(variable.expected)?item.response.variables[index]:[item.response.variables[index]];
      const checks=Array.isArray(result.variableResults[index])?result.variableResults[index]
        :[result.variableResults[index]];
      answers.forEach((answer,part)=>{
        const correct=checks[part];
        values.appendChild(h('div',{class:`so-result-row ${correct?'so-result-correct':'so-result-incorrect'}`},
          h('span',{class:'so-result-marker','aria-label':correct?'Correct':'Incorrect'},correct?'✓':'×'),
          h('span',{class:'so-result-index'},Array.isArray(variable.expected)
            ?`${variable.name}[${part}]`:variable.name),
          h('code',{},answer||'(empty)')));
      });
    });
    root.appendChild(values);
  }
  if(item.showSolution&&state.mode==='practice'){
    const solution=h('section',{class:'so-solution','aria-label':'Correct output and variable values'},
      h('h3',{},'Correct output'),
      h('pre',{class:'so-solution-output'},item.expectedLines.join('\n')),
      h('h3',{},'Final variable values'));
    if(item.variables.length){
      item.variables.forEach(variable=>{
        const expected=Array.isArray(variable.expected)?`{${variable.expected.join(', ')}}`:variable.expected;
        solution.appendChild(h('div',{class:'so-solution-variable'},
          h('code',{},variable.name),h('code',{},expected)));
      });
    }else solution.appendChild(h('p',{},'No variables to report.'));
    root.appendChild(solution);
  }
  return root;
}

function soSyncDrawers(item){
  const consoleAllowed=state.mode!=='exam'||state.examSubmitted||activeExamPolicy().showNeutralGuidance;
  if(consoleAllowed){
    if(typeof setConsoleDrawerTitle==='function')setConsoleDrawerTitle('C Program Guide');
    if(typeof setConsoleDrawerContent==='function')setConsoleDrawerContent(soBuildConsoleContent(),{cursor:false});
    if(typeof showConsoleDrawerTab==='function')showConsoleDrawerTab();
  }else{
    if(typeof hideConsoleDrawerTab==='function')hideConsoleDrawerTab();
    if(typeof closeConsoleDrawer==='function')closeConsoleDrawer();
  }
  if(!soFeedbackReleased(item)){
    if(typeof clearFeedbackDrawerContent==='function')clearFeedbackDrawerContent();
    if(typeof setFeedbackDrawerStatus==='function')setFeedbackDrawerStatus(null);
    if(typeof hideFeedbackDrawerTab==='function')hideFeedbackDrawerTab();
    if(typeof closeFeedbackDrawer==='function')closeFeedbackDrawer();
    return;
  }
  const firstShow=!item._feedbackAnimated;item._feedbackAnimated=true;
  if(typeof setFeedbackDrawerTitle==='function')setFeedbackDrawerTitle('Feedback');
  if(typeof setFeedbackDrawerContent==='function')setFeedbackDrawerContent(soBuildFeedback(item));
  if(typeof showFeedbackDrawerTab==='function')showFeedbackDrawerTab();
  if(typeof setFeedbackDrawerStatus==='function')setFeedbackDrawerStatus(item.wasCorrectFinal);
  if(firstShow&&typeof openFeedbackDrawer==='function')openFeedbackDrawer();
}
