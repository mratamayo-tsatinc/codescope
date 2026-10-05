let programInputPlaybackTimer=null;
let programInputTransferTimers=[];
let programInputMemoryWriteInProgress=false;

function programInputSource(statement){
  if(statement.sourceText) return statement.sourceText.trim();
  if(statement.inputSyntax==='c') return `scanf("${statement.format}", ${statement.reads.map(read=>`${read.addressRequired?'&':''}${read.target}`).join(', ')});`;
  const read=statement.reads[0];
  const call=read.conversion==='nextChar'?`${statement.readerName}.next().charAt(0)`
    :`${statement.readerName}.${read.conversion}()`;
  return `${read.target} = ${call};`;
}

function programInputAction(text,className,onclick,attrs){
  if(!onclick) return h('span',Object.assign({class:`program-input-token ${className||''} static`},attrs||{}),text);
  return h('button',Object.assign({class:`program-input-token ${className||''} actionable`,type:'button',onclick},attrs||{}),text);
}

function programInputTransferredValue(statement,index,runtime){
  const read=statement.reads[index],complete=runtime.transferComplete;
  return h('span',{class:`program-input-placeholder-value binding-identity${complete?' is-resolved':' is-waiting'}`,
    style:bindingIdentityStyle(read.target,'variable'),
    'data-input-placeholder-id':`${statement.id}-${index}`,
    'aria-label':complete?`Submitted value ${read.expectedRaw}`:'Waiting for submitted value'},
  complete?read.expectedRaw:h('span',{class:'program-input-placeholder-spinner','aria-hidden':'true'}));
}

function programInputLatestPlaceholder(panel,statement,index){
  const matches=panel&&panel.querySelectorAll
    ?panel.querySelectorAll(`[data-input-placeholder-id="${statement.id}-${index}"]`):[];
  return matches.length?matches[matches.length-1]:null;
}

function programInputMemoryDestination(target){
  return document.querySelector(`#statementTraceModal .statement-trace-memory [data-token-id="vff-${target}"]`)
    ||document.querySelector(`.program-memory-dock [data-token-id="vff-${target}"]`)
    ||document.querySelector(`.var-final-float [data-token-id="vff-${target}"]`);
}

function programInputWriteToMemory(statement,index,button,attempt=0){
  if(programInputMemoryWriteInProgress)return;
  const read=statement.reads[index],panel=button&&button.closest&&button.closest('.program-input-eval-panel');
  if(typeof setProgramContextTab==='function')setProgramContextTab('memory');
  const source=programInputLatestPlaceholder(panel,statement,index);
  const destination=programInputMemoryDestination(read.target);
  if((!source||!destination)&&attempt<4){
    requestAnimationFrame(()=>programInputWriteToMemory(statement,index,button,attempt+1));return;
  }
  const commit=()=>handleTokenClick({type:'write-input',statementId:statement.id,readIndex:index});
  if(!source||!destination||typeof runVarFinalComet!=='function'){commit();return;}
  programInputMemoryWriteInProgress=true;
  button.disabled=true;button.setAttribute('aria-busy','true');button.classList.add('is-transferring');
  const oldBody=destination.querySelector('.tok-card-body');
  const oldValue=oldBody?oldBody.textContent:'—';
  runVarFinalComet(source.getBoundingClientRect(),destination.getBoundingClientRect(),
    bindingIdentityColor(read.target,'variable'),()=>{
      commit();
      requestAnimationFrame(()=>{
        const landed=programInputMemoryDestination(read.target);
        if(landed&&typeof rollVarFinalCardValue==='function'){
          const body=landed.querySelector('.tok-card-body');
          if(body)body.textContent=oldValue;
          rollVarFinalCardValue(landed,read.expectedValue,()=>{programInputMemoryWriteInProgress=false;},'',read.dataType);
        }else programInputMemoryWriteInProgress=false;
      });
    });
}

