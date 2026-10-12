const bcExerciseBanks=new Map();

function bcSlug(value,label){
  const slug=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error(`${label} must be a lowercase path slug`);
  return slug;
}

function bcGenerator(profile){return profile&&profile.activity&&profile.activity.generator||{};}
function bcManifestUrl(profile,language){
  const generator=bcGenerator(profile);
  return resolveExerciseManifestUrl({library:bcSlug(generator.library,`${profile.id}: library`),language,
    exerciseSet:bcSlug(generator.exerciseSet,`${profile.id}: exerciseSet`)});
}
function bcCatalog(profile,language){
  const url=bcManifestUrl(profile,language),bank=bcExerciseBanks.get(url);
  if(!bank)throw new Error(`${profile.id}: exercise manifest '${url}' has not been loaded`);
  return bank.exercises;
}

function bcValidateProfile(profile){
  const generator=bcGenerator(profile),bugs=profile.content&&profile.content.bugs||{};
  bcSlug(generator.library,`${profile.id}: library`);bcSlug(generator.exerciseSet,`${profile.id}: exerciseSet`);
  if(profile.itemCount!=='manifest')throw new Error(`${profile.id}: itemCount must be 'manifest'`);
  if(profile.pointsPerItem!=='generated-answer')throw new Error(`${profile.id}: pointsPerItem must be 'generated-answer'`);
  if(!['authored','seeded'].includes(bugs.mode))throw new Error(`${profile.id}: content.bugs.mode must be 'authored' or 'seeded'`);
  if(bugs.mode==='seeded'&&bugs.count!=='all'&&(!Number.isInteger(bugs.count)||bugs.count<1))
    throw new Error(`${profile.id}: content.bugs.count must be 'all' or a positive integer`);
}

function bcMetadataBugs(metadata,filename){
  const bugs=[],ids=new Set();
  String(metadata||'').split('\n').forEach((raw,index)=>{
    const line=raw.replace(/^\s*\*?\s*/,'').trim();if(!line.startsWith('@bug'))return;
    const fields={};let match;
    const pattern=/(\w+)=("(?:\\.|[^"\\])*"|[^\s]+)/g;
    while((match=pattern.exec(line.slice(4)))){
      let value=match[2];
      if(value.startsWith('"')){try{value=JSON.parse(value);}catch(_error){
        throw new Error(`${filename}: metadata line ${index+1}: invalid quoted @bug value`);}}
      fields[match[1]]=value;
    }
    const id=String(fields.id||''),sourceLine=Number(fields.line),token=Number(fields.token);
    if(!id||!Number.isInteger(sourceLine)||sourceLine<1||!Number.isInteger(token)||token<1
      ||fields.correct===undefined||fields.wrong===undefined)
      throw new Error(`${filename}: metadata line ${index+1}: expected @bug id=<id> line=<n> token=<n> correct=<token> wrong=<token> [choices=<a|b>]`);
    if(ids.has(id))throw new Error(`${filename}: duplicate @bug id '${id}'`);ids.add(id);
    const choices=fields.choices===undefined?[]:String(fields.choices).split('|').filter(value=>value.length);
    bugs.push({id,line:sourceLine,token,correct:String(fields.correct),wrong:String(fields.wrong),choices});
  });
  if(!bugs.length)throw new Error(`${filename}: at least one @bug directive is required`);
  return bugs;
}

function bcTokenize(source){
  const tokens=[];let index=0,line=1,position=0,selectableId=0;
  const operators=['>>=','<<=','...','==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','%=','->','::','<<','>>'];
  while(index<source.length){
    const start=index,startLine=line;
    if(/\s/.test(source[index])){
      let segmentStart=index;
      while(index<source.length&&/\s/.test(source[index])){
        if(source[index]==='\n'){
          if(index>segmentStart)tokens.push({text:source.slice(segmentStart,index),line,selectable:false});
          index++;line++;position=0;segmentStart=index;
        }else index++;
      }
      if(index>segmentStart)tokens.push({text:source.slice(segmentStart,index),line,selectable:false});
      continue;
    }
    if(source.startsWith('//',index)){
      index+=2;while(index<source.length&&source[index]!=='\n')index++;
      tokens.push({text:source.slice(start,index),line:startLine,selectable:false});continue;
    }
    if(source.startsWith('/*',index)){
      index+=2;while(index<source.length&&!source.startsWith('*/',index)){if(source[index++]==='\n'){line++;position=0;}}
      index=Math.min(source.length,index+2);tokens.push({text:source.slice(start,index),line:startLine,selectable:false});continue;
    }
    const quote=source[index];
    if(quote==='"'||quote==="'"){
      index++;let escaped=false;while(index<source.length){const character=source[index++];
        if(escaped){escaped=false;continue;}if(character==='\\'){escaped=true;continue;}if(character===quote)break;}
    }else if(/[A-Za-z_$]/.test(source[index])){
      index++;while(index<source.length&&/[A-Za-z0-9_$]/.test(source[index]))index++;
    }else if(/\d/.test(source[index])||source[index]==='.'&&/\d/.test(source[index+1]||'')){
      index++;while(index<source.length&&/[A-Za-z0-9_.]/.test(source[index]))index++;
    }else{
      const operator=operators.find(candidate=>source.startsWith(candidate,index));index+=operator?operator.length:1;
    }
    position++;tokens.push({id:`token-${selectableId++}`,text:source.slice(start,index),line:startLine,
      token:position,selectable:true});
  }
  return tokens;
}

