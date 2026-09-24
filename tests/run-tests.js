const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function context(){
  const storage = new Map();
  return vm.createContext({
    console: {log(){}, warn(){}, error(){}},
    setTimeout(){ return 1; }, clearTimeout(){},
    setInterval(){ return 1; }, clearInterval(){},
    structuredClone: global.structuredClone,
    render(){}, startTimer(){}, itemPaginationHandlerAttached:false,
    localStorage:{
      getItem:key=>storage.has(key)?storage.get(key):null,
      setItem:(key,value)=>storage.set(key,String(value)),
      removeItem:key=>storage.delete(key),
      key:index=>[...storage.keys()][index] || null,
      get length(){ return storage.size; }
    }
  });
}

function load(ctx, names){
  names.forEach(name=>{
    const filename = path.join(ROOT, 'js', name);
    let source=fs.readFileSync(filename,'utf8');
    // Generator and renderer tests exercise every authored profile regardless
    // of the deployment visibility selected in the disk configuration.
    if(name==='profiles.js')source=source.replace(/enabled:false,/g,'enabled:true,');
    vm.runInContext(source, ctx, {filename});
  });
}

function loadRelative(ctx,names){
  names.forEach(name=>{
    const filename=path.join(ROOT,name);
    vm.runInContext(fs.readFileSync(filename,'utf8'),ctx,{filename});
  });
}

function evaluate(ctx, source){ return vm.runInContext(source, ctx); }

function installFakeDom(ctx){
  class FakeNode {
    constructor(tag, text){
      this.tagName = tag;
      this._text = text || '';
      this.children = [];
      this.attributes = {};
      this.className = '';
      this.style = {};
      this.classList = {add(){}, remove(){}, toggle(){}, contains(){return false;}};
    }
    appendChild(child){ this.children.push(child); return child; }
    setAttribute(name,value){ this.attributes[name]=String(value); }
    addEventListener(){}
    querySelector(){ return null; }
    querySelectorAll(){ return []; }
    get textContent(){ return this._text + this.children.map(c=>c && c.textContent || '').join(''); }
    set textContent(value){ this._text=String(value); this.children=[]; }
  }
  ctx.document = {
    createElement:tag=>new FakeNode(tag),
    createTextNode:text=>new FakeNode('#text', String(text)),
    getElementById(){ return null; }
  };
  ctx.window = {innerWidth:1280};
  ctx.globalThis = ctx;
  ctx.FakeNode = FakeNode;
  ctx.countNodesWithClass = function countNodesWithClass(root,className){
    if(!root) return 0;
    const own=String(root.className||'').split(/\s+/).includes(className)?1:0;
    return own+(root.children||[]).reduce((sum,child)=>sum+countNodesWithClass(child,className),0);
  };
}

function testScriptManifestParses(){
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(html.includes('<title>CodeScope</title>'));
  assert(!html.includes('assets/codescope-icon.svg'));
  assert(!html.includes('<h1>Precedify</h1>'));
  const names = [...html.matchAll(/<script src="js\/([^"]+)"/g)].map(m=>m[1]);
  const bundle = names.map(name=>fs.readFileSync(path.join(ROOT, 'js', name), 'utf8')).join('\n');
  new vm.Script(bundle, {filename:'index-script-order.js'});
  assert(names.includes('program-core.js'));
  assert(names.includes('legacy-expression-plugin.js'));
  assert(names.includes('assignment-statement-plugin.js'));
  assert(names.includes('unary-update-statement-plugin.js'));
  assert(names.includes('render-assignment.js'));
  assert(names.includes('render-unary-update.js'));
  assert(names.includes('render-done.js'));
  const localScripts=[...html.matchAll(/<script src="((?:js|plugins)\/[^\"]+)"/g)].map(match=>match[1]);
  new vm.Script(localScripts.map(name=>fs.readFileSync(path.join(ROOT,name),'utf8')).join('\n'),{filename:'complete-local-script-order.js'});
  assert(localScripts.includes('js/activity-core.js'));
  assert(localScripts.includes('plugins/token-classification/plugin.js'));
  assert(html.includes('plugins/simulate-output/styles.css'));
  assert(!localScripts.includes('plugins/simulate-output/catalog.js'));
  assert(localScripts.indexOf('plugins/simulate-output/manifest.js')
    <localScripts.indexOf('plugins/simulate-output/generator.js'));
  assert(localScripts.indexOf('plugins/simulate-output/generator.js')
    <localScripts.indexOf('plugins/simulate-output/plugin.js'));
  assert(localScripts.indexOf('plugins/simulate-output/plugin.js')
    <localScripts.indexOf('js/state.js'));
  assert(localScripts.includes('plugins/program-output/content.js'));
  assert(localScripts.indexOf('js/program-item-builder.js')
    <localScripts.indexOf('plugins/program-output/content.js'));
  assert(localScripts.indexOf('plugins/program-output/content.js')
    <localScripts.indexOf('js/state.js'));
  assert(localScripts.includes('js/program-return.js'));
  assert(localScripts.indexOf('js/program-return.js')<localScripts.indexOf('plugins/program-output/content.js'));
  const stateSource=fs.readFileSync(path.join(ROOT,'js','state.js'),'utf8');
  const juiceSource=fs.readFileSync(path.join(ROOT,'js','juice.js'),'utf8');
  assert(stateSource.includes("event&&event.type==='RETURN'&&typeof celebrateProgramCompletion==='function'"));
  assert(juiceSource.includes('function celebrateProgramCompletion(item,referenceEl)'));
  assert(html.includes('id="statementTraceModal"'));
  assert(html.includes('id="statementTraceBody"'));
  assert(html.includes('id="statementTraceOverlay"'));
  assert(html.includes('id="statementTraceBack"'));
  assert(html.includes('id="statementTraceContinue"'));
  assert(!html.includes('statement-trace-close'));
  const tokenRenderer=fs.readFileSync(path.join(ROOT,'plugins','token-classification','renderer.js'),'utf8');
  const tokenFeedback=fs.readFileSync(path.join(ROOT,'plugins','token-classification','feedback.js'),'utf8');
  const tokenStyles=fs.readFileSync(path.join(ROOT,'plugins','token-classification','styles.css'),'utf8');
  const fallingRenderer=fs.readFileSync(path.join(ROOT,'plugins','falling-token-sort','renderer.js'),'utf8');
  const fallingStyles=fs.readFileSync(path.join(ROOT,'plugins','falling-token-sort','styles.css'),'utf8');
  const simulateRenderer=fs.readFileSync(path.join(ROOT,'plugins','simulate-output','renderer.js'),'utf8');
  assert(tokenRenderer.includes('renderProgramWorkspaceShell(container,item,'));
  assert(tokenRenderer.includes('renderInlineEvaluationActions({'));
  assert(tokenRenderer.includes("?'checked-wrong':'checked-correct'"));
  assert(!tokenRenderer.includes('renderContextHelp(tcTokenInstruction(profile))'));
  assert(tokenStyles.includes('.tc-answer-wrong'));
  assert(!tokenStyles.includes('.token-classification-workspace .program-progress-visual{display:none}'));
  assert(!tokenRenderer.includes("class:'tc-activity'"));
  assert(!tokenRenderer.includes("h('h2',{},profile.name"));
  assert(fallingStyles.includes('.fts-solution-row code{color:var(--text);font:700 12px/1.45 var(--mono);font-variant-ligatures:none;'));
  assert(fallingStyles.includes('font-feature-settings:"liga" 0,"calt" 0'));
  assert(tokenFeedback.includes("class:'solution-toggle'"));
  assert(tokenFeedback.includes("typeof openFeedbackDrawer==='function'"));
  assert(tokenFeedback.includes("typeof renderItemCelebration==='function'"));
  assert(!tokenStyles.includes('#8b5cf6'));
  assert(!tokenStyles.includes('#7c3aed'));
  assert(tokenStyles.includes('var(--op)'));
  assert(tokenRenderer.includes('appendPracticeRetryBar(container)'));
  assert(fallingRenderer.includes('appendPracticeRetryBar(container)'));
  assert(simulateRenderer.includes('appendPracticeRetryBar(container)'));
  assert(!simulateRenderer.includes('flow.appendChild(renderPracticeRetryBar())'));

  const declarationRenderer = fs.readFileSync(path.join(ROOT,'js','render-declaration.js'),'utf8');
  const assignmentRenderer = fs.readFileSync(path.join(ROOT,'js','render-assignment.js'),'utf8');
  const sessionRenderer = fs.readFileSync(path.join(ROOT,'js','render-session.js'),'utf8');
  const connectorRenderer = fs.readFileSync(path.join(ROOT,'js','connector-lines.js'),'utf8');
  const memoryRenderer = fs.readFileSync(path.join(ROOT,'js','var-final-state.js'),'utf8');
  const memoryFloatRenderer = fs.readFileSync(path.join(ROOT,'js','var-final-float.js'),'utf8');
  const styles = fs.readFileSync(path.join(ROOT,'css','styles.css'),'utf8');
  const login = fs.readFileSync(path.join(ROOT,'js','login.js'),'utf8');
  assert(declarationRenderer.includes('renderExpressionEvaluationPanel({'));
  assert(declarationRenderer.includes('tok tok-op-active tok-colored ready'));
  assert(assignmentRenderer.includes('tok tok-op-active tok-colored assignment-operator'));
  assert(!declarationRenderer.includes("renderExpressionSourcePanel('Original statement'"));
  assert(!assignmentRenderer.includes("renderExpressionSourcePanel('Original statement'"));
  assert(declarationRenderer.includes('continuationStyle:true'));
  assert(assignmentRenderer.includes('continuationStyle:true'));
  assert(sessionRenderer.includes("class:'program-workspace'"));
  assert(sessionRenderer.includes("class:'continuation-equals'"));
  assert(sessionRenderer.includes("class:'source-assignment-equals'"));
  assert(sessionRenderer.includes("class:'context-help'"));
  assert(sessionRenderer.includes('function renderPracticeRetryBar()'));
  assert(sessionRenderer.includes('function programTimelinePresentation(item)'));
  assert(sessionRenderer.includes('function syncStatementTraceModal(item'));
  assert(sessionRenderer.includes('function renderProgramStatementTraceSource('));
  assert(sessionRenderer.includes('function appendPracticeRetryBar(container)'));
  assert(sessionRenderer.includes("parent.classList.contains('program-workspace')"));
  assert(sessionRenderer.includes('const host=insideWorkspaceFlow&&parent.parentNode?parent.parentNode:container'));
  assert(sessionRenderer.includes('appendPracticeRetryBar(container)'));
  assert(styles.includes('.practice-retry-bar{justify-content:flex-start;}'));
  assert(sessionRenderer.includes('function renderInvalidExecutionAlert('));
  assert(sessionRenderer.includes("role:'alert','aria-live':'assertive'"));
  assert(sessionRenderer.includes("fa-triangle-exclamation"));
  assert(sessionRenderer.includes("fa-circle-exclamation"));
  assert(sessionRenderer.includes("class:'invalid-execution-recovery'"));
  assert(styles.includes('.invalid-execution-alert.recoverable'));
  assert(styles.includes('.invalid-execution-alert.terminal'));
  assert(connectorRenderer.includes('function connectorContentRect(panel)'));
  assert(connectorRenderer.includes('function drawManualResponseConnector()'));
  assert(connectorRenderer.includes("'[data-manual-connector-source]'"));
  assert(connectorRenderer.includes("'[data-manual-connector-dest]'"));
  assert(connectorRenderer.includes('manual-response-connector-dot'));
  assert(connectorRenderer.includes("'.program-expression-panel:not(.final-expression-panel)'"));
  assert(connectorRenderer.includes('function appendOutputSubstitutionConnector('));
  assert(connectorRenderer.includes('data-output-combine-id="${step.resultNodeId}"'));
  assert(connectorRenderer.includes('connector-line-output-substitution'));
  assert(connectorRenderer.includes('laneY=Math.max(y1,y2)+22'));
  assert(connectorRenderer.includes("const color = step.outputAction ? 'var(--op)' : semanticColor"));
  assert(!connectorRenderer.includes('selection-flow-connector'));
  assert(memoryRenderer.includes("class:'var-final-group var-final-group-constants'"));
  assert(memoryRenderer.includes("class:'var-final-group var-final-group-variables'"));
  assert(!memoryRenderer.includes('renderBindingInfoTrigger'));
  assert(memoryFloatRenderer.includes('function cycleVarFinalFlyAnimation()'));
  assert(memoryFloatRenderer.includes('Off -> 1s -> 2s -> 3s'));
  assert(!memoryFloatRenderer.includes('renderVarFinalSpeedToggle'));
  assert(!memoryFloatRenderer.includes('var-final-float-speed-row'));
  assert(memoryFloatRenderer.includes('function spawnVarFinalComet('));
  assert(memoryFloatRenderer.includes('function runVarFinalComet('));
  assert(memoryFloatRenderer.includes('function varFinalCometCurve('));
  assert(memoryFloatRenderer.includes('function varFinalOutboundAnimationDelay(item)'));
  assert(stateSource.includes("event.action==='ASSIGN'"));
  assert(stateSource.includes('varFinalOutboundAnimationDelay(item)'));
  assert(memoryFloatRenderer.includes("document.createElementNS(svgNS,'path')"));
  assert(memoryFloatRenderer.includes('trail.getPointAtLength(travelled)'));
  assert(memoryFloatRenderer.includes('function rollVarFinalCardValue('));
  assert(memoryFloatRenderer.includes('runVarFinalComet(sourceRect,destinationRect,color,rollIntoExpression)'));
  assert(memoryFloatRenderer.includes("rollVarFinalCardValue(renderedDestination,sourceValue,finishTransfer,'')"));
  assert(memoryFloatRenderer.includes('tokenId=programOutputReadTokenId(statement,action.partIndex)'));
  assert(memoryFloatRenderer.includes('if(!flyAnimEnabled){'));
  assert(memoryFloatRenderer.includes("bodyEl.classList.add('vf-value-roll')"));
  assert(!memoryFloatRenderer.includes('function spawnVarFinalFlyingToken('));
  assert(!memoryFloatRenderer.includes("clone.classList.add('var-final-flying'"));
  assert(/\.timeline\{[^}]*width:max-content;min-width:100%;/.test(styles));
  assert(!/\.assign-label,[\s\S]{0,80}display:\s*none\s*!important/.test(styles));
  assert(!declarationRenderer.includes('runtime.trace.forEach'));
  assert(sessionRenderer.includes('runtime.trace.forEach'));
  assert(sessionRenderer.includes('function renderExpressionSourcePanel('));
  assert(/\.compound-merge-stage\{[\s\S]*?justify-content:flex-start;/.test(styles));
  assert(!/@keyframes declaration-equals-pulse/.test(styles));
  assert(html.includes('id="examAllowUndo"'));
  assert(html.includes('id="examInteractionMode"'));
  assert(html.includes('id="practiceInteractionMode"'));
  assert(html.includes('id="settingsPolicyNotice"'));
  assert(html.includes('id="settingsConfigFields"'));
  assert(bundle.includes("interactionMode: 'guided'"));
  assert(/settingsPolicy: '(?:local-configurable|state-only)'/.test(bundle));
  assert(bundle.includes('function strictSequenceEnabled()'));
  assert(bundle.includes('function classifyRejectedProgramAction('));
  assert(declarationRenderer.includes('strict-sequence-candidate'));
  assert(assignmentRenderer.includes('strict-sequence-candidate'));
  assert(html.includes('id="examFeedbackRelease"'));
  assert(!html.includes('id="submitExamBtn"'));
  assert(!bundle.includes('function submitExam('));
  assert(bundle.includes('function expireExam()'));
  assert(bundle.includes("showScoresDuringExam: true"));
  assert(bundle.includes("feedbackRelease: 'after-timeout'"));
  assert(html.includes('id="headerSessionContext"'));
  assert(html.includes('id="accountMenu"'));
  assert(html.includes('class="account-trigger sidebar-account-trigger"'));
  assert(html.includes('id="sidebarBrandToggle"'));
  assert(html.includes('id="headerBrandToggle"'));
  assert(html.includes('class="brand-toggle-cue"'));
  assert(!html.includes('id="sidebarToggleBtn"'));
  assert(!styles.includes('.sidebar-hamburger'));
  assert(html.includes('js/shell-ui.js'));
  assert(!html.includes('class="sidebar-logout-btn"'));
  assert(styles.includes('.main-layout.sidebar-is-collapsed .header-brand'));
  assert(styles.includes('.shell-brand-trigger'));
  assert(styles.includes('.brand-toggle-cue'));
  assert(styles.includes('.shell-brand-trigger[aria-expanded="true"] .brand-toggle-cue i'));
  assert(styles.includes('#scoreSummaryModal.score-summary-exam .modal-content'));
  assert(styles.includes('.header-session-context{align-items:baseline;flex-direction:row;gap:6px;}'));
  assert(styles.includes('env(safe-area-inset-bottom)'));
  assert(styles.includes('.item-page-first,.item-page-last{display:none;}'));
  assert(bundle.includes("sidebar.toggleAttribute('inert',!sidebarVisible)"));
  assert(bundle.includes("document.querySelectorAll('.shell-brand-trigger')"));
  assert(bundle.includes("modal.classList.toggle('score-summary-exam',state.mode==='exam')"));
  assert(bundle.includes("linksToggle.setAttribute('aria-pressed'"));
  assert(bundle.includes('userControlVisible: false'));
  assert(bundle.includes("displayPolicy: 'content-aware'"));
  assert(bundle.includes('overallVisible: false'));
  assert(bundle.includes('if(!DEFAULT_APP_SETTINGS.shell.connectors.userControlVisible) return;'));
  assert(bundle.includes('state.showConnectors=connectorSettings.visible'));
  assert(bundle.includes('scoreButton.hidden=!DEFAULT_APP_SETTINGS.shell.scoreSummary.overallVisible'));
  assert(bundle.includes('function varFinalPanelShouldRender(item)'));
  assert(html.includes('handleClearAllLocalData()'));
  assert(!login.includes('clearExamProgress(email);'));
  assert(!declarationRenderer.includes("class:'action-bar declaration-actions'"));
  assert(!assignmentRenderer.includes("class:'action-bar declaration-actions'"));
  assert(styles.includes('.tok-op-active'));
  assert(styles.includes('.manual-response-actions #manualResponseConfirm:disabled'));
  assert(styles.includes('background:linear-gradient(135deg,var(--op),var(--op-glow))'));
  assert(bundle.includes('function renderManualResponseVisual('));
  assert(bundle.includes("'data-manual-connector-source':''"));
  assert(!bundle.includes('function manualResponseArrow('));
  assert(bundle.includes("if(statement.kind==='declaration'||statement.kind==='assignment') keys.push"));
  assert(bundle.includes("label='Read'"));
  assert(bundle.includes("label='Evaluate'"));
  assert(!bundle.includes('manualResponseMirrorText'));
  assert(memoryFloatRenderer.includes('function runVarFinalComet('));
}

function testPracticeRetryPlacement(){
  const ctx=context();
  installFakeDom(ctx);
  ctx.handleRetrySameItem=()=>{};
  ctx.registerStatementRenderer=()=>{};
  load(ctx,['dom-helpers.js','render-session.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const outer=new FakeNode('div');
    const workspace=new FakeNode('section');
    workspace.className='program-workspace';
    workspace.classList={contains:name=>name==='program-workspace'};
    const flow=new FakeNode('div');
    flow.className='program-statement-flow';
    workspace.parentNode=outer;
    flow.parentNode=workspace;
    outer.appendChild(workspace);
    workspace.appendChild(flow);
    const nestedBar=appendPracticeRetryBar(flow);

    const directHost=new FakeNode('div');
    const directBar=appendPracticeRetryBar(directHost);
    return JSON.stringify({
      nestedOutside:outer.children.includes(nestedBar)&&!workspace.children.includes(nestedBar),
      nestedImmediatelyAfter:outer.children[1]===nestedBar,
      directInside:directHost.children.includes(directBar),
      sharedClass:nestedBar.className==='action-bar practice-retry-bar'
    });
  })()`));
  assert.deepStrictEqual(result,{nestedOutside:true,nestedImmediatelyAfter:true,directInside:true,sharedClass:true});
}

function testStrictExamSequencePolicy(){
  const ctx=context();
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js','state.js'
  ]);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    function runtime(values,operators,unresolvedIndex){
      const operands=values.map((value,index)=>unresolvedIndex===index
        ? {id:nextId(),kind:'variable',name:'x',declaredValue:value,resolved:false,parenGroup:null}
        : Object.assign(makeLiteral(value),{parenGroup:null}));
      const flat={operands,operators:operators.slice()};
      return {originalFlat:deepCloneFlat(flat),workingFlat:deepCloneFlat(flat),
        history:[deepCloneFlat(flat)],trace:[],checked:false,expectedValue:null,
        canonicalTrace:{steps:operators.map(()=>({action:'EVALUATE'}))}};
    }
    function itemFor(statementRuntime){
      const finalFlat={operands:[makeLiteral(0)],operators:[]};
      const item={profileId:'full-basic-precedence',originalFlat:deepCloneFlat(finalFlat),
        workingFlat:deepCloneFlat(finalFlat),history:[deepCloneFlat(finalFlat)],trace:[],
        canonicalTrace:{steps:[]},correctFinalValue:0,checked:false,points:null,maxPoints:null,
        examActionLog:[],examSequenceFailure:null,resultName:'result'};
      const declaration={id:'strict-declaration',kind:'declaration',status:'active',dependencies:[],
        binding:{name:'x',kind:'variable',dataType:'int',mutable:true},runtime:statementRuntime};
      item.program=createProgram([declaration,{id:'expression',kind:'legacy-expression',status:'locked'}]);
      item.program.mode='interactive-declarations';
      item.program.scoreAssignments=true;
      return item;
    }
    function assignmentItem(statementRuntime){
      const item=itemFor(statementRuntime);
      const statement=item.program.statements[0];
      statement.kind='assignment';
      statement.target='x';
      statement.operator='+=';
      statement.runtime.targetRevealed=false;
      statement.runtime.targetReadValue=null;
      statement.runtime.assignmentActionOrder=[];
      item.program.memory.x={name:'x',kind:'variable',dataType:'int',mutable:true,initialized:true,value:10};
      return item;
    }

    state.mode='exam';
    state.examPolicy=snapshotExamPolicy({exam:{interactionMode:'strict-sequence'}});
    const continuing=itemFor(runtime([2,3,4,20,5],['+','*','-','/'],null));
    state.items=[continuing];state.itemIndex=0;state.profileId=continuing.profileId;
    let flat=currentProgramStatement(continuing).runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[1].id,rightId:flat.operands[2].id});
    flat=currentProgramStatement(continuing).runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const wrongOrderContinues=!continuing.checked&&!continuing.examSequenceFailure
      &&currentProgramStatement(continuing).runtime.trace.length===2
      &&currentProgramStatement(continuing).runtime.trace[0].wasCorrect===true
      &&currentProgramStatement(continuing).runtime.trace[1].wasCorrect===false;
    while(currentProgramStatement(continuing).kind==='declaration'
      &&currentProgramStatement(continuing).runtime.workingFlat.operators.length){
      flat=currentProgramStatement(continuing).runtime.workingFlat;
      const ready=collectReadyOperatorsFlat(flat,[])[0];
      handleTokenClick({type:'evaluate',leftId:ready.leftId,rightId:ready.rightId});
    }
    const derivedAfterWrongOrder=flatOperandValue(currentProgramStatement(continuing).runtime.workingFlat.operands[0]);
    handleTokenClick({type:'commit-assignment'});
    const chainContinued=continuing.program.cursor===1&&continuing.program.memory.x.value===derivedAfterWrongOrder
      &&!continuing.examSequenceFailure;
    handleCheck();
    const correctEvaluations=continuing.examActionLog.filter(entry=>entry.type==='evaluate'&&entry.wasCorrect===true).length;
    const wrongEvaluations=continuing.examActionLog.filter(entry=>entry.type==='evaluate'&&entry.wasCorrect===false).length;
    const firstWrongIndex=continuing.examActionLog.findIndex(entry=>entry.type==='evaluate'&&entry.wasCorrect===false);
    const laterCorrect=continuing.examActionLog.slice(firstWrongIndex+1)
      .some(entry=>entry.type==='evaluate'&&entry.wasCorrect===true);
    const independentCredit=continuing.checked&&continuing.wasCorrectFinal
      &&correctEvaluations>0&&wrongEvaluations>0&&laterCorrect
      &&continuing.points>0&&continuing.points<continuing.maxPoints;

    const computableWithPendingValue=itemFor(runtime([2,3,4],['+','*'],2));
    state.items=[computableWithPendingValue];state.itemIndex=0;state.profileId=computableWithPendingValue.profileId;
    flat=currentProgramStatement(computableWithPendingValue).runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const localPairContinues=currentProgramStatement(computableWithPendingValue).runtime.trace.length===1
      &&currentProgramStatement(computableWithPendingValue).runtime.trace[0].wasCorrect===false
      &&!computableWithPendingValue.examSequenceFailure;

    const terminal=itemFor(runtime([7,2],['+'],0));
    state.items=[terminal];state.itemIndex=0;state.profileId=terminal.profileId;
    flat=currentProgramStatement(terminal).runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const prematureTerminates=terminal.checked&&terminal.examSequenceFailure.terminal
      &&terminal.examSequenceFailure.reason==='operands-unresolved'
      &&terminal.program.status==='terminated'
      &&terminal.program.statements[0].status==='invalid'
      &&terminal.program.statements[1].status==='blocked'
      &&terminal.points===0&&terminal.examActionLog.some(entry=>entry.terminal===true);

    const prematureAssignment=assignmentItem(runtime([4,5],['+'],null));
    state.items=[prematureAssignment];state.itemIndex=0;state.profileId=prematureAssignment.profileId;
    handleTokenClick({type:'commit-assignment'});
    const prematureAssignmentTerminates=prematureAssignment.checked
      &&prematureAssignment.examSequenceFailure.reason==='assignment-value-unresolved'
      &&prematureAssignment.examSequenceFailure.terminal;

    state.examPolicy=snapshotExamPolicy({exam:{interactionMode:'guided'}});
    const guided=itemFor(runtime([7,2],['+'],0));
    state.items=[guided];state.itemIndex=0;state.profileId=guided.profileId;
    flat=currentProgramStatement(guided).runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const guidedUnchanged=!guided.checked&&!guided.examSequenceFailure
      &&currentProgramStatement(guided).runtime.trace.length===0;

    state.mode='practice';
    state.examPolicy=null;
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'strict-sequence'}});
    const recoverable=itemFor(runtime([7,2],['+'],0));
    state.items=[recoverable];state.itemIndex=0;state.profileId=recoverable.profileId;
    flat=currentProgramStatement(recoverable).runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const practicePaused=!recoverable.checked&&recoverable.practiceInvalidExecution
      &&recoverable.practiceInvalidExecution.reason==='operands-unresolved'
      &&canUndoForCurrentMode(recoverable)
      &&currentProgramStatement(recoverable).runtime.trace.length===0;
    handleUndo();
    const practiceRecovered=!recoverable.practiceInvalidExecution&&!recoverable.checked;

    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'guided'}});
    const guidedPractice=itemFor(runtime([7,2],['+'],0));
    state.items=[guidedPractice];state.itemIndex=0;state.profileId=guidedPractice.profileId;
    flat=currentProgramStatement(guidedPractice).runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const guidedPracticeUnchanged=!guidedPractice.practiceInvalidExecution
      &&currentProgramStatement(guidedPractice).runtime.trace.length===0;
    return JSON.stringify({wrongOrderContinues,chainContinued,independentCredit,localPairContinues,
      prematureTerminates,prematureAssignmentTerminates,guidedUnchanged,practicePaused,practiceRecovered,guidedPracticeUnchanged,
      strictDefault:snapshotExamPolicy({exam:{}}).interactionMode===DEFAULT_APP_SETTINGS.exam.interactionMode,
      practiceDefault:snapshotPracticePolicy({practice:{}}).interactionMode===DEFAULT_APP_SETTINGS.practice.interactionMode});
  })()`));
  assert.deepStrictEqual(result,{wrongOrderContinues:true,chainContinued:true,independentCredit:true,
    localPairContinues:true,prematureTerminates:true,prematureAssignmentTerminates:true,guidedUnchanged:true,practicePaused:true,
    practiceRecovered:true,guidedPracticeUnchanged:true,strictDefault:true,practiceDefault:true});
}

