const PROGRAM_OUTPUT_SETTINGS=DEFAULT_APP_SETTINGS.shell.outputPanel;
let pendingProgramOutputAnimation=null;
let programOutputAnimationActive=false;
let programOutputAnimationTimer=null;

function programOutputInteractionLocked(){return programOutputAnimationActive;}

function queueProgramOutputAnimation(item,event){
  if(!item||!event||event.type!=='OUTPUT') return;
  pendingProgramOutputAnimation={item,event};
}

function outputEscapeLiteral(value){
  return String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')
    .replace(/\n/g,'\\n').replace(/\t/g,'\\t');
}

function outputStatementSource(statement,item){
  const language=(item&&item.program&&item.program.language)||item.language||state.language;
  const dynamic=programOutputDynamicParts(statement);
  if(language==='c'){
    const format=statement.parts.map(part=>part.kind==='text'?outputEscapeLiteral(part.value):`%${part.format||'d'}`).join('')
      +(statement.newline?'\\n':'');
    const args=dynamic.map(entry=>programOutputPartName(entry.part)).filter(Boolean);
    return `printf("${format}"${args.length?', '+args.join(', '):''});`;
  }
  const pieces=statement.parts.map(part=>part.kind==='text'
    ? `"${outputEscapeLiteral(part.value)}"`
    : programOutputPartName(part)).filter(Boolean);
  const command=statement.newline?'System.out.println':'System.out.print';
  return `${command}(${pieces.join(' + ')});`;
}

function outputActionToken(text,attrs,actionable){
  const base=Object.assign({class:'program-output-token'},attrs||{});
  if(!actionable) return h('span',Object.assign(base,{class:base.class+' static'}),text);
  base.type='button';base.class+=' actionable';
  return h('button',base,text);
}

function programOutputVisualTrace(statement){
  return statement.runtime.trace.filter(step=>step.action==='READ_OUTPUT_VALUE'||step.action==='EVALUATE');
}

function programOutputPartStates(statement,traceCount){
  const states=statement.parts.map(() =>({stagedValue:null,resolvedValue:null}));
  programOutputVisualTrace(statement).slice(0,traceCount).forEach(step=>{
    const part=states[step.partIndex];
    if(!part) return;
    if(step.action==='READ_OUTPUT_VALUE') part.stagedValue=step.sourceValue;
    else if(step.action==='EVALUATE'){
      part.stagedValue=step.result;
      part.resolvedValue=step.result;
    }
  });
  return states;
}

function programOutputCurrentVisualPart(statement,partStates){
  return programOutputDynamicParts(statement).find(entry=>partStates[entry.index].resolvedValue===null)||null;
}

function programOutputVisualText(statement,partStates){
  return statement.parts.map((part,index)=>part.kind==='text'
    ? part.value
    : String(partStates[index].resolvedValue==null?'':partStates[index].resolvedValue)).join('');
}

function programOutputStrictControls(){
  return typeof strictSequenceEnabled==='function'&&strictSequenceEnabled();
}

function programOutputReadActionable(interactive,partState){
  return interactive&&partState.stagedValue===null&&partState.resolvedValue===null;
}

function programOutputResolveActionable(interactive,partState){
  return interactive&&partState.resolvedValue===null
    &&(partState.stagedValue!==null||programOutputStrictControls());
}

function renderProgramOutputConsumedIdentifier(statement,entry,partState,showDerived){
  const name=programOutputPartName(entry.part);
  const nodes=[h('span',{class:'program-output-source-identifier binding-identity',
    style:bindingIdentityStyle(name,'variable'),
    'data-token-id':programOutputReadTokenId(statement,entry.index)},name)];
  if(showDerived) nodes.push(h('span',{class:'program-output-derived-value binding-identity',
    style:bindingIdentityStyle(name,'variable'),
    'data-token-id':programOutputResultTokenId(statement,entry.index)},`→ ${partState.resolvedValue}`));
  return h('span',{class:'program-output-consumed-source'},...nodes);
}

