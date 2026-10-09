const CODE_ORDERING_MANIFEST=Object.freeze({id:'code-ordering',version:'1.0.0',semanticOwner:'language-core',
  responsibilities:Object.freeze(['interaction','presentation','feedback','scoring']),
  dependencies:Object.freeze(['language-core:program-semantics','simulate-output:source-answer-adapter'])});
let coPlaybackTimer=null;
let coPendingSourceViewport=null;
function coWhitespaceLineNumbers(text,anchors){
  if(!anchors.length)return [];
  let first=Math.min(...anchors),last=Math.max(...anchors);
  while(first>1&&!text[first-2].trim())first--;
  while(last<text.length&&!text[last].trim())last++;
  const lines=[];for(let line=first;line<=last;line++)if(!text[line-1].trim())lines.push(line);
  return lines;
}
function coCandidates(parsed){
  const text=parsed.source.split('\n'),seen=new Set(),statements=parsed.coreProgram.statements||[];
  const candidates=statements.map(s=>{
    const a=s.sourceSpan&&s.sourceSpan.start&&s.sourceSpan.start.line,b=s.sourceSpan&&s.sourceSpan.end&&s.sourceSpan.end.line;
    if(!a||a!==b||seen.has(a)||['return','break','continue'].includes(s.kind)||!text[a-1].trim())return null;
    seen.add(a);return {id:'line-'+a,slotLine:a,text:text[a-1]};
  }).filter(Boolean);
  const anchors=statements.flatMap(s=>{
    const span=s.sourceSpan;if(!span||!span.start||!span.end)return [];
    return [span.start.line,span.end.line].filter(Boolean);
  });
  coWhitespaceLineNumbers(text,anchors).forEach(line=>{
    if(!seen.has(line)){seen.add(line);candidates.push({id:'line-'+line,slotLine:line,text:text[line-1],whitespace:true});}
  });
  return candidates.sort((a,b)=>a.slotLine-b.slotLine);
}
function coEnsureWhitespaceCandidates(item){
  if(!item||!Array.isArray(item.orderLines)||!item.orderLines.length)return;
  const text=item.source.split('\n');
  const anchors=item.orderLines.filter(line=>!line.whitespace).map(line=>line.slotLine);
  text.forEach((line,index)=>{if(/^\s*return\b/.test(line))anchors.push(index+1);});
  const allowed=new Set(coWhitespaceLineNumbers(text,anchors));
  const removed=new Set(item.orderLines.filter(line=>line.whitespace&&!allowed.has(line.slotLine)).map(line=>line.id));
  if(removed.size){
    item.orderLines=item.orderLines.filter(line=>!removed.has(line.id));
    item.order=item.order.filter(id=>!removed.has(id));
    if(Array.isArray(item.initialOrder))item.initialOrder=item.initialOrder.filter(id=>!removed.has(id));
  }
  const known=new Set(item.orderLines.map(line=>line.slotLine));
  [...allowed].sort((a,b)=>a-b).forEach(line=>{if(!known.has(line)){
    const candidate={id:'line-'+line,slotLine:line,text:text[line-1],whitespace:true};
    const at=item.orderLines.findIndex(existing=>existing.slotLine>line),index=at<0?item.orderLines.length:at;
    item.orderLines.splice(index,0,candidate);item.order.splice(index,0,candidate.id);
    if(Array.isArray(item.initialOrder))item.initialOrder.splice(index,0,candidate.id);known.add(line);
  }});
}function coShuffle(lines){
  const canonical=lines.map(v=>v.id),order=soShuffle(canonical);
  if(order.length>1&&order.every((v,i)=>v===canonical[i]))[order[0],order[1]]=[order[1],order[0]];
  return order;
}
function coSource(item){
  const lines=item.source.split('\n'),byId=new Map(item.orderLines.map(v=>[v.id,v]));
  item.orderLines.forEach((slot,i)=>{lines[slot.slotLine-1]=byId.get(item.order[i]).text;});
  return lines.join('\n');
}

function coPlaybackVariables(memory){
  return Object.values(memory||{}).filter(binding=>binding&&binding.mutable!==false&&binding.kind!=='constant'
    &&binding.initialized!==false&&binding.value!==undefined)
    .map(binding=>({name:binding.name,dataType:binding.dataType||null,expected:sourceProgramAnswerValue(binding)}));
}
function coPlaybackFrames(parsed){
  const core=parsed.coreProgramResult||{},rawFrames=core.ir&&core.ir.metadata&&core.ir.metadata.executionFrames||[];
  const frames=[];
  rawFrames.forEach(frame=>{
    const previous=frames[frames.length-1];
    if(previous&&frame.statementKind==='declaration'&&previous.statementKind==='declaration'
      &&frame.sourceLine===previous.sourceLine&&frame.sourceText===previous.sourceText){
      previous.memoryAfter=frame.memoryAfter;previous.effects.push(...frame.effects);previous.trace.push(...frame.trace);
      previous.nextStatementId=frame.nextStatementId;previous.error=frame.error||previous.error;return;
    }
    frames.push(Object.assign({},frame,{effects:(frame.effects||[]).slice(),trace:(frame.trace||[]).slice()}));
  });
  let output='';
  return frames.map((frame,index)=>{
    const outputBefore=output;
    let printedText='';
    (frame.effects||[]).forEach(effect=>{
      if(effect.kind==='output'){const text=effect.text||'';output+=text;printedText+=text;}
      else if(effect.kind==='input')output+=String(effect.rawText==null?'':effect.rawText)+'\n';
    });
    return {index,line:frame.sourceLine,endLine:frame.sourceEndLine,statementId:frame.statementId,
      statementKind:frame.statementKind,sourceText:frame.sourceText,error:frame.error||null,
      reads:[...new Set((frame.effects||[]).filter(effect=>effect.kind==='read').map(effect=>effect.target))],
      writes:[...new Set((frame.effects||[]).filter(effect=>effect.kind==='write'||effect.kind==='declare').map(effect=>effect.target))],
      consoleActive:(frame.effects||[]).some(effect=>effect.kind==='output'||effect.kind==='input'),
      outputBefore,printedText,
      answer:{output,expectedLines:sourceProgramTerminalScreen(output),variables:coPlaybackVariables(frame.memoryAfter)}};
  });
}
function coDiagnosticPlayback(source,frames,diagnostic){
  const start=diagnostic&&diagnostic.location&&diagnostic.location.start||{},end=diagnostic&&diagnostic.location&&diagnostic.location.end||{};
  const line=Number(start.line)||1,message=diagnostic.message||diagnostic.code||'Execution stopped';
  const existing=frames.findIndex(frame=>frame.line===line&&frame.error);
  if(existing>=0){
    const visible=frames.slice(0,existing+1);
    return {frames:visible,answer:visible[visible.length-1].answer,line,message};
  }
  const visible=frames.filter(frame=>frame.line<line);
  const answer=visible.length?visible[visible.length-1].answer:{output:'',expectedLines:[],variables:[]};
  visible.push({index:visible.length,line,endLine:Number(end.line)||line,
    statementId:'diagnostic-line-'+line,statementKind:'diagnostic',
    sourceText:String(source||'').split('\n')[line-1]||'',error:message,
    reads:[],writes:[],consoleActive:false,outputBefore:answer.output||'',printedText:'',answer});
  return {frames:visible,answer,line,message};
}
function coRun(item){
  const source=coSource(item);
  try{
    const parsed=sourceProgramParseExercise({details:sourceProgramMetadataAndSource(source,item.filename),
      filename:item.filename,language:item.language,sourceValueMode:'authored',
      inputValues:Object.fromEntries((item.inputs||[]).map(v=>[v.target,{value:v.value,raw:String(v.value)}]))});
    const frames=coPlaybackFrames(parsed),diagnostics=parsed.coreProgramResult.diagnostics||[];
    const diagnostic=diagnostics.slice().sort((left,right)=>{
      const leftLine=left.location&&left.location.start&&left.location.start.line||Number.MAX_SAFE_INTEGER;
      const rightLine=right.location&&right.location.start&&right.location.start.line||Number.MAX_SAFE_INTEGER;
      return leftLine-rightLine;
    })[0];
    if(diagnostic){
      const stopped=coDiagnosticPlayback(source,frames,diagnostic);
      return {ok:false,source,frames:stopped.frames,answer:stopped.answer,line:stopped.line,message:stopped.message};
    }
    return {ok:true,source,frames,answer:sourceProgramGenerateAnswer(parsed,item.filename)};
  }catch(error){const m=String(error.message||error).match(/(?:line\s+|:)(\d+)/i);
    return {ok:false,source,frames:[],answer:{output:'',expectedLines:[],variables:[]},line:m?Number(m[1]):null,message:String(error.message||error)};}
}
function coCurrentPlaybackFrame(item){
  const playback=item&&item._coPlayback;
  return playback&&playback.index>0?playback.frames[Math.min(playback.index,playback.frames.length)-1]||null:null;
}
function coVisibleRunAnswer(item){
  const frame=coCurrentPlaybackFrame(item);
  return frame?frame.answer:(item.runResult&&item.runResult.answer||{output:'',variables:[]});
}
const CO_PLAYBACK_SEQUENCE_VERSION=2;
function coCreatePlayback(item){
  const finalRun=coRun(item);
  return {index:0,playing:false,speed:item._coPlaybackSpeed==null?.6:item._coPlaybackSpeed,
    sequenceVersion:CO_PLAYBACK_SEQUENCE_VERSION,arrangedSource:finalRun.source,
    frames:finalRun.frames||[],finalRun};
}
function coPlaybackMatchesArrangement(item,playback){
  if(!item||!playback||playback.sequenceVersion!==CO_PLAYBACK_SEQUENCE_VERSION)return false;
  try{return playback.arrangedSource===coSource(item);}catch(error){return false;}
}
function coDiscardPlayback(item){
  item.runResult=null;item._coPlayback=null;
  delete item._coPlaybackTrail;delete item._coTerminalEvent;
}
function coCompletePlayback(item){
  const playback=item._coPlayback;if(!playback)return;
  playback.index=playback.frames.length;playback.playing=false;item.runResult=playback.finalRun;item._coMobileTab='run';
}
function coQueuePlaybackTrail(item){
  const playback=item&&item._coPlayback;
  if(!playback||playback.speed<=0||playback.index<=0)return;
  item._coPlaybackTrail={index:playback.index,token:(item._coPlaybackTrailToken||0)+1};
  item._coPlaybackTrailToken=item._coPlaybackTrail.token;
  const frame=playback.frames[playback.index-1];
  if(frame&&frame.printedText&&typeof queueProgramTerminalAnimation==='function'){
    const stepMs=Math.max(100,playback.speed*1000),characters=Math.max(1,frame.printedText.length);
    const event={type:'OUTPUT',text:frame.printedText,statementId:frame.statementId,
      characterDelayMs:Math.max(12,Math.min(55,stepMs*.68/characters)),
      escapeDelayMs:Math.max(35,Math.min(220,stepMs*.24)),
      trailDurationMs:Math.max(80,stepMs*.28)};
    item._coTerminalEvent=event;
    queueProgramTerminalAnimation(item,event,()=>{if(item._coTerminalEvent===event)delete item._coTerminalEvent;});
  }
}
function coEnsureCanonicalAnswerOutput(item){
  if(!item||!item.answerKey||item.answerKey.terminalOutput===true)return;
  const parsed=sourceProgramParseExercise({details:sourceProgramMetadataAndSource(item.source,item.filename),
    filename:item.filename,language:item.language,sourceValueMode:'authored',
    inputValues:Object.fromEntries((item.inputs||[]).map(value=>[value.target,{value:value.value,raw:String(value.value)}]))});
  item.answerKey.output=sourceProgramGenerateAnswer(parsed,item.filename).output;
  item.answerKey.terminalOutput=true;
}
function coTotal(a){return a.expectedLines.length+a.variables.reduce((n,v)=>n+(Array.isArray(v.expected)?v.expected.length:1),0);}
function coItem(profile,exercise,index,language){
  const parsed=soParseExercise(exercise,language,profileVariableValueMode(profile),profileInputValueMode(profile));
  const orderLines=coCandidates(parsed);if(!orderLines.length)throw new Error(exercise.filename+': requires at least one reorderable statement line');
  const answerKey={output:parsed.output,expectedLines:parsed.expectedLines,variables:parsed.variables,terminalOutput:true};
  if(!coTotal(answerKey))throw new Error(exercise.filename+': canonical source has no observable state');
  const order=coShuffle(orderLines);
  return {activityKind:'code-ordering',profileId:profile.id,itemNumber:index+1,language,exerciseId:parsed.id,
    filename:parsed.filename,source:parsed.source,orderLines,order,initialOrder:order.slice(),answerKey,inputs:parsed.inputs,
    sourceSeedValues:parsed.seedValues,runResult:null,_coPlayback:null,_coPlaybackSpeed:.6,result:null,checked:false,itemScore:null,points:null,
    maxPoints:coTotal(answerKey),correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,flagged:false,lockedAt:null,examActionLog:[]};
}
function coGenerateItem({profile,index,language,generationContext}){
  if(!generationContext.order){const list=soCatalog(profile,language).slice();
    generationContext.order=profile.activity.generator.shuffle===false?list:soShuffle(list);}
  const exercise=generationContext.order[index];if(!exercise)throw new Error(profile.id+': missing item '+(index+1));
  return coItem(profile,exercise,index,soBank(profile,language).language);
}
function coEqual(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
function coApplyAction({item,action}){
  if(!item||item.checked||!action)return {applied:false};
  if(action.type!=='PLAYBACK_STOP'
    &&typeof programTerminalInteractionLocked==='function'&&programTerminalInteractionLocked())return {applied:false};
  if(action.type==='MOVE'){
    const from=Number(action.from),to=Number(action.to);
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=item.order.length||to>=item.order.length||from===to)return {applied:false};
    const next=item.order.slice(),moved=next.splice(from,1)[0];next.splice(to,0,moved);item.order=next;
    coDiscardPlayback(item);return {applied:true};
  }
  if(!String(action.type||'').startsWith('PLAYBACK_'))return {applied:false};
  if(!coPlaybackMatchesArrangement(item,item._coPlayback))item._coPlayback=coCreatePlayback(item);
  const playback=item._coPlayback,total=playback.frames.length;
  if(action.type==='PLAYBACK_SPEED'){
    const speed=Math.max(0,Math.min(1,Math.round(Number(action.value)*5)/5));
    if(!Number.isFinite(speed)||speed===playback.speed)return {applied:false};
    playback.speed=speed;item._coPlaybackSpeed=speed;
    if(playback.playing&&speed===0)coCompletePlayback(item);return {applied:true};
  }
  if(action.type==='PLAYBACK_RESTART'){
    playback.index=0;playback.playing=false;item.runResult=null;item._coMobileTab='order';return {applied:true};
  }
  if(action.type==='PLAYBACK_STOP'){
    if(!playback.playing)return {applied:false};playback.playing=false;return {applied:true};
  }
  if(action.type==='PLAYBACK_PREV'){
    if(playback.index<=0)return {applied:false};playback.playing=false;playback.index--;item.runResult=null;return {applied:true};
  }
  if(action.type==='PLAYBACK_NEXT'||action.type==='PLAYBACK_TICK'){
    if(action.type==='PLAYBACK_TICK'&&!playback.playing)return {applied:false};
    if(total===0){coCompletePlayback(item);return {applied:true};}
    if(playback.index>=total)return {applied:false};playback.index++;coQueuePlaybackTrail(item);
    if(playback.index>=total)coCompletePlayback(item);return {applied:true};
  }
  if(action.type==='PLAYBACK_PLAY'){
    if(playback.playing){playback.playing=false;return {applied:true};}
    if(playback.index>=total){playback.index=0;item.runResult=null;}
    if(playback.speed===0||total===0){coCompletePlayback(item);return {applied:true};}
    playback.playing=true;playback.index++;coQueuePlaybackTrail(item);item._coMobileTab='order';
    if(playback.index>=total)coCompletePlayback(item);return {applied:true};
  }
  return {applied:false};
}function coScore(item,run){
  coEnsureCanonicalAnswerOutput(item);
  const expected=item.answerKey,actual=run&&run.answer||{output:'',variables:[]};
  let lines=sourceProgramScreenStateText(actual.output).split('\n');if(lines.length===1&&!lines[0])lines=[];
  const outputResults=expected.expectedLines.map((v,i)=>lines[i]===v);
  const expectedTerminal=coreTerminalScreen(expected.output),actualTerminal=coreTerminalScreen(actual.output);
  const cursorMatches=expectedTerminal.row===actualTerminal.row&&expectedTerminal.column===actualTerminal.column;
  if(!cursorMatches&&outputResults.length)outputResults[outputResults.length-1]=false;
  const outputCorrect=Math.max(0,outputResults.filter(Boolean).length-Math.max(0,lines.length-expected.expectedLines.length));
  const found=new Map(actual.variables.map(v=>[v.name,v.expected]));
  const variableResults=expected.variables.map(v=>Array.isArray(v.expected)?v.expected.map((x,i)=>found.has(v.name)&&String(found.get(v.name)[i])===String(x))
    :found.has(v.name)&&String(found.get(v.name))===String(v.expected));
  const variableCorrect=variableResults.reduce((n,v)=>n+(Array.isArray(v)?v.filter(Boolean).length:Number(v)),0);
  const total=coTotal(expected),correct=run&&run.ok?outputCorrect+variableCorrect:0;
  return {correct,total,outputResults,variableResults};
}
function coCheck({item,state}){if(!item||item.checked)return {applied:false};item.runResult=coRun(item);
  item._coPlayback={index:item.runResult.frames.length,playing:false,speed:item._coPlaybackSpeed==null?.6:item._coPlaybackSpeed,
    sequenceVersion:CO_PLAYBACK_SEQUENCE_VERSION,arrangedSource:item.runResult.source,
    frames:item.runResult.frames,finalRun:item.runResult};item._coMobileTab='run';item.result=coScore(item,item.runResult);
  item.checked=true;item.correctSteps=item.points=item.result.correct;item.totalOpSteps=item.maxPoints=item.result.total;
  item.itemScore=item.points/item.maxPoints;item.wasCorrectFinal=item.points===item.maxPoints;item.lockedAt=state.mode==='exam'?Date.now():null;
  return {applied:true,completed:true};}