function testStateOnlySettingsPolicy(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js']);
  const stateFilename=path.join(ROOT,'js','state.js');
  const stateSource=fs.readFileSync(stateFilename,'utf8')
    .replace(/settingsPolicy: '(?:local-configurable|state-only)'/,"settingsPolicy: 'state-only'");
  vm.runInContext(stateSource,ctx,{filename:stateFilename});
  load(ctx,['settings-persistence.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    localStorage.setItem(APP_SETTINGS_KEY,JSON.stringify({
      mode:'exam',timerMinutes:99,
      practice:{interactionMode:'strict-sequence'},
      exam:{interactionMode:'strict-sequence'}
    }));
    localStorage.setItem('precedifyExamProgress:student@example.edu','preserved-attempt');
    loadPersistedAppSettings();
    const hardcodedOnly=settingsAreStateOnly()
      &&appSettings.settingsPolicy==='state-only'
      &&appSettings.mode===DEFAULT_APP_SETTINGS.mode
      &&appSettings.timerMinutes===DEFAULT_APP_SETTINGS.timerMinutes
      &&appSettings.practice.interactionMode===DEFAULT_APP_SETTINGS.practice.interactionMode
      &&appSettings.exam.interactionMode===DEFAULT_APP_SETTINGS.exam.interactionMode;
    const writeBlocked=savePersistedAppSettings()===false;
    const examPreserved=localStorage.getItem('precedifyExamProgress:student@example.edu')==='preserved-attempt';
    return JSON.stringify({hardcodedOnly,writeBlocked,examPreserved});
  })()`));
  assert.deepStrictEqual(result,{hardcodedOnly:true,writeBlocked:true,examPreserved:true});
}

function testInlineEvaluationActions(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js','state.js',
    'language.js','dom-helpers.js','render-tree.js','render-flat.js','render-declaration.js','render-assignment.js','render-session.js'
  ]);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    initializeSeededRandom(246810);
    const item=generateItemsForProfile('variables-arithmetic')[0];
    state.profileId='variables-arithmetic'; state.items=[item]; state.itemIndex=0; state.mode='practice';
    const initial=new FakeNode('div'); renderProgramItem(initial,item);
    const initialHasNoActions=countNodesWithClass(initial,'inline-eval-action')===0
      && countNodesWithClass(initial,'action-bar')===0;
    const sourceLabel='int '+item.resultName;
    const sourceAppearsOnce=initial.textContent.split(sourceLabel).length-1===1
      && countNodesWithClass(initial,'source-panel')===0
      && countNodesWithClass(initial,'source-assignment-equals')===1;
    const first=collectUnresolvedFlat(item.workingFlat,[])[0];
    handleTokenClick({type:'substitute',id:first.id});
    const progressed=new FakeNode('div'); renderProgramItem(progressed,item);
    const undoIsInline=countNodesWithClass(progressed,'inline-undo-action')===1
      && countNodesWithClass(progressed,'inline-check-action')===0
      && countNodesWithClass(progressed,'action-bar')===0;
    const continuationIsAligned=countNodesWithClass(progressed,'source-assignment-equals')===1
      && countNodesWithClass(progressed,'continuation-equals')===1
      && progressed.textContent.split(sourceLabel).length-1===1;
    while(collectUnresolvedFlat(item.workingFlat,[]).length){
      const node=collectUnresolvedFlat(item.workingFlat,[])[0];
      handleTokenClick({type:'substitute',id:node.id});
      const current=findFlatOperandById(item.workingFlat,node.id);
      if(current&&current.kind==='unary'&&current.substituted&&!current.resolved){
        handleTokenClick({type:'apply-unary',id:node.id});
      }
    }
    while(item.workingFlat.operands.length>1){
      const next=getMaxPrecCandidatesFlat(item.workingFlat)[0];
      handleTokenClick({type:'evaluate',leftId:next.leftId,rightId:next.rightId});
    }
    const resolved=new FakeNode('div'); renderProgramItem(resolved,item);
    const checkOnlyAtFinalLine=countNodesWithClass(resolved,'inline-check-action')===1
      && countNodesWithClass(resolved,'inline-undo-action')===1
      && countNodesWithClass(resolved,'action-bar')===0;
    resetRandomGenerator();
    return JSON.stringify({initialHasNoActions,sourceAppearsOnce,undoIsInline,continuationIsAligned,checkOnlyAtFinalLine});
  })()`));
  assert.deepStrictEqual(result,{initialHasNoActions:true,sourceAppearsOnce:true,undoIsInline:true,
    continuationIsAligned:true,checkOnlyAtFinalLine:true});
}

function testLegacyUnaryMutationCards(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','dom-helpers.js','render-tree.js','render-flat.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    function resolvedUnary(operator,form,value){
      const node=makeUnary(operator,form,makeNamed('variable','x',value));
      node.substituted=true;node.resolved=true;node.resultValue=unaryComputedValue(node);
      return node;
    }
    const prefix=resolvedUnary('++','prefix',12);
    const postfix=resolvedUnary('--','postfix',12);
    const logical=resolvedUnary('!','prefix',1);
    const prefixLive=renderInteractiveFlatOperand(prefix,new Map([[prefix.id,'#6fb7ff']]),'#ffa35c',prefix.id);
    const postfixHistory=renderStaticFlatOperand(postfix,new Map([[postfix.id,'#6fb7ff']]),postfix.id,null);
    const prefixCanonical=renderStaticExpr(prefix,0,new Map([[prefix.id,'#6fb7ff']]),prefix.id,null,null);
    const logicalValue=renderStaticExpr(logical,0,new Map([[logical.id,'#6fb7ff']]),logical.id,null,null);
    return JSON.stringify({
      prefixCard:countNodesWithClass(prefixLive,'unary-mutating-result-card')===1
        &&prefixLive.textContent.includes('x')&&prefixLive.textContent.includes('13'),
      postfixCard:countNodesWithClass(postfixHistory,'unary-mutating-result-card')===1
        &&postfixHistory.textContent.includes('x')&&postfixHistory.textContent.includes('12'),
      canonicalCard:countNodesWithClass(prefixCanonical,'unary-mutating-result-card')===1,
      logicalStaysLiteral:countNodesWithClass(logicalValue,'unary-mutating-result-card')===0
        &&logicalValue.textContent==='false'
    });
  })()`));
  assert.deepStrictEqual(result,{prefixCard:true,postfixCard:true,canonicalCard:true,logicalStaysLiteral:true});
}

function testInvalidExecutionAlertIsStatementScoped(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js','state.js',
    'language.js','dom-helpers.js','render-tree.js','render-flat.js','render-declaration.js','render-assignment.js','render-session.js'
  ]);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    initializeSeededRandom(556677);
    const item=generateItemsForProfile('assignment-rhs-expression')[0];
    state.profileId=item.profileId;state.items=[item];state.itemIndex=0;state.mode='practice';
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'strict-sequence'}});
    while(currentProgramStatement(item).kind==='declaration'){
      handleTokenClick({type:'commit-assignment'});
    }
    item.program.statements.filter(statement=>statement.kind==='declaration')
      .forEach(statement=>{statement._uiExpanded=true;statement._uiJustCompleted=false;});
    const failing=currentProgramStatement(item);
    handleTokenClick({type:'commit-assignment'});
    const explicitOrigin=item.practiceInvalidExecution.statementId===failing.id;
    const rendered=new FakeNode('div');renderProgramItem(rendered,item);
    const persistedFallback=Object.assign({},item.practiceInvalidExecution);
    delete persistedFallback.statementId;
    item.practiceInvalidExecution=persistedFallback;
    const fallbackMatchesCurrent=invalidExecutionBelongsToStatement(item,failing)
      &&!invalidExecutionBelongsToStatement(item,item.program.statements[0]);
    return JSON.stringify({
      originRecorded:item.practiceInvalidExecution.reason==='assignment-value-unresolved',
      oneAlert:countNodesWithClass(rendered,'invalid-execution-alert')===1,
      onePausedStatement:countNodesWithClass(rendered,'practice-paused')===1,
      explicitOrigin,
      fallbackMatchesCurrent
    });
  })()`));
  assert.deepStrictEqual(result,{originRecorded:true,oneAlert:true,onePausedStatement:true,
    explicitOrigin:true,fallbackMatchesCurrent:true});
}

function generatedSnapshotHash(){
  const ctx = context();
  load(ctx, ['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js']);
  const json = evaluate(ctx, `(()=>{
    __idCounter = 1;
    initializeSeededRandom(1592594996);
    const result = PROFILES.filter(p=>!p.program).map(p=>{
      const x = generateInstance(p);
      return {
        profile:p.id,
        source:renderString(x.tree),
        declarations:x.decls,
        resultName:x.resultName,
        correctFinalValue:x.correctFinalValue,
        canonical:x.canonicalTrace.steps.map(s=>({
          action:s.action, op:s.op || (s.target&&s.target.operator) || null,
          target:typeof s.target==='string'?s.target:null,
          result:s.result, sourceValue:s.sourceValue
        }))
      };
    });
    resetRandomGenerator();
    return JSON.stringify(result);
  })()`);
  return crypto.createHash('sha256').update(json).digest('hex');
}

function testParenthesesOverrideProfile(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    __idCounter=1;initializeSeededRandom(1592594996);
    const profile=PROFILES.find(candidate=>candidate.id==='parens-override');
    const items=Array.from({length:profile.itemCount},()=>{
      const generated=generateInstance(profile),flat=flattenInstance(generated.tree);
      return {source:renderString(generated.tree),flat:flatToString(flat),runs:computeParenRuns(flat).length};
    });
    resetRandomGenerator();
    return JSON.stringify({template:profile.template,items});
  })()`));
  assert.strictEqual(result.template,'(operand low operand) high operand low operand');
  assert.strictEqual(result.items.length,5);
  result.items.forEach(item=>{
    assert(item.source.includes('(')&&item.source.includes(')'));
    assert(item.flat.includes('(')&&item.flat.includes(')'));
    assert.strictEqual(item.runs,1);
  });
}

function testProgramCore(){
  const ctx = context();
  load(ctx, ['program-ir.js','program-core.js','legacy-expression-plugin.js']);
  const result = JSON.parse(evaluate(ctx, `(()=>{
    const oldItem = {profileId:'demo', canonicalTrace:{steps:[{action:'EVALUATE'}]}};
    let legacyCalls = 0;
    const legacyResult = dispatchProgramAction(oldItem, {type:'evaluate'}, {
      applyExpressionAction(){ legacyCalls++; return true; }
    });

    registerStatementPlugin({
      kind:'test-step',
      applyAction({statement}){
        return {applied:true, completed:true, event:{type:'TEST', id:statement.id}};
      },
      buildCanonicalTrace({statement}){ return [{type:'MODEL', id:statement.id}]; }
    });
    const chainItem = {program:createProgram([
      {id:'a', kind:'test-step'}, {id:'b', kind:'test-step'}
    ])};
    dispatchProgramAction(chainItem, {type:'go'});
    const cursorAfterFirst = chainItem.program.cursor;
    dispatchProgramAction(chainItem, {type:'go'});

    let rendered = '';
    registerStatementRenderer('test-step', ({statement})=>{ rendered=statement.id; });
    const renderItem = {program:createProgram([{id:'r',kind:'test-step'}])};
    renderProgramItem({}, renderItem);

    const assignment = assignmentStatement({
      target:'x', operator:'+=', value:identifierExpression('y')
    });
    let invalidRejected = false;
    try{ assignmentStatement({target:'x',operator:'**=',value:literalExpression(2)}); }
    catch(e){ invalidRejected = true; }

    return JSON.stringify({
      legacyKind:oldItem.program.statements[0].kind,
      legacyCalls, legacyApplied:legacyResult.applied,
      cursorAfterFirst,
      finalStatus:chainItem.program.status,
      eventCount:chainItem.program.events.length,
      modelCount:buildCanonicalProgramTrace(chainItem).length,
      rendered,
      assignmentOperator:assignment.operator,
      dependencies:[...collectExpressionDependencies(assignment.value)],
      invalidRejected
    });
  })()`));
  assert.deepStrictEqual(result, {
    legacyKind:'legacy-expression', legacyCalls:1, legacyApplied:true,
    cursorAfterFirst:1, finalStatus:'complete', eventCount:2,
    modelCount:2, rendered:'r', assignmentOperator:'+=',
    dependencies:['y'], invalidRejected:true
  });
}

function testLegacyExpressionIntegration(){
  const ctx = context();
  load(ctx, [
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','program-item-builder.js','state.js'
  ]);
  const result = JSON.parse(evaluate(ctx, `(()=>{
    initializeSeededRandom(424242);
    const item = generateItemsForProfile('variables-arithmetic')[0];
    state.profileId = 'variables-arithmetic';
    state.items = [item];
    state.itemIndex = 0;

    // The animation hook must defer the semantic substitution until its
    // arrival callback fires; with animation absent/off, the same handler
    // continues to apply immediately.
    const firstNode = collectUnresolvedFlat(item.workingFlat, [])[0];
    let delayedApply = null;
    animateVarFinalMemoryToExpression = (animatedItem,action,onArrive)=>{
      delayedApply = onArrive;
      return animatedItem===item && action.id===firstNode.id;
    };
    handleTokenClick({type:'substitute',id:firstNode.id});
    const animationDeferredMutation = item.trace.length===0 && typeof delayedApply==='function';
    delayedApply();
    delete animateVarFinalMemoryToExpression;

    while(collectUnresolvedFlat(item.workingFlat, []).length){
      const node = collectUnresolvedFlat(item.workingFlat, [])[0];
      handleTokenClick({type:'substitute', id:node.id});
      const now = findFlatOperandById(item.workingFlat, node.id);
      if(now && now.kind==='unary' && now.substituted && !now.resolved){
        handleTokenClick({type:'apply-unary', id:node.id});
      }
    }
    while(item.workingFlat.operands.length > 1){
      const next = getMaxPrecCandidatesFlat(item.workingFlat)[0];
      handleTokenClick({type:'evaluate', leftId:next.leftId, rightId:next.rightId});
    }
    handleCheck();
    return JSON.stringify({
      kind:item.program.statements[0].kind,
      checked:item.checked,
      animationDeferredMutation,
      correct:item.wasCorrectFinal,
      allStepsCorrect:item.correctSteps===item.totalOpSteps,
      fullPoints:item.points===item.maxPoints,
      serializable:!!JSON.parse(JSON.stringify(item)).program
    });
  })()`));
  assert.deepStrictEqual(result, {
    kind:'legacy-expression', checked:true, correct:true,
    animationDeferredMutation:true,
    allStepsCorrect:true, fullPoints:true, serializable:true
  });
}

function testDeclarationChain(){
  const ctx = context();
  installFakeDom(ctx);
  load(ctx, [
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','program-item-builder.js','state.js',
    'dom-helpers.js','render-tree.js','render-flat.js','var-final-state.js','render-declaration.js','render-session.js'
  ]);
  const result = JSON.parse(evaluate(ctx, `(()=>{
    initializeSeededRandom(987654);
    const generatedItems = generateItemsForProfile('declaration-chain');
    const item = generatedItems[0];
    state.profileId = 'declaration-chain';
    state.items = generatedItems;
    state.itemIndex = 0;
    const declarationCount = item.program.statements.filter(s=>s.kind==='declaration').length;
    const dependencyCounts = item.program.statements
      .filter(s=>s.kind==='declaration').map(s=>s.dependencies.length);
    const initialContainer = new FakeNode('div');
    renderProgramItem(initialContainer, item);
    const initialRenderHasDeclaration = countNodesWithClass(initialContainer,'program-workspace')===1
      && countNodesWithClass(initialContainer,'program-expression-panel')===1
      && countNodesWithClass(initialContainer,'program-progress-dot')===item.program.statements.length
      && countNodesWithClass(initialContainer,'program-summary-row')===item.program.statements.length-1;
    const initialRenderHasSource = !initialContainer.textContent.includes('Original statement')
      && initialContainer.textContent.includes(declarationKeyword(item.program.statements[0])+' ')
      && initialContainer.textContent.includes(' = ');
    const initialBindings = ensureBindings(item);
    const initialMemoryPanel = {
      count:initialBindings.length,
      constants:initialBindings.filter(b=>b.kind==='program-constant').length,
      allPending:initialBindings.every(b=>!resolveBindingLive(b,item).committed),
      renderedTitle:renderVariableFinalState(item).textContent.includes('Program variables and constants')
    };
    const secondItemBindings = ensureBindings(generatedItems[1]);
    const itemSwitchIsolated = secondItemBindings!==initialBindings
      && secondItemBindings.every(b=>!resolveBindingLive(b,generatedItems[1]).committed);

    // Verify cross-statement undo immediately after the first assignment.
    handleTokenClick({type:'commit-assignment'});
    const cursorAfterFirst = item.program.cursor;
    const firstAssignmentVisible = resolveBindingLive(initialBindings[0],item).displayValue
      === item.program.statements[0].runtime.expectedValue;
    handleUndo();
    const rewindWorked = item.program.cursor===0
      && Object.keys(item.program.memory).length===0
      && item.program.statements[0].runtime.checked===false;
    handleTokenClick({type:'commit-assignment'});
    handleReset();
    const resetWorked = item.program.cursor===0
      && Object.keys(item.program.memory).length===0
      && item.program.statements.every((s,i)=>s.status===(i===0?'active':'locked'));
    handleTokenClick({type:'commit-assignment'});

    while(currentProgramStatement(item).kind==='declaration'){
      const statement = currentProgramStatement(item);
      const runtime = statement.runtime;
      while(collectUnresolvedFlat(runtime.workingFlat, []).length){
        const node = collectUnresolvedFlat(runtime.workingFlat, [])[0];
        handleTokenClick({type:'substitute', id:node.id});
      }
      while(runtime.workingFlat.operands.length>1){
        const next = getMaxPrecCandidatesFlat(runtime.workingFlat)[0];
        handleTokenClick({type:'evaluate',leftId:next.leftId,rightId:next.rightId});
      }
      handleTokenClick({type:'commit-assignment'});
    }

    while(collectUnresolvedFlat(item.workingFlat, []).length){
      const node = collectUnresolvedFlat(item.workingFlat, [])[0];
      handleTokenClick({type:'substitute',id:node.id});
    }
    while(item.workingFlat.operands.length>1){
      const next = getMaxPrecCandidatesFlat(item.workingFlat)[0];
      handleTokenClick({type:'evaluate',leftId:next.leftId,rightId:next.rightId});
    }
    handleCheck();
    const model = buildCanonicalProgramTrace(item);
    const finalTarget = initialBindings.find(b=>b.kind==='target');
    const finalTargetLive = resolveBindingLive(finalTarget,item);
    return JSON.stringify({
      profileCount:PROFILES.length,
      declarationCount,
      statementCount:item.program.statements.length,
      dependencyCounts,
      initialRenderHasDeclaration,
      initialRenderHasSource,
      initialMemoryPanel,
      firstAssignmentVisible,
      itemSwitchIsolated,
      cursorAfterFirst,
      rewindWorked,
      resetWorked,
      memoryCount:Object.keys(item.program.memory).length,
      finalKind:currentProgramStatement(item).kind,
      declarationChecks:item.programScoreFacts.declarationTotalChecks,
      declarationChecksCorrect:item.programScoreFacts.declarationCorrectChecks,
      checked:item.checked,
      correct:item.wasCorrectFinal,
      fullPoints:item.points===item.maxPoints,
      modelAssignments:model.filter(e=>e.action==='ASSIGN').length,
      finalTargetVisible:finalTargetLive.committed
        && finalTargetLive.displayValue===item.correctFinalValue,
      serializable:!!JSON.parse(JSON.stringify(item)).program
    });
  })()`));
  assert.deepStrictEqual(result, {
    profileCount:33,
    declarationCount:4,
    statementCount:5,
    dependencyCounts:[0,1,1,1],
    initialRenderHasDeclaration:true,
    initialRenderHasSource:true,
    initialMemoryPanel:{count:5,constants:1,allPending:true,renderedTitle:true},
    firstAssignmentVisible:true,
    itemSwitchIsolated:true,
    cursorAfterFirst:1,
    rewindWorked:true,
    resetWorked:true,
    memoryCount:4,
    finalKind:'legacy-expression',
    declarationChecks:7,
    declarationChecksCorrect:7,
    checked:true,
    correct:true,
    fullPoints:true,
    modelAssignments:4,
    finalTargetVisible:true,
    serializable:true
  });
}

function testLegacyConstantsStayOutOfFinalState(){
  const ctx = context();
  installFakeDom(ctx);
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js','program-item-builder.js','state.js',
    'dom-helpers.js','var-final-state.js'
  ]);
  const result = JSON.parse(evaluate(ctx,`(()=>{
    initializeSeededRandom(445566);
    const item=generateItemsForProfile('variables-constants')[0];
    const constantNames=new Set(item.decls.filter(d=>d.kind==='constant').map(d=>d.name));
    const names=ensureBindings(item).map(b=>b.name);
    return JSON.stringify({constantCount:constantNames.size,leaked:names.filter(n=>constantNames.has(n)).length});
  })()`));
  assert(result.constantCount>0);
  assert.strictEqual(result.leaked,0);
}

function testAssignmentOperatorProfiles(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js','state.js',
    'language.js','dom-helpers.js','render-tree.js','render-flat.js','render-declaration.js','render-assignment.js','render-session.js'
  ]);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    initializeSeededRandom(778899);
    const profiles=PROFILES.filter(p=>p.program&&p.program.assignmentLesson);
    const operators=new Set();
    const cueWords={'+=':'Add','-=':'Subtract','*=':'Multiply','/=':'Divide','%=':'remainder'};
    const operationCuesCorrect=Object.entries(cueWords).every(([operator,word])=>
      compoundOperationInstruction({target:'x',operator,runtime:{rhsValue:6}}).includes(word));
    const mergeSymbolsCorrect=['+=','-=','*=','/=','%='].map(compoundArithmeticOperator).join(' ')
      ==='+ - * / %';
    const mergeTimingIsDeliberate=COMPOUND_MERGE_DURATION_MS>=2000
      && COMPOUND_WRITEBACK_DELAY_MS>COMPOUND_MERGE_DURATION_MS;
    let allCorrect=true, allFullPoints=true, constantWriteRejected=false,sharedRendererVisible=false,
      assignmentSourceVisible=false,compoundRequiresTarget=true,targetRevealVisible=false,
      compoundResultVisible=false,plainEqualsUnchanged=false,compoundUndoWorks=false,
      targetReadCreatesStep=false,targetReadCreatesRow=false,targetUndoRemovesStep=false;
    const statementCounts=[];
    profiles.forEach(profile=>{
      const item=generateItemsForProfile(profile.id)[0];
      state.profileId=profile.id; state.items=[item]; state.itemIndex=0;
      while(currentProgramStatement(item).kind!=='legacy-expression'){
        const statement=currentProgramStatement(item);
        const runtime=statement.runtime;
        while(collectUnresolvedFlat(runtime.workingFlat,[]).length){
          const node=collectUnresolvedFlat(runtime.workingFlat,[])[0];
          handleTokenClick({type:'substitute',id:node.id});
        }
        while(runtime.workingFlat.operands.length>1){
          const next=getMaxPrecCandidatesFlat(runtime.workingFlat)[0];
          handleTokenClick({type:'evaluate',leftId:next.leftId,rightId:next.rightId});
        }
        if(statement.kind==='assignment'){
          operators.add(statement.operator);
          if(!sharedRendererVisible){
            const container=new FakeNode('div');
            renderProgramItem(container,item);
            sharedRendererVisible=countNodesWithClass(container,'program-expression-panel')===1
              && countNodesWithClass(container,'program-workspace')===1;
            assignmentSourceVisible=!container.textContent.includes('Original statement')
              && container.textContent.includes(statement.target+' '+statement.operator);
          }
          if(isCompoundAssignment(statement)){
            const early=dispatchProgramAction(item,{type:'commit-assignment'},{applyExpressionAction});
            compoundRequiresTarget=compoundRequiresTarget&&!early.applied;
            const beforeReadTraceLength=statement.runtime.trace.length;
            handleTokenClick({type:'reveal-assignment-target'});
            const revealedContainer=new FakeNode('div');
            renderProgramItem(revealedContainer,item);
            const expectedRows=item.program.statements.reduce((sum,s)=>{
              const open=s===currentProgramStatement(item)||s._uiExpanded||s._uiJustCompleted;
              if(!open||!s.runtime) return sum+1;
              return sum+1+s.runtime.trace.length+
                (s.kind==='assignment'&&s.runtime.checked&&isCompoundAssignment(s)?1:0);
            },0);
            targetReadCreatesStep=targetReadCreatesStep||(
              statement.runtime.trace.length===beforeReadTraceLength+1
              && statement.runtime.trace[statement.runtime.trace.length-1].action==='READ_TARGET'
              && statement.runtime.history.length===statement.runtime.trace.length+1);
            targetReadCreatesRow=targetReadCreatesRow||
              countNodesWithClass(revealedContainer,'tl-row')===expectedRows;
            targetRevealVisible=targetRevealVisible||(
              statement.runtime.targetRevealed
              && revealedContainer.textContent.includes(String(statement.runtime.targetReadValue))
              && revealedContainer.textContent.includes(statement.operator));
            if(!compoundUndoWorks){
              handleUndo();
              compoundUndoWorks=!statement.runtime.targetRevealed;
              targetUndoRemovesStep=statement.runtime.trace.length===beforeReadTraceLength
                && statement.runtime.history.length===statement.runtime.trace.length+1;
              handleTokenClick({type:'reveal-assignment-target'});
            }
          } else {
            plainEqualsUnchanged=plainEqualsUnchanged||assignmentReadyToApply(statement);
          }
          if(profile.id==='assignment-dependent'&&!constantWriteRejected){
            const constantName=item.decls.find(d=>d.kind==='constant').name;
            const target=statement.target;
            statement.target=constantName;
            constantWriteRejected=!dispatchProgramAction(item,{type:'commit-assignment'},{applyExpressionAction}).applied;
            statement.target=target;
          }
        }
        const completedStatement=statement;
        handleTokenClick({type:'commit-assignment'});
        if(completedStatement.kind==='assignment'&&isCompoundAssignment(completedStatement)){
          const completedContainer=new FakeNode('div');
          renderProgramItem(completedContainer,item);
          compoundResultVisible=compoundResultVisible||completedContainer.textContent.includes(
            completedStatement.target+String(completedStatement.runtime.assignedValue));
        }
      }
      while(collectUnresolvedFlat(item.workingFlat,[]).length){
        const node=collectUnresolvedFlat(item.workingFlat,[])[0];
        handleTokenClick({type:'substitute',id:node.id});
      }
      while(item.workingFlat.operands.length>1){
        const next=getMaxPrecCandidatesFlat(item.workingFlat)[0];
        handleTokenClick({type:'evaluate',leftId:next.leftId,rightId:next.rightId});
      }
      handleCheck();
      allCorrect=allCorrect&&item.wasCorrectFinal;
      allFullPoints=allFullPoints&&item.points===item.maxPoints;
      statementCounts.push(item.program.statements.filter(s=>s.kind==='assignment').length);
    });
    resetRandomGenerator();
    return JSON.stringify({profileCount:profiles.length,operators:[...operators].sort(),allCorrect,allFullPoints,
      constantWriteRejected,sharedRendererVisible,assignmentSourceVisible,compoundRequiresTarget,
      targetRevealVisible,compoundResultVisible,plainEqualsUnchanged,compoundUndoWorks,
      targetReadCreatesStep,targetReadCreatesRow,targetUndoRemovesStep,
      operationCuesCorrect,mergeSymbolsCorrect,mergeTimingIsDeliberate,statementCounts});
  })()`));
  assert.deepStrictEqual(result,{
    profileCount:8,operators:['%=','*=','+=','-=','/=','='],allCorrect:true,allFullPoints:true,
    constantWriteRejected:true,sharedRendererVisible:true,assignmentSourceVisible:true,
    compoundRequiresTarget:true,targetRevealVisible:true,compoundResultVisible:true,plainEqualsUnchanged:true,
    compoundUndoWorks:true,
    targetReadCreatesStep:true,targetReadCreatesRow:true,targetUndoRemovesStep:true,
    operationCuesCorrect:true,mergeSymbolsCorrect:true,mergeTimingIsDeliberate:true,
    statementCounts:[1,2,1,2,1,3,2,3]
  });
}

function testStandaloneUnaryUpdateProfile(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','unary-update-statement-plugin.js',
    'program-item-builder.js','state.js','language.js','dom-helpers.js','render-tree.js','render-flat.js',
    'render-declaration.js','render-assignment.js','render-unary-update.js','render-session.js'
  ]);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    function activate(item,mode){
      state.profileId='unary-update-sequence';state.items=[item];state.itemIndex=0;
      state.mode=mode||'practice';state.examExpired=false;
    }
    function completeDeclarations(item){
      while(currentProgramStatement(item).kind==='declaration'){
        handleTokenClick({type:'commit-assignment'});
      }
    }
    function solveFinal(item){
      while(collectUnresolvedFlat(item.workingFlat,[]).length){
        const node=collectUnresolvedFlat(item.workingFlat,[])[0];
        handleTokenClick({type:'substitute',id:node.id});
      }
      while(item.workingFlat.operands.length>1){
        const next=getMaxPrecCandidatesFlat(item.workingFlat)[0];
        handleTokenClick({type:'evaluate',leftId:next.leftId,rightId:next.rightId});
      }
      handleCheck();
    }

    initializeSeededRandom(112233);
    const item=generateItemsForProfile('unary-update-sequence')[0];
    activate(item);
    const declarations=item.program.statements.filter(s=>s.kind==='declaration');
    const unaryStatements=item.program.statements.filter(s=>s.kind==='unary-update');
    const initialValues=Object.fromEntries(declarations.map(s=>[s.binding.name,s.runtime.expectedValue]));
    const shapeCorrect=declarations.length===2&&unaryStatements.length===4
      &&item.program.statements[item.program.statements.length-1].kind==='legacy-expression';
    const coverage=[...new Set(unaryStatements.map(s=>s.operator))].sort().join(',')==='++,--'
      &&[...new Set(unaryStatements.map(s=>s.form))].sort().join(',')==='postfix,prefix';
    completeDeclarations(item);

    const first=currentProgramStatement(item);
    const firstSource=programStatementSource(first,item);
    const initialRender=new FakeNode('div');renderProgramItem(initialRender,item);
    const sharedRenderer=countNodesWithClass(initialRender,'program-expression-panel')>=1
      &&countNodesWithClass(initialRender,'unary-update-eval-panel')===1
      &&initialRender.textContent.includes(firstSource.replace(';',''));
    const firstBefore=item.program.memory[first.target].value;
    const token=first.runtime.workingFlat.operands[0];
    handleTokenClick({type:'substitute',id:token.id});
    const twoPhaseRead=first.runtime.trace.length===1&&first.runtime.trace[0].action==='SUBSTITUTE';
    handleTokenClick({type:'apply-unary',id:token.id});
    const firstAfter=firstBefore+(first.operator==='++'?1:-1);
    const postfixStoresUpdated=first.runtime.checked
      &&first.runtime.trace[first.runtime.trace.length-1].action==='UNARY'
      &&first.runtime.trace[first.runtime.trace.length-1].result===firstAfter
      &&item.program.memory[first.target].value===firstAfter;
    const completedRender=new FakeNode('div');renderProgramItem(completedRender,item);
    const storedResultCard=countNodesWithClass(completedRender,'unary-update-stored-result')===1
      &&completedRender.textContent.includes(first.target)
      &&completedRender.textContent.includes(String(firstAfter));
    const firstSegment=canonicalProgramSegments(item)
      .find(segment=>segment.statement.id===first.id);
    const canonicalRender=renderCanonicalStatementSegment(
      firstSegment,firstSegment.length,firstSegment.start+firstSegment.length);
    const canonicalStoredResultCard=countNodesWithClass(
      canonicalRender,'unary-update-stored-result')===1;

    handleUndo();
    const rollbackWorks=currentProgramStatement(item)===first&&!first.runtime.checked
      &&first.runtime.trace.length===1&&item.program.memory[first.target].value===firstBefore;
    handleTokenClick({type:'apply-unary',id:token.id});

    while(currentProgramStatement(item).kind==='unary-update'){
      const statement=currentProgramStatement(item);
      const operand=statement.runtime.workingFlat.operands[0];
      handleTokenClick({type:'substitute',id:operand.id});
      handleTokenClick({type:'apply-unary',id:operand.id});
    }
    const firstName=declarations[0].binding.name,secondName=declarations[1].binding.name;
    const sequentialMemory=item.program.memory[firstName].value===initialValues[firstName]+2
      &&item.program.memory[secondName].value===initialValues[secondName]-2;
    const canonicalUnarySegments=canonicalProgramSegments(item)
      .filter(segment=>segment.statement.kind==='unary-update');
    const playbackComplete=canonicalUnarySegments.length===4
      &&canonicalUnarySegments.every(segment=>segment.length===2);
    solveFinal(item);
    const scoringComplete=item.wasCorrectFinal&&item.points===item.maxPoints
      &&item.programScoreFacts.programCorrectChecks===6
      &&item.programScoreFacts.programTotalChecks===6;

    const practiceInvalid=generateItemsForProfile('unary-update-sequence')[0];
    activate(practiceInvalid,'practice');
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'strict-sequence'}});
    completeDeclarations(practiceInvalid);
    const practiceStatement=currentProgramStatement(practiceInvalid);
    const practiceToken=practiceStatement.runtime.workingFlat.operands[0];
    handleTokenClick({type:'apply-unary',id:practiceToken.id});
    const strictPracticeRecovers=!!practiceInvalid.practiceInvalidExecution
      &&practiceInvalid.practiceInvalidExecution.reason==='unary-operand-unresolved';
    handleUndo();
    const strictPracticeUndone=!practiceInvalid.practiceInvalidExecution&&!practiceInvalid.checked;

    const examInvalid=generateItemsForProfile('unary-update-sequence')[0];
    activate(examInvalid,'exam');
    state.examPolicy=snapshotExamPolicy({exam:{interactionMode:'strict-sequence',allowUndo:true}});
    completeDeclarations(examInvalid);
    const examStatement=currentProgramStatement(examInvalid);
    const examToken=examStatement.runtime.workingFlat.operands[0];
    handleTokenClick({type:'apply-unary',id:examToken.id});
    const strictExamTerminates=examInvalid.checked&&examInvalid.examSequenceFailure.terminal
      &&examInvalid.examSequenceFailure.reason==='unary-operand-unresolved'
      &&!canUndoForCurrentMode(examInvalid);
    resetRandomGenerator();
    return JSON.stringify({shapeCorrect,coverage,sharedRenderer,twoPhaseRead,postfixStoresUpdated,
      storedResultCard,canonicalStoredResultCard,
      rollbackWorks,sequentialMemory,playbackComplete,scoringComplete,
      strictPracticeRecovers,strictPracticeUndone,strictExamTerminates});
  })()`));
  assert.deepStrictEqual(result,{
    shapeCorrect:true,coverage:true,sharedRenderer:true,twoPhaseRead:true,postfixStoresUpdated:true,
    storedResultCard:true,canonicalStoredResultCard:true,
    rollbackWorks:true,sequentialMemory:true,playbackComplete:true,scoringComplete:true,
    strictPracticeRecovers:true,strictPracticeUndone:true,strictExamTerminates:true
  });
}

function testStandaloneUnaryPanelUsesProgramConnectorFrame(){
  const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
  const sharedPanelRule=/\.declaration-eval-panel\s*,\s*\.assignment-eval-panel\s*,\s*\.unary-update-eval-panel\s*\{[^}]*position\s*:\s*relative\s*;[^}]*overflow-x\s*:\s*auto\s*;/s;
  assert(sharedPanelRule.test(css),
    'standalone unary timelines must share the declaration/assignment connector coordinate frame');
}

function testOldExamSaveGainsNewProfile(){
  const ctx = context();
  load(ctx, [
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js','state.js','exam-persistence.js'
  ]);
  const result = JSON.parse(evaluate(ctx, `(()=>{
    initializeSeededRandom(112233);
    const oldProfiles = {};
    PROFILES.filter(p=>!p.program).forEach(p=>{
      oldProfiles[p.id] = generateItemsForProfile(p.id);
    });
    oldProfiles['direct-ltr'][0].points = 0.75;
    localStorage.setItem(examProgressKey('old@example.edu'), JSON.stringify({
      email:'old@example.edu', studentId:'OLD-1', profileId:'direct-ltr',
      itemIndex:0, itemIndexByProfile:{}, sessionSeed:112233,
      itemsByProfile:oldProfiles, showConnectors:true, timerMinutes:15,
      examEndTimestamp:Date.now()+600000
    }));
    const resumed = tryResumeExamSession('old@example.edu');
    return JSON.stringify({
      resumed,
      profileCount:Object.keys(state.itemsByProfile).length,
      preservedScore:state.itemsByProfile['direct-ltr'][0].points,
      policyMigrated:state.examPolicy.showCorrectSolution===false&&state.examPolicy.lockItemAfterCheck===true,
      addedKind:state.itemsByProfile['declaration-chain'][0].program.mode,
      addedAssignmentKind:state.itemsByProfile['assignment-basic'][0].program.mode
    });
  })()`));
  assert.deepStrictEqual(result, {
    resumed:true, profileCount:33, preservedScore:0.75,policyMigrated:true,
    addedKind:'interactive-declarations',addedAssignmentKind:'interactive-program'
  });
}

function testCanonicalProgramPlayback(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js','state.js',
    'language.js','dom-helpers.js','render-tree.js','render-flat.js','render-declaration.js','render-assignment.js','render-session.js'
  ]);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    initializeSeededRandom(97531);
    const item=generateItemsForProfile('assignment-add-sub')[0];
    state.profileId='assignment-add-sub'; state.items=[item]; state.itemIndex=0; state.mode='practice';
    item.showSolution=true; item.playback={index:0,playing:false};
    const total=canonicalPlaybackTotal(item);
    const finalOnly=item.canonicalTrace.steps.length;
    const firstCompound=canonicalProgramSegments(item).find(s=>s.kind==='statement'
      &&s.statement.kind==='assignment'&&isCompoundAssignment(s.statement));
    item.playback.index=firstCompound.start+1;
    const targetStage=renderCanonicalProgramPlayback(item,item.resultName,item.resultName.length+1);
    const targetRuntime=canonicalStatementRuntime(firstCompound.statement,1);
    const targetReadShown=targetRuntime.targetRevealed&&targetRuntime.trace.length===1
      &&targetRuntime.trace[0].action==='READ_TARGET'
      &&countNodesWithClass(targetStage,'tl-row')>0;
    item.playback.index=total;
    const complete=renderCanonicalProgramPlayback(item,item.resultName,item.resultName.length+1);
    const statementCount=item.program.statements.filter(s=>s.kind==='declaration'||s.kind==='assignment').length;
    const expressionStepCount=item.program.statements
      .filter(s=>s.kind==='declaration'||s.kind==='assignment')
      .reduce((sum,s)=>sum+s.runtime.canonicalTrace.steps.length,0);
    const expectedCommitRows=statementCount;
    resetRandomGenerator();
    return JSON.stringify({
      totalIncludesProgram:total>finalOnly,
      allStatementsShown:countNodesWithClass(complete,'canonical-program-statement')===statementCount,
      expressionStepsShown:countNodesWithClass(complete,'canonical-program-expression-panel')===statementCount,
      commitRowsShown:countNodesWithClass(complete,'canonical-assignment-result-row')
        +countNodesWithClass(complete,'compound-result-row')===expectedCommitRows,
      finalShown:countNodesWithClass(complete,'canonical-final-playback')===1,
      targetReadShown,
      totalMatches:total===expressionStepCount+statementCount
        +item.program.statements.filter(s=>s.kind==='assignment'&&isCompoundAssignment(s)).length
        +finalOnly+canonicalProgramSegments(item).length-1
    });
  })()`));
  assert.deepStrictEqual(result,{totalIncludesProgram:true,allStatementsShown:true,
    expressionStepsShown:true,commitRowsShown:true,finalShown:true,targetReadShown:true,totalMatches:true});
}