function renderProgramInputState(statement,item,options){
  options=options||{};
  const runtime=options.runtime||statement.runtime,index=runtime.currentReadIndex,read=statement.reads[index],readState=runtime.reads[index];
  const interactive=!!options.interactive&&!item.checked&&!examInteractionLocked();
  const commandDone=runtime.started||!!options.progressed;
  const code=h('code',{class:'program-input-code'});
  if(statement.inputSyntax==='c'){
    const canStart=interactive&&!runtime.started;
    code.appendChild(programInputAction('scanf',`input-command tok ${commandDone?'tok-static':canStart?'tok-op-active':'tok-op-muted tok-static'}`,canStart?()=>{
      if(typeof setProgramContextTab==='function') setProgramContextTab('output');
      handleTokenClick({type:'start-input',statementId:statement.id});
    }:null,{'data-input-command-source':statement.id,
      title:commandDone?'Input command evaluated':'Begin the input operation'}));
    code.appendChild(h('span',{class:'program-input-punctuation'},'("'));
    let conversionIndex=0;
    String(statement.format).split(/(%(?:lf|[difcs]))/).filter(Boolean).forEach(part=>{
      if(/^%(?:lf|[difcs])$/.test(part)){
        const partIndex=conversionIndex++;
        code.appendChild(runtime.submitted?programInputTransferredValue(statement,partIndex,runtime)
          :programInputAction(part,'input-conversion tok tok-op-muted tok-static',null,
            {'data-input-conversion-id':programInputResultId(statement,partIndex)}));
      }else code.appendChild(h('span',{class:'program-input-format-text'},part));
    });
    code.appendChild(h('span',{class:'program-input-punctuation'},'"'));
    statement.reads.forEach((entry,partIndex)=>{
      const state=runtime.reads[partIndex],active=interactive&&runtime.transferComplete&&partIndex===index&&state.converted&&!state.written;
      const visualState=state.written?'tok-static binding-identity':active?'tok-var binding-identity':'tok-op-muted tok-static';
      code.appendChild(h('span',{class:'program-input-punctuation'},', '));
      code.appendChild(programInputAction(`${entry.addressRequired?'&':''}${entry.target}`,
        `input-address tok ${visualState}`,active?(event=>{
        programInputWriteToMemory(statement,partIndex,event.currentTarget);
      }):null,{style:state.written||active?bindingIdentityStyle(entry.target,'variable'):null,
        'data-token-id':`input-destination-${statement.id}-${partIndex}`,
        title:state.written?`${entry.target} has been written to memory`
          :active?`Write the converted value to ${entry.target}`:`${entry.target} is waiting`}));
    });
    code.appendChild(h('span',{class:'program-input-punctuation'},');'));
  }else{
    const call=read.conversion==='nextChar'?`${statement.readerName}.next().charAt(0)`
      :`${statement.readerName}.${read.conversion}()`;
    const start=interactive&&!runtime.started;
    const canWrite=interactive&&runtime.transferComplete&&readState.converted&&!readState.written;
    const destinationState=readState.written?'tok-static binding-identity':canWrite?'tok-var binding-identity':'tok-op-muted tok-static';
    code.appendChild(programInputAction(read.target,`input-destination tok ${destinationState}`,canWrite?(event=>{
      programInputWriteToMemory(statement,index,event.currentTarget);
    }):null,{style:readState.written||canWrite?bindingIdentityStyle(read.target,'variable'):null,
      title:readState.written?`${read.target} has been written to memory`
      :canWrite?`Write the submitted value to ${read.target}`:`${read.target} is waiting`}));
    code.appendChild(h('span',{class:'program-input-punctuation'},' = '));
    if(runtime.submitted) code.appendChild(programInputTransferredValue(statement,index,runtime));
    else code.appendChild(programInputAction(call,
      `input-command input-conversion tok ${commandDone?'tok-static':start?'tok-op-active':'tok-op-muted tok-static'}`,start?()=>{
      if(typeof setProgramContextTab==='function') setProgramContextTab('output');
      handleTokenClick({type:'start-input',statementId:statement.id});
    }:null,
    {'data-input-command-source':statement.id,'data-input-conversion-id':programInputResultId(statement,index),
      title:commandDone?'Input command evaluated':start?'Begin the input operation':null}));
    code.appendChild(h('span',{class:'program-input-punctuation'},');'));
  }
  return code;
}

function programInputCompleteTransfer(statement,panel){
  if(!statement.runtime.submitted||statement.runtime.transferComplete)return;
  statement.runtime.transferComplete=true;statement.runtime.transferAnimating=false;
  const latest=statement.runtime.history[statement.runtime.history.length-1];
  if(latest) latest.transferComplete=true;
  if(panel&&panel.isConnected) render();
}