function coReset({item}){if(!item||item.checked)return {applied:false};const changed=!coEqual(item.order,item.initialOrder)||!!item.runResult
    ||!!(item._coPlayback&&item._coPlayback.index);
  item.order=item.initialOrder.slice();item.runResult=null;item._coPlayback=null;item._coMobileTab='order';item._feedbackAnimated=false;return {applied:changed};}
function coRetry({item}){if(!item||!item.checked)return {applied:false};item.order=coShuffle(item.orderLines);item.initialOrder=item.order.slice();
  item.runResult=item.result=null;item._coPlayback=null;item.checked=false;item.itemScore=item.points=null;item.correctSteps=item.totalOpSteps=0;
  item.wasCorrectFinal=null;item.lockedAt=null;item._coMobileTab='order';item._feedbackAnimated=false;return {applied:true,resetAttempt:true};}
function coScreen(value){return sourceProgramScreenStateText(String(value||''));}
function coWorkspaceMemoryPanel(item,system){
  const expected=item.answerKey,actual=system?{variables:[]}:coVisibleRunAnswer(item),frame=system?null:coCurrentPlaybackFrame(item);
  const actualMap=new Map(actual.variables.map(variable=>[variable.name,variable]));
  const panel=h('div',{class:'var-final-panel'}),list=h('div',{class:'var-final-list'});
  expected.variables.forEach(variable=>{
    const found=actualMap.get(variable.name),hasValue=system||!!found;
    const value=system?variable.expected:(found?found.expected:'—');
    const matches=system||!!found&&traceFeedbackValuesEqual(found.expected,variable.expected);
    const activity=frame&&frame.writes.includes(variable.name)?' co-memory-playback-write'
      :frame&&frame.reads.includes(variable.name)?' co-memory-playback-read':'';
    list.appendChild(h('div',{class:'var-final-row'+(!system?(matches?' co-memory-matched':' co-memory-unmatched'):'')+activity,
      'data-co-memory-name':system?null:variable.name},renderValueCard({
      id:'co-'+(system?'answer':'run')+'-'+variable.name,name:variable.name,value,
      kind:'variable',dataType:hasValue?variable.dataType:null,color:null,isFlash:false
    })));
  });
  if(!expected.variables.length)list.appendChild(h('span',{class:'co-context-empty'},'No program variables'));
  panel.appendChild(list);
  return h('aside',{class:'program-memory-dock','aria-label':'Program memory'},
    h('div',{class:'program-memory-dock-title'},
      h('span',{},h('i',{class:'fa-solid fa-memory','aria-hidden':'true'}),' Program Memory')),
    h('div',{class:'program-memory-dock-body'},panel));
}
function coWorkspaceOutputPanel(item,system){
  const actual=coVisibleRunAnswer(item),frame=system?null:coCurrentPlaybackFrame(item);
  const output=system?item.answerKey.output:actual.output;
  if(typeof renderProgramTerminalPanel==='function'){
    let events=output?[{type:'OUTPUT',text:output}]:[];
    if(!system&&frame&&item._coTerminalEvent){
      events=[];
      if(frame.outputBefore)events.push({type:'OUTPUT',text:frame.outputBefore});
      events.push(item._coTerminalEvent);
    }
    const panel=renderProgramTerminalPanel(item,{events,statements:[]},{surface:'main'});
    if(frame&&frame.consoleActive)panel.classList.add('co-playback-console-active');return panel;
  }
  return h('aside',{class:'program-output-screen','aria-label':'Program Output'},
    h('div',{class:'program-output-screen-title'},h('i',{class:'fa-solid fa-display','aria-hidden':'true'}),h('span',{},'Program Output')),
    h('div',{class:'program-output-screen-body'},h('pre',{class:'program-output-screen-text'},coScreen(output)),
      h('span',{class:'program-output-cursor','aria-hidden':'true'},'▌')));
}
function coRunMatchesAnswer(item){
  if(!item.runResult)return null;
  const score=coScore(item,item.runResult);
  return !!item.runResult.ok&&score.correct===score.total;
}
function coFocusExecutionError(item){
  if(!item.runResult||!item.runResult.line)return;
  item._coMobileTab='order';item._coErrorFocusLine=item.runResult.line;render();
}
function coWorkspaceStateColumn(item,system){
  const failed=!system&&item.runResult&&!item.runResult.ok;
  const matches=!system?coRunMatchesAnswer(item):null;
  const statusLabel=failed&&item.runResult.line?'Review · Line '+item.runResult.line:(matches?'Match':'Review');
  const status=!system&&matches!==null?h(failed&&item.runResult.line?'button':'span',{
    class:'co-state-status '+(matches?'is-match':'needs-review'),type:failed?'button':null,
    title:failed?'Show the source line that stopped execution':null,
    onclick:failed?()=>coFocusExecutionError(item):null},
    h('i',{class:'fa-solid '+(matches?'fa-check':'fa-magnifying-glass'),'aria-hidden':'true'}),statusLabel):null;
  return h('section',{class:'co-workspace-state '+(system?'system-state':'student-state')},
    h('h4',{class:'co-workspace-state-title'},
      h('i',{class:'fa-solid '+(system?'fa-calculator':'fa-user'),'aria-hidden':'true'}),
      h('span',{class:'co-workspace-state-label'},system?'System answer key':'Your run'),status),
    h('div',{class:'co-workspace-context'},coWorkspaceMemoryPanel(item,system),coWorkspaceOutputPanel(item,system)));
}
function coExecutionErrorStrip(item){
  const failure=item.runResult&&!item.runResult.ok?item.runResult:null;
  if(!failure)return null;
  return h('button',{class:'co-execution-error-strip',type:'button',onclick:()=>coFocusExecutionError(item)},
    h('i',{class:'fa-solid fa-triangle-exclamation','aria-hidden':'true'}),
    h('span',{class:'co-execution-error-line'},failure.line?'Line '+failure.line:'Execution stopped'),
    h('span',{class:'co-execution-error-message'},failure.message),
    failure.line?h('span',{class:'co-execution-error-action'},'View line ',h('i',{class:'fa-solid fa-arrow-right','aria-hidden':'true'})):null);
}
function coFeedbackColumn(item,system){
  const expected=item.answerKey,hasRun=!!item.runResult;
  const actual=hasRun&&item.runResult.answer||{output:'',variables:[]};
  const actualMap=new Map(actual.variables.map(v=>[v.name,v])),memory=h('div',{class:'trace-feedback-memory'});
  expected.variables.forEach(v=>{const got=actualMap.get(v.name),value=system?v.expected:got&&got.expected;
    const mismatch=hasRun&&(!got||!traceFeedbackValuesEqual(got.expected,v.expected));
    memory.appendChild(traceProgramFeedbackValueCard({name:v.name,dataType:v.dataType,value:v.expected},
      value===undefined?null:{value,initialized:true,dataType:v.dataType},mismatch));});
  if(!expected.variables.length)memory.appendChild(h('span',{class:'trace-feedback-empty'},'No mutable variables'));
  const student=coScreen(actual.output),answer=coScreen(expected.output),screen=system?answer:student;
  const screenMismatch=hasRun&&student!==answer;
  const screenNodes=!hasRun?(system?[screen||'No output']:['Run the ordered program to see its screen state.'])
    :(screen||screenMismatch?traceFeedbackScreenDiffNodes(student,answer,system):['No output']);
  return h('section',{class:'trace-feedback-state '+(system?'system-state':'student-state')},
    h('h4',{class:'trace-feedback-state-title'},h('i',{class:'fa-solid '+(system?'fa-calculator':'fa-user'),'aria-hidden':'true'}),
      system?'System answer key':'Your run'),
    !system&&hasRun&&!item.runResult.ok?h('div',{class:'co-state-error',role:'status'},
      h('i',{class:'fa-solid fa-triangle-exclamation','aria-hidden':'true'}),
      h('span',{},(item.runResult.line?'Line '+item.runResult.line+': ':'')+item.runResult.message)):null,
    h('div',{class:'trace-feedback-state-section'},h('div',{class:'trace-feedback-section-label'},'Variable state'),memory),
    h('div',{class:'trace-feedback-state-section'},h('div',{class:'trace-feedback-section-label'},'Screen state'),
      h('pre',{class:'trace-feedback-screen'+(!screen&&!screenMismatch?' is-empty':'')+(screenMismatch?' has-differences':'')},...screenNodes)));
}
function coFeedback(item){
  const root=h('div',{class:'so-feedback'}),r=item.result,run=item.runResult;
  root.appendChild(h('div',{class:'feedback '+(item.wasCorrectFinal?'correct':'incorrect')},
    h('div',{class:'feedback-head'},h('i',{class:'fa-solid '+(item.wasCorrectFinal?'fa-circle-check':'fa-circle-xmark'),'aria-hidden':'true'}),
      item.wasCorrectFinal?' Correct':' Review needed'),
    h('div',{class:'feedback-body'},item.wasCorrectFinal?'The ordered program produced the required final state.'
      :run&&run.ok?'Compare both program states below.':'Execution stopped before a complete final state was produced.'),
    h('div',{class:'feedback-stats'},h('div',{class:'stat'},h('div',{class:'sv'},r.correct+'/'+r.total),h('div',{class:'sl'},'state checks')),
      h('div',{class:'stat'},h('div',{class:'sv'},Math.round(item.itemScore*100)+'%'),h('div',{class:'sl'},'item score')))));
  if(run&&!run.ok)root.appendChild(h('section',{class:'trace-feedback-execution-review'},h('div',{class:'trace-feedback-comparison-title'},'Execution review'),
    h('div',{class:'trace-feedback-issue order'},h('div',{class:'trace-feedback-issue-line'},'Line '+(run.line||'?')),
      h('div',{class:'trace-feedback-issue-message'},run.message))));
  root.appendChild(h('section',{class:'trace-feedback-comparison'},h('div',{class:'trace-feedback-comparison-title'},'Program state comparison'),
    h('div',{class:'trace-feedback-comparison-grid'},coFeedbackColumn(item,false),coFeedbackColumn(item,true))));return root;
}
function coSyncFeedback(item){
  const show=item.checked&&(state.mode==='practice'||state.examExpired&&activeExamPolicy().feedbackRelease==='after-timeout');
  if(!show){clearFeedbackDrawerContent();hideFeedbackDrawerTab();closeFeedbackDrawer();return;}
  const first=!item._feedbackAnimated,content=coFeedback(item);item._feedbackAnimated=true;setFeedbackDrawerTitle('Feedback');
  setFeedbackDrawerContent(content);
  if(typeof renderItemCelebration==='function')try{const celebration=renderItemCelebration(item,content);if(celebration)content.appendChild(celebration);}catch(e){}
  showFeedbackDrawerTab();setFeedbackDrawerStatus(item.wasCorrectFinal);if(first)openFeedbackDrawer();
}
function coClearDragVisuals(root){
  const host=root&&root.closest?root.closest('.co-order-list'):document.querySelector('.co-order-list');
  if(!host)return;host.classList.remove('is-reordering');
  host.querySelectorAll('.co-order-line').forEach(row=>row.classList.remove('is-dragging','drop-before','drop-after'));
}
function coSourceViewportRowKey(row,index){
  return row&&row.dataset&&(row.dataset.lineId||'source-line-'+row.dataset.sourceLine)||'source-row-'+index;
}
function coCaptureSourceViewport(){
  if(typeof document==='undefined')return null;
  const scaffold=document.querySelector('.code-ordering-workspace .co-source-scaffold');if(!scaffold)return null;
  const rows=[...scaffold.querySelectorAll('.co-order-line')];
  return {scrollTop:scaffold.scrollTop||0,scrollLeft:scaffold.scrollLeft||0,
    lineScrolls:new Map(rows.map((row,index)=>{
      const code=row.querySelector('.co-order-code');
      return [coSourceViewportRowKey(row,index),code?code.scrollLeft||0:0];
    }))};
}
function coRevealSourceRow(scaffold,row){
  if(!scaffold||!row)return;
  const viewport=scaffold.getBoundingClientRect(),bounds=row.getBoundingClientRect();
  if(bounds.top<viewport.top)scaffold.scrollTop-=viewport.top-bounds.top;
  else if(bounds.bottom>viewport.bottom)scaffold.scrollTop+=bounds.bottom-viewport.bottom;
}
function coRestoreSourceViewport(item,flow){
  const pending=coPendingSourceViewport;
  if(!pending||pending.item!==item)return;
  coPendingSourceViewport=null;
  if(!pending.viewport||typeof requestAnimationFrame!=='function')return;
  requestAnimationFrame(()=>{
    if(!flow.isConnected)return;
    const scaffold=flow.querySelector('.co-source-scaffold');if(!scaffold)return;
    const viewport=pending.viewport;
    scaffold.scrollTop=viewport.scrollTop;scaffold.scrollLeft=viewport.scrollLeft;
    [...scaffold.querySelectorAll('.co-order-line')].forEach((row,index)=>{
      const saved=viewport.lineScrolls.get(coSourceViewportRowKey(row,index));
      const code=row.querySelector('.co-order-code');if(code&&saved!==undefined)code.scrollLeft=saved;
    });
    if(pending.revealCurrent)coRevealSourceRow(scaffold,scaffold.querySelector('.co-order-line.is-playback-current'));
  });
}
function coCaptureLineLayout(){
  if(typeof document==='undefined')return null;
  const viewport=coCaptureSourceViewport();
  const rows=document.querySelectorAll('.code-ordering-workspace .co-order-line[data-line-id]');
  if(!rows.length)return null;
  return {scrollTop:viewport?viewport.scrollTop:0,scrollLeft:viewport?viewport.scrollLeft:0,
    positions:new Map([...rows].map(row=>{
      const box=row.getBoundingClientRect();return [row.dataset.lineId,{top:box.top,left:box.left}];
    }))};
}
function coAnimateLineSwitch(snapshot,movedId){
  if(!snapshot||typeof document==='undefined')return;
  const scaffold=document.querySelector('.code-ordering-workspace .co-source-scaffold');
  if(scaffold){scaffold.scrollTop=snapshot.scrollTop;scaffold.scrollLeft=snapshot.scrollLeft||0;}
  const reduced=typeof window!=='undefined'&&window.matchMedia
    &&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced||typeof requestAnimationFrame!=='function')return;
  requestAnimationFrame(()=>{
    document.querySelectorAll('.code-ordering-workspace .co-order-line[data-line-id]').forEach(row=>{
      const before=snapshot.positions.get(row.dataset.lineId);if(!before)return;
      const after=row.getBoundingClientRect(),x=before.left-after.left,y=before.top-after.top;
      if(Math.abs(x)<.5&&Math.abs(y)<.5)return;
      const primary=row.dataset.lineId===movedId;
      row.classList.add(primary?'is-active-move':'is-displaced-move');
      if(typeof row.animate!=='function')return;
      const distance=Math.hypot(x,y),duration=Math.min(primary?480:340,(primary?230:180)+distance*.38);
      const animation=row.animate([{transform:'translate('+x+'px,'+y+'px)'},{transform:'translate(0,0)'}],
        {duration,easing:'cubic-bezier(.22,.78,.24,1)'});
      animation.addEventListener('finish',()=>row.classList.remove(primary?'is-active-move':'is-displaced-move'),{once:true});
      animation.addEventListener('cancel',()=>row.classList.remove(primary?'is-active-move':'is-displaced-move'),{once:true});
    });
  });
}
function coDo(item,action){
  const moving=action&&action.type==='MOVE',movedId=moving?item.order[action.from]:null;
  const viewport=coCaptureSourceViewport(),layout=moving?coCaptureLineLayout():null;
  const result=applyActivityAction(item,action);
  if(result.applied){
    if(movedId&&action.focus){item._coFocusId=movedId;item._coFocusMove=action.focus;}
    if(action.type!=='PLAYBACK_TICK')saveSessionProgress();
    coPendingSourceViewport={item,viewport,revealCurrent:/^PLAYBACK_(?:PLAY|NEXT|TICK|PREV)$/.test(action.type||'')};
    render();if(movedId)coAnimateLineSwitch(layout,movedId);
  }
}
function coLineHasExecutionError(item,lineNumber){
  return !!(item.runResult&&!item.runResult.ok&&item.runResult.line===lineNumber);
}
function coLineIsPlaybackCurrent(item,lineNumber){
  const frame=coCurrentPlaybackFrame(item);return !!(frame&&lineNumber>=frame.line&&lineNumber<=(frame.endLine||frame.line));
}
function coLineErrorMarker(){
  return h('i',{class:'fa-solid fa-triangle-exclamation co-line-error-marker','aria-hidden':'true',title:'Execution stopped on this line'});
}
function coFixed(text,n,item){
  const blank=!text.trim(),invalid=coLineHasExecutionError(item,n),current=coLineIsPlaybackCurrent(item,n);
  const frame=current?coCurrentPlaybackFrame(item):null;
  return h('div',{class:'co-order-line co-fixed-line'+(blank?' is-blank':'')+(invalid?' has-execution-error':'')+(current?' is-playback-current':''),
    role:'listitem','data-source-line':String(n),'data-terminal-emitter':frame?frame.statementId:null,tabindex:invalid?'-1':null},
    h('span',{class:'co-order-number','aria-label':'Line '+n},String(n)),
    h('code',{class:'co-order-code'},...soSourceFragments(text,item.language)),
    h('span',{class:'co-line-actions '+(invalid?'co-fixed-error-actions':'co-line-actions-placeholder'),'aria-hidden':'true'},
      invalid?coLineErrorMarker():null));
}
function coDragStart(event,index){
  if(event.target.closest&&event.target.closest('.co-line-actions')){event.preventDefault();return;}
  const row=event.currentTarget.closest('.co-order-line');
  event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));
  if(row&&event.dataTransfer.setDragImage)event.dataTransfer.setDragImage(row,24,row.offsetHeight/2);
  requestAnimationFrame(()=>{if(row){row.classList.add('is-dragging');row.closest('.co-order-list').classList.add('is-reordering');}});
}
function coDragOver(event){
  event.preventDefault();event.dataTransfer.dropEffect='move';
  const row=event.currentTarget,list=row.closest('.co-order-list'),box=row.getBoundingClientRect();
  list.querySelectorAll('.co-order-line').forEach(candidate=>candidate.classList.remove('drop-before','drop-after'));
  row.classList.add(event.clientY<box.top+box.height/2?'drop-before':'drop-after');
}
function coDropIndex(length,from,index,after){
  let insertion=index+(after?1:0);if(from<insertion)insertion--;
  return Math.max(0,Math.min(length-1,insertion));
}
function coDrop(item,event,index){
  event.preventDefault();const row=event.currentTarget,from=Number(event.dataTransfer.getData('text/plain'));
  const after=row.classList.contains('drop-after');coClearDragVisuals(row);
  if(!Number.isInteger(from))return;
  const to=coDropIndex(item.order.length,from,index,after);
  coDo(item,{type:'MOVE',from,to});
}
function coCard(item,line,index,lineNumber){
  const locked=item.checked||state.examExpired,invalid=coLineHasExecutionError(item,lineNumber),current=coLineIsPlaybackCurrent(item,lineNumber);
  const move=(to,direction)=>()=>coDo(item,{type:'MOVE',from:index,to,focus:direction});
  const frame=current?coCurrentPlaybackFrame(item):null;
  return h('div',{class:'co-order-line is-draggable'+(line.whitespace?' is-blank':'')+(invalid?' has-execution-error':'')+(current?' is-playback-current':''),'data-line-id':line.id,'data-source-line':String(lineNumber),
    'data-terminal-emitter':frame?frame.statementId:null,role:'listitem',
    draggable:locked?'false':'true',tabindex:invalid?'-1':null,
    title:invalid?'Execution stopped on this line':(locked?'':(line.whitespace?'Drag to move this blank line':'Drag to move this statement')),
    ondragstart:event=>coDragStart(event,index),ondragend:event=>coClearDragVisuals(event.currentTarget),
    ondragover:event=>coDragOver(event),ondrop:event=>coDrop(item,event,index)},
    h('span',{class:'co-order-number','aria-label':'Line '+lineNumber},String(lineNumber)),
    h('code',{class:'co-order-code'},...soSourceFragments(line.text,item.language)),
    h('span',{class:'co-line-actions'},
      invalid?coLineErrorMarker():null,
      h('button',{type:'button','data-move':'up',disabled:locked||index===0,onclick:move(index-1,'up'),
        title:'Move statement up','aria-label':'Move statement at position '+(index+1)+' up'},
        h('i',{class:'fa-solid fa-chevron-up','aria-hidden':'true'})),
      h('button',{type:'button','data-move':'down',disabled:locked||index===item.order.length-1,onclick:move(index+1,'down'),
        title:'Move statement down','aria-label':'Move statement at position '+(index+1)+' down'},
        h('i',{class:'fa-solid fa-chevron-down','aria-hidden':'true'}))));
}
function coSourceRows(item){
  const byId=new Map(item.orderLines.map(line=>[line.id,line]));
  const orderedSlots=new Map(item.orderLines.map((slot,index)=>[slot.slotLine,{id:item.order[index],index}]));
  return item.source.split('\n').map((text,index)=>{
    const lineNumber=index+1,ordered=orderedSlots.get(lineNumber);
    return ordered?{lineNumber,orderIndex:ordered.index,line:byId.get(ordered.id)}:{lineNumber,text};
  });
}
function coOrderingPanel(item){
  const rows=coSourceRows(item).map(row=>row.line
    ?coCard(item,row.line,row.orderIndex,row.lineNumber):coFixed(row.text,row.lineNumber,item));
  return h('section',{class:'co-source-panel'},
    h('div',{class:'so-panel-heading'},h('i',{class:'fa-solid fa-code'}),item.filename),
    h('p',{class:'co-order-hint',id:'co-order-help'},
      h('i',{class:'fa-solid fa-hand-pointer','aria-hidden':'true'}),' Drag any statement or blank line, or use the arrow buttons.'),
    h('div',{class:'co-source-scaffold'},
      h('div',{class:'co-order-list',role:'list','aria-describedby':'co-order-help'},...rows)));
}
const CO_MOBILE_TABS=['order','run','answer'];
function coSelectMobileTab(item,tab){
  if(!CO_MOBILE_TABS.includes(tab))return;item._coMobileTab=tab;item._coTabFocus=tab;render();
}
function coMobileTabButton(item,id,label,icon){
  const active=(item._coMobileTab||'order')===id;
  const runMatch=id==='run'?coRunMatchesAnswer(item):null;
  const status=runMatch===null?'':(runMatch?' has-match':' has-review');
  return h('button',{class:'co-mobile-tab'+(active?' is-active':'')+status,type:'button',role:'tab',
    id:'co-tab-'+id,'data-co-tab':id,'aria-controls':'co-pane-'+id,'aria-selected':String(active),tabindex:active?'0':'-1',
    onclick:()=>coSelectMobileTab(item,id),onkeydown:event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();
      const index=CO_MOBILE_TABS.indexOf(id),step=event.key==='ArrowRight'?1:-1;
      coSelectMobileTab(item,CO_MOBILE_TABS[(index+step+CO_MOBILE_TABS.length)%CO_MOBILE_TABS.length]);
    }},h('i',{class:'fa-solid '+icon,'aria-hidden':'true'}),h('span',{},label),
    id==='run'&&item.runResult?h('span',{class:'co-tab-status','aria-hidden':'true'}):null);
}
function coMainWorkspace(item){
  const active=item._coMobileTab||'order';
  const tabs=h('div',{class:'co-mobile-tabs',role:'tablist','aria-label':'Ordering activity views'},
    coMobileTabButton(item,'order','Order code','fa-code'),
    coMobileTabButton(item,'run','Your run','fa-user'),
    coMobileTabButton(item,'answer','Answer key','fa-calculator'));
  const pane=(id,content)=>h('div',{class:'co-main-pane co-'+id+'-pane'+(active===id?' is-active':''),
    id:'co-pane-'+id,role:'tabpanel','aria-labelledby':'co-tab-'+id},content);
  const grid=h('div',{class:'co-main-grid'},pane('order',coOrderingPanel(item)),
    pane('run',coWorkspaceStateColumn(item,false)),pane('answer',coWorkspaceStateColumn(item,true)));
  return h('div',{class:'co-main-workspace'},tabs,grid,coExecutionErrorStrip(item));
}
function coPlaybackControlButton(item,action,icon,label,disabled,active){
  return h('button',{class:'co-playback-button'+(active?' is-active':''),type:'button',disabled:!!disabled,
    title:label,'aria-label':label,onclick:()=>coDo(item,{type:action})},
    h('i',{class:'fa-solid '+icon,'aria-hidden':'true'}),h('span',{},label));
}
function coPlaybackControls(item){
  const playback=item._coPlayback,index=playback?playback.index:0,total=playback?playback.frames.length:0;
  const playing=!!(playback&&playback.playing),speed=playback?playback.speed:(item._coPlaybackSpeed==null?.6:item._coPlaybackSpeed);
  return h('div',{class:'co-playback-controls','aria-label':'Program playback controls'},
    h('div',{class:'co-playback-transport'},
      coPlaybackControlButton(item,'PLAYBACK_PREV','fa-backward-step','Previous',index<=0),
      coPlaybackControlButton(item,'PLAYBACK_PLAY',playing?'fa-pause':'fa-play',playing?'Pause':'Play',false,playing),
      coPlaybackControlButton(item,'PLAYBACK_NEXT','fa-forward-step','Next',!!playback&&index>=total),
      coPlaybackControlButton(item,'PLAYBACK_STOP','fa-stop','Stop',!playing),
      coPlaybackControlButton(item,'PLAYBACK_RESTART','fa-rotate-left','Restart',index<=0)),
    h('span',{class:'co-playback-progress','aria-live':'polite'},playback?index+' / '+total:'Ready'),
    h('label',{class:'co-playback-speed'},
      h('span',{},'Step delay ',h('strong',{},Number(speed).toFixed(1)+'s')),
      h('input',{type:'range',min:'0',max:'1',step:'0.2',value:String(speed),
        'aria-label':'Playback step delay in seconds',
        onchange:event=>coDo(item,{type:'PLAYBACK_SPEED',value:event.target.value})})));
}
function coSchedulePlayback(item){
  if(coPlaybackTimer!==null){clearTimeout(coPlaybackTimer);coPlaybackTimer=null;}
  const playback=item&&item._coPlayback;
  if(!playback||!playback.playing||playback.speed<=0||item.checked)return;
  const advance=()=>{
    coPlaybackTimer=null;
    if(item.checked||!item._coPlayback||!item._coPlayback.playing)return;
    if(typeof currentItem==='function'&&currentItem()!==item)return;
    if(typeof programTerminalInteractionLocked==='function'&&programTerminalInteractionLocked()){
      coPlaybackTimer=setTimeout(advance,40);return;
    }
    coDo(item,{type:'PLAYBACK_TICK'});
  };
  coPlaybackTimer=setTimeout(advance,playback.speed*1000);
}
function coRectCanAnimate(rect){return !!(rect&&rect.width>0&&rect.height>0);}
function coPlaybackMemoryCard(flow,name){
  return [...flow.querySelectorAll('.student-state [data-co-memory-name]')]
    .find(row=>row.dataset.coMemoryName===name)||null;
}
function coRunPlaybackTrail(origin,destination,color,duration){
  if(!origin||!destination||typeof runVarFinalComet!=='function')return;
  const originRect=origin.getBoundingClientRect(),destinationRect=destination.getBoundingClientRect();
  if(!coRectCanAnimate(originRect)||!coRectCanAnimate(destinationRect))return;
  runVarFinalComet(originRect,destinationRect,color,null,duration);
}
function coSchedulePlaybackTrail(item,flow){
  const pending=item&&item._coPlaybackTrail,playback=item&&item._coPlayback;
  if(!pending||!playback||playback.speed<=0)return;
  delete item._coPlaybackTrail;
  const frame=playback.frames[pending.index-1];if(!frame)return;
  requestAnimationFrame(()=>{
    if(!flow.isConnected||pending.token!==item._coPlaybackTrailToken)return;
    const source=flow.querySelector('.co-order-line[data-source-line="'+frame.line+'"]');if(!source)return;
    const stepMs=Math.max(100,playback.speed*1000),readMs=Math.max(80,stepMs*.44);
    frame.reads.forEach(name=>{
      const memory=coPlaybackMemoryCard(flow,name),color=typeof bindingIdentityColor==='function'
        ?bindingIdentityColor(name,'variable'):'#6fb7ff';
      coRunPlaybackTrail(memory,source,color,readMs);
    });
    const send=()=>{
      if(!flow.isConnected||pending.token!==item._coPlaybackTrailToken)return;
      frame.writes.forEach(name=>{
        const memory=coPlaybackMemoryCard(flow,name),color=typeof bindingIdentityColor==='function'
          ?bindingIdentityColor(name,'variable'):'#ffa35c';
        coRunPlaybackTrail(source,memory,color,Math.max(80,stepMs*.5));
      });
      if(frame.consoleActive&&!frame.printedText){
        const consolePanel=flow.querySelector('.student-state .program-output-screen');
        coRunPlaybackTrail(source,consolePanel,'#67e8c1',Math.max(80,stepMs*.5));
      }
    };
    if(frame.reads.length)setTimeout(send,Math.max(40,stepMs*.42));else send();
  });
}
function coRender({container,item,profile}){
  coEnsureCanonicalAnswerOutput(item);
  coEnsureWhitespaceCandidates(item);
  if(!item.checked&&item._coPlayback&&!coPlaybackMatchesArrangement(item,item._coPlayback))coDiscardPlayback(item);
  const flow=renderProgramWorkspaceShell(container,item,{statements:item.order.map(()=>({status:item.checked?'complete':'waiting'})),
    cursor:0,status:item.checked?'complete':'running',progressMode:'completion'});
  flow.parentNode.classList.add('code-ordering-workspace');
  flow.appendChild(h('div',{class:'so-instruction'},h('i',{class:'fa-solid fa-circle-info'}),profile.activity.instructions));
  flow.appendChild(coMainWorkspace(item));
  coRestoreSourceViewport(item,flow);
  coSchedulePlaybackTrail(item,flow);

  const tabFocus=item._coTabFocus;delete item._coTabFocus;
  if(tabFocus&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{
    const tab=flow.querySelector('[data-co-tab="'+tabFocus+'"]');if(tab)tab.focus({preventScroll:true});
  });
  const errorLine=item._coErrorFocusLine;delete item._coErrorFocusLine;
  if(errorLine&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{
    const row=flow.querySelector('.co-order-line[data-source-line="'+errorLine+'"]');
    if(row){row.scrollIntoView({block:'center',behavior:'smooth'});row.focus({preventScroll:true});}
  });
  const focusId=item._coFocusId,focusMove=item._coFocusMove;delete item._coFocusId;delete item._coFocusMove;
  if(focusId&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{
    const card=flow.querySelector('.co-order-line[data-line-id="'+focusId+'"]');
    const button=card&&(card.querySelector('.co-line-actions button[data-move="'+focusMove+'"]:not(:disabled)')
      ||card.querySelector('.co-line-actions button:not(:disabled)'));if(button)button.focus({preventScroll:true});
  });
  if(!item.checked&&!state.examExpired){
    flow.appendChild(coPlaybackControls(item));
    const controls=h('div',{class:'so-controls'});
    if(state.mode==='practice')controls.appendChild(h('button',{class:'item-reset-button',type:'button',
      disabled:coEqual(item.order,item.initialOrder)&&!item.runResult&&!(item._coPlayback&&item._coPlayback.index),
      onclick:handleReset},'Reset item'));
    controls.appendChild(renderInlineEvaluationActions({canCheck:true}));flow.appendChild(controls);
  }else if(state.mode==='practice')appendPracticeRetryBar(container);
  coSchedulePlayback(item);coSyncFeedback(item);
}
function coValidate(profile){
  const g=profile.activity&&profile.activity.generator;if(!g||!g.library||!g.exerciseSet)throw new Error(profile.id+': missing code-ordering source');
  soPathSlug(g.library,profile.id+': library');soPathSlug(g.exerciseSet,profile.id+': exerciseSet');
  if(profile.itemCount!=='manifest'||profile.pointsPerItem!=='generated-answer')throw new Error(profile.id+': invalid code-ordering scoring');
  if(profileVariableValueMode(profile)!=='seeded'||profileInputValueMode(profile)!=='seeded')throw new Error(profile.id+': code ordering requires seeded values');
}
async function coLoad(){
  const profiles=PROFILES.filter(p=>profileIsEnabled(p)&&p.activity&&p.activity.kind==='code-ordering');
  const unique=new Map(profiles.map(p=>[soManifestUrl(p,state.language),p]));
  await Promise.all([...unique.values()].map(p=>soFetchExerciseBank(p,state.language)));
}
registerActivityPlugin({id:'code-ordering',manifest:CODE_ORDERING_MANIFEST,loadContent:coLoad,
  itemCount({profile,language}){return soCatalog(profile,language).length;},maxPoints({item}){return coTotal(item.answerKey);},
  validateProfile:coValidate,generateItem:coGenerateItem,render:coRender,applyAction:coApplyAction,check:coCheck,
  reset:coReset,retry:coRetry,buildFeedback:coFeedback,hasAttempt({item}){return !!(item&&(item.runResult
    ||item._coPlayback&&item._coPlayback.index||!coEqual(item.order,item.initialOrder)));}});
