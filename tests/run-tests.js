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
    vm.runInContext(fs.readFileSync(filename, 'utf8'), ctx, {filename});
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
  assert(localScripts.indexOf('plugins/simulate-output/catalog.js')
    <localScripts.indexOf('plugins/simulate-output/generator.js'));
  assert(localScripts.indexOf('plugins/simulate-output/generator.js')
    <localScripts.indexOf('plugins/simulate-output/plugin.js'));
  assert(localScripts.indexOf('plugins/simulate-output/plugin.js')
    <localScripts.indexOf('js/state.js'));
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
  assert(memoryFloatRenderer.includes("document.createElementNS(svgNS,'path')"));
  assert(memoryFloatRenderer.includes('trail.getPointAtLength(travelled)'));
  assert(memoryFloatRenderer.includes('function rollVarFinalCardValue('));
  assert(memoryFloatRenderer.includes('runVarFinalComet(sourceRect,destinationRect,color,rollIntoExpression)'));
  assert(memoryFloatRenderer.includes("rollVarFinalCardValue(renderedDestination,sourceValue,finishTransfer,'')"));
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
  assert(bundle.includes("settingsPolicy: 'local-configurable'"));
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
      strictDefault:snapshotExamPolicy({exam:{}}).interactionMode==='guided',
      practiceDefault:snapshotPracticePolicy({practice:{}}).interactionMode==='guided'});
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
    .replace("settingsPolicy: 'local-configurable'","settingsPolicy: 'state-only'");
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
      &&appSettings.mode==='practice'
      &&appSettings.timerMinutes===15
      &&appSettings.practice.interactionMode==='guided'
      &&appSettings.exam.interactionMode==='guided';
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
    profileCount:30,
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
    resumed:true, profileCount:30, preservedScore:0.75,policyMigrated:true,
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
    'declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js','state.js',
    'settings-persistence.js'
  ]);
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
      &&appSettings.mode==='practice';
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
    .replace(/,\s*\/\*\s*(?=\{\s*(?:enabled:true,\s*)?meta:\{id:'token-identifier-position')/,',\n')
    .replace(/,\s*\*\/\s*(?=\{\s*(?:enabled:true,\s*)?meta:\{id:'falling-identifier-sort')/,',\n');
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
    'plugins/simulate-output/manifest.js','plugins/simulate-output/catalog.js',
    'plugins/simulate-output/generator.js','plugins/simulate-output/actions.js',
    'plugins/simulate-output/feedback.js','plugins/simulate-output/renderer.js',
    'plugins/simulate-output/plugin.js'
  ]);
  load(ctx,['state.js']);
  ctx.document={querySelector:()=>null};
  ctx.savedEdits=0;
  ctx.saveSessionProgress=()=>{ctx.savedEdits++;};
  const catalog=JSON.parse(evaluate(ctx,'JSON.stringify(SO_EXERCISES)'));
  assert.strictEqual(catalog.length,19);
  catalog.forEach(exercise=>{
    const source=fs.readFileSync(path.join(ROOT,'plugins','simulate-output','exercises',exercise.filename),'utf8')
      .replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    assert.strictEqual(exercise.raw,source);
  });
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const profile=PROFILES.find(candidate=>candidate.id==='c-simulate-output');
    state.mode='practice';initializeSeededRandom(1234);
    const contextA={},items=Array.from({length:profile.itemCount},(_,index)=>
      soGenerateItem({profile,index,generationContext:contextA}));
    initializeSeededRandom(1234);
    const contextB={},repeat=Array.from({length:profile.itemCount},(_,index)=>
      soGenerateItem({profile,index,generationContext:contextB}));
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
    return JSON.stringify({profileActive:!!profile,count:items.length,
      unique:new Set(items.map(candidate=>candidate.exerciseId)).size,
      deterministic:items.map(candidate=>candidate.exerciseId).join(',')
        ===repeat.map(candidate=>candidate.exerciseId).join(','),
      allC:items.every(candidate=>candidate.language==='c'),metadataHidden,typingSaved,
      full:full.applied,fullScore,traceMatches,retry:retry.applied,resetClean,
      extraPenalty:extra.outputCorrect===item.expectedLines.length-1,
      snapshotStable,withheld,released});
  })()`));
  assert.deepStrictEqual(result,{profileActive:true,count:19,unique:19,deterministic:true,
    allC:true,metadataHidden:true,typingSaved:true,full:true,fullScore:10,traceMatches:true,
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
    const explicitVisibility=PROFILES.every(profile=>profile.enabled===true)
      &&PROFILE_CATEGORIES.every(category=>category.enabled===true);
    const expression=PROFILES.find(profile=>profile.id==='direct-ltr');
    const hiddenExpression=PROFILES.find(profile=>profile.id==='mult-precedence');
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
    const profile=PROFILES[0];
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
    const sameItem=state.profileId==='direct-ltr'&&state.itemIndex===2
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

testProfileCategoriesAndScopedScores();
testModeScopedPersistence();
run();