function startProgramInputTransfer(statement,panel,attempt=0){
  const runtime=statement.runtime;
  if(!runtime.submitted||runtime.transferComplete||runtime.transferAnimating)return;
  const sources=statement.reads.map((entry,index)=>document.querySelector(
    `[data-output-surface="modal"] [data-input-console-token="${statement.id}-${index}"]`));
  const destinations=statement.reads.map((entry,index)=>panel.querySelector(
    `[data-input-placeholder-id="${statement.id}-${index}"]`));
  if(sources.some(source=>!source)||destinations.some(destination=>!destination)){
    if(attempt<3) requestAnimationFrame(()=>startProgramInputTransfer(statement,panel,attempt+1));
    return;
  }
  runtime.transferAnimating=true;
  programInputTransferTimers.forEach(timer=>clearTimeout(timer));programInputTransferTimers=[];
  let arrived=0;
  const settle=(index)=>{
    const destination=destinations[index];
    if(destination&&destination.isConnected){destination.textContent=statement.reads[index].expectedRaw;destination.classList.remove('is-waiting');destination.classList.add('is-resolved');}
    arrived++;
    if(arrived===statement.reads.length){
      const timer=setTimeout(()=>programInputCompleteTransfer(statement,panel),260);programInputTransferTimers.push(timer);
    }
  };
  statement.reads.forEach((entry,index)=>{
    const timer=setTimeout(()=>{
      if(!panel.isConnected){runtime.transferAnimating=false;return;}
      if(typeof runVarFinalComet==='function') runVarFinalComet(sources[index].getBoundingClientRect(),
        destinations[index].getBoundingClientRect(),bindingIdentityColor(entry.target,'variable'),()=>settle(index));
      else settle(index);
    },index*240);
    programInputTransferTimers.push(timer);
  });
}

function programInputFinishedConnectorVisuals(panel,statement){
  const paths=[],dots=[];
  if(!panel||!statement||statement.inputSyntax!=='c')return {paths,dots};
  const panelRect=connectorContentRect(panel);
  panel.querySelectorAll('[data-input-written-indices]').forEach(row=>{
    const writtenIndices=String(row.getAttribute('data-input-written-indices')||'').split(',')
      .map(value=>Number(value)).filter(Number.isInteger);
    writtenIndices.forEach((readIndex,laneIndex)=>{
      const read=statement.reads[readIndex];
      const source=row.querySelector(`[data-input-placeholder-id="${statement.id}-${readIndex}"]`);
      const destination=row.querySelector(`[data-token-id="input-destination-${statement.id}-${readIndex}"]`);
      if(!read||!source||!destination)return;
      const sourceRect=source.getBoundingClientRect(),destinationRect=destination.getBoundingClientRect();
      const sourcePoint=connectorLocalPoint(panelRect,sourceRect.left+sourceRect.width/2,sourceRect.bottom);
      const destinationPoint=connectorLocalPoint(panelRect,destinationRect.left+destinationRect.width/2,destinationRect.bottom);
      const laneY=Math.max(sourcePoint.y,destinationPoint.y)+18+(writtenIndices.length-laneIndex-1)*7;
      const color=bindingIdentityColor(read.target,'variable');
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',`M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x} ${laneY}, ${destinationPoint.x} ${laneY}, ${destinationPoint.x} ${destinationPoint.y}`);
      path.setAttribute('stroke',color);path.setAttribute('stroke-width','1.25');path.setAttribute('fill','none');
      path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-dasharray','3 4');
      path.setAttribute('class','connector-line connector-line-past program-input-finished-connector');
      paths.push(path);
      const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx',String(destinationPoint.x));dot.setAttribute('cy',String(destinationPoint.y));
      dot.setAttribute('r','2');dot.setAttribute('fill',color);
      dot.setAttribute('class','connector-anchor-dot connector-line-past program-input-finished-connector-dot');
      dots.push(dot);
    });
  });
  return {paths,dots};
}

function renderInputStatement(ctx){
  const {container,item,program,statement,statementIndex,isActive}=ctx;
  const card=h('section',{class:`program-statement program-input-statement ${statement.status}`,'data-statement-id':statement.id});
  if(!isActive&&statement.status!=='complete'){
    card.appendChild(renderProgramStatementSummary(statement,statementIndex,programInputSource(statement)));container.appendChild(card);return;
  }
  const timeline=h('div',{class:'timeline expression-timeline program-input-timeline'});
  const history=statement.runtime.history.filter((snapshot,index,rows)=>{
    if(index===0||index===rows.length-1)return true;
    const last=snapshot.trace[snapshot.trace.length-1];
    return !last||last.action!=='CALL_INPUT';
  });
  history.forEach((snapshot,index)=>{
    const latest=index===history.length-1,last=snapshot.trace[snapshot.trace.length-1];
    const code=h('div',{class:'code-out program-input-timeline-code'},renderProgramInputState(statement,item,{runtime:snapshot,
      interactive:latest&&isActive,progressed:!latest}));
    if(latest&&isActive){
      const actions=renderInlineEvaluationActions({canUndo:canUndoForCurrentMode(item)&&statement.runtime.history.length>1});
      if(actions)code.appendChild(actions);
    }
    const writtenIndices=statement.inputSyntax==='c'
      ?snapshot.reads.reduce((indices,read,readIndex)=>{if(read.written)indices.push(readIndex);return indices;},[]):[];
    const connected=writtenIndices.length>0;
    const row=h('div',{class:`tl-row ${index===0?'source-row ':''}${latest&&isActive?'current':'done'}${connected?' program-input-connected-row':''}`,
      'data-input-written-indices':connected?writtenIndices.join(','):null,
      style:connected?`--program-input-connector-depth:${25+writtenIndices.length*7}px`:null},
      h('div',{class:`tl-dot${index===0?' statement-source-dot':''}`,
        style:index===0?'':`background:${stepVisualColor(last||{},index-1)};`},
      index===0?String(programStatementDisplayNumber(statement,statementIndex)):null),code);
    timeline.appendChild(row);
  });
  const panel=h('div',{class:'program-expression-panel program-input-eval-panel expression-scroll-surface',
    'data-statement-id':statement.id},timeline);
  if(isActive&&!statement.runtime.started) panel.appendChild(renderContextHelp('Click the input command to begin the console input flow.'));
  else if(isActive&&!statement.runtime.submitted) panel.appendChild(renderContextHelp('Watch the keyboard input indicator, then press Enter to submit the complete input line.'));
  else if(isActive&&!statement.runtime.transferComplete) panel.appendChild(renderContextHelp('Watch each submitted value travel from the console to its matching placeholder.'));
  else if(isActive&&!statement.runtime.checked) panel.appendChild(renderContextHelp(statement.inputSyntax==='c'
    ?'Click each destination expression (such as &x or a string buffer name) to write its value to memory.'
    :'Click the destination variable to write the submitted value to memory.'));
  card.appendChild(panel);container.appendChild(card);
  if(isActive&&statement.runtime.submitted&&!statement.runtime.transferComplete)
    requestAnimationFrame(()=>startProgramInputTransfer(statement,panel));
}

