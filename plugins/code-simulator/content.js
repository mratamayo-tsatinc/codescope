const codeSimulatorExerciseBanks=new Map();

function csSourceLibrary(profile){
  const source=profileContentSource(profile);
  return exerciseLibrarySlug(source.library||CODE_SIMULATOR_PLUGIN_MANIFEST.id,
    `${profile&&profile.id||'code-simulator'}: exercise library`);
}

function csManifestUrl(profile,language){
  return resolveExerciseManifestUrl({library:csSourceLibrary(profile),language,
    exerciseSet:poContentSlug(profileContentSource(profile).exerciseSet,'exerciseSet')});
}

function csSourceValueMode(profile){
  const mode=profileVariableValueMode(profile);
  if(mode!=='authored'&&mode!=='seeded') throw new Error(`${profile&&profile.id||'code-simulator'}: sourceValueMode must be 'authored' or 'seeded'`);
  return mode;
}

function csInputValueMode(profile){return programInputValueMode(profile);}

// Interactive trace expectations must begin at the memory state reached by
// canonical control flow. A skipped branch must not alter a later statement's operands.
function csRuntimeMemoryValues(snapshot){
  return Object.fromEntries(Object.entries(snapshot||{}).map(([name,binding])=>{
    if(binding&&typeof binding==='object'&&!Array.isArray(binding)
      &&Object.prototype.hasOwnProperty.call(binding,'value')){
      const value=binding.initialized===false?undefined:binding.value;
      return [name,Array.isArray(value)?value.slice():value];
    }
    return [name,Array.isArray(binding)?binding.slice():binding];
  }));
}

function csStatementRuntimeMemory(statement,executionMemoryBefore,fallback){
  const snapshots=statement&&executionMemoryBefore[statement.id]||[];
  return snapshots.length?csRuntimeMemoryValues(snapshots[0]):Object.assign({},fallback);
}

function csBuildSelection(id,kind,statement,lineIndex,lines,memory,kinds,branches,dataTypes,language){
  if(!statement||statement.kind!=='selection'||statement.selectionKind!==kind)
    throw new Error(`selection source:${lineIndex+1}: unsupported selection header`);
  statement.id=id;statement.branches=branches;
  const tree=coreExpressionIrToEngineTree(statement.condition,poExpressionSymbols(memory,kinds,dataTypes));
  const semantic=coreExecuteStatement({language,statement,memory});
  statement.sourceLine=lineIndex+1;statement.sourceEndLine=lineIndex+1;statement.sourceText=lines[lineIndex];
  statement.sourceIndent=(lines[lineIndex].match(/^\s*/)||[''])[0];statement.runtime=buildDeclarationRuntime(tree,semantic.value);
  statement.runtime.expectedEffects=semantic.effects.filter(effect=>effect.scope==='expression');
  statement.runtime.semanticTrace=semantic.trace;
  statement.runtime.selectedTargetLine=null;statement.runtime.selectedTargetText=null;statement.runtime.selectedLabel=null;
  statement.runtime.studentSelectedTargetStatementId=null;statement.runtime.studentSelectedLabel=null;
  statement.runtime.branchChoiceCorrect=null;
  return statement;
}

