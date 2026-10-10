const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {assertPhaseZeroBaseline} = require('./phase0-baseline');

const ROOT = path.resolve(__dirname, '..');
const loadedScriptsByContext = new WeakMap();

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
  const loaded=loadedScriptsByContext.get(ctx)||new Set();
  loadedScriptsByContext.set(ctx,loaded);
  const expanded=names.slice();
  if(expanded.includes('program-item-builder.js')){
    const semanticDependencies=['language-core.js','expression-parser.js','expression-semantics.js',
      'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
      'statement-semantics.js'];
    const insertion=expanded.includes('program-core.js')?expanded.indexOf('program-core.js')
      :expanded.indexOf('program-item-builder.js');
    expanded.splice(insertion,0,...semanticDependencies.filter(name=>!expanded.includes(name)&&!loaded.has(name)));
  }
  expanded.forEach(name=>{
    if(loaded.has(name)) return;
    const filename = path.join(ROOT, 'js', name);
    let source=fs.readFileSync(filename,'utf8');
    // Generator and renderer tests exercise every authored profile regardless
    // of the deployment visibility selected in the disk configuration.
    if(name==='profiles.js')source=source.replace(/enabled:false,/g,'enabled:true,');
    vm.runInContext(source, ctx, {filename});
    loaded.add(name);
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
  const localScripts=[...html.matchAll(/<script src="((?:js|plugins|exercise-libraries)\/[^\"]+)"/g)].map(match=>match[1]);
  new vm.Script(localScripts.map(name=>fs.readFileSync(path.join(ROOT,name),'utf8')).join('\n'),{filename:'complete-local-script-order.js'});
  assert(localScripts.includes('js/activity-core.js'));
  assert(localScripts.includes('js/source-library-registry.js'));
  assert(localScripts.includes('exercise-libraries/source-programs/library.js'));
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
  assert(localScripts.includes('plugins/code-simulator/manifest.js'));
  assert(localScripts.includes('plugins/code-simulator/content.js'));
  assert(localScripts.includes('plugins/program-input/manifest.js'));
  assert(localScripts.includes('plugins/program-input/parser.js'));
  assert(localScripts.includes('plugins/program-input/statement.js'));
  assert(localScripts.includes('plugins/program-input/renderer.js'));
  assert(localScripts.includes('js/program-terminal.js'));
  assert(localScripts.indexOf('js/dom-helpers.js')<localScripts.indexOf('js/program-terminal.js'));
  assert(localScripts.indexOf('js/program-terminal.js')<localScripts.indexOf('js/render-session.js'));
  assert(html.includes('plugins/program-input/styles.css'));
  assert(html.includes('plugins/code-simulator/styles.css'));
  assert(!html.includes('plugins/program-selection/'));
  assert(localScripts.indexOf('js/program-item-builder.js')
    <localScripts.indexOf('plugins/program-output/content.js'));
  assert(localScripts.indexOf('plugins/program-output/content.js')
    <localScripts.indexOf('js/state.js'));
  assert(localScripts.includes('js/program-return.js'));
  assert(localScripts.indexOf('js/program-return.js')<localScripts.indexOf('plugins/program-output/content.js'));
  assert(localScripts.includes('js/program-break.js'));
  assert(localScripts.indexOf('js/program-break.js')<localScripts.indexOf('plugins/code-simulator/content.js'));
  assert(localScripts.indexOf('js/source-library-registry.js')<localScripts.indexOf('plugins/program-output/manifest.js'));
  assert(localScripts.indexOf('exercise-libraries/source-programs/library.js')<localScripts.indexOf('plugins/program-output/manifest.js'));
  const stateSource=fs.readFileSync(path.join(ROOT,'js','state.js'),'utf8');
  const juiceSource=fs.readFileSync(path.join(ROOT,'js','juice.js'),'utf8');
  const shellSource=fs.readFileSync(path.join(ROOT,'js','shell-ui.js'),'utf8');
  const mainSource=fs.readFileSync(path.join(ROOT,'js','main.js'),'utf8');
  const loginSource=fs.readFileSync(path.join(ROOT,'js','login.js'),'utf8');
  const settingsPersistenceSource=fs.readFileSync(path.join(ROOT,'js','settings-persistence.js'),'utf8');
  const sharedStylesSource=fs.readFileSync(path.join(ROOT,'css','styles.css'),'utf8');
  assert(stateSource.includes("event&&event.type==='RETURN'&&typeof celebrateProgramCompletion==='function'"));
  assert(juiceSource.includes('function celebrateProgramCompletion(item,referenceEl)'));
  assert(stateSource.includes('activityZoom:Object.freeze({'));
  assert(stateSource.includes('minPercent:80')&&stateSource.includes('maxPercent:140'));
  assert(shellSource.includes("const ACTIVITY_ZOOM_STORAGE_PREFIX='precedifyActivityZoom:'"));
  assert(shellSource.includes('function mountActivityZoom(container)'));
  assert(shellSource.includes("element.classList.add('activity-zoom-surface')"));
  assert(shellSource.includes("element.style.removeProperty('width')"));
  assert(!shellSource.includes('element.style.width=`${100/factor}%`'));
  assert(shellSource.includes("event.altKey")&&shellSource.includes("event.key==='0'"));
  assert(mainSource.includes("mountActivityZoom(container)"));
  assert(mainSource.includes("renderProfileSelectionPrompt(container)"));
  assert(!loginSource.includes("if(openCategoryIds.size===0 && currentProfile())"));
  assert(settingsPersistenceSource.includes("key.indexOf('precedifyActivityZoom:')===0"));
  assert(html.includes('id="activityZoomControl" class="activity-zoom-control"'));
  assert(shellSource.includes('function toggleActivityZoomPopover(event)'));
  assert(!shellSource.includes("toolbar.className='activity-zoom-toolbar'"));
  assert(sharedStylesSource.includes('.activity-zoom-control{position:relative;'));
  assert(sharedStylesSource.includes('.activity-zoom-control.open .activity-zoom-popover'));
  assert(sharedStylesSource.includes('.activity-zoom-surface{'));
  assert(sharedStylesSource.includes('@media (max-width:768px)'));
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
  const consoleDrawerContent = fs.readFileSync(path.join(ROOT,'js','console-drawer-content.js'),'utf8');
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
  assert(consoleDrawerContent.includes('const panelRect = connectorContentRect(timelineEl);'));
  assert(!consoleDrawerContent.includes('const panelRect = timelineEl.getBoundingClientRect();'));
  assert(memoryRenderer.includes("class:'var-final-group var-final-group-constants'"));
  assert(memoryRenderer.includes("class:'var-final-group var-final-group-variables'"));
  assert(!memoryRenderer.includes('renderBindingInfoTrigger'));
  assert(memoryFloatRenderer.includes('function cycleVarFinalFlyAnimation()'));
  assert(memoryFloatRenderer.includes('function mountVarFinalDockPanel('));
  assert(memoryFloatRenderer.includes("setProgramContextTab('memory')"));
  assert(memoryFloatRenderer.includes('Off -> 1s -> 2s -> 3s'));
  assert(!memoryFloatRenderer.includes('renderVarFinalSpeedToggle'));
  assert(!memoryFloatRenderer.includes('var-final-float-speed-row'));
  assert(memoryFloatRenderer.includes("if(id!=null){")
    &&memoryFloatRenderer.includes("var-final-insert-pending")
    &&memoryFloatRenderer.includes("b._insertPending=true")
    &&memoryFloatRenderer.includes("function currentVarFinalFlightCard")
    &&memoryFloatRenderer.includes("const liveCard=currentVarFinalFlightCard(f)")
    &&memoryFloatRenderer.includes("function settleVarFinalInsertion"));
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
  assert(memoryFloatRenderer.includes("rollVarFinalCardValue(renderedDestination,sourceValue,finishTransfer,'',named.dataType)"));
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
  assert(declarationRenderer.includes("!(ctx.services&&ctx.services.statementTraceModal)"));
  assert(assignmentRenderer.includes("!(ctx.services&&ctx.services.statementTraceModal)"));
  assert(fs.readFileSync(path.join(ROOT,'js','render-unary-update.js'),'utf8')
    .includes("!(ctx.services&&ctx.services.statementTraceModal)"));
}

function testExerciseLibraryRegistry(){
  const ctx=context();
  load(ctx,['source-library-registry.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    registerExerciseLibrary({id:'sample-library',root:'fixtures/source-programs',languages:['c','java'],aliases:['legacy-sample']});
    let duplicate=false,unsupported=false,unsafe=false;
    try{registerExerciseLibrary({id:'sample-library',root:'fixtures/other',languages:['c']});}catch(error){duplicate=true;}
    try{resolveExerciseManifestUrl({library:'sample-library',language:'python',exerciseSet:'basics'});}catch(error){unsupported=true;}
    try{registerExerciseLibrary({id:'unsafe',root:'../outside',languages:['c']});}catch(error){unsafe=true;}
    return JSON.stringify({
      url:resolveExerciseManifestUrl({library:'sample-library',language:'c',exerciseSet:'formatted-output'}),
      aliasUrl:resolveExerciseManifestUrl({library:'legacy-sample',language:'java',exerciseSet:'selection-basics'}),
      duplicate,unsupported,unsafe
    });
  })()`));
  assert.strictEqual(result.url,'fixtures/source-programs/c/formatted-output/manifest.json');
  assert.strictEqual(result.aliasUrl,'fixtures/source-programs/java/selection-basics/manifest.json');
  assert(result.duplicate&&result.unsupported&&result.unsafe);
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

    const canonicalMap=sourceProgramCanonicalStatementIds([
      {id:'condition',kind:'selection',sourceLine:3,sourceEndLine:3},
      {id:'true-branch',kind:'assignment',sourceLine:4,sourceEndLine:4},
      {id:'skipped-branch-map',kind:'assignment',sourceLine:6,sourceEndLine:6}
    ],{metadata:{executionFrames:[
      {statementId:'selection-raw',statementKind:'selection',sourceLine:3},
      {statementId:'assignment-raw',statementKind:'assignment',sourceLine:4}
    ]}});
    const canonicalMapExcludesSkipped=JSON.stringify(canonicalMap)===JSON.stringify(['condition','true-branch']);
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

    const pendingOtherPartition=itemFor(runtime([2,0,900,500,430,100],['>','&&','>=','||','<'],4));
    const pendingRuntime=currentProgramStatement(pendingOtherPartition).runtime;
    pendingRuntime.workingFlat.operands.forEach((operand,index)=>operand.parenGroup=index<4?'left-condition':'right-condition');
    pendingRuntime.originalFlat=deepCloneFlat(pendingRuntime.workingFlat);
    pendingRuntime.history=[deepCloneFlat(pendingRuntime.workingFlat)];
    state.items=[pendingOtherPartition];state.itemIndex=0;state.profileId=pendingOtherPartition.profileId;
    flat=pendingRuntime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const pendingOtherPartitionDoesNotPenalize=pendingRuntime.trace.length===1
      &&pendingRuntime.trace[0].target.operator==='>'&&pendingRuntime.trace[0].wasCorrect===true;
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

    const creditedRuntime=runtime([2,3],['+'],null);creditedRuntime.expectedValue=5;
    const blockedRuntime=runtime([7,2],['+'],0);blockedRuntime.expectedValue=9;
    const skippedRuntime=runtime([9,1],['-'],null);skippedRuntime.expectedValue=8;
    const partial=itemFor(creditedRuntime),credited=partial.program.statements[0];
    credited.id='credited';credited.binding.name='a';
    const blocked={id:'blocked',kind:'declaration',status:'locked',dependencies:[],
      binding:{name:'b',kind:'variable',dataType:'int',mutable:true},runtime:blockedRuntime};
    const skipped={id:'skipped-branch',kind:'declaration',status:'locked',dependencies:[],
      binding:{name:'unused',kind:'variable',dataType:'int',mutable:true},runtime:skippedRuntime};
    const finalStatement={id:'expression',kind:'legacy-expression',status:'locked'};
    partial.program=createProgram([credited,blocked,skipped,finalStatement]);
    partial.program.mode='interactive-declarations';partial.program.scoreAssignments=true;
    partial.canonicalStatementIds=['credited','blocked','expression'];
    state.items=[partial];state.itemIndex=0;state.profileId=partial.profileId;
    flat=credited.runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    handleTokenClick({type:'commit-assignment'});
    flat=blocked.runtime.workingFlat;
    handleTokenClick({type:'evaluate',leftId:flat.operands[0].id,rightId:flat.operands[1].id});
    const terminalPartialCredit=partial.checked&&partial.examSequenceFailure.terminal
      &&partial.examSequenceFailure.correctPrefixChecks===2
      &&partial.examSequenceFailure.totalChecks===5
      &&partial.points===0.4&&partial.maxPoints===1;
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
    return JSON.stringify({canonicalMapExcludesSkipped,wrongOrderContinues,chainContinued,independentCredit,localPairContinues,pendingOtherPartitionDoesNotPenalize,terminalPartialCredit,
      prematureTerminates,prematureAssignmentTerminates,guidedUnchanged,practicePaused,practiceRecovered,guidedPracticeUnchanged,
      strictDefault:snapshotExamPolicy({exam:{}}).interactionMode===DEFAULT_APP_SETTINGS.exam.interactionMode,
      practiceDefault:snapshotPracticePolicy({practice:{}}).interactionMode===DEFAULT_APP_SETTINGS.practice.interactionMode});
  })()`));
  assert.deepStrictEqual(result,{canonicalMapExcludesSkipped:true,wrongOrderContinues:true,chainContinued:true,independentCredit:true,
    localPairContinues:true,pendingOtherPartitionDoesNotPenalize:true,terminalPartialCredit:true,prematureTerminates:true,prematureAssignmentTerminates:true,guidedUnchanged:true,practicePaused:true,
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
    state.mode='exam';
    const terminalItem={points:0.8,maxPoints:2,examSequenceFailure:{terminal:true,statementId:failing.id}};
    const terminalAlert=renderInvalidExecutionAlert(terminalItem,failing);
    const terminalShowsPartialScore=terminalAlert.textContent.includes('0.8 of 2 points');
    return JSON.stringify({
      originRecorded:item.practiceInvalidExecution.reason==='assignment-value-unresolved',
      oneAlert:countNodesWithClass(rendered,'invalid-execution-alert')===1,
      onePausedStatement:countNodesWithClass(rendered,'practice-paused')===1,
      explicitOrigin,
      fallbackMatchesCurrent,terminalShowsPartialScore
    });
  })()`));
  assert.deepStrictEqual(result,{originRecorded:true,oneAlert:true,onePausedStatement:true,
    explicitOrigin:true,fallbackMatchesCurrent:true,terminalShowsPartialScore:true});
}

function generatedSnapshotHash(){
  const ctx = context();
  load(ctx, ['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js']);
  const json = evaluate(ctx, `(()=>{
    __idCounter = 1;
    initializeSeededRandom(1592594996);
    const result = PROFILES.filter(p=>!p.content&&!p.lesson).map(p=>{
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

function testLanguageCoreContracts(){
  const ctx=context();
  load(ctx,['program-ir.js','language-core.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const location=languageCoreSourceLocation({filename:'Task.c',start:{line:3,column:5},end:{line:3,column:12}});
    const expression=binaryExpression('+',
      unaryExpression('++',identifierExpression('p'),{form:'prefix'}),
      unaryExpression('++',identifierExpression('q'),{form:'postfix'}));
    const statement=declarationStatement({id:'decl-sum',name:'sum',initializer:expression,sourceSpan:location});
    assertExpressionIr(expression);assertStatementIr(statement);
    const program=languageCoreProgramIr({language:'C',source:'int sum = ++p + q++;',statements:[statement]});
    registerLanguageCoreService('parseExpression',request=>({
      ir:expression,
      dependencies:['p','q','p'],
      diagnostics:[{code:'BASELINE_INFO',severity:'info',message:'compatibility service',location}],
      effects:[],trace:[]
    }));
    registerLanguageCoreService('evaluateExpression',request=>({
      value:9,
      dependencies:['p','q'],
      effects:[
        {kind:'write',target:'p',previousValue:4,nextValue:5},
        {kind:'write',target:'q',previousValue:4,nextValue:5}
      ],
      trace:[
        {action:'UNARY',operator:'++',form:'prefix',target:'p',result:5,writeValue:5},
        {action:'UNARY',operator:'++',form:'postfix',target:'q',result:4,writeValue:5},
        {action:'EVALUATE',operator:'+',result:9}
      ]
    }));
    const parsed=coreParseExpression({language:'C',source:'++p + q++',symbols:{p:4,q:4},location});
    const evaluated=coreEvaluateExpression({language:'c',expression:parsed.ir,memory:{p:4,q:4}});
    let duplicateRejected=false,unknownRejected=false,missingRejected=false,invalidIrRejected=false;
    try{registerLanguageCoreService('parseExpression',()=>({}));}catch(error){duplicateRejected=/already registered/.test(error.message);}
    try{registerLanguageCoreService('unknown',()=>({}));}catch(error){unknownRejected=/Unknown/.test(error.message);}
    try{coreParseStatement({language:'c',source:'int x = 1;'});}catch(error){missingRejected=/not registered/.test(error.message);}
    try{assertExpressionIr({kind:'unary',operator:'++'});}catch(error){invalidIrRejected=/operand/.test(error.message);}
    return JSON.stringify({
      contractVersion:LANGUAGE_CORE_CONTRACT_VERSION,
      irVersions:[EXPRESSION_IR_SCHEMA_VERSION,STATEMENT_IR_SCHEMA_VERSION,PROGRAM_IR_SCHEMA_VERSION],
      services:LANGUAGE_CORE_SERVICE_NAMES,
      location,
      programLanguage:program.language,
      programSchema:program.schemaVersion,
      statementKind:program.statements[0].kind,
      parsedVersion:parsed.contractVersion,
      parsedDependencies:parsed.dependencies,
      diagnostic:parsed.diagnostics[0],
      evaluatedValue:evaluated.value,
      effects:evaluated.effects,
      trace:evaluated.trace,
      duplicateRejected,unknownRejected,missingRejected,invalidIrRejected,
      serializable:!!JSON.parse(JSON.stringify({program,parsed,evaluated}))
    });
  })()`));
  assert.strictEqual(result.contractVersion,1);
  assert.deepStrictEqual(result.irVersions,[1,1,1]);
  assert.deepStrictEqual(result.services,['parseExpression','parseStatement','evaluateExpression','executeStatement','parseProgram']);
  assert.deepStrictEqual(result.location,{filename:'Task.c',start:{line:3,column:5},end:{line:3,column:12}});
  assert.strictEqual(result.programLanguage,'c');
  assert.strictEqual(result.programSchema,1);
  assert.strictEqual(result.statementKind,'declaration');
  assert.strictEqual(result.parsedVersion,1);
  assert.deepStrictEqual(result.parsedDependencies,['p','q']);
  assert.strictEqual(result.diagnostic.code,'BASELINE_INFO');
  assert.strictEqual(result.evaluatedValue,9);
  assert.deepStrictEqual(result.effects.map(effect=>[effect.kind,effect.target,effect.previousValue,effect.nextValue]),[
    ['write','p',4,5],['write','q',4,5]
  ]);
  assert.deepStrictEqual(result.trace.map(step=>[step.action,step.result,step.writeValue||null]),[
    ['UNARY',5,5],['UNARY',4,5],['EVALUATE',9,null]
  ]);
  assert(result.duplicateRejected&&result.unknownRejected&&result.missingRejected&&result.invalidIrRejected&&result.serializable);
}

function testSharedExpressionParser(){
  const programOutputSource=fs.readFileSync(path.join(ROOT,'plugins','program-output','content.js'),'utf8');
  const codeSimulatorSource=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','content.js'),'utf8');
  assert(!programOutputSource.includes('function poExpressionTokens'));
  assert(!codeSimulatorSource.includes('function csExpressionTokens'));
  const ctx=context();installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','program-ir.js','language-core.js','expression-parser.js','program-item-builder.js',
    'dom-helpers.js','render-tree.js','render-flat.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const symbols={
      p:{kind:'variable',value:4,initialized:true,dataType:'int'},
      q:{kind:'variable',value:4,initialized:true,dataType:'int'},
      x:{kind:'variable',value:2,initialized:true,dataType:'int'},
      a:{kind:'variable',value:5,initialized:true,dataType:'int'},
      b:{kind:'variable',value:6,initialized:true,dataType:'int'},
      LIMIT:{kind:'constant',value:10,initialized:true,dataType:'int',mutable:false},
      deposit:{kind:'variable',value:350,initialized:true,dataType:'int'},
      withdrawal:{kind:'variable',value:200,initialized:true,dataType:'int'},
      balance:{kind:'variable',value:1200,initialized:true,dataType:'int'}
    };
    const normalize=node=>{
      if(node.kind==='literal')return {kind:'literal',value:node.value,dataType:node.dataType||null};
      if(node.kind==='identifier')return {kind:'identifier',name:node.name};
      if(node.kind==='unary')return {kind:'unary',operator:node.operator,form:node.form,operand:normalize(node.operand)};
      return {kind:'binary',operator:node.operator,left:normalize(node.left),right:normalize(node.right)};
    };
    const generated=engineNodeToProgramIr(makeBinOp('+',
      makeUnary('++','prefix',makeNamed('variable','p',4)),
      makeUnary('++','postfix',makeNamed('variable','q',4))));
    const c=coreParseExpression({language:'c',source:'++p + q++',symbols,
      location:{filename:'TaskPapa.c',start:{line:53,column:15},end:{line:53,column:24}}});
    const java=coreParseExpression({language:'java',source:'++p + q++',symbols});
    const engineTree=coreExpressionIrToEngineTree(c.ir,symbols);
    const precedence=coreParseExpression({language:'c',source:'1 + x * 3 < LIMIT && !false',symbols});
    const character=coreParseExpression({language:'c',source:"'B'",symbols});
    const decimal=coreParseExpression({language:'c',source:'(a + b) / 2.0',symbols});
    const decimalTree=coreExpressionIrToEngineTree(decimal.ir,symbols);
    const decimalTrace=buildCanonicalTrace(decimalTree);
    const groupedBooleanSource='(deposit > 0 && withdrawal <= balance) || (withdrawal == 0 && !((deposit < 0)))';
    const groupedBoolean=coreParseExpression({language:'c',source:groupedBooleanSource,symbols});
    const groupedBooleanTree=coreExpressionIrToEngineTree(groupedBoolean.ir,symbols);
    const groupedBooleanFlat=flattenInstance(deepClone(groupedBooleanTree));
    const groupedBooleanModalText=renderInteractiveFlatExpr(groupedBooleanFlat,new Map(),'#f0a050',null,true).textContent;
    const groupedBooleanReady=deepCloneFlat(groupedBooleanFlat);
    groupedBooleanReady.operands.forEach(operand=>{if(operand.kind==='variable'||operand.kind==='constant')operand.resolved=true;});
    const groupedBooleanCandidates=getMaxPrecCandidatesFlat(groupedBooleanReady).map(candidate=>candidate.op);
    const independentTree=coreExpressionIrToEngineTree(
      coreParseExpression({language:'c',source:'(1 + 2) + (3 - 1)',symbols}).ir,symbols);
    const independentFlat=flattenInstance(deepClone(independentTree));
    const independentCandidates=getMaxPrecCandidatesFlat(independentFlat).map(candidate=>candidate.op);
    const nestedTree=coreExpressionIrToEngineTree(
      coreParseExpression({language:'c',source:'(1 + (2 - 3)) * (3 + 2)',symbols}).ir,symbols);
    const nestedFlat=flattenInstance(deepClone(nestedTree));
    const nestedCandidates=getMaxPrecCandidatesFlat(nestedFlat);
    const rightFirst=nestedCandidates.find(candidate=>candidate.op==='+');
    const afterRight=evaluateFlatAt(nestedFlat,rightFirst.leftId,rightFirst.rightId).newFlat;
    const afterRightCandidates=getMaxPrecCandidatesFlat(afterRight).map(candidate=>candidate.op);
    let constantUnaryRejected=false,doublePostfixRejected=false,unknownRejected=false;
    try{coreParseExpression({language:'c',source:'LIMIT++',symbols});}catch(error){constantUnaryRejected=/mutable variable/.test(error.message);}
    try{coreParseExpression({language:'c',source:'p++++',symbols});}catch(error){doublePostfixRejected=/unsupported expression/.test(error.message);}
    try{coreParseExpression({language:'c',source:'missing + 1',symbols});}catch(error){unknownRejected=/used before it is initialized/.test(error.message);}
    return JSON.stringify({
      c:normalize(c.ir),java:normalize(java.ir),generated:normalize(generated),
      dependencies:c.dependencies,value:evalTree(engineTree),canonicalActions:buildCanonicalTrace(engineTree).steps.map(step=>step.action),
      precedence:normalize(precedence.ir),character:normalize(character.ir),
      decimalSourceText:decimal.ir.right.sourceText,decimalTreeText:renderString(decimalTree),
      decimalFlatText:flatToString(flattenInstance(deepClone(decimalTree))),decimalValue:evalTree(decimalTree),
      decimalFinalValue:decimalTrace.finalValue,groupedBooleanSource,
      groupedBooleanTreeText:renderString(groupedBooleanTree),
      groupedBooleanFlatText:flatToString(groupedBooleanFlat),groupedBooleanModalText,groupedBooleanCandidates,
      independentCandidates,nestedCandidateOps:nestedCandidates.map(candidate=>candidate.op),afterRightCandidates,
      constantUnaryRejected,doublePostfixRejected,unknownRejected
    });
  })()`));
  assert.deepStrictEqual(result.c,result.generated);
  assert.deepStrictEqual(result.java,result.generated);
  assert.deepStrictEqual(result.dependencies,['p','q']);
  assert.strictEqual(result.value,9);
  assert.deepStrictEqual(result.canonicalActions,['SUBSTITUTE','UNARY','SUBSTITUTE','UNARY','EVALUATE']);
  assert.strictEqual(result.precedence.operator,'&&');
  assert.strictEqual(result.precedence.left.operator,'<');
  assert.strictEqual(result.precedence.left.left.operator,'+');
  assert.strictEqual(result.precedence.left.left.right.operator,'*');
  assert.strictEqual(result.precedence.right.operator,'!');
  assert.deepStrictEqual(result.character,{kind:'literal',value:'B',dataType:'char'});
  assert.strictEqual(result.decimalSourceText,'2.0');
  assert.strictEqual(result.decimalTreeText,'(a + b) / 2.0');
  assert.strictEqual(result.decimalFlatText,'(a + b) / 2.0');
  assert.strictEqual(result.decimalValue,5.5);
  assert.strictEqual(result.decimalFinalValue,5.5);
  assert.strictEqual(result.groupedBooleanTreeText,result.groupedBooleanSource);
  assert.strictEqual(result.groupedBooleanFlatText,result.groupedBooleanSource);
  assert.strictEqual(result.groupedBooleanModalText,result.groupedBooleanSource);
  assert.deepStrictEqual(result.groupedBooleanCandidates.slice().sort(),['<','<=','==','>']);
  assert.deepStrictEqual(result.independentCandidates.slice().sort(),['+','-']);
  assert.deepStrictEqual(result.nestedCandidateOps.slice().sort(),['+','-']);
  assert.deepStrictEqual(result.afterRightCandidates,['-']);
  assert(result.constantUnaryRejected&&result.doublePostfixRejected&&result.unknownRejected);
}

function testSharedExpressionSemantics(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js','output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js','statement-semantics.js',
    'program-core.js','declaration-statement-plugin.js','assignment-statement-plugin.js','program-item-builder.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const binding=value=>({kind:'variable',mutable:true,initialized:true,value});
    const symbols={p:binding(4),q:binding(4)};
    const parsed=coreParseExpression({language:'c',source:'++p + q++',symbols});
    const sourceMemory={p:binding(4),q:binding(4)};
    const evaluated=coreEvaluateExpression({language:'c',expression:parsed.ir,memory:sourceMemory});
    const typedBinding=(value,dataType)=>({kind:'variable',mutable:true,initialized:true,value,dataType});
    const decimalMemory={a:typedBinding(5,'int'),b:typedBinding(6,'int')};
    const decimalParsed=coreParseExpression({language:'c',source:'(a + b) / 2.0',symbols:decimalMemory});
    const decimalEvaluated=coreEvaluateExpression({language:'c',expression:decimalParsed.ir,memory:decimalMemory});
    const inputUnchanged=sourceMemory.p.value===4&&sourceMemory.q.value===4;
    const appliedMemory={p:binding(4),q:binding(4)};
    const snapshot=captureCoreMemoryTargets(appliedMemory,['p','q']);
    applyCoreExpressionEffects(appliedMemory,evaluated.effects,'semantic-test');
    const appliedValues={p:appliedMemory.p.value,q:appliedMemory.q.value};
    restoreCoreMemoryTargets(appliedMemory,snapshot);
    const restoredValues={p:appliedMemory.p.value,q:appliedMemory.q.value};

    const declaration=declarationStatement({id:'decl-sum',name:'sum',initializer:parsed.ir});
    declaration.binding.kind='variable';
    declaration.dependencies=['p','q'];
    declaration.runtime=buildDeclarationRuntime(coreExpressionIrToEngineTree(parsed.ir,symbols),9);
    declaration.runtime.workingFlat=flattenInstance(makeLiteral(9));
    declaration.runtime.history=[deepCloneFlat(declaration.runtime.workingFlat)];
    declaration.runtime.trace=evaluated.trace.map(step=>Object.assign({wasCorrect:true},step));
    declaration.runtime.expectedEffects=evaluated.effects;
    const declarationProgram=createProgram([declaration],{language:'c',memory:{p:binding(4),q:binding(4)}});
    const declarationItem={program:declarationProgram,_bindings:[]};
    const declarationCommit=statementPluginFor(declaration).applyAction({statement:declaration,program:declarationProgram,
      item:declarationItem,action:{type:'commit-assignment'},services:{}});
    const declarationValues={p:declarationProgram.memory.p.value,q:declarationProgram.memory.q.value,
      sum:declarationProgram.memory.sum.value};
    const declarationRollback=statementPluginFor(declaration).rollbackCompletion({statement:declaration,
      program:declarationProgram,item:declarationItem});
    const declarationRestored={p:declarationProgram.memory.p.value,q:declarationProgram.memory.q.value,
      hasSum:Object.prototype.hasOwnProperty.call(declarationProgram.memory,'sum')};

    const assignment=assignmentStatement({id:'assign-x',target:'x',operator:'=',value:parsed.ir});
    assignment.dependencies=['p','q'];
    assignment.runtime=buildDeclarationRuntime(coreExpressionIrToEngineTree(parsed.ir,symbols),9);
    assignment.runtime.expectedBefore=0;assignment.runtime.expectedRhs=9;assignment.runtime.expectedAfter=9;
    assignment.runtime.workingFlat=flattenInstance(makeLiteral(9));
    assignment.runtime.history=[deepCloneFlat(assignment.runtime.workingFlat)];
    assignment.runtime.trace=evaluated.trace.map(step=>Object.assign({wasCorrect:true},step));
    assignment.runtime.expectedEffects=evaluated.effects;
    const assignmentProgram=createProgram([assignment],{language:'c',memory:{x:binding(0),p:binding(4),q:binding(4)}});
    const assignmentItem={program:assignmentProgram,_bindings:[]};
    const assignmentCommit=statementPluginFor(assignment).applyAction({statement:assignment,program:assignmentProgram,
      item:assignmentItem,action:{type:'commit-assignment'},services:{}});
    const assignmentValues={x:assignmentProgram.memory.x.value,p:assignmentProgram.memory.p.value,q:assignmentProgram.memory.q.value};
    const assignmentRollback=statementPluginFor(assignment).rollbackCompletion({statement:assignment,
      program:assignmentProgram,item:assignmentItem});
    const assignmentRestored={x:assignmentProgram.memory.x.value,p:assignmentProgram.memory.p.value,q:assignmentProgram.memory.q.value};
    return JSON.stringify({
      value:evaluated.value,inputUnchanged,decimalValue:decimalEvaluated.value,
      decimalDataType:decimalEvaluated.dataType,
      effectKinds:evaluated.effects.map(effect=>effect.kind),
      writes:evaluated.effects.filter(effect=>effect.kind==='write').map(effect=>[effect.target,effect.previousValue,effect.nextValue,effect.form]),
      trace:evaluated.trace.map(step=>[step.action,typeof step.target==='string'?step.target:null,step.result,step.writeValue]),
      appliedValues,restoredValues,
      declarationApplied:declarationCommit.applied,declarationEffects:declarationCommit.event.effects.length,
      declarationValues,declarationRollback:declarationRollback.applied,declarationRestored,
      assignmentApplied:assignmentCommit.applied,assignmentEffects:assignmentCommit.event.effects.length,
      assignmentValues,assignmentRollback:assignmentRollback.applied,assignmentRestored
    });
  })()`));
  assert.strictEqual(result.value,9);
  assert.strictEqual(result.decimalValue,5.5);
  assert.strictEqual(result.decimalDataType,'float');
  assert(result.inputUnchanged);
  assert.deepStrictEqual(result.effectKinds,['read','write','read','write']);
  assert.deepStrictEqual(result.writes,[['p',4,5,'prefix'],['q',4,5,'postfix']]);
  assert.deepStrictEqual(result.trace,[
    ['SUBSTITUTE','p',null,null],['UNARY','p',5,5],
    ['SUBSTITUTE','q',null,null],['UNARY','q',4,5],['EVALUATE',null,9,null]
  ]);
  assert.deepStrictEqual(result.appliedValues,{p:5,q:5});
  assert.deepStrictEqual(result.restoredValues,{p:4,q:4});
  assert(result.declarationApplied&&result.declarationRollback&&result.declarationEffects===2);
  assert.deepStrictEqual(result.declarationValues,{p:5,q:5,sum:9});
  assert.deepStrictEqual(result.declarationRestored,{p:4,q:4,hasSum:false});
  assert(result.assignmentApplied&&result.assignmentRollback&&result.assignmentEffects===2);
  assert.deepStrictEqual(result.assignmentValues,{x:9,p:5,q:5});
  assert.deepStrictEqual(result.assignmentRestored,{x:0,p:4,q:4});
}

function testSharedStatementParser(){
  const programOutputSource=fs.readFileSync(path.join(ROOT,'plugins','program-output','content.js'),'utf8');
  const codeSimulatorSource=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','content.js'),'utf8');
  assert(!programOutputSource.includes('const declarationPattern='));
  assert(!programOutputSource.includes('const unary=/'));
  assert(!programOutputSource.includes('const assignment=/'));
  assert(!codeSimulatorSource.includes('const unary=/'));
  assert(!codeSimulatorSource.includes('const assignment=/'));
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const variable=(value,initialized=true)=>({kind:'variable',mutable:true,value,initialized,dataType:'int'});
    const constant=value=>({kind:'constant',mutable:false,value,initialized:true,dataType:'int'});
    const cDeclaration=coreParseStatement({language:'c',source:'const float rate = 1.5;',symbols:{},
      location:{filename:'Shared.c',start:{line:4,column:3},end:{line:4,column:26}}});
    const javaDeclaration=coreParseStatement({language:'java',source:"final char grade = 'B';",symbols:{}});
    const uninitialized=coreParseStatement({language:'c',source:'int score;',symbols:{}});
    const assign=coreParseStatement({language:'c',source:'score = 75;',symbols:{score:variable(undefined,false)}});
    const compound=coreParseStatement({language:'java',source:'score += 5;',symbols:{score:variable(75)}});
    const prefix=coreParseStatement({language:'c',source:'++score;',symbols:{score:variable(75)}});
    const postfix=coreParseStatement({language:'java',source:'score--;',symbols:{score:variable(75)}});
    const breakStatement=coreParseStatement({language:'c',source:'break;',symbols:{}});
    const returnStatement=coreParseStatement({language:'c',source:'return 0;',symbols:{}});
    const javaInput=coreParseStatement({language:'java',source:'score = scanner.nextInt();',
      symbols:{score:variable(undefined,false)},inputValues:{score:12}});
    let immutableRejected=false,uninitializedCompoundRejected=false,duplicateRejected=false;
    try{coreParseStatement({language:'c',source:'LIMIT = 3;',symbols:{LIMIT:constant(2)}});}catch(error){immutableRejected=/mutable variable/.test(error.message);}
    try{coreParseStatement({language:'c',source:'score += 3;',symbols:{score:variable(undefined,false)}});}catch(error){uninitializedCompoundRejected=/before it is initialized/.test(error.message);}
    try{coreParseStatement({language:'c',source:'int score = 1;',symbols:{score:variable(0)}});}catch(error){duplicateRejected=/duplicate declaration/.test(error.message);}
    return JSON.stringify({
      cKind:cDeclaration.ir.kind,cBinding:cDeclaration.ir.binding,cValue:cDeclaration.ir.initializer.value,
      cLine:cDeclaration.ir.sourceSpan.start.line,
      javaKind:javaDeclaration.ir.kind,javaBinding:javaDeclaration.ir.binding,javaValue:javaDeclaration.ir.initializer.value,
      uninitialized:uninitialized.ir.initialized,
      assignKind:assign.ir.kind,assignOperator:assign.ir.operator,assignValue:assign.ir.value.value,
      compoundKind:compound.ir.kind,compoundOperator:compound.ir.operator,compoundDependencies:compound.dependencies,
      prefix:[prefix.ir.kind,prefix.ir.operator,prefix.ir.form,prefix.dependencies],
      postfix:[postfix.ir.kind,postfix.ir.operator,postfix.ir.form,postfix.dependencies],
      breakKind:breakStatement.ir.kind,returnKind:returnStatement.ir.kind,returnValue:returnStatement.ir.value,
      inputKind:javaInput.ir.kind,inputReader:javaInput.ir.readerName,inputValue:javaInput.ir.reads[0].expectedValue,
      immutableRejected,uninitializedCompoundRejected,duplicateRejected
    });
  })()`));
  assert.strictEqual(result.cKind,'declaration');
  assert.deepStrictEqual(result.cBinding,{name:'rate',dataType:'float',mutable:false,kind:'constant'});
  assert.strictEqual(result.cValue,1.5);
  assert.strictEqual(result.cLine,4);
  assert.strictEqual(result.javaKind,'declaration');
  assert.deepStrictEqual(result.javaBinding,{name:'grade',dataType:'char',mutable:false,kind:'constant'});
  assert.strictEqual(result.javaValue,'B');
  assert.strictEqual(result.uninitialized,false);
  assert.deepStrictEqual([result.assignKind,result.assignOperator,result.assignValue],['assignment','=',75]);
  assert.deepStrictEqual([result.compoundKind,result.compoundOperator,result.compoundDependencies],['assignment','+=',[]]);
  assert.deepStrictEqual(result.prefix,['unary-update','++','prefix',['score']]);
  assert.deepStrictEqual(result.postfix,['unary-update','--','postfix',['score']]);
  assert.deepStrictEqual([result.breakKind,result.returnKind,result.returnValue],['program-break','program-return',0]);
  assert.deepStrictEqual([result.inputKind,result.inputReader,result.inputValue],['input','scanner',12]);
  assert(result.immutableRejected&&result.uninitializedCompoundRejected&&result.duplicateRejected);
}