function testExamSettingsAndTimeoutPolicy(){
  const ctx=context();
  load(ctx,[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js'
  ]);
  const stateFilename=path.join(ROOT,'js','state.js');
  const stateSource=fs.readFileSync(stateFilename,'utf8').replace(
    "settingsPolicy: 'state-only'","settingsPolicy: 'local-configurable'");
  vm.runInContext(stateSource,ctx,{filename:stateFilename});
  load(ctx,['settings-persistence.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    localStorage.setItem(APP_SETTINGS_KEY,JSON.stringify({mode:'exam',timerMinutes:45,
      exam:{allowUndo:false,feedbackRelease:'never'}}));
    loadPersistedAppSettings();
    const migratedDefaults=appSettings.exam.allowReviewFlags===true
      &&appSettings.exam.showCorrectSolution===false&&appSettings.exam.lockItemAfterCheck===true;
    state.mode='exam';
    state.examPolicy=snapshotExamPolicy(appSettings);
    appSettings.exam.allowUndo=true;
    const snapshotStable=activeExamPolicy().allowUndo===false;
    state.examPolicy=Object.assign({},state.examPolicy,{allowUndo:true});

    localStorage.setItem('precedifyLogin','saved');
    localStorage.setItem('precedifyExamProgress:a','a');
    localStorage.setItem('precedifyExamProgress:b','b');
    const clearedAttempts=clearAllExamProgressEverywhere();
    const scopedPurge=clearedAttempts===2&&localStorage.getItem(APP_SETTINGS_KEY)!==null
      &&localStorage.getItem('precedifyLogin')==='saved';

    initializeSeededRandom(13579);
    const profile=PROFILES[0];
    const item=generateItemsForProfile(profile.id)[0];
    state.itemsByProfile={[profile.id]:[item]};state.items=[item];state.itemIndex=0;
    state.examExpired=false;state.screen='session';
    const candidate=getMaxPrecCandidatesFlat(item.workingFlat)[0];
    handleTokenClick({type:'evaluate',leftId:candidate.leftId,rightId:candidate.rightId});
    handleUndo();
    const auditPreserved=item.trace.length===0&&item.examActionLog.length===2
      &&item.examActionLog[0].type==='evaluate'&&item.examActionLog[1].type==='undo';
    item.flagged=true;
    const expired=expireExam();
    const pointsAtExpiry=item.points;
    const traceLengthAtExpiry=item.trace.length;
    handleTokenClick({type:'evaluate',leftId:candidate.leftId,rightId:candidate.rightId});
    const timeoutLocks=expired&&state.examExpired&&state.screen==='session'
      &&item.points===pointsAtExpiry&&item.flagged&&item.trace.length===traceLengthAtExpiry
      &&examResultsVisible()&&examInteractionLocked();
    item.showSolution=false;toggleSolution();
    const solutionBlocked=!item.showSolution;

    localStorage.setItem('precedifyExamProgress:c','c');
    const removedAll=clearAllPrecedifyLocalData();
    const fullPurge=removedAll>=3&&localStorage.getItem(APP_SETTINGS_KEY)===null
      &&localStorage.getItem('precedifyLogin')===null&&localStorage.getItem('precedifyExamProgress:c')===null
      &&appSettings.mode===DEFAULT_APP_SETTINGS.mode;
    resetRandomGenerator();
    return JSON.stringify({migratedDefaults,snapshotStable,scopedPurge,auditPreserved,timeoutLocks,solutionBlocked,fullPurge});
  })()`));
  assert.deepStrictEqual(result,{migratedDefaults:true,snapshotStable:true,scopedPurge:true,auditPreserved:true,
    timeoutLocks:true,solutionBlocked:true,fullPurge:true});
}

function run(){
  testScriptManifestParses();
  testPracticeRetryPlacement();
  testTokenClassificationPlugin();
  testFallingTokenSortMultiple();
  testSimulateOutputPlugin();
  testInlineEvaluationActions();
  testLegacyUnaryMutationCards();
  testInvalidExecutionAlertIsStatementScoped();
  const hash = generatedSnapshotHash();
  assert.strictEqual(hash, '8a2a85b83925b9a726fbce6351d76c7cb59b96bb87779f66064422e74378f53b');
  testParenthesesOverrideProfile();
  testProgramCore();
  testLegacyExpressionIntegration();
  testDeclarationChain();
  testLegacyConstantsStayOutOfFinalState();
  testAssignmentOperatorProfiles();
  testStandaloneUnaryUpdateProfile();
  testStandaloneUnaryPanelUsesProgramConnectorFrame();
  testOldExamSaveGainsNewProfile();
  testCanonicalProgramPlayback();
  testExamSettingsAndTimeoutPolicy();
  testStrictExamSequencePolicy();
  testStateOnlySettingsPolicy();
  testManualResponseProfilesAndPropagation();
  testManualResponseResolvedUnaryOperands();
  console.log('All CodeScope compatibility and extension tests passed.');
}

function testTokenClassificationPlugin(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js']);
  const profilesFile=path.join(ROOT,'js','profiles.js');
  const profileSource=fs.readFileSync(profilesFile,'utf8')
    // Keep the hidden lessons out of the live catalog while exercising their
    // original integration coverage in this isolated VM.
    .replace(/,\s*\/\*\s*(?=\{\s*(?:enabled:(?:true|false),\s*)?meta:\{id:'token-identifier-position')/,',\n')
    .replace(/,\s*\*\/\s*(?=\{\s*(?:enabled:(?:true|false),\s*)?meta:\{id:'falling-identifier-sort')/,',\n')
    .replace(/enabled:false,(\s*meta:\{id:'token-identifier-position')/,'enabled:true,$1')
    .replace(/enabled:false,(\s*meta:\{id:'token-declaration-complete')/,'enabled:true,$1')
    .replace(/enabled:false,(\s*meta:\{id:'token-program-chain')/,'enabled:true,$1');
  vm.runInContext(profileSource,ctx,{filename:profilesFile});
  load(ctx,['language.js',
    'program-ir.js','program-core.js','activity-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','unary-update-statement-plugin.js','program-item-builder.js']);
  loadRelative(ctx,[
    'plugins/token-classification/manifest.js','plugins/token-classification/languages/c.js',
    'plugins/token-classification/languages/java.js','plugins/token-classification/identifier-generator.js',
    'plugins/token-classification/classifier.js',
    'plugins/token-classification/generator.js','plugins/token-classification/actions.js',
    'plugins/token-classification/modal.js','plugins/token-classification/feedback.js',
    'plugins/token-classification/renderer.js','plugins/token-classification/plugin.js'
  ]);
  load(ctx,['state.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const activityProfiles=PROFILES.filter(profile=>profile.activity);
    const identifierProfile=activityProfiles.find(profile=>profile.id==='token-identifier-position');
    const declarationProfile=activityProfiles.find(profile=>profile.id==='token-declaration-complete');
    const chainProfile=activityProfiles.find(profile=>profile.id==='token-program-chain');
    state.mode='practice';state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'guided'}});
    state.language='java';initializeSeededRandom(90210);
    const first=generateItemsForProfile('token-identifier-position')[0];
    const firstTarget=tcTokenById(first,first.targetIds[0]);
    firstTarget.text='class';tcAnalyzeToken(firstTarget,'java');
    const selectResult=tcApplyAction({item:first,profile:identifierProfile,action:{type:'SELECT_TOKEN',tokenId:firstTarget.id},state});
    const classifyResult=tcApplyAction({item:first,profile:identifierProfile,action:{type:'CLASSIFY_TOKEN',tokenId:firstTarget.id,category:'invalid-identifier'},state});
    const checked=tcCheck({item:first,profile:identifierProfile,state});
    const retried=tcRetry({item:first});
    const preservedAfterRetry=tcResponseFor(first,firstTarget.id)?.category||null;
    const changed=tcApplyAction({item:first,profile:identifierProfile,action:{type:'CLASSIFY_TOKEN',tokenId:firstTarget.id,category:'valid-identifier'},state});
    const changedCategory=tcResponseFor(first,firstTarget.id).category;
    const changeUndo=tcUndo({item:first});
    const restoredCategory=tcResponseFor(first,firstTarget.id)?.category||null;
    tcApplyAction({item:first,profile:identifierProfile,action:{type:'CLASSIFY_TOKEN',tokenId:firstTarget.id,category:'invalid-identifier'},state});
    const rechecked=tcCheck({item:first,profile:identifierProfile,state});
    const complete=generateItemsForProfile('token-declaration-complete')[0];
    const chain=generateItemsForProfile('token-program-chain')[0];resetRandomGenerator();
    const separator=tcAllTokens(complete).find(token=>token.position==='separator');
    const identifier=tcAllTokens(complete).find(token=>token.position==='declaration-name');
    identifier.text='class';tcAnalyzeToken(identifier,'java');

    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'strict-sequence'}});
    initializeSeededRandom(77);const blocked=generateItemsForProfile('token-identifier-position')[0];resetRandomGenerator();
    const offTarget=tcAllTokens(blocked).find(token=>token.position==='separator');
    const blockedResult=tcApplyOffTarget(blocked,identifierProfile,offTarget);
    const undoResult=tcUndo({item:blocked});

    state.mode='exam';state.examPolicy=snapshotExamPolicy({exam:{interactionMode:'strict-sequence'}});
    initializeSeededRandom(88);const terminal=generateItemsForProfile('token-identifier-position')[0];resetRandomGenerator();
    const terminalTarget=tcTokenById(terminal,terminal.targetIds[0]);
    tcApplyAction({item:terminal,profile:identifierProfile,action:{type:'SELECT_TOKEN',tokenId:terminalTarget.id},state});
    const terminalOffTarget=tcAllTokens(terminal).find(token=>token.position==='separator');
    const terminalResult=tcApplyOffTarget(terminal,identifierProfile,terminalOffTarget);

    const configurable=JSON.parse(JSON.stringify(identifierProfile));
    configurable.activity.interaction.policies['exam:strict-sequence'].selectable.exclude=[{match:{positions:['separator']}}];
    const excludedSeparator=!tcSelectableIds(terminal,configurable).includes(terminalOffTarget.id);
    return JSON.stringify({
      ids:activityProfiles.map(profile=>profile.id),firstLanguage:first.language,targetPosition:firstTarget.position,
      contextualIdentifier:firstTarget.contextualCategory,lexicalIdentifier:firstTarget.lexicalCategory,
      selectApplied:selectResult.applied,classifyApplied:classifyResult.applied,firstChecked:checked.applied,
      retried:retried.applied,preservedAfterRetry,changed:changed.applied,changedCategory,changeUndo:changeUndo.applied,restoredCategory,rechecked:rechecked.applied,
      firstCorrect:first.wasCorrectFinal,firstPoints:first.points,firstChecks:first.totalOpSteps,bonus:first.checkResults.filter(result=>result.bonus).length,
      completeTargets:complete.targetIds.length,completeHasSeparatorTarget:complete.targetIds.includes(separator.id),separatorCategory:separator.contextualCategory,
      declarationReservedInIdentifierPosition:identifier.contextualCategory,
      chainStatements:chain.statements.map(statement=>statement.kind),chainTargets:chain.targetIds.length,
      javaDollar:tcClassifyToken({text:'$rate',role:'word'},'java'),cDollar:tcClassifyToken({text:'$rate',role:'word'},'c'),
      trace:tokenClassificationPlugin.buildCanonicalTrace({item:chain,profile:chainProfile}).length,
      blocked:blockedResult.blocked,undoApplied:undoResult.applied,blockCleared:blocked.invalidSelection===null,
      terminal:terminalResult.terminal,terminalChecked:terminal.checked,terminalPoints:terminal.points,excludedSeparator
    });
  })()`));
  assert.deepStrictEqual(result.ids,['token-identifier-position','token-declaration-complete','token-program-chain']);
  assert.strictEqual(result.firstLanguage,'java');assert.strictEqual(result.targetPosition,'declaration-name');
  assert.strictEqual(result.contextualIdentifier,'invalid-identifier');assert.strictEqual(result.lexicalIdentifier,'reserved-word');
  assert.strictEqual(result.selectApplied,true);assert.strictEqual(result.classifyApplied,true);
  assert.strictEqual(result.retried,true);assert.strictEqual(result.preservedAfterRetry,null);
  assert.strictEqual(result.changed,true);assert.strictEqual(result.changedCategory,'valid-identifier');
  assert.strictEqual(result.changeUndo,true);assert.strictEqual(result.restoredCategory,null);assert.strictEqual(result.rechecked,true);
  assert.strictEqual(result.firstChecked,true);assert.strictEqual(result.firstCorrect,true);assert.strictEqual(result.firstPoints,3);
  assert.strictEqual(result.firstChecks,2);assert.strictEqual(result.bonus,1);
  assert(result.completeTargets>=5);assert.strictEqual(result.completeHasSeparatorTarget,true);assert.strictEqual(result.separatorCategory,'separator');
  assert.strictEqual(result.declarationReservedInIdentifierPosition,'invalid-identifier');
  assert.deepStrictEqual(result.chainStatements,['declaration','declaration','assignment','assignment']);assert(result.chainTargets>=15);
  assert.strictEqual(result.javaDollar,'valid-identifier');assert.strictEqual(result.cDollar,'invalid-identifier');
  assert.strictEqual(result.trace,result.chainTargets);
  assert.strictEqual(result.blocked,true);assert.strictEqual(result.undoApplied,true);assert.strictEqual(result.blockCleared,true);
  assert.strictEqual(result.terminal,true);assert.strictEqual(result.terminalChecked,true);assert.strictEqual(result.terminalPoints,1);
  assert.strictEqual(result.excludedSeparator,true);
}