function renderProgramOutputState(statement,item,program,options){
  options=options||{};
  const language=program.language||item.language||state.language;
  const partStates=programOutputPartStates(statement,options.traceCount||0);
  const interactive=!!options.interactive&&!item.checked&&!examInteractionLocked();
  const resolved=programOutputDynamicParts(statement).every(entry=>partStates[entry.index].resolvedValue!==null);
  const readyToPrint=interactive&&(resolved||programOutputStrictControls());
  const command=language==='c'?'printf':(statement.newline?'System.out.println':'System.out.print');
  const code=h('code',{class:'program-output-code'});
  code.appendChild(outputActionToken(command,{
    class:'program-output-token output-command tok '+(readyToPrint?'tok-op-active':'tok-static'),
    'data-output-command-source':options.commandAnchor?statement.id:null,
    title:readyToPrint?'Send the evaluated text to Program Output':null,
    'aria-label':readyToPrint?`Execute ${command}`:null,
    onclick:readyToPrint?()=>handleTokenClick({type:'emit-output',statementId:statement.id}):null
  },readyToPrint));
  code.appendChild(h('span',{class:'program-output-punctuation'},'('));

  if(language==='c'){
    code.appendChild(h('span',{class:'program-output-string'},'"'));
    statement.parts.forEach((part,index)=>{
      if(part.kind==='text') code.appendChild(h('span',{class:'program-output-string'},outputEscapeLiteral(part.value)));
      else{
        const partState=partStates[index];
        if(partState.resolvedValue!==null){
          const name=programOutputPartName(part);
          code.appendChild(h('span',{class:'program-output-string program-output-resolved-value binding-identity',
            style:bindingIdentityStyle(name,'variable'),
            'data-token-id':programOutputResultTokenId(statement,index)},String(partState.resolvedValue)));
        }else{
          const actionable=programOutputResolveActionable(interactive,partState);
          code.appendChild(outputActionToken(`%${part.format||'d'}`,{
            class:'program-output-token output-combine tok '+(actionable?'tok-op-active':'tok-static'),
            'data-output-combine-id':programOutputResultTokenId(statement,index),
            title:actionable?'Insert the retrieved value into this placeholder':null,
            'aria-label':actionable?'Insert retrieved value into format placeholder':null,
            onclick:actionable?()=>handleTokenClick({type:'resolve-output-part',partIndex:index,statementId:statement.id}):null
          },actionable));
        }
      }
    });
    if(statement.newline) code.appendChild(h('span',{class:'program-output-escape'},'\\n'));
    code.appendChild(h('span',{class:'program-output-string'},'"'));
    programOutputDynamicParts(statement).forEach(entry=>{
      const partState=partStates[entry.index];
      const name=programOutputPartName(entry.part);
      const actionable=programOutputReadActionable(interactive,partState);
      code.appendChild(h('span',{class:'program-output-punctuation'},', '));
      if(partState.resolvedValue!==null){
        code.appendChild(renderProgramOutputConsumedIdentifier(statement,entry,partState,false));
      }else if(partState.stagedValue!==null){
        code.appendChild(renderValueCard({id:programOutputReadTokenId(statement,entry.index),name,
          value:partState.stagedValue,kind:'variable',color:bindingIdentityColor(name,'variable'),
          isFlash:!!options.flashRead&&options.flashPartIndex===entry.index}));
      }else{
        code.appendChild(outputActionToken(name,{
          class:'program-output-token output-identifier binding-identity tok '+(actionable?'tok-var':'tok-static'),
          style:bindingIdentityStyle(name,'variable'),
          'data-token-id':programOutputReadTokenId(statement,entry.index),
          title:actionable?`Read ${name} from memory`:null,'aria-label':actionable?`Read ${name} from memory`:null,
          onclick:actionable?()=>handleTokenClick({type:'read-output-value',partIndex:entry.index,name,statementId:statement.id}):null
        },actionable));
      }
    });
  }else{
    statement.parts.forEach((part,index)=>{
      if(index>0){
        const partState=part.kind==='expression'?partStates[index]:null;
        const actionable=part.kind==='expression'&&programOutputResolveActionable(interactive,partState);
        code.appendChild(h('span',{},' '));
        code.appendChild(outputActionToken('+',{
          class:'program-output-token output-combine tok '+(actionable?'tok-op-active':'tok-static'),
          'data-output-combine-id':part.kind==='expression'?programOutputResultTokenId(statement,index):null,
          title:actionable?'Concatenate the retrieved value':null,
          'aria-label':actionable?'Concatenate the retrieved value':null,
          onclick:actionable?()=>handleTokenClick({type:'resolve-output-part',partIndex:index,statementId:statement.id}):null
        },actionable));
        code.appendChild(h('span',{},' '));
      }
      if(part.kind==='text') code.appendChild(h('span',{class:'program-output-string'},`"${outputEscapeLiteral(part.value)}"`));
      else{
        const partState=partStates[index];
        const name=programOutputPartName(part);
        const actionable=programOutputReadActionable(interactive,partState);
        if(partState.resolvedValue!==null){
          code.appendChild(renderProgramOutputConsumedIdentifier(statement,{part,index},partState,true));
        }else if(partState.stagedValue!==null){
          code.appendChild(renderValueCard({id:programOutputReadTokenId(statement,index),name,
            value:partState.stagedValue,kind:'variable',color:bindingIdentityColor(name,'variable'),
            isFlash:!!options.flashRead&&options.flashPartIndex===index}));
        }else{
          code.appendChild(outputActionToken(name,{
            class:'program-output-token output-identifier binding-identity tok '+(actionable?'tok-var':'tok-static'),style:bindingIdentityStyle(name,'variable'),
            'data-token-id':programOutputReadTokenId(statement,index),
            title:actionable?`Read ${name} from memory`:null,'aria-label':actionable?`Read ${name} from memory`:null,
            onclick:actionable?()=>handleTokenClick({type:'read-output-value',partIndex:index,name,statementId:statement.id}):null
          },actionable));
        }
      }
    });
  }
  code.appendChild(h('span',{class:'program-output-punctuation'},');'));
  return code;
}

