function ftsTokenReason(token,language){
  const rules=tcLanguage(language);
  if(token.category==='reserved-word')return `“${token.text}” is reserved by ${rules.label}.`;
  if(token.category==='valid-identifier')return `“${token.text}” follows ${rules.label} identifier rules.`;
  if(token.category==='operator')return `“${token.text}” is an operator.`;
  if(token.category==='literal')return `“${token.text}” is a literal value.`;
  if(token.category==='separator')return `“${token.text}” is a separator.`;
  if(/^\d/.test(token.text))return 'An identifier cannot begin with a digit.';
  if(/\s/.test(token.text))return 'An identifier cannot contain spaces.';
  return `“${token.text}” does not follow ${rules.label} identifier rules.`;
}

function ftsCategoryGuide(category,language){
  const label=TC_CATEGORY_DEFS[category].label,rules=tcLanguage(language);
  const descriptions={
    'valid-identifier':`follows ${rules.label} naming rules`,
    'invalid-identifier':`breaks one or more ${rules.label} naming rules`,
    'reserved-word':`is reserved by ${rules.label} for language syntax`,
    operator:'performs or represents an operation',literal:'writes a value directly',separator:'separates or terminates syntax'
  };
  return `${label}: ${descriptions[category]}.`;
}

function ftsBuildConsoleContent(item,profile){
  const rules=tcLanguage(item.language),root=h('div',{class:'fts-console-guide'});
  root.appendChild(h('h3',{},`TOKEN GUIDE — ${rules.label.toUpperCase()}`));
  root.appendChild(h('p',{},'Classify the current token by selecting one of the available buckets.'));
  root.appendChild(h('ul',{},...profile.activity.buckets.slice().sort((a,b)=>a.order-b.order)
    .map(bucket=>h('li',{},ftsCategoryGuide(bucket.category,item.language)))));
  return root;
}

function ftsRenderSolution(item,profile){
  const root=h('div',{class:'fts-solution','aria-label':'Correct token sorting solution'});
  root.appendChild(h('div',{class:'fts-solution-summary'},`${item.tokens.length} tokens grouped by their correct category`));
  profile.activity.buckets.slice().sort((a,b)=>a.order-b.order).forEach(bucket=>{
    const definition=TC_CATEGORY_DEFS[bucket.category];
    const tokens=item.tokens.filter(token=>token.category===bucket.category);
    const group=h('section',{class:`fts-solution-group fts-tone-${definition.tone}`});
    group.appendChild(h('div',{class:'fts-solution-head'},
      h('span',{},h('i',{class:`fa-solid ${definition.icon}`,'aria-hidden':'true'}),` ${definition.label}`),
      h('span',{class:'fts-solution-count'},String(tokens.length))));
    const rows=h('div',{class:'fts-solution-rows'});
    tokens.forEach(token=>rows.appendChild(h('div',{class:'fts-solution-row'},
      h('code',{},token.text),h('span',{},ftsTokenReason(token,item.language)))));
    group.appendChild(rows);root.appendChild(group);
  });
  return root;
}

function ftsToggleSolution(){
  const item=currentItem();
  if(!item||item.activityKind!==FALLING_TOKEN_SORT_MANIFEST.id||state.mode==='exam')return;
  item.showSolution=!item.showSolution;render();
}

function ftsBuildFeedback(item,profile){
  const correct=item.wasCorrectFinal,root=h('div',{class:'fts-feedback-stack'});
  const attemptLabel=profile.activity.assessment.scoreAttempt==='latest'?'latest attempt':'first attempt';
  const card=h('div',{class:`feedback ${correct?'correct':'incorrect'}${item._feedbackAnimated?'':' feedback-enter'}`});
  card.appendChild(h('div',{class:'feedback-head'},
    h('i',{class:`fa-solid ${correct?'fa-circle-check':'fa-circle-xmark'}`,'aria-hidden':'true'}),correct?' Correct':' Review needed'));
  card.appendChild(h('div',{class:'feedback-body'},correct?`Every token was sorted correctly on the ${attemptLabel}.`:
    `${item.correctSteps} of ${item.totalOpSteps} tokens were sorted correctly on the ${attemptLabel}.`));
  card.appendChild(h('div',{class:'feedback-stats'},
    h('div',{class:'stat'},h('div',{class:'sv'},`${item.correctSteps}/${item.totalOpSteps}`),h('div',{class:'sl'},'correct sorts')),
    h('div',{class:'stat'},h('div',{class:'sv'},`${Math.round(item.itemScore*100)}%`),h('div',{class:'sl'},'item score'))));
  if(state.mode==='practice')card.appendChild(h('button',{class:'solution-toggle',type:'button',onclick:ftsToggleSolution},
    item.showSolution?'Hide correct solution':'Show correct solution'));
  root.appendChild(card);if(item.showSolution&&state.mode==='practice')root.appendChild(ftsRenderSolution(item,profile));
  return root;
}

function ftsFeedbackReleased(item,profile){
  if(state.mode==='practice')return item.checked;
  if(profile.activity.feedback.exam==='never')return false;
  return item.checked&&state.examSubmitted&&activeExamPolicy().feedbackRelease==='after-submit';
}

function ftsSyncDrawers(item,profile){
  const consoleAllowed=state.mode!=='exam'||state.examSubmitted||activeExamPolicy().showNeutralGuidance;
  if(consoleAllowed){
    if(typeof setConsoleDrawerTitle==='function')setConsoleDrawerTitle(`${tcLanguage(item.language).label} Token Guide`);
    if(typeof setConsoleDrawerContent==='function')setConsoleDrawerContent(ftsBuildConsoleContent(item,profile),{cursor:false});
    if(typeof showConsoleDrawerTab==='function')showConsoleDrawerTab();
  }else{
    if(typeof hideConsoleDrawerTab==='function')hideConsoleDrawerTab();
    if(typeof closeConsoleDrawer==='function')closeConsoleDrawer();
  }
  if(!ftsFeedbackReleased(item,profile)){
    if(typeof clearFeedbackDrawerContent==='function')clearFeedbackDrawerContent();
    if(typeof setFeedbackDrawerStatus==='function')setFeedbackDrawerStatus(null);
    if(typeof hideFeedbackDrawerTab==='function')hideFeedbackDrawerTab();
    if(typeof closeFeedbackDrawer==='function')closeFeedbackDrawer();
    return;
  }
  const firstShow=!item._feedbackAnimated,content=ftsBuildFeedback(item,profile);item._feedbackAnimated=true;
  if(typeof setFeedbackDrawerTitle==='function')setFeedbackDrawerTitle('Feedback');
  if(typeof setFeedbackDrawerContent==='function')setFeedbackDrawerContent(content);
  if(typeof showFeedbackDrawerTab==='function')showFeedbackDrawerTab();
  if(typeof setFeedbackDrawerStatus==='function')setFeedbackDrawerStatus(item.wasCorrectFinal);
  if(firstShow&&typeof openFeedbackDrawer==='function')openFeedbackDrawer();
}