function testSharedStatementSemantics(){
  const declarationPlugin=fs.readFileSync(path.join(ROOT,'js','declaration-statement-plugin.js'),'utf8');
  const assignmentPlugin=fs.readFileSync(path.join(ROOT,'js','assignment-statement-plugin.js'),'utf8');
  assert(declarationPlugin.includes('programSemanticsForContext'));
  assert(assignmentPlugin.includes('programSemanticsForContext'));
  assert(!declarationPlugin.includes('coreExecuteStatement'));
  assert(!assignmentPlugin.includes('coreExecuteStatement'));
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js','output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
    'statement-parser.js','statement-semantics.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const binding=(value,options)=>Object.assign({kind:'variable',mutable:true,initialized:true,value,dataType:'int'},options||{});
    const source={p:binding(4),q:binding(4)};
    const parsed=coreParseStatement({language:'c',source:'int sum = ++p + q++;',symbols:source});
    const declaration=coreExecuteStatement({language:'c',statement:parsed.ir,memory:source});
    const sourceUnchanged=source.p.value===4&&source.q.value===4&&!source.sum;
    const applied={p:binding(4),q:binding(4)};
    applyCoreStatementEffects(applied,declaration.effects,'decl-sum','bindings');
    const afterDeclaration={p:applied.p.value,q:applied.q.value,sum:applied.sum.value};

    const assignmentIr=coreParseStatement({language:'c',source:'sum += p;',symbols:applied}).ir;
    const assignment=coreExecuteStatement({language:'c',statement:assignmentIr,memory:applied});
    applyCoreStatementEffects(applied,assignment.effects,'assign-sum','bindings');
    const afterAssignment=applied.sum.value;

    const unaryIr=coreParseStatement({language:'c',source:'p--;',symbols:applied}).ir;
    const unary=coreExecuteStatement({language:'c',statement:unaryIr,memory:applied});
    applyCoreStatementEffects(applied,unary.effects,'unary-p','bindings');

    const raw={x:2};
    const rawAssignment=assignmentStatement({target:'x',operator:'*=',value:literalExpression(3)});
    const rawResult=evaluateAndApplyCoreStatement(rawAssignment,raw,'c','raw-assignment','raw');
    const uninitialized=coreExecuteStatement({language:'c',statement:declarationStatement({name:'empty',dataType:'float',initialized:false}),memory:{}});
    const flowBreak=coreExecuteStatement({language:'c',statement:programBreakStatement({}),memory:{}});
    const flowReturn=coreExecuteStatement({language:'c',statement:programReturnStatement({value:0}),memory:{}});
    let constantRejected=false;
    try{coreExecuteStatement({language:'c',statement:assignmentStatement({target:'LIMIT',operator:'=',value:literalExpression(2)}),
      memory:{LIMIT:binding(1,{kind:'constant',mutable:false})}});}catch(error){constantRejected=/mutable variable/.test(error.message);}
    return JSON.stringify({
      declarationValue:declaration.value,sourceUnchanged,
      declarationEffects:declaration.effects.map(effect=>[effect.kind,effect.scope,effect.target,effect.nextValue]),
      declarationTrace:declaration.trace.map(step=>step.action),afterDeclaration,
      assignmentValue:assignment.value,assignmentEffects:assignment.effects.map(effect=>[effect.kind,effect.scope,effect.target,effect.nextValue]),
      afterAssignment,
      unaryValue:unary.value,unaryEffects:unary.effects.map(effect=>[effect.kind,effect.target,effect.nextValue]),afterUnary:applied.p.value,
      rawValue:rawResult.value,rawMemory:raw.x,
      uninitializedValue:uninitialized.value,uninitializedEffect:uninitialized.effects[0],
      breakEffect:flowBreak.effects[0],returnEffect:flowReturn.effects[0],constantRejected
    });
  })()`));
  assert.strictEqual(result.declarationValue,9);
  assert(result.sourceUnchanged);
  assert.deepStrictEqual(result.declarationEffects,[
    ['read','expression','p',null],['write','expression','p',5],
    ['read','expression','q',null],['write','expression','q',5],
    ['declare','statement','sum',9]
  ]);
  assert.deepStrictEqual(result.declarationTrace,['SUBSTITUTE','UNARY','SUBSTITUTE','UNARY','EVALUATE','DECLARE']);
  assert.deepStrictEqual(result.afterDeclaration,{p:5,q:5,sum:9});
  assert.strictEqual(result.assignmentValue,14);
  assert.deepStrictEqual(result.assignmentEffects,[['read','expression','p',null],['write','statement','sum',14]]);
  assert.strictEqual(result.afterAssignment,14);
  assert.strictEqual(result.unaryValue,4);
  assert.deepStrictEqual(result.unaryEffects,[['read','p',null],['write','p',4]]);
  assert.strictEqual(result.afterUnary,4);
  assert.deepStrictEqual([result.rawValue,result.rawMemory],[6,6]);
  assert.strictEqual(result.uninitializedValue,undefined);
  assert.strictEqual(result.uninitializedEffect.kind,'declare');
  assert.strictEqual(result.uninitializedEffect.initialized,false);
  assert.deepStrictEqual([result.breakEffect.flow,result.breakEffect.nextStatementId],['break','$end']);
  assert.deepStrictEqual([result.returnEffect.flow,result.returnEffect.value],['return',0]);
  assert(result.constantRejected);
}

function testSharedProgramParser(){
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js','output-statement-core.js','input-statement-core.js','selection-statement-core.js',
    'loop-statement-core.js','statement-parser.js','statement-semantics.js','program-parser.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const cSource='#include <stdio.h>\\n\\nint main() {\\n  int p = 4;\\n  int q = 4;\\n  printf("start\\\\n");\\n  if (p <= q) {\\n    p++;\\n  }\\n  int sum = ++p + q++;\\n  return 0;\\n}';
    const javaSource='class Demo {\\n  public static void main(String[] args) {\\n    int x = 1;\\n    x += 2;\\n    System.out.println(x);\\n  }\\n}';
    const c=coreParseProgram({language:'c',source:cSource,filename:'Program.c'});
    const java=coreParseProgram({language:'java',source:javaSource,filename:'Demo.java'});
    return JSON.stringify({
      cLanguage:c.ir.language,cKinds:c.ir.statements.map(statement=>statement.kind),
      cLines:c.ir.statements.map(statement=>statement.sourceSpan.start.line),
      cIds:c.ir.statements.map(statement=>statement.id),
      cMemory:Object.fromEntries(Object.entries(c.ir.metadata.expectedMemory).map(([name,row])=>[name,row.value])),
      cDiagnostics:c.diagnostics.map(diagnostic=>[diagnostic.code,diagnostic.recoverable,diagnostic.location.start.line]),
      cEffects:c.effects.map(effect=>[effect.statementId,effect.kind,effect.target||null,effect.nextValue]),
      cTraceStatements:[...new Set(c.trace.map(step=>step.statementId))],
      javaLanguage:java.ir.language,javaKinds:java.ir.statements.map(statement=>statement.kind),
      javaMemory:Object.fromEntries(Object.entries(java.ir.metadata.expectedMemory).map(([name,row])=>[name,row.value])),
      javaDiagnostics:java.diagnostics.map(diagnostic=>diagnostic.code),
      serializable:!!JSON.parse(JSON.stringify({c,java}))
    });
  })()`));
  assert.strictEqual(result.cLanguage,'c');
  assert.deepStrictEqual(result.cKinds,['declaration','declaration','output','selection','unary-update','declaration','program-return']);
  assert.deepStrictEqual(result.cLines,[4,5,6,7,8,10,11]);
  assert.deepStrictEqual(result.cIds,['declaration-1','declaration-2','output-1','selection-1','unary-update-1','declaration-3','program-return-1']);
  assert.deepStrictEqual(result.cMemory,{p:6,q:5,sum:10});
  assert.deepStrictEqual(result.cDiagnostics,[]);
  assert(result.cEffects.some(row=>row[0]==='declaration-3'&&row[1]==='declare'&&row[2]==='sum'&&row[3]===10));
  assert(result.cTraceStatements.includes('unary-update-1')&&result.cTraceStatements.includes('program-return-1'));
  assert.strictEqual(result.javaLanguage,'java');
  assert.deepStrictEqual(result.javaKinds,['declaration','assignment','output']);
  assert.deepStrictEqual(result.javaMemory,{x:3});
  assert.deepStrictEqual(result.javaDiagnostics,[]);
  assert(result.serializable);
}