function bcShuffle(values){
  const result=values.slice();for(let index=result.length-1;index>0;index--){
    const swap=Math.floor(seededRandom()*(index+1));[result[index],result[swap]]=[result[swap],result[index]];
  }return result;
}

function bcParseExercise(exercise,profile,language){
  const details=sourceProgramMetadataAndSource(exercise.raw,exercise.filename);
  const definitions=bcMetadataBugs(details.metadata,exercise.filename),tokens=bcTokenize(details.source);
  definitions.forEach(definition=>{
    const target=tokens.find(token=>token.selectable&&token.line===definition.line&&token.token===definition.token);
    if(!target)throw new Error(`${exercise.filename}: @bug '${definition.id}' targets missing line ${definition.line}, token ${definition.token}`);
    if(target.text!==definition.correct)throw new Error(`${exercise.filename}: @bug '${definition.id}' expected '${definition.correct}' at line ${definition.line}, token ${definition.token}, found '${target.text}'`);
    definition.tokenId=target.id;
  });
  const policy=profile.content.bugs,limit=policy.count==='all'?definitions.length:Math.min(policy.count,definitions.length);
  const selected=policy.mode==='authored'?definitions.slice():bcShuffle(definitions).slice(0,limit);
  const plan=selected.map(definition=>{
    const replacements=policy.mode==='seeded'&&definition.choices.length?definition.choices:[definition.wrong];
    return Object.assign({},definition,{replacement:replacements[Math.floor(seededRandom()*replacements.length)]});
  });
  if(!plan.length)throw new Error(`${exercise.filename}: bug policy selected no faults`);
  const mutationByToken=Object.fromEntries(plan.map(row=>[row.tokenId,row]));
  return {title:details.title,source:details.source,tokens,plan,mutationByToken,language};
}

async function bcFetchBank(profile,language){
  const url=bcManifestUrl(profile,language),response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);
  const manifest=sourceProgramValidateManifest(await response.json(),url,'Bug Catcher');
  const directory=url.slice(0,url.lastIndexOf('/')+1);
  const exercises=await Promise.all(manifest.exercises.map(async filename=>{
    const exerciseResponse=await fetch(directory+encodeURIComponent(filename),{cache:'no-store'});
    if(!exerciseResponse.ok)throw new Error(`${filename}: HTTP ${exerciseResponse.status}`);
    return {id:filename.replace(/\.[^.]+$/,''),filename,raw:await exerciseResponse.text()};
  }));
  exercises.forEach(exercise=>bcParseExercise(exercise,profile,language));
  bcExerciseBanks.set(url,Object.freeze({title:manifest.title,exercises:Object.freeze(exercises)}));
}

async function bcLoadContent(){
  const profiles=PROFILES.filter(profile=>profileIsEnabled(profile)&&profile.activity&&profile.activity.kind===BUG_CATCHER_MANIFEST.id);
  const unique=new Map(profiles.map(profile=>[bcManifestUrl(profile,state.language),profile]));
  await Promise.all([...unique.values()].map(profile=>bcFetchBank(profile,state.language)));
}