function csParseExercise(exercise,language,sourceValueMode='authored',inputValueMode='authored'){
  if(sourceValueMode!=='authored'&&sourceValueMode!=='seeded')
    throw new Error(`${exercise.filename}: sourceValueMode must be 'authored' or 'seeded'`);
  if(inputValueMode!=='authored'&&inputValueMode!=='seeded')
    throw new Error(`${exercise.filename}: inputValueMode must be 'authored' or 'seeded'`);
  const rawDetails=sourceProgramMetadataAndSource(exercise.raw,exercise.filename);
  const inputDefinitions=programInputDirectives(rawDetails.metadata,exercise.filename,inputValueMode);
  const inputValues=Object.fromEntries(inputDefinitions.map(definition=>[definition.target,
    {value:definition.materializedValue,raw:definition.materializedRaw}]));
  const details=Object.assign(sourceProgramParseExercise({details:rawDetails,filename:exercise.filename,language,
    sourceValueMode,inputValues}),{inputValueMode,inputValues}),lines=details.lines;
  const coreProgramResult=details.coreProgramResult,coreStatementsByLine=details.statementsByLine;
  const coreStatementGroupsByLine=new Map();
  (coreProgramResult.ir&&coreProgramResult.ir.statements||[]).forEach(statement=>{
    if(!coreStatementGroupsByLine.has(statement.sourceLine))coreStatementGroupsByLine.set(statement.sourceLine,[]);
    coreStatementGroupsByLine.get(statement.sourceLine).push(statement);
  });
  const memory={},kinds={},dataTypes={},declarations=[],statements=[],supported=new Map(),declarationsByLine=new Map();
  let declarationIndex=0,assignmentIndex=0,unaryIndex=0,outputIndex=0,inputIndex=0,breakIndex=0;
  const mark=statement=>{
    const support=supported.get(statement.sourceLine)||{statementId:statement.id,statementIds:[],primary:true};
    if(!support.statementIds.includes(statement.id))support.statementIds.push(statement.id);
    supported.set(statement.sourceLine,support);
  };
  lines.forEach((raw,index)=>{
    const sharedStatements=coreStatementGroupsByLine.get(index+1)||[];
    const sharedStatement=sharedStatements[0]||coreStatementsByLine.get(index+1);
    const coreStatement=sharedStatement||null;
    if(!coreStatement)return;
    const declarationStatements=sharedStatements.filter(statement=>statement.kind==='declaration');
    if(declarationStatements.length){
      const entries=[];
      declarationStatements.forEach(coreDeclaration=>{
        const {name,dataType}=coreDeclaration.binding,kind=coreDeclaration.binding.mutable?'variable':'constant';
        const initialized=coreDeclaration.initialized;
        const tree=initialized?coreExpressionIrToEngineTree(coreDeclaration.initializer,
          poExpressionSymbols(memory,kinds,dataTypes)):null;
        const semantic=evaluateAndApplyCoreStatement(coreDeclaration,memory,language,
          `declaration-${declarationIndex+1}`,'raw');
        const value=initialized?semantic.value:undefined;
        kinds[name]=kind;dataTypes[name]=dataType;
        const declaration={kind,name,value,dataType,initialized};declarations.push(declaration);
        const statement=coreDeclaration;statement.id=`declaration-${++declarationIndex}`;
        statement.binding.kind=kind;statement.runtime=initialized
          ?buildDeclarationRuntime(tree,value):buildUninitializedDeclarationRuntime();
        statement.runtime.expectedEffects=semantic.effects.filter(effect=>effect.scope==='expression');statement.runtime.semanticTrace=semantic.trace;
        statement.dependencies=tree?[...collectExpressionDependencies(statement.initializer)]:[];
        statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
        statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);
        entries.push({declaration,statement,initializer:coreDeclaration.initializer});
      });
      if(entries.length>1){
        const groupId=`declaration-line-${index+1}`,statementIds=entries.map(entry=>entry.statement.id);
        entries.forEach(entry=>{
          entry.statement.declarationGroupId=groupId;
          entry.statement.declarationGroupStatementIds=statementIds.slice();
        });
      }
      declarationsByLine.set(index+1,entries);return;
    }
    if(coreStatement&&coreStatement.kind==='input'){
      coreStatement.reads.forEach(read=>{const definition=inputDefinitions.find(candidate=>candidate.target===read.target);
        if(definition)memory[read.target]=definition.materializedValue;});
      return;
    }
    if(coreStatement&&coreStatement.kind==='assignment'){
      evaluateAndApplyCoreStatement(coreStatement,memory,language,`assignment-preview-${index+1}`,'raw');
    }else if(coreStatement&&coreStatement.kind==='unary-update'){
      evaluateAndApplyCoreStatement(coreStatement,memory,language,`unary-preview-${index+1}`,'raw');
    }
  });
  let selectionIndex=0;
  const executionMemoryBefore=coreProgramResult.ir.metadata&&coreProgramResult.ir.metadata.executionMemoryBefore||{};
  coreProgramResult.ir.statements.filter(statement=>statement.kind==='selection').forEach(coreStatement=>{
    const index=coreStatement.sourceLine-1;
    const snapshots=executionMemoryBefore[coreStatement.id]||[];
    const conditionMemory=snapshots[0]||memory;
    const statement=csBuildSelection(`selection-${++selectionIndex}`,coreStatement.selectionKind,
      coreStatement,index,lines,conditionMemory,kinds,[],dataTypes,language);
    mark(statement);statements.push(statement);
  });
  const executionMemory={};
  lines.forEach((raw,index)=>{
    const declarationEntries=declarationsByLine.get(index+1);
    if(declarationEntries){
      declarationEntries.forEach(({declaration,statement,initializer})=>{
        if(declaration.initialized){
          const tree=coreExpressionIrToEngineTree(initializer,poExpressionSymbols(executionMemory,kinds,dataTypes));
          const semantic=evaluateAndApplyCoreStatement(statement,executionMemory,language,statement.id,'raw');
          const value=semantic.value;
          declaration.value=value;statement.initializer=engineNodeToProgramIr(tree);
          statement.runtime=buildDeclarationRuntime(tree,value);
          statement.runtime.expectedEffects=semantic.effects.filter(effect=>effect.scope==='expression');statement.runtime.semanticTrace=semantic.trace;
          statement.dependencies=[...collectExpressionDependencies(statement.initializer)];
        }else executionMemory[declaration.name]=undefined;
      });
      return;
    }
    if(supported.has(index+1)) return;
    const trimmed=raw.trim();
    const sharedStatements=coreStatementGroupsByLine.get(index+1)||[];
    const sharedStatement=sharedStatements.find(statement=>statement.kind!=='declaration')
      ||coreStatementsByLine.get(index+1);
    const coreStatement=sharedStatement||null;
    const runtimeMemory=coreStatement
      ?csStatementRuntimeMemory(coreStatement,executionMemoryBefore,executionMemory):executionMemory;
    if(!coreStatement&&!trimmed.endsWith(';')) return;
    if(coreStatement&&coreStatement.kind==='program-break'){
      const statement=coreStatement;statement.id=`program-break-${++breakIndex}`;
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];
      mark(statement);statements.push(statement);return;
    }
    if(coreStatement&&coreStatement.kind==='program-return'){
      const statement=coreStatement;statement.id='program-return';
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);return;
    }
    const input=coreStatement&&coreStatement.kind==='input'
      ?programInputHydrateStatement(coreStatement,{filename:exercise.filename,line:index+1,
        statementIndex:++inputIndex,definitions:inputDefinitions}):null;
    if(input){
      input.sourceLine=index+1;input.sourceEndLine=index+1;input.sourceText=raw;
      input.reads.forEach(read=>{executionMemory[read.target]=read.expectedValue;});
      input.sourceIndent=(raw.match(/^\s*/)||[''])[0];input.nextStatementId='$end';mark(input);statements.push(input);return;
    }
    const output=coreStatement&&coreStatement.kind==='output'
      ?buildOutputStatementRuntime(coreStatement,outputIndex,runtimeMemory):null;
    if(output&&coreStatement&&coreStatement.kind==='output')output.sourceSpan=coreStatement.sourceSpan;
    if(output){
      outputIndex++;output.sourceLine=index+1;output.sourceEndLine=index+1;output.sourceText=raw;
      output.sourceIndent=(raw.match(/^\s*/)||[''])[0];output.nextStatementId='$end';mark(output);statements.push(output);return;
    }
    if(coreStatement&&coreStatement.kind==='unary-update'){
      const statement=buildUnaryUpdateStatementRuntime(coreStatement.target,coreStatement.operator,
        coreStatement.form,runtimeMemory,unaryIndex++);
      evaluateAndApplyCoreStatement(coreStatement,executionMemory,language,
        'unary-preview-'+(index+1),'raw');
      statement.sourceSpan=coreStatement.sourceSpan;
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);return;
    }
    if(coreStatement&&coreStatement.kind==='assignment'){
      const tree=coreExpressionIrToEngineTree(coreStatement.value,poExpressionSymbols(runtimeMemory,kinds,dataTypes));
      const statement=buildAssignmentStatementRuntime(coreStatement.target,coreStatement.operator,tree,runtimeMemory,assignmentIndex++);
      evaluateAndApplyCoreStatement(coreStatement,executionMemory,language,
        'assignment-preview-'+(index+1),'raw');
      statement.sourceSpan=coreStatement.sourceSpan;
      statement.targetDataType=dataTypes[coreStatement.target];
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);
    }
  });
  programInputValidateDefinitions(inputDefinitions,exercise.filename);
  const expectedMemory=coreProgramResult.ir.metadata&&coreProgramResult.ir.metadata.expectedMemory||{};
  Object.keys(memory).forEach(name=>delete memory[name]);Object.assign(memory,csRuntimeMemoryValues(expectedMemory));
  statements.sort((left,right)=>left.sourceLine-right.sourceLine);
  if(!statements.length) throw new Error(`${exercise.filename}: no supported executable statements were found`);
  const controlFlow=coreBuildProgramControlFlow({source:details.source,lines,language,
    filename:exercise.filename,statements,symbols:poExpressionSymbols(executionMemory,kinds,dataTypes)});
  if(controlFlow.diagnostics.length)throw new Error(controlFlow.diagnostics.map(row=>row.message).join('; '));
  const sourceDisplay={filename:exercise.filename,lines:lines.map((text,index)=>{const support=supported.get(index+1);return {number:index+1,text,supported:!!support,statementId:support&&support.statementId||null,statementIds:support&&support.statementIds||[],primary:!!support};})};
  return {details,lines,memory,kinds,dataTypes,declarations,statements,sourceDisplay,
    coreProgram:coreProgramResult.ir,coreDiagnostics:coreProgramResult.diagnostics};
}