function testSimulateOutputPlugin(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','activity-core.js']);
  loadRelative(ctx,[
    'plugins/simulate-output/manifest.js',
    'plugins/simulate-output/generator.js','plugins/simulate-output/actions.js',
    'plugins/simulate-output/feedback.js','plugins/simulate-output/renderer.js',
    'plugins/simulate-output/plugin.js'
  ]);
  load(ctx,['state.js']);
  ctx.document={querySelector:()=>null};
  ctx.savedEdits=0;
  ctx.saveSessionProgress=()=>{ctx.savedEdits++;};
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'plugins','simulate-output','exercises','c','it3-midterm-a','manifest.json'),'utf8'));
  const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(
    path.join(ROOT,'plugins','simulate-output','exercises','c','it3-midterm-a',filename),'utf8')}));
  rows.push({filename:'Unlisted.c',raw:rows[0].raw});
  ctx.testManifest=manifest;ctx.testExerciseRows=rows;
  evaluate(ctx,"soInstallExerciseBank('plugins/simulate-output/exercises/c/it3-midterm-a/manifest.json','c','it3-midterm-a',testManifest,testExerciseRows)");
  ctx.javaManifest={title:'Java - Simulate Output',exercises:['Hello.java']};
  ctx.javaRows=[{filename:'Hello.java',raw:'/*\n@output\nHello\n@variables\ncount = 1\n*/\npublic class Hello { public static void main(String[] args) { System.out.println("Hello"); } }'}];
  evaluate(ctx,"soInstallExerciseBank('plugins/simulate-output/exercises/java/java-basics/manifest.json','java','java-basics',javaManifest,javaRows)");
  const catalog=JSON.parse(evaluate(ctx,"JSON.stringify(soCatalog(PROFILES.find(profile=>profile.id==='c-simulate-output'),'c'))"));
  assert.strictEqual(catalog.length,19);
  catalog.forEach(exercise=>{
    const source=fs.readFileSync(path.join(ROOT,'plugins','simulate-output','exercises','c','it3-midterm-a',exercise.filename),'utf8')
      .replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    assert.strictEqual(exercise.raw,source);
  });
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const profile=PROFILES.find(candidate=>candidate.id==='c-simulate-output');
    const javaProfile={id:'java-output',activity:{generator:{exerciseSet:'java-basics',shuffle:false}}};
    const javaItem=soGenerateItem({profile:javaProfile,index:0,language:'java',generationContext:{}});
    state.mode='practice';initializeSeededRandom(1234);
    const count=simulateOutputPlugin.itemCount({profile,language:'c'});
    const contextA={},items=Array.from({length:count},(_,index)=>
      soGenerateItem({profile,index,language:'c',generationContext:contextA}));
    initializeSeededRandom(1234);
    const contextB={},repeat=Array.from({length:count},(_,index)=>
      soGenerateItem({profile,index,language:'c',generationContext:contextB}));
    const item=items.find(candidate=>candidate.variables.length>0);
    const metadataHidden=!item.source.includes('@output')&&!item.source.includes('@variables');
    state.profileId=profile.id;
    soEdit(item,{type:'SET_OUTPUT',value:'typing'});
    const typingSaved=savedEdits===1&&item.response.output==='typing';
    soApplyAction({item,action:{type:'SET_OUTPUT',value:item.expectedLines.join('\\n')}});
    item.variables.forEach((variable,index)=>{
      if(Array.isArray(variable.expected))variable.expected.forEach((value,part)=>
        soApplyAction({item,action:{type:'SET_VARIABLE',index,element:part,value}}));
      else soApplyAction({item,action:{type:'SET_VARIABLE',index,value:variable.expected}});
    });
    const full=soCheck({item,profile,state});
    const fullScore=item.points;
    const fullMaximum=item.maxPoints;
    const traceMatches=soCanonicalTrace({item}).length===item.totalOpSteps;
    item._feedbackAnimated=true;
    const retry=soRetry({item});
    const resetClean=!soHasResponse(item)&&!item.checked&&item.points===null
      &&item._feedbackAnimated===false;
    soApplyAction({item,action:{type:'SET_OUTPUT',value:item.expectedLines.join('\\n')+'\\nEXTRA'}});
    const extra=soScoreResponse(item);
    state.mode='exam';state.examPolicy={feedbackRelease:'after-timeout'};
    const restored=JSON.parse(JSON.stringify(item));
    const snapshotStable=restored.response.output===item.response.output
      &&restored.source===item.source&&restored.expectedLines.length===item.expectedLines.length;
    soCheck({item:restored,profile,state});
    const withheld=!soFeedbackReleased(restored);state.examExpired=true;
    const released=soFeedbackReleased(restored);
    resetRandomGenerator();
    return JSON.stringify({profileActive:!!profile,javaLoaded:javaItem.language==='java'
        &&javaItem.filename==='Hello.java'&&javaItem.maxPoints===2,count:items.length,
      unique:new Set(items.map(candidate=>candidate.exerciseId)).size,
      manifestOrder:items.map(candidate=>candidate.filename).join(',')===testManifest.exercises.join(','),
      deterministic:items.map(candidate=>candidate.exerciseId).join(',')
        ===repeat.map(candidate=>candidate.exerciseId).join(','),
      allC:items.every(candidate=>candidate.language==='c'),metadataHidden,typingSaved,
      full:full.applied,metadataScoring:fullScore===fullMaximum,traceMatches,retry:retry.applied,resetClean,
      bankMaximum:items.reduce((sum,candidate)=>sum+activityItemMaxPoints(candidate,profile),0),
      extraPenalty:extra.outputCorrect===item.expectedLines.length-1,
      snapshotStable,withheld,released});
  })()`));
  assert.deepStrictEqual(result,{profileActive:true,javaLoaded:true,count:19,unique:19,manifestOrder:true,deterministic:true,
    allC:true,metadataHidden:true,typingSaved:true,full:true,metadataScoring:true,
    traceMatches:true,bankMaximum:184,
    retry:true,resetClean:true,
    extraPenalty:true,snapshotStable:true,withheld:true,released:true});
}

function testFallingTokenSortMultiple(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,['dom-helpers.js']);
  loadRelative(ctx,['plugins/falling-token-sort/manifest.js','plugins/falling-token-sort/generator.js',
    'plugins/falling-token-sort/actions.js','plugins/falling-token-sort/feedback.js',
    'plugins/falling-token-sort/renderer.js']);
  ctx.roundPoints=value=>Math.round(value*100)/100;
  ctx.state={mode:'practice',examExpired:false};
  ctx.tcValidateIdentifierGeneration=()=>{};
  ctx.registerActivityPlugin=plugin=>plugin;
  ctx.TC_CATEGORY_DEFS={
    'valid-identifier':{label:'Valid Identifier',tone:'valid',icon:'fa-check'},
    'invalid-identifier':{label:'Invalid Identifier',tone:'invalid',icon:'fa-xmark'},
    'reserved-word':{label:'Reserved Word',tone:'reserved',icon:'fa-lock'},
    'arithmetic-operator':{label:'Arithmetic',tone:'arithmetic',icon:'fa-calculator'},
    'relational-operator':{label:'Relational',tone:'relational',icon:'fa-scale-balanced'},
    'boolean-operator':{label:'Boolean',tone:'boolean',icon:'fa-code-branch'},
    'assignment-operator':{label:'Assignment',tone:'assignment',icon:'fa-arrow-right-to-bracket'},
    'operator-distractor':{label:'Not an operator',tone:'distractor',icon:'fa-ban'}
  };
  loadRelative(ctx,['plugins/falling-token-sort/plugin.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const profile={id:'multi-test',pointsPerItem:3,activity:{dropArea:{visibleTokens:3},buckets:[
      {id:'valid',category:'valid-identifier',region:'left',order:1},
      {id:'invalid',category:'invalid-identifier',region:'left',order:2},
      {id:'reserved',category:'reserved-word',region:'left',order:3}
    ],generator:{capability:'analyzed-token-generation',identifierGeneration:{},policies:{
      practice:{totalTokens:{target:4},counts:{'valid-identifier':{min:1,max:2},'invalid-identifier':{min:1,max:2},'reserved-word':{min:1,max:2}}},
      exam:{totalTokens:{exact:3},counts:{'valid-identifier':1,'invalid-identifier':1,'reserved-word':1}}
    }},assessment:{action:'SORT_TOKEN',cardinality:'per-token',scoreAttempt:'first',completion:'all-tokens-placed'},response:{policies:{
      practice:{incorrectPlacement:'return-token'},exam:{incorrectPlacement:'accept'}
    }},feedback:{practice:'immediate-return',exam:'deferred-until-timeout'}}};
    ftsValidateProfile(profile);
    const operatorProfile={id:'operator-test',pointsPerItem:30,activity:{dropArea:{visibleTokens:10,landingBehavior:'pass-through'},buckets:[
      {id:'arithmetic',category:'arithmetic-operator',region:'left',order:1},
      {id:'relational',category:'relational-operator',region:'left',order:2},
      {id:'boolean',category:'boolean-operator',region:'right',order:1},
      {id:'assignment',category:'assignment-operator',region:'right',order:2},
      {id:'distractor',category:'operator-distractor',region:'bottom',order:1}
    ],generator:{capability:'canonical-token-pools',tokenPools:{
      'arithmetic-operator':['+','-','*','/','%'],'relational-operator':['<','>','<=','>=','==','!='],
      'boolean-operator':['&&','||','!'],'assignment-operator':['=','+=','-=','*=','/=','%='],
      'operator-distractor':['value','count','42','3.14','true','false',';',',','(',')']
    },policies:{practice:{totalTokens:{exact:30},counts:{
      'arithmetic-operator':{exact:5},'relational-operator':{exact:6},'boolean-operator':{exact:3},
      'assignment-operator':{exact:6},'operator-distractor':{exact:10}
    },shuffle:true},exam:{totalTokens:{exact:30},counts:{
      'arithmetic-operator':{exact:5},'relational-operator':{exact:6},'boolean-operator':{exact:3},
      'assignment-operator':{exact:6},'operator-distractor':{exact:10}
    },shuffle:true}}},assessment:{action:'SORT_TOKEN',cardinality:'per-token',scoreAttempt:'first',completion:'all-tokens-placed'},
    response:{policies:{practice:{incorrectPlacement:'return-token'},exam:{incorrectPlacement:'accept'}}},
    feedback:{practice:'immediate-return',exam:'deferred-until-timeout'}}};
    ftsValidateProfile(operatorProfile);
    seededRandom=()=>.37;state.mode='practice';
    const operatorC=ftsGenerateItem({profile:operatorProfile,index:0,language:'c',generationContext:{}});
    seededRandom=()=>.37;state.mode='exam';
    const operatorJava=ftsGenerateItem({profile:operatorProfile,index:0,language:'java',generationContext:{}});
    const expectedOperatorCounts={'arithmetic-operator':5,'relational-operator':6,'boolean-operator':3,
      'assignment-operator':6,'operator-distractor':10};
    const expectedOperatorTokens=['+','-','*','/','%','<','>','<=','>=','==','!=','&&','||','!',
      '=','+=','-=','*=','/=','%=','value','count','42','3.14','true','false',';',',','(',')'];
    const operatorProfilesValid=[operatorC,operatorJava].every(item=>item.tokens.length===30
      &&item.generatedTokenTarget===30&&new Set(item.tokens.map(token=>token.text)).size===30
      &&expectedOperatorTokens.every(token=>item.tokens.some(candidate=>candidate.text===token))
      &&Object.entries(expectedOperatorCounts).every(([category,count])=>item.generatedCounts[category]===count))
      &&operatorC.language==='c'&&operatorJava.language==='java';
    state.mode='practice';
    const invalidProfile=JSON.parse(JSON.stringify(profile));invalidProfile.activity.dropArea.visibleTokens=0;
    let invalidRejected=false;try{ftsValidateProfile(invalidProfile)}catch(error){invalidRejected=true}
    const invalidLanding=JSON.parse(JSON.stringify(profile));invalidLanding.activity.dropArea.landingBehavior='float';
    let invalidLandingRejected=false;try{ftsValidateProfile(invalidLanding)}catch(error){invalidLandingRejected=true}
    const invalidTotal=JSON.parse(JSON.stringify(profile));invalidTotal.activity.generator.policies.practice.totalTokens={exact:7};
    let invalidTotalRejected=false;try{ftsValidateProfile(invalidTotal)}catch(error){invalidTotalRejected=true}
    const invalidRange=JSON.parse(JSON.stringify(profile));invalidRange.activity.generator.policies.practice.totalTokens={min:2,max:4};
    let invalidRangeRejected=false;try{ftsValidateProfile(invalidRange)}catch(error){invalidRangeRejected=true}
    const invalidSpecifiedTarget=JSON.parse(JSON.stringify(profile));invalidSpecifiedTarget.activity.generator.policies.practice.totalTokens.target=7;
    let invalidSpecifiedTargetRejected=false;try{ftsValidateProfile(invalidSpecifiedTarget)}catch(error){invalidSpecifiedTargetRejected=true}
    const invalidZeroTarget=JSON.parse(JSON.stringify(profile));invalidZeroTarget.activity.generator.policies.practice.totalTokens.target=0;
    let invalidZeroTargetRejected=false;try{ftsValidateProfile(invalidZeroTarget)}catch(error){invalidZeroTargetRejected=true}
    const invalidCategoryTarget=JSON.parse(JSON.stringify(profile));invalidCategoryTarget.activity.generator.policies.practice.counts['valid-identifier'].target=2;
    let invalidCategoryTargetRejected=false;try{ftsValidateProfile(invalidCategoryTarget)}catch(error){invalidCategoryTargetRejected=true}
    const rangedProfile=JSON.parse(JSON.stringify(profile));rangedProfile.activity.generator.policies.practice.totalTokens={min:3,max:6};
    ftsValidateProfile(rangedProfile);
    const boundedTargetProfile=JSON.parse(JSON.stringify(profile));boundedTargetProfile.activity.generator.policies.practice.totalTokens={min:3,max:6,target:4};
    ftsValidateProfile(boundedTargetProfile);
    seededRandom=()=>0;
    const lowCounts=ftsResolveTokenCounts(rangedProfile.activity.generator.policies.practice,profile.activity.buckets);
    seededRandom=()=>.999999;
    const highCounts=ftsResolveTokenCounts(rangedProfile.activity.generator.policies.practice,profile.activity.buckets);
    const fixedLast=ftsResolveTokenCounts(profile.activity.generator.policies.practice,profile.activity.buckets);
    seededRandom=()=>0;
    const fixedFirst=ftsResolveTokenCounts(profile.activity.generator.policies.practice,profile.activity.buckets);
    seededRandom=()=>.5;
    const fixedCounts=ftsResolveTokenCounts(profile.activity.generator.policies.practice,profile.activity.buckets);
    const targetAllocation=lowCounts.target===3&&highCounts.target===6&&fixedCounts.target===4
      &&Object.values(lowCounts.counts).reduce((sum,count)=>sum+count,0)===3
      &&Object.values(highCounts.counts).reduce((sum,count)=>sum+count,0)===6
      &&Object.values(fixedCounts.counts).reduce((sum,count)=>sum+count,0)===4
      &&Object.values(fixedCounts.counts).every(count=>count>=1&&count<=2)
      &&fixedFirst.counts['valid-identifier']===2&&fixedLast.counts['reserved-word']===2;
    const generateCategoryTokens=ftsGenerateCategoryTokens;
    ftsGenerateCategoryTokens=(category,count)=>Array.from({length:count},(_,index)=>({id:category+index,text:category+index,category}));
    state.mode='practice';const generatedPractice=ftsGenerateItem({profile,index:0,language:'c',generationContext:{}});
    state.mode='exam';const generatedExam=ftsGenerateItem({profile,index:1,language:'java',generationContext:{}});
    state.mode='practice';ftsGenerateCategoryTokens=generateCategoryTokens;
    const generatedTargets=generatedPractice.generatedTokenTarget===4&&generatedPractice.tokens.length===4
      &&generatedExam.generatedTokenTarget===3&&generatedExam.tokens.length===3;
    const passProfile=JSON.parse(JSON.stringify(profile));passProfile.activity.dropArea.landingBehavior='pass-through';
    ftsValidateProfile(passProfile);
    const tokens=[
      {id:'t1',text:'alpha',category:'valid-identifier'},
      {id:'t2',text:'2bad',category:'invalid-identifier'},
      {id:'t3',text:'class',category:'reserved-word'},
      {id:'t4',text:'beta',category:'valid-identifier'}
    ];
    const makeItem=()=>({tokens:JSON.parse(JSON.stringify(tokens)),cursor:0,selectedTokenId:null,
      placements:[],attempts:[],scoreResults:[],history:[],nextAttemptNumber:1,
      bucketCounts:{valid:0,invalid:0,reserved:0},lastResult:null,examActionLog:[],checked:false});
    const item=makeItem(),initial=ftsVisibleTokens(item,profile).map(token=>token.id);
    const fittedHeight=ftsStageHeightFromBounds(873,315,0,16,24,340);
    const fittedAfterScroll=ftsStageHeightFromBounds(873,-85,400,16,24,340);
    const compactMinimum=ftsStageHeightFromBounds(500,315,0,16,24,340);
    const scheduledItem=makeItem(),scheduled=ftsDropPlan(scheduledItem,tokens.slice(0,3),1000,true);
    const sequential=scheduled.get('t2').startAt>scheduled.get('t1').startAt+scheduled.get('t1').duration
      &&scheduled.get('t3').startAt>scheduled.get('t2').startAt+scheduled.get('t2').duration;
    const releaseLane={left:100,bottom:500};
    const leftRelease=ftsReleasePlan(releaseLane,400,100,50,80,220,false);
    const rightRelease=ftsReleasePlan(releaseLane,400,100,50,600,220,true);
    const freeReleaseClamped=leftRelease.position===0&&rightRelease.position===1
      &&leftRelease.duration>320&&rightRelease.duration>leftRelease.duration;
    const variedPositions=new Set([...scheduled.values()].map(entry=>entry.position)).size>1;
    const slowEnough=[...scheduled.values()].every(entry=>entry.duration>=3200);
    const passItem=makeItem(),passBefore=ftsRenderTokenLane(passItem,passProfile);
    const passEntry=ftsDropStateByItem.get(passItem).get('t1');
    const passPositionChanges=ftsPassPosition(passEntry,1)!==ftsPassPosition(passEntry,0)
      &&ftsPassCycle(passEntry,passEntry.startAt+passEntry.duration*2)===2;
    const passAnimating=countNodesWithClass(passBefore,'fts-token-passing')===1;
    const before=ftsRenderTokenLane(item,profile);
    const firstDrops=countNodesWithClass(before,'fts-token-dropping');
    const selectionRerenderDrops=countNodesWithClass(ftsRenderTokenLane(item,profile),'fts-token-dropping');
    flyAnimEnabled=false;
    const motionOffCount=countNodesWithClass(ftsRenderTokenLane(makeItem(),profile),'fts-token-choice');
    const passMotionOffCount=countNodesWithClass(ftsRenderTokenLane(makeItem(),passProfile),'fts-token-passing');
    const staticPassItem=makeItem();ftsRenderTokenLane(staticPassItem,passProfile);
    const staticPassEntry=ftsDropStateByItem.get(staticPassItem).get('t1');
    const staticPassPosition=staticPassEntry.position;
    staticPassEntry.startAt=Date.now()-staticPassEntry.duration*3;
    ftsRenderTokenLane(staticPassItem,passProfile);
    const staticPassStable=staticPassEntry.position===staticPassPosition;
    flyAnimEnabled=true;
    const needsSelection=!ftsApplyAction({item,profile,action:{type:'SORT_TOKEN',bucketId:'valid'},state}).applied;
    const hiddenRejected=!ftsApplyAction({item,profile,action:{type:'SELECT_TOKEN',tokenId:'t4'},state}).applied;
    const selected=ftsApplyAction({item,profile,action:{type:'SELECT_TOKEN',tokenId:'t3'},state});
    const selectedBucket=ftsRenderBucket(item,profile,profile.activity.buckets[0]);
    const mismatchRejected=!ftsApplyAction({item,profile,action:{type:'SORT_TOKEN',tokenId:'t2',bucketId:'reserved'},state}).applied;
    const outOfOrder=ftsApplyAction({item,profile,action:{type:'SORT_TOKEN',tokenId:'t3',bucketId:'reserved'},state});
    const after=ftsVisibleTokens(item,profile).map(token=>token.id);
    const refillQueued=ftsDropPlan(item,ftsVisibleTokens(item,profile),Date.now(),true).get('t4').startAt>Date.now();
    const progress=ftsProgressSteps(item).map(step=>step.status);
    const undo=ftsUndo({item}),restored=ftsVisibleTokens(item,profile).map(token=>token.id);
    ftsApplyAction({item,profile,action:{type:'SELECT_TOKEN',tokenId:'t2'},state});
    const wrong=ftsApplyAction({item,profile,action:{type:'SORT_TOKEN',bucketId:'valid'},state});
    const returned=item.cursor===0&&item.selectedTokenId==='t2'&&item.bucketCounts.valid===0;
    const corrected=ftsApplyAction({item,profile,action:{type:'SORT_TOKEN',bucketId:'invalid'},state});
    const firstScore=ftsScoreResult(item,'t2').wasCorrect;
    const remaining=ftsRemainingTokens(item).map(token=>token.id);
    const checkIncomplete=ftsCheck({item,profile,state}).reason;
    const saved=JSON.parse(JSON.stringify(item));
    const resumed=ftsVisibleTokens(saved,profile).map(token=>token.id);
    const single=JSON.parse(JSON.stringify(profile));single.activity.dropArea.visibleTokens=1;
    const singleItem=makeItem();
    const singleApplied=ftsApplyAction({item:singleItem,profile:single,action:{type:'SORT_TOKEN',bucketId:'valid'},state}).applied;
    const complete=makeItem();
    for(const token of complete.tokens){
      ftsApplyAction({item:complete,profile,action:{type:'SELECT_TOKEN',tokenId:token.id},state});
      const bucket=profile.activity.buckets.find(candidate=>candidate.category===token.category);
      ftsApplyAction({item:complete,profile,action:{type:'SORT_TOKEN',bucketId:bucket.id},state});
    }
    const checked=ftsCheck({item:complete,profile,state});
    const completedScore=complete.points,completedSteps=complete.correctSteps;
    const retry=ftsRetry({item:complete});
    ftsApplyAction({item:complete,profile,action:{type:'SELECT_TOKEN',tokenId:'t1'},state});
    const resetSelection=ftsReset({item:complete});
    const resetDrops=countNodesWithClass(ftsRenderTokenLane(complete,profile),'fts-token-dropping');
    state.mode='exam';const exam=makeItem();
    ftsApplyAction({item:exam,profile,action:{type:'SELECT_TOKEN',tokenId:'t2'},state});
    const examWrong=ftsApplyAction({item:exam,profile,action:{type:'SORT_TOKEN',bucketId:'valid'},state});
    const examRestored=JSON.parse(JSON.stringify(exam));
    state.mode='practice';
    const dragged=makeItem();let dragRenders=0;
    currentItem=()=>dragged;currentProfile=()=>profile;
    applyActivityAction=(target,action)=>ftsApplyAction({item:target,profile,action,state});
    render=()=>{dragRenders++};
    const dragAccepted=ftsCommitDraggedToken({item:dragged,tokenId:'t2'},
      {getAttribute:()=> 'invalid'});
    const dragResult={accepted:dragAccepted?.accepted,placed:dragged.placements[0]?.tokenId,
      selected:dragged.selectedTokenId,score:dragged.scoreResults[0]?.wasCorrect,renders:dragRenders};
    const rejectedDrag=makeItem();currentItem=()=>rejectedDrag;
    const rejectedDrop=ftsCommitDraggedToken({item:rejectedDrag,tokenId:'t2'},
      {getAttribute:()=> 'valid'});
    const rejectedResult={accepted:rejectedDrop?.accepted,placed:rejectedDrag.placements.length,
      score:rejectedDrag.scoreResults[0]?.wasCorrect,renders:dragRenders};
    return JSON.stringify({initial,invalidRejected,invalidLandingRejected,invalidTotalRejected,invalidRangeRejected,
      invalidSpecifiedTargetRejected,invalidZeroTargetRejected,invalidCategoryTargetRejected,
      targetAllocation,generatedTargets,operatorProfilesValid,fittedHeight,fittedAfterScroll,compactMinimum,
      sequential,freeReleaseClamped,variedPositions,slowEnough,passPositionChanges,passAnimating,
      choiceCount:countNodesWithClass(before,'fts-token-choice'),
      firstDrops,selectionRerenderDrops,motionOffCount,passMotionOffCount,staticPassStable,
      refillQueued,resetDrops,needsSelection,
      hiddenRejected,selected:selected.applied,bucketEnabled:!('disabled' in selectedBucket.attributes),
      mismatchRejected,outOfOrder:outOfOrder.applied,after,progress,undo:undo.applied,restored,
      wrongAccepted:wrong.accepted,returned,corrected:corrected.accepted,firstScore,remaining,
      checkIncomplete,resumed,singleApplied,examAccepted:examWrong.accepted,
      checked:checked.applied,completedScore,completedSteps,retry:retry.applied,
      resetSelection:resetSelection.applied,selectionCleared:complete.selectedTokenId===null,
      examCursor:examRestored.cursor,examPlaced:examRestored.placements[0].tokenId,
      examVisible:ftsVisibleTokens(examRestored,profile).map(token=>token.id),dragResult,rejectedResult});
  })()`));
  assert.deepStrictEqual(result,{
    initial:['t1','t2','t3'],invalidRejected:true,invalidLandingRejected:true,
    invalidTotalRejected:true,invalidRangeRejected:true,invalidSpecifiedTargetRejected:true,
    invalidZeroTargetRejected:true,
    invalidCategoryTargetRejected:true,
    targetAllocation:true,generatedTargets:true,operatorProfilesValid:true,
    fittedHeight:518,fittedAfterScroll:518,compactMinimum:340,
    sequential:true,freeReleaseClamped:true,variedPositions:true,slowEnough:true,
    passPositionChanges:true,passAnimating:true,choiceCount:1,
    firstDrops:1,selectionRerenderDrops:1,motionOffCount:3,passMotionOffCount:0,staticPassStable:true,
    refillQueued:true,resetDrops:1,
    needsSelection:true,hiddenRejected:true,
    selected:true,bucketEnabled:true,mismatchRejected:true,outOfOrder:true,
    after:['t1','t2','t4'],progress:['current','waiting','complete','waiting'],
    undo:true,restored:['t1','t2','t3'],wrongAccepted:false,returned:true,
    corrected:true,firstScore:false,remaining:['t1','t3','t4'],checkIncomplete:'incomplete',
    resumed:['t1','t3','t4'],singleApplied:true,examAccepted:true,
    checked:true,completedScore:3,completedSteps:4,retry:true,resetSelection:true,selectionCleared:true,
    examCursor:1,
    examPlaced:'t2',examVisible:['t1','t3','t4'],
    dragResult:{accepted:true,placed:'t2',selected:null,score:true,renders:0},
    rejectedResult:{accepted:false,placed:0,score:false,renders:0}
  });
}

