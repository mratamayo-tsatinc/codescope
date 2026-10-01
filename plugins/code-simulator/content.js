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

function csNextCodeLine(lines,start){
  for(let index=start;index<lines.length;index++){
    const text=lines[index].trim();
    if(text&&text!=='{'&&text!=='}'&&!/^break\s*;/.test(text)&&!/^case\b|^default\s*:/.test(text))
      return {line:index+1,text:lines[index]};
  }
  return {line:lines.length,text:lines[lines.length-1]||''};
}

function csBlockEnd(lines,start){
  let depth=0,opened=false;
  for(let index=start;index<lines.length;index++){
    for(const character of lines[index]){
      if(!opened){if(character==='{'){opened=true;depth=1;}continue;}
      if(character==='{')depth++;
      else if(character==='}'&&--depth===0)return index;
    }
  }
  return start;
}

function csIfHeader(line){
  const header=coreSelectionHeader(line);
  return header&&header.selectionKind!=='switch'
    ?{kind:header.selectionKind,condition:header.conditionSource}:null;
}

function csSwitchHeader(line){
  const header=coreSelectionHeader(line);
  return header&&header.selectionKind==='switch'?{condition:header.conditionSource}:null;
}

function csElseHeader(line){return /^\s*(?:}\s*)?else\s*\{/.test(line);}

function csNextMeaningfulLine(lines,start){
  for(let index=start;index<lines.length;index++) if(lines[index].trim()) return index;
  return -1;
}

function csFollowingClauseLine(lines,blockEnd){
  if(blockEnd>=0&&/^\s*}\s*else\b/.test(lines[blockEnd])) return blockEnd;
  return csNextMeaningfulLine(lines,blockEnd+1);
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
  return statement;
}