function bcGenerateItem({profile,index,language,generationContext}){
  if(!generationContext.order){const catalog=bcCatalog(profile,language).slice();
    generationContext.order=bcGenerator(profile).shuffle===true?bcShuffle(catalog):catalog;}
  const exercise=generationContext.order[index];if(!exercise)throw new Error(`${profile.id}: no exercise at item ${index+1}`);
  const parsed=bcParseExercise(exercise,profile,language);
  return {activityKind:BUG_CATCHER_MANIFEST.id,profileId:profile.id,itemNumber:index+1,language,
    exerciseId:exercise.id,filename:exercise.filename,title:parsed.title,source:parsed.source,tokens:parsed.tokens,
    mutationPlan:parsed.plan,mutationByToken:parsed.mutationByToken,response:{selected:[]},result:null,
    checked:false,itemScore:null,points:null,maxPoints:parsed.plan.length,correctSteps:0,totalOpSteps:parsed.plan.length,
    wasCorrectFinal:null,showSolution:false,flagged:false,lockedAt:null,examActionLog:[]};
}

function bcApplyAction({item,action}){
  if(!item||item.checked||!action||action.type!=='TOGGLE_TOKEN'||!item.tokens.some(token=>token.id===action.tokenId&&token.selectable))return {applied:false};
  const selected=item.response.selected,index=selected.indexOf(action.tokenId);
  if(index>=0)selected.splice(index,1);else{
    if(selected.length>=item.mutationPlan.length)return {applied:false,reason:'selection-limit'};
    selected.push(action.tokenId);
  }return {applied:true};
}
function bcScore(item){
  const expected=new Set(item.mutationPlan.map(row=>row.tokenId)),selected=new Set(item.response.selected);
  const correct=[...selected].filter(id=>expected.has(id)),incorrect=[...selected].filter(id=>!expected.has(id)),
    missed=[...expected].filter(id=>!selected.has(id));
  return {correct,incorrect,missed,total:expected.size};
}
function bcCheck({item,state}){
  if(!item||item.checked)return {applied:false};const result=bcScore(item);item.result=result;item.checked=true;
  item.points=result.correct.length;item.maxPoints=result.total;item.itemScore=result.total?item.points/result.total:1;
  item.correctSteps=item.points;item.totalOpSteps=result.total;item.wasCorrectFinal=!result.incorrect.length&&!result.missed.length;
  item.lockedAt=state.mode==='exam'?Date.now():null;return {applied:true,completed:true};
}
function bcClear(item){item.response={selected:[]};item.result=null;item.showSolution=false;item._feedbackAnimated=false;}
function bcReset({item}){if(!item||item.checked)return {applied:false};const changed=item.response.selected.length>0;bcClear(item);return {applied:changed};}
function bcRetry({item}){if(!item||!item.checked)return {applied:false};bcClear(item);item.checked=false;item.itemScore=null;
  item.points=null;item.correctSteps=0;item.wasCorrectFinal=null;item.lockedAt=null;return {applied:true,resetAttempt:true};}

