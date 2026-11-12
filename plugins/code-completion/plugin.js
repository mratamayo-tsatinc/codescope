const CODE_COMPLETION_MANIFEST=Object.freeze({id:'code-completion',version:'1.0.0',semanticOwner:'language-core',
  responsibilities:Object.freeze(['interaction','presentation','feedback','scoring']),
  dependencies:Object.freeze(['language-core:program-semantics','shell:source-flow-renderer',
    'code-ordering:program-playback','simulate-output:source-answer-adapter'])});

function ccGenerator(profile){return profile&&profile.activity&&profile.activity.generator||{};}
function ccSourceRefs(profile){
  const generator=ccGenerator(profile);
  if(Array.isArray(generator.sources)&&generator.sources.length)return generator.sources;
  return generator.exerciseSet?[{exerciseSet:generator.exerciseSet,include:generator.include||null}]:[];
}
function ccSourceProfile(profile,reference){
  return {id:profile.id,activity:{generator:{library:ccGenerator(profile).library,
    exerciseSet:reference.exerciseSet,shuffle:false}}};
}
function ccIncluded(reference,exercise){
  if(!Array.isArray(reference.include)||!reference.include.length)return true;
  const names=new Set(reference.include.map(value=>String(value).replace(/\.[^.]+$/,'')));
  return names.has(exercise.id)||names.has(exercise.filename.replace(/\.[^.]+$/,''));
}
function ccCatalog(profile,language){
  return ccSourceRefs(profile).flatMap(reference=>{
    const sourceProfile=ccSourceProfile(profile,reference);
    return soCatalog(sourceProfile,language).filter(exercise=>ccIncluded(reference,exercise))
      .map(exercise=>({exercise,exerciseSet:reference.exerciseSet}));
  });
}
async function ccLoad(){
  const profiles=PROFILES.filter(profile=>profileIsEnabled(profile)&&profile.activity&&profile.activity.kind==='code-completion');
  const requests=new Map();
  profiles.forEach(profile=>ccSourceRefs(profile).forEach(reference=>{
    const sourceProfile=ccSourceProfile(profile,reference);
    requests.set(soManifestUrl(sourceProfile,state.language),sourceProfile);
  }));
  await Promise.all([...requests.values()].map(profile=>soFetchExerciseBank(profile,state.language)));
}
function ccLineStarts(source){
  const starts=[0];for(let index=0;index<source.length;index++)if(source[index]==='\n')starts.push(index+1);return starts;
}
function ccEscapeRegExp(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function ccTrimmedSpan(text,start,end){
  while(start<end&&/\s/.test(text[start]))start++;
  while(end>start&&/\s/.test(text[end-1]))end--;
  return {start,end};
}
function ccSlot(id,role,line,start,end,source,lineStarts){
  const trimmed=ccTrimmedSpan(source,lineStarts[line-1]+start,lineStarts[line-1]+end);
  return {id,role,line,start:trimmed.start,end:trimmed.end,answer:source.slice(trimmed.start,trimmed.end)};
}
function ccLoopParts(parsed){
  const source=parsed.source,lines=source.split('\n'),lineStarts=ccLineStarts(source);
  const statements=parsed.coreProgram&&parsed.coreProgram.statements||[];
  const loop=statements.find(statement=>statement.kind==='loop'&&statement.loopKind!=='do'&&statement.conditionSource);
  if(!loop)throw new Error(`${parsed.filename}: Code Completion requires a loop with a condition`);
  const conditionLine=loop.sourceLine,conditionText=lines[conditionLine-1]||'';
  const open=conditionText.indexOf('('),close=conditionText.lastIndexOf(')');
  if(open<0||close<=open)throw new Error(`${parsed.filename}: loop condition source could not be located`);
  let conditionStart=open+1,conditionEnd=close,initializerSpan=null,updateSpan=null;
  if(loop.loopKind==='for'){
    const inside=conditionText.slice(open+1,close),parts=coreLoopSplitFor(inside);
    if(parts.length!==3)throw new Error(`${parsed.filename}: invalid for-loop header`);
    const firstSemi=inside.indexOf(';'),secondSemi=inside.indexOf(';',firstSemi+1);
    const initBounds=ccTrimmedSpan(inside,0,firstSemi),conditionBounds=ccTrimmedSpan(inside,firstSemi+1,secondSemi);
    const updateBounds=ccTrimmedSpan(inside,secondSemi+1,inside.length);
    conditionStart=open+1+conditionBounds.start;conditionEnd=open+1+conditionBounds.end;
    const initText=inside.slice(initBounds.start,initBounds.end),equals=initText.indexOf('=');
    if(equals>=0){const bounds=ccTrimmedSpan(initText,equals+1,initText.length);
      initializerSpan={line:conditionLine,start:open+1+initBounds.start+bounds.start,end:open+1+initBounds.start+bounds.end};}
    updateSpan={line:conditionLine,start:open+1+updateBounds.start,end:open+1+updateBounds.end};
  }
  const conditionSource=conditionText.slice(conditionStart,conditionEnd);
  const identifiers=conditionSource.match(/[A-Za-z_$][\w$]*/g)||[];
  const controlName=loop.updateSource&&((loop.updateSource.match(/[A-Za-z_$][\w$]*/)||[])[0])||identifiers[0];
  if(!controlName)throw new Error(`${parsed.filename}: loop control variable could not be inferred`);
  if(!initializerSpan){
    const assignment=new RegExp(`\\b${ccEscapeRegExp(controlName)}\\s*=\\s*([^;,]+)`);
    for(let index=conditionLine-2;index>=0;index--){const match=assignment.exec(lines[index]);if(!match)continue;
      const valueStart=match.index+match[0].indexOf(match[1]);
      initializerSpan={line:index+1,start:valueStart,end:valueStart+match[1].length};break;}
  }
  if(!updateSpan){
    const update=new RegExp(`\\b${ccEscapeRegExp(controlName)}\\s*(?:\\+\\+|--|[+\\-*/%]=\\s*[^;]+)`);
    const firstBodyLine=loop.loopKind==='do-while'
      ?Math.max(0,lines.slice(0,conditionLine-1).map((line,index)=>/^\s*do\s*\{/.test(line)?index:-1).filter(index=>index>=0).pop()||0)
      :conditionLine-1;
    for(let index=firstBodyLine+1;index<conditionLine-1+(loop.loopKind==='while'?Math.max(2,lines.length-conditionLine):0);index++){
      if(index>=lines.length)break;const match=update.exec(lines[index]);if(!match)continue;
      updateSpan={line:index+1,start:match.index,end:match.index+match[0].length};break;}
  }
  const operator=/(<=|>=|==|!=|<|>)/.exec(conditionSource);
  if(!operator)throw new Error(`${parsed.filename}: loop condition needs a comparison operator`);
  const operatorStart=conditionStart+operator.index,operatorEnd=operatorStart+operator[0].length;
  const boundary=ccTrimmedSpan(conditionText,operatorEnd,conditionEnd);
  return {source,lines,lineStarts,controlName,conditionLine,conditionStart,conditionEnd,
    initializerSpan,updateSpan,operatorSpan:{line:conditionLine,start:operatorStart,end:operatorEnd},
    boundarySpan:{line:conditionLine,start:boundary.start,end:boundary.end}};
}
function ccCompletionSlots(parsed,profile){
  const parts=ccLoopParts(parsed),targets=profile.activity.completion&&profile.activity.completion.targets||[];
  const slots=[];
  targets.forEach((target,index)=>{
    const role=target.role;let span=null;
    if(role==='loop-initializer-value')span=parts.initializerSpan;
    else if(role==='loop-condition-operator')span=parts.operatorSpan;
    else if(role==='loop-condition-boundary')span=parts.boundarySpan;
    else if(role==='loop-condition')span={line:parts.conditionLine,start:parts.conditionStart,end:parts.conditionEnd};
    else if(role==='loop-update')span=parts.updateSpan;
    if(!span)throw new Error(`${parsed.filename}: no compatible ${role} completion slot was found`);
    slots.push(ccSlot(`completion-${index+1}`,role,span.line,span.start,span.end,parts.source,parts.lineStarts));
  });
  const ordered=slots.sort((left,right)=>left.start-right.start);
  for(let index=1;index<ordered.length;index++)if(ordered[index].start<ordered[index-1].end)
    throw new Error(`${parsed.filename}: completion slots overlap`);
  return {slots:ordered,controlName:parts.controlName};
}
function ccCompletedSource(item,missingToken=true){
  const values=item.slotValues||{};
  return item.slots.slice().sort((a,b)=>b.start-a.start).reduce((source,slot)=>{
    const value=String(values[slot.id]||'');
    return source.slice(0,slot.start)+(value.trim()?value:(missingToken?'__CODE_COMPLETION_MISSING__':''))+source.slice(slot.end);
  },item.templateSource);
}
function ccAllComplete(item){return item.slots.every(slot=>String(item.slotValues[slot.id]||'').trim());}
function ccTargetAnswer(parsed,profile,controlName){
  const full={output:parsed.output,expectedLines:parsed.expectedLines,variables:parsed.variables},
    equivalence=profile.activity.assessment&&profile.activity.assessment.equivalence||{};
  const outputRequired=!equivalence.output||equivalence.output.required!==false;
  const memory=equivalence.memory||{},memoryRequired=memory.required===true;
  let variables=memoryRequired?full.variables.slice():[];
  if(memoryRequired&&memory.variables&&memory.variables.select==='loop-control')variables=variables.filter(row=>row.name===controlName);
  else if(memoryRequired&&Array.isArray(memory.variables)){
    const selected=new Set(memory.variables.map(String));variables=variables.filter(row=>selected.has(row.name));
  }else if(memoryRequired&&memory.variables&&Array.isArray(memory.variables.include)){
    const selected=new Set(memory.variables.include.map(String));variables=variables.filter(row=>selected.has(row.name));
  }
  return {output:outputRequired?full.output:'',expectedLines:outputRequired?full.expectedLines:[],variables,terminalOutput:true};
}
function ccFullDisplayAnswer(parsed){
  return {output:parsed.output,expectedLines:parsed.expectedLines.slice(),variables:parsed.variables.slice(),terminalOutput:true};
}
function ccEnsureDisplayAnswer(item){
  if(item&&item.displayAnswerKey)return item.displayAnswerKey;
  if(!item)return null;
  try{
    const parsed=sourceProgramParseExercise({details:sourceProgramMetadataAndSource(item.templateSource||item.source,item.filename),
      filename:item.filename,language:item.language,sourceValueMode:'authored',
      inputValues:Object.fromEntries((item.inputs||[]).map(value=>[value.target,{value:value.value,raw:String(value.value)}]))});
    item.displayAnswerKey=sourceProgramGenerateAnswer(parsed,item.filename);
  }catch(error){item.displayAnswerKey=item.answerKey;}
  return item.displayAnswerKey;
}
function ccItem(profile,row,index,language){
  const parsed=soParseExercise(row.exercise,language,profileVariableValueMode(profile),profileInputValueMode(profile));
  const completion=ccCompletionSlots(parsed,profile);
  const answerKey=ccTargetAnswer(parsed,profile,completion.controlName),displayAnswerKey=ccFullDisplayAnswer(parsed),
    slotValues=Object.fromEntries(completion.slots.map(slot=>[slot.id,'']));
  const guard=profile.activity.execution&&profile.activity.execution.loopGuard||{};
  const generatedMaximum=Math.max(1,answerKey.expectedLines.length+answerKey.variables.length);
  const maximum=Number.isFinite(profile.pointsPerItem)?profile.pointsPerItem:generatedMaximum;
  const item={activityKind:'code-completion',profileId:profile.id,itemNumber:index+1,language,exerciseId:parsed.id,
    filename:parsed.filename,exerciseSet:row.exerciseSet,templateSource:parsed.source,source:parsed.source,
    slots:completion.slots,slotValues,controlName:completion.controlName,orderLines:[],order:[],initialOrder:[],answerKey,displayAnswerKey,
    inputs:parsed.inputs,sourceSeedValues:parsed.seedValues,executionGuard:{maxLoopIterations:guard.maxIterations||16,
      detectCycles:guard.detectCycles!==false},runResult:null,_coPlayback:null,_coPlaybackSpeed:.6,result:null,
    checked:false,itemScore:null,points:null,maxPoints:maximum,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,flagged:false,lockedAt:null,examActionLog:[]};
  item.source=ccCompletedSource(item);return item;
}
function ccGenerateItem({profile,index,language,generationContext}){
  if(!generationContext.order){const catalog=ccCatalog(profile,language).slice();generationContext.order=ccGenerator(profile).shuffle===false?catalog:soShuffle(catalog);}
  const row=generationContext.order[index%generationContext.order.length];if(!row)throw new Error(`${profile.id}: no compatible exercises`);
  return ccItem(profile,row,index,language);
}
function ccItemCount({profile,language}){return Math.min(Number(profile.itemCount)||ccCatalog(profile,language).length,ccCatalog(profile,language).length);}
function ccEdit(item,id,value){
  if(item.checked||!Object.prototype.hasOwnProperty.call(item.slotValues,id))return;
  item.slotValues[id]=value;item.source=ccCompletedSource(item);item.runResult=item.result=null;
  CODE_ORDERING_PLAYBACK_CAPABILITY.discard(item);
}
function ccApplyAction(context){
  const {item,action}=context;if(!item||item.checked||!action)return {applied:false};
  if(action.type==='EDIT'){ccEdit(item,action.id,action.value);return {applied:true};}
  if(String(action.type||'').startsWith('PLAYBACK_')&&!ccAllComplete(item)){
    item._ccCompletionMessage='Complete every blank before running the program.';return {applied:true};
  }
  delete item._ccCompletionMessage;
  const result=CODE_ORDERING_PLAYBACK_CAPABILITY.applyAction(context),playback=item._coPlayback;
  if(result.applied&&playback){
    const visible=playback.frames.slice(0,playback.index),checks=visible.reduce((total,frame)=>total+
      Number((frame.trace||[]).some(step=>step.action==='LOOP_CONDITION'&&step.value===true)),0);
    if(checks>=6){playback.speed=Math.min(playback.speed,.12);item._ccFastForward=true;}
    else if(checks>=3)playback.speed=Math.min(playback.speed,.3);
  }
  return result;
}
function ccCheck({item,profile}){
  if(!item||item.checked||!ccAllComplete(item)){if(item)item._ccCompletionMessage='Complete every blank before checking.';return {applied:false};}
  if(!item.runResult){item._ccCompletionMessage='Run the completed program to the end before checking it.';return {applied:false};}
  item.result=CODE_ORDERING_PLAYBACK_CAPABILITY.score(item,item.runResult);item.checked=true;
  const maximum=Number.isFinite(profile&&profile.pointsPerItem)?profile.pointsPerItem:item.result.total;
  item.correctSteps=item.result.correct;item.totalOpSteps=item.result.total;
  item.points=Number.isFinite(profile&&profile.pointsPerItem)
    ?roundPoints(maximum*(item.result.total?item.result.correct/item.result.total:0)):item.result.correct;
  item.maxPoints=maximum;item.itemScore=item.maxPoints?item.points/item.maxPoints:0;
  item.wasCorrectFinal=item.runResult.ok&&item.result.correct===item.result.total;
  item.lockedAt=profileLocksCheckedItems()?Date.now():null;return {applied:true,completed:true};
}
function ccReset({item}){
  if(!item||item.checked)return {applied:false};const changed=Object.values(item.slotValues).some(Boolean)||!!item.runResult;
  Object.keys(item.slotValues).forEach(id=>item.slotValues[id]='');item.source=ccCompletedSource(item);
  item.runResult=item.result=null;item._coPlayback=null;delete item._ccCompletionMessage;delete item._ccFastForward;
  return {applied:changed};
}
function ccRetry({item}){
  if(!item||!item.checked)return {applied:false};item.checked=false;item.itemScore=item.points=null;item.correctSteps=item.totalOpSteps=0;
  item.wasCorrectFinal=null;item.lockedAt=null;item._feedbackAnimated=false;ccReset({item:Object.assign(item,{checked:false})});
  return {applied:true,resetAttempt:true};
}
function ccAppendFragments(target,text,item){soSourceFragments(text,item.language).forEach(fragment=>
  target.appendChild(typeof fragment==='string'?document.createTextNode(fragment):fragment));}
function ccPlaybackBinding(memory,name){
  const binding=memory&&memory[name];
  if(binding==null)return null;
  return binding&&typeof binding==='object'&&!Array.isArray(binding)
    ?Object.assign({name,kind:'variable'},binding):{name,kind:'variable',value:binding};
}
function ccAppendExposedExpression(target,text,item,frame,idPrefix){
  const source=String(text||''),pattern=/[A-Za-z_$][\w$]*/g;let cursor=0,match,index=0;
  while((match=pattern.exec(source))){
    ccAppendFragments(target,source.slice(cursor,match.index),item);
    const binding=ccPlaybackBinding(frame.memoryBefore,match[0]);
    if(binding&&binding.initialized!==false&&binding.value!==undefined){
      target.appendChild(renderValueCard({id:`${idPrefix}-binding-${index++}`,name:match[0],value:binding.value,
        kind:binding.kind==='constant'?'constant':'variable',dataType:binding.dataType||null,color:null,isFlash:false}));
    }else ccAppendFragments(target,match[0],item);
    cursor=match.index+match[0].length;
  }
  ccAppendFragments(target,source.slice(cursor),item);
}
function ccCompactConditionEvaluation(item,frame){
  if(!frame||frame.forPhase!=='condition')return null;
  const trace=frame.trace||[],condition=trace.find(step=>step.action==='LOOP_CONDITION');
  const operation=trace.slice().reverse().find(step=>step.action==='EVALUATE');
  if(!condition||!operation)return null;
  const operator=operation.operator||(operation.target&&operation.target.operator);if(!operator)return null;
  const source=String(frame.conditionSource||'');let split=source.indexOf(operator);
  const operands=operation.target&&operation.target.operands||[];
  const left=split>=0?source.slice(0,split):String(operands[0]),right=split>=0
    ?source.slice(split+operator.length):String(operands[1]);
  return {title:'Evaluating condition',operator,left,right,result:Boolean(condition.value),resultKind:'condition'};
}
function ccCompactUpdateEvaluation(item,frame){
  if(!frame||frame.forPhase!=='update')return null;
  const trace=frame.trace||[],unary=trace.find(step=>step.action==='UNARY');
  const assignment=trace.find(step=>step.action==='ASSIGN');
  const step=unary||assignment;if(!step)return null;
  const target=step.target||item.controlName,operator=step.operator||step.op;
  const before=step.sourceValue!=null?step.sourceValue:step.beforeValue;
  const result=step.writeValue!=null?step.writeValue:step.result;
  const updateSource=String(frame.updateSource||frame.sourceText||'');
  let right='';if(assignment){const at=updateSource.indexOf(operator);right=at>=0?updateSource.slice(at+operator.length):String(step.rhsValue);}
  return {title:'Applying update',operator,left:target,right,result,resultKind:'update',target,before};
}
function ccCompactEvaluation(item,frame){return ccCompactConditionEvaluation(item,frame)||ccCompactUpdateEvaluation(item,frame);}
function ccRenderCompactEvaluation(item,frame,evaluation){
  const key=`cc-eval-${frame.index}`,leftId=`${key}-left`,rightId=`${key}-right`,resultId=`${key}-result`;
  const source=h('div',{class:'code-out cc-evaluation-expression'});
  if(evaluation.resultKind==='update'){
    const binding=ccPlaybackBinding(frame.memoryBefore,evaluation.target)||{kind:'variable',dataType:null};
    source.appendChild(renderValueCard({id:`${key}-source`,name:evaluation.target,value:evaluation.before,
      kind:binding.kind==='constant'?'constant':'variable',dataType:binding.dataType||null,color:null,isFlash:false}));
  }else ccAppendExposedExpression(source,evaluation.left,item,frame,`${key}-left`);
  const operator=h('span',{class:'tok tok-op-muted tok-colored cc-evaluation-operator',
    'data-op-left':leftId,'data-op-right':rightId},evaluation.operator);
  source.appendChild(document.createTextNode(' '));source.appendChild(operator);
  if(evaluation.right){source.appendChild(document.createTextNode(' '));
    ccAppendExposedExpression(source,evaluation.right,item,frame,`${key}-right`);}
  const operationColor=stepVisualColor({action:'EVALUATE',operator:evaluation.operator},0);
  operator.style.color=operationColor;
  const destination=evaluation.resultKind==='condition'
    ?h('span',{class:'tok tok-lit tok-colored-flash cc-evaluation-condition-result','data-token-id':resultId,
      style:`color:${operationColor};`},String(evaluation.result))
    :renderValueCard({id:resultId,name:evaluation.target,value:evaluation.result,kind:'variable',dataType:null,
      color:operationColor,isFlash:true});
  const timeline=h('div',{class:'timeline expression-timeline cc-evaluation-timeline'},
    h('div',{class:'tl-row done'},source),
    h('div',{class:'tl-row current cc-evaluation-result-row'},h('div',{class:'code-out'},destination)));
  const body=h('div',{class:'eval-panel cc-evaluation-body'},timeline);
  const callout=h('aside',{class:'cc-evaluation-callout','aria-live':'polite','aria-label':evaluation.title},body);
  callout._ccConnector={body,step:{action:'EVALUATE',operator:evaluation.operator,leftId,rightId,resultNodeId:resultId,
    target:{operator:evaluation.operator,operands:[]},result:evaluation.result}};
  return callout;
}
function ccDrawCompactEvaluationConnector(callout){
  const connector=callout&&callout._ccConnector;if(!connector||typeof buildConnectorVisuals!=='function')return;
  const panel=connector.body,rows=panel.querySelectorAll('.tl-row');
  panel.classList.add('connector-measuring');
  const metrics=typeof connectorContentRect==='function'
    ?connectorContentRect(panel):panel.getBoundingClientRect();
  const visuals=buildConnectorVisuals(metrics,rows,[connector.step],1);
  appendConnectorSvg(panel,visuals.paths,visuals.dots);panel.classList.remove('connector-measuring');
}
function ccMountCompactEvaluation(item,panel,host){
  const frame=CODE_ORDERING_PLAYBACK_CAPABILITY.currentFrame(item),evaluation=ccCompactEvaluation(item,frame);
  if(!evaluation||!panel||!host||typeof requestAnimationFrame!=='function')return;
  const source=panel.querySelector('.program-source-file-code');if(!source)return;
  const callout=ccRenderCompactEvaluation(item,frame,evaluation);host.appendChild(callout);
  requestAnimationFrame(()=>{
    if(!source.isConnected||!callout.isConnected)return;
    const row=source.querySelector(`.program-source-file-line[data-source-line="${frame.line}"]`);
    const phase=frame.forPhase||'condition';
    const anchor=row&&(row.querySelector(`[data-for-phase="${phase}"]`)
      ||row.querySelector('.program-source-condition')||row.querySelector('.program-source-file-text'));
    if(!anchor)return;
    const anchorRect=anchor.getBoundingClientRect(),targetX=anchorRect.left+anchorRect.width/2;
    const width=callout.offsetWidth,left=Math.max(8,Math.min(targetX-width/2,window.innerWidth-width-8));
    const top=Math.max(8,anchorRect.top-callout.offsetHeight-14);
    callout.style.left=`${left}px`;callout.style.top=`${top}px`;
    callout.style.setProperty('--cc-callout-anchor-x',`${Math.max(18,Math.min(width-18,targetX-left))}px`);
    ccDrawCompactEvaluationConnector(callout);
  });
}
function ccTraceProgram(item){
  const playback=item._coPlayback,index=playback?Math.min(playback.index,playback.frames.length):0;
  const frames=playback&&playback.frames||[],source=item.templateSource.split('\n'),idsByLine=new Map();
  const statements=frames.map((frame,frameIndex)=>{
    const id=`cc-flow-${frameIndex}-${frame.statementId||frame.line||'statement'}`;
    if(!idsByLine.has(frame.line))idsByLine.set(frame.line,[]);idsByLine.get(frame.line).push(id);
    const runtime=frame.runtime||{};
    return {id,sourceLine:frame.line,sourceText:source[frame.line-1]||frame.sourceText||'',
      kind:frame.statementKind,loopKind:frame.loopKind||null,forPhase:frame.forPhase||null,
      terminalEmitterId:frame.statementId,
      parts:frame.statementKind==='output'?[]:undefined,
      status:frameIndex<index?'complete':'locked',runtime:{checked:runtime.checked===true,
        assignedValue:runtime.checked===true?Boolean(runtime.assignedValue):null}};
  });
  const complete=!!(playback&&index>=frames.length);
  return {statements,cursor:index>0?index-1:0,status:complete?'complete':'running',progressMode:'completion',
    executionHistory:statements.slice(0,complete?index:Math.max(0,index-1)).map(statement=>statement.id),events:[]};
}
function ccTraceView(item,program){
  const view=item._ccTraceView||Object.create(item);item._ccTraceView=view;
  const source=item.templateSource.split('\n'),idsByLine=new Map();
  program.statements.forEach(statement=>{
    if(!idsByLine.has(statement.sourceLine))idsByLine.set(statement.sourceLine,[]);
    idsByLine.get(statement.sourceLine).push(statement.id);
  });
  view.profileId=item.profileId;view.language=item.language;view.filename=item.filename;
  view.checked=item.checked;view.sourceFlow=true;view.sourceDisplay={filename:item.filename,
    lines:source.map((text,index)=>({number:index+1,text,primary:true,
      statementIds:idsByLine.get(index+1)||[]}))};
  const transition=item._coFlowTransition;
  if(transition){
    const current=program.statements[program.cursor]||null;
    const origin=program.statements.slice(0,Math.max(0,program.cursor)).reverse()
      .find(statement=>Number(statement.sourceLine)===Number(transition.fromLine));
    const destination=current&&Number(current.sourceLine)===Number(transition.toLine)?current:null;
    view._sourceFlowTransition=origin&&destination
      ?{phase:'moving',originId:origin.id,destinationId:destination.id}:null;
  }else view._sourceFlowTransition=null;
  view._programFlowTrailEdgeKeys=item._programFlowTrailEdgeKeys;
  return view;
}
function ccSourceLineCode(owner,context){
  const {line,conditionResult}=context,slots=owner.slots.filter(slot=>slot.line===line.number);
  if(!slots.length)return context.defaultSourceCode();
  const lineStart=ccLineStarts(owner.templateSource)[line.number-1];
  const localSlots=slots.map(slot=>Object.assign({},slot,{localStart:slot.start-lineStart,localEnd:slot.end-lineStart}));
  const appendRange=(target,start,end)=>{
    let cursor=start;
    localSlots.filter(slot=>slot.localStart>=start&&slot.localEnd<=end).forEach(slot=>{
      ccAppendFragments(target,line.text.slice(cursor,slot.localStart),owner);
      const compact=['loop-initializer-value','loop-condition-operator','loop-condition-boundary'].includes(slot.role);
      target.appendChild(h('input',{class:`cc-completion-input ${compact?'is-compact':'is-expression'}`,
        type:'text',value:owner.slotValues[slot.id]||'','data-completion-role':slot.role,
        'aria-label':`Complete ${slot.role.replace(/-/g,' ')}`,
        style:compact?null:`--cc-input-ch:${Math.max(6,Math.min(18,slot.answer.length+2))}ch`,
        disabled:owner.checked||state.examExpired,
        oninput:event=>ccEdit(owner,slot.id,event.target.value),onchange:()=>saveSessionProgress()}));
      cursor=slot.localEnd;
    });
    ccAppendFragments(target,line.text.slice(cursor,end),owner);
  };
  const forParts=context.forHeaderParts;
  const code=h('code',{class:`program-source-file-text${forParts?' program-source-for-header':''}`});
  if(forParts){
    let cursor=0;
    ['initialize','condition','update'].forEach(phase=>{
      const part=forParts[phase];
      if(part.start>cursor)appendRange(code,cursor,part.start);
      const clause=h('span',{class:`program-source-for-clause is-${phase}${phase==='condition'?' program-source-condition':''}`,
        'data-for-phase':phase});
      appendRange(clause,part.start,part.end);
      if(phase==='condition'&&conditionResult)clause.appendChild(renderProgramConditionResult(conditionResult));
      code.appendChild(clause);cursor=part.end;
    });
    if(cursor<line.text.length)appendRange(code,cursor,line.text.length);
  }else if(context.conditionPart){
    appendRange(code,0,context.conditionPart.start);
    const condition=h('span',{class:'program-source-condition'});
    appendRange(condition,context.conditionPart.start,context.conditionPart.end);
    if(conditionResult)condition.appendChild(renderProgramConditionResult(conditionResult));
    code.appendChild(condition);appendRange(code,context.conditionPart.end,line.text.length);
  }else{
    appendRange(code,0,line.text.length);
    if(conditionResult)code.appendChild(renderProgramConditionResult(conditionResult));
  }
  return code;
}
function ccSourcePanel(item){
  const program=ccTraceProgram(item),view=ccTraceView(item,program);
  const panel=renderProgramSourceFilePanel(view,program,{renderSourceLineCode:context=>ccSourceLineCode(item,context)});
  const source=panel.querySelector&&panel.querySelector('.program-source-file-code');
  if(source&&item._coFlowTransition&&item._coFlowTransition.duration)
    source.style.setProperty('--program-flow-duration',`${item._coFlowTransition.duration}ms`);
  item._programFlowTrailEdgeKeys=view._programFlowTrailEdgeKeys;
  return panel;
}
function ccNotice(item){
  if(item._ccCompletionMessage)return h('div',{class:'cc-run-notice is-review'},h('i',{class:'fa-solid fa-circle-info'}),item._ccCompletionMessage);
  const run=item.runResult;if(run&&!run.ok&&/loop|repeat|iteration/i.test(run.message||''))return h('div',{class:'cc-run-notice is-loop'},
    h('i',{class:'fa-solid fa-arrows-rotate'}),h('span',{},run.message,' The animated trail shows the repeating route; revise the loop control and run again.'));
  if(item._ccFastForward&&item._coPlayback&&item._coPlayback.playing)return h('div',{class:'cc-run-notice is-fast'},
    h('i',{class:'fa-solid fa-forward'}),' Repeated iterations are now fast-forwarding.');
  return null;
}
function ccRender({container,item,profile}){
  ccEnsureDisplayAnswer(item);
  const flow=renderProgramWorkspaceShell(container,item,{statements:[],cursor:0,status:item.checked?'complete':'running',progressMode:'completion'});
  flow.parentNode.classList.add('code-ordering-workspace','code-completion-workspace');
  flow.appendChild(h('div',{class:'so-instruction'},h('i',{class:'fa-solid fa-circle-info'}),profile.activity.instructions));
  const sourcePanel=ccSourcePanel(item);
  flow.appendChild(h('div',{class:'co-main-workspace'},h('div',{class:'co-main-grid'},
    h('div',{class:'co-main-pane co-order-pane is-active'},sourcePanel),
    h('div',{class:'co-main-pane is-active'},CODE_ORDERING_PLAYBACK_CAPABILITY.stateColumn(item,false)),
    h('div',{class:'co-main-pane is-active'},CODE_ORDERING_PLAYBACK_CAPABILITY.stateColumn(item,true)))));
  ccMountCompactEvaluation(item,sourcePanel,flow);
  const notice=ccNotice(item);if(notice)flow.appendChild(notice);
  const error=CODE_ORDERING_PLAYBACK_CAPABILITY.executionError(item);if(error)flow.appendChild(error);
  CODE_ORDERING_PLAYBACK_CAPABILITY.scheduleTrail(item,flow);
  if(!item.checked&&!state.examExpired){
    flow.appendChild(CODE_ORDERING_PLAYBACK_CAPABILITY.playbackControls(item));
    const controls=h('div',{class:'so-controls'});
    if(profileAllowsRetry())controls.appendChild(h('button',{class:'item-reset-button',type:'button',onclick:handleReset},'Reset item'));
    const evaluationActions=renderInlineEvaluationActions({canCheck:ccAllComplete(item)&&!!item.runResult});
    if(evaluationActions)controls.appendChild(evaluationActions);flow.appendChild(controls);
  }else if(profileAllowsRetry())appendPracticeRetryBar(container);
  CODE_ORDERING_PLAYBACK_CAPABILITY.schedule(item);CODE_ORDERING_PLAYBACK_CAPABILITY.syncFeedback(item);
}
function ccValidate(profile){
  const generator=ccGenerator(profile),refs=ccSourceRefs(profile),completion=profile.activity&&profile.activity.completion;
  if(!generator.library||!refs.length)throw new Error(`${profile.id}: missing code-completion sources`);
  refs.forEach(reference=>{soPathSlug(reference.exerciseSet,`${profile.id}: exerciseSet`);
    if(reference.include!=null&&(!Array.isArray(reference.include)||!reference.include.length))throw new Error(`${profile.id}: include must be a non-empty array`);});
  const roles=new Set(['loop-initializer-value','loop-condition-operator','loop-condition-boundary','loop-condition','loop-update']);
  if(!completion||!Array.isArray(completion.targets)||!completion.targets.length||completion.targets.some(target=>!roles.has(target.role)))
    throw new Error(`${profile.id}: invalid code-completion targets`);
  if(!Number.isInteger(Number(profile.itemCount))||Number(profile.itemCount)<1)throw new Error(`${profile.id}: item count must be a positive number`);
  if(profile.pointsPerItem!=='generated-answer'
    &&!(Number.isFinite(profile.pointsPerItem)&&profile.pointsPerItem>0))
    throw new Error(`${profile.id}: pointsPerItem must be generated-answer or a positive number`);
  for(const [label,mode] of [['variables',profileVariableValueMode(profile)],['input',profileInputValueMode(profile)]])
    if(!['authored','seeded'].includes(mode))throw new Error(`${profile.id}: ${label} value mode must be authored or seeded`);
  const equivalence=profile.activity.assessment&&profile.activity.assessment.equivalence||{};
  if(equivalence.output&&equivalence.output.required===false&&!(equivalence.memory&&equivalence.memory.required===true))
    throw new Error(`${profile.id}: code completion must assess output, memory, or both`);
  const guard=profile.activity.execution&&profile.activity.execution.loopGuard;
  if(guard&&(!Number.isInteger(Number(guard.maxIterations))||Number(guard.maxIterations)<2||Number(guard.maxIterations)>100))
    throw new Error(`${profile.id}: loop guard maxIterations must be from 2 to 100`);
}
registerActivityPlugin({id:'code-completion',manifest:CODE_COMPLETION_MANIFEST,loadContent:ccLoad,itemCount:ccItemCount,
  maxPoints({item,profile}){return Number.isFinite(profile.pointsPerItem)?profile.pointsPerItem:item.maxPoints;},
  validateProfile:ccValidate,generateItem:ccGenerateItem,render:ccRender,
  applyAction:ccApplyAction,check:ccCheck,reset:ccReset,retry:ccRetry,
  hasAttempt({item}){return !!(item&&(Object.values(item.slotValues||{}).some(Boolean)||item.runResult||item._coPlayback&&item._coPlayback.index));}});