function testSharedOutputStatementCore(){
  const contentSource=fs.readFileSync(path.join(ROOT,'plugins','program-output','content.js'),'utf8');
  assert(!contentSource.includes('function poSplitArguments'));
  assert(!contentSource.includes('function poOutputPartsFromFormat'));
  assert(!contentSource.includes('function poSplitJavaConcatenation'));
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js','statement-semantics.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const binding=(value,dataType)=>({kind:'variable',mutable:true,initialized:true,value,dataType});
    const memory={score:binding(75,'int'),price:binding(9.5,'float'),letter:binding('B','char')};
    const c=coreParseStatement({language:'c',source:'printf("Score: %d Price: %.2f Letter: %c %%\\\\n", score, price, letter);',
      symbols:memory,location:{filename:'Output.c',start:{line:7,column:1},end:{line:7,column:80}}});
    const cEvaluation=coreExecuteStatement({language:'c',statement:c.ir,memory});
    const java=coreParseStatement({language:'java',source:'System.out.println("Score: " + score + " Letter: " + letter);',symbols:memory});
    const javaEvaluation=coreExecuteStatement({language:'java',statement:java.ir,memory});
    const terminal=coreTerminalScreen('Loading......\\rLoading Done!\\nNext\\b!');
    let unsupportedFormat=false,uninitializedRejected=false;
    try{coreParseStatement({language:'c',source:'printf("%x", score);',symbols:memory});}catch(error){unsupportedFormat=/unsupported printf format/.test(error.message);}
    try{coreParseStatement({language:'java',source:'System.out.print(missing);',symbols:memory});}catch(error){uninitializedRejected=/used before it is initialized/.test(error.message);}
    return JSON.stringify({
      cKind:c.ir.kind,cLine:c.ir.sourceSpan.start.line,cNewline:c.ir.newline,
      cFormats:c.ir.parts.filter(part=>part.kind==='expression').map(part=>part.format),
      cText:cEvaluation.value,cEffectKinds:cEvaluation.effects.map(effect=>effect.kind),
      cTrace:cEvaluation.trace.map(step=>step.action),cDependencies:c.dependencies,
      javaKind:java.ir.kind,javaNewline:java.ir.newline,javaText:javaEvaluation.value,
      javaParts:java.ir.parts.map(part=>part.kind),javaDependencies:java.dependencies,
      terminalText:terminal.text,terminalLines:terminal.lines,
      unsupportedFormat,uninitializedRejected
    });
  })()`));
  assert.deepStrictEqual([result.cKind,result.cLine,result.cNewline],['output',7,true]);
  assert.deepStrictEqual(result.cFormats,['d','.2f','c']);
  assert.strictEqual(result.cText,'Score: 75 Price: 9.50 Letter: B %\n');
  assert.deepStrictEqual(result.cEffectKinds,['read','read','read','output']);
  assert.deepStrictEqual(result.cTrace,
    ['SUBSTITUTE','FORMAT_OUTPUT_VALUE','SUBSTITUTE','FORMAT_OUTPUT_VALUE','SUBSTITUTE','FORMAT_OUTPUT_VALUE','PRINT']);
  assert.deepStrictEqual(result.cDependencies,['score','price','letter']);
  assert.deepStrictEqual([result.javaKind,result.javaNewline,result.javaText],['output',true,'Score: 75 Letter: B\n']);
  assert.deepStrictEqual(result.javaParts,['text','expression','text','expression']);
  assert.deepStrictEqual(result.javaDependencies,['score','letter']);
  assert.strictEqual(result.terminalText,'Loading Done!\nNex!');
  assert.deepStrictEqual(result.terminalLines,['Loading Done!','Nex!']);
  assert(result.unsupportedFormat&&result.uninitializedRejected);
}

function testSharedInputStatementCore(){
  const parserSource=fs.readFileSync(path.join(ROOT,'plugins','program-input','parser.js'),'utf8');
  assert(!parserSource.includes('function programInputParseC'));
  assert(!parserSource.includes('function programInputParseJava'));
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js','statement-semantics.js','program-parser.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const variable=(dataType='int')=>({kind:'variable',mutable:true,initialized:false,value:undefined,dataType});
    const cMemory={x:variable(),y:variable(),z:variable()};
    const c=coreParseStatement({language:'c',source:'scanf("%d %d %d", &x, &y, &z);',symbols:cMemory,
      inputValues:{x:4,y:7,z:2},location:{filename:'Input.c',start:{line:8,column:1},end:{line:8,column:40}}});
    const cEvaluation=coreExecuteStatement({language:'c',statement:c.ir,memory:cMemory});
    applyCoreStatementEffects(cMemory,cEvaluation.effects,'input-1','bindings');
    const javaMemory={score:variable()};
    const java=coreParseStatement({language:'java',source:'score = scanner.nextInt();',symbols:javaMemory,inputValues:{score:91}});
    const javaEvaluation=coreExecuteStatement({language:'java',statement:java.ir,memory:javaMemory});
    applyCoreStatementEffects(javaMemory,javaEvaluation.effects,'input-2','bindings');
    const program=coreParseProgram({language:'c',filename:'InputProgram.c',inputValues:{value:13},source:
      '#include <stdio.h>\\nint main() {\\n  int value;\\n  scanf("%d", &value);\\n  printf("Value: %d\\\\n", value);\\n  return 0;\\n}'});
    let addressRejected=false,typeRejected=false;
    try{coreParseStatement({language:'c',source:'scanf("%d", x);',symbols:{x:variable()},inputValues:{x:1}});}catch(error){addressRejected=/&identifier/.test(error.message);}
    try{coreParseStatement({language:'c',source:'scanf("%d", &price);',symbols:{price:variable('float')},inputValues:{price:1}});}catch(error){typeRejected=/mutable int target/.test(error.message);}
    return JSON.stringify({
      cKind:c.ir.kind,cLine:c.ir.sourceSpan.start.line,cSyntax:c.ir.inputSyntax,cReader:c.ir.readerName,
      cTargets:c.ir.reads.map(read=>read.target),cRaw:c.ir.rawInput,cDependencies:c.dependencies,
      cEffectKinds:cEvaluation.effects.map(effect=>effect.kind),cTrace:cEvaluation.trace.map(step=>step.action),
      cMemory:Object.fromEntries(Object.entries(cMemory).map(([name,row])=>[name,row.value])),
      javaKind:java.ir.kind,javaReader:java.ir.readerName,javaRaw:java.ir.rawInput,javaValue:javaMemory.score.value,
      programKinds:program.ir.statements.map(statement=>statement.kind),
      programOutput:program.effects.find(effect=>effect.kind==='output').text,
      programMemory:program.ir.metadata.expectedMemory.value.value,
      addressRejected,typeRejected
    });
  })()`));
  assert.deepStrictEqual([result.cKind,result.cLine,result.cSyntax,result.cReader],['input',8,'c','scanf']);
  assert.deepStrictEqual(result.cTargets,['x','y','z']);
  assert.strictEqual(result.cRaw,'4 7 2');
  assert.deepStrictEqual(result.cDependencies,['x','y','z']);
  assert.deepStrictEqual(result.cEffectKinds,['input','write','write','write']);
  assert.deepStrictEqual(result.cTrace,['CALL_INPUT','INPUT_SUBMIT','CONVERT_INPUT_BATCH','WRITE_INPUT','WRITE_INPUT','WRITE_INPUT']);
  assert.deepStrictEqual(result.cMemory,{x:4,y:7,z:2});
  assert.deepStrictEqual([result.javaKind,result.javaReader,result.javaRaw,result.javaValue],['input','scanner','91',91]);
  assert.deepStrictEqual(result.programKinds,['declaration','input','output','program-return']);
  assert.strictEqual(result.programOutput,'Value: 13\n');
  assert.strictEqual(result.programMemory,13);
  assert(result.addressRejected&&result.typeRejected);
}

function testSharedSelectionStatementCore(){
  const contentSource=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','content.js'),'utf8');
  const statementSource=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','statement.js'),'utf8');
  assert(!contentSource.includes("const match=/^\\s*(?:}\\s*)?(if|else\\s+if)"));
  assert(!contentSource.includes('const caseMatch='));
  assert(contentSource.includes('coreSwitchLabel'));
  assert(statementSource.includes('programSemanticsForContext'));
  assert(!statementSource.includes('coreSelectBranch'));
  assert(!statementSource.includes('coreExecuteStatement'));
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js','statement-semantics.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const variable=value=>({kind:'variable',mutable:true,initialized:true,value,dataType:'int'});
    const memory={score:variable(82),absences:variable(2),day:variable(2),x:variable(1)};
    const branches=[
      {when:true,label:'TRUE',targetLine:8,nextStatementId:'output-pass'},
      {when:false,label:'FALSE',targetLine:10,nextStatementId:'output-fail'}
    ];
    const conditional=coreParseStatement({language:'c',source:'if (score >= 75 && absences < 5) {',symbols:memory,branches,
      location:{filename:'Selection.c',start:{line:7,column:1},end:{line:7,column:42}}});
    const conditionResult=coreExecuteStatement({language:'c',statement:conditional.ir,memory});
    const elseIf=coreParseStatement({language:'java',source:'} else if (score == 75) {',symbols:memory,branches});
    const switchBranches=[
      {value:1,label:'case 1',nextStatementId:'one'},
      {value:2,label:'case 2',nextStatementId:'two'},
      {default:true,label:'default',nextStatementId:'other'}
    ];
    const switched=coreParseStatement({language:'c',source:'switch (day) {',symbols:memory,branches:switchBranches});
    const switchResult=coreExecuteStatement({language:'c',statement:switched.ir,memory});
    const numericLabel=coreSwitchLabel('case -1:',{language:'c'},memory,
      languageCoreSourceLocation({start:{line:12,column:1},end:{line:12,column:9}}));
    const characterLabel=coreSwitchLabel("case 'B':",{language:'java'},memory,
      languageCoreSourceLocation({start:{line:13,column:1},end:{line:13,column:10}}));
    const defaultLabel=coreSwitchLabel('default:',{language:'c'},memory,
      languageCoreSourceLocation({start:{line:14,column:1},end:{line:14,column:9}}));
    const mutating=coreParseStatement({language:'c',source:'if (++x > 1) {',symbols:memory,branches});
    const mutationResult=coreExecuteStatement({language:'c',statement:mutating.ir,memory});
    const unchanged=memory.x.value===1;
    applyCoreStatementEffects(memory,mutationResult.effects,'selection-mutation','bindings');
    return JSON.stringify({
      kind:conditional.ir.kind,selectionKind:conditional.ir.selectionKind,line:conditional.ir.sourceSpan.start.line,
      dependencies:conditional.dependencies,value:conditionResult.value,
      flow:conditionResult.effects.find(effect=>effect.kind==='flow'),trace:conditionResult.trace.map(step=>step.action),
      elseIfKind:elseIf.ir.selectionKind,
      switchKind:switched.ir.selectionKind,switchValue:switchResult.value,
      switchFlow:switchResult.effects.find(effect=>effect.kind==='flow'),
      switchLabels:[numericLabel.value,characterLabel.value,defaultLabel.default],
      mutationValue:mutationResult.value,mutationWrites:mutationResult.effects.filter(effect=>effect.kind==='write')
        .map(effect=>[effect.target,effect.previousValue,effect.nextValue]),unchanged,appliedX:memory.x.value
    });
  })()`));
  assert.deepStrictEqual([result.kind,result.selectionKind,result.line],['selection','if',7]);
  assert.deepStrictEqual(result.dependencies,['score','absences']);
  assert.strictEqual(result.value,true);
  assert.deepStrictEqual([result.flow.flow,result.flow.label,result.flow.targetLine,result.flow.nextStatementId],
    ['branch','TRUE',8,'output-pass']);
  assert.deepStrictEqual(result.trace,['SUBSTITUTE','EVALUATE','SUBSTITUTE','EVALUATE','EVALUATE','BRANCH']);
  assert.strictEqual(result.elseIfKind,'else-if');
  assert.deepStrictEqual([result.switchKind,result.switchValue,result.switchFlow.label,result.switchFlow.nextStatementId],
    ['switch',2,'case 2','two']);
  assert.deepStrictEqual(result.switchLabels,[-1,'B',true]);
  assert.strictEqual(result.mutationValue,true);
  assert.deepStrictEqual(result.mutationWrites,[['x',1,2]]);
  assert(result.unchanged&&result.appliedX===2);
}

function testSharedLoopStatementCore(){
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
    'statement-parser.js','statement-semantics.js','program-parser.js','program-item-builder.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const variable=value=>({kind:'variable',mutable:true,initialized:true,value,dataType:'int'});
    const branches=[
      {when:true,label:'CONTINUE',targetLine:5,nextStatementId:'loop-body'},
      {when:false,label:'EXIT',targetLine:8,nextStatementId:'after-loop'}
    ];
    const memory={i:variable(0),limit:variable(3)};
    const whileLoop=coreParseStatement({language:'c',source:'while (i < limit) {',symbols:memory,branches,
      location:{filename:'Loops.c',start:{line:4,column:1},end:{line:4,column:22}}});
    const whileResult=coreExecuteStatement({language:'c',statement:whileLoop.ir,memory});
    const forLoop=coreParseStatement({language:'java',source:'for (i = 0; i < limit; i++) {',symbols:memory,branches});
    const initResult=coreExecuteStatement({language:'java',statement:forLoop.ir,memory,phase:'initialize'});
    applyCoreStatementEffects(memory,initResult.effects,'for-init','bindings');
    const conditionResult=coreExecuteStatement({language:'java',statement:forLoop.ir,memory});
    const updateResult=coreExecuteStatement({language:'java',statement:forLoop.ir,memory,phase:'update'});
    const unchangedBeforeUpdate=memory.i.value===0;
    applyCoreStatementEffects(memory,updateResult.effects,'for-update','bindings');
    const declarationFor=coreParseStatement({language:'c',source:'for (int j = 0; j < 2; j++) {',symbols:memory,branches});
    const doEntry=coreParseStatement({language:'c',source:'do {',symbols:memory,branches});
    const doEntryResult=coreExecuteStatement({language:'c',statement:doEntry.ir,memory});
    const doTail=parseCoreLoopStatement({language:'c',source:'while (i < limit);',doWhile:true},
      coreExpressionSymbolTable(memory),languageCoreSourceLocation({start:{line:9,column:1},end:{line:9,column:19}}));
    const program=coreParseProgram({language:'c',filename:'LoopProgram.c',source:
      'int main() {\\n  int i = 0;\\n  while (i < 3) {\\n    i++;\\n  }\\n  for (i = 0; i < 2; i++) {\\n    i += 1;\\n  }\\n  do {\\n    i--;\\n  } while (i > 0);\\n  return 0;\\n}'});
    return JSON.stringify({
      whileKind:whileLoop.ir.loopKind,whileDependencies:whileLoop.dependencies,whileValue:whileResult.value,
      whileFlow:whileResult.effects.find(effect=>effect.kind==='flow'),whileTrace:whileResult.trace.map(step=>step.action),
      forKind:forLoop.ir.loopKind,initializerKind:forLoop.ir.initializer.kind,updateKind:forLoop.ir.update.kind,
      initScope:initResult.effects.map(effect=>effect.scope),conditionValue:conditionResult.value,
      updateScope:updateResult.effects.map(effect=>effect.scope),unchangedBeforeUpdate,updatedI:memory.i.value,
      declarationInitializer:declarationFor.ir.initializer.kind,declarationTarget:declarationFor.ir.initializer.binding.name,
      doKind:doEntry.ir.loopKind,doValue:doEntryResult.value,doFlow:doEntryResult.effects.find(effect=>effect.kind==='flow').flow,
      doTailKind:doTail.loopKind,
      programKinds:program.ir.statements.map(statement=>statement.kind),
      programLoopKinds:program.ir.statements.filter(statement=>statement.kind==='loop').map(statement=>statement.loopKind),
      programDiagnostics:program.diagnostics.map(diagnostic=>diagnostic.code),
      serializable:!!JSON.parse(JSON.stringify({whileLoop,forLoop,program}))
    });
  })()`));
  assert.deepStrictEqual([result.whileKind,result.whileValue],['while',true]);
  assert.deepStrictEqual(result.whileDependencies,['i','limit']);
  assert.deepStrictEqual([result.whileFlow.flow,result.whileFlow.label,result.whileFlow.nextStatementId],
    ['loop-branch','CONTINUE','loop-body']);
  assert.deepStrictEqual(result.whileTrace,['SUBSTITUTE','SUBSTITUTE','EVALUATE','LOOP_CONDITION']);
  assert.deepStrictEqual([result.forKind,result.initializerKind,result.updateKind],['for','assignment','unary-update']);
  assert(result.initScope.every(scope=>scope==='loop-initializer'));
  assert(result.conditionValue&&result.unchangedBeforeUpdate&&result.updatedI===1);
  assert(result.updateScope.every(scope=>scope==='loop-update'));
  assert.deepStrictEqual([result.declarationInitializer,result.declarationTarget],['declaration','j']);
  assert.deepStrictEqual([result.doKind,result.doValue,result.doFlow,result.doTailKind],['do',true,'loop-branch','do-while']);
  assert.deepStrictEqual(result.programKinds,['declaration','loop','unary-update','loop','assignment','loop','unary-update','loop','program-return']);
  assert.deepStrictEqual(result.programLoopKinds,['while','for','do','do-while']);
  assert.deepStrictEqual(result.programDiagnostics,[]);
  assert(result.serializable);
}

function testPhase4BUnsupportedConstructs(){
  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
    'statement-parser.js','statement-semantics.js','program-parser.js','program-item-builder.js']);
  const fixture=(set,name)=>fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','c',set,name),'utf8');
  ctx.phase4bJuliet=fixture('simulate-output-variables','TaskJuliet.c');
  ctx.phase4bOscar=fixture('simulate-basic-output','TaskOscar.c');
  ctx.phase4bSierra=fixture('simulate-output-variables','TaskSierra.c');
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const summarize=(filename,source)=>{
      const parsed=coreParseProgram({language:'c',filename,source});
      const memory=parsed.ir.metadata.expectedMemory;
      return {kinds:parsed.ir.statements.map(statement=>statement.kind),
        declarations:parsed.ir.statements.filter(statement=>statement.kind==='declaration').map(statement=>({
          name:statement.binding.name,dataType:statement.binding.dataType,mutable:statement.binding.mutable,
          syntax:statement.declarationSyntax||null,value:memory[statement.binding.name]&&memory[statement.binding.name].value})),
        formats:parsed.ir.statements.filter(statement=>statement.kind==='output').flatMap(statement=>
          statement.parts.filter(part=>part.kind==='expression').map(part=>part.format)),
        output:parsed.effects.filter(effect=>effect.kind==='output').map(effect=>effect.text).join(''),
        diagnostics:parsed.diagnostics.map(diagnostic=>[diagnostic.code,diagnostic.location.start.line]),
        dependencies:parsed.dependencies};
    };
    const literal=coreParseExpression({language:'c',source:'"hello"',symbols:{}}).ir;
    const expressionOutput=coreParseStatement({language:'c',source:'printf("Total: %d\\n", 2 + 3 * 4);',symbols:{}});
    const expressionResult=coreExecuteStatement({language:'c',statement:expressionOutput.ir,memory:{}});
    const expressionRuntime=buildOutputStatementRuntime(expressionOutput.ir,0,{});
    const dynamicIndex=expressionRuntime.parts.findIndex(part=>part.kind==='expression');
    return JSON.stringify({literal,
      expressionFormat:expressionOutput.ir.parts.find(part=>part.kind==='expression').format,
      expressionKind:expressionOutput.ir.parts.find(part=>part.kind==='expression').expression.kind,
      expressionSource:expressionOutput.ir.parts.find(part=>part.kind==='expression').source,
      expressionResult:expressionResult.value,expressionExpected:expressionRuntime.runtime.parts[dynamicIndex].expectedValue,
      expressionStaged:expressionRuntime.runtime.parts[dynamicIndex].stagedValue,
      stringDisplay:formatValue('Maria','string'),
      juliet:summarize('TaskJuliet.c',phase4bJuliet),
      sierra:summarize('TaskSierra.c',phase4bSierra)});
  })()`));
  assert.deepStrictEqual(result.literal,{kind:'literal',value:'hello',dataType:'string'});
  assert.deepStrictEqual([result.expressionFormat,result.expressionKind,result.expressionSource,result.expressionResult,
    result.expressionExpected,result.expressionStaged],['d','binary','2 + 3 * 4','Total: 14\n',14,14]);
  assert.strictEqual(result.stringDisplay,'"Maria"');
  assert.deepStrictEqual(result.juliet.diagnostics,[]);
  assert(result.juliet.declarations.some(row=>row.name==='name'&&row.dataType==='string'&&row.value==='Maria'
    &&row.syntax==='char-array'));
  assert.deepStrictEqual(result.juliet.formats,['s','d','.1f','c','.2f','0.4f']);
  assert.strictEqual(result.juliet.output,
    'Name: Maria\nAge: 20\nHeight: 165.5 cm\nGrade: A\nPi (2 decimals): 3.14\nPi (4 decimals): 3.1416\n');
  assert.deepStrictEqual(result.sierra.diagnostics,[]);
  assert(result.sierra.declarations.some(row=>row.name==='TAX_RATE'&&row.syntax==='define'&&!row.mutable&&row.value===0.08));
  assert(result.sierra.declarations.some(row=>row.name==='SHOP_NAME'&&row.dataType==='string'&&row.value==='Tech Haven'));
  assert(result.sierra.formats.includes('s')&&result.sierra.formats.includes('0.4f'));
  assert.strictEqual(result.sierra.output,
    'Welcome to Tech Haven!\nCustomer: "Diego"\nQuantity: 2\nSubtotal: 2400.00\nIs loyal member: 1\nDiscount: 240.00\nTax: 172.8000\nFinal Total: 2332.80\nHave a great day, Diego!\n');
}

function testSharedSourceProgramPipeline(){
  const programOutputSource=fs.readFileSync(path.join(ROOT,'plugins','program-output','content.js'),'utf8');
  const codeSimulatorSource=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','content.js'),'utf8');
  const simulateOutputSource=fs.readFileSync(path.join(ROOT,'plugins','simulate-output','generator.js'),'utf8');
  assert(programOutputSource.includes('sourceProgramValidateManifest'));
  assert(programOutputSource.includes('sourceProgramParseExercise'));
  assert(!programOutputSource.includes('function poMetadataAndSource'));
  assert(!programOutputSource.includes('coreParseProgram('));
  assert(codeSimulatorSource.includes('sourceProgramMetadataAndSource'));
  assert(codeSimulatorSource.includes('sourceProgramParseExercise'));
  assert(!codeSimulatorSource.includes('function csSeedDirectives'));
  assert(!codeSimulatorSource.includes('function csMaterializeSource'));
  assert(!codeSimulatorSource.includes('coreParseProgram('));
  assert(simulateOutputSource.includes('sourceProgramValidateManifest'));
  assert(simulateOutputSource.includes('sourceProgramParseExercise'));

  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
    'statement-parser.js','statement-semantics.js','program-parser.js','source-program-pipeline.js']);
  ctx.pipelineFixture=`/* @codescope
 * @title Seeded source
 * @result x
 * @seed x min=2 max=4
 */
#include <stdio.h>
int main() {
  int x = 1;
  printf("%d\\n", x);
  return 0;
}`;
  ctx.steppedSeedFixture=`/* @codescope
 * @title Stepped seed
 * @seed balance min=1000 max=1400 step=100
 * @seed price min=9.50 max=10.50 step=0.25 decimals=2
 */
#include <stdio.h>
int main() {
  int balance = 1200;
  float price = 10.00;
  printf("%d\\n", balance);
  return 0;
}`;
  ctx.multiSeedFixture=`/* @codescope
 * @title Store Transaction
 * @seed itemCost min=430 max=470
 * @seed quantity min=2 max=4
 */
#include <stdio.h>
int main(void) {
  int itemCost = 450, quantity = 3, discount = 50;
  printf("%d %d %d\\n", itemCost, quantity, discount);
  return 0;
}`;
  ctx.booleanSeedFixture=`/* @codescope
 * @title Boolean seed
 * @seed member values=true|false
 */
public class BooleanSeed {
  public static void main(String[] args) {
    boolean member = true;
    System.out.println(member);
  }
}`;
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const authored=sourceProgramParseExercise({raw:pipelineFixture,filename:'Seed.c',language:'c',
      sourceValueMode:'authored',randomInteger:()=>4});
    const seeded=sourceProgramParseExercise({raw:pipelineFixture,filename:'Seed.c',language:'c',
      sourceValueMode:'seeded',randomInteger:()=>4});
    const stepped=Array.from({length:5},(_,slot)=>sourceProgramParseExercise({raw:steppedSeedFixture,
      filename:'Stepped.c',language:'c',sourceValueMode:'seeded',randomInteger:()=>slot}));
    const multi=sourceProgramParseExercise({raw:multiSeedFixture,filename:'Store.c',language:'c',
      sourceValueMode:'seeded',randomInteger:min=>min});
    const booleanAuthored=sourceProgramParseExercise({raw:booleanSeedFixture,filename:'BooleanSeed.java',
      language:'java',sourceValueMode:'authored'});
    const booleanSeeded=sourceProgramParseExercise({raw:booleanSeedFixture,filename:'BooleanSeed.java',
      language:'java',sourceValueMode:'seeded',randomInteger:(min,max)=>max});
    const invalidSteps=[];
    for(const metadata of ['@seed x min=1 max=5 step=0','@seed x min=1 max=5 step=-1']){
      try{sourceProgramSeedDirectives(metadata,'Invalid.c');}catch(error){invalidSteps.push(error.message);}
    }
    const manifest=sourceProgramValidateManifest({title:'  Demo  ',exercises:['One.c','Two.c']},'manifest.json');
    const errors=[];
    for(const candidate of [
      {exercises:['../One.c']},{exercises:['One.c','One.c']},{exercises:[]}
    ]){try{sourceProgramValidateManifest(candidate,'bad.json');}catch(error){errors.push(error.message);}}
    return JSON.stringify({manifest,errors,authored:{title:authored.title,resultName:authored.resultName,
      source:authored.source,templateSource:authored.templateSource,seedValues:authored.seedValues,
      kinds:authored.coreProgramResult.ir.statements.map(statement=>statement.kind),
      diagnostics:authored.coreProgramResult.diagnostics.map(diagnostic=>diagnostic.code),
      lineKeys:[...authored.statementsByLine.keys()]},seeded:{source:seeded.source,
      templateSource:seeded.templateSource,seedValues:seeded.seedValues,
      kinds:seeded.coreProgramResult.ir.statements.map(statement=>statement.kind)},
      steppedValues:stepped.map(entry=>entry.seedValues.balance),
      steppedFloatValues:stepped.map(entry=>entry.seedValues.price),
      steppedSources:stepped.map(entry=>entry.source),invalidSteps,
      multi:{source:multi.source,seedValues:multi.seedValues,
        declarations:multi.coreProgramResult.ir.statements.filter(statement=>statement.kind==='declaration')
          .map(statement=>statement.binding.name),memory:multi.coreProgramResult.ir.metadata.expectedMemory},
      booleanAuthored:{source:booleanAuthored.source,seedValues:booleanAuthored.seedValues,
        diagnostics:booleanAuthored.coreProgramResult.diagnostics.map(diagnostic=>diagnostic.code)},
      booleanSeeded:{source:booleanSeeded.source,seedValues:booleanSeeded.seedValues,
        diagnostics:booleanSeeded.coreProgramResult.diagnostics.map(diagnostic=>diagnostic.code)}});
  })()`));
  assert.deepStrictEqual(result.manifest,{title:'Demo',exercises:['One.c','Two.c']});
  assert.strictEqual(result.errors.length,3);
  assert.strictEqual(result.authored.title,'Seeded source');
  assert.strictEqual(result.authored.resultName,'x');
  assert(!result.authored.source.includes('@codescope'));
  assert(result.authored.source.includes('int x = 1;'));
  assert.deepStrictEqual(result.authored.seedValues,{x:1});
  assert.deepStrictEqual(result.authored.diagnostics,[]);
  assert.deepStrictEqual(result.authored.kinds,['declaration','output','program-return']);
  assert(result.authored.lineKeys.length===3);
  assert(result.seeded.source.includes('int x = 4;'));
  assert(result.seeded.templateSource.includes('int x = 1;'));
  assert.deepStrictEqual(result.seeded.seedValues,{x:4});
  assert.deepStrictEqual(result.seeded.kinds,result.authored.kinds);
  assert.deepStrictEqual(result.steppedValues,[1000,1100,1200,1300,1400]);
  assert.deepStrictEqual(result.steppedFloatValues,[9.5,9.75,10,10.25,10.5]);
  result.steppedSources.forEach((source,index)=>assert(source.includes(`int balance = ${1000+index*100};`)));
  assert.strictEqual(result.invalidSteps.length,2);
  assert(result.multi.source.includes('int itemCost = 430, quantity = 2, discount = 50;'));
  assert.deepStrictEqual(result.multi.seedValues,{itemCost:430,quantity:2});
  assert.deepStrictEqual(result.multi.declarations,['itemCost','quantity','discount']);
  assert.strictEqual(result.multi.memory.itemCost.value,430);
  assert.strictEqual(result.multi.memory.quantity.value,2);
  assert.strictEqual(result.multi.memory.discount.value,50);
  assert(result.booleanAuthored.source.includes('boolean member = true;'));
  assert.deepStrictEqual(result.booleanAuthored.seedValues,{member:true});
  assert.deepStrictEqual(result.booleanAuthored.diagnostics,[]);
  assert(result.booleanSeeded.source.includes('boolean member = false;'));
  assert.deepStrictEqual(result.booleanSeeded.seedValues,{member:false});
  assert.deepStrictEqual(result.booleanSeeded.diagnostics,[]);

  const compoundDirectory=path.join(ROOT,'exercise-libraries','source-programs','java','simulate-compound-selection');
  const compoundManifest=JSON.parse(fs.readFileSync(path.join(compoundDirectory,'manifest.json'),'utf8'));
  for(const filename of compoundManifest.exercises){
    ctx.compoundRaw=fs.readFileSync(path.join(compoundDirectory,filename),'utf8');
    ctx.compoundFilename=filename;
    const compound=JSON.parse(evaluate(ctx,`(()=>{
      const parsed=sourceProgramParseExercise({raw:compoundRaw,filename:compoundFilename,language:'java',
        sourceValueMode:'seeded',randomInteger:min=>min});
      return JSON.stringify({title:parsed.title,seedNames:Object.keys(parsed.seedValues),
        diagnostics:parsed.coreProgramResult.diagnostics.map(diagnostic=>diagnostic.code),
        answer:sourceProgramGenerateAnswer(parsed,compoundFilename)});
    })()`));
    assert(compound.title!==filename.replace(/\.java$/,''),`${filename} must provide @title metadata`);
    assert(compound.seedNames.length>0,`${filename} must provide @seed metadata`);
    assert.deepStrictEqual(compound.diagnostics,[],`${filename} must parse without core diagnostics`);
    assert(compound.answer.screenLines.length>0,`${filename} must generate an output answer key`);
  }

  const advancedInputDirectory=path.join(ROOT,'exercise-libraries','source-programs','java','input-advance');
  const advancedInputManifest=JSON.parse(fs.readFileSync(path.join(advancedInputDirectory,'manifest.json'),'utf8'));
  assert.strictEqual(advancedInputManifest.exercises.length,10);
  for(const filename of advancedInputManifest.exercises){
    ctx.advancedInputRaw=fs.readFileSync(path.join(advancedInputDirectory,filename),'utf8');
    ctx.advancedInputFilename=filename;
    const advancedInput=JSON.parse(evaluate(ctx,`(()=>{
      const details=sourceProgramMetadataAndSource(advancedInputRaw,advancedInputFilename);
      const inputs=sourceProgramInputDirectives(details.metadata,advancedInputFilename,'seeded',min=>min);
      const parsed=sourceProgramParseExercise({details,filename:advancedInputFilename,language:'java',
        sourceValueMode:'authored',inputValues:Object.fromEntries(inputs.map(input=>[input.target,input]))});
      return JSON.stringify({diagnostics:parsed.coreProgramResult.diagnostics.map(diagnostic=>diagnostic.code),
        inputCount:parsed.coreProgramResult.ir.statements.filter(statement=>statement.kind==='input').length,
        answer:sourceProgramGenerateAnswer(parsed,advancedInputFilename)});
    })()`));
    assert.deepStrictEqual(advancedInput.diagnostics,[],`${filename} must parse without core diagnostics`);
    assert(advancedInput.inputCount>0,`${filename} must expose Scanner input statements`);
    assert(advancedInput.answer.screenLines.length>0,`${filename} must generate an output answer key`);
  }

  for(const language of ['c','java']){
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,'output-basics');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    for(const filename of manifest.exercises){
      const raw=fs.readFileSync(path.join(directory,filename),'utf8');
      ctx.releaseExerciseRaw=raw;ctx.releaseExerciseFilename=filename;ctx.releaseExerciseLanguage=language;
      const parsed=JSON.parse(evaluate(ctx,`(()=>{const result=sourceProgramParseExercise({
        raw:releaseExerciseRaw,filename:releaseExerciseFilename,language:releaseExerciseLanguage,
        sourceValueMode:'authored'});return JSON.stringify({
          diagnostics:result.coreProgramResult.diagnostics.map(diagnostic=>diagnostic.code),
          kinds:result.coreProgramResult.ir.statements.map(statement=>statement.kind)
        });})()`));
      const authoredOutputCount=(raw.match(language==='c'?/\bprintf\s*\(/g:/\bSystem\.out\.print(?:ln)?\s*\(/g)||[]).length;
      assert.deepStrictEqual(parsed.diagnostics,[],`${language}/${filename} must parse without core diagnostics`);
      assert.strictEqual(parsed.kinds.filter(kind=>kind==='output').length,authoredOutputCount,
        `${language}/${filename} must expose every authored output statement`);
      assert(parsed.kinds.includes('output'),`${language}/${filename} must contain an output statement`);
    }
  }
}

function testPluginResponsibilityMigration(){
  const interactionFiles=[
    'js/declaration-statement-plugin.js','js/assignment-statement-plugin.js',
    'js/unary-update-statement-plugin.js','js/program-break.js','js/program-return.js',
    'plugins/program-output/statement.js','plugins/program-input/statement.js',
    'plugins/code-simulator/statement.js'
  ];
  interactionFiles.forEach(filename=>{
    const source=fs.readFileSync(path.join(ROOT,filename),'utf8');
    assert(!source.includes('coreExecuteStatement('),`${filename} must consume Program Core semantics`);
    assert(!source.includes('coreSelectBranch('),`${filename} must not select control flow`);
    assert(!source.includes('evaluateUnaryOperation('),`${filename} must not implement unary semantics`);
  });
  ['plugins/program-output/statement.js','plugins/program-input/statement.js',
    'plugins/code-simulator/statement.js'].forEach(filename=>{
    const source=fs.readFileSync(path.join(ROOT,filename),'utf8');
    assert(source.includes('programSemanticsForContext'));
  });
  ['plugins/program-output/content.js','plugins/code-simulator/content.js'].forEach(filename=>{
    const source=fs.readFileSync(path.join(ROOT,filename),'utf8');
    assert(!source.includes("typeof evaluateAndApplyCoreStatement==='function'"));
    assert(!source.includes('if(!semantic)'));
  });

  const ctx=context();
  load(ctx,['engine.js','program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
    'statement-parser.js','statement-semantics.js','program-core.js']);
  loadRelative(ctx,['plugins/program-output/manifest.js','plugins/program-input/manifest.js',
    'plugins/code-simulator/manifest.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const binding=value=>({name:'x',kind:'variable',dataType:'int',mutable:true,initialized:true,value});
    const statement=assignmentStatement({id:'core-owned-assignment',target:'x',operator:'+=',value:literalExpression(3)});
    const program=createProgram([statement],{language:'c',memory:{x:binding(4)}});
    const semantics=programSemanticServices(program);
    const executed=semantics.execute(statement,program.memory);
    semantics.applyEffects(program.memory,executed.effects,statement.id,'bindings');
    return JSON.stringify({value:executed.value,memory:program.memory.x.value,
      trace:executed.trace.map(step=>step.action),manifests:[
        {owner:PROGRAM_OUTPUT_PLUGIN_MANIFEST.semanticOwner,responsibilities:PROGRAM_OUTPUT_PLUGIN_MANIFEST.responsibilities,
          capabilities:PROGRAM_OUTPUT_PLUGIN_MANIFEST.capabilities},
        {owner:PROGRAM_INPUT_PLUGIN_MANIFEST.semanticOwner,responsibilities:PROGRAM_INPUT_PLUGIN_MANIFEST.responsibilities,
          capabilities:PROGRAM_INPUT_PLUGIN_MANIFEST.capabilities},
        {owner:CODE_SIMULATOR_PLUGIN_MANIFEST.semanticOwner,responsibilities:CODE_SIMULATOR_PLUGIN_MANIFEST.responsibilities,
          capabilities:CODE_SIMULATOR_PLUGIN_MANIFEST.capabilities}
      ]});
  })()`));
  assert.deepStrictEqual([result.value,result.memory,result.trace],[7,7,['ASSIGN']]);
  result.manifests.forEach(manifest=>{
    assert.strictEqual(manifest.owner,'language-core');
    assert(manifest.responsibilities.includes('interaction')&&manifest.responsibilities.includes('presentation'));
    assert(!manifest.capabilities.some(capability=>['declaration','assignment','unary-update','input','output',
      'if','if-else','if-else-if','switch-case','break','switch-fall-through','return'].includes(capability)));
  });
}

function testProfileSchemaSimplification(){
  const catalogSource=fs.readFileSync(path.join(ROOT,'js','profiles.js'),'utf8');
  assert(!/\bprovider\s*:/.test(catalogSource),'Current profiles must not select content providers');
  assert(!/\bprogram\s*:/.test(catalogSource),'Current profiles must not carry legacy program configuration');

  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const select=id=>PROFILES.find(profile=>profile.id===id);
    const output=select('program-output-basics');
    const sourcedOutput=select('program-output-source-flow');
    const input=select('program-input-source-flow');
    const simulator=select('selection-statements-source');
    const assignment=select('assignment-basic');
    return JSON.stringify({
      currentProfilesHaveNoProvider:PROFILES.every(profile=>!profile.content||!Object.prototype.hasOwnProperty.call(profile.content,'provider')),
      currentProfilesHaveNoProgram:PROFILES.every(profile=>!Object.prototype.hasOwnProperty.call(profile,'program')),
      output:{lesson:output.lesson,source:profileContentSource(output),workspace:profileWorkspacePresentation(output),
        timeline:profileTimelineMode(output),commits:profileScoresStatementCommits(output)},
      sourcedOutput:{lesson:sourcedOutput.lesson,source:profileContentSource(sourcedOutput),
        variables:profileVariableValueMode(sourcedOutput),workspace:profileWorkspacePresentation(sourcedOutput)},
      input:{lesson:input.lesson,inputValues:profileInputValueMode(input),source:profileContentSource(input)},
      simulator:{lesson:simulator.lesson,source:profileContentSource(simulator),workspace:profileWorkspacePresentation(simulator)},
      assignment:{lesson:assignment.lesson,interaction:assignment.interaction}
    });
  })()`));
  assert(result.currentProfilesHaveNoProvider&&result.currentProfilesHaveNoProgram);
  assert.deepStrictEqual(result.output.lesson,{focus:'output',variant:'formatted-values'});
  assert.strictEqual(result.output.workspace,'statement-flow');
  assert.strictEqual(result.output.timeline,'inline');
  assert.strictEqual(result.output.commits,true);
  assert.deepStrictEqual(result.sourcedOutput.source,{library:'source-programs',exerciseSet:'formatted-output'});
  assert.strictEqual(result.sourcedOutput.variables,'authored');
  assert.strictEqual(result.sourcedOutput.workspace,'source-program');
  assert.strictEqual(result.input.inputValues,'seeded');
  assert.strictEqual(result.input.lesson.focus,'input');
  assert.strictEqual(result.simulator.lesson.focus,'program-flow');
  assert.strictEqual(result.simulator.workspace,'source-program');
  assert.deepStrictEqual(result.assignment.lesson,{focus:'assignment',variant:'basic-set'});
  assert.strictEqual(result.assignment.interaction.declarations,'interactive');
}

function testDuplicateCodeRemoval(){
  assert(!fs.existsSync(path.join(ROOT,'js','profiles_.js')),'Obsolete duplicate profile catalog must stay removed');
  const profiles=fs.readFileSync(path.join(ROOT,'js','profiles.js'),'utf8');
  const generator=fs.readFileSync(path.join(ROOT,'js','generator.js'),'utf8');
  const activityCore=fs.readFileSync(path.join(ROOT,'js','activity-core.js'),'utf8');
  const outputContent=fs.readFileSync(path.join(ROOT,'plugins','program-output','content.js'),'utf8');
  const inputParser=fs.readFileSync(path.join(ROOT,'plugins','program-input','parser.js'),'utf8');
  const simulatorContent=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','content.js'),'utf8');
  const sourceLibrary=fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','library.js'),'utf8');

  ['sourceLibrary','sourceValueMode','inputValueMode','timelinePresentation','assignmentLesson:',
    'unaryUpdateLesson:','mixedUpdateLesson:','outputLesson:'].forEach(token=>
    assert(!profiles.includes(token),`profiles.js retains retired configuration '${token}'`));
  assert(!generator.includes('raw.program'));
  assert(!activityCore.includes('profile.content.provider'));
  assert(!simulatorContent.includes("id:'program-selection'"));
  assert(!sourceLibrary.includes('aliases:'));

  ['poProgramBody','poSplitStatements','poParseExpression','poParseCOutput','poParseJavaOutput']
    .forEach(name=>assert(!outputContent.includes(`function ${name}`),`Program Output retains duplicate parser ${name}`));
  assert(!outputContent.includes('coreParseStatement('));
  assert(!simulatorContent.includes('coreParseStatement('));
  assert(!simulatorContent.includes('poParseCOutput('));
  assert(!simulatorContent.includes('poParseJavaOutput('));
  assert(!inputParser.includes('function programInputParseSourceLine'));
  assert(inputParser.includes('function programInputHydrateStatement'));
}