function csBuildItem(profile,exercise,language,itemNumber){
  const parsed=csParseExercise(exercise,language,csSourceValueMode(profile),csInputValueMode(profile)),last=parsed.declarations[parsed.declarations.length-1];
  const resultName=parsed.details.resultName||(last&&last.name)||'result';
  if(parsed.details.resultName&&!Object.prototype.hasOwnProperty.call(parsed.memory,resultName))
    throw new Error(`${exercise.filename}: @result '${resultName}' is not declared`);
  const resultKind=parsed.kinds[resultName]||'variable',resultValue=parsed.memory[resultName];
  const generatedAnswer=sourceProgramGenerateAnswer(parsed.details,exercise.filename,{allowDiagnostics:true});
  const expectedMemory=parsed.details.coreProgramResult.ir.metadata.expectedMemory||{};
  const programAnswerKey={output:generatedAnswer.output,variables:generatedAnswer.variables.map(variable=>{
    const binding=expectedMemory[variable.name]||{};
    return Object.assign({},variable,{value:binding.value,initialized:binding.initialized!==false,
      kind:binding.kind||'variable',mutable:binding.mutable!==false});
  })};
  const originalTree=last?makeNamed(resultKind,resultName,resultValue):makeLiteral(0),originalFlat=flattenInstance(originalTree);
  const item={profileId:profile.id,itemNumber,exerciseId:exercise.id,filename:exercise.filename,exerciseTitle:parsed.details.title,
    source:parsed.details.source,sourceTemplate:parsed.details.templateSource,sourceSeedValues:parsed.details.seedValues,
    sourceValueMode:parsed.details.sourceValueMode,sourceInputValues:parsed.details.inputValues,
    inputValueMode:parsed.details.inputValueMode,programAnswerKey,sourceDisplay:parsed.sourceDisplay,sourceFlow:true,language,originalTree,originalFlat,
    canonicalStatementIds:sourceProgramCanonicalStatementIds(parsed.statements,parsed.coreProgram),
    decls:parsed.declarations,resultName,correctFinalValue:last?resultValue:0,canonicalTrace:buildCanonicalTrace(originalTree),
    workingFlat:deepCloneFlat(originalFlat),history:[deepCloneFlat(originalFlat)],trace:[],checked:false,itemScore:null,points:null,maxPoints:null,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,showSolution:false,playback:null,flagged:false,lockedAt:null,examActionLog:[],
    examSequenceFailure:null,practiceInvalidExecution:null,_bindings:null};
  item.program=createProgram(parsed.statements,{id:`${profile.id}-${exercise.id}`,language});item.program.mode='interactive-program';item.program.scoreAssignments=profileScoresStatementCommits(profile);return item;
}