function testManualResponseProfilesAndPropagation(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js','declaration-statement-plugin.js',
    'assignment-statement-plugin.js','unary-update-statement-plugin.js','program-item-builder.js',
    'state.js','manual-response.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    state.mode='practice';
    state.practicePolicy=snapshotPracticePolicy({practice:{manualResponses:{mode:'profile'}}});
    initializeSeededRandom(24680);
    const advanced=generateItemsForProfile('assignment-unary-advanced-chain');
    const logical=generateItemsForProfile('relational-logical-student-derived');
    const legacy=generateItemsForProfile('direct-ltr');
    const plainAssignment=generateItemsForProfile('assignment-basic');
    function quota(items,kind,eligible){
      const selected=items.reduce((sum,item)=>sum+Object.keys(item.manualResponsePlan[kind]).length,0);
      const total=items.reduce((sum,item)=>sum+eligible(item).length,0);
      return {selected,total};
    }
    const namedA=quota(advanced,'namedKeys',namedManualKeys);
    const operatorsA=quota(advanced,'operatorKeys',operatorManualKeys);
    const namedL=quota(logical,'namedKeys',namedManualKeys);
    const operatorsL=quota(logical,'operatorKeys',operatorManualKeys);
    const variable={id:nextId(),kind:'variable',name:'x',declaredValue:10,resolved:false,parenGroup:null};
    const literal=Object.assign(makeLiteral(5),{parenGroup:null});
    const flat={operands:[variable,literal],operators:['+']};
    const runtime={workingFlat:deepCloneFlat(flat),originalFlat:deepCloneFlat(flat),history:[deepCloneFlat(flat)],trace:[],checked:false};
    applyExpressionAction(runtime,{type:'substitute',id:variable.id,manualResponse:{value:9,expectedValue:10,wasCorrect:false}});
    const left=runtime.workingFlat.operands[0],right=runtime.workingFlat.operands[1];
    applyExpressionAction(runtime,{type:'evaluate',leftId:left.id,rightId:right.id,manualResponse:{value:14,expectedValue:14,wasCorrect:true}});
    const facts=manualResponseFacts(runtime);
    const sequenceKinds=advanced[0].program.statements.map(statement=>statement.kind);
    resetRandomGenerator();
    return JSON.stringify({
      advancedItems:advanced.length,logicalItems:logical.length,
      advancedHalf:namedA.selected===Math.round(namedA.total/2)&&operatorsA.selected===Math.round(operatorsA.total/2),
      logicalHalf:namedL.selected===Math.round(namedL.total/2)&&operatorsL.selected===Math.round(operatorsL.total/2),
      legacyOff:Object.keys(legacy[0].manualResponsePlan.namedKeys).length===0,
      plainWritesEligible:operatorManualKeys(plainAssignment[0]).some(key=>/^assignment-.*:commit$/.test(key)),
      declarationsEligible:operatorManualKeys(advanced[0]).some(key=>/^declaration-.*:commit$/.test(key)),
      hasAssignment:sequenceKinds.includes('assignment'),hasUnary:sequenceKinds.includes('unary-update'),
      propagated:flatOperandValue(runtime.workingFlat.operands[0])===14,
      originalPreserved:runtime.originalFlat.operands[0].declaredValue===10,
      manualCorrect:facts.correct,manualTotal:facts.total
    });
  })()`));
  assert.deepStrictEqual(result,{advancedItems:2,logicalItems:5,advancedHalf:true,logicalHalf:true,
    legacyOff:true,plainWritesEligible:true,declarationsEligible:true,
    hasAssignment:true,hasUnary:true,propagated:true,originalPreserved:true,
    manualCorrect:1,manualTotal:2});
}

function testManualResponseResolvedUnaryOperands(){
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','dom-helpers.js','manual-response.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const logical=manualResponseOperand({kind:'unary',op:'!',form:'prefix',resolved:true,
      resultValue:false,inner:{kind:'variable',name:'x',declaredValue:true}});
    const increment=manualResponseOperand({kind:'unary',op:'++',form:'prefix',resolved:true,
      resultValue:22,inner:{kind:'variable',name:'x',declaredValue:21}});
    const pending=manualResponseOperand({kind:'unary',op:'!',form:'prefix',resolved:false,substituted:true,
      inner:{kind:'variable',name:'y',declaredValue:false}});
    return JSON.stringify({
      logicalText:logical.textContent,
      logicalCards:countNodesWithClass(logical,'manual-response-binding-card'),
      incrementText:increment.textContent,
      incrementCards:countNodesWithClass(increment,'manual-response-binding-card'),
      pendingText:pending.textContent,
      pendingCards:countNodesWithClass(pending,'manual-response-binding-card')
    });
  })()`));
  assert.deepStrictEqual(result,{logicalText:'false',logicalCards:0,
    incrementText:'x22',incrementCards:1,pendingText:'yfalse',pendingCards:1});
}