function csParseExercise(exercise,language,sourceValueMode='authored',inputValueMode='authored'){
  if(sourceValueMode!=='authored'&&sourceValueMode!=='seeded')
    throw new Error(`${exercise.filename}: sourceValueMode must be 'authored' or 'seeded'`);
  if(inputValueMode!=='authored'&&inputValueMode!=='seeded')
    throw new Error(`${exercise.filename}: inputValueMode must be 'authored' or 'seeded'`);
  const rawDetails=sourceProgramMetadataAndSource(exercise.raw,exercise.filename);
  const inputDefinitions=programInputDirectives(rawDetails.metadata,exercise.filename,inputValueMode);
  const inputValues=Object.fromEntries(inputDefinitions.map(definition=>[definition.target,definition.materializedValue]));
  const details=Object.assign(sourceProgramParseExercise({details:rawDetails,filename:exercise.filename,language,
    sourceValueMode,inputValues}),{inputValueMode,inputValues}),lines=details.lines;
  const coreProgramResult=details.coreProgramResult,coreStatementsByLine=details.statementsByLine;
  const memory={},kinds={},dataTypes={},declarations=[],statements=[],supported=new Map(),declarationsByLine=new Map();
  let declarationIndex=0,assignmentIndex=0,unaryIndex=0,outputIndex=0,inputIndex=0,breakIndex=0;
  const mark=statement=>supported.set(statement.sourceLine,{statementId:statement.id,primary:true});
  lines.forEach((raw,index)=>{
    const sharedStatement=coreStatementsByLine.get(index+1);
    const coreStatement=sharedStatement||null;
    if(!coreStatement)return;
    if(coreStatement&&coreStatement.kind==='declaration'){
      const {name,dataType}=coreStatement.binding,kind=coreStatement.binding.mutable?'variable':'constant';
      const initialized=coreStatement.initialized;
      const tree=initialized?coreExpressionIrToEngineTree(coreStatement.initializer,
        poExpressionSymbols(memory,kinds,dataTypes)):null;
      const semantic=evaluateAndApplyCoreStatement(coreStatement,memory,language,
        `declaration-${declarationIndex+1}`,'raw');
      const value=initialized?semantic.value:undefined;
      kinds[name]=kind;dataTypes[name]=dataType;
      const declaration={kind,name,value,dataType,initialized};declarations.push(declaration);
      const statement=coreStatement;statement.id=`declaration-${++declarationIndex}`;
      statement.binding.kind=kind;statement.runtime=initialized
        ?buildDeclarationRuntime(tree,value):buildUninitializedDeclarationRuntime();
      statement.runtime.expectedEffects=semantic.effects.filter(effect=>effect.scope==='expression');statement.runtime.semanticTrace=semantic.trace;
      statement.dependencies=tree?[...collectExpressionDependencies(statement.initializer)]:[];
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);
      declarationsByLine.set(index+1,{declaration,statement,initializer:coreStatement.initializer});return;
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
  const controlStructures=[],attachedElseIf=new Set();let selectionIndex=0;
  lines.forEach((line,index)=>{
    const header=csIfHeader(line);
    if(!header||header.kind!=='if'||attachedElseIf.has(index)) return;
    const clauses=[];let current={index,kind:'if',condition:header.condition},chainEnd=index,elseClause=null;
    while(current){
      current.end=csBlockEnd(lines,current.index);clauses.push(current);chainEnd=current.end;
      const following=csFollowingClauseLine(lines,current.end),nextHeader=following>=0?csIfHeader(lines[following]):null;
      if(nextHeader&&nextHeader.kind==='else-if'){
        attachedElseIf.add(following);current={index:following,kind:'else-if',condition:nextHeader.condition};continue;
      }
      if(following>=0&&csElseHeader(lines[following])){
        elseClause={index:following,end:csBlockEnd(lines,following)};chainEnd=elseClause.end;
      }
      current=null;
    }
    clauses.forEach(clause=>{
      const statement=csBuildSelection(`selection-${++selectionIndex}`,clause.kind,
        coreStatementsByLine.get(clause.index+1),clause.index,lines,memory,kinds,[],dataTypes,language);
      statement.selectionHasAlternative=clauses.length>1||!!elseClause;clause.statement=statement;mark(statement);statements.push(statement);
    });
    controlStructures.push({type:'if-chain',clauses,elseClause,end:chainEnd});
  });
  lines.forEach((line,index)=>{
    const header=csSwitchHeader(line);if(!header)return;
    const end=csBlockEnd(lines,index),cases=[];
    for(let row=index+1;row<end;row++){
      const location={filename:exercise.filename,start:{line:row+1,column:1},
        end:{line:row+1,column:Math.max(1,lines[row].length+1)}};
      const parsedLabel=coreSwitchLabel(lines[row],{language},poExpressionSymbols(memory,kinds,dataTypes),location);
      if(parsedLabel)cases.push(Object.assign({index:row},parsedLabel));
    }
    cases.forEach((entry,position)=>{entry.end=(cases[position+1]?cases[position+1].index:end)-1;});
    const statement=csBuildSelection(`selection-${++selectionIndex}`,'switch',
      coreStatementsByLine.get(index+1),index,lines,memory,kinds,[],dataTypes,language);
    mark(statement);statements.push(statement);controlStructures.push({type:'switch',statement,cases,end});
  });
  const executionMemory={};
  lines.forEach((raw,index)=>{
    const declarationEntry=declarationsByLine.get(index+1);
    if(declarationEntry){
      const {declaration,statement,initializer}=declarationEntry;
      if(declaration.initialized){
        const tree=coreExpressionIrToEngineTree(initializer,poExpressionSymbols(executionMemory,kinds,dataTypes));
        const semantic=evaluateAndApplyCoreStatement(statement,executionMemory,language,statement.id,'raw');
        const value=semantic.value;
        declaration.value=value;statement.initializer=engineNodeToProgramIr(tree);
        statement.runtime=buildDeclarationRuntime(tree,value);
        statement.runtime.expectedEffects=semantic.effects.filter(effect=>effect.scope==='expression');statement.runtime.semanticTrace=semantic.trace;
        statement.dependencies=[...collectExpressionDependencies(statement.initializer)];
      }else executionMemory[declaration.name]=undefined;
      return;
    }
    if(supported.has(index+1)) return;
    const trimmed=raw.trim();
    if(!trimmed.endsWith(';')) return;
    const text=trimmed.slice(0,-1).trim();
    const switchOwner=controlStructures.filter(structure=>structure.type==='switch'
      &&structure.cases.some(entry=>index>entry.index&&index<=entry.end))
      .sort((left,right)=>(left.end-left.statement.sourceLine)-(right.end-right.statement.sourceLine))[0];
    const sharedStatement=coreStatementsByLine.get(index+1);
    const coreStatement=sharedStatement||null;
    if(coreStatement&&coreStatement.kind==='program-break'&&switchOwner){
      const statement=coreStatement;statement.id=`program-break-${++breakIndex}`;
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];statement.switchStatementId=switchOwner.statement.id;
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
      ?buildOutputStatementRuntime(coreStatement,outputIndex,executionMemory):null;
    if(output&&coreStatement&&coreStatement.kind==='output')output.sourceSpan=coreStatement.sourceSpan;
    if(output){
      outputIndex++;output.sourceLine=index+1;output.sourceEndLine=index+1;output.sourceText=raw;
      output.sourceIndent=(raw.match(/^\s*/)||[''])[0];output.nextStatementId='$end';mark(output);statements.push(output);return;
    }
    if(coreStatement&&coreStatement.kind==='unary-update'){
      const statement=buildUnaryUpdateStatementRuntime(coreStatement.target,coreStatement.operator,
        coreStatement.form,executionMemory,unaryIndex++);
      statement.sourceSpan=coreStatement.sourceSpan;
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);return;
    }
    if(coreStatement&&coreStatement.kind==='assignment'){
      const tree=coreExpressionIrToEngineTree(coreStatement.value,poExpressionSymbols(executionMemory,kinds,dataTypes));
      const statement=buildAssignmentStatementRuntime(coreStatement.target,coreStatement.operator,tree,executionMemory,assignmentIndex++);
      statement.sourceSpan=coreStatement.sourceSpan;
      statement.targetDataType=dataTypes[coreStatement.target];
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);
    }
  });
  programInputValidateDefinitions(inputDefinitions,exercise.filename);
  Object.keys(memory).forEach(name=>delete memory[name]);Object.assign(memory,executionMemory);
  statements.sort((left,right)=>left.sourceLine-right.sourceLine);
  const firstStatementIn=(start,end)=>statements.find(statement=>statement.sourceLine>=start&&statement.sourceLine<=end)||null;
  const firstStatementAfter=end=>statements.find(statement=>statement.sourceLine>end)||null;
  const statementsIn=(start,end)=>statements.filter(statement=>statement.sourceLine>=start&&statement.sourceLine<=end);
  const targetDetails=statement=>statement?{line:statement.sourceLine,text:lines[statement.sourceLine-1],id:statement.id}
    :{line:lines.length,text:lines[lines.length-1]||'',id:'$end'};
  statements.forEach((statement,index)=>{
    if(statement.kind==='program-return')statement.nextStatementId='$end';
    else statement.nextStatementId=statements[index+1]?statements[index+1].id:'$end';
  });
  controlStructures.forEach(structure=>{
    const after=firstStatementAfter(structure.end),afterTarget=targetDetails(after);
    if(structure.type==='if-chain'){
      structure.clauses.forEach((clause,position)=>{
        const body=statementsIn(clause.index+2,clause.end),trueTarget=targetDetails(body[0]||after);
        const nextClause=structure.clauses[position+1];let falseStatement=null;
        if(nextClause) falseStatement=nextClause.statement;
        else if(structure.elseClause) falseStatement=firstStatementIn(structure.elseClause.index+2,structure.elseClause.end);
        else falseStatement=after;
        const falseTarget=targetDetails(falseStatement);
        clause.statement.branches=[
          {when:true,label:'TRUE',targetLine:trueTarget.line,targetText:trueTarget.text,nextStatementId:trueTarget.id,targetStatementId:trueTarget.id},
          {when:false,label:'FALSE',targetLine:falseTarget.line,targetText:falseTarget.text,nextStatementId:falseTarget.id,targetStatementId:falseTarget.id}
        ];
        if(body.length) body[body.length-1].nextStatementId=afterTarget.id;
      });
      if(structure.elseClause){
        const body=statementsIn(structure.elseClause.index+2,structure.elseClause.end);
        if(body.length) body[body.length-1].nextStatementId=afterTarget.id;
      }
      return;
    }
    const caseBodies=structure.cases.map(entry=>statementsIn(entry.index+2,entry.end+1));
    const nextCaseTarget=start=>{
      for(let position=start;position<caseBodies.length;position++) if(caseBodies[position].length) return caseBodies[position][0];
      return after;
    };
    structure.cases.forEach((entry,position)=>{
      const body=caseBodies[position],target=targetDetails(body[0]||nextCaseTarget(position+1));
      structure.statement.branches.push({value:entry.value,default:entry.default,label:entry.label,
        targetLine:target.line,targetText:target.text,nextStatementId:target.id,targetStatementId:target.id});
      body.filter(statement=>statement.kind==='program-break'&&statement.switchStatementId===structure.statement.id)
        .forEach(statement=>{statement.nextStatementId=afterTarget.id;});
      if(body.length&&body[body.length-1].kind!=='program-break')
        body[body.length-1].nextStatementId=targetDetails(nextCaseTarget(position+1)).id;
    });
    if(!structure.cases.some(entry=>entry.default)){
      structure.statement.branches.push({noMatch:true,label:'NO MATCH',targetLine:afterTarget.line,targetText:afterTarget.text,
        nextStatementId:afterTarget.id,targetStatementId:afterTarget.id});
    }
  });
  if(!statements.length) throw new Error(`${exercise.filename}: no supported executable statements were found`);
  const sourceDisplay={filename:exercise.filename,lines:lines.map((text,index)=>{const support=supported.get(index+1);return {number:index+1,text,supported:!!support,statementId:support&&support.statementId||null,primary:!!support};})};
  return {details,lines,memory,kinds,dataTypes,declarations,statements,sourceDisplay,
    coreProgram:coreProgramResult.ir,coreDiagnostics:coreProgramResult.diagnostics};
}