function bcDisplayedText(item,token){const mutation=item.mutationByToken[token.id];return mutation?mutation.replacement:token.text;}
function bcTokenClass(text,language){
  if(/^['"]/.test(text))return 'string';if(/^\d/.test(text))return 'number';
  if(/^(int|char|float|double|void|const|return|if|else|for|while|public|private|protected|class|static|final|boolean|String|new|import|package)$/.test(text))return 'keyword';
  if(/^[A-Za-z_$]/.test(text)&&/^(printf|scanf|main|System|out|print|println|nextInt|nextDouble)$/.test(text))return 'function';return 'plain';
}
function bcToggle(item,tokenId){const result=applyActivityAction(item,{type:'TOGGLE_TOKEN',tokenId});if(result.applied){saveSessionProgress();render();}}

function bcSourcePanel(item){
  const lines=new Map();item.tokens.forEach(token=>{if(!lines.has(token.line))lines.set(token.line,[]);lines.get(token.line).push(token);});
  const sourceLineCount=item.source.split('\n').length-(item.source.endsWith('\n')?1:0);
  const expected=new Set(item.mutationPlan.map(row=>row.tokenId)),selected=new Set(item.response.selected),released=item.checked&&bcFeedbackReleased(item);
  return h('section',{class:'bc-source-panel so-answer-panel','aria-label':'Faulty source code'},
    h('div',{class:'bc-panel-heading so-panel-heading'},h('i',{class:'fa-solid fa-bug','aria-hidden':'true'}),h('span',{},item.filename),
      h('span',{class:'bc-language so-language'},item.language==='java'?'Java':'C')),
    h('div',{class:'bc-source-code'},...Array.from({length:sourceLineCount},(_,index)=>{
      const line=index+1,lineTokens=lines.get(line)||[];
      return h('div',{class:'bc-source-line'},
      h('span',{class:'bc-line-number','aria-hidden':'true'},String(line)),
      h('code',{class:'bc-line-code'},...lineTokens.map(token=>{
        if(!token.selectable)return token.text;
        const isSelected=selected.has(token.id),isExpected=expected.has(token.id),limit=selected.size>=item.mutationPlan.length,
          selectionLocked=limit&&!isSelected&&!item.checked&&!state.examExpired;
        const classes=['bc-token','tc-token','tc-selectable',`bc-syntax-${bcTokenClass(bcDisplayedText(item,token),item.language)}`];
        if(isSelected&&!released)classes.push('tc-answered','selected');
        if(selectionLocked)classes.push('selection-locked');
        if(released&&isSelected)classes.push('tc-answered',isExpected?'tc-answer-correct':'tc-answer-wrong');
        if(released&&item.showSolution&&isExpected&&!isSelected)classes.push('tc-answered','tc-answer-correct');
        return h('button',{class:classes.join(' '),type:'button',disabled:item.checked||state.examExpired||selectionLocked,
          'aria-pressed':String(isSelected),onclick:()=>bcToggle(item,token.id)},bcDisplayedText(item,token));
      })));
    })));
}

function bcSelectionPanel(item){
  const selected=item.response.selected.map(id=>item.tokens.find(token=>token.id===id)).filter(Boolean),
    total=item.mutationPlan.length,complete=selected.length===total;
  return h('aside',{class:'bc-selection-panel so-answer-panel','aria-label':'Current bug selections'},
    h('div',{class:'bc-selection-heading so-panel-heading'},
      h('i',{class:'fa-solid fa-crosshairs','aria-hidden':'true'}),
      h('span',{},'Current selection')),
    h('div',{class:'bc-selection-body'},
      h('div',{class:'bc-selection-total','aria-live':'polite'},
        h('strong',{},String(selected.length)),
        h('span',{class:'bc-selection-divider'},'/'),
        h('strong',{},String(total))),
      h('div',{class:'bc-selection-label'},'selected',h('span',{},'bugs to find')),
      h('div',{class:'bc-selection-progress','aria-hidden':'true'},
        h('span',{style:`width:${total?selected.length/total*100:0}%`})),
      selected.length
        ?h('div',{class:'bc-selected-list'},...selected.map(token=>h('div',{class:'bc-selected-row'},
          h('span',{class:'bc-selected-line'},`Line ${token.line}`),
          h('code',{},bcDisplayedText(item,token)))))
        :h('div',{class:'bc-selection-empty'},
          h('i',{class:'fa-solid fa-arrow-pointer','aria-hidden':'true'}),
          h('span',{},'Select a token in the source code.')),
      h('p',{class:'bc-selection-hint'},complete
        ?'Selection limit reached. Deselect a token to change your answer.'
        :`Select ${total-selected.length} more token${total-selected.length===1?'':'s'}.`)));
}

function bcFeedbackReleased(item){if(!item.checked)return false;if(state.mode==='practice')return true;
  return !!(state.examExpired&&activeExamPolicy().feedbackRelease==='after-timeout');}
function bcToggleSolution(){const item=currentItem();if(!item||item.activityKind!==BUG_CATCHER_MANIFEST.id||!correctSolutionAvailable(currentProfile(),item))return;
  item.showSolution=!item.showSolution;render();}
function bcBuildFeedback(item,profile){
  const result=item.result,root=h('div',{class:'bc-feedback'}),summary=h('div',{class:`feedback ${item.wasCorrectFinal?'correct':'incorrect'}`},
    h('div',{class:'feedback-head'},h('i',{class:`fa-solid ${item.wasCorrectFinal?'fa-circle-check':'fa-circle-xmark'}`,'aria-hidden':'true'}),
      item.wasCorrectFinal?' All bugs found':' Review needed'),
    h('div',{class:'feedback-body'},`${result.correct.length} of ${result.total} faults identified. ${result.incorrect.length} correct token${result.incorrect.length===1?' was':'s were'} selected by mistake.`),
    h('div',{class:'feedback-stats'},h('div',{class:'stat'},h('div',{class:'sv'},`${item.points}/${item.maxPoints}`),h('div',{class:'sl'},'bugs found')),
      h('div',{class:'stat'},h('div',{class:'sv'},`${Math.round(item.itemScore*100)}%`),h('div',{class:'sl'},'item score'))));
  if(correctSolutionAvailable(profile,item))summary.appendChild(h('button',{class:'solution-toggle',type:'button',onclick:bcToggleSolution},item.showSolution?'Hide correct solution':'Show correct solution'));
  root.appendChild(summary);
  if(result.incorrect.length)root.appendChild(h('section',{class:'bc-review'},h('h3',{},'Selections to review'),...result.incorrect.map(id=>{
    const token=item.tokens.find(row=>row.id===id);return h('p',{},`Line ${token.line}: `,h('code',{},bcDisplayedText(item,token)),' is valid here.');})));
  if(item.showSolution&&correctSolutionAvailable(profile,item))root.appendChild(h('section',{class:'bc-review bc-solution'},h('h3',{},'Fault corrections'),
    ...item.mutationPlan.map(bug=>h('div',{class:'bc-correction'},h('span',{},`Line ${bug.line}`),h('code',{},bug.replacement),h('i',{class:'fa-solid fa-arrow-right','aria-hidden':'true'}),h('code',{},bug.correct)))));
  return root;
}
function bcSyncDrawers(item,profile){
  if(typeof setConsoleDrawerTitle==='function')setConsoleDrawerTitle('Bug Catcher Guide');
  if(typeof setConsoleDrawerContent==='function')setConsoleDrawerContent(h('div',{class:'bc-guide'},h('h3',{},'Find the corrupted tokens'),
    h('p',{},`Select up to ${item.mutationPlan.length} tokens that make this program invalid or incorrect.`),
    h('p',{},'The stored exercise is valid source code. Faults shown here were generated from its embedded bug definitions.')),{cursor:false});
  if(typeof showConsoleDrawerTab==='function')showConsoleDrawerTab();
  if(!bcFeedbackReleased(item)){if(typeof clearFeedbackDrawerContent==='function')clearFeedbackDrawerContent();if(typeof hideFeedbackDrawerTab==='function')hideFeedbackDrawerTab();return;}
  const first=!item._feedbackAnimated;item._feedbackAnimated=true;if(typeof setFeedbackDrawerTitle==='function')setFeedbackDrawerTitle('Feedback');
  if(typeof setFeedbackDrawerContent==='function')setFeedbackDrawerContent(bcBuildFeedback(item,profile));if(typeof showFeedbackDrawerTab==='function')showFeedbackDrawerTab();
  if(typeof setFeedbackDrawerStatus==='function')setFeedbackDrawerStatus(item.wasCorrectFinal);if(first&&typeof openFeedbackDrawer==='function')openFeedbackDrawer();
}
function bcRender({container,item,profile}){
  const expected=new Set(item.mutationPlan.map(row=>row.tokenId)),steps=item.mutationPlan.map(row=>({status:item.checked&&bcFeedbackReleased(item)
    ?item.response.selected.includes(row.tokenId)?'complete':'invalid':item.response.selected.includes(row.tokenId)?'complete':'waiting'}));
  const first=steps.findIndex(step=>step.status==='waiting'),flow=renderProgramWorkspaceShell(container,item,{statements:steps,cursor:first<0?steps.length-1:first,
    status:item.checked?'complete':'running',progressMode:'completion'});flow.parentNode.classList.add('bug-catcher-workspace');
  flow.appendChild(h('div',{class:'bc-instruction'},h('i',{class:'fa-solid fa-circle-info','aria-hidden':'true'}),h('span',{},profile.activity.instructions)));
  flow.appendChild(h('div',{class:'bc-workspace-layout'},bcSourcePanel(item),bcSelectionPanel(item)));
  if(!item.checked&&!state.examExpired){const controls=h('div',{class:'bc-controls'});if(state.mode==='practice')controls.appendChild(h('button',{class:'item-reset-button',
    type:'button',disabled:!item.response.selected.length,onclick:handleReset},'Reset item'));
    const actions=renderInlineEvaluationActions({canCheck:item.response.selected.length>0});if(actions)controls.appendChild(actions);flow.appendChild(controls);
  }else if(state.mode==='practice')appendPracticeRetryBar(container);
  bcSyncDrawers(item,profile);
}

registerActivityPlugin({id:BUG_CATCHER_MANIFEST.id,manifest:BUG_CATCHER_MANIFEST,loadContent:bcLoadContent,
  itemCount({profile,language}){return bcCatalog(profile,language).length;},maxPoints({item}){return item.mutationPlan.length;},
  validateProfile:bcValidateProfile,generateItem:bcGenerateItem,render:bcRender,applyAction:bcApplyAction,check:bcCheck,
  reset:bcReset,retry:bcRetry,buildFeedback:bcBuildFeedback,hasAttempt({item}){return !!(item&&item.response.selected.length);}});