function testProfileCategoriesAndScopedScores(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js',
    'state.js','score-summary.js']);
  installFakeDom(ctx);
  const nodes=new Map();
  ['profileList','scoreSummaryTitle','scoreSummaryScopeLabel','scoreSummaryTotal'].forEach(id=>nodes.set(id,new ctx.FakeNode('div')));
  ctx.document.getElementById=id=>nodes.get(id)||null;
  load(ctx,['login.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const assigned=PROFILES.every(profile=>PROFILE_CATEGORIES.some(category=>category.id===profile.categoryId));
    const unique=PROFILES.every(profile=>PROFILE_CATEGORIES.filter(category=>category.profileIds.includes(profile.id)).length===1);
    const explicitVisibility=PROFILES.every(profile=>typeof profile.enabled==='boolean')
      &&PROFILE_CATEGORIES.every(category=>typeof category.enabled==='boolean');
    const expression=PROFILES.find(profile=>profile.id==='full-basic-precedence');
    const hiddenExpression=PROFILES.find(profile=>profile.id==='parens-override-dual');
    const falling=ACTIVITY_PROFILES.find(profile=>profile.id==='falling-identifier-sort');
    PROFILES.push(falling);
    PROFILES.push(ACTIVITY_PROFILES.find(profile=>profile.id==='c-simulate-output'));
    hiddenExpression.enabled=false;
    state.itemsByProfile={
      [expression.id]:[{checked:true,points:0.6,wasCorrectFinal:false}],
      [hiddenExpression.id]:[{checked:true,points:1,wasCorrectFinal:true}],
      [falling.id]:[{checked:true,points:12,wasCorrectFinal:false}]
    };
    const hiddenProfileExcluded=!profilesForCategory('expressions').includes(hiddenExpression)
      &&generateItemsForProfile(hiddenExpression.id).length===0;
    const expressionScore=computeCategoryScore('expressions');
    const identifierScore=computeCategoryScore('identifier-activities');
    const overall=computeGrandTotalScore();
    const identifierCategory=PROFILE_CATEGORIES.find(category=>category.id==='identifier-activities');
    identifierCategory.enabled=false;
    const hiddenCategoryExcluded=computeCategoryScore('identifier-activities')===null
      &&profilesForCategory('identifier-activities').length===0
      &&!enabledCategories().includes(identifierCategory)
      &&JSON.stringify(computeGrandTotalScore())===JSON.stringify({earned:0.6,max:1});
    identifierCategory.enabled=true;
    scoreSummaryCategoryId='identifier-activities';
    renderScoreSummaryContent();
    const scopedModal=document.getElementById('scoreSummaryTitle').textContent==='Identifier Activities Score Summary'
      &&document.getElementById('scoreSummaryTotal').textContent==='12 / 30';
    const scopedFilename=scoreSummaryPngFilename(new Date(2026,0,2)).includes('-identifier-activities-');
    scoreSummaryCategoryId=null;
    renderScoreSummaryContent();
    const overallModal=document.getElementById('scoreSummaryTitle').textContent==='Overall Score Summary'
      &&document.getElementById('scoreSummaryTotal').textContent==='12.6 / 31';
    populateProfileSidebar();
    const categories=document.getElementById('profileList').children;
    const grouped=categories.length===4 && categories.every(category=>category.children.length===2);
    const professionalHierarchy=categories.every(category=>{
      const heading=category.children[0],expand=heading.children[0],results=heading.children[1];
      return expand.children[1].className==='category-nav-label'
        &&results.className==='category-score-link'
        &&results.children.length===1&&results.children[0].className.includes('fa-qrcode');
    });
    return JSON.stringify({assigned,unique,explicitVisibility,hiddenProfileExcluded,hiddenCategoryExcluded,
      expressionScore,identifierScore,overall,
      scopedModal,scopedFilename,overallModal,grouped,professionalHierarchy});
  })()`));
  assert.deepStrictEqual(result,{
    assigned:true,unique:true,explicitVisibility:true,hiddenProfileExcluded:true,hiddenCategoryExcluded:true,
    expressionScore:{earned:0.6,max:1},
    identifierScore:{earned:12,max:30},overall:{earned:12.6,max:31},
    scopedModal:true,scopedFilename:true,overallModal:true,grouped:true,professionalHierarchy:true
  });
}

function testModeScopedPersistence(){
  const dependencies=[
    'engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js',
    'declaration-statement-plugin.js','assignment-statement-plugin.js',
    'program-item-builder.js'
  ];
  function sessionContext(practice,exam){
    const ctx=context();
    load(ctx,dependencies);
    const filename=path.join(ROOT,'js','state.js');
    const source=fs.readFileSync(filename,'utf8').replace(
      'persistence: Object.freeze({practice:false, exam:true})',
      `persistence: Object.freeze({practice:${practice}, exam:${exam}})`);
    vm.runInContext(source,ctx,{filename});
    load(ctx,['exam-persistence.js','settings-persistence.js']);
    return ctx;
  }

  const disabledPractice=sessionContext(false,true);
  const defaults=JSON.parse(evaluate(disabledPractice,`(()=>{
    state.userEmail='student@example.edu';state.mode='practice';state.screen='session';
    appSettings.mode='practice';saveSessionProgress();
    const practiceSkipped=localStorage.getItem(practiceProgressKey(state.userEmail))===null;
    state.mode='exam';appSettings.mode='exam';saveSessionProgress();
    const examSaved=localStorage.getItem(examProgressKey(state.userEmail))!==null;
    const modeSeparated=localStorage.getItem(practiceProgressKey(state.userEmail))===null;
    return JSON.stringify({practiceSkipped,examSaved,modeSeparated});
  })()`));
  assert.deepStrictEqual(defaults,{practiceSkipped:true,examSaved:true,modeSeparated:true});

  const enabledPractice=sessionContext(true,false);
  const practiceRecord=evaluate(enabledPractice,`(()=>{
    const profile=enabledProfiles()[0];
    initializeSeededRandom(24680);
    const items=generateItemsForProfile(profile.id);
    resetRandomGenerator();
    items[2].points=0.6;items[2].checked=true;
    state.userEmail='student@example.edu';state.userStudentId='ST-1';
    state.mode='practice';appSettings.mode='practice';state.screen='session';
    state.profileId=profile.id;state.itemIndex=2;state.itemIndexByProfile={[profile.id]:2};
    state.sessionSeed=24680;state.items=items;state.itemsByProfile={[profile.id]:items};
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'strict-sequence'}});
    saveSessionProgress();
    return localStorage.getItem(practiceProgressKey(state.userEmail));
  })()`);
  assert(practiceRecord);
  const examWriteBlocked=evaluate(enabledPractice,`(()=>{
    state.mode='exam';appSettings.mode='exam';saveSessionProgress();
    return localStorage.getItem(examProgressKey('student@example.edu'))===null;
  })()`);
  assert.strictEqual(examWriteBlocked,true);
  disabledPractice.localStorage.setItem('precedifyPracticeProgress:student@example.edu',practiceRecord);
  assert.strictEqual(evaluate(disabledPractice,
    "tryResumePracticeSession('student@example.edu')"),false);
  assert.strictEqual(enabledPractice.localStorage.getItem('precedifyExamProgress:student@example.edu'),null);
  const examRecord=disabledPractice.localStorage.getItem('precedifyExamProgress:student@example.edu');
  const restored=sessionContext(true,false);
  restored.localStorage.setItem('precedifyPracticeProgress:student@example.edu',practiceRecord);
  restored.localStorage.setItem('precedifyExamProgress:student@example.edu',examRecord);
  const resumed=JSON.parse(evaluate(restored,`(()=>{
    localStorage.setItem(APP_SETTINGS_KEY,JSON.stringify({persistence:{practice:false,exam:true}}));
    loadPersistedAppSettings();
    const deploymentOwned=modePersistenceEnabled('practice')
      &&!modePersistenceEnabled('exam')&&appSettings.persistence.practice===true;
    const examBlocked=tryResumeSession('exam','student@example.edu')===false;
    const practiceResumed=tryResumePracticeSession('student@example.edu');
    const sameItem=state.profileId===enabledProfiles()[0].id&&state.itemIndex===2
      &&state.items[2].points===0.6&&state.items[2].checked===true;
    const samePolicy=activePracticePolicy().interactionMode==='strict-sequence';
    const sameSeed=state.sessionSeed===24680;
    const noTimer=state.examTimerMinutes===null&&state.examExpired===false;
    clearAllPrecedifyLocalData();
    const cleared=localStorage.getItem(practiceProgressKey('student@example.edu'))===null
      &&localStorage.getItem(examProgressKey('student@example.edu'))===null;
    return JSON.stringify({deploymentOwned,examBlocked,practiceResumed,sameItem,samePolicy,sameSeed,noTimer,cleared});
  })()`));
  assert.deepStrictEqual(resumed,{deploymentOwned:true,examBlocked:true,practiceResumed:true,sameItem:true,
    samePolicy:true,sameSeed:true,noTimer:true,cleared:true});
}

function testProgramOutputStatementPlugin(){
  const rendererSource=fs.readFileSync(path.join(ROOT,'plugins','program-output','renderer.js'),'utf8');
  const outputStyles=fs.readFileSync(path.join(ROOT,'plugins','program-output','styles.css'),'utf8');
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','language.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js','declaration-statement-plugin.js',
    'assignment-statement-plugin.js','program-return.js','activity-core.js']);
  loadRelative(ctx,['plugins/program-output/manifest.js','plugins/program-output/statement.js']);
  load(ctx,['program-item-builder.js']);
  loadRelative(ctx,['plugins/program-output/content.js']);
  load(ctx,['state.js','dom-helpers.js','var-final-state.js','render-tree.js','render-flat.js','render-declaration.js',
    'render-assignment.js','render-unary-update.js','render-session.js']);
  loadRelative(ctx,['plugins/program-output/renderer.js']);
  const installBank=(language)=>{
    const directory=path.join(ROOT,'plugins','program-output','exercises',language,'formatted-output');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    ctx[`test${language.toUpperCase()}Manifest`]=manifest;
    ctx[`test${language.toUpperCase()}Rows`]=rows;
    evaluate(ctx,`poInstallExerciseBank('plugins/program-output/exercises/${language}/formatted-output/manifest.json',
      '${language}','formatted-output',test${language.toUpperCase()}Manifest,test${language.toUpperCase()}Rows)`);
    return manifest;
  };
  const cManifest=installBank('c');
  const javaManifest=installBank('java');
  ctx.testTolerantProgram='/* @codescope\n@result x\n*/\n#include <stdio.h>\nint main(){\n int x = 4;\n mystery(x);\n printf("%d", x);\n return 0;\n}';
  const result=JSON.parse(evaluate(ctx,`(()=>{
    // Seed 40 previously produced a valid base expression whose advanced
    // assignments later changed a divisor to zero and aborted app startup.
    initializeSeededRandom(40);
    const recoveredProgramItems=generateItemsForProfile('assignment-advanced-chain').length;
    resetRandomGenerator();
    state.language='c';initializeSeededRandom(73129);
    const sourceItems=generateItemsForProfile('program-output-basics');
    const item=sourceItems[0];resetRandomGenerator();
    const kinds=item.program.statements.map(statement=>statement.kind);
    item.program.memory={};
    item.decls.forEach(declaration=>{item.program.memory[declaration.name]={name:declaration.name,
      kind:declaration.kind,initialized:true,value:declaration.value};});
    item.program.statements.slice(0,3).forEach(statement=>{statement.status='complete';});
    item.program.cursor=3;item.program.statements[3].status='active';
    const literal=dispatchProgramAction(item,{type:'emit-output',statementId:'output-1'});
    const dynamic=item.program.statements[item.program.cursor];
    const read=dispatchProgramAction(item,{type:'read-output-value',partIndex:1,statementId:dynamic.id});
    const readTimeline=renderProgramOutputTimeline(dynamic,item,item.program,4,false);
    const readTimelineRows=countNodesWithClass(readTimeline,'tl-row');
    const readTimelineCards=countNodesWithClass(readTimeline,'tok-card');
    const combine=dispatchProgramAction(item,{type:'resolve-output-part',partIndex:1,statementId:dynamic.id});
    const combinedTimeline=renderProgramOutputTimeline(dynamic,item,item.program,4,false);
    const combinedTimelineRows=countNodesWithClass(combinedTimeline,'tl-row');
    const combinedTimelineCards=countNodesWithClass(combinedTimeline,'tok-card');
    const combinedSubstitutionRows=countNodesWithClass(combinedTimeline,'output-substitution-row');
    const combinedTimelineText=combinedTimeline.textContent;
    const visualStepIds=dynamic.runtime.trace.map(step=>step.resultNodeId);
    const combineSourceId=dynamic.runtime.trace[1].sourceNodeId;
    const sourceBinding=dynamic.runtime.trace[1].sourceBinding;
    const bindingColor=bindingIdentityColor(sourceBinding,'variable');
    const formatColor=stepVisualColor(dynamic.runtime.trace[1],1);
    const printed=dispatchProgramAction(item,{type:'emit-output',statementId:dynamic.id});
    const cSource=outputStatementSource(dynamic,item);
    const cText=programOutputText(item.program);
    const panelText=renderProgramOutputPanel(item,item.program).textContent;
    const canonical=buildCanonicalProgramTrace(item);
    item.program.language='java';
    const javaSource=outputStatementSource(dynamic,item);
    const javaLineSource=outputStatementSource(item.program.statements[5],item);
    const multi=sourceItems[1];
    multi.program.memory={};
    multi.decls.forEach(declaration=>{multi.program.memory[declaration.name]={name:declaration.name,
      kind:declaration.kind,initialized:true,value:declaration.value};});
    multi.program.statements.slice(0,3).forEach(statement=>{statement.status='complete';});
    multi.program.cursor=3;multi.program.statements[3].status='active';
    const multiOutput=multi.program.statements[3];
    state.mode='practice';
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'guided'}});
    const guidedInitial=renderProgramOutputState(multiOutput,multi,multi.program,{traceCount:0,interactive:true});
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'strict-sequence'}});
    const strictInitial=renderProgramOutputState(multiOutput,multi,multi.program,{traceCount:0,interactive:true});
    const strictPrematureReason=classifyRejectedProgramAction(multi,
      {type:'resolve-output-part',partIndex:1,statementId:multiOutput.id});
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'guided'}});
    const outOfOrderRead=dispatchProgramAction(multi,{type:'read-output-value',partIndex:5,statementId:multiOutput.id});
    const guidedAfterRead=renderProgramOutputState(multiOutput,multi,multi.program,{traceCount:1,interactive:true});
    const outOfOrderResolve=dispatchProgramAction(multi,{type:'resolve-output-part',partIndex:5,statementId:multiOutput.id});
    const resolvedOutOfOrder=renderProgramOutputState(multiOutput,multi,multi.program,{traceCount:2,interactive:true});
    [1,3].forEach(partIndex=>{
      dispatchProgramAction(multi,{type:'read-output-value',partIndex,statementId:multiOutput.id});
      dispatchProgramAction(multi,{type:'resolve-output-part',partIndex,statementId:multiOutput.id});
    });
    dispatchProgramAction(multi,{type:'emit-output',statementId:multiOutput.id});
    const sourceProfile=PROFILES.find(candidate=>candidate.id==='program-output-basics');
    const generatedProfile=Object.assign({},sourceProfile,{
      content:Object.assign({},sourceProfile.content,{mode:'generated'})
    });
    const generatedFallback=poGenerateContentItems({profile:generatedProfile,language:'c',
      generateDefault:()=>['generated-fallback']});
    const javaItems=poGenerateContentItems({profile:sourceProfile,language:'java',generateDefault:()=>[]});
    const javaMulti=javaItems[1].program.statements.find(statement=>statement.kind==='output');
    const sourceFlowProfile=PROFILES.find(candidate=>candidate.id==='program-output-source-flow');
    const sourceFlowItems=poGenerateContentItems({profile:sourceFlowProfile,language:'c',generateDefault:()=>[]});
    const sourceFlowItem=sourceFlowItems[0];
    const sourceFlowAlignmentItem=JSON.parse(JSON.stringify(sourceFlowItem));
    sourceFlowAlignmentItem.program.memory={};
    sourceFlowAlignmentItem.decls.forEach(declaration=>{
      sourceFlowAlignmentItem.program.memory[declaration.name]={name:declaration.name,kind:declaration.kind,
        initialized:true,value:declaration.value};
    });
    const sourceFlowOutputIndex=sourceFlowAlignmentItem.program.statements.findIndex(statement=>
      statement.kind==='output'&&programOutputDynamicParts(statement).length>0);
    sourceFlowAlignmentItem.program.statements.slice(0,sourceFlowOutputIndex).forEach(statement=>{statement.status='complete';});
    sourceFlowAlignmentItem.program.cursor=sourceFlowOutputIndex;
    const sourceFlowOutput=sourceFlowAlignmentItem.program.statements[sourceFlowOutputIndex];
    sourceFlowOutput.status='active';
    const sourceFlowPart=programOutputDynamicParts(sourceFlowOutput)[0];
    dispatchProgramAction(sourceFlowAlignmentItem,{type:'read-output-value',partIndex:sourceFlowPart.index,
      statementId:sourceFlowOutput.id});
    dispatchProgramAction(sourceFlowAlignmentItem,{type:'resolve-output-part',partIndex:sourceFlowPart.index,
      statementId:sourceFlowOutput.id});
    const sourceFlowAlignmentTimeline=renderProgramOutputTimeline(sourceFlowOutput,sourceFlowAlignmentItem,
      sourceFlowAlignmentItem.program,sourceFlowOutputIndex,false);
    const sourceFlowTimelineIndentCount=countNodesWithClass(sourceFlowAlignmentTimeline,'program-source-indent');
    state.profileId=sourceFlowProfile.id;state.items=sourceFlowItems;state.itemIndex=0;
    const sourceFlowHost=h('div',{});renderProgramItem(sourceFlowHost,sourceFlowItem,{});
    const sourceFlowText=sourceFlowHost.textContent;
    const sourceFlowLineNumbers=sourceFlowItem.program.statements.map(statement=>statement.sourceLine);
    const sourceFlowStatementCount=sourceFlowItem.program.statements.length;
    const sourceFlowHasSynthetic=sourceFlowItem.program.statements.some(statement=>statement.kind==='legacy-expression');
    const sourceFlowIndentPreserved=sourceFlowItem.program.statements[0].sourceText.startsWith('    ')
      &&sourceFlowText.includes('    #include')===false;
    const sourceContextRows=countNodesWithClass(sourceFlowHost,'program-source-context');
    const sourceFlowProgramRows=countNodesWithClass(sourceFlowHost,'program-statement');
    const sourceFlowReturnIndex=sourceFlowItem.program.statements.findIndex(statement=>statement.kind==='program-return');
    const sourceFlowReturn=sourceFlowItem.program.statements[sourceFlowReturnIndex];
    sourceFlowItem.program.statements.slice(0,sourceFlowReturnIndex).forEach(statement=>{
      statement.status='complete';statement.runtime.checked=true;
      statement.runtime.correctSteps=0;statement.runtime.totalOpSteps=0;
      statement.runtime.wasCorrectAssignment=true;
    });
    sourceFlowItem.program.cursor=sourceFlowReturnIndex;sourceFlowReturn.status='active';
    const sourceFlowRunningBeforeReturn=sourceFlowItem.program.status==='running';
    const sourceFlowReturnPlan=statementInteractionPlan(sourceFlowItem,sourceFlowReturn);
    const sourceFlowReturned=dispatchProgramAction(sourceFlowItem,sourceFlowReturnPlan.action,{applyExpressionAction});
    const sourceFlowFinalized=finalizeSourceProgramItem(sourceFlowItem);
    const tolerant=poParseSourceExercise({filename:'MutedUnsupported.c',raw:testTolerantProgram},'c');
    return JSON.stringify({
      manifest:PROGRAM_OUTPUT_PLUGIN_MANIFEST.id,
      sourceProfileItemCount:sourceProfile.scoring.itemCount,
      sourceProfileSelectionCount:sourceProfile.content.selection.count,
      sourceFlowItemCount:sourceFlowProfile.scoring.itemCount,
      sourceFlowSelectionCount:sourceFlowProfile.content.selection.count,
      recoveredProgramItems,
      statementCount:kinds.length,
      kinds,
      sumInitializer:item.program.statements[2].runtime.originalTree.op,
      literal:literal.applied,read:read.applied,combine:combine.applied,printed:printed.applied,
      readTimelineRows,readTimelineCards,combinedTimelineRows,combinedTimelineCards,combinedSubstitutionRows,
      combinedTimelineText,visualStepIds,combineSourceId,
      sourceBinding,bindingColor,formatColor,
      cSource,javaSource,javaLineSource,cText,panelText,canonicalPrints:canonical.filter(event=>event.action==='PRINT').length,
      canonicalBindings:canonical.filter(event=>event.outputAction).every(event=>!!event.sourceBinding),
      serializable:!!JSON.parse(JSON.stringify(item)).program,
      outputSettings:DEFAULT_APP_SETTINGS.shell.outputPanel.characterDelayMs,
      filenames:sourceItems.map(sourceItem=>sourceItem.filename),
      sourceResultName:item.resultName,sourceResultExpression:item.originalTree.name,
      multiPartKinds:multiOutput.parts.map(part=>part.kind),
      multiExpressionNames:multiOutput.parts.filter(part=>part.kind==='expression').map(part=>part.expression.name),
      multiOutputText:programOutputText(multi.program),multiNewline:multiOutput.newline,
      multiTraceActions:multiOutput.runtime.trace.map(step=>step.action),
      multiTracePartIndexes:multiOutput.runtime.trace.map(step=>step.partIndex==null?null:step.partIndex),
      multiTraceIds:multiOutput.runtime.trace.map(step=>step.resultNodeId),
      outOfOrderRead:outOfOrderRead.applied,outOfOrderResolve:outOfOrderResolve.applied,
      guidedInitialActions:countNodesWithClass(guidedInitial,'actionable'),
      strictInitialActions:countNodesWithClass(strictInitial,'actionable'),
      guidedAfterReadActions:countNodesWithClass(guidedAfterRead,'actionable'),
      resolvedSourceCards:countNodesWithClass(resolvedOutOfOrder,'tok-card'),
      strictPrematureReason,
      sourceHasWholeProgram:item.sourceDisplay.lines.map(line=>line.text).join(' ').includes('#include <stdio.h>')
        &&item.sourceDisplay.lines.some(line=>line.text.includes('return 0;')),
      sourceMetadataHidden:!item.sourceDisplay.lines.some(line=>line.text.includes('@codescope')),
      supportedSourceLines:item.sourceDisplay.lines.filter(line=>line.supported).length,
      mutedSourceLines:item.sourceDisplay.lines.filter(line=>!line.supported).length,
      unsupportedStatementMuted:tolerant.statements.some(statement=>statement.kind==='output')
        &&tolerant.sourceDisplay.lines.some(line=>line.text.includes('mystery(x)')&&!line.supported),
      sourceFlowStatementCount,sourceFlowHasSynthetic,sourceFlowLineNumbers,sourceFlowIndentPreserved,
      sourceFlowTimelineIndentCount,
      sourceContextRows,sourceFlowProgramRows,
      sourceFlowRunningBeforeReturn,sourceFlowReturnMode:sourceFlowReturnPlan.mode,
      sourceFlowReturnAction:sourceFlowReturnPlan.action.type,sourceFlowReturned:sourceFlowReturned.applied,
      sourceFlowCompletedAfterReturn:sourceFlowItem.program.status==='complete',
      sourceFlowCompleteSource:sourceFlowText.includes('#include <stdio.h>')
        &&sourceFlowText.includes('int main() {')&&sourceFlowText.includes('return 0;')&&sourceFlowText.includes('}'),
      sourceFlowFinalized,sourceFlowChecked:sourceFlowItem.checked,
      sourceFlowFullScore:sourceFlowItem.points===sourceFlowItem.maxPoints,
      generatedFallback,
      javaFilenames:javaItems.map(sourceItem=>sourceItem.filename),
      javaMultiPartKinds:javaMulti.parts.map(part=>part.kind),
      javaMultiSource:outputStatementSource(javaMulti,javaItems[1]),
      javaLanguage:javaItems[1].language
    });
  })()`));
  assert.strictEqual(result.manifest,'program-output');
  assert.strictEqual(result.sourceProfileItemCount,'manifest');
  assert.strictEqual(result.sourceProfileSelectionCount,'all');
  assert.strictEqual(result.sourceFlowItemCount,'manifest');
  assert.strictEqual(result.sourceFlowSelectionCount,'all');
  assert.strictEqual(result.recoveredProgramItems,2);
  assert.strictEqual(result.statementCount,8);
  assert.deepStrictEqual(result.kinds,['declaration','declaration','declaration','output','output','output','output','legacy-expression']);
  assert.strictEqual(result.sumInitializer,'+');
  assert(result.literal&&result.read&&result.combine&&result.printed);
  assert.strictEqual(result.readTimelineRows,2);
  assert.strictEqual(result.readTimelineCards,1);
  assert.strictEqual(result.combinedTimelineRows,3);
  assert.strictEqual(result.combinedTimelineCards,2);
  assert.strictEqual(result.combinedSubstitutionRows,1);
  assert(result.combinedTimelineText.includes('printf')&&!result.combinedTimelineText.includes('Evaluated text'));
  assert(result.combinedTimelineText.includes(' is ')&&result.combinedTimelineText.includes('\\n'));
  assert(!result.combinedTimelineText.includes('='));
  assert(result.visualStepIds[0].startsWith('output-read-'));
  assert(result.visualStepIds[1].startsWith('output-result-'));
  assert.strictEqual(result.combineSourceId,result.visualStepIds[0]);
  assert(result.sourceBinding);
  assert.strictEqual(result.formatColor,result.bindingColor);
  assert(result.canonicalBindings);
  assert(result.cSource.startsWith('printf("Value of '));
  assert(result.cSource.includes(' is %d\\n"'));
  assert(result.javaSource.startsWith('System.out.println("Value of '));
  assert(result.javaSource.includes(' + '));
  assert(result.javaLineSource.startsWith('System.out.println("Value of '));
  assert(result.cText.startsWith('OUTPUT LESSON\nValue of '));
  assert(result.panelText.includes('Program Output')&&result.panelText.includes('OUTPUT LESSON'));
  assert(result.panelText.includes('↵'));
  assert(rendererSource.includes("pre,escape,"));
  assert(rendererSource.includes("escape.classList.add('is-visible')"));
  assert(rendererSource.includes("style:bindingIdentityStyle(name,'variable')"));
  assert(outputStyles.includes('.program-output-string{color:color-mix(in srgb,var(--text) 74%,var(--text-dim));'));
  assert(!outputStyles.includes('.program-output-string{color:#9fda72;'));
  assert(outputStyles.includes('.program-output-resolved-value{color:var(--binding-color,var(--good));}'));
  assert(outputStyles.includes('.source-program-workspace .code-out{white-space:pre;}'));
  assert(outputStyles.includes('.program-output-timeline .output-substitution-row{padding-bottom:30px;}'));
  assert(outputStyles.includes('.program-source-context{opacity:.78;}'));
  assert(outputStyles.includes('.program-source-context-code{min-width:max-content;color:var(--text-dim);font:inherit;'));
  assert(!outputStyles.includes('.program-source-context-code{font-size:11px;}'));
  assert(!rendererSource.includes("escape.textContent='\\\\n'"));
  assert(outputStyles.includes('.program-output-escape-cue.is-visible{display:inline-flex'));
  assert(!outputStyles.includes('.program-output-escape-cue{position:absolute'));
  assert.strictEqual(result.canonicalPrints,4);
  assert(result.serializable&&result.outputSettings>0);
  assert.deepStrictEqual(result.filenames,cManifest.exercises);
  assert.strictEqual(result.sourceResultName,'result');
  assert.strictEqual(result.sourceResultExpression,'z');
  assert.deepStrictEqual(result.javaFilenames,javaManifest.exercises);
  assert.deepStrictEqual(result.multiPartKinds,['text','expression','text','expression','text','expression']);
  assert.deepStrictEqual(result.multiExpressionNames,['x','y','z']);
  assert.strictEqual(result.multiOutputText,'Value of x is 12\nand value of y is 8\nand their sum is 20');
  assert.strictEqual(result.multiNewline,false);
  assert.deepStrictEqual(result.multiTraceActions,['READ_OUTPUT_VALUE','EVALUATE','READ_OUTPUT_VALUE','EVALUATE',
    'READ_OUTPUT_VALUE','EVALUATE','PRINT']);
  assert.deepStrictEqual(result.multiTracePartIndexes,[5,5,1,1,3,3,null]);
  assert.strictEqual(new Set(result.multiTraceIds).size,result.multiTraceIds.length);
  assert(result.outOfOrderRead&&result.outOfOrderResolve);
  assert.strictEqual(result.guidedInitialActions,3);
  assert.strictEqual(result.strictInitialActions,7);
  assert.strictEqual(result.guidedAfterReadActions,3);
  assert.strictEqual(result.resolvedSourceCards,1);
  assert.strictEqual(result.strictPrematureReason,'output-value-unread');
  assert(result.sourceHasWholeProgram&&result.sourceMetadataHidden);
  assert(result.supportedSourceLines>0&&result.mutedSourceLines>0);
  assert(result.unsupportedStatementMuted);
  assert.strictEqual(result.sourceFlowStatementCount,8);
  assert.strictEqual(result.sourceFlowHasSynthetic,false);
  assert.deepStrictEqual(result.sourceFlowLineNumbers,[4,5,6,8,9,10,11,12]);
  assert(result.sourceFlowIndentPreserved&&result.sourceFlowCompleteSource);
  assert.strictEqual(result.sourceFlowTimelineIndentCount,3);
  assert(result.sourceContextRows>0);
  assert.strictEqual(result.sourceFlowProgramRows,result.supportedSourceLines+result.mutedSourceLines);
  assert(result.sourceFlowRunningBeforeReturn&&result.sourceFlowReturned&&result.sourceFlowCompletedAfterReturn);
  assert.strictEqual(result.sourceFlowReturnMode,'direct');
  assert.strictEqual(result.sourceFlowReturnAction,'return-program');
  assert(result.sourceFlowFinalized&&result.sourceFlowChecked&&result.sourceFlowFullScore);
  assert.deepStrictEqual(result.generatedFallback,['generated-fallback']);
  assert.deepStrictEqual(result.javaMultiPartKinds,result.multiPartKinds);
  assert(result.javaMultiSource.startsWith('System.out.print('));
  assert.strictEqual(result.javaLanguage,'java');
}

function testProgramSelectionStatementPlugin(){
  const ctx=context();installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','language.js',
    'program-ir.js','program-core.js','legacy-expression-plugin.js','declaration-statement-plugin.js',
    'assignment-statement-plugin.js','program-return.js','activity-core.js']);
  loadRelative(ctx,['plugins/program-output/manifest.js','plugins/program-output/statement.js']);
  load(ctx,['program-item-builder.js']);
  loadRelative(ctx,['plugins/program-output/content.js','plugins/program-selection/manifest.js',
    'plugins/program-selection/statement.js','plugins/program-selection/content.js']);
  load(ctx,['state.js','dom-helpers.js','var-final-state.js','render-tree.js','render-flat.js','render-declaration.js',
    'render-assignment.js','render-unary-update.js','render-session.js']);
  loadRelative(ctx,['plugins/program-selection/renderer.js']);
  const selectionStatementSource=fs.readFileSync(path.join(ROOT,'plugins','program-selection','statement.js'),'utf8');
  const selectionRendererSource=fs.readFileSync(path.join(ROOT,'plugins','program-selection','renderer.js'),'utf8');
  const selectionStyles=fs.readFileSync(path.join(ROOT,'plugins','program-selection','styles.css'),'utf8');
  const sharedStyles=fs.readFileSync(path.join(ROOT,'css','styles.css'),'utf8');
  ctx.psSeedFixture=`/*
@codescope
@title Seed fixture
@seed score min=10 max=999
@seed adjustment min=1 max=5
*/
#include <stdio.h>
int main() {
    const int limit = 75;
    const int adjustment = 2;
    int score = 82;
    int bonus = score + adjustment;
    if (score >= limit) {
        printf("Qualified.\\n");
    }
    return 0;
}`;
  ctx.psLiveControlFixture=`/*
@codescope
@title Live control-flow fixture
*/
#include <stdio.h>
int main() {
    int x = 5;
    if (x > 0) {
        printf("First branch.\\n");
    }
    printf("After first decision.\\n");
    if (x < 10) {
        printf("Second branch.\\n");
    }
    printf("After second decision.\\n");
    return 0;
}`;
  ctx.psUndeclaredSeedFixture=ctx.psSeedFixture.replace('@seed score min=10 max=999','@seed missing min=1 max=2');
  ctx.psDerivedSeedFixture=ctx.psSeedFixture.replace('@seed score min=10 max=999','@seed bonus min=1 max=2');
  ['c','java'].forEach(language=>{
    const directory=path.join(ROOT,'plugins','program-selection','exercises',language,'selection-basics');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    ctx.psTestManifest=manifest;ctx.psTestRows=rows;
    evaluate(ctx,`psInstallExerciseBank('plugins/program-selection/exercises/${language}/selection-basics/manifest.json',
      '${language}','selection-basics',psTestManifest,psTestRows)`);
  });
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const profile=PROFILES.find(candidate=>candidate.id==='selection-statements-source');
    initializeSeededRandom(101);const fixtureA=psParseExercise({filename:'SeedFixture.c',raw:psSeedFixture},'c','seeded');
    initializeSeededRandom(101);const fixtureRepeat=psParseExercise({filename:'SeedFixture.c',raw:psSeedFixture},'c','seeded');
    initializeSeededRandom(202);const fixtureB=psParseExercise({filename:'SeedFixture.c',raw:psSeedFixture},'c','seeded');
    const fixtureAuthored=psParseExercise({filename:'SeedFixture.c',raw:psSeedFixture},'c','authored');
    const liveControl=psParseExercise({filename:'LiveControl.c',raw:psLiveControlFixture},'c','authored');
    let undeclaredError='',derivedError='',badRangeError='',duplicateError='';
    try{psParseExercise({filename:'Undeclared.c',raw:psUndeclaredSeedFixture},'c','seeded');}catch(error){undeclaredError=error.message;}
    try{psParseExercise({filename:'Derived.c',raw:psDerivedSeedFixture},'c','seeded');}catch(error){derivedError=error.message;}
    try{psSeedDirectives('@seed x min=9 max=2','BadRange.c');}catch(error){badRangeError=error.message;}
    try{psSeedDirectives('@seed x min=1 max=2\\n@seed x min=3 max=4','Duplicate.c');}catch(error){duplicateError=error.message;}
    initializeSeededRandom(2);state.language='c';const items=generateItemsForProfile('selection-statements-source');
    initializeSeededRandom(2);const repeatItems=generateItemsForProfile('selection-statements-source');
    initializeSeededRandom(3);const changedItems=generateItemsForProfile('selection-statements-source');
    const kinds=items.map(item=>item.program.statements.filter(statement=>statement.kind==='selection').map(statement=>statement.selectionKind));
    const first=items[0],selectionIndex=first.program.statements.findIndex(statement=>statement.kind==='selection');
    const firstMemoryNames=ensureBindings(first).map(binding=>binding.name);
    state.profileId=profile.id;state.items=items;state.itemIndex=0;state.mode='practice';
    const sourceHost=h('div',{});renderProgramItem(sourceHost,first,{});
    const sourcePanels=countNodesWithClass(sourceHost,'program-source-file-panel');
    const sourceRows=countNodesWithClass(sourceHost,'program-source-file-line');
    const sourceActions=countNodesWithClass(sourceHost,'program-source-file-action');
    const directActions=countNodesWithClass(sourceHost,'direct-action');
    const modalActions=countNodesWithClass(sourceHost,'modal-action');
    const activeSourceRows=countNodesWithClass(sourceHost,'is-active');
    const oldTimelineRows=countNodesWithClass(sourceHost,'statement-trace-source-row');
    const inlinePanels=countNodesWithClass(sourceHost,'program-expression-panel');
    const inlineDefault=programTimelinePresentation({profileId:'program-output-source-flow'});
    const firstStatement=first.program.statements[0],firstPlan=statementInteractionPlan(first,firstStatement);
    const selectionPlan=statementInteractionPlan(first,first.program.statements[selectionIndex]);
    const literalOutput=first.program.statements.find(candidate=>candidate.kind==='output'&&programOutputDynamicParts(candidate).length===0);
    const outputPlan=statementInteractionPlan(first,literalOutput);
    const directExecution=dispatchProgramAction(first,firstPlan.action,{applyExpressionAction});
    first.program.memory={};first.decls.forEach(declaration=>{first.program.memory[declaration.name]={name:declaration.name,
      kind:declaration.kind,initialized:true,value:declaration.value};});
    first.program.statements.slice(0,selectionIndex).forEach(statement=>statement.status='complete');
    first.program.cursor=selectionIndex;const statement=first.program.statements[selectionIndex];statement.status='active';
    statement.runtime.workingFlat={operands:[{id:'selection-result',kind:'literal',value:statement.runtime.expectedValue}],operators:[]};
    const expressionOnlyHost=h('div',{});renderSelectionStatement({container:expressionOnlyHost,item:first,program:first.program,
      statement,statementIndex:selectionIndex,isActive:true,services:{statementTraceModal:true,expressionOnly:true}});
    const branch=dispatchProgramAction(first,{type:'commit-branch',statementId:statement.id},{applyExpressionAction});
    const selectedStatement=first.program.statements[first.program.cursor];
    const stagedTransition=stageSourceFlowTransition(first,statement);stagedTransition.phase='moving';
    const transitionHost=h('div',{});renderProgramItem(transitionHost,first,{});
    const transitionOrigins=countNodesWithClass(transitionHost,'is-flow-origin');
    const transitionDestinations=countNodesWithClass(transitionHost,'is-flow-destination');
    const transitionHighlights=countNodesWithClass(transitionHost,'program-source-flow-highlight');
    const transitionActiveRows=countNodesWithClass(transitionHost,'is-active');
    delete first._sourceFlowTransition;
    const completedModalHost=h('div',{});renderSelectionStatement({container:completedModalHost,item:first,program:first.program,
      statement,statementIndex:selectionIndex,isActive:false,
      services:{statementTraceModal:true,expressionOnly:true,preserveCompletedTimeline:true}});
    const host=h('div',{});renderSelectionStatement({container:host,item:first,program:first.program,statement,
      statementIndex:selectionIndex,isActive:false});
    const traversedOutputs=[];let outputResult={applied:false};
    while(first.program.status==='running'&&first.program.statements[first.program.cursor].kind==='output'){
      const activeOutput=first.program.statements[first.program.cursor];traversedOutputs.push(activeOutput.id);
      outputResult=dispatchProgramAction(first,{type:'emit-output',statementId:activeOutput.id});
    }
    const activeReturn=first.program.statements[first.program.cursor],runningBeforeReturn=first.program.status==='running';
    const returnPlan=statementInteractionPlan(first,activeReturn);
    const returned=returnPlan.action?dispatchProgramAction(first,returnPlan.action):{applied:false};
    const elseIf=items[2],firstDecision=elseIf.program.statements.findIndex(candidate=>candidate.kind==='selection');
    elseIf.program.memory={};elseIf.decls.forEach(declaration=>{elseIf.program.memory[declaration.name]={name:declaration.name,
      kind:declaration.kind,initialized:true,value:declaration.value};});
    elseIf.program.statements.slice(0,firstDecision).forEach(candidate=>candidate.status='complete');
    elseIf.program.cursor=firstDecision;const firstCondition=elseIf.program.statements[firstDecision];firstCondition.status='active';
    firstCondition.runtime.workingFlat={operands:[{id:'else-if-result',kind:'literal',value:firstCondition.runtime.expectedValue}],operators:[]};
    dispatchProgramAction(elseIf,{type:'commit-branch',statementId:firstCondition.id},{applyExpressionAction});
    const elseIfAdvanced=elseIf.program.statements[elseIf.program.cursor].selectionKind;
    const branchUndo=undoProgramAction(elseIf,{undoExpressionAction});
    const branchUndoStatement=elseIf.program.statements[elseIf.program.cursor];
    initializeSeededRandom(2);state.language='java';const javaItems=generateItemsForProfile('selection-statements-source');
    return JSON.stringify({count:items.length,filenames:items.map(item=>item.filename),kinds,
      sourceValueMode:profile.content.sourceValueMode,timelinePresentation:profile.program.timelinePresentation,
      profileItemCount:profile.scoring.itemCount,profileSelectionCount:profile.content.selection.count,
      manifestVersion:PROGRAM_SELECTION_PLUGIN_MANIFEST.version,sourcePanels,sourceRows,firstMemoryNames,
      sourceLineCount:first.sourceDisplay.lines.length,sourceActions,directActions,modalActions,activeSourceRows,oldTimelineRows,inlinePanels,inlineDefault,
      firstPlanMode:firstPlan.mode,firstPlanAction:firstPlan.action.type,directExecution:directExecution.applied,
      selectionPlanMode:selectionPlan.mode,selectionPlanFocus:selectionPlan.focus,
      outputPlanMode:outputPlan.mode,outputPlanAction:outputPlan.action.type,
      expressionOnlyKeywords:countNodesWithClass(expressionOnlyHost,'selection-keyword'),
      expressionOnlyParens:countNodesWithClass(expressionOnlyHost,'selection-paren'),
      completedModalPanels:countNodesWithClass(completedModalHost,'program-expression-panel'),
      completedModalCompacts:countNodesWithClass(completedModalHost,'selection-compact'),
      transitionOrigins,transitionDestinations,transitionHighlights,transitionActiveRows,
      sourceFlowTiming:DEFAULT_APP_SETTINGS.shell.sourceFlow,
      sourceProgramText:sourceHost.textContent,
      seededSources:items.map(item=>item.source),repeatSources:repeatItems.map(item=>item.source),
      changedSources:changedItems.map(item=>item.source),seedMaps:items.map(item=>item.sourceSeedValues),
      rangesValid:items[0].sourceSeedValues.score>=65&&items[0].sourceSeedValues.score<=100
        &&items[0].sourceSeedValues.absences>=0&&items[0].sourceSeedValues.absences<=8
        &&items[1].sourceSeedValues.temperature>=20&&items[1].sourceSeedValues.temperature<=40
        &&items[2].sourceSeedValues.grade>=70&&items[2].sourceSeedValues.grade<=100
        &&items[3].sourceSeedValues.day>=1&&items[3].sourceSeedValues.day<=4,
      sourceMemoryAligned:items.every(item=>Object.entries(item.sourceSeedValues).every(([name,value])=>
        item.decls.some(binding=>binding.name===name&&binding.value===value)&&item.source.includes(name+' = '+value+';'))),
      metadataHidden:items.every(item=>!item.source.includes('@seed')&&!item.sourceDisplay.lines.some(line=>line.text.includes('@seed'))),
      fixtureSeedA:fixtureA.details.seedValues,fixtureSeedRepeat:fixtureRepeat.details.seedValues,
      fixtureSeedB:fixtureB.details.seedValues,
      fixtureAuthored:fixtureAuthored.declarations,fixtureSeeded:fixtureA.declarations,fixtureSource:fixtureA.details.source,
      liveKinds:liveControl.statements.map(candidate=>candidate.kind),
      liveEdges:Object.fromEntries(liveControl.statements.map(candidate=>[candidate.id,candidate.kind==='selection'
        ?candidate.branches.map(branch=>branch.nextStatementId):candidate.nextStatementId])),
      undeclaredError,derivedError,badRangeError,duplicateError,
      sourceFlow:items.every(item=>item.sourceFlow),branchApplied:branch.applied,selectedLine:statement.runtime.selectedTargetLine,
      compactResults:countNodesWithClass(host,'selection-result-value'),trueBoxes:countNodesWithClass(host,'is-true'),
      compactText:host.textContent,conditionSource:statement.conditionSource,
      conditionText:selectionConditionText(statement),branchRows:countNodesWithClass(host,'selection-branch-row'),
      selectedKind:selectedStatement.kind,selectedId:selectedStatement.id,trueBranchTarget:statement.branches.find(row=>row.when===true).targetStatementId,
      traversedOutputs,outputResult:outputResult.applied,runningBeforeReturn,returnKind:activeReturn.kind,
      returnPlanMode:returnPlan.mode,returnPlanAction:returnPlan.action&&returnPlan.action.type,returned:returned.applied,
      completedAfterReturn:first.program.status==='complete',
      outputCounts:items.map(item=>item.program.statements.filter(candidate=>candidate.kind==='output').length),
      returnCounts:items.map(item=>item.program.statements.filter(candidate=>candidate.kind==='program-return').length),
      firstTrueContinues:first.program.statements.find(candidate=>candidate.id===statement.branches.find(row=>row.when===true).targetStatementId).nextStatementId,
      selectedBranchTarget:statement.branches.find(row=>row.when===Boolean(statement.runtime.expectedValue)).targetStatementId,
      elseIfAdvanced,branchUndo:branchUndo.applied,branchUndoId:branchUndoStatement.id,
      switchCases:items[3].program.statements.find(candidate=>candidate.kind==='selection').branches.length,
      allBranchTargets:items.every(item=>item.program.statements.filter(candidate=>candidate.kind==='selection')
        .every(candidate=>candidate.branches.every(row=>row.targetStatementId))),
      javaCount:javaItems.length,javaLanguage:javaItems[0].language,
      javaSeeded:javaItems.every(item=>Object.keys(item.sourceSeedValues).length>0),
      javaReturnCounts:javaItems.map(item=>item.program.statements.filter(candidate=>candidate.kind==='program-return').length),
      serializable:!!JSON.parse(JSON.stringify(items[2])).program});
  })()`));
  assert.strictEqual(result.count,4);
  assert.deepStrictEqual(result.filenames,['IfStatement.c','IfElse.c','ElseIfChain.c','SwitchCase.c']);
  assert.deepStrictEqual(result.kinds,[['if'],['if'],['if','else-if','else-if'],['switch']]);
  assert.strictEqual(result.sourceValueMode,'seeded');
  assert.strictEqual(result.timelinePresentation,'statement-modal');
  assert.strictEqual(result.profileItemCount,'manifest');
  assert.strictEqual(result.profileSelectionCount,'all');
  assert.deepStrictEqual(result.firstMemoryNames,['score','absences']);
  assert.strictEqual(new Set(result.firstMemoryNames).size,result.firstMemoryNames.length);
  assert.strictEqual(result.sourcePanels,1);
  assert.strictEqual(result.sourceRows,result.sourceLineCount);
  assert.strictEqual(result.sourceActions,1);
  assert.strictEqual(result.directActions,1);
  assert.strictEqual(result.modalActions,0);
  assert.strictEqual(result.activeSourceRows,1);
  assert.strictEqual(result.oldTimelineRows,0);
  assert.strictEqual(result.inlinePanels,0);
  assert.strictEqual(result.inlineDefault,'inline');
  assert.strictEqual(result.firstPlanMode,'direct');
  assert.strictEqual(result.firstPlanAction,'commit-assignment');
  assert(result.directExecution);
  assert.strictEqual(result.selectionPlanMode,'modal');
  assert.strictEqual(result.selectionPlanFocus,'condition-expression');
  assert.strictEqual(result.outputPlanMode,'direct');
  assert.strictEqual(result.outputPlanAction,'emit-output');
  assert.strictEqual(result.expressionOnlyKeywords,0);
  assert.strictEqual(result.expressionOnlyParens,0);
  assert.strictEqual(result.completedModalPanels,1);
  assert.strictEqual(result.completedModalCompacts,0);
  assert.strictEqual(result.transitionOrigins,1);
  assert.strictEqual(result.transitionDestinations,1);
  assert.strictEqual(result.transitionHighlights,1);
  assert.strictEqual(result.transitionActiveRows,0);
  assert(result.sourceFlowTiming.resultHoldMs>=800&&result.sourceFlowTiming.movementDurationMs>=1000
    &&result.sourceFlowTiming.modalCloseSettleMs>=250);
  assert(result.sourceProgramText.includes('#include <stdio.h>')&&result.sourceProgramText.includes('int main() {')
    &&result.sourceProgramText.includes('return 0;')&&result.sourceProgramText.includes('IfStatement.c'));
  assert.strictEqual(result.manifestVersion,'1.2.0');
  assert.deepStrictEqual(result.seededSources,result.repeatSources);
  assert.notDeepStrictEqual(result.seededSources,result.changedSources);
  assert(result.metadataHidden&&result.rangesValid&&result.sourceMemoryAligned
    &&result.seedMaps.every(values=>Object.keys(values).length>0));
  assert.deepStrictEqual(result.fixtureSeedA,result.fixtureSeedRepeat);
  assert.notDeepStrictEqual(result.fixtureSeedA,result.fixtureSeedB);
  assert.deepStrictEqual(result.fixtureAuthored.map(binding=>binding.value),[75,2,82,84]);
  assert.strictEqual(result.fixtureSeeded[0].value,75);
  assert(result.fixtureSeeded[1].value>=1&&result.fixtureSeeded[1].value<=5);
  assert.strictEqual(result.fixtureSeeded[3].value,result.fixtureSeeded[2].value+result.fixtureSeeded[1].value);
  assert(result.fixtureSource.includes(`const int adjustment = ${result.fixtureSeeded[1].value};`));
  assert(result.fixtureSource.includes(`int score = ${result.fixtureSeeded[2].value};`));
  assert.deepStrictEqual(result.liveKinds,['declaration','selection','output','output','selection','output','output','program-return']);
  assert.deepStrictEqual(result.liveEdges['selection-1'],['output-1','output-2']);
  assert.strictEqual(result.liveEdges['output-1'],'output-2');
  assert.strictEqual(result.liveEdges['output-2'],'selection-2');
  assert.deepStrictEqual(result.liveEdges['selection-2'],['output-3','output-4']);
  assert.strictEqual(result.liveEdges['output-3'],'output-4');
  assert.strictEqual(result.liveEdges['output-4'],'program-return');
  assert(result.undeclaredError.includes("undeclared binding 'missing'"));
  assert(result.derivedError.includes("requires a literal integer initializer"));
  assert(result.badRangeError.includes("invalid @seed range for 'x'"));
  assert(result.duplicateError.includes("duplicate @seed directive for 'x'"));
  assert(result.sourceFlow&&result.branchApplied&&result.selectedLine>0);
  assert.strictEqual(result.compactResults,1);
  assert.strictEqual(result.trueBoxes,1);
  assert(result.compactText.includes('true')&&!result.compactText.includes('TRUE'));
  assert.strictEqual(result.conditionSource,'score >= 75 && absences < 5');
  assert.strictEqual(result.conditionText,result.conditionSource);
  assert.strictEqual(result.branchRows,0);
  assert(result.selectedKind==='output'&&result.selectedId===result.selectedBranchTarget);
  assert(result.traversedOutputs.length>=1&&result.outputResult);
  assert(result.runningBeforeReturn&&result.returned&&result.completedAfterReturn);
  assert.strictEqual(result.returnKind,'program-return');
  assert.strictEqual(result.returnPlanMode,'direct');
  assert.strictEqual(result.returnPlanAction,'return-program');
  assert.deepStrictEqual(result.outputCounts,[2,3,7,4]);
  assert.deepStrictEqual(result.returnCounts,[1,1,1,1]);
  assert.strictEqual(result.firstTrueContinues,'output-2');
  assert.strictEqual(result.elseIfAdvanced,'else-if');
  assert(result.branchUndo&&result.branchUndoId==='selection-1');
  assert.strictEqual(result.switchCases,4);
  assert(result.allBranchTargets);
  assert(result.javaCount===4&&result.javaLanguage==='java'&&result.javaSeeded&&result.serializable);
  assert.deepStrictEqual(result.javaReturnCounts,[0,0,0,0]);
  assert(selectionStatementSource.includes('selectionExpressionResolved(statement)\n      ?completeSelection'));
  assert(!selectionRendererSource.includes('Trace branch'));
  assert(selectionRendererSource.includes("class:'selection-compact-source'"));
  assert(selectionRendererSource.includes("h('code',{class:'selection-compact-code'},selectionConditionText(statement))"));
  assert(selectionRendererSource.includes('selection-result-value'));
  assert(selectionStyles.includes('.selection-eval-panel{position:relative'));
  assert(selectionStyles.includes('.selection-compact-box.is-true{color:var(--good);'));
  assert(selectionStyles.includes('left:50%;bottom:-18px'));
  assert(selectionStyles.includes('border:0;background:transparent'));
  assert(selectionStyles.includes('font-variant-ligatures:none'));
  assert(selectionStyles.includes('font-feature-settings:"liga" 0,"calt" 0'));
  assert(selectionStyles.includes('.statement-trace-modal-content{width:min(1180px'));
  assert(selectionStyles.includes('.statement-trace-layout{display:grid;grid-template-columns:minmax(0,1fr)'));
  assert(selectionStyles.includes('.statement-trace-memory-list{display:grid;'));
  assert(selectionStyles.includes('.statement-trace-actions{display:flex;'));
  assert(sharedStyles.includes('.program-source-file-panel{'));
  assert(sharedStyles.includes('.program-source-file-line.is-active'));
  assert(sharedStyles.includes('.program-source-flow-highlight{'));
  assert(sharedStyles.includes('transition:transform var(--program-flow-duration)'));
  assert(sharedStyles.includes('box-shadow:inset 3px 0 0 var(--op)'));
  assert(!sharedStyles.includes('.program-source-flow-marker{'));
  assert(sharedStyles.includes('.program-source-file-line.is-flow-destination{background:transparent;box-shadow:none;}'));
  assert(sharedStyles.includes('.program-source-file-number{'));
  assert(sharedStyles.includes('.program-source-syntax-string{color:#a7cf8b;'));
  assert(sharedStyles.includes('.var-final-panel .tok-card-head,'));
  assert(sharedStyles.includes('.statement-trace-memory .tok-card-head{'));
  assert(sharedStyles.includes('text-transform:none;'));
  assert(sharedStyles.includes('@media(max-width:600px)'));
  assert(!selectionStyles.includes('.selection-result-value::before'));
  assert(!selectionStyles.includes('.selection-result-value::after'));
  assert(!selectionStyles.includes('selection-result-tab'));
  assert(!selectionStyles.includes('.selection-compact-box{position:relative;display:flex;align-items:center;width:100%'));
  assert(!selectionStyles.includes('selection-flow-connector'));
  assert.strictEqual(evaluate(ctx,`(()=>{const id='shared-result';return buildColorMap([
    {action:'SUBSTITUTE',target:'score',targetKind:'variable',resultNodeId:id},
    {action:'EVALUATE',resultNodeId:id}
  ],2).get(id)})()`),evaluate(ctx,'stepColor(1)'));
}

testProfileCategoriesAndScopedScores();
testModeScopedPersistence();
testProgramOutputStatementPlugin();
testProgramSelectionStatementPlugin();
run();