function csBuildItem(profile,exercise,language,itemNumber){
  const parsed=csParseExercise(exercise,language,csSourceValueMode(profile),csInputValueMode(profile)),last=parsed.declarations[parsed.declarations.length-1];
  const resultName=parsed.details.resultName||(last&&last.name)||'result';
  if(parsed.details.resultName&&!Object.prototype.hasOwnProperty.call(parsed.memory,resultName))
    throw new Error(`${exercise.filename}: @result '${resultName}' is not declared`);
  const resultKind=parsed.kinds[resultName]||'variable',resultValue=parsed.memory[resultName];
  const originalTree=last?makeNamed(resultKind,resultName,resultValue):makeLiteral(0),originalFlat=flattenInstance(originalTree);
  const item={profileId:profile.id,itemNumber,exerciseId:exercise.id,filename:exercise.filename,exerciseTitle:parsed.details.title,
    source:parsed.details.source,sourceTemplate:parsed.details.templateSource,sourceSeedValues:parsed.details.seedValues,
    sourceValueMode:parsed.details.sourceValueMode,sourceInputValues:parsed.details.inputValues,
    inputValueMode:parsed.details.inputValueMode,sourceDisplay:parsed.sourceDisplay,sourceFlow:true,language,originalTree,originalFlat,
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
