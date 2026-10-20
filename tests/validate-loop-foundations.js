const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const context=vm.createContext({console,structuredClone:global.structuredClone,setTimeout(){return 1;},clearTimeout(){}});
function load(relative){const filename=path.join(ROOT,relative);vm.runInContext(fs.readFileSync(filename,'utf8'),context,{filename});}
function evaluate(source){return vm.runInContext(source,context);}
function loopBodyLines(raw){
  const lines=String(raw).split(/\r?\n/);
  const open=lines.findIndex(line=>/^\s*(?:while\s*\(|for\s*\(|do\s*\{)/.test(line));
  assert(open>=0,'loop opening must be present');
  const indent=(lines[open].match(/^\s*/)||[''])[0];
  const close=lines.findIndex((line,index)=>index>open&&new RegExp('^'+indent.replace(/ /g,'\\s')+'\\}').test(line));
  assert(close>open,'loop closing must be present');
  return lines.slice(open+1,close).map(line=>line.trim());
}
[
  'js/engine.js','js/flat-model.js','js/template-engine.js','js/profile-vocabulary.js','js/generator.js',
  'js/program-ir.js','js/language-core.js','js/expression-parser.js','js/expression-semantics.js',
  'js/output-statement-core.js','js/input-statement-core.js','js/selection-statement-core.js',
  'js/loop-statement-core.js','js/statement-parser.js','js/statement-semantics.js','js/program-parser.js',
  'js/source-program-pipeline.js'
].forEach(load);

const set=JSON.parse(fs.readFileSync(path.join(ROOT,'profile-sets','c-java-loop-foundations.json'),'utf8'));
assert.strictEqual(set.id,'c-java-loop-foundations');
assert.deepStrictEqual(set.session.availableLanguages,['c','java']);
assert.strictEqual(set.categories.length,3);
assert.strictEqual(set.profiles.length,12);
context.loopProfiles=set.profiles;
const validation=JSON.parse(evaluate(`(()=>{const finalized=loopProfiles.map(finalizeProfile);validateProfiles(finalized);
  return JSON.stringify(finalized.map(profile=>({id:profile.id,itemCount:profile.itemCount,
    flowTrail:!!(profile.presentation&&profile.presentation.flowTrail)})));})()`));
assert.strictEqual(new Set(validation.map(row=>row.id)).size,12);
assert(validation.filter(row=>row.id.includes('-trace-')).every(row=>row.flowTrail));

const topics=['loop-while-basics','loop-do-while-basics','loop-for-basics','loop-counters-accumulators'];
const profileById=new Map(set.profiles.map(profile=>[profile.meta.id,profile]));
set.profiles.forEach(profile=>{
  assert.strictEqual(profile.content.values.variables,'seeded',profile.meta.id+' variable values');
  assert.strictEqual(profile.content.values.input,'seeded',profile.meta.id+' input values');
});
for(const topic of topics){
  const suffix=topic.replace(/^loop-/,'');
  const references=[
    profileById.get('foundations-trace-'+suffix).content.source.exerciseSet,
    profileById.get('foundations-simulate-'+suffix).activity.generator.exerciseSet,
    profileById.get('foundations-order-'+suffix).activity.generator.exerciseSet
  ];
  assert.deepStrictEqual(references,[topic,topic,topic],topic+' must share one source bank');
}

let files=0,frames=0,repeatingPrograms=0;
for(const language of ['c','java']){
  for(const topic of topics){
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,topic);
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    assert.strictEqual(manifest.exercises.length,11,language+'/'+topic+' item count');
    assert.strictEqual(new Set(manifest.exercises).size,11,language+'/'+topic+' duplicates');
    const extension=language==='c'?'.c':'.java';
    if(topic==='loop-while-basics')assert.strictEqual(manifest.exercises[0],'RepeatMessage'+extension);
    if(topic==='loop-do-while-basics')assert(manifest.exercises.slice(0,2).includes('RepeatMessage'+extension));
    if(topic==='loop-for-basics')assert.strictEqual(manifest.exercises[0],'RepeatCharacter'+extension);
    for(const filename of manifest.exercises){
      const raw=fs.readFileSync(path.join(directory,filename),'utf8');
      assert(loopBodyLines(raw).length>=1,
        language+'/'+topic+'/'+filename+' needs an executable statement in its loop body');
      assert(!/body (?:begins|ends)/.test(raw),
        language+'/'+topic+'/'+filename+' must use contextual rather than generic output');
      context.loopRaw=raw;context.loopFilename=filename;context.loopLanguage=language;
      const result=JSON.parse(evaluate(`(()=>{const details=sourceProgramMetadataAndSource(loopRaw,loopFilename);
        const choose=(min,max)=>Math.floor((min+max)/2);
        const parsed=sourceProgramParseExercise({details,filename:loopFilename,language:loopLanguage,
          sourceValueMode:'seeded',randomInteger:choose,inputValues:{}});
        const answer=sourceProgramGenerateAnswer(parsed,loopFilename,{allowDiagnostics:true});
        const executionFrames=parsed.coreProgramResult.ir.metadata.executionFrames||[];
        return JSON.stringify({diagnostics:parsed.coreProgramResult.diagnostics,
          loopKinds:parsed.coreProgramResult.ir.statements.filter(statement=>statement.kind==='loop').map(statement=>statement.loopKind),
          output:answer.output,variables:answer.variables.length,frames:executionFrames.length,
          uniqueStatements:new Set(executionFrames.map(frame=>frame.statementId)).size});})()`));
      assert.deepStrictEqual(result.diagnostics,[],language+'/'+topic+'/'+filename+' diagnostics');
      assert(result.loopKinds.length>0,language+'/'+topic+'/'+filename+' has loop');
      assert(result.output.length>0,language+'/'+topic+'/'+filename+' has output');
      if(/^RepeatMessage\./.test(filename))assert((result.output.match(/Hello, loop!/g)||[]).length>=2,
        language+'/'+topic+'/'+filename+' repeats the same message');
      if(/^RepeatCharacter\./.test(filename))assert((result.output.match(/^\*$/gm)||[]).length>=2,
        language+'/'+topic+'/'+filename+' repeats the same character');
      assert(result.variables>0,language+'/'+topic+'/'+filename+' has variables');
      if(result.frames>result.uniqueStatements)repeatingPrograms++;
      files++;frames+=result.frames;
    }
  }
}
assert(repeatingPrograms>=70,'most foundation programs should execute at least one repeated source line');

context.registerProfileContentProvider=provider=>provider;
context.CODE_SIMULATOR_PLUGIN_MANIFEST={id:'code-simulator'};
context.profileContentSource=profile=>profile.content.source;
context.profileVariableValueMode=()=> 'seeded';
context.profileInputValueMode=()=> 'authored';
context.programInputValueMode=()=> 'authored';
context.profileScoresStatementCommits=()=>true;
context.exerciseLibrarySlug=value=>value;
context.resolveExerciseManifestUrl=()=>'';
context.poContentSlug=value=>value;
context.poValidateManifest=value=>value;
context.poExpressionSymbols=(memory,kinds,dataTypes)=>Object.fromEntries([...new Set([
  ...Object.keys(memory||{}),...Object.keys(kinds||{})
])].map(name=>{const entry=memory&&memory[name];const binding=entry&&typeof entry==='object'
  &&Object.prototype.hasOwnProperty.call(entry,'value')?entry:null;const kind=kinds&&kinds[name]||(binding&&binding.kind)||'variable';
  return [name,{name,kind,value:binding?binding.value:entry,initialized:binding?binding.initialized!==false:entry!==undefined,
    dataType:dataTypes&&dataTypes[name]||(binding&&binding.dataType),mutable:binding?binding.mutable!==false:kind!=='constant'}];}));
context.registerStatementPlugin=()=>{};
['js/program-core.js','plugins/program-input/parser.js','js/program-item-builder.js','plugins/code-simulator/content.js',
  'plugins/code-simulator/statement.js'].forEach(load);
for(const language of ['c','java']){
  for(const topic of topics){
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,topic);
    context.bankManifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    context.bankRows=context.bankManifest.exercises.map(filename=>({filename,
      raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
    context.bankLanguage=language;context.bankTopic=topic;
    const installed=evaluate(`(()=>{const url='test/'+bankLanguage+'/'+bankTopic+'/manifest.json';
      csInstallExerciseBank(url,bankLanguage,bankTopic,bankManifest,bankRows);
      return codeSimulatorExerciseBanks.get(url).exercises.length;})()`);
    assert.strictEqual(installed,11,language+'/'+topic+' content-provider bank');
  }
}
for(const language of ['c','java']){
  for(const topic of topics){
    const directory=path.join(ROOT,'exercise-libraries','source-programs',language,topic);
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
    const filename=manifest.exercises[topic==='loop-do-while-basics'?1:0],raw=fs.readFileSync(path.join(directory,filename),'utf8');
    context.traceRaw=raw;context.traceFilename=filename;context.traceLanguage=language;
    const traced=JSON.parse(evaluate(`(()=>{const parsed=csParseExercise({filename:traceFilename,raw:traceRaw},traceLanguage,'seeded');
      const lineCounts={};parsed.statements.forEach(statement=>lineCounts[statement.sourceLine]=(lineCounts[statement.sourceLine]||0)+1);
      return JSON.stringify({kinds:parsed.statements.map(statement=>statement.kind),ids:parsed.statements.map(statement=>statement.id),
        repeatedLines:Object.values(lineCounts).filter(count=>count>1).length,
        loopPhases:parsed.statements.filter(statement=>statement.kind==='loop').map(statement=>statement.runtime.loopPhase),
        forPhases:parsed.statements.map(statement=>statement.forPhase).filter(Boolean)});})()`));
    assert(traced.kinds.includes('loop'),language+'/'+topic+' trace includes loop steps');
    assert.strictEqual(new Set(traced.ids).size,traced.ids.length,language+'/'+topic+' trace ids are unique');
    assert(traced.repeatedLines>0,language+'/'+topic+' trace revisits source lines');
    assert(traced.loopPhases.length>1,language+'/'+topic+' trace includes repeated loop checks');
    if(topic==='loop-for-basics'){
      assert(traced.forPhases.includes('initialize'),language+'/'+topic+' trace includes for initialization');
      assert(traced.forPhases.includes('condition'),language+'/'+topic+' trace includes for condition checks');
      assert(traced.forPhases.includes('update'),language+'/'+topic+' trace includes for updates');
    }
  }
}
const doDirectory=path.join(ROOT,'exercise-libraries','source-programs','c','loop-do-while-basics');
context.doRaw=fs.readFileSync(path.join(doDirectory,'AtLeastOnce.c'),'utf8');
const doEntry=JSON.parse(evaluate(`(()=>{const parsed=csParseExercise({filename:'AtLeastOnce.c',raw:doRaw},'c','seeded');
  const statement=parsed.statements.find(candidate=>candidate.kind==='loop'&&candidate.loopKind==='do');
  statement.nextStatementId='$end';
  const item={checked:false,program:createProgram([statement],{language:'c'})};
  const result=dispatchProgramAction(item,{type:'commit-loop-entry',statementId:statement.id});
  return JSON.stringify({plugin:!!statementPluginFor(statement),applied:result.applied,
    completed:item.program.status==='complete',event:item.program.events[0]&&item.program.events[0].type});})()`));
assert.deepStrictEqual(doEntry,{plugin:true,applied:true,completed:true,event:'LOOP'});
const strictSequence=JSON.parse(evaluate(`(()=>{const item=csBuildItem({id:'loop-sequence-test'},
  {id:'at-least-once',filename:'AtLeastOnce.c',raw:doRaw},'c',1);
  return JSON.stringify({canonical:item.canonicalStatementIds,actual:item.program.statements.map(statement=>statement.id)});})()`));
assert.deepStrictEqual(strictSequence.canonical,strictSequence.actual,'strict trace must follow every unrolled loop frame');

class TestNode{
  constructor(tag,text=''){this.tagName=tag;this._text=text;this.children=[];this.attributes={};this.className='';}
  appendChild(child){this.children.push(child);return child;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,handler){this['on'+name]=handler;}
  get textContent(){return this._text+this.children.map(child=>child&&child.textContent||'').join('');}
}
context.document={createElement:tag=>new TestNode(tag),createTextNode:text=>new TestNode('#text',String(text))};
context.state={mode:'practice'};context.strictMode=false;context.strictSequenceEnabled=()=>context.strictMode;
context.examInteractionLocked=()=>false;
context.statementInteractionPlan=(item,statement)=>({mode:'direct',label:`Execute ${statement.forPhase}`});
context.strictProgramStatementSelectable=()=>true;context.activateProgramSourceStatement=()=>true;
load('js/program-flow-trail.js');load('js/dom-helpers.js');load('js/render-session.js');
const headerControls=JSON.parse(evaluate(`(()=>{const text='    for (i = 1; i <= limit; i++) {';
  const statements=['initialize','condition','update'].map((forPhase,index)=>({id:'phase-'+forPhase,forPhase,
    status:index===0?'active':'locked'}));
  const code=renderProgramForHeaderSource({number:8,text},{language:'c',checked:false},
    {statements,cursor:0,status:'running'},statements.map(statement=>statement.id),statements[0],null);
  const clauses=code.children.filter(child=>String(child.className||'').includes('program-source-for-clause'));
  globalThis.strictMode=true;
  const strictCode=renderProgramForHeaderSource({number:8,text},{language:'c',checked:false},
    {statements,cursor:0,status:'running'},statements.map(statement=>statement.id),statements[0],null);
  const strictClauses=strictCode.children.filter(child=>String(child.className||'').includes('program-source-for-clause'));
  return JSON.stringify({text:code.textContent,phases:clauses.map(clause=>clause.attributes['data-for-phase']),
    buttons:clauses.filter(clause=>clause.tagName==='button').length,
    activeButtons:clauses.filter(clause=>clause.tagName==='button'&&String(clause.className).includes('is-active')).length,
    strictButtons:strictClauses.filter(clause=>clause.tagName==='button').length});})()`));
assert.strictEqual(headerControls.text,'    for (i = 1; i <= limit; i++) {');
assert.deepStrictEqual(headerControls.phases,['initialize','condition','update']);
assert.deepStrictEqual([headerControls.buttons,headerControls.activeButtons],[1,1]);
assert.strictEqual(headerControls.strictButtons,3);
const conditionIndicators=JSON.parse(evaluate(`(()=>{
  const complete=(id,line,loopKind,value,forPhase)=>({id,sourceLine:line,kind:'loop',loopKind,forPhase,
    status:'complete',runtime:{checked:true,assignedValue:value}});
  const pending=(id,line)=>({id,sourceLine:line,kind:'loop',loopKind:'for',forPhase:'condition',
    status:'active',runtime:{checked:false,assignedValue:null}});
  const whileProgram={statements:[complete('while-true',7,'while',true),complete('while-false',7,'while',false)]};
  const doProgram={statements:[complete('do-entry',7,'do',true),complete('do-true',10,'do-while',true),
    complete('do-false',10,'do-while',false)]};
  const nextWhile={id:'while-next',sourceLine:7,kind:'loop',loopKind:'while',status:'active',runtime:{checked:false}};
  const nextDo={id:'do-next',sourceLine:10,kind:'loop',loopKind:'do-while',status:'active',runtime:{checked:false}};
  const priorFor=complete('for-true',7,'for',true,'condition'),nextFor=pending('for-next',7);
  const forProgram={statements:[priorFor,nextFor]};
  const forSettled={statements:[priorFor,{id:'body',sourceLine:8,kind:'output',status:'active'}]};
  const forPart=programLoopConditionPart('for (i = 1; i <= limit; i++) {',programFlowTrailForClauseParts('for (i = 1; i <= limit; i++) {'));
  const whilePart=programLoopConditionPart('while (i <= limit) {',null);
  const doPart=programLoopConditionPart('} while (i <= limit);',null);
  const text=(source,part)=>source.slice(part.start,part.end);
  return JSON.stringify({whileResult:programLoopConditionResult(whileProgram,7,null,null).text,
    whileIncoming:programLoopConditionResult({statements:[whileProgram.statements[0],nextWhile]},7,nextWhile,{destinationId:'while-next'}),
    doEntry:programLoopConditionResult(doProgram,7,null,null),
    doResult:programLoopConditionResult(doProgram,10,null,null).text,
    doIncoming:programLoopConditionResult({statements:[doProgram.statements[1],nextDo]},10,nextDo,{destinationId:'do-next'}),
    forIncoming:programLoopConditionResult(forProgram,7,nextFor,{destinationId:'for-next'}),
    forResult:programLoopConditionResult(forSettled,7,forSettled.statements[1],null).text,
    parts:[text('while (i <= limit) {',whilePart),text('} while (i <= limit);',doPart),
      text('for (i = 1; i <= limit; i++) {',forPart)]});})()`));
assert.strictEqual(conditionIndicators.whileResult,'false');
assert.strictEqual(conditionIndicators.whileIncoming,null);
assert.strictEqual(conditionIndicators.doEntry,null);
assert.strictEqual(conditionIndicators.doResult,'false');
assert.strictEqual(conditionIndicators.doIncoming,null);
assert.strictEqual(conditionIndicators.forIncoming,null);
assert.strictEqual(conditionIndicators.forResult,'true');
assert.deepStrictEqual(conditionIndicators.parts,['i <= limit','i <= limit','i <= limit']);
const loopBranchStyles=JSON.parse(evaluate(`(()=>{
  const condition=(id,line,loopKind,value,forPhase)=>({id,sourceLine:line,kind:'loop',loopKind,forPhase,
    status:'complete',runtime:{checked:true,assignedValue:value}});
  const statement=(id,line,kind='assignment',forPhase=null)=>({id,sourceLine:line,kind,forPhase,status:'complete'});
  const model=(lines,statements,history,cursor)=>buildProgramFlowTrailModel({sourceDisplay:{lines:lines.map((text,index)=>({
    number:index+1,text,statementIds:statements.filter(candidate=>candidate.sourceLine===index+1).map(candidate=>candidate.id)}))}},
    {statements,status:'running',cursor,executionHistory:history});
  const branches=result=>result.edges.filter(edge=>edge.loopBranch).map(edge=>({branch:edge.loopBranch,
    prior:!!edge.priorLoopTrue,from:edge.fromLine,to:edge.toLine}));
  const trails=result=>result.edges.map(edge=>({from:edge.fromLine,to:edge.toLine,route:edge.route,
    prior:!!edge.priorLoopTrue}));
  const whileStatements=[condition('while-true',1,'while',true),statement('while-body',2),
    condition('while-false',1,'while',false),statement('while-after',4,'output')];
  const whileLines=['while (i < 2) {','  i++;','}','print(i);'];
  const whileBeforeExit=model(whileLines,whileStatements.slice(0,3),['while-true','while-body'],2);
  const whileAfterExit=model(whileLines,whileStatements,['while-true','while-body','while-false'],3);
  const doStatements=[statement('do-entry',1,'loop'),statement('do-body-1',2),
    condition('do-true',3,'do-while',true),statement('do-body-2',2),
    condition('do-false',3,'do-while',false),statement('do-after',4,'output')];
  doStatements[0].loopKind='do';
  const doAfterExit=model(['do {','  i++;','} while (i < 2);','print(i);'],doStatements,
    ['do-entry','do-body-1','do-true','do-body-2','do-false'],5);
  const forStatements=[statement('for-init',1,'assignment','initialize'),
    condition('for-true',1,'for',true,'condition'),statement('for-body',2),
    statement('for-update',1,'unary-update','update'),condition('for-false',1,'for',false,'condition'),
    statement('for-after',4,'output')];
  const forAfterExit=model(['for (i = 0; i < 2; i++) {','  print(i);','}','print(i);'],forStatements,
    ['for-init','for-true','for-body','for-update','for-false'],5);
  return JSON.stringify({whileBefore:branches(whileBeforeExit),whileAfter:branches(whileAfterExit),
    whileTrails:trails(whileAfterExit),doAfter:branches(doAfterExit),doTrails:trails(doAfterExit),
    forAfter:branches(forAfterExit),forTrails:trails(forAfterExit)});
})()`));
assert.deepStrictEqual(loopBranchStyles.whileBefore,[{branch:'true',prior:false,from:1,to:2}]);
for(const branches of [loopBranchStyles.whileAfter,loopBranchStyles.doAfter,loopBranchStyles.forAfter]){
  assert(branches.some(edge=>edge.branch==='true'&&edge.prior),'earlier true branch becomes historical after exit');
  assert(branches.some(edge=>edge.branch==='false'&&!edge.prior),'false exit branch remains solid');
}
assert(loopBranchStyles.whileTrails.some(edge=>edge.from===2&&edge.to===1&&edge.prior),
  'while loop return route becomes historical after the false exit');
assert(loopBranchStyles.forTrails.some(edge=>edge.from===2&&edge.to===1&&edge.prior),
  'for loop body-to-update route becomes historical after the false exit');
assert(loopBranchStyles.forTrails.some(edge=>edge.from===1&&edge.to===1&&edge.route==='for-header'&&edge.prior),
  'for loop update-to-condition route becomes historical after the false exit');
assert(loopBranchStyles.doTrails.some(edge=>edge.from===2&&edge.to===3&&!edge.prior),
  'do-while body route keeps its existing styling');
const selectionIndicators=JSON.parse(evaluate(`(()=>{
  const complete=(id,line,selectionKind,value)=>({id,sourceLine:line,kind:'selection',selectionKind,
    status:'complete',runtime:{checked:true,assignedValue:value}});
  const prior=complete('if-true',4,'if',true),latest=complete('if-false',4,'if',false);
  const pending={id:'if-next',sourceLine:4,kind:'selection',selectionKind:'if',status:'active',runtime:{checked:false}};
  const elseIf=complete('else-if-false',8,'else-if',false);
  const program={statements:[prior,latest,elseIf]};
  const ifSource='if ((score >= 75) && passed) {';
  const elseIfSource='} else if (score >= 70) {';
  const ifPart=programSelectionConditionPart(ifSource),elseIfPart=programSelectionConditionPart(elseIfSource);
  return JSON.stringify({latest:programSelectionConditionResult(program,4,null,null).text,
    incoming:programSelectionConditionResult({statements:[prior,pending]},4,pending,{destinationId:'if-next'}),
    elseIf:programSelectionConditionResult(program,8,null,null).text,
    parts:[ifSource.slice(ifPart.start,ifPart.end),elseIfSource.slice(elseIfPart.start,elseIfPart.end)],
    switchResult:programSelectionConditionResult({statements:[complete('switch',9,'switch',2)]},9,null,null)});})()`));
assert.strictEqual(selectionIndicators.latest,'false');
assert.strictEqual(selectionIndicators.incoming,null);
assert.strictEqual(selectionIndicators.elseIf,'false');
assert.deepStrictEqual(selectionIndicators.parts,['(score >= 75) && passed','score >= 70']);
assert.strictEqual(selectionIndicators.switchResult,null);
const repeatedTransition=JSON.parse(evaluate(`JSON.stringify({
  laterOrigin:programSourceTransitionRoles(['body-frame-1','body-frame-2'],
    {originId:'body-frame-2',destinationId:'condition-frame-3'}),
  sameLine:programSourceTransitionRoles(['update-frame-2','condition-frame-3'],
    {originId:'update-frame-2',destinationId:'condition-frame-3'})})`));
assert.deepStrictEqual(repeatedTransition.laterOrigin,{origin:true,destination:false});
assert.deepStrictEqual(repeatedTransition.sameLine,{origin:true,destination:true});
const modalViewport={scrollTop:148,scrollLeft:23};
assert.strictEqual(evaluate('resetStatementTraceViewport')(modalViewport),true);
assert.deepStrictEqual(modalViewport,{scrollTop:0,scrollLeft:0});
const orderingTextRight=evaluate(`(()=>{const previous=document.createRange;
  document.createRange=()=>({selectNodeContents(){},getBoundingClientRect:()=>({right:286,width:142})});
  const result=programFlowTrailRenderedRight({classList:{contains:name=>name==='co-order-code'},
    getBoundingClientRect:()=>({right:570,width:426})});document.createRange=previous;return result;})()`);
assert.strictEqual(orderingTextRight,286,'ordering trails must use the rendered text edge, not the reorder column edge');
const rightExtent=evaluate(`programFlowTrailRightExtent({offsetWidth:500,offsetHeight:300,clientLeft:0,clientTop:0,
  scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:100,top:50,width:500,height:300}),
  querySelectorAll:()=>[
    {getBoundingClientRect:()=>({left:150,right:310,top:70,bottom:92})},
    {getBoundingClientRect:()=>({left:150,right:470,top:100,bottom:122})},
    {getBoundingClientRect:()=>({left:150,right:540,top:240,bottom:262})}
  ]},20,100)`);
assert.strictEqual(rightExtent,370,'right return lane must clear the widest statement it crosses');
const sharedStyles=fs.readFileSync(path.join(ROOT,'css','styles.css'),'utf8');
assert(sharedStyles.includes('.program-condition-result{'));
assert(sharedStyles.includes('.program-source-file-line.has-program-condition-result:not(.is-for-header)'));
console.log(`Loop Foundations validated: ${set.profiles.length} profiles, ${files} bilingual sources, ${frames} execution frames.`);