function csInstallExerciseBank(url,language,exerciseSet,manifest,rows){
  const checked=poValidateManifest(manifest,url),byName=new Map(rows.map(row=>[row.filename,row]));
  const exercises=checked.exercises.map(filename=>{const row=byName.get(filename);if(!row)throw new Error(`${url}: '${filename}' was not loaded`);
    const exercise={id:filename.replace(/\.[^.]+$/,''),filename,raw:row.raw};csParseExercise(exercise,language);return Object.freeze(exercise);});
  codeSimulatorExerciseBanks.set(url,Object.freeze({language,exerciseSet,exercises:Object.freeze(exercises)}));
}

async function csLoadExerciseContent(){
  const profiles=PROFILES.filter(profile=>profileIsEnabled(profile)&&profile.content
    &&profileUsesContentProvider(profile,CODE_SIMULATOR_PLUGIN_MANIFEST.id));
  await Promise.all(profiles.map(async profile=>{const url=csManifestUrl(profile,state.language),response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);
    const manifest=poValidateManifest(await response.json(),url),directory=url.slice(0,url.lastIndexOf('/')+1),rows=await Promise.all(manifest.exercises.map(async filename=>{
      const result=await fetch(directory+encodeURIComponent(filename),{cache:'no-store'});if(!result.ok)throw new Error(`${filename}: HTTP ${result.status}`);return {filename,raw:await result.text()};}));
    csInstallExerciseBank(url,state.language,profileContentSource(profile).exerciseSet,manifest,rows); }));
}

