let programInputPlaybackTimer=null;
let programInputTransferTimers=[];
let programInputMemoryWriteInProgress=false;

function programInputSource(statement){
  if(statement.sourceText) return statement.sourceText.trim();
  if(statement.inputSyntax==='c') return `scanf("${statement.format}", ${statement.reads.map(read=>`&${read.target}`).join(', ')});`;
  const read=statement.reads[0];
  return `${read.target} = ${statement.readerName}.nextInt();`;
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
  const code=h('code',{class:'program-input-code'});
  if(statement.inputSyntax==='c'){
    code.appendChild(programInputAction('scanf','input-command tok tok-op-active',interactive&&!runtime.started?()=>{
      if(typeof setProgramContextTab==='function') setProgramContextTab('output');
      handleTokenClick({type:'start-input',statementId:statement.id});
    }:null,{'data-input-command-source':statement.id,title:'Begin the input operation'}));
    code.appendChild(h('span',{class:'program-input-punctuation'},'("'));
    let conversionIndex=0;
    String(statement.format).split(/(%[di])/).filter(Boolean).forEach(part=>{
      if(/^%[di]$/.test(part)){
        const partIndex=conversionIndex++;
        code.appendChild(runtime.submitted?programInputTransferredValue(statement,partIndex,runtime)
          :programInputAction(part,'input-conversion tok tok-static',null,
            {'data-input-conversion-id':programInputResultId(statement,partIndex)}));
      }else code.appendChild(h('span',{class:'program-input-format-text'},part));
    });
    code.appendChild(h('span',{class:'program-input-punctuation'},'"'));
    statement.reads.forEach((entry,partIndex)=>{
      const state=runtime.reads[partIndex],active=interactive&&runtime.transferComplete&&partIndex===index&&state.converted&&!state.written;
      code.appendChild(h('span',{class:'program-input-punctuation'},', '));
      code.appendChild(programInputAction(`&${entry.target}`,'input-address binding-identity tok tok-var',active?(event=>{
        programInputWriteToMemory(statement,partIndex,event.currentTarget);
      }):null,{style:bindingIdentityStyle(entry.target,'variable'),'data-token-id':`input-destination-${statement.id}-${partIndex}`,
        title:active?`Write the converted value to ${entry.target}`:null}));
    });
    code.appendChild(h('span',{class:'program-input-punctuation'},');'));
  }else{
    const call=`${statement.readerName}.nextInt()`;
    const start=interactive&&!runtime.started;
    const canWrite=interactive&&runtime.transferComplete&&readState.converted&&!readState.written;
    code.appendChild(programInputAction(read.target,'input-destination binding-identity tok tok-var',canWrite?(event=>{
      programInputWriteToMemory(statement,index,event.currentTarget);
    }):null,{style:bindingIdentityStyle(read.target,'variable'),title:canWrite?`Write the submitted value to ${read.target}`:null}));
    code.appendChild(h('span',{class:'program-input-punctuation'},' = '));
    if(runtime.submitted) code.appendChild(programInputTransferredValue(statement,index,runtime));
    else code.appendChild(programInputAction(call,'input-command input-conversion tok tok-op-active',start?()=>{
      if(typeof setProgramContextTab==='function') setProgramContextTab('output');
      handleTokenClick({type:'start-input',statementId:statement.id});
    }:null,
    {'data-input-command-source':statement.id,'data-input-conversion-id':programInputResultId(statement,index),
      title:start?'Begin the input operation':null}));
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
      interactive:latest&&isActive}));
    if(latest&&isActive){
      const actions=renderInlineEvaluationActions({canUndo:canUndoForCurrentMode(item)&&statement.runtime.history.length>1});
      if(actions)code.appendChild(actions);
    }
    const row=h('div',{class:`tl-row ${index===0?'source-row ':''}${latest&&isActive?'current':'done'}`},
      h('div',{class:`tl-dot${index===0?' statement-source-dot':''}`,
        style:index===0?'':`background:${stepVisualColor(last||{},index-1)};`},
      index===0?String(programStatementDisplayNumber(statement,statementIndex)):null),code);
    timeline.appendChild(row);
  });
  const panel=h('div',{class:'program-expression-panel program-input-eval-panel expression-scroll-surface',
    'data-statement-id':statement.id},timeline);
  if(isActive&&!statement.runtime.started) panel.appendChild(renderContextHelp('Click the input command to begin the console input flow.'));
  else if(isActive&&!statement.runtime.submitted) panel.appendChild(renderContextHelp('Watch the virtual keyboard, then press Enter to submit the complete input line.'));
  else if(isActive&&!statement.runtime.transferComplete) panel.appendChild(renderContextHelp('Watch each submitted value travel from the console to its matching placeholder.'));
  else if(isActive&&!statement.runtime.checked) panel.appendChild(renderContextHelp(statement.inputSyntax==='c'
    ?'Click each address expression (such as &x) to write its value to memory.'
    :'Click the destination variable to write the submitted value to memory.'));
  card.appendChild(panel);container.appendChild(card);
  if(isActive&&statement.runtime.submitted&&!statement.runtime.transferComplete)
    requestAnimationFrame(()=>startProgramInputTransfer(statement,panel));
}