function renderProgramInputConsoleControls(item,program,panel,pre,surface){
  const statement=program.statements[program.cursor];
  if(!statement||statement.kind!=='input'||!statement.runtime.started) return;
  const modal=typeof programStatementTraceOpenFor==='function'&&programStatementTraceOpenFor(item,statement.id);
  if((surface==='modal')!==modal) return;
  const runtime=statement.runtime,submitted=runtime.submitted;
  const indicator=h('div',{class:`program-input-keyboard-indicator${!runtime.playbackComplete&&!submitted?' is-active':''}`,
    'aria-label':'Keyboard input'},h('i',{class:'fa-solid fa-keyboard','aria-hidden':'true'}),h('span',{},'Keyboard input'));
  const enter=h('button',{class:`program-input-enter-key${submitted?' is-pressed':''}`,type:'button',
    disabled:submitted||!runtime.playbackComplete,'aria-pressed':submitted?'true':'false',
    'aria-label':submitted?'Enter pressed':'Press Enter to submit input'},
    h('span',{class:'program-input-enter-label'},'Enter'),h('i',{class:'fa-solid fa-turn-down','aria-hidden':'true'}));
  const status=h('div',{class:'program-input-keyboard-status',role:'status'},submitted
    ?'Input submitted.':runtime.playbackComplete?'Input line complete. Press Enter to submit it.':'Typing the configured input…');
  panel.appendChild(h('div',{class:'program-input-console-controls'},status,
    h('div',{class:'program-input-control-row'},indicator,enter)));
  enter.onclick=()=>{if(!enter.disabled)handleTokenClick({type:'submit-input',statementId:statement.id});};
  if(submitted)return;
  if(programInputPlaybackTimer){clearTimeout(programInputPlaybackTimer);programInputPlaybackTimer=null;}
  const raw=statement.rawInput;
  const paintPreview=typed=>{
    const cursor=panel.querySelector&&panel.querySelector('.program-output-cursor');
    if(cursor&&cursor.parentNode)cursor.parentNode.removeChild(cursor);
    const stream=String(pre._programTerminalStream||'')+typed,state=coreTerminalScreen(stream);
    pre.textContent=state.text;
    if(cursor&&typeof programTerminalPositionCursor==='function')programTerminalPositionCursor(cursor,state,pre);
  };
  const finish=()=>{
    programInputPlaybackTimer=null;if(!panel.isConnected||runtime.submitted)return;
    paintPreview(raw);runtime.playbackComplete=true;indicator.classList.remove('is-active');enter.disabled=false;
    status.textContent='Input line complete. Press Enter to submit it.';
  };
  if(runtime.playbackComplete){paintPreview(raw);enter.disabled=false;indicator.classList.remove('is-active');return;}
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){finish();return;}
  let index=0;
  const typeCharacter=()=>{
    if(!panel.isConnected||runtime.submitted){programInputPlaybackTimer=null;return;}
    if(index>=raw.length){finish();return;}
    index++;paintPreview(raw.slice(0,index));
    programInputPlaybackTimer=setTimeout(typeCharacter,260);
  };
  programInputPlaybackTimer=setTimeout(typeCharacter,400);
}

registerStatementRenderer('input',renderInputStatement);