const codeSimulatorContentProvider={id:CODE_SIMULATOR_PLUGIN_MANIFEST.id,
  matches(profile){return !!(profile&&profile.content&&profile.content.mode==='source-files'
    &&profileWorkspacePresentation(profile)==='source-program');},
  validateProfile(profile){if(profile.content.mode!=='source-files')throw new Error(`${profile.id}: code simulator content must use source-files`);
    csSourceLibrary(profile);csSourceValueMode(profile);csInputValueMode(profile);if(!profile.content.selection||profile.content.selection.count!=='all'||profile.itemCount!=='manifest')
      throw new Error(`${profile.id}: source-file simulation must use manifest item count`);},
  loadContent:csLoadExerciseContent,
  generateItems({profile,language}){const bank=codeSimulatorExerciseBanks.get(csManifestUrl(profile,language));if(!bank)throw new Error(`${profile.id}: code simulator exercise bank is not loaded`);
    return bank.exercises.map((exercise,index)=>csBuildItem(profile,exercise,language,index+1));},
  regenerateItem({profile,item,language}){const bank=codeSimulatorExerciseBanks.get(csManifestUrl(profile,language));if(!bank)throw new Error(`${profile.id}: code simulator exercise bank is not loaded`);
    const index=bank.exercises.findIndex(exercise=>exercise.filename===item.filename||exercise.id===item.exerciseId);
    if(index<0)throw new Error(`${profile.id}: current exercise '${item.filename||item.exerciseId}' is not in the active manifest`);
    return csBuildItem(profile,bank.exercises[index],language,item.itemNumber||index+1);}
};
registerProfileContentProvider(codeSimulatorContentProvider);