function programInputKeyboardKeyLabel(character){return character===' '?'Space':character;}

function renderProgramInputConsoleControls(item,program,panel,pre,surface){
  const statement=program.statements[program.cursor];
  if(!statement||statement.kind!=='input'||!statement.runtime.started||statement.runtime.submitted) return;
  const modal=typeof programStatementTraceOpenFor==='function'&&programStatementTraceOpenFor(item,statement.id);
  if((surface==='modal')!==modal) return;
  const keys=['1','2','3','4','5','6','7','8','9','-','0','.',' ','Enter'];
  const keyboard=h('div',{class:'program-input-keyboard','aria-label':'Numeric input keyboard'});
  const buttons=new Map();
  keys.forEach(key=>{
    const button=h('button',{class:`program-input-key${key==='Enter'?' enter-key':''}${key===' '?' space-key':''}`,
      type:'button',disabled:key==='Enter',tabindex:key==='Enter'?'0':'-1','aria-label':programInputKeyboardKeyLabel(key)},
      key==='Enter'?h('span',{},'Enter ↵'):programInputKeyboardKeyLabel(key));
    buttons.set(key,button);keyboard.appendChild(button);
  });
  const status=h('div',{class:'program-input-keyboard-status',role:'status'},'Program is entering the configured input…');
  panel.appendChild(h('div',{class:'program-input-console-controls'},status,keyboard));
  const enter=buttons.get('Enter');
  enter.onclick=()=>{if(enter.disabled)return;handleTokenClick({type:'submit-input',statementId:statement.id});};
  if(programInputPlaybackTimer){clearTimeout(programInputPlaybackTimer);programInputPlaybackTimer=null;}
  const raw=statement.rawInput,reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index=0;
  const finish=()=>{programInputPlaybackTimer=null;statement.runtime.playbackComplete=true;enter.disabled=false;status.textContent='Input line complete. Press Enter to submit it.';enter.focus&&enter.focus();};
  if(reduced){pre.textContent+=raw;finish();return;}
  const step=()=>{
    if(!panel.isConnected||statement.runtime.submitted)return;
    if(index>=raw.length){finish();return;}
    const character=raw[index++],button=buttons.get(character);
    if(button)button.classList.add('is-pressed');
    pre.textContent+=character;
    programInputPlaybackTimer=setTimeout(()=>{
      if(button)button.classList.remove('is-pressed');
      programInputPlaybackTimer=setTimeout(step,180);
    },240);
  };
  programInputPlaybackTimer=setTimeout(step,260);
}

registerStatementRenderer('input',renderInputStatement);