function testFeaturePropagationProof(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','language.js',
    'program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
    'statement-parser.js','statement-semantics.js','program-parser.js','source-program-pipeline.js',
    'program-core.js','legacy-expression-plugin.js','declaration-statement-plugin.js','assignment-statement-plugin.js',
    'program-return.js','program-break.js','activity-core.js','source-library-registry.js']);
  loadRelative(ctx,['exercise-libraries/source-programs/library.js','plugins/program-output/manifest.js',
    'plugins/program-output/statement.js','plugins/program-input/manifest.js','plugins/program-input/parser.js',
    'plugins/program-input/statement.js']);
  load(ctx,['program-item-builder.js']);
  loadRelative(ctx,['plugins/program-output/content.js','plugins/code-simulator/manifest.js',
    'plugins/code-simulator/statement.js','plugins/code-simulator/content.js',
    'plugins/simulate-output/manifest.js','plugins/simulate-output/generator.js']);

  const names=['TaskPapa.c','TaskJuliet.c','TaskOscar.c','TaskSierra.c'];
  ctx.phase9Rows=names.map(filename=>({filename,raw:fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','c',
    filename==='TaskOscar.c'?'simulate-basic-output':'simulate-output-variables',filename),'utf8')}));
  ctx.phase9Manifest={title:'Phase 9 propagation fixtures',exercises:names};
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const expressionSignature=expression=>!expression?null:expression.kind==='binary'
      ?{kind:'binary',operator:expression.operator,left:expressionSignature(expression.left),right:expressionSignature(expression.right)}
      :expression.kind==='unary'?{kind:'unary',operator:expression.operator,form:expression.form,
        operand:expressionSignature(expression.operand)}
      :expression.kind==='identifier'?{kind:'identifier',name:expression.name}
      :{kind:'literal',value:expression.value,dataType:expression.dataType||null};
    const semanticSignature=program=>program.statements.map(statement=>({
      kind:statement.kind,
      declaration:statement.kind==='declaration'?{
        name:statement.binding.name,dataType:statement.binding.dataType,syntax:statement.declarationSyntax||null,
        initializer:expressionSignature(statement.initializer)}:null,
      unary:statement.kind==='unary-update'?{target:statement.target,operator:statement.operator,form:statement.form}:null,
      output:statement.kind==='output'?statement.parts.map(part=>part.kind==='expression'
        ?{kind:'expression',format:part.format,expression:expressionSignature(part.expression)}
        :{kind:'text',value:part.value}):null
    }));
    const outputProfile=PROFILES.find(profile=>profile.id==='program-output-basics');
    const simulatorProfile=PROFILES.find(profile=>profile.id==='selection-statements-source');
    const simulateProfile={id:'phase9-simulate',activity:{generator:{library:'source-programs',exerciseSet:'phase9',shuffle:false}}};
    soInstallExerciseBank('exercise-libraries/source-programs/c/phase9/manifest.json','c','phase9',phase9Manifest,phase9Rows);
    const generationContext={};
    const summaries=phase9Rows.map((row,index)=>{
      const exercise={id:row.filename.replace(/\.[^.]+$/,''),filename:row.filename,raw:row.raw};
      const core=coreParseProgram({language:'c',filename:row.filename,source:row.raw});
      const simulate=soParseExercise(exercise,'c');
      const output=poParseSourceExercise(exercise,'c');
      const simulator=csParseExercise(exercise,'c','authored','authored');
      const outputItem=poBuildSourceItem(outputProfile,exercise,'c',index+1);
      const simulatorItem=csBuildItem(simulatorProfile,exercise,'c',index+1);
      const simulateItem=soGenerateItem({profile:simulateProfile,index,language:'c',generationContext});
      const signature=JSON.stringify(semanticSignature(core.ir));
      const coreOutput=core.effects.filter(effect=>effect.kind==='output').map(effect=>effect.text).join('').trimEnd();
      const expectedOutput=simulate.expectedLines.join('\\n').trimEnd();
      return {filename:row.filename,diagnostics:core.diagnostics.map(diagnostic=>diagnostic.code),
        sameCore:{simulate:JSON.stringify(semanticSignature(simulate.coreProgram))===signature,
          output:JSON.stringify(semanticSignature(output.coreProgram))===signature,
          simulator:JSON.stringify(semanticSignature(simulator.coreProgram))===signature},
        outputMatches:coreOutput===expectedOutput,
        activityFilename:simulateItem.filename,
        outputKinds:outputItem.program.statements.map(statement=>statement.kind),
        simulatorKinds:simulatorItem.program.statements.map(statement=>statement.kind),
        memory:simulator.memory,
        formats:core.ir.statements.filter(statement=>statement.kind==='output').flatMap(statement=>
          statement.parts.filter(part=>part.kind==='expression').map(part=>part.format)),
        declarations:core.ir.statements.filter(statement=>statement.kind==='declaration').map(statement=>({
          name:statement.binding.name,type:statement.binding.dataType,syntax:statement.declarationSyntax||null,
          mutable:statement.binding.mutable,initializer:statement.initializer}))};
    });
    return JSON.stringify(summaries);
  })()`));

  assert.deepStrictEqual(result.map(row=>row.filename),names);
  result.forEach(row=>{
    assert.deepStrictEqual(row.diagnostics,[],`${row.filename} must parse without core diagnostics`);
    assert(Object.values(row.sameCore).every(Boolean),
      `${row.filename} must expose the same canonical IR to every compatible adapter: ${JSON.stringify(row.sameCore)}`);
    assert(row.outputMatches,`${row.filename} generated Simulate Output answer must match core output`);
    assert.strictEqual(row.activityFilename,row.filename);
    assert(row.outputKinds.includes('output')&&row.outputKinds.includes('legacy-expression'));
    assert(row.simulatorKinds.includes('output')&&row.simulatorKinds.includes('program-return'));
  });
  const papa=result.find(row=>row.filename==='TaskPapa.c');
  const papaSum=papa.declarations.find(row=>row.name==='sum').initializer;
  assert.deepStrictEqual([papa.memory.p,papa.memory.q,papa.memory.sum],[5,5,9]);
  assert.strictEqual(papaSum.kind,'binary');
  assert.deepStrictEqual([papaSum.left.kind,papaSum.left.form,papaSum.right.kind,papaSum.right.form],
    ['unary','prefix','unary','postfix']);
  const juliet=result.find(row=>row.filename==='TaskJuliet.c');
  assert(juliet.declarations.some(row=>row.name==='name'&&row.type==='string'&&row.syntax==='char-array'));
  assert.deepStrictEqual(juliet.formats,['s','d','.1f','c','.2f','0.4f']);
  const oscar=result.find(row=>row.filename==='TaskOscar.c');
  assert(oscar.declarations.some(row=>row.name==='TAX_RATE'&&row.syntax==='define'&&!row.mutable));
  const sierra=result.find(row=>row.filename==='TaskSierra.c');
  assert(sierra.formats.includes('s')&&sierra.formats.includes('0.4f'));
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
    profileCount:35,
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
    const profiles=PROFILES.filter(p=>p.lesson&&p.lesson.focus==='assignment');
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
      targetReadCreatesStep=false,targetReadCreatesRow=false,targetUndoRemovesStep=false,
      finalStatementIdsCorrect=true,finalRenderedActionAccepted=true;
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
      const finalHost=new FakeNode('div');renderProgramItem(finalHost,item);
      const findActiveFinal=node=>{
        if(!node)return null;
        const classes=String(node.className||'').split(/\\s+/);
        if(classes.includes('legacy-program-statement')&&classes.includes('active'))return node;
        for(const child of node.children||[]){const found=findActiveFinal(child);if(found)return found;}
        return null;
      };
      const renderedFinal=findActiveFinal(finalHost);
      const renderedStatementId=renderedFinal&&renderedFinal.attributes['data-statement-id'];
      finalStatementIdsCorrect=finalStatementIdsCorrect
        &&renderedStatementId===currentProgramStatement(item).id
        &&renderedStatementId==='final-expression';
      const firstFinalOperand=collectUnresolvedFlat(item.workingFlat,[])[0];
      const finalTraceBefore=item.trace.length;
      handleTokenClick({type:'substitute',id:firstFinalOperand.id,statementId:renderedStatementId});
      finalRenderedActionAccepted=finalRenderedActionAccepted&&item.trace.length===finalTraceBefore+1;
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
      operationCuesCorrect,mergeSymbolsCorrect,mergeTimingIsDeliberate,statementCounts,
      finalStatementIdsCorrect,finalRenderedActionAccepted});
  })()`));
  assert.deepStrictEqual(result,{
    profileCount:8,operators:['%=','*=','+=','-=','/=','='],allCorrect:true,allFullPoints:true,
    constantWriteRejected:true,sharedRendererVisible:true,assignmentSourceVisible:true,
    compoundRequiresTarget:true,targetRevealVisible:true,compoundResultVisible:true,plainEqualsUnchanged:true,
    compoundUndoWorks:true,
    targetReadCreatesStep:true,targetReadCreatesRow:true,targetUndoRemovesStep:true,
    operationCuesCorrect:true,mergeSymbolsCorrect:true,mergeTimingIsDeliberate:true,
    statementCounts:[1,2,1,2,1,3,2,3],finalStatementIdsCorrect:true,finalRenderedActionAccepted:true
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
    resumed:true, profileCount:35, preservedScore:0.75,policyMigrated:true,
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

function testCodeOrderingPartialRecordScoring(){
  const ctx=context();
  ctx.registerActivityPlugin=plugin=>{ctx.codeOrderingPlugin=plugin;};
  ctx.sourceProgramScreenStateText=value=>String(value||'');
  ctx.coreTerminalScreen=value=>({row:0,column:String(value||'').length});
  loadRelative(ctx,['plugins/code-ordering/plugin.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const item={answerKey:{output:'Ready',expectedLines:['Ready'],terminalOutput:true,variables:[
      {name:'x',expected:5},{name:'y',expected:9}
    ]}};
    const stopped={ok:false,answer:{output:'Ready',variables:[{name:'x',expected:5}]}};
    return JSON.stringify(coScore(item,stopped));
  })()`));
  assert.strictEqual(result.correct,1);
  assert.strictEqual(result.total,2);
  assert.deepStrictEqual(result.variableResults,[true,false]);
}
function run(){
  const phaseZeroBaseline=assertPhaseZeroBaseline(ROOT);
  testScriptManifestParses();
  testCorrectSolutionProfilePolicy();
  testLanguageCoreContracts();
  testSharedExpressionParser();
  testSharedExpressionSemantics();
  testSharedStatementParser();
  testSharedStatementSemantics();
  testSharedProgramParser();
  testSharedOutputStatementCore();
  testSharedInputStatementCore();
  testSharedSelectionStatementCore();
  testSharedLoopStatementCore();
  testPhase4BUnsupportedConstructs();
  testSharedSourceProgramPipeline();
  testPluginResponsibilityMigration();
  testProfileSchemaSimplification();
  testDuplicateCodeRemoval();
  testFeaturePropagationProof();
  testConnectorCoordinatesRespectActivityZoom();
  testPracticeRetryPlacement();
  testTokenClassificationPlugin();
  testFallingTokenSortMultiple();
  testSimulateOutputPlugin();
  testCodeOrderingPartialRecordScoring();
  testInlineEvaluationActions();
  testLegacyUnaryMutationCards();
  testInvalidExecutionAlertIsStatementScoped();
  const hash = generatedSnapshotHash();
  assert.strictEqual(hash, phaseZeroBaseline.generatedExpressionHash);
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

function testCorrectSolutionProfilePolicy(){
  const ctx=context();
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','state.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const base={meta:{id:'feedback-policy-test',name:'Feedback policy',description:'test'},
      shape:{operandSources:{literal:2},operandRange:{min:1,max:2},allowNegativeOperands:false},
      operators:{allowed:['+']},template:'operand op operand',scoring:{itemCount:1,pointsPerItem:1}};
    const legacy=finalizeProfile(base);
    const hiddenPractice=finalizeProfile(Object.assign({},base,{feedback:{showCorrectSolution:{practice:false}}}));
    const enabledExam=finalizeProfile(Object.assign({},base,{feedback:{showCorrectSolution:{exam:true}}}));
    const booleanOverride=finalizeProfile(Object.assign({},base,{feedback:{showCorrectSolution:false}}));
    state.mode='practice';state.examExpired=false;
    const checked={checked:true};
    const practiceDefault=correctSolutionAvailable(legacy,checked);
    const practiceOverride=correctSolutionAvailable(hiddenPractice,checked);
    state.mode='exam';
    const examDefault=correctSolutionAvailable(legacy,checked);
    const examBeforeRelease=correctSolutionAvailable(enabledExam,checked);
    state.examExpired=true;state.examPolicy=Object.assign({},activeExamPolicy(),{feedbackRelease:'after-timeout'});
    const examOverride=correctSolutionAvailable(enabledExam,checked);
    return JSON.stringify({practiceDefault,practiceOverride,examDefault,examBeforeRelease,examOverride,
      booleanPractice:profileShowsCorrectSolution(booleanOverride,'practice'),
      booleanExam:profileShowsCorrectSolution(booleanOverride,'exam')});
  })()`));
  assert.deepStrictEqual(result,{practiceDefault:true,practiceOverride:false,examDefault:false,
    examBeforeRelease:false,examOverride:true,booleanPractice:false,booleanExam:false});
  assert.throws(()=>evaluate(ctx,`finalizeProfile({meta:{id:'invalid-feedback'},shape:{operandSources:{literal:2}},
    operators:{allowed:['+']},template:'operand op operand',scoring:{itemCount:1,pointsPerItem:1},
    feedback:{showCorrectSolution:{practice:'yes'}}})`),/feedback\.showCorrectSolution/);
}

function testConnectorCoordinatesRespectActivityZoom(){
  const ctx=context();
  ctx.DEFAULT_APP_SETTINGS={shell:{connectors:{maxLeadPx:32,userControlVisible:true}}};
  ctx.state={showConnectors:true};
  load(ctx,['connector-lines.js']);
  const result=JSON.parse(evaluate(ctx,`(()=>{
    function pointFor(width,height,clientX,clientY){
      const panel={offsetWidth:200,offsetHeight:100,scrollLeft:10,scrollTop:5,
        getBoundingClientRect(){return {left:100,top:50,width,height};}};
      return connectorLocalPoint(connectorContentRect(panel),clientX,clientY);
    }
    return JSON.stringify({normal:pointFor(200,100,150,100),zoomed:pointFor(280,140,170,120)});
  })()`));
  assert.deepStrictEqual(result,{normal:{x:60,y:55},zoomed:{x:60,y:55}});
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
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js',
    'program-ir.js','language-core.js','expression-parser.js','expression-semantics.js',
    'output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js',
    'statement-parser.js','statement-semantics.js','program-parser.js','source-program-pipeline.js','activity-core.js',
    'source-library-registry.js']);
  loadRelative(ctx,[
    'exercise-libraries/source-programs/library.js',
    'plugins/simulate-output/manifest.js',
    'plugins/simulate-output/generator.js','plugins/simulate-output/actions.js',
    'plugins/simulate-output/feedback.js','plugins/simulate-output/renderer.js',
    'plugins/simulate-output/plugin.js'
  ]);
  load(ctx,['state.js']);
  ctx.document={querySelector:()=>null};
  ctx.savedEdits=0;
  ctx.saveSessionProgress=()=>{ctx.savedEdits++;};
  const exerciseSet='simulate-output-variables';
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','c',exerciseSet,'manifest.json'),'utf8'));
  const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(
    path.join(ROOT,'exercise-libraries','source-programs','c',exerciseSet,filename),'utf8')}));
  rows.push({filename:'Unlisted.c',raw:rows[0].raw});
  ctx.testManifest=manifest;ctx.testExerciseRows=rows;
  evaluate(ctx,"soInstallExerciseBank('exercise-libraries/source-programs/c/simulate-output-variables/manifest.json','c','simulate-output-variables',testManifest,testExerciseRows)");
  ctx.hotelFixture=fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','c','simulate-basic-output','TaskHotel.c'),'utf8');
  ctx.javaManifest={title:'Java - Simulate Output',exercises:['Hello.java']};
  ctx.javaRows=[{filename:'Hello.java',raw:'public class Hello { public static void main(String[] args) { int count = 1; System.out.println("Hello"); } }'}];
  evaluate(ctx,"soInstallExerciseBank('exercise-libraries/source-programs/java/java-basics/manifest.json','java','java-basics',javaManifest,javaRows)");
  const catalog=JSON.parse(evaluate(ctx,"JSON.stringify(soCatalog(PROFILES.find(profile=>profile.id==='simulate-output-variables'),'c'))"));
  assert.strictEqual(catalog.length,10);
  catalog.forEach(exercise=>{
    const source=fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','c',exerciseSet,exercise.filename),'utf8')
      .replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    assert.strictEqual(exercise.raw,source);
  });
  ctx.editedSimulateFixture='#include <stdio.h>\nint main(){\n int score = 4;\n score += 3;\n printf("Score: %d\\n", score);\n return 0;\n}';
  ctx.oldSimulateFixture='/* @output\nwrong\n@variables\nx = 1 */\nint main(){return 0;}';
  ctx.unsupportedSimulateFixture='int main(){ puts("Hi"); return 0; }';
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const profile=PROFILES.find(candidate=>candidate.id==='simulate-output-variables');
    const javaProfile={id:'java-output',activity:{generator:{library:'source-programs',exerciseSet:'java-basics',shuffle:false}}};
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
    initializeSeededRandom(9876);const sourceBeforeRetry=item.source;
    const retry=soRetry({item,profile});
    const retrySeedStable=item.source===sourceBeforeRetry;
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
    const edited=soParseExercise({id:'Edited',filename:'Edited.c',raw:editedSimulateFixture},'c');
    const hotel=soParseExercise({id:'Hotel',filename:'TaskHotel.c',raw:hotelFixture},'c');
    const sierra=items.find(candidate=>candidate.filename==='TaskSierra.c');
    const booleanAnswerWords=[sourceProgramAnswerValue({value:true,dataType:'int'}),
      sourceProgramAnswerValue({value:false,dataType:'int'})];
    let embeddedRejected=false,incompleteRejected=false;
    try{soParseExercise({id:'Old',filename:'Old.c',raw:oldSimulateFixture},'c');}
    catch(error){embeddedRejected=/embedded answer metadata/.test(error.message);}
    try{soParseExercise({id:'Unsupported',filename:'Unsupported.c',raw:unsupportedSimulateFixture},'c');}
    catch(error){incompleteRejected=/cannot generate a complete answer key/.test(error.message);}
    resetRandomGenerator();
    return JSON.stringify({profileActive:!!profile,javaLoaded:javaItem.language==='java'
        &&javaItem.filename==='Hello.java'&&javaItem.maxPoints===2,count:items.length,
      unique:new Set(items.map(candidate=>candidate.exerciseId)).size,
      manifestOrder:items.map(candidate=>candidate.filename).join(',')===testManifest.exercises.join(','),
      deterministic:items.map(candidate=>candidate.exerciseId).join(',')
        ===repeat.map(candidate=>candidate.exerciseId).join(','),
      allC:items.every(candidate=>candidate.language==='c'),metadataHidden,typingSaved,full:full.applied,
      generatedScoring:fullScore===fullMaximum,traceMatches,retry:retry.applied,resetClean,
      bankMaximum:items.reduce((sum,candidate)=>sum+activityItemMaxPoints(candidate,profile),0),
      editedOutput:edited.expectedLines,editedVariables:edited.variables,
      carriageOutput:hotel.expectedLines,
      booleanAnswerWords,
      constantsExcluded:!sierra.variables.some(variable=>variable.name==='MEMBER_DISCOUNT_YEARS'
        ||variable.name==='TAX_RATE'||variable.name==='SHOP_NAME'),embeddedRejected,incompleteRejected,
      retrySeedStable,
      extraPenalty:extra.outputCorrect===item.expectedLines.length-1,
      snapshotStable,withheld,released});
  })()`));
  assert.deepStrictEqual(result,{profileActive:true,javaLoaded:true,count:10,unique:10,manifestOrder:true,deterministic:true,
    allC:true,metadataHidden:true,typingSaved:true,full:true,generatedScoring:true,
    traceMatches:true,bankMaximum:186,
    editedOutput:['Score: 7'],editedVariables:[{name:'score',dataType:'int',expected:'7'}],
    carriageOutput:['Learning escape characters in C','She said, "C programming is fun!"',
      "It's time to practice.",'File path: C:\\Programs\\C','Loading Done!'],
    booleanAnswerWords:['true','false'],
    constantsExcluded:true,embeddedRejected:true,incompleteRejected:true,
    retry:true,resetClean:true,retrySeedStable:true,
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
    PROFILES.push(ACTIVITY_PROFILES.find(profile=>profile.id==='simulate-output-variables'));
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
    const grouped=categories.length===enabledCategories().length
      &&categories.every(category=>category.children.length===2);
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

  const fresh=sessionContext(false,false);
  const unselectedStart=JSON.parse(evaluate(fresh,`(()=>{
    enabledProfiles=()=>[{id:'alpha'},{id:'beta'}];
    generateItemsForProfile=id=>[{profileId:id}];
    state.profileId='stale-profile';
    startSession();
    return JSON.stringify({profileId:state.profileId,itemCount:state.items.length,
      profileBanks:Object.keys(state.itemsByProfile),screen:state.screen});
  })()`));
  assert.deepStrictEqual(unselectedStart,{profileId:null,itemCount:0,profileBanks:['alpha','beta'],screen:'session'});

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
  const connectorSource=fs.readFileSync(path.join(ROOT,'js','connector-lines.js'),'utf8');
  const outputStyles=fs.readFileSync(path.join(ROOT,'plugins','program-output','styles.css'),'utf8');
  const terminalSource=fs.readFileSync(path.join(ROOT,'js','program-terminal.js'),'utf8');
  const terminalStyles=fs.readFileSync(path.join(ROOT,'css','styles.css'),'utf8');
  assert(terminalSource.includes("setProgramContextTab('output')"));
  assert(terminalSource.includes('coreTerminalScreen('));
  assert(!rendererSource.includes('function renderProgramTerminalPanel'));
  assert(!rendererSource.includes('coreTerminalScreen('));
  assert(!outputStyles.includes('.program-output-screen{'));
  assert(terminalStyles.includes('.program-output-screen{'));
  assert(outputStyles.includes('.program-context-main{position:sticky'));
  assert(outputStyles.includes('.program-context-dock.has-tabs .program-context-panel{display:none;}'));
  assert(outputStyles.includes('.program-context-dock.has-tabs .program-context-panel.active{display:block;}'));
  const ctx=context();
  installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','language.js',
    'program-ir.js','language-core.js','expression-parser.js','expression-semantics.js','output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js','statement-semantics.js','program-parser.js','source-program-pipeline.js','program-core.js','legacy-expression-plugin.js','declaration-statement-plugin.js',
    'assignment-statement-plugin.js','program-return.js','program-break.js','activity-core.js','source-library-registry.js']);
  loadRelative(ctx,['exercise-libraries/source-programs/library.js','plugins/program-output/manifest.js','plugins/program-output/statement.js',
    'plugins/program-input/manifest.js','plugins/program-input/parser.js','plugins/program-input/statement.js']);
  load(ctx,['program-item-builder.js']);
  loadRelative(ctx,['plugins/program-output/content.js']);
  load(ctx,['state.js','manual-response.js','dom-helpers.js','program-terminal.js','var-final-state.js','render-tree.js','render-flat.js','render-declaration.js',
    'render-assignment.js','render-unary-update.js','render-session.js']);
  loadRelative(ctx,['plugins/program-output/renderer.js']);
  const installBank=(language)=>{
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,'formatted-output');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    ctx[`test${language.toUpperCase()}Manifest`]=manifest;
    ctx[`test${language.toUpperCase()}Rows`]=rows;
    evaluate(ctx,`poInstallExerciseBank('exercise-libraries/source-programs/${language}/formatted-output/manifest.json',
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
    const studentItem=JSON.parse(JSON.stringify(sourceItems[0]));
    studentItem.program.memory={};
    studentItem.decls.forEach(declaration=>{studentItem.program.memory[declaration.name]={
      name:declaration.name,kind:declaration.kind,initialized:true,value:declaration.value};});
    const studentOutputIndex=studentItem.program.statements.findIndex(statement=>statement.kind==='output');
    studentItem.program.statements.forEach((statement,index)=>{
      statement.status=index<studentOutputIndex?'complete':(index===studentOutputIndex?'active':'locked');
    });
    studentItem.program.cursor=studentOutputIndex;
    const studentOutputStatement=studentItem.program.statements[studentOutputIndex];
    studentItem.manualResponsePlan={enabled:true,outputMode:'complete-emission',namedKeys:{},operatorKeys:{},
      outputKeys:{[studentOutputStatement.id]:true}};
    const studentExpectedText=programOutputStatementText(studentOutputStatement,true);
    const studentEnteredText=studentExpectedText+'wrong\\n';
    const studentOutputPlan=statementInteractionPlan(studentItem,studentOutputStatement);
    const studentOutputBegan=dispatchProgramAction(studentItem,studentOutputPlan.action,{applyExpressionAction});
    const studentOutputForm=renderProgramOutputInlineResponse(studentItem,studentItem.program,studentOutputStatement);
    const studentOutputSubmitted=dispatchProgramAction(studentItem,{type:'emit-student-output',
      statementId:studentOutputStatement.id,text:studentEnteredText},{applyExpressionAction});
    const studentOutputEvent=studentItem.program.events[studentItem.program.events.length-1];

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
    const panelText=renderProgramTerminalPanel(item,item.program).textContent;
    const terminalProgram={statements:[],events:[
      {type:'OUTPUT',text:'Loading......\\r'},
      {type:'OUTPUT',text:'Loading Done!\\n'}
    ]};
    const terminalPanelText=renderProgramTerminalPanel(item,terminalProgram).textContent;
    const carriageCursor=h('span',{});
    programTerminalPositionCursor(carriageCursor,coreTerminalScreen('Loading......\\r'));
    const carriageStatement=coreParseStatement({language:'c',source:'printf("Loading......\\\\r");',symbols:{}}).ir;
    const carriageSource=outputStatementSource(carriageStatement,{program:{language:'c'}});
    const canonical=buildCanonicalProgramTrace(item);
    item.program.language='java';
    const javaSource=outputStatementSource(dynamic,item);
    const javaLineSource=outputStatementSource(item.program.statements[5],item);
    const javaResolvedState=renderProgramOutputState(dynamic,item,item.program,{traceCount:2,interactive:false});
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
    const sourceFlowCatalogProfile=PROFILES.find(candidate=>candidate.id==='program-output-source-flow');
    const sourceFlowProfile=Object.assign({},sourceFlowCatalogProfile,{id:'program-output-inline-test',
      content:Object.assign({},sourceFlowCatalogProfile.content,{provider:'program-output'}),
      presentation:Object.assign({},sourceFlowCatalogProfile.presentation,{timeline:'inline'})});
    PROFILES.push(sourceFlowProfile);
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
    const sourceFlowContextDocks=countNodesWithClass(sourceFlowHost,'program-context-main');
    const sourceFlowContextTabs=countNodesWithClass(sourceFlowHost,'program-context-tab');
    const sourceFlowMemoryHosts=countNodesWithClass(sourceFlowHost,'program-memory-dock-host');
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
      studentOutputPlanMode:studentOutputPlan.mode,
      studentOutputBegan:studentOutputBegan.applied,
      studentOutputForm:countNodesWithClass(studentOutputForm,'program-output-prediction'),
      studentOutputSubmitted:studentOutputSubmitted.applied,
      studentOutputRendered:programOutputText(studentItem.program)===studentEnteredText,
      studentOutputExpectedPreserved:studentOutputEvent.expectedText===studentExpectedText,
      studentOutputMarkedWrong:studentOutputEvent.wasCorrect===false,
      studentOutputAdvanced:studentItem.program.cursor>studentOutputIndex,

      sourceProfileItemCount:sourceProfile.scoring.itemCount,
      sourceProfileSelectionCount:sourceProfile.content.selection.count,
      sourceFlowItemCount:sourceFlowProfile.scoring.itemCount,
      sourceFlowSelectionCount:sourceFlowProfile.content.selection.count,
      migratedSourceFlowSelectsProvider:Object.prototype.hasOwnProperty.call(sourceFlowCatalogProfile.content,'provider'),
      migratedSourceFlowLibrary:profileContentSource(sourceFlowCatalogProfile).library,
      migratedSourceFlowTimeline:profileTimelineMode(sourceFlowCatalogProfile),
      recoveredProgramItems,
      statementCount:kinds.length,
      kinds,
      sumInitializer:item.program.statements[2].runtime.originalTree.op,
      literal:literal.applied,read:read.applied,combine:combine.applied,printed:printed.applied,
      readTimelineRows,readTimelineCards,combinedTimelineRows,combinedTimelineCards,combinedSubstitutionRows,
      combinedTimelineText,visualStepIds,combineSourceId,
      sourceBinding,bindingColor,formatColor,
      cSource,javaSource,javaLineSource,cText,panelText,terminalPanelText,carriageSource,
      javaResolvedText:javaResolvedState.textContent,
      javaResolvedCards:countNodesWithClass(javaResolvedState,'tok-card'),
      javaResolvedDerivedValues:countNodesWithClass(javaResolvedState,'program-output-derived-value'),
      javaResolvedHighlights:countNodesWithClass(javaResolvedState,'program-output-resolved-value'),
      carriageCursorRow:carriageCursor.attributes['data-terminal-row'],
      carriageCursorColumn:carriageCursor.attributes['data-terminal-column'],canonicalPrints:canonical.filter(event=>event.action==='PRINT').length,
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
      sourceContextRows,sourceFlowProgramRows,sourceFlowContextDocks,sourceFlowContextTabs,sourceFlowMemoryHosts,
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
  assert.strictEqual(result.studentOutputPlanMode,'direct');
  assert(result.studentOutputBegan&&result.studentOutputSubmitted);
  assert.strictEqual(result.studentOutputForm,1);
  assert(result.studentOutputRendered&&result.studentOutputExpectedPreserved);
  assert(result.studentOutputMarkedWrong&&result.studentOutputAdvanced);

  assert.strictEqual(result.sourceProfileItemCount,'manifest');
  assert.strictEqual(result.sourceProfileSelectionCount,'all');
  assert.strictEqual(result.sourceFlowItemCount,'manifest');
  assert.strictEqual(result.sourceFlowSelectionCount,'all');
  assert.strictEqual(result.migratedSourceFlowSelectsProvider,false);
  assert.strictEqual(result.migratedSourceFlowLibrary,'source-programs');
  assert.strictEqual(result.migratedSourceFlowTimeline,'statement-modal');
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
  assert(!result.javaResolvedText.includes(' + ')&&!result.javaResolvedText.includes('→'));
  assert.strictEqual(result.javaResolvedCards,0);
  assert.strictEqual(result.javaResolvedDerivedValues,0);
  assert.strictEqual(result.javaResolvedHighlights,1);
  assert(result.cText.startsWith('OUTPUT LESSON\nValue of '));
  assert(result.panelText.includes('Program Output')&&result.panelText.includes('OUTPUT LESSON'));
  assert(result.terminalPanelText.includes('Loading Done!'));
  assert(!result.terminalPanelText.includes('Loading......'));
  assert.strictEqual(result.carriageSource,'printf("Loading......\\r");');
  assert.deepStrictEqual([result.carriageCursorRow,result.carriageCursorColumn],['0','0']);
  assert(result.panelText.includes('↵'));
  assert(terminalSource.includes("pre,escape,cursor"));
  assert(terminalSource.includes("escape.classList.add('is-visible')"));
  assert(rendererSource.includes("style:bindingIdentityStyle(name,'variable')"));
  assert(rendererSource.includes('renderProgramOutputResolvedJavaString'));
  assert(connectorSource.includes("step.outputAction!=='FORMAT_VALUE'"));
  assert(outputStyles.includes('.program-output-string{color:color-mix(in srgb,var(--text) 74%,var(--text-dim));'));
  assert(!outputStyles.includes('.program-output-string{color:#9fda72;'));
  assert(outputStyles.includes('.program-output-resolved-value{color:var(--binding-color,var(--good));}'));
  assert(outputStyles.includes('.source-program-workspace .code-out{white-space:pre;}'));
  assert(outputStyles.includes('.program-output-timeline .output-substitution-row{padding-bottom:30px;}'));
  assert(outputStyles.includes('.program-source-context{opacity:.78;}'));
  assert(outputStyles.includes('.program-source-context-code{min-width:max-content;color:var(--text-dim);font:inherit;'));
  assert(!outputStyles.includes('.program-source-context-code{font-size:11px;}'));
  assert(!terminalSource.includes("escape.textContent='\\\\n'"));
  assert(terminalStyles.includes('.program-output-escape-cue.is-visible{display:inline-flex'));
  assert(terminalStyles.includes('.program-output-cursor{position:relative;display:inline-block'));
  assert(terminalStyles.includes('.program-output-cursor.is-hidden{display:none;}'));
  assert(terminalSource.includes('programTerminalPositionCursor(cursor,terminalState,pre)'));
  assert(terminalSource.includes('parent.insertBefore(cursor,node.splitText(remaining))'));
  assert(!terminalStyles.includes('.program-output-escape-cue{position:absolute'));
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
  assert.strictEqual(result.sourceFlowContextDocks,1);
  assert(result.sourceFlowContextTabs>=1);
  // var-final-float.js is covered by the code-simulator harness above; this
  // plugin-only harness loads the Output side of the shared context dock.
  assert.strictEqual(result.sourceFlowMemoryHosts,0);
  assert(result.sourceFlowRunningBeforeReturn&&result.sourceFlowReturned&&result.sourceFlowCompletedAfterReturn);
  assert.strictEqual(result.sourceFlowReturnMode,'direct');
  assert.strictEqual(result.sourceFlowReturnAction,'return-program');
  assert(result.sourceFlowFinalized&&result.sourceFlowChecked&&result.sourceFlowFullScore);
  assert.deepStrictEqual(result.generatedFallback,['generated-fallback']);
  assert.deepStrictEqual(result.javaMultiPartKinds,result.multiPartKinds);
  assert(result.javaMultiSource.startsWith('System.out.print('));
  assert.strictEqual(result.javaLanguage,'java');
}

