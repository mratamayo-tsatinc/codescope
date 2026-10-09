function outputEscapeLiteral(value){
  return String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')
    .replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/\r/g,'\\r')
    .replace(/\u0008/g,'\\b');
}

function outputStatementSource(statement,item){
  const language=(item&&item.program&&item.program.language)||item.language||state.language;
  const dynamic=programOutputDynamicParts(statement);
  if(language==='c'){
    const format=statement.parts.map(part=>part.kind==='text'?outputEscapeLiteral(part.value):`%${part.format||'d'}`).join('')
      +(statement.newline?'\\n':'');
    const args=dynamic.map(entry=>programOutputPartSource(entry.part)).filter(Boolean);
    return `printf("${format}"${args.length?', '+args.join(', '):''});`;
  }
  const pieces=statement.parts.map(part=>part.kind==='text'
    ? `"${outputEscapeLiteral(part.value)}"`
    : programOutputPartSource(part)).filter(Boolean);
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
  const states=statement.parts.map((part,index)=>({
    stagedValue:part.kind==='expression'&&statement.runtime.parts[index].initialStagedValue!=null
      ?statement.runtime.parts[index].initialStagedValue:null,resolvedValue:null}));
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
  const dataType=entry.part.expression&&entry.part.expression.dataType;
  if(!name)return h('span',{class:'program-output-consumed-source'},
    h('span',{class:'program-output-token tok-static'},programOutputPartSource(entry.part)),
    ...(showDerived?[h('span',{class:'program-output-derived-value',
      'data-token-id':programOutputResultTokenId(statement,entry.index)},
    `→ ${formatValue(partState.resolvedValue,dataType)}`)]:[]));
  const nodes=[renderValueCard({id:programOutputReadTokenId(statement,entry.index),name,
    value:partState.stagedValue,kind:'variable',dataType,color:bindingIdentityColor(name,'variable'),
    isFlash:false})];
  if(showDerived) nodes.push(h('span',{class:'program-output-derived-value binding-identity',
    style:bindingIdentityStyle(name,'variable'),
    'data-token-id':programOutputResultTokenId(statement,entry.index)},
    `→ ${formatValue(partState.resolvedValue,dataType)}`));
  return h('span',{class:'program-output-consumed-source'},...nodes);
}

function renderProgramOutputResolvedJavaString(statement,partStates){
  const nodes=[h('span',{class:'program-output-string'},'"')];
  statement.parts.forEach((part,index)=>{
    if(part.kind==='text'){
      nodes.push(h('span',{class:'program-output-string'},outputEscapeLiteral(part.value)));
      return;
    }
    const name=programOutputPartName(part),partState=partStates[index];
    nodes.push(h('span',{class:'program-output-string program-output-resolved-value binding-identity',
      style:bindingIdentityStyle(name,'variable'),
      'data-token-id':programOutputResultTokenId(statement,index)},
    programOutputFormatValue(partState.resolvedValue,part.format)));
  });
  nodes.push(h('span',{class:'program-output-string'},'"'));
  return nodes;
}

