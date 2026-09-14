function tcBuildConsoleContent(item,profile){
  const rules=tcLanguage(item.language),box=h('div',{class:'tc-console-guide'});
  box.appendChild(h('h3',{},`TOKEN RULES — ${rules.label.toUpperCase()}`));
  box.appendChild(h('p',{},'Classify using the categories provided by this profile.'));
  box.appendChild(h('ul',{},h('li',{},'Names must follow the active language’s identifier rules.'),
    h('li',{},'Reserved words belong to language syntax.'),h('li',{},'Operators perform actions; literals write values directly.')));
  if(item.invalidSelection){const token=tcTokenById(item,item.invalidSelection.tokenId);box.appendChild(h('div',{class:'tc-console-warning'},`INVALID SELECTION: “${token?token.text:'token'}” is not a required target.`));}
  return box;
}
function tcRenderSolution(item){
  const playback=h('div',{class:'solution-playback tc-solution-playback'});
  playback.appendChild(h('div',{class:'playback-controls'},h('span',{class:'playback-progress'},`${item.targetIds.length} correct classifications`)));
  const targetIds=new Set(item.targetIds),groups=h('div',{class:'tc-solution-groups'});
  item.statements.forEach((statement,statementIndex)=>{
    const tokens=statement.tokens.filter(token=>targetIds.has(token.id));
    if(!tokens.length)return;
    const source=typeof tcStatementSource==='function'
      ?tcStatementSource(statement)
      :statement.tokens.map(token=>token.text).join(' ');
    const group=h('section',{class:'tc-solution-statement','aria-labelledby':`tc-solution-heading-${statement.id}`});
    group.appendChild(h('div',{class:'tc-solution-statement-head'},
      h('span',{class:'tc-solution-line-number','aria-hidden':'true'},String(statementIndex+1)),
      h('div',{class:'tc-solution-statement-title'},
        h('span',{id:`tc-solution-heading-${statement.id}`,class:'tc-solution-statement-label'},`Statement ${statementIndex+1}`),
        h('code',{class:'tc-solution-source'},source))));
    const rows=h('div',{class:'tc-solution-rows'});
    tokens.forEach(token=>{
      const response=tcResponseFor(item,token.id),category=response?response.expectedCategory:token.contextualCategory,
        def=TC_CATEGORY_DEFS[category];
      rows.appendChild(h('div',{class:'tc-solution-row'},
        h('span',{class:'tc-solution-status','aria-label':'Correct classification'},h('i',{class:'fa-solid fa-circle-check','aria-hidden':'true'})),
        h('div',{class:'tc-solution-content'},
          h('div',{class:'tc-solution-answer'},h('code',{class:'tc-solution-token'},token.text),h('span',{class:'tc-solution-arrow','aria-hidden':'true'},'→'),h('strong',{},def.label)),
          h('div',{class:'tc-solution-reason'},tcReason(token,category,item.language)))));
    });
    group.appendChild(rows);groups.appendChild(group);
  });
  playback.appendChild(groups);return playback;
}
function tcBuildFeedback(item){
  const correct=item.wasCorrectFinal;
  const root=h('div',{class:'tc-feedback-stack'});
  const fb=h('div',{class:`feedback ${correct?'correct':'incorrect'}${item._feedbackAnimated?'':' feedback-enter'}`});
  fb.appendChild(h('div',{class:'feedback-head'},h('i',{class:`fa-solid ${correct?'fa-circle-check':'fa-circle-xmark'}`}),correct?' Correct':' Review needed'));
  const terminal=item.invalidSelection&&item.invalidSelection.terminal;
  fb.appendChild(h('div',{class:'feedback-body'},terminal
    ?h('span',{},'The item ended after a token outside the assessed target set was selected. Credit from earlier valid actions was retained.')
    :(correct?h('span',{},'Every required check was correct.'):
      h('span',{},`${item.correctSteps} of ${item.totalOpSteps} checks were correct.`))));
  const bonus=item.checkResults.filter(result=>result.bonus),bonusCorrect=bonus.filter(result=>result.wasCorrect).length;
  fb.appendChild(h('div',{class:'feedback-stats'},
    h('div',{class:'stat'},h('div',{class:'sv'},`${item.correctSteps}/${item.totalOpSteps}`),h('div',{class:'sl'},'correct checks')),
    bonus.length?h('div',{class:'stat'},h('div',{class:'sv'},`${bonusCorrect}/${bonus.length}`),h('div',{class:'sl'},'bonus checks')):null,
    h('div',{class:'stat'},h('div',{class:'sv'},`${Math.round(item.itemScore*100)}%`),h('div',{class:'sl'},'item score'))));
  if(state.mode==='practice'&&!terminal){
    fb.appendChild(h('button',{class:'solution-toggle',onclick:tcToggleSolution},item.showSolution?'Hide correct solution':'Show correct solution'));
    root.appendChild(fb);
    if(item.showSolution)root.appendChild(tcRenderSolution(item));
    return root;
  }
  root.appendChild(fb);return root;
}
function tcSyncDrawers(item,profile){
  if(typeof setConsoleDrawerTitle==='function'){
    setConsoleDrawerTitle(`${tcLanguage(item.language).label} Token Guide`);setConsoleDrawerContent(tcBuildConsoleContent(item,profile),{cursor:false});showConsoleDrawerTab();
  }
  const deferred=state.mode==='exam'&&!state.examSubmitted;
  if(!item.checked||deferred){
    if(typeof clearFeedbackDrawerContent==='function')clearFeedbackDrawerContent();
    if(typeof setFeedbackDrawerStatus==='function')setFeedbackDrawerStatus(null);
    if(typeof hideFeedbackDrawerTab==='function')hideFeedbackDrawerTab();
    if(typeof closeFeedbackDrawer==='function')closeFeedbackDrawer();
    return;
  }
  const firstShow=!item._feedbackAnimated,fb=tcBuildFeedback(item);item._feedbackAnimated=true;
  let placed=false;
  if(typeof setFeedbackDrawerContent==='function')try{setFeedbackDrawerTitle('Feedback');setFeedbackDrawerContent(fb);placed=true;}catch(e){placed=false;}
  if(!placed)return;
  if(typeof renderItemCelebration==='function')try{const celebration=renderItemCelebration(item,fb);if(celebration)fb.appendChild(celebration);}catch(e){}
  if(typeof showFeedbackDrawerTab==='function')showFeedbackDrawerTab();
  if(typeof setFeedbackDrawerStatus==='function')setFeedbackDrawerStatus(item.wasCorrectFinal);
  if(firstShow&&typeof openFeedbackDrawer==='function')openFeedbackDrawer();
}
