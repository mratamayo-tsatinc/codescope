// Runtime exercise-bank loading and constrained C/Java source parsing for
// Program Output profiles. Source files are the authored truth; they are
// parsed into the same Program IR used by seeded generation.
const programOutputExerciseBanks=new Map();

function poContentSlug(value,label){
  const slug=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${label} must be a lowercase path slug`);
  return slug;
}

function poContentConfig(profile){return profile&&profile.content||{};}

function poExerciseSet(profile){
  return poContentSlug(profileContentSource(profile).exerciseSet,`${profile&&profile.id||'program-output'}: exerciseSet`);
}

function poExerciseLibrary(profile){
  const source=profileContentSource(profile);
  return poContentSlug(source.library||PROGRAM_OUTPUT_PLUGIN_MANIFEST.id,
    `${profile&&profile.id||'program-output'}: exercise library`);
}

function poManifestUrl(profile,language){
  return resolveExerciseManifestUrl({library:poExerciseLibrary(profile),language,exerciseSet:poExerciseSet(profile)});
}

function poValidateManifest(manifest,url){
  return sourceProgramValidateManifest(manifest,url,'Program Output');
}

function poDecodeString(raw,filename){
  return decodeCoreStringEscape(raw,filename);
}

function poExpressionSymbols(memory,kinds,dataTypes){
  const names=[...new Set([...Object.keys(memory||{}),...Object.keys(kinds||{})])];
  return Object.fromEntries(names.map(name=>[name,{
    name,kind:kinds&&kinds[name]||'variable',value:memory[name],initialized:memory[name]!==undefined,
    dataType:dataTypes&&dataTypes[name],mutable:!(kinds&&kinds[name]==='constant')
  }]));
}

function poParseSourceExercise(exercise,language){
  const details=sourceProgramParseExercise({raw:exercise.raw,filename:exercise.filename,language});
  const coreProgramResult=details.coreProgramResult;
  const sourceLines=details.source.split('\n');
  const memory={},kinds={},dataTypes={},declarations=[],statements=[];
  const supportedLines=new Map();
  const markSupported=(coreStatement,statement)=>{
    const start=coreStatement.sourceLine||coreStatement.sourceSpan.start.line;
    const end=coreStatement.sourceEndLine||coreStatement.sourceSpan.end.line;
    statement.sourceLine=start;statement.sourceEndLine=end;
    statement.sourceText=sourceLines.slice(start-1,end).join('\n');
    statement.sourceIndent=(sourceLines[start-1]||'').match(/^\s*/)[0];
    for(let line=start;line<=end;line++){
      supportedLines.set(line,{statementId:statement.id,primary:line===start});
    }
  };
  let declarationIndex=0,assignmentIndex=0,unaryIndex=0,outputIndex=0;
  (coreProgramResult.ir&&coreProgramResult.ir.statements||[]).forEach(coreStatement=>{
    try{
    if(coreStatement&&coreStatement.kind==='program-return'){
      coreStatement.id='program-return';markSupported(coreStatement,coreStatement);statements.push(coreStatement);return;
    }
    if(coreStatement&&coreStatement.kind==='output'){
      const output=buildOutputStatementRuntime(coreStatement,outputIndex++,memory);
      output.sourceSpan=coreStatement.sourceSpan;markSupported(coreStatement,output);statements.push(output);return;
    }
    if(coreStatement&&coreStatement.kind==='declaration'){
      const {name,dataType}=coreStatement.binding,kind=coreStatement.binding.mutable?'variable':'constant';
      const initialized=coreStatement.initialized;
      const tree=initialized?coreExpressionIrToEngineTree(coreStatement.initializer,
        poExpressionSymbols(memory,kinds,dataTypes)):null;
      const semantic=evaluateAndApplyCoreStatement(coreStatement,memory,language,
        `declaration-${declarationIndex+1}`,'raw');
      const value=initialized?semantic.value:undefined;
      kinds[name]=kind;dataTypes[name]=dataType;
      declarations.push({kind,name,value,dataType,initialized});
      const statement=coreStatement;statement.id=`declaration-${++declarationIndex}`;
      statement.binding.kind=kind;statement.runtime=initialized
        ?buildDeclarationRuntime(tree,value):buildUninitializedDeclarationRuntime();
      statement.runtime.expectedEffects=semantic.effects.filter(effect=>effect.scope==='expression');statement.runtime.semanticTrace=semantic.trace;
      statement.dependencies=tree?[...collectExpressionDependencies(statement.initializer)]:[];
      markSupported(coreStatement,statement);statements.push(statement);return;
    }
    if(coreStatement&&coreStatement.kind==='unary-update'){
      const statement=buildUnaryUpdateStatementRuntime(coreStatement.target,coreStatement.operator,
        coreStatement.form,memory,unaryIndex++);
      statement.sourceSpan=coreStatement.sourceSpan;
      markSupported(coreStatement,statement);statements.push(statement);return;
    }
    if(coreStatement&&coreStatement.kind==='assignment'){
      const tree=coreExpressionIrToEngineTree(coreStatement.value,poExpressionSymbols(memory,kinds,dataTypes));
      const statement=buildAssignmentStatementRuntime(coreStatement.target,coreStatement.operator,tree,memory,assignmentIndex++);
      statement.sourceSpan=coreStatement.sourceSpan;
      statement.targetDataType=dataTypes[coreStatement.target];
      markSupported(coreStatement,statement);statements.push(statement);return;
    }
    return;
    }catch(error){
      if(/unsupported expression|unsupported statement|output expressions must/.test(String(error&&error.message))) return;
      throw error;
    }
  });
  if(!declarations.length||!statements.some(statement=>statement.kind==='output'))
    throw new Error(`${exercise.filename}: at least one declaration and one output statement are required`);
  const resultName=details.resultName||declarations[declarations.length-1].name;
  if(!Object.prototype.hasOwnProperty.call(memory,resultName)) throw new Error(`${exercise.filename}: @result '${resultName}' is not declared`);
  const sourceDisplay={filename:exercise.filename,lines:sourceLines.map((text,index)=>{
    const support=supportedLines.get(index+1);
    return {number:index+1,text,supported:!!support,
      statementId:support&&support.statementId||null,primary:!!(support&&support.primary)};
  })};
  return {details,declarations,statements,memory,kinds,dataTypes,resultName,sourceDisplay,
    coreProgram:coreProgramResult.ir,coreDiagnostics:coreProgramResult.diagnostics};
}

function poBuildSourceItem(profile,exercise,language,itemNumber){
  const parsed=poParseSourceExercise(exercise,language);
  const sourceFlow=profileWorkspacePresentation(profile)==='source-program';
  const programStatements=sourceFlow?parsed.statements:parsed.statements.filter(statement=>statement.kind!=='program-return');
  const resultKind=parsed.kinds[parsed.resultName]||'variable';
  const originalTree=makeNamed(resultKind,parsed.resultName,parsed.memory[parsed.resultName]);
  const originalFlat=flattenInstance(originalTree);
  let resultTarget='result',suffix=2;
  while(Object.prototype.hasOwnProperty.call(parsed.memory,resultTarget)) resultTarget=`result${suffix++}`;
  const item={
    profileId:profile.id,itemNumber,exerciseId:exercise.id,filename:exercise.filename,
    exerciseTitle:parsed.details.title,source:parsed.details.source,sourceDisplay:parsed.sourceDisplay,
    sourceFlow,language,
    originalTree,originalFlat,decls:parsed.declarations,resultName:resultTarget,
    correctFinalValue:parsed.memory[parsed.resultName],canonicalTrace:buildCanonicalTrace(originalTree),
    workingFlat:deepCloneFlat(originalFlat),history:[deepCloneFlat(originalFlat)],trace:[],
    checked:false,itemScore:null,points:null,maxPoints:null,correctSteps:0,totalOpSteps:0,
    wasCorrectFinal:null,showSolution:false,playback:null,flagged:false,lockedAt:null,
    examActionLog:[],examSequenceFailure:null,practiceInvalidExecution:null,_bindings:null
  };
  if(!sourceFlow) programStatements.push({id:'final-expression',kind:'legacy-expression',status:'locked'});
  item.program=createProgram(programStatements,{id:`${profile.id}-${exercise.id}`,language});
  item.program.mode='interactive-program';item.program.scoreAssignments=profileScoresStatementCommits(profile);
  return item;
}

function poInstallExerciseBank(url,language,exerciseSet,manifest,rows){
  const checked=poValidateManifest(manifest,url),byFilename=new Map(rows.map(row=>[row.filename,row]));
  const exercises=checked.exercises.map(filename=>{
    const row=byFilename.get(filename);
    if(!row||typeof row.raw!=='string') throw new Error(`${url}: '${filename}' was not loaded`);
    const exercise={id:filename.replace(/\.[^.]+$/,''),filename,raw:row.raw};
    poParseSourceExercise(exercise,language);
    return Object.freeze(exercise);
  });
  programOutputExerciseBanks.set(url,Object.freeze({language:poContentSlug(language,'CodeScope language'),
    exerciseSet:poContentSlug(exerciseSet,'exerciseSet'),title:checked.title,exercises:Object.freeze(exercises)}));
}

async function poFetchExerciseBank(profile,language){
  const url=poManifestUrl(profile,language),response=await fetch(url,{cache:'no-store'});
  if(!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const manifest=poValidateManifest(await response.json(),url),directory=url.slice(0,url.lastIndexOf('/')+1);
  const rows=await Promise.all(manifest.exercises.map(async filename=>{
    const exerciseUrl=directory+encodeURIComponent(filename),exerciseResponse=await fetch(exerciseUrl,{cache:'no-store'});
    if(!exerciseResponse.ok) throw new Error(`${exerciseUrl}: HTTP ${exerciseResponse.status}`);
    return {filename,raw:await exerciseResponse.text()};
  }));
  poInstallExerciseBank(url,language,poExerciseSet(profile),manifest,rows);
}

async function poLoadExerciseContent(){
  const profiles=PROFILES.filter(profile=>profileIsEnabled(profile)&&profile.content
    &&profileUsesContentProvider(profile,PROGRAM_OUTPUT_PLUGIN_MANIFEST.id)&&profile.content.mode==='source-files');
  const unique=new Map(profiles.map(profile=>[poManifestUrl(profile,state.language),profile]));
  await Promise.all([...unique.values()].map(profile=>poFetchExerciseBank(profile,state.language)));
}

function poShuffle(values){
  const result=values.slice();
  for(let index=result.length-1;index>0;index--){
    const swap=Math.floor(seededRandom()*(index+1));
    [result[index],result[swap]]=[result[swap],result[index]];
  }
  return result;
}

function poValidateContentProfile(profile){
  const content=poContentConfig(profile);
  if(!['generated','source-files'].includes(content.mode))
    throw new Error(`${profile.id}: content.mode must be 'generated' or 'source-files'`);
  if(content.mode==='generated'){
    if(typeof content.recipe!=='string'||!content.recipe.trim()) throw new Error(`${profile.id}: generated content requires recipe`);
    return;
  }
  poExerciseSet(profile);
  const selection=content.selection||{};
  if(selection.count!==undefined&&selection.count!=='all'
    &&(!Number.isInteger(selection.count)||selection.count<1))
    throw new Error(`${profile.id}: content.selection.count must be 'all' or a positive integer`);
  if(Number.isInteger(selection.count)&&selection.count!==profile.itemCount)
    throw new Error(`${profile.id}: content.selection.count must match scoring.itemCount`);
  if(selection.count==='all'&&profile.itemCount!=='manifest')
    throw new Error(`${profile.id}: scoring.itemCount must be 'manifest' when content.selection.count is 'all'`);
  if(selection.shuffle!==undefined&&typeof selection.shuffle!=='boolean')
    throw new Error(`${profile.id}: content.selection.shuffle must be a boolean`);
  if(!['statement-flow','source-program'].includes(profileWorkspacePresentation(profile)))
    throw new Error(`${profile.id}: presentation.workspace must be 'statement-flow' or 'source-program'`);
}

function poGenerateContentItems({profile,language,generateDefault}){
  const content=poContentConfig(profile);
  if(content.mode==='generated') return generateDefault();
  const url=poManifestUrl(profile,language),bank=programOutputExerciseBanks.get(url);
  if(!bank) throw new Error(`${profile.id}: exercise manifest '${url}' has not been loaded`);
  const selection=content.selection||{},ordered=selection.shuffle?poShuffle(bank.exercises):bank.exercises.slice();
  const count=selection.count==='all'?ordered.length:(selection.count||profile.itemCount);
  if(count>ordered.length) throw new Error(`${profile.id}: requested ${count} items from a ${ordered.length}-exercise manifest`);
  if(profile.itemCount!=='manifest'&&count!==profile.itemCount)
    throw new Error(`${profile.id}: selected item count ${count} must match scoring.itemCount ${profile.itemCount}`);
  const items=ordered.slice(0,count).map((exercise,index)=>poBuildSourceItem(profile,exercise,bank.language,index+1));
  if(typeof assignManualResponsePlans==='function') assignManualResponsePlans(profile,items);
  return items;
}

registerProfileContentProvider({
  id:PROGRAM_OUTPUT_PLUGIN_MANIFEST.id,
  matches(profile){
    const content=poContentConfig(profile),lesson=profile&&profile.lesson||{};
    return ['generated','source-files'].includes(content.mode)&&lesson.focus==='output'
      &&profileWorkspacePresentation(profile)!=='source-program';
  },
  validateProfile:poValidateContentProfile,
  loadContent:poLoadExerciseContent,
  generateItems:poGenerateContentItems
});