function renderProgramOutputTimeline(statement,item,program,statementIndex,isActive){
  const visualTrace=programOutputVisualTrace(statement);
  const timeline=h('div',{class:'timeline expression-timeline program-output-timeline'});
  for(let traceCount=0;traceCount<=visualTrace.length;traceCount++){
    const isSource=traceCount===0;
    const isLatest=traceCount===visualTrace.length;
    const isCurrent=isActive&&isLatest&&!statement.runtime.checked;
    const row=h('div',{class:`tl-row ${isSource?'source-row ':''}${isCurrent?'current':'done'}`});
    const previousStep=traceCount>0?visualTrace[traceCount-1]:null;
    const color=previousStep?stepVisualColor(previousStep,traceCount-1):'#4b5364';
    row.appendChild(h('div',{class:'tl-dot'+(isSource?' statement-source-dot':''),
      style:`background:${color};`,title:isSource?'Original statement':'Evaluation step'},
    isSource?String(statementIndex+1):null));
    const code=h('div',{class:'code-out program-output-timeline-code'});
    const currentStep=isLatest?previousStep:null;
    code.appendChild(renderProgramOutputState(statement,item,program,{
      traceCount,interactive:isCurrent,commandAnchor:isLatest,
      flashRead:!!(currentStep&&currentStep.action==='READ_OUTPUT_VALUE'&&!currentStep._outputFlashed),
      flashPartIndex:currentStep&&currentStep.partIndex
    }));
    if(currentStep) currentStep._outputFlashed=true;
    if(isCurrent){
      const actions=renderInlineEvaluationActions({
        canUndo:canUndoForCurrentMode(item)&&statement.runtime.trace.length>0
      });
      if(actions) code.appendChild(actions);
    }else if(isSource&&statement.status==='complete') code.appendChild(renderCollapseStatementAction(statement,statementIndex));
    row.appendChild(code);timeline.appendChild(row);
  }
  return timeline;
}