function testCodeSimulatorPlugin(){
  const ctx=context();installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','language.js',
    'program-ir.js','language-core.js','expression-parser.js','expression-semantics.js','output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js','statement-semantics.js','program-parser.js','source-program-pipeline.js','program-core.js','legacy-expression-plugin.js','declaration-statement-plugin.js',
    'assignment-statement-plugin.js','program-return.js','program-break.js','activity-core.js','source-library-registry.js']);
  loadRelative(ctx,['exercise-libraries/source-programs/library.js','plugins/program-output/manifest.js','plugins/program-output/statement.js',
    'plugins/program-input/manifest.js','plugins/program-input/parser.js','plugins/program-input/statement.js']);
  load(ctx,['program-item-builder.js']);
  loadRelative(ctx,['plugins/program-output/content.js','plugins/code-simulator/manifest.js',
    'plugins/code-simulator/statement.js','plugins/code-simulator/content.js']);
  load(ctx,['state.js','manual-response.js','dom-helpers.js','program-terminal.js','var-final-state.js','render-tree.js','render-flat.js','render-declaration.js',
    'render-assignment.js','render-unary-update.js','render-session.js']);
  loadRelative(ctx,['plugins/program-output/renderer.js','plugins/program-input/renderer.js','plugins/code-simulator/renderer.js']);
  const selectionStatementSource=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','statement.js'),'utf8');
  const selectionRendererSource=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','renderer.js'),'utf8');
  const selectionStyles=fs.readFileSync(path.join(ROOT,'plugins','code-simulator','styles.css'),'utf8');
  const sharedStyles=fs.readFileSync(path.join(ROOT,'css','styles.css'),'utf8');
  const renderSessionSource=fs.readFileSync(path.join(ROOT,'js','render-session.js'),'utf8');
  ctx.csSeedFixture=`/*
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
  ctx.csLiveControlFixture=`/*
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
  ctx.csMixedStatementFixture=`#include <stdio.h>
int main() {
    int total = 2;
    total += 3;
    total++;
    printf("Total: %d\\n", total);
    return 0;
}`;
  ctx.csStrictPrecedenceFixture=`#include <stdio.h>
int main() {
    int a = 2;
    int b = 3;
    int c;
    c = a + b * 2;
    return 0;
}`;
  ctx.csStrictBooleanFixture=`#include <stdio.h>
int main() {
    int score = 80;
    int absences = 2;
    if (score >= 75 && absences < 5) {
        printf("Qualified.\\n");
    }
    printf("Done.\\n");
    return 0;
}`;
  ctx.csStrictJavaOutputFixture=`public class StrictJavaOutput {
    public static void main(String[] args) {
        int total = 7;
        System.out.println("total = " + total);
    }
}`;
  ctx.csOutputOnlyFixture=`#include <stdio.h>
int main() {
    puts("This unsupported call remains visible.");
    printf("Hello from Code Simulator.\\n");
    return 0;
}`;
  ctx.csUnsupportedOnlyFixture=`#include <stdio.h>
int main() {
    mystery();
}`;
  ctx.csSwitchFallthroughFixture=`#include <stdio.h>
int main() {
    int day = 2;
    switch (day) {
        case 1:
            printf("One\\n");
            break;
        case 2:
            printf("Two\\n");
        case 3:
            printf("Three\\n");
            break;
        default:
            printf("Other\\n");
    }
    printf("After\\n");
    return 0;
}`;
  ctx.csTypedFixture=fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','c','formatted-output','TypedValues.c'),'utf8');
  ctx.csTaskPapaFixture=fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs','c','simulate-output-variables','TaskPapa.c'),'utf8');
  ctx.csUndeclaredSeedFixture=ctx.csSeedFixture.replace('@seed score min=10 max=999','@seed missing min=1 max=2');
  ctx.csDerivedSeedFixture=ctx.csSeedFixture.replace('@seed score min=10 max=999','@seed bonus min=1 max=2');
  ['c','java'].forEach(language=>{
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,'selection-basics');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    ctx.csTestManifest=manifest;ctx.csTestRows=rows;
    evaluate(ctx,`csInstallExerciseBank('exercise-libraries/source-programs/${language}/selection-basics/manifest.json',
      '${language}','selection-basics',csTestManifest,csTestRows)`);
  });
  ['c','java'].forEach(language=>{
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,'formatted-output');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    ctx.csOutputManifest=manifest;ctx.csOutputRows=rows;
    evaluate(ctx,`csInstallExerciseBank('exercise-libraries/source-programs/${language}/formatted-output/manifest.json',
      '${language}','formatted-output',csOutputManifest,csOutputRows)`);
  });
  ['c','java'].forEach(language=>{
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,'output-basics');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    ctx.csBasicOutputManifest=manifest;ctx.csBasicOutputRows=rows;
    evaluate(ctx,`csInstallExerciseBank('exercise-libraries/source-programs/${language}/output-basics/manifest.json',
      '${language}','output-basics',csBasicOutputManifest,csBasicOutputRows)`);
  });
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const profile=PROFILES.find(candidate=>candidate.id==='selection-statements-source');
    const sourceOutputProfile=PROFILES.find(candidate=>candidate.id==='program-output-source-flow');
    state.language='c';initializeSeededRandom(404);
    const basicOutputItems=generateItemsForProfile('test-basic-output');resetRandomGenerator();
    const taskGolph=basicOutputItems.find(candidate=>candidate.filename==='TaskGolph.c');
    while(taskGolph.program.status==='running'){
      const active=taskGolph.program.statements[taskGolph.program.cursor];
      const action=active.kind==='output'?{type:'emit-output',statementId:active.id}
        :active.kind==='program-return'?{type:'return-program',statementId:active.id}:null;
      if(!action)break;
      dispatchProgramAction(taskGolph,action,{applyExpressionAction});
    }
    const taskGolphTerminal=coreTerminalScreen(programOutputText(taskGolph.program));
    initializeSeededRandom(101);const fixtureA=csParseExercise({filename:'SeedFixture.c',raw:csSeedFixture},'c','seeded');
    initializeSeededRandom(101);const fixtureRepeat=csParseExercise({filename:'SeedFixture.c',raw:csSeedFixture},'c','seeded');
    initializeSeededRandom(202);const fixtureB=csParseExercise({filename:'SeedFixture.c',raw:csSeedFixture},'c','seeded');
    const fixtureAuthored=csParseExercise({filename:'SeedFixture.c',raw:csSeedFixture},'c','authored');
    const liveControl=csParseExercise({filename:'LiveControl.c',raw:csLiveControlFixture},'c','authored');
    const mixedStatements=csParseExercise({filename:'MixedStatements.c',raw:csMixedStatementFixture},'c','authored');
    const taskPapa=csParseExercise({filename:'TaskPapa.c',raw:csTaskPapaFixture},'c','authored');
    const taskPapaSum=taskPapa.statements.find(candidate=>candidate.kind==='declaration'&&candidate.binding.name==='sum');
    const outputOnly=csParseExercise({filename:'OutputOnly.c',raw:csOutputOnlyFixture},'c','authored');
    const switchFallthrough=csParseExercise({filename:'SwitchFallthrough.c',raw:csSwitchFallthroughFixture},'c','authored');
    const switchFallthroughItem=csBuildItem(profile,{id:'SwitchFallthrough',filename:'SwitchFallthrough.c',raw:csSwitchFallthroughFixture},'c',98);
    const switchIndex=switchFallthroughItem.program.statements.findIndex(candidate=>candidate.kind==='selection');
    switchFallthroughItem.program.statements.slice(0,switchIndex).forEach(candidate=>candidate.status='complete');
    switchFallthroughItem.program.cursor=switchIndex;
    const fallthroughSwitch=switchFallthroughItem.program.statements[switchIndex];
    fallthroughSwitch.status='active';
    switchFallthroughItem.program.memory.day={name:'day',kind:'variable',initialized:true,value:2};
    fallthroughSwitch.runtime.workingFlat={operands:[{id:'switch-result',kind:'literal',value:2}],operators:[]};
    dispatchProgramAction(switchFallthroughItem,{type:'commit-branch',statementId:fallthroughSwitch.id},{applyExpressionAction});
    const fallthroughPath=[];
    for(let step=0;step<5&&switchFallthroughItem.program.status==='running';step++){
      const active=switchFallthroughItem.program.statements[switchFallthroughItem.program.cursor];
      fallthroughPath.push({kind:active.kind,source:active.sourceText.trim()});
      if(active.sourceText.includes('After'))break;
      const action=active.kind==='output'?{type:'emit-output',statementId:active.id}
        :active.kind==='program-break'?{type:'break-control',statementId:active.id}:null;
      if(!action)break;
      dispatchProgramAction(switchFallthroughItem,action);
    }
    const outputOnlyItem=csBuildItem(profile,{id:'OutputOnly',filename:'OutputOnly.c',raw:csOutputOnlyFixture},'c',99);
    const dynamicSelectionItem=csBuildItem(profile,{id:'DynamicSelection',filename:'SeedFixture.c',raw:csSeedFixture},'c',100);
    const dynamicSelection=dynamicSelectionItem.program.statements.find(candidate=>candidate.kind==='selection');
    dynamicSelectionItem.program.memory.score={name:'score',initialized:true,value:10};
    dynamicSelectionItem.program.memory.limit={name:'limit',initialized:true,value:75};
    syncSelectionOperands(dynamicSelection,dynamicSelectionItem.program);
    const dynamicOutputItem=csBuildItem(profile,{id:'DynamicOutput',filename:'MixedStatements.c',raw:csMixedStatementFixture},'c',101);
    const dynamicOutput=dynamicOutputItem.program.statements.find(candidate=>candidate.kind==='output');
    const dynamicOutputPart=programOutputDynamicParts(dynamicOutput)[0];
    dynamicOutputItem.program.memory.total={name:'total',initialized:true,value:42};
    statementPluginFor(dynamicOutput).applyAction({statement:dynamicOutput,program:dynamicOutputItem.program,
      item:dynamicOutputItem,action:{type:'read-output-value',partIndex:dynamicOutputPart.index}});
    let undeclaredError='',derivedError='',badRangeError='',duplicateError='',unsupportedOnlyError='';
    try{csParseExercise({filename:'Undeclared.c',raw:csUndeclaredSeedFixture},'c','seeded');}catch(error){undeclaredError=error.message;}
    try{csParseExercise({filename:'Derived.c',raw:csDerivedSeedFixture},'c','seeded');}catch(error){derivedError=error.message;}
    try{sourceProgramSeedDirectives('@seed x min=9 max=2','BadRange.c');}catch(error){badRangeError=error.message;}
    try{sourceProgramSeedDirectives('@seed x min=1 max=2\\n@seed x min=3 max=4','Duplicate.c');}catch(error){duplicateError=error.message;}
    try{csParseExercise({filename:'UnsupportedOnly.c',raw:csUnsupportedOnlyFixture},'c','authored');}catch(error){unsupportedOnlyError=error.message;}
    initializeSeededRandom(2);state.language='c';const items=generateItemsForProfile('selection-statements-source');
    initializeSeededRandom(2);const repeatItems=generateItemsForProfile('selection-statements-source');
    initializeSeededRandom(3);const changedItems=generateItemsForProfile('selection-statements-source');
    initializeSeededRandom(2);const retrySeededA=regenerateProfileContentItem(profile,items[0]);
    initializeSeededRandom(3);const retrySeededB=regenerateProfileContentItem(profile,items[0]);
    const kinds=items.map(item=>item.program.statements.filter(statement=>statement.kind==='selection').map(statement=>statement.selectionKind));
    const switchItem=items[3],switchBreaks=switchItem.program.statements.filter(statement=>statement.kind==='program-break');
    const switchReturn=switchItem.program.statements.find(statement=>statement.kind==='program-return');
    const breakProbeStatement=JSON.parse(JSON.stringify(switchBreaks[0]));breakProbeStatement.status='active';
    const breakProbeReturn=programReturnStatement({id:switchReturn.id,value:0});breakProbeReturn.status='locked';
    const breakProbe={checked:false,program:createProgram([breakProbeStatement,breakProbeReturn],{language:'c'})};
    const breakPlan=statementInteractionPlan(breakProbe,breakProbeStatement);
    const breakResult=dispatchProgramAction(breakProbe,breakPlan.action);
    const first=items[0],selectionIndex=first.program.statements.findIndex(statement=>statement.kind==='selection');
    const firstMemoryNames=ensureBindings(first).map(binding=>binding.name);
    const strictProbe=csBuildItem(profile,{id:'StrictFlow',filename:'StrictFlow.c',raw:csLiveControlFixture},'c',103);
    state.profileId=profile.id;state.items=[strictProbe];state.itemIndex=0;state.mode='practice';
    state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'strict-sequence'}});
    strictProbe.program.statements[2].status='blocked';
    const strictSourceHost=h('div',{});renderProgramItem(strictSourceHost,strictProbe,{});
    const strictExpectedCandidates=strictProbe.sourceDisplay.lines.filter(line=>line.primary
      &&(line.statementId||(Array.isArray(line.statementIds)&&line.statementIds.length))).length;
    const strictStatementCandidates=countNodesWithClass(strictSourceHost,'strict-sequence-statement-candidate');
    const strictActiveRows=countNodesWithClass(strictSourceHost,'is-active');
    const strictCurrentDots=countNodesWithClass(strictSourceHost,'current');
    const strictBlockedMarkers=countNodesWithClass(strictSourceHost,'blocked')
      +countNodesWithClass(strictSourceHost,'is-blocked');
    const strictWrongStatement=strictProbe.program.statements[1];
    const strictWrongSelection=attemptProgramStatementSelection(strictProbe,strictWrongStatement.id);
    const strictPracticePaused=strictWrongSelection.invalid
      &&strictProbe.practiceInvalidExecution.reason==='statement-out-of-sequence';
    const strictPausedHost=h('div',{});renderProgramItem(strictPausedHost,strictProbe,{});
    const strictPausedCandidates=countNodesWithClass(strictPausedHost,'strict-sequence-statement-candidate');
    const strictPausedMarkers=countNodesWithClass(strictPausedHost,'strict-sequence-candidate-paused');
    handleUndo();const strictPracticeRecovered=!strictProbe.practiceInvalidExecution;
    const strictCorrectSelection=attemptProgramStatementSelection(strictProbe,
      strictProbe.program.statements[strictProbe.program.cursor].id).applied;
    const strictBranchProbe=csBuildItem(profile,{id:'StrictBranch',filename:'StrictBranch.c',raw:csLiveControlFixture},'c',105);
    state.items=[strictBranchProbe];state.itemIndex=0;
    const strictBranchDeclaration=strictBranchProbe.program.statements[0];
    dispatchProgramAction(strictBranchProbe,statementInteractionPlan(strictBranchProbe,strictBranchDeclaration).action,
      {applyExpressionAction});
    const strictBranchSelection=currentProgramStatement(strictBranchProbe);
    strictBranchSelection.runtime.workingFlat={operands:[{id:'strict-if-result',kind:'literal',value:true}],operators:[]};
    dispatchProgramAction(strictBranchProbe,{type:'commit-branch',statementId:strictBranchSelection.id},{applyExpressionAction});
    const strictIncorrectIfBranch=strictBranchSelection.branches.find(candidate=>
      candidate.targetStatementId!==strictBranchSelection.runtime.selectedTargetStatementId);
    const strictIncorrectIfChoice=attemptProgramStatementSelection(strictBranchProbe,
      strictIncorrectIfBranch.targetStatementId);
    const strictIfBranchContinues=strictIncorrectIfChoice.applied&&strictIncorrectIfChoice.branchChoice
      &&strictIncorrectIfChoice.wasCorrect===false&&!strictBranchProbe.practiceInvalidExecution
      &&currentProgramStatement(strictBranchProbe).id===strictIncorrectIfBranch.targetStatementId
      &&strictBranchSelection.runtime.branchChoiceCorrect===false;
    const strictCompletedDeclarationSelection=attemptProgramStatementSelection(strictBranchProbe,
      strictBranchDeclaration.id);
    const strictCompletedLineLocked=!strictCompletedDeclarationSelection.applied
      &&strictCompletedDeclarationSelection.ignored
      &&strictCompletedDeclarationSelection.reason==='statement-already-passed'
      &&!strictBranchProbe.practiceInvalidExecution;
    const strictLockedHost=h('div',{});renderProgramItem(strictLockedHost,strictBranchProbe,{});
    const strictEligibleAfterBranch=strictBranchProbe.program.statements
      .filter(candidate=>strictProgramStatementSelectable(strictBranchProbe,candidate)).length;
    const strictCandidateAfterBranch=countNodesWithClass(strictLockedHost,'strict-sequence-statement-candidate');
    const strictSwitchProbe=csBuildItem(profile,{id:'StrictSwitch',filename:'StrictSwitch.c',raw:csSwitchFallthroughFixture},'c',106);
    state.items=[strictSwitchProbe];state.itemIndex=0;
    dispatchProgramAction(strictSwitchProbe,statementInteractionPlan(strictSwitchProbe,
      strictSwitchProbe.program.statements[0]).action,{applyExpressionAction});
    const strictSwitchSelection=currentProgramStatement(strictSwitchProbe);
    strictSwitchSelection.runtime.workingFlat={operands:[{id:'strict-switch-result',kind:'literal',value:2}],operators:[]};
    dispatchProgramAction(strictSwitchProbe,{type:'commit-branch',statementId:strictSwitchSelection.id},{applyExpressionAction});
    const strictIncorrectCase=strictSwitchSelection.branches.find(candidate=>
      candidate.targetStatementId!==strictSwitchSelection.runtime.selectedTargetStatementId);
    const strictIncorrectCaseChoice=attemptProgramStatementSelection(strictSwitchProbe,
      strictIncorrectCase.targetStatementId);
    const strictCaseBranchContinues=strictIncorrectCaseChoice.applied&&strictIncorrectCaseChoice.branchChoice
      &&strictIncorrectCaseChoice.wasCorrect===false&&!strictSwitchProbe.practiceInvalidExecution
      &&currentProgramStatement(strictSwitchProbe).id===strictIncorrectCase.targetStatementId
      &&strictSwitchSelection.runtime.branchChoiceCorrect===false;
    const strictPrecedenceProbe=csBuildItem(profile,{id:'StrictPrecedence',filename:'StrictPrecedence.c',
      raw:csStrictPrecedenceFixture},'c',107);
    state.items=[strictPrecedenceProbe];state.itemIndex=0;
    while(currentProgramStatement(strictPrecedenceProbe).kind==='declaration'){
      const active=currentProgramStatement(strictPrecedenceProbe),plan=statementInteractionPlan(strictPrecedenceProbe,active);
      dispatchProgramAction(strictPrecedenceProbe,plan.action,{applyExpressionAction});
    }
    const strictAssignment=currentProgramStatement(strictPrecedenceProbe);
    for(const operand of strictAssignment.runtime.workingFlat.operands.slice()){
      if(operand.kind==='variable')dispatchProgramAction(strictPrecedenceProbe,
        {type:'substitute',id:operand.id,statementId:strictAssignment.id},{applyExpressionAction});
    }
    let strictFlat=strictAssignment.runtime.workingFlat;
    dispatchProgramAction(strictPrecedenceProbe,{type:'evaluate',leftId:strictFlat.operands[0].id,
      rightId:strictFlat.operands[1].id,statementId:strictAssignment.id},{applyExpressionAction});
    strictFlat=strictAssignment.runtime.workingFlat;
    dispatchProgramAction(strictPrecedenceProbe,{type:'evaluate',leftId:strictFlat.operands[0].id,
      rightId:strictFlat.operands[1].id,statementId:strictAssignment.id},{applyExpressionAction});
    const strictWrongPrecedenceRecorded=strictAssignment.runtime.trace.some(step=>step.action==='EVALUATE'&&step.wasCorrect===false);
    const strictWrongCommit=dispatchProgramAction(strictPrecedenceProbe,
      statementInteractionPlan(strictPrecedenceProbe,strictAssignment).action,{applyExpressionAction});
    const strictWrongPrecedenceContinues=strictWrongCommit.applied&&strictWrongCommit.completed
      &&!strictPrecedenceProbe.practiceInvalidExecution&&currentProgramStatement(strictPrecedenceProbe).kind==='program-return';
    const strictCompletedUndoHost=h('div',{});renderProgramItem(strictCompletedUndoHost,strictPrecedenceProbe,{});
    const strictCompletedUndoTarget=completedProgramUndoStatementId(strictPrecedenceProbe,strictPrecedenceProbe.program);
    const strictCompletedUndoControls=countNodesWithClass(strictCompletedUndoHost,'program-source-completed-undo');
    const strictRollback=undoProgramAction(strictPrecedenceProbe,{undoExpressionAction});
    const strictRollbackPlan=statementInteractionPlan(strictPrecedenceProbe,strictAssignment);
    const strictRollbackReopens=strictRollback.applied&&currentProgramStatement(strictPrecedenceProbe)===strictAssignment
      &&strictRollbackPlan.mode==='modal'&&strictRollbackPlan.focus==='expression';
    const strictRollbackHistory=strictAssignment.runtime.history.length;
    const strictRollbackStep=undoProgramAction(strictPrecedenceProbe,{undoExpressionAction});
    const strictRollbackCanCorrect=strictRollbackStep.applied
      &&strictAssignment.runtime.history.length===strictRollbackHistory-1;
    const strictBooleanProbe=csBuildItem(profile,{id:'StrictBoolean',filename:'StrictBoolean.c',
      raw:csStrictBooleanFixture},'c',108);
    state.items=[strictBooleanProbe];state.itemIndex=0;
    while(currentProgramStatement(strictBooleanProbe).kind==='declaration'){
      const active=currentProgramStatement(strictBooleanProbe),plan=statementInteractionPlan(strictBooleanProbe,active);
      dispatchProgramAction(strictBooleanProbe,plan.action,{applyExpressionAction});
    }
    const strictBoolean=currentProgramStatement(strictBooleanProbe);
    const unresolvedBooleanFlat=strictBoolean.runtime.workingFlat;
    handleTokenClick(flatExpressionAction('evaluate',{
      leftId:unresolvedBooleanFlat.operands[0].id,rightId:unresolvedBooleanFlat.operands[1].id},strictBoolean.id));
    const strictConditionPaused=!!strictBooleanProbe.practiceInvalidExecution
      &&strictBooleanProbe.practiceInvalidExecution.reason==='operands-unresolved';
    const strictConditionModalHost=h('div',{});
    renderSelectionStatement({container:strictConditionModalHost,item:strictBooleanProbe,
      program:strictBooleanProbe.program,statement:strictBoolean,
      statementIndex:strictBooleanProbe.program.cursor,isActive:true,
      services:{statementTraceModal:true,expressionOnly:true}});
    const strictConditionSourceHost=h('div',{});renderProgramItem(strictConditionSourceHost,strictBooleanProbe,{});
    const strictConditionModalWarning=countNodesWithClass(strictConditionModalHost,'invalid-execution-alert');
    const strictConditionSourceWarning=countNodesWithClass(strictConditionSourceHost,'invalid-execution-alert');
    handleUndo();
    const strictConditionRecovered=!strictBooleanProbe.practiceInvalidExecution;
    for(const operand of strictBoolean.runtime.workingFlat.operands.slice()){
      if(operand.kind==='variable')dispatchProgramAction(strictBooleanProbe,
        {type:'substitute',id:operand.id,statementId:strictBoolean.id},{applyExpressionAction});
    }
    let strictBooleanFlat=strictBoolean.runtime.workingFlat;
    const logicalIndex=strictBooleanFlat.operators.indexOf('&&');
    const strictLogicalFirst=dispatchProgramAction(strictBooleanProbe,{type:'evaluate',
      leftId:strictBooleanFlat.operands[logicalIndex].id,rightId:strictBooleanFlat.operands[logicalIndex+1].id,
      statementId:strictBoolean.id},{applyExpressionAction});
    while(!strictBoolean.runtime.checked){
      strictBooleanFlat=strictBoolean.runtime.workingFlat;
      const candidate=collectReadyOperatorsFlat(strictBooleanFlat,[])[0];
      if(!candidate)break;
      dispatchProgramAction(strictBooleanProbe,{type:'evaluate',leftId:candidate.leftId,
        rightId:candidate.rightId,statementId:strictBoolean.id},{applyExpressionAction});
    }
    const strictWrongBooleanContinues=strictLogicalFirst.applied&&strictBoolean.runtime.checked
      &&strictBoolean.runtime.trace.some(step=>step.action==='EVALUATE'&&step.target.operator==='&&'&&step.wasCorrect===false)
      &&!strictBooleanProbe.practiceInvalidExecution&&strictBooleanProbe.program.status==='running';
    const strictBooleanNext=currentProgramStatement(strictBooleanProbe);
    const strictStaleAction=flatExpressionAction('evaluate',{leftId:'stale-left',rightId:'stale-right'},strictBoolean.id);
    const strictStaleResult=dispatchProgramAction(strictBooleanProbe,strictStaleAction,{applyExpressionAction});
    const strictStaleProtected=strictStaleResult.ignored===true
      &&strictStaleAction.statementId===strictBoolean.id
      &&currentProgramStatement(strictBooleanProbe)===strictBooleanNext
      &&!strictBooleanProbe.practiceInvalidExecution;
    const strictBooleanRollback=undoProgramAction(strictBooleanProbe,{undoExpressionAction});
    const strictBooleanRollbackPlan=statementInteractionPlan(strictBooleanProbe,strictBoolean);
    const strictBooleanCanCorrect=strictBooleanRollback.applied&&strictBooleanRollbackPlan.mode==='modal'
      &&strictBooleanRollbackPlan.focus==='condition-expression'
      &&undoProgramAction(strictBooleanProbe,{undoExpressionAction}).applied;
    const strictJavaOutputProbe=csBuildItem(sourceOutputProfile,{id:'StrictJavaOutput',
      filename:'StrictJavaOutput.java',raw:csStrictJavaOutputFixture},'java',109);
    state.items=[strictJavaOutputProbe];state.itemIndex=0;
    const strictJavaDeclaration=currentProgramStatement(strictJavaOutputProbe);
    dispatchProgramAction(strictJavaOutputProbe,statementInteractionPlan(strictJavaOutputProbe,
      strictJavaDeclaration).action,{applyExpressionAction});
    const strictJavaOutput=currentProgramStatement(strictJavaOutputProbe);
    handleTokenClick({type:'emit-output',statementId:strictJavaOutput.id});
    const strictPrintPaused=!!strictJavaOutputProbe.practiceInvalidExecution
      &&strictJavaOutputProbe.practiceInvalidExecution.reason==='output-unresolved';
    const strictPrintModalHost=h('div',{});
    renderOutputStatement({container:strictPrintModalHost,item:strictJavaOutputProbe,
      program:strictJavaOutputProbe.program,statement:strictJavaOutput,statementIndex:1,isActive:true,
      services:{statementTraceModal:true}});
    const strictPrintModalWarning=countNodesWithClass(strictPrintModalHost,'invalid-execution-alert');
    const strictPrintModalReset=countNodesWithClass(strictPrintModalHost,'item-reset-control');
    const strictPrintSourceHost=h('div',{});renderProgramItem(strictPrintSourceHost,strictJavaOutputProbe,{});
    const strictPrintSourceWarning=countNodesWithClass(strictPrintSourceHost,'invalid-execution-alert');
    handleUndo();
    const strictJavaPart=programOutputDynamicParts(strictJavaOutput)[0];
    handleTokenClick({type:'resolve-output-part',partIndex:strictJavaPart.index,statementId:strictJavaOutput.id});
    const strictConcatPaused=!!strictJavaOutputProbe.practiceInvalidExecution
      &&strictJavaOutputProbe.practiceInvalidExecution.reason==='output-value-unread';
    handleUndo();
    const strictJavaOutputRecovered=!strictJavaOutputProbe.practiceInvalidExecution
      &&currentProgramStatement(strictJavaOutputProbe)===strictJavaOutput;
    strictProbe.program.statements[0].status='complete';strictProbe.program.cursor=1;
    strictProbe.program.statements[1].status='active';
    const strictTransitionSuppressed=stageSourceFlowTransition(strictProbe,strictProbe.program.statements[0])===null;
    const strictExamProbe=csBuildItem(profile,{id:'StrictExamFlow',filename:'StrictExamFlow.c',raw:csLiveControlFixture},'c',104);
    state.mode='exam';state.examPolicy=snapshotExamPolicy({exam:{interactionMode:'strict-sequence'}});
    state.items=[strictExamProbe];state.itemIndex=0;
    const strictExamWrong=attemptProgramStatementSelection(strictExamProbe,strictExamProbe.program.statements[1].id);
    const strictExamTerminated=strictExamWrong.invalid&&strictExamProbe.checked
      &&strictExamProbe.examSequenceFailure.reason==='statement-out-of-sequence'
      &&strictExamProbe.program.status==='terminated';
    state.mode='practice';state.practicePolicy=snapshotPracticePolicy({practice:{interactionMode:'guided'}});
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
    const contextDocks=countNodesWithClass(sourceHost,'program-context-main');
    const contextTabs=countNodesWithClass(sourceHost,'program-context-tab');
    const memoryDockHosts=countNodesWithClass(sourceHost,'program-memory-dock-host');
    const migratedSourceOutputTimeline=programTimelinePresentation({profileId:'program-output-source-flow'});
    const inlineDefault=programTimelinePresentation({profileId:'program-output-basics'});
    const firstStatement=first.program.statements[0],firstPlan=statementInteractionPlan(first,firstStatement);
    const selectionPlan=statementInteractionPlan(first,first.program.statements[selectionIndex]);
    const literalOutput=first.program.statements.find(candidate=>candidate.kind==='output'&&programOutputDynamicParts(candidate).length===0);
    const outputPlan=statementInteractionPlan(first,literalOutput);
    const directExecution=dispatchProgramAction(first,firstPlan.action,{applyExpressionAction});
    const attemptedSourceHost=h('div',{});renderProgramItem(attemptedSourceHost,first,{});
    const sourceItemResetControls=countNodesWithClass(attemptedSourceHost,'item-reset-control');
    const sourceWorkspace=attemptedSourceHost.children.find(child=>countNodesWithClass(child,'program-workspace')>0);
    const sourceResetInsideWorkspace=countNodesWithClass(sourceWorkspace,'item-reset-control');
    first.checked=true;
    const checkedSourceHost=h('div',{});renderProgramItem(checkedSourceHost,first,{});
    const sourceRetryBars=countNodesWithClass(checkedSourceHost,'practice-retry-bar');
    const checkedSourceResetControls=countNodesWithClass(checkedSourceHost,'item-reset-control');
    first.checked=false;
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
    const visibleViewport={scrollTop:100,scrollLeft:7,clientHeight:200,scrollCalls:[],
      scrollTo(options){this.scrollCalls.push(options);this.scrollTop=options.top;}};
    const visibleReveal=revealSourceFlowLine(visibleViewport,{offsetTop:120,offsetHeight:30},'smooth');
    const distantReveal=revealSourceFlowLine(visibleViewport,{offsetTop:360,offsetHeight:40},'smooth');
    const scrollIntentItem={_sourceFlowTransition:{userScrolled:false}};
    markSourceFlowUserScroll(scrollIntentItem,visibleViewport);
    const scrollIntentRecorded=scrollIntentItem._sourceFlowTransition.userScrolled
      &&sourceFlowViewportState(scrollIntentItem).userOverride;
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
    const branchUndoPlan=statementInteractionPlan(elseIf,branchUndoStatement);
    const branchUndoClean=branchUndoStatement.runtime.studentSelectedTargetStatementId==null
      &&branchUndoStatement.runtime.branchChoiceCorrect==null
      &&!elseIf.program.events.some(event=>event.statementId===branchUndoStatement.id
        &&(event.type==='BRANCH'||event.type==='BRANCH_CHOICE'));
    state.language='c';const migratedSourceOutputItems=generateItemsForProfile('program-output-source-flow');
    const typedItem=migratedSourceOutputItems.find(candidate=>candidate.filename==='TypedValues.c');
    initializeSeededRandom(77);const authoredRetry=regenerateProfileContentItem(sourceOutputProfile,typedItem);
    const typedOutputStatements=typedItem.program.statements.filter(candidate=>candidate.kind==='output');
    const typedCharAssignment=typedItem.program.statements.find(candidate=>candidate.kind==='assignment'
      &&candidate.target==='letter'&&candidate.runtime.expectedAfter==='B');
    typedItem.program.memory.letter={name:'letter',kind:'variable',dataType:'char',mutable:true,initialized:true,value:'B'};
    const typedMemoryText=renderVariableFinalState(typedItem).textContent;
    const typedCharCardText=renderValueCard({id:'char-test',name:'letter',value:'B',kind:'variable',dataType:'char'}).textContent;
    const typedRuntime=csBuildItem(sourceOutputProfile,{id:'TypedRuntime',filename:'TypedValues.c',raw:csTypedFixture},'c',102);
    const deferredMemoryBefore=renderVariableFinalState(typedRuntime).textContent.toLowerCase();
    const declarationPlans=[];const declarationActions=[];let deferredMemoryAfterFirst='';let deferredLiveAfterFirst=null;
    for(let count=0;count<3;count++){
      const active=typedRuntime.program.statements[typedRuntime.program.cursor],plan=statementInteractionPlan(typedRuntime,active);
      declarationPlans.push([plan.mode,plan.action&&plan.action.type]);
      declarationActions.push(dispatchProgramAction(typedRuntime,plan.action,{applyExpressionAction}).applied);
      if(count===0){
        deferredMemoryAfterFirst=renderVariableFinalState(typedRuntime).textContent.toLowerCase();
        deferredLiveAfterFirst=resolveBindingLive(ensureBindings(typedRuntime)[0],typedRuntime);
      }
    }
    const scoreInitiallyUnset=typedRuntime.program.memory.score&&!typedRuntime.program.memory.score.initialized;
    const scoreAssignment=typedRuntime.program.statements[typedRuntime.program.cursor];
    const scoreAssignmentPlan=statementInteractionPlan(typedRuntime,scoreAssignment);
    const scoreAssigned=dispatchProgramAction(typedRuntime,scoreAssignmentPlan.action,{applyExpressionAction});
    const modalOutputItem=migratedSourceOutputItems[0];
    const modalOutputStatement=modalOutputItem.program.statements.find(candidate=>candidate.kind==='output'
      &&programOutputDynamicParts(candidate).length>0);
    statementTraceModalState={item:modalOutputItem,statementId:modalOutputStatement.id,focus:'output-values'};
    const modalOutputEvent={type:'OUTPUT',statementId:modalOutputStatement.id,text:'Modal output sentinel\\n'};
    modalOutputItem.program.events.push(modalOutputEvent);
    pendingProgramTerminalAnimation={item:modalOutputItem,event:modalOutputEvent,onComplete:null};
    globalThis.requestAnimationFrame=()=>1;
    const mainOutputMirror=renderProgramTerminalPanel(modalOutputItem,modalOutputItem.program);
    const modalOutputMirror=renderProgramTerminalPanel(modalOutputItem,modalOutputItem.program,{surface:'modal'});
    const modalOutputSurface=programTerminalAnimationSurface(modalOutputItem,pendingProgramTerminalAnimation);
    pendingProgramTerminalAnimation=null;
    const memoryBinding=ensureBindings(modalOutputItem)[0];
    modalOutputItem.program.memory[memoryBinding.name]={name:memoryBinding.name,kind:memoryBinding.kind,
      initialized:true,value:314159};
    memoryBinding._modalTransferPending={statementId:modalOutputStatement.id,hasValue:false,value:undefined};
    const pendingMemoryMirror=renderStatementTraceMemory(modalOutputItem);
    delete memoryBinding._modalTransferPending;
    const settledMemoryMirror=renderStatementTraceMemory(modalOutputItem);
    statementTraceModalState=null;
    pendingProgramTerminalAnimation={item:modalOutputItem,event:modalOutputEvent,onComplete:null};
    const directOutputSurface=programTerminalAnimationSurface(modalOutputItem,pendingProgramTerminalAnimation);
    pendingProgramTerminalAnimation=null;
    initializeSeededRandom(2);state.language='java';const javaItems=generateItemsForProfile('selection-statements-source');
    const migratedJavaOutputItems=generateItemsForProfile('program-output-source-flow');
    return JSON.stringify({count:items.length,filenames:items.map(item=>item.filename),kinds,
      profileName:profile.name,profileProvider:profileContentProviderFor(profile).id,
      sourceValueMode:profileVariableValueMode(profile),timelinePresentation:profileTimelineMode(profile),
      profileItemCount:profile.scoring.itemCount,profileSelectionCount:profile.content.selection.count,
      strictExpectedCandidates,strictStatementCandidates,strictActiveRows,strictCurrentDots,strictBlockedMarkers,
      strictPracticePaused,strictPausedCandidates,strictPausedMarkers,strictPracticeRecovered,strictCorrectSelection,
      strictIfBranchContinues,strictCompletedLineLocked,strictEligibleAfterBranch,strictCandidateAfterBranch,
      strictCaseBranchContinues,strictWrongPrecedenceRecorded,
      strictWrongPrecedenceContinues,strictCompletedUndoTarget,strictCompletedUndoControls,
      strictRollbackReopens,strictRollbackCanCorrect,
      strictWrongBooleanContinues,strictStaleProtected,strictBooleanCanCorrect,
      strictConditionPaused,strictConditionModalWarning,strictConditionSourceWarning,strictConditionRecovered,
      strictPrintPaused,strictPrintModalWarning,strictPrintModalReset,strictPrintSourceWarning,
      strictConcatPaused,strictJavaOutputRecovered,
      strictTransitionSuppressed,strictExamTerminated,
      manifestVersion:CODE_SIMULATOR_PLUGIN_MANIFEST.version,sourcePanels,sourceRows,firstMemoryNames,
      sourceLineCount:first.sourceDisplay.lines.length,sourceActions,directActions,modalActions,activeSourceRows,oldTimelineRows,inlinePanels,
      contextDocks,contextTabs,memoryDockHosts,
      inlineDefault,migratedSourceOutputTimeline,
      firstPlanMode:firstPlan.mode,firstPlanAction:firstPlan.action.type,directExecution:directExecution.applied,
      sourceItemResetControls,sourceResetInsideWorkspace,sourceRetryBars,checkedSourceResetControls,
      selectionPlanMode:selectionPlan.mode,selectionPlanFocus:selectionPlan.focus,
      outputPlanMode:outputPlan.mode,outputPlanAction:outputPlan.action.type,
      expressionOnlyKeywords:countNodesWithClass(expressionOnlyHost,'selection-keyword'),
      expressionOnlyParens:countNodesWithClass(expressionOnlyHost,'selection-paren'),
      completedModalPanels:countNodesWithClass(completedModalHost,'program-expression-panel'),
      completedModalCompacts:countNodesWithClass(completedModalHost,'selection-compact'),
      transitionOrigins,transitionDestinations,transitionHighlights,transitionActiveRows,
      visibleReveal,distantReveal,scrollCalls:visibleViewport.scrollCalls,scrollIntentRecorded,
      sourceFlowTiming:DEFAULT_APP_SETTINGS.shell.sourceFlow,
      sourceProgramText:sourceHost.textContent,
      seededSources:items.map(item=>item.source),repeatSources:repeatItems.map(item=>item.source),
      changedSources:changedItems.map(item=>item.source),seedMaps:items.map(item=>item.sourceSeedValues),
      retrySeededFilename:retrySeededA.filename,retrySeededA:retrySeededA.sourceSeedValues,retrySeededB:retrySeededB.sourceSeedValues,
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
      mixedKinds:mixedStatements.statements.map(candidate=>candidate.kind),
      mixedFinalValue:mixedStatements.memory.total,
      taskPapaSumValue:taskPapaSum.runtime.expectedValue,
      taskPapaSumEffects:taskPapaSum.runtime.expectedEffects.filter(effect=>effect.kind==='write')
        .map(effect=>[effect.target,effect.previousValue,effect.nextValue,effect.form]),
      taskPapaFinalMemory:{p:taskPapa.memory.p,q:taskPapa.memory.q,sum:taskPapa.memory.sum},
      outputOnlyKinds:outputOnly.statements.map(candidate=>candidate.kind),
      switchFallthroughKinds:switchFallthrough.statements.map(candidate=>candidate.kind),
      switchBreakLines:switchFallthrough.sourceDisplay.lines.filter(line=>line.text.trim()==='break;'&&line.supported).length,
      switchFallthroughPath:fallthroughPath,
      outputOnlyDeclarations:outputOnly.declarations.length,
      outputOnlyContextMuted:outputOnly.sourceDisplay.lines.some(line=>line.text.includes('puts(')&&!line.supported),
      outputOnlyItemStatements:outputOnlyItem.program.statements.map(candidate=>candidate.kind),
      dynamicSelectionExpected:dynamicSelection.runtime.expectedValue,
      dynamicOutputExpected:dynamicOutput.runtime.parts[dynamicOutputPart.index].expectedValue,
      liveKinds:liveControl.statements.map(candidate=>candidate.kind),
      liveEdges:Object.fromEntries(liveControl.statements.map(candidate=>[candidate.id,candidate.kind==='selection'
        ?candidate.branches.map(branch=>branch.nextStatementId):candidate.nextStatementId])),
      undeclaredError,derivedError,badRangeError,duplicateError,unsupportedOnlyError,
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
      branchUndoPlan:[branchUndoPlan.mode,branchUndoPlan.focus],branchUndoClean,
      switchCases:items[3].program.statements.find(candidate=>candidate.kind==='selection').branches.length,
      switchBreakCount:switchBreaks.length,
      switchBreakSources:switchItem.sourceDisplay.lines.filter(line=>line.text.trim()==='break;'),
      switchBreakTargets:switchBreaks.map(statement=>statement.nextStatementId),
      breakPlanMode:breakPlan.mode,breakPlanAction:breakPlan.action&&breakPlan.action.type,
      breakApplied:breakResult.applied,breakEvent:breakProbe.program.events[0],breakCursor:breakProbe.program.cursor,
      allBranchTargets:items.every(item=>item.program.statements.filter(candidate=>candidate.kind==='selection')
        .every(candidate=>candidate.branches.every(row=>row.targetStatementId))),
      javaCount:javaItems.length,javaLanguage:javaItems[0].language,
      javaSeeded:javaItems.every(item=>Object.keys(item.sourceSeedValues).length>0),
      javaSwitchBreakCount:javaItems[3].program.statements.filter(candidate=>candidate.kind==='program-break').length,
      javaSwitchBreakTargets:javaItems[3].program.statements.filter(candidate=>candidate.kind==='program-break')
        .map(candidate=>candidate.nextStatementId),
      javaReturnCounts:javaItems.map(item=>item.program.statements.filter(candidate=>candidate.kind==='program-return').length),
      sourceOutputProvider:profileContentProviderFor(sourceOutputProfile).id,
      sourceOutputLibrary:profileContentSource(sourceOutputProfile).library,
      sourceOutputValueMode:profileVariableValueMode(sourceOutputProfile),
      sourceLibraryUrl:csManifestUrl({id:'source-library',content:{source:{
        library:'source-programs',exerciseSet:'formatted-output'}}},'c'),
      modalOutputSurface,directOutputSurface,
      mainOutputIncludesPending:mainOutputMirror.textContent.includes('Modal output sentinel'),
      modalOutputWithholdsPending:!modalOutputMirror.textContent.includes('Modal output sentinel'),
      pendingMemoryText:pendingMemoryMirror.textContent,settledMemoryText:settledMemoryMirror.textContent,
      modalMemoryBindingName:memoryBinding.name,
      migratedSourceOutputFilenames:migratedSourceOutputItems.map(item=>item.filename),
      typedKinds:typedItem.program.statements.map(candidate=>candidate.kind),
      typedTypes:typedItem.decls.map(binding=>binding.dataType),
      typedInitialized:typedItem.decls.map(binding=>binding.initialized),
      typedFinalMemory:{score:typedItem.correctFinalValue,price:typedItem.program.statements
        .find(candidate=>candidate.kind==='output'&&candidate.sourceText.includes('Updated price')).runtime.parts
        .find(part=>part.expectedValue!==null).expectedValue,
        letter:typedItem.program.statements.find(candidate=>candidate.kind==='output'&&candidate.sourceText.includes('Updated letter')).runtime.parts
          .find(part=>part.expectedValue!==null).expectedValue,
        bonus:typedItem.decls.find(binding=>binding.name==='bonus').value},
      typedFormats:typedOutputStatements.flatMap(statement=>statement.parts.filter(part=>part.kind==='expression').map(part=>part.format)),
      typedCharAssignmentText:flatToString(typedCharAssignment.runtime.workingFlat),
      typedMemoryText,typedCharCardText,typedScreenValue:programOutputFormatValue('B','c'),
      authoredRetrySameFile:authoredRetry.filename===typedItem.filename,authoredRetrySameSource:authoredRetry.source===typedItem.source,
      typedExpectedOutput:typedOutputStatements.map(statement=>programOutputStatementText(statement,true)).join(''),
      declarationPlans,declarationActions,scoreInitiallyUnset,
      deferredMemoryBefore,deferredMemoryAfterFirst,deferredLiveAfterFirst,
      scoreAssignmentPlan:[scoreAssignmentPlan.mode,scoreAssignmentPlan.action&&scoreAssignmentPlan.action.type],
      scoreAssigned:scoreAssigned.applied,scoreMemoryAfterAssignment:typedRuntime.program.memory.score,
      migratedSourceOutputKinds:migratedSourceOutputItems[0].program.statements.map(candidate=>candidate.kind),
      migratedSourceOutputHasSynthetic:migratedSourceOutputItems.some(item=>item.program.statements.some(candidate=>candidate.kind==='legacy-expression')),
      migratedJavaOutputFilenames:migratedJavaOutputItems.map(item=>item.filename),
      migratedJavaReturnCounts:migratedJavaOutputItems.map(item=>item.program.statements.filter(candidate=>candidate.kind==='program-return').length),
      basicOutputFilenames:basicOutputItems.map(item=>item.filename),
      taskGolphKinds:taskGolph.program.statements.map(candidate=>candidate.kind),
      taskGolphStatus:taskGolph.program.status,taskGolphText:taskGolphTerminal.text,
      taskGolphCursor:[taskGolphTerminal.row,taskGolphTerminal.column],
      serializable:!!JSON.parse(JSON.stringify(items[2])).program});
  })()`));
  assert.strictEqual(result.count,4);
  assert.deepStrictEqual(result.filenames,['IfStatement.c','IfElse.c','ElseIfChain.c','SwitchCase.c']);
  assert.deepStrictEqual(result.kinds,[['if'],['if'],['if','else-if','else-if'],['switch']]);
  assert.strictEqual(result.profileName,'Code Simulator');
  assert.strictEqual(result.profileProvider,'code-simulator');
  assert.strictEqual(result.sourceValueMode,'seeded');
  assert.strictEqual(result.timelinePresentation,'statement-modal');
  assert.strictEqual(result.profileItemCount,'manifest');
  assert.strictEqual(result.profileSelectionCount,'all');
  assert.strictEqual(result.strictStatementCandidates,result.strictExpectedCandidates);
  assert.strictEqual(result.strictActiveRows,0);
  assert.strictEqual(result.strictCurrentDots,0);
  assert.strictEqual(result.strictBlockedMarkers,0);
  assert(result.strictPracticePaused&&result.strictPracticeRecovered&&result.strictCorrectSelection);
  assert.strictEqual(result.strictPausedCandidates,result.strictExpectedCandidates);
  assert.strictEqual(result.strictPausedMarkers,result.strictExpectedCandidates);
  assert(result.strictIfBranchContinues&&result.strictCaseBranchContinues);
  assert(result.strictCompletedLineLocked);
  assert.strictEqual(result.strictCandidateAfterBranch,result.strictEligibleAfterBranch);
  assert(result.strictWrongPrecedenceRecorded&&result.strictWrongPrecedenceContinues
    &&result.strictRollbackReopens&&result.strictRollbackCanCorrect);
  assert.strictEqual(result.strictCompletedUndoTarget,'assignment-1');
  assert.strictEqual(result.strictCompletedUndoControls,1);
  assert(result.strictWrongBooleanContinues&&result.strictStaleProtected&&result.strictBooleanCanCorrect);
  assert(result.strictConditionPaused&&result.strictConditionRecovered);
  assert.strictEqual(result.strictConditionModalWarning,1);
  assert.strictEqual(result.strictConditionSourceWarning,1);
  assert(result.strictPrintPaused&&result.strictConcatPaused&&result.strictJavaOutputRecovered);
  assert.strictEqual(result.strictPrintModalWarning,1);
  assert.strictEqual(result.strictPrintModalReset,0);
  assert.strictEqual(result.strictPrintSourceWarning,1);
  assert(result.strictTransitionSuppressed&&result.strictExamTerminated);
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
  assert.strictEqual(result.contextDocks,1);
  // This isolated harness does not load var-final-float.js, so it exercises
  // the Output side of the shared dock; memory mounting is asserted above.
  assert.strictEqual(result.contextTabs,1);
  assert.strictEqual(result.memoryDockHosts,0);
  assert.strictEqual(result.inlineDefault,'inline');
  assert.strictEqual(result.migratedSourceOutputTimeline,'statement-modal');
  assert.strictEqual(result.firstPlanMode,'direct');
  assert.strictEqual(result.firstPlanAction,'commit-assignment');
  assert(result.directExecution);
  assert.strictEqual(result.sourceItemResetControls,1);
  assert.strictEqual(result.sourceResetInsideWorkspace,0);
  assert.strictEqual(result.sourceRetryBars,1);
  assert.strictEqual(result.checkedSourceResetControls,0);
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
  assert.strictEqual(result.visibleReveal,false);
  assert.strictEqual(result.distantReveal,true);
  assert.deepStrictEqual(result.scrollCalls,[{top:200,left:7,behavior:'smooth'}]);
  assert(result.scrollIntentRecorded);
  assert(!renderSessionSource.includes("destination.scrollIntoView({behavior:'smooth'"));
  assert(renderSessionSource.includes("next.focus({preventScroll:true})"));
  assert(result.sourceFlowTiming.resultHoldMs>=800&&result.sourceFlowTiming.movementDurationMs>=1000
    &&result.sourceFlowTiming.modalCloseSettleMs>=250);
  assert(result.sourceProgramText.includes('#include <stdio.h>')&&result.sourceProgramText.includes('int main() {')
    &&result.sourceProgramText.includes('return 0;')&&result.sourceProgramText.includes('IfStatement.c'));
  assert.strictEqual(result.manifestVersion,'3.0.0');
  assert.deepStrictEqual(result.seededSources,result.repeatSources);
  assert.notDeepStrictEqual(result.seededSources,result.changedSources);
  assert.strictEqual(result.retrySeededFilename,result.filenames[0]);
  assert.notDeepStrictEqual(result.retrySeededA,result.retrySeededB);
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
  assert.deepStrictEqual(result.mixedKinds,['declaration','assignment','unary-update','output','program-return']);
  assert.strictEqual(result.mixedFinalValue,6);
  assert.strictEqual(result.taskPapaSumValue,9);
  assert.deepStrictEqual(result.taskPapaSumEffects,[['p',4,5,'prefix'],['q',4,5,'postfix']]);
  assert.deepStrictEqual(result.taskPapaFinalMemory,{p:5,q:5,sum:9});
  assert.deepStrictEqual(result.outputOnlyKinds,['output','program-return']);
  assert.strictEqual(result.outputOnlyDeclarations,0);
  assert(result.outputOnlyContextMuted);
  assert.deepStrictEqual(result.outputOnlyItemStatements,result.outputOnlyKinds);
  assert.strictEqual(result.dynamicSelectionExpected,false);
  assert.strictEqual(result.dynamicOutputExpected,42);
  assert.strictEqual(result.sourceOutputProvider,'code-simulator');
  assert.strictEqual(result.sourceOutputLibrary,'source-programs');
  assert.strictEqual(result.sourceLibraryUrl,'exercise-libraries/source-programs/c/formatted-output/manifest.json');
  assert.strictEqual(result.sourceOutputValueMode,'authored');
  assert.strictEqual(result.modalOutputSurface,'modal');
  assert.strictEqual(result.directOutputSurface,'main');
  assert(result.mainOutputIncludesPending&&result.modalOutputWithholdsPending);
  assert(result.pendingMemoryText.includes(result.modalMemoryBindingName)&&result.pendingMemoryText.includes('—'));
  assert(result.settledMemoryText.includes(result.modalMemoryBindingName)&&result.settledMemoryText.includes('314159'));
  assert.deepStrictEqual(result.migratedSourceOutputFilenames,
    ['BasicValues.c','MultipleValues.c','EmbeddedLines.c','NoTrailingNewline.c','AssignmentThenOutput.c','TypedValues.c']);
  assert.strictEqual(result.typedKinds.length,19);
  assert.deepStrictEqual(result.typedKinds.slice(0,6),['declaration','declaration','declaration','assignment','assignment','assignment']);
  assert.deepStrictEqual(result.typedKinds.slice(-4),['declaration','assignment','output','program-return']);
  assert.deepStrictEqual(result.typedTypes,['int','float','char','int']);
  assert.deepStrictEqual(result.typedInitialized,[false,false,false,true]);
  assert.deepStrictEqual(result.typedFinalMemory,{score:95,price:12,letter:'A',bonus:90});
  assert.deepStrictEqual(result.typedFormats,['d','.2f','c','d','.2f','c','d']);
  assert.strictEqual(result.typedCharAssignmentText,"'B'");
  assert(result.typedMemoryText.includes("'B'")&&result.typedCharCardText.includes("'B'"));
  assert.strictEqual(result.typedScreenValue,'B');
  assert(result.authoredRetrySameFile&&result.authoredRetrySameSource);
  assert.strictEqual(result.typedExpectedOutput,
    'Initial score: 75\nInitial price: 9.50\nInitial letter: B\nUpdated score: 90\nUpdated price: 12.00\nUpdated letter: A\nFinal score: 95\n');
  assert.deepStrictEqual(result.declarationPlans,[['direct','declare-binding'],['direct','declare-binding'],['direct','declare-binding']]);
  assert(result.declarationActions.every(Boolean)&&result.scoreInitiallyUnset);
  assert(!result.deferredMemoryBefore.includes('score')&&!result.deferredMemoryBefore.includes('price')
    &&!result.deferredMemoryBefore.includes('letter'));
  assert(result.deferredMemoryAfterFirst.includes('score')&&!result.deferredMemoryAfterFirst.includes('price')
    &&!result.deferredMemoryAfterFirst.includes('letter'));
  assert(result.deferredLiveAfterFirst.visible&&result.deferredLiveAfterFirst.committed
    &&result.deferredLiveAfterFirst.insertOnly&&!result.deferredLiveAfterFirst.hasValue);
  assert.deepStrictEqual(result.scoreAssignmentPlan,['direct','commit-assignment']);
  assert(result.scoreAssigned&&result.scoreMemoryAfterAssignment.initialized&&result.scoreMemoryAfterAssignment.value===75);
  assert.deepStrictEqual(result.migratedSourceOutputKinds,
    ['declaration','declaration','declaration','output','output','output','output','program-return']);
  assert.strictEqual(result.migratedSourceOutputHasSynthetic,false);
  assert.deepStrictEqual(result.migratedJavaOutputFilenames,
    ['BasicValues.java','MultipleValues.java','EmbeddedLines.java','NoTrailingNewline.java','AssignmentThenOutput.java','TypedValues.java']);
  assert(result.migratedJavaReturnCounts.every(count=>count===0));
  assert.deepStrictEqual(result.basicOutputFilenames,
    ['TaskAlpha.c','TaskBravo.c','TaskCharlie.c','TaskDelta.c','TaskEcho.c','TaskFoxtrot.c','TaskGolph.c']);
  assert.deepStrictEqual(result.taskGolphKinds,
    ['output','output','output','output','output','output','program-return']);
  assert.strictEqual(result.taskGolphStatus,'complete');
  assert.strictEqual(result.taskGolphText,
    'Learning escape characters in C\nShe said, "C programming is fun!"\nIt\'s time to practice.\nFile path: C:\\Programs\\C\nLoading Done!\n');
  assert.deepStrictEqual(result.taskGolphCursor,[5,0]);
  assert(result.unsupportedOnlyError.includes('no supported executable statements'));
  assert.deepStrictEqual(result.liveKinds,['declaration','selection','output','output','selection','output','output','program-return']);
  assert.deepStrictEqual(result.liveEdges['selection-1'],['output-1','output-2']);
  assert.strictEqual(result.liveEdges['output-1'],'output-2');
  assert.strictEqual(result.liveEdges['output-2'],'selection-2');
  assert.deepStrictEqual(result.liveEdges['selection-2'],['output-3','output-4']);
  assert.strictEqual(result.liveEdges['output-3'],'output-4');
  assert.strictEqual(result.liveEdges['output-4'],'program-return');
  assert(result.branchUndo&&result.branchUndoClean);
  assert.deepStrictEqual(result.branchUndoPlan,['modal','condition-expression']);
  assert(result.undeclaredError.includes("undeclared binding 'missing'"));
  assert(result.derivedError.includes("requires an integer literal initializer"));
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
  assert(result.switchBreakCount>0&&result.switchBreakSources.length===result.switchBreakCount
    &&result.switchBreakSources.every(line=>line.supported));
  assert(result.switchBreakTargets.every(target=>target==='program-return'));
  assert.strictEqual(result.breakPlanMode,'direct');
  assert.strictEqual(result.breakPlanAction,'break-control');
  assert(result.breakApplied&&result.breakEvent.type==='BREAK'&&result.breakCursor===1);
  assert.strictEqual(result.switchBreakLines,2);
  assert.deepStrictEqual(result.switchFallthroughPath.map(step=>step.kind),['output','output','program-break','output']);
  assert(result.switchFallthroughPath[0].source.includes('Two')&&result.switchFallthroughPath[1].source.includes('Three')
    &&result.switchFallthroughPath[2].source==='break;'&&result.switchFallthroughPath[3].source.includes('After'));
  assert(result.switchFallthroughKinds.includes('program-break'));
  assert(result.allBranchTargets);
  assert(result.javaCount===4&&result.javaLanguage==='java'&&result.javaSeeded&&result.serializable);
  assert.strictEqual(result.javaSwitchBreakCount,3);
  assert.deepStrictEqual(result.javaSwitchBreakTargets,['$end','$end','$end']);
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
  assert(selectionStyles.includes('.statement-trace-layout{display:grid;grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)'));
  assert(selectionStyles.includes('.statement-trace-context{position:sticky;top:0;z-index:35;display:grid;grid-template-columns:repeat(2'));
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

function testProgramInputPlugin(){
  const inputRendererSource=fs.readFileSync(path.join(ROOT,'plugins','program-input','renderer.js'),'utf8');
  const inputStyles=fs.readFileSync(path.join(ROOT,'plugins','program-input','styles.css'),'utf8');
  const connectorSource=fs.readFileSync(path.join(ROOT,'js','connector-lines.js'),'utf8');
  const ctx=context();installFakeDom(ctx);
  load(ctx,['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js','language.js',
    'program-ir.js','language-core.js','expression-parser.js','expression-semantics.js','output-statement-core.js','input-statement-core.js','selection-statement-core.js','loop-statement-core.js','statement-parser.js','statement-semantics.js','program-parser.js','source-program-pipeline.js','program-core.js','legacy-expression-plugin.js','declaration-statement-plugin.js',
    'assignment-statement-plugin.js','program-return.js','program-break.js','activity-core.js','source-library-registry.js']);
  loadRelative(ctx,['exercise-libraries/source-programs/library.js','plugins/program-output/manifest.js','plugins/program-output/statement.js',
    'plugins/program-input/manifest.js','plugins/program-input/parser.js','plugins/program-input/statement.js']);
  load(ctx,['program-item-builder.js']);
  loadRelative(ctx,['plugins/program-output/content.js','plugins/code-simulator/manifest.js',
    'plugins/code-simulator/statement.js','plugins/code-simulator/content.js']);
  load(ctx,['state.js','manual-response.js','dom-helpers.js','program-terminal.js','var-final-state.js','render-tree.js','render-flat.js','render-declaration.js',
    'render-assignment.js','render-unary-update.js','render-session.js']);
  loadRelative(ctx,['plugins/program-output/renderer.js','plugins/program-input/renderer.js','plugins/code-simulator/renderer.js']);
  for(const language of ['c','java']){
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,'input-basics');
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    ctx.inputManifest=manifest;ctx.inputRows=rows;
    evaluate(ctx,`csInstallExerciseBank('exercise-libraries/source-programs/${language}/input-basics/manifest.json',
      '${language}','input-basics',inputManifest,inputRows)`);
  }
  const result=JSON.parse(evaluate(ctx,`(()=>{
    const profile=PROFILES.find(candidate=>candidate.id==='program-input-source-flow');
    const category=PROFILE_CATEGORIES.find(candidate=>candidate.id==='input-statements');
    state.language='c';initializeSeededRandom(41);const seeded=generateItemsForProfile(profile.id)[0];
    initializeSeededRandom(41);const repeated=generateItemsForProfile(profile.id)[0];
    initializeSeededRandom(82);const changed=generateItemsForProfile(profile.id)[0];
    const cInput=seeded.program.statements.find(statement=>statement.kind==='input');
    const isolated=programInputStatement({id:'input-test',inputSyntax:'c',readerName:'scanf',format:'%d %d %d',
      rawInput:'4 7 2',reads:[
        {target:'x',dataType:'int',conversion:'d',expectedRaw:'4',expectedValue:4},
        {target:'y',dataType:'int',conversion:'d',expectedRaw:'7',expectedValue:7},
        {target:'z',dataType:'int',conversion:'d',expectedRaw:'2',expectedValue:2}
      ]});
    const program=createProgram([isolated],{language:'c'}),item={checked:false,program};
    const plugin=statementPluginFor(isolated);
    const apply=action=>{const result=plugin.applyAction({statement:isolated,program,item,action});
      if(result.event)program.events.push(result.event);return result;};
    const start=apply({type:'start-input'});
    const earlyEnter=apply({type:'submit-input'});
    const consoleBefore=renderProgramTerminalPanel(item,program,{surface:'main'});
    isolated.runtime.playbackComplete=true;
    const submit=apply({type:'submit-input'});
    const postSubmitReads=isolated.runtime.reads.map(read=>({tokenRead:read.tokenRead,converted:read.converted,written:read.written}));
    const postSubmitTrace=isolated.runtime.trace.map(step=>step.action);
    const beforeWrites=Object.keys(program.memory);
    const prematureWrite=apply({type:'write-input',readIndex:0});
    isolated.runtime.transferComplete=true;
    isolated.runtime.history[isolated.runtime.history.length-1].transferComplete=true;
    for(let index=0;index<3;index++){
      apply({type:'write-input',readIndex:index});
    }
    const consoleAfter=renderProgramTerminalPanel(item,program,{surface:'main'});isolated.status='complete';
    const timelineHost=h('div',{});renderInputStatement({container:timelineHost,item,program,statement:isolated,
      statementIndex:0,isActive:false});
    state.language='java';initializeSeededRandom(41);const javaItem=generateItemsForProfile(profile.id)[0];
    return JSON.stringify({profileId:profile.id,categoryProfiles:category.profileIds,inputMode:profileInputValueMode(profile),
      cKinds:seeded.program.statements.map(statement=>statement.kind),cReads:cInput.reads.length,cRaw:cInput.rawInput,
      sourceInputValues:seeded.sourceInputValues,repeatInputValues:repeated.sourceInputValues,changedInputValues:changed.sourceInputValues,
      start:start.applied,earlyEnter:earlyEnter.applied,
      keyboardIndicators:countNodesWithClass(consoleBefore,'program-input-keyboard-indicator'),
      enterKeys:countNodesWithClass(consoleBefore,'program-input-enter-key'),beforeWrites,submit:submit.applied,
      postSubmitReads,postSubmitTrace,
      prematureWrite:prematureWrite.applied,consoleTokens:countNodesWithClass(consoleAfter,'program-input-console-token'),
      eventTypes:program.events.map(event=>event.type),memory:Object.fromEntries(Object.entries(program.memory).map(([name,row])=>[name,row.value])),
      consoleText:consoleAfter.textContent,checked:isolated.runtime.checked,
      wasCorrectAssignment:isolated.runtime.wasCorrectAssignment,
      timelineRows:countNodesWithClass(timelineHost,'tl-row'),
      javaKinds:javaItem.program.statements.map(statement=>statement.kind),
      javaInputs:javaItem.program.statements.filter(statement=>statement.kind==='input').map(statement=>statement.reads[0].target),
      manifestCapabilities:PROGRAM_INPUT_PLUGIN_MANIFEST.capabilities,codeDependencies:CODE_SIMULATOR_PLUGIN_MANIFEST.dependencies});
  })()`));
  assert.strictEqual(result.profileId,'program-input-source-flow');
  assert.deepStrictEqual(result.categoryProfiles,['program-input-source-flow']);
  assert.strictEqual(result.inputMode,'seeded');
  assert(result.cKinds.includes('input')&&result.cReads===3&&/^\d+ \d+ \d+$/.test(result.cRaw));
  assert.deepStrictEqual(result.sourceInputValues,result.repeatInputValues);
  assert.notDeepStrictEqual(result.sourceInputValues,result.changedInputValues);
  assert(result.start&&!result.earlyEnter&&result.keyboardIndicators===1&&result.enterKeys===1);
  assert.deepStrictEqual(result.beforeWrites,[]);
  assert.strictEqual(result.prematureWrite,false);
  assert.deepStrictEqual(result.postSubmitReads,[
    {tokenRead:true,converted:true,written:false},
    {tokenRead:true,converted:true,written:false},
    {tokenRead:true,converted:true,written:false}
  ]);
  assert.deepStrictEqual(result.postSubmitTrace,['CALL_INPUT','CONVERT_INPUT_BATCH']);
  assert(result.submit&&result.checked&&result.wasCorrectAssignment);
  assert.strictEqual(result.consoleTokens,3);
  assert.deepStrictEqual(result.eventTypes,['INPUT','INPUT_WRITE','INPUT_WRITE','INPUT_WRITE']);
  assert.deepStrictEqual(result.memory,{x:4,y:7,z:2});
  assert(result.consoleText.includes('4 7 2')&&result.consoleText.includes('Program Console'));
  assert(result.timelineRows>=5);
  assert.deepStrictEqual(result.javaInputs,['x','y','z']);
  assert(result.javaKinds.filter(kind=>kind==='input').length===3);
  assert(result.manifestCapabilities.includes('typed-input'));
  assert(result.manifestCapabilities.includes('keyboard-indicator'));
  assert(result.manifestCapabilities.includes('persistent-enter-control'));
  assert(result.codeDependencies.includes('language-core:input-statements'));
  assert(result.codeDependencies.includes('program-input:timeline-presentation'));
  assert(inputRendererSource.includes('runVarFinalComet(sources[index].getBoundingClientRect()'));
  assert(inputRendererSource.includes('function programInputWriteToMemory(statement,index,button,attempt=0)'));
  assert(inputRendererSource.includes('runVarFinalComet(source.getBoundingClientRect(),destination.getBoundingClientRect()'));
  assert(inputRendererSource.indexOf("const commit=()=>handleTokenClick({type:'write-input'")
    <inputRendererSource.indexOf('runVarFinalComet(source.getBoundingClientRect(),destination.getBoundingClientRect()'));
  assert(inputRendererSource.includes("entry.addressRequired?'&':''"));
  assert(!inputRendererSource.includes('program-input-target-name'));
  assert(inputRendererSource.includes('paintPreview(raw.slice(0,index))'));
  assert(inputRendererSource.includes('programInputPlaybackTimer=setTimeout(typeCharacter,260)'));
  assert(!inputRendererSource.includes("const keys=['1','2','3'"));
  assert(inputStyles.includes('.program-input-placeholder-spinner'));
  assert(inputStyles.includes('.program-input-console-token'));
  assert(inputStyles.includes('.program-input-keyboard-indicator'));
  assert(inputStyles.includes('.program-input-enter-key.is-pressed'));
  assert(inputRendererSource.includes('function programInputFinishedConnectorVisuals(panel,statement)'));
  assert(inputRendererSource.includes("path.setAttribute('stroke-dasharray','3 4')"));
  assert(inputRendererSource.includes('data-input-written-indices'));
  assert(inputStyles.includes('.program-input-connected-row'));
  assert(connectorSource.includes("statement.kind==='input'&&typeof programInputFinishedConnectorVisuals==='function'"));
}

testExerciseLibraryRegistry();
testProfileCategoriesAndScopedScores();
testModeScopedPersistence();
testProgramOutputStatementPlugin();
testCodeSimulatorPlugin();
testProgramInputPlugin();
run();
