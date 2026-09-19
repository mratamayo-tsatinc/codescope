function ftsTokenReason(token,language){
  const operatorReasons={
    'arithmetic-operator':'performs an arithmetic calculation',
    'relational-operator':'compares two values',
    'boolean-operator':'combines or negates boolean conditions',
    'assignment-operator':'assigns or updates a stored value',
    'operator-distractor':'is not an operator token'
  };
  if(operatorReasons[token.category])return `“${token.text}” ${operatorReasons[token.category]}.`;
  return tcReason(token,token.lexicalCategory||token.category,language);
}

function ftsCategoryGuide(category,language){
  const label=TC_CATEGORY_DEFS[category].label,rules=tcLanguage(language);
  const descriptions={
    'valid-identifier':`follows ${rules.label} naming rules`,
    'invalid-identifier':`breaks one or more ${rules.label} naming rules`,
    'reserved-word':`is reserved by ${rules.label} for language syntax`,
    operator:'performs or represents an operation',
    'arithmetic-operator':'performs arithmetic with numeric operands',
    'relational-operator':'compares values and produces a boolean result',
    'boolean-operator':'combines or negates boolean expressions',
    'assignment-operator':'stores or updates a value',
    'operator-distractor':'is not an operator in this activity',
    literal:'writes a value directly',separator:'separates or terminates syntax'
  };
  return `${label}: ${descriptions[category]}.`;
}

function ftsIdentifierLesson(language){
  const rules=tcLanguage(language),java=rules.id==='java';
  return {
    rules:[
      java?'Begin with a letter, underscore (_), or dollar sign ($).':'Begin with a letter or underscore (_).',
      java?'Continue with letters, digits, underscores, or dollar signs.':'Continue with letters, digits, or underscores.',
      'Do not use spaces, hyphens, punctuation, or other unsupported symbols.',
      'Names are case-sensitive and cannot be an exact reserved word.'
    ],
    styles:[
      {label:'camelCase',example:'studentScore'},
      {label:'snake_case',example:'student_score'},
      {label:'UPPER_SNAKE_CASE',example:'MAX_SCORE'},
      {label:'digit suffix',example:'score2'}
    ],
    languageNote:java
      ?'Java permits $ in a name, although ordinary application code usually avoids it.'
      :'C does not permit $ in an identifier in this activity.',
    reservedWords:[...rules.reserved]
  };
}

function ftsBuildConsoleContent(item,profile){
  const rules=tcLanguage(item.language),lesson=ftsIdentifierLesson(item.language),root=h('div',{class:'fts-console-guide'});
  const categories=new Set(profile.activity.buckets.map(bucket=>bucket.category));
  const hasIdentifierBuckets=['valid-identifier','invalid-identifier'].some(category=>categories.has(category));
  root.appendChild(h('h3',{},`${rules.label.toUpperCase()} IDENTIFIER GUIDE`));
  root.appendChild(h('p',{class:'fts-guide-intro'},profile.activity.dropArea.visibleTokens===1
    ?'Drag the token into the matching bucket, or choose a bucket with the keyboard.'
    :'Drag a visible token into the matching bucket. With the keyboard, select a token and then choose a bucket.'));

  if(hasIdentifierBuckets){
    const ruleSection=h('section',{class:'fts-guide-section'});
    ruleSection.appendChild(h('h4',{},'Valid identifier rules'));
    ruleSection.appendChild(h('ul',{class:'fts-guide-rules'},...lesson.rules.map(rule=>h('li',{},rule))));
    ruleSection.appendChild(h('p',{class:'fts-guide-note'},lesson.languageNote));
    root.appendChild(ruleSection);

    const styleSection=h('section',{class:'fts-guide-section'});
    styleSection.appendChild(h('h4',{},'Common readable styles'));
    styleSection.appendChild(h('div',{class:'fts-style-list'},...lesson.styles.map(style=>
      h('div',{class:'fts-style-row'},h('span',{},style.label),h('code',{},style.example)))));
    root.appendChild(styleSection);
  }

  const bucketSection=h('section',{class:'fts-guide-section'});
  bucketSection.appendChild(h('h4',{},'Choose by category'));
  bucketSection.appendChild(h('ul',{class:'fts-guide-categories'},...profile.activity.buckets.slice().sort((a,b)=>a.order-b.order)
    .map(bucket=>h('li',{},ftsCategoryGuide(bucket.category,item.language)))));
  root.appendChild(bucketSection);

  if(categories.has('reserved-word')){
    const reserved=h('details',{class:'fts-reserved-list'});
    reserved.appendChild(h('summary',{},`Actual ${rules.label} reserved words (${lesson.reservedWords.length})`));
    reserved.appendChild(h('p',{class:'fts-reserved-note'},
      'An exact match belongs in Reserved Word. Capitalization changes the token because names are case-sensitive.'));
    reserved.appendChild(h('div',{class:'fts-reserved-grid'},...lesson.reservedWords.map(word=>h('code',{},word))));
    root.appendChild(reserved);
  }
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
  return item.checked&&state.examExpired&&activeExamPolicy().feedbackRelease==='after-timeout';
}

function ftsSyncDrawers(item,profile){
  const consoleAllowed=state.mode!=='exam'||state.examExpired||activeExamPolicy().showNeutralGuidance;
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