function renderOutputStatement(ctx){
  const {container,item,program,statement,statementIndex,isActive}=ctx;
  const expanded=statement.status==='complete'&&!!(statement._uiExpanded||statement._uiJustCompleted);
  const card=h('section',{class:`program-statement program-output-statement ${statement.status}`,
    'data-statement-id':statement.id});
  if(!isActive&&!expanded){
    card.appendChild(renderProgramStatementSummary(statement,statementIndex,outputStatementSource(statement,item)));
    container.appendChild(card);return;
  }
  card.classList.add('expanded');
  const panel=h('div',{class:'program-expression-panel program-output-eval-panel expression-scroll-surface',
    'data-statement-id':statement.id},renderProgramOutputTimeline(statement,item,program,statementIndex,isActive));
  if(isActive&&!statement.runtime.checked){
    if(state.mode!=='exam'||activeExamPolicy().showNeutralGuidance){
      const unresolved=programOutputDynamicParts(statement).filter(entry=>
        statement.runtime.parts[entry.index].resolvedValue===null);
      const message=!unresolved.length
        ? `The text is ready. Click ${program.language==='c'?'printf':(statement.newline?'System.out.println':'System.out.print')} to print it.`
        : (programOutputStrictControls()
          ? 'All output controls are available. Choose the next executable action.'
          : `Read variables in any order. Each retrieved value unlocks its matching ${program.language==='c'?'placeholder':'concatenation operator'}.`);
      panel.appendChild(renderContextHelp(message));
    }
    const reset=renderItemResetControl(state.mode==='practice'&&(program.cursor>0||statement.runtime.trace.length>0));
    if(reset) panel.appendChild(reset);
  }
  card.appendChild(panel);
  container.appendChild(card);
}

function renderProgramOutputPanel(item,program){
  const events=(program.events||[]).filter(event=>event&&event.type==='OUTPUT');
  const pending=pendingProgramOutputAnimation&&pendingProgramOutputAnimation.item===item
    ? pendingProgramOutputAnimation:null;
  let visibleText=events.map(event=>event.text).join('');
  if(pending){
    const index=events.lastIndexOf(pending.event);
    if(index>=0) visibleText=events.slice(0,index).map(event=>event.text).join('');
  }
  const pre=h('pre',{class:'program-output-screen-text'},visibleText);
  const escape=h('span',{class:'program-output-escape-cue','aria-hidden':'true',
    title:'newline (\\n)'},'↵');
  const panel=h('aside',{class:'program-output-screen','aria-label':'Program output'},
    h('div',{class:'program-output-screen-title'},
      h('i',{class:'fa-solid fa-display','aria-hidden':'true'}),h('span',{},'Program Output')),
    h('div',{class:'program-output-screen-body','aria-live':'polite'},pre,escape,
      h('span',{class:'program-output-cursor','aria-hidden':'true'},'▌')));
  if(pending) requestAnimationFrame(()=>startProgramOutputAnimation(panel,pre,escape,pending));
  return panel;
}

function startProgramOutputAnimation(panel,pre,escape,pending){
  if(!panel||!panel.isConnected||pendingProgramOutputAnimation!==pending) return;
  pendingProgramOutputAnimation=null;
  const text=pending.event.text||'';
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish=()=>{programOutputAnimationActive=false;programOutputAnimationTimer=null;
    escape.classList.remove('is-visible');panel.classList.remove('is-printing');};
  if(reduced||!PROGRAM_OUTPUT_SETTINGS.characterAnimation){pre.textContent+=text;finish();return;}
  programOutputAnimationActive=true;panel.classList.add('is-printing');
  const source=document.querySelector(`[data-output-command-source="${pending.event.statementId}"]`);
  const begin=()=>{
    let index=0;
    const step=()=>{
      if(!panel.isConnected){finish();return;}
      if(index>=text.length){finish();return;}
      const character=text[index++];
      if(character==='\n'){
        escape.classList.add('is-visible');
        programOutputAnimationTimer=setTimeout(()=>{
          pre.textContent+='\n';escape.classList.remove('is-visible');step();
        },PROGRAM_OUTPUT_SETTINGS.escapeDelayMs);
      }else{
        pre.textContent+=character;
        programOutputAnimationTimer=setTimeout(step,PROGRAM_OUTPUT_SETTINGS.characterDelayMs);
      }
    };
    step();
  };
  if(source&&typeof runVarFinalComet==='function'){
    runVarFinalComet(source.getBoundingClientRect(),panel.getBoundingClientRect(),'#67e8c1',begin);
  }else begin();
}

registerStatementRenderer('output',renderOutputStatement);
