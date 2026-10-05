function programInputValueMode(profile){
  const mode=profileInputValueMode(profile);
  if(mode!=='authored'&&mode!=='seeded')
    throw new Error(`${profile&&profile.id||'program-input'}: inputValueMode must be 'authored' or 'seeded'`);
  return mode;
}

function programInputDirectives(metadata,filename,mode='authored'){
  return sourceProgramInputDirectives(metadata,filename,mode);
}

function programInputClaimDefinition(definitions,target,filename,line){
  return sourceProgramClaimInputDefinition(definitions,target,filename,line);
}

function programInputValidateDefinitions(definitions,filename){
  sourceProgramValidateInputDefinitions(definitions,filename);
}

function programInputRuntime(reads,rawInput){
  const runtime={started:false,playbackComplete:false,submitted:false,currentReadIndex:0,checked:false,
    transferComplete:false,transferAnimating:false,assignedValue:null,wasCorrectAssignment:null,correctSteps:0,totalOpSteps:0,
    rawInput,trace:[],history:[],reads:reads.map(()=>({tokenRead:false,converted:false,written:false}))};
  runtime.history=[programInputRuntimeSnapshot(runtime)];
  return runtime;
}

function programInputRuntimeSnapshot(runtime){
  return {started:runtime.started,playbackComplete:runtime.playbackComplete,submitted:runtime.submitted,
    transferComplete:runtime.transferComplete,currentReadIndex:runtime.currentReadIndex,checked:runtime.checked,assignedValue:runtime.assignedValue,
    wasCorrectAssignment:runtime.wasCorrectAssignment,correctSteps:runtime.correctSteps,totalOpSteps:runtime.totalOpSteps,
    reads:runtime.reads.map(read=>Object.assign({},read)),trace:runtime.trace.map(step=>Object.assign({},step))};
}

function programInputStatement(spec){
  const statement=inputStatement(spec);
  statement.runtime=programInputRuntime(statement.reads,statement.rawInput);return statement;
}

function programInputHydrateStatement(statement,context){
  if(!statement||statement.kind!=='input')return null;
  const reads=statement.reads.map(read=>{
    const definition=programInputClaimDefinition(context.definitions,read.target,context.filename,context.line);
    return Object.assign({},read,{expectedRaw:String(definition.materializedRaw),expectedValue:definition.materializedValue});
  });
  const rawInput=statement.inputSyntax==='c'
    ?coreInputRawText(statement.format,reads,`${context.filename}:${context.line}`):reads[0].expectedRaw;
  return programInputStatement(Object.assign({},statement,{id:`input-${context.statementIndex}`,reads,rawInput}));
}