function renderProgramOutputState(statement,item,program,options){
  options=options||{};
  const language=program.language||item.language||state.language;
  const partStates=programOutputPartStates(statement,options.traceCount||0);
  const interactive=!!options.interactive&&!item.checked&&!item.practiceInvalidExecution&&!examInteractionLocked();
  const resolved=programOutputDynamicParts(statement).every(entry=>partStates[entry.index].resolvedValue!==null);
  const readyToPrint=interactive&&(resolved||programOutputStrictControls());
  const command=language==='c'?'printf':(statement.newline?'System.out.println':'System.out.print');
  const code=h('code',{class:'program-output-code'});
  if(options.sourceIndent) code.appendChild(h('span',{class:'program-source-indent'},options.sourceIndent));
  code.appendChild(outputActionToken(command,{
    class:'program-output-token output-command tok '+(readyToPrint?'tok-op-active':'tok-static'),
    'data-terminal-emitter':options.commandAnchor?statement.id:null,
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
            'data-token-id':programOutputResultTokenId(statement,index)},
            programOutputFormatValue(partState.resolvedValue,part.format)));
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
        code.appendChild(name?renderValueCard({id:programOutputReadTokenId(statement,entry.index),name,
          value:partState.stagedValue,kind:'variable',dataType:entry.part.expression&&entry.part.expression.dataType,
          color:bindingIdentityColor(name,'variable'),
          isFlash:!!options.flashRead&&options.flashPartIndex===entry.index})
          :h('span',{class:'program-output-token tok-static'},programOutputPartSource(entry.part)));
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
    if(resolved){
      renderProgramOutputResolvedJavaString(statement,partStates).forEach(node=>code.appendChild(node));
    }else statement.parts.forEach((part,index)=>{
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
          code.appendChild(h('span',{class:'program-output-resolved-value binding-identity',
            style:bindingIdentityStyle(name,'variable'),
            'data-token-id':programOutputResultTokenId(statement,index)},
          programOutputFormatValue(partState.resolvedValue,part.format)));
        }else if(partState.stagedValue!==null){
          code.appendChild(name?renderValueCard({id:programOutputReadTokenId(statement,index),name,
            value:partState.stagedValue,kind:'variable',dataType:part.expression&&part.expression.dataType,
            color:bindingIdentityColor(name,'variable'),
            isFlash:!!options.flashRead&&options.flashPartIndex===index})
            :h('span',{class:'program-output-token tok-static'},programOutputPartSource(part)));
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
    const previousStep=traceCount>0?visualTrace[traceCount-1]:null;
    const substitutionRow=program.language==='c'
      &&!!(previousStep&&previousStep.action==='EVALUATE'&&previousStep.outputAction);
    const row=h('div',{class:`tl-row ${isSource?'source-row ':''}${isCurrent?'current':'done'}${substitutionRow?' output-substitution-row':''}`});
    const color=previousStep?stepVisualColor(previousStep,traceCount-1):'#4b5364';
    row.appendChild(h('div',{class:'tl-dot'+(isSource?' statement-source-dot':''),
      style:`background:${color};`,title:isSource?'Original statement':'Evaluation step'},
    isSource?String(programStatementDisplayNumber(statement,statementIndex)):null));
    const code=h('div',{class:'code-out program-output-timeline-code'});
    const currentStep=isLatest?previousStep:null;
    code.appendChild(renderProgramOutputState(statement,item,program,{
      traceCount,interactive:isCurrent,commandAnchor:isLatest,
      sourceIndent:statement.sourceIndent||'',
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
    const invalidExecutionAlert=renderInvalidExecutionAlert(item,statement);
    if(invalidExecutionAlert)panel.appendChild(invalidExecutionAlert);
    if(!item.practiceInvalidExecution&&(state.mode!=='exam'||activeExamPolicy().showNeutralGuidance)){
      const unresolved=programOutputDynamicParts(statement).filter(entry=>
        statement.runtime.parts[entry.index].resolvedValue===null);
      const message=!unresolved.length
        ? `The text is ready. Click ${program.language==='c'?'printf':(statement.newline?'System.out.println':'System.out.print')} to print it.`
        : (programOutputStrictControls()
          ? 'All output controls are available. Choose the next executable action.'
          : `Read variables in any order. Each retrieved value unlocks its matching ${program.language==='c'?'placeholder':'concatenation operator'}.`);
      panel.appendChild(renderContextHelp(message));
    }
    const reset=renderItemResetControl(state.mode==='practice'
      &&!(ctx.services&&ctx.services.statementTraceModal)
      &&(program.cursor>0||statement.runtime.trace.length>0));
    if(reset) panel.appendChild(reset);
  }
  card.appendChild(panel);
  container.appendChild(card);
}

function outputPredictionVisibleText(value){
  const text=String(value||'');
  return text?text.replace(/\n/g,'\u21b5\n'):'Your rendered output will appear here.';
}

function renderProgramOutputInlineResponse(item,program,statement){
  if(!programOutputStudentResponsePlanned(item,statement)||!statement.runtime.manualOutputActive
    ||currentProgramStatement(item)!==statement)return null;
  const runtime=statement.runtime;
  const textarea=h('textarea',{class:'program-output-prediction-input',rows:'4',
    spellcheck:'false','aria-label':'Enter the complete output produced by this statement',
    placeholder:'Type the rendered output here. Press Enter to add a new line.'});
  textarea.value=runtime.manualOutputDraft||'';
  const preview=h('pre',{class:'program-output-prediction-preview',
    'aria-label':'Visible line-break preview'},outputPredictionVisibleText(textarea.value));
  const count=h('span',{class:'program-output-prediction-count'},
    `${(textarea.value.match(/\n/g)||[]).length} line break${(textarea.value.match(/\n/g)||[]).length===1?'':'s'}`);
  const sync=()=>{
    runtime.manualOutputDraft=textarea.value;
    preview.textContent=outputPredictionVisibleText(textarea.value);
    const total=(textarea.value.match(/\n/g)||[]).length;
    count.textContent=`${total} line break${total===1?'':'s'}`;
  };
  textarea.oninput=sync;
  const form=h('form',{class:'program-output-prediction',
    'aria-label':'Complete output prediction',
    onsubmit:event=>{
      event.preventDefault();sync();
      handleTokenClick({type:'emit-student-output',statementId:statement.id,text:textarea.value});
    }},
    h('div',{class:'program-output-prediction-heading'},
      h('i',{class:'fa-solid fa-keyboard','aria-hidden':'true'}),
      h('div',{},h('strong',{},"Enter this statement's complete output"),
        h('span',{},'Use actual line breaks instead of typing \\n.'))),
    textarea,
    h('div',{class:'program-output-prediction-preview-wrap'},
      h('span',{class:'program-output-prediction-preview-label'},'Line-break preview'),
      preview),
    h('div',{class:'program-output-prediction-actions'},
      count,
      h('button',{type:'button',class:'program-output-prediction-newline',
        onclick:()=>{
          const start=textarea.selectionStart==null?textarea.value.length:textarea.selectionStart;
          const end=textarea.selectionEnd==null?start:textarea.selectionEnd;
          textarea.value=textarea.value.slice(0,start)+'\n'+textarea.value.slice(end);
          textarea.selectionStart=textarea.selectionEnd=start+1;sync();textarea.focus();
        }},h('i',{class:'fa-solid fa-turn-down','aria-hidden':'true'}),h('span',{},'New line')),
      h('button',{type:'button',class:'program-output-prediction-cancel',
        onclick:()=>handleTokenClick({type:'cancel-output-response',statementId:statement.id})},'Cancel'),
      h('button',{type:'submit',class:'program-output-prediction-submit'},
        h('i',{class:'fa-solid fa-display','aria-hidden':'true'}),h('span',{},'Send to console'))));
  textarea.onkeydown=event=>{
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();form.requestSubmit();}
  };
  if(runtime._focusManualOutput){
    runtime._focusManualOutput=false;
    setTimeout(()=>{if(textarea&&textarea.isConnected!==false)textarea.focus();},0);
  }
  return form;
}

registerStatementRenderer('output',renderOutputStatement);
