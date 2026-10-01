// ============================================================================
// SHARED PROGRAM TERMINAL
// ----------------------------------------------------------------------------
// Shell-owned terminal surface for output and input events. Language semantics
// produce control characters; this service owns screen painting, cursor state,
// playback, and the shared console UI consumed by compatible activities.
// ============================================================================

const PROGRAM_TERMINAL_SETTINGS=DEFAULT_APP_SETTINGS.shell.outputPanel;
let pendingProgramTerminalAnimation=null;
let programTerminalAnimationActive=false;
let programTerminalAnimationTimer=null;

function programTerminalInteractionLocked(){return programTerminalAnimationActive;}

function queueProgramTerminalAnimation(item,event,onComplete){
  if(!item||!event||event.type!=='OUTPUT') return;
  pendingProgramTerminalAnimation={item,event,onComplete:typeof onComplete==='function'?onComplete:null};
}

function programTerminalAnimationSurface(item,pending){
  return pending&&typeof programStatementTraceOpenFor==='function'
    &&programStatementTraceOpenFor(item,pending.event&&pending.event.statementId)?'modal':'main';
}

function programTerminalCursorStyle(state){
  return `--terminal-left:${state.column}ch;--terminal-top:${state.row*1.65}em;`;
}

function programTerminalPositionCursor(cursor,state){
  if(!cursor||!state)return;
  cursor.setAttribute('style',programTerminalCursorStyle(state));
  cursor.setAttribute('data-terminal-row',String(state.row));
  cursor.setAttribute('data-terminal-column',String(state.column));
}

function appendProgramTerminalEvents(pre,events,program){
  let terminalStream='';
  events.forEach(event=>{
    if(event.type!=='INPUT'||!Array.isArray(event.tokens)||!event.tokens.length){
      terminalStream+=String(event.text||'');
      pre.textContent=coreTerminalScreen(terminalStream).text;
      return;
    }
    const statement=program.statements.find(entry=>entry.id===event.statementId);
    const raw=String(event.rawText==null?'':event.rawText);
    terminalStream+=raw+'\n';
    let offset=0;
    event.tokens.forEach((token,index)=>{
      const value=String(token),position=raw.indexOf(value,offset);
      if(position<0)return;
      if(position>offset)pre.appendChild(h('span',{},raw.slice(offset,position)));
      const target=statement&&statement.reads[index]&&statement.reads[index].target;
      pre.appendChild(h('span',{class:'program-input-console-token binding-identity',
        style:target?bindingIdentityStyle(target,'variable'):'',
        'data-input-console-token':`${event.statementId}-${index}`},value));
      offset=position+value.length;
    });
    pre.appendChild(h('span',{},raw.slice(offset)+'\n'));
  });
  pre._programTerminalStream=terminalStream;
}

function renderProgramTerminalPanel(item,program,options){
  options=options||{};
  const surface=options.surface==='modal'?'modal':'main';
  const events=(program.events||[]).filter(event=>event&&(event.type==='OUTPUT'||event.type==='INPUT'));
  const pending=pendingProgramTerminalAnimation&&pendingProgramTerminalAnimation.item===item
    ?pendingProgramTerminalAnimation:null;
  const ownsPending=!!(pending&&programTerminalAnimationSurface(item,pending)===surface);
  let visibleEvents=events;
  if(ownsPending){
    const index=events.lastIndexOf(pending.event);
    if(index>=0)visibleEvents=events.slice(0,index);
  }
  const pre=h('pre',{class:'program-output-screen-text'});
  appendProgramTerminalEvents(pre,visibleEvents,program);
  const terminalState=coreTerminalScreen(pre._programTerminalStream);
  const cursor=h('span',{class:'program-output-cursor','aria-hidden':'true',
    style:programTerminalCursorStyle(terminalState),
    'data-terminal-row':String(terminalState.row),
    'data-terminal-column':String(terminalState.column)},'▌');
  const escape=h('span',{class:'program-output-escape-cue','aria-hidden':'true',
    title:'newline (\\n)'},'↵');
  const hasInput=program.statements.some(statement=>statement.kind==='input');
  const title=hasInput?'Program Console':'Program Output';
  const panel=h('aside',{class:'program-output-screen','aria-label':title,'data-output-surface':surface},
    h('div',{class:'program-output-screen-title'},
      h('i',{class:'fa-solid fa-display','aria-hidden':'true'}),h('span',{},title)),
    h('div',{class:'program-output-screen-body','aria-live':'polite'},pre,escape,cursor));
  if(hasInput&&typeof renderProgramInputConsoleControls==='function')
    renderProgramInputConsoleControls(item,program,panel,pre,surface);
  if(ownsPending)requestAnimationFrame(()=>startProgramTerminalAnimation(panel,pre,escape,cursor,pending));
  return panel;
}

function startProgramTerminalAnimation(panel,pre,escape,cursor,pending){
  if(!panel||!panel.isConnected||pendingProgramTerminalAnimation!==pending)return;
  pendingProgramTerminalAnimation=null;
  if(typeof setProgramContextTab==='function')setProgramContextTab('output');
  const text=pending.event.text||'';
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let terminalStream=String(pre._programTerminalStream==null?pre.textContent:pre._programTerminalStream);
  const paint=()=>{
    const terminalState=coreTerminalScreen(terminalStream);
    pre.textContent=terminalState.text;pre._programTerminalStream=terminalStream;
    programTerminalPositionCursor(cursor,terminalState);
  };
  let finished=false;
  const finish=()=>{if(finished)return;finished=true;programTerminalAnimationActive=false;programTerminalAnimationTimer=null;
    escape.classList.remove('is-visible');panel.classList.remove('is-printing');
    if(pending.onComplete)pending.onComplete();};
  if(reduced||!PROGRAM_TERMINAL_SETTINGS.characterAnimation){terminalStream+=text;paint();finish();return;}
  programTerminalAnimationActive=true;panel.classList.add('is-printing');
  const source=document.querySelector(`[data-terminal-emitter="${pending.event.statementId}"]`)
    ||document.querySelector(`.program-source-file-line[data-statement-id="${pending.event.statementId}"]`);
  const begin=()=>{
    let index=0;
    const step=()=>{
      if(!panel.isConnected){finish();return;}
      if(index>=text.length){finish();return;}
      const character=text[index++];
      if(character==='\n'){
        escape.classList.add('is-visible');
        programTerminalAnimationTimer=setTimeout(()=>{
          terminalStream+=character;paint();escape.classList.remove('is-visible');step();
        },PROGRAM_TERMINAL_SETTINGS.escapeDelayMs);
      }else{
        terminalStream+=character;paint();
        programTerminalAnimationTimer=setTimeout(step,PROGRAM_TERMINAL_SETTINGS.characterDelayMs);
      }
    };
    step();
  };
  if(source&&typeof runVarFinalComet==='function')
    runVarFinalComet(source.getBoundingClientRect(),panel.getBoundingClientRect(),'#67e8c1',begin);
  else begin();
}