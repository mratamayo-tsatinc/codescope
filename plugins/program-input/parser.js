function programInputValueMode(profile){
  const mode=profile&&profile.content&&profile.content.inputValueMode||'authored';
  if(mode!=='authored'&&mode!=='seeded')
    throw new Error(`${profile&&profile.id||'program-input'}: inputValueMode must be 'authored' or 'seeded'`);
  return mode;
}

function programInputDirectives(metadata,filename,mode='authored'){
  const definitions=[];
  String(metadata||'').split('\n').forEach((raw,index)=>{
    const line=raw.replace(/^\s*\*?\s*/,'').trim();
    if(!line.startsWith('@input')) return;
    const fields={};
    line.slice(6).trim().split(/\s+/).filter(Boolean).forEach(part=>{
      const match=/^([A-Za-z][A-Za-z0-9]*)=(.+)$/.exec(part);
      if(!match) throw new Error(`${filename}: metadata line ${index+1}: invalid @input field '${part}'`);
      fields[match[1]]=match[2];
    });
    const allowed=new Set(['target','value','min','max']);
    Object.keys(fields).forEach(name=>{if(!allowed.has(name))
      throw new Error(`${filename}: metadata line ${index+1}: unsupported @input field '${name}'`);});
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fields.target||''))
      throw new Error(`${filename}: metadata line ${index+1}: @input requires target=<identifier>`);
    const value=Number(fields.value),min=Number(fields.min),max=Number(fields.max);
    if(!Number.isSafeInteger(value)||!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min>max||value<min||value>max)
      throw new Error(`${filename}: metadata line ${index+1}: integer input requires value/min/max with min <= value <= max`);
    if(definitions.some(definition=>definition.target===fields.target))
      throw new Error(`${filename}: metadata line ${index+1}: duplicate @input target '${fields.target}'`);
    definitions.push({target:fields.target,value,min,max,
      materializedValue:mode==='seeded'?randInt(min,max):value,used:false,metadataLine:index+1});
  });
  return definitions;
}

function programInputClaimDefinition(definitions,target,filename,line){
  const definition=definitions.find(candidate=>!candidate.used&&candidate.target===target);
  if(!definition) throw new Error(`${filename}:${line}: input target '${target}' has no matching @input metadata`);
  definition.used=true;return definition;
}

function programInputValidateDefinitions(definitions,filename){
  const unused=definitions.find(candidate=>!candidate.used);
  if(unused) throw new Error(`${filename}: @input target '${unused.target}' does not match a supported input statement`);
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
  return {id:spec.id||null,kind:'input',inputSyntax:spec.inputSyntax,readerName:spec.readerName||'input',
    format:spec.format||null,reads:spec.reads,rawInput:spec.rawInput,sourceSpan:spec.sourceSpan||null,
    runtime:programInputRuntime(spec.reads,spec.rawInput)};
}

function programInputLooksLikeSourceLine(text,language){
  if(language==='c') return /^scanf\s*\(/.test(text);
  return /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*[A-Za-z_][A-Za-z0-9_]*\.nextInt\s*\(\s*\)$/.test(text);
}

function programInputParseC(text,context){
  const match=/^scanf\s*\(\s*"([^"]*)"\s*,\s*(.+)\)$/.exec(text);
  if(!match) return null;
  const format=match[1],formats=[...format.matchAll(/%([di])/g)];
  if(!formats.length) throw new Error(`${context.filename}:${context.line}: scanf requires a supported integer conversion`);
  if(!/^%[di](?:\s+%[di])*$/.test(format))
    throw new Error(`${context.filename}:${context.line}: numeric scanf currently supports integer conversions separated by whitespace`);
  const args=match[2].split(',').map(value=>value.trim());
  if(args.length!==formats.length) throw new Error(`${context.filename}:${context.line}: scanf conversion and destination counts differ`);
  const reads=args.map((argument,index)=>{
    const targetMatch=/^&([A-Za-z_][A-Za-z0-9_]*)$/.exec(argument);
    if(!targetMatch) throw new Error(`${context.filename}:${context.line}: scanf integer destinations must use &identifier`);
    const target=targetMatch[1];
    if(context.kinds[target]!=='variable'||context.dataTypes[target]!=='int')
      throw new Error(`${context.filename}:${context.line}: scanf %${formats[index][1]} requires mutable int target '${target}'`);
    const definition=programInputClaimDefinition(context.definitions,target,context.filename,context.line);
    return {target,dataType:'int',conversion:formats[index][1],expectedRaw:String(definition.materializedValue),
      expectedValue:definition.materializedValue};
  });
  let readIndex=0;
  const rawInput=format.replace(/%[di]/g,()=>reads[readIndex++].expectedRaw);
  return programInputStatement({id:`input-${context.statementIndex}`,inputSyntax:'c',readerName:'scanf',format,reads,rawInput});
}

function programInputParseJava(text,context){
  const match=/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.nextInt\s*\(\s*\)$/.exec(text);
  if(!match) return null;
  const target=match[1];
  if(context.kinds[target]!=='variable'||context.dataTypes[target]!=='int')
    throw new Error(`${context.filename}:${context.line}: nextInt() requires mutable int target '${target}'`);
  const definition=programInputClaimDefinition(context.definitions,target,context.filename,context.line);
  const read={target,dataType:'int',conversion:'nextInt',expectedRaw:String(definition.materializedValue),
    expectedValue:definition.materializedValue};
  return programInputStatement({id:`input-${context.statementIndex}`,inputSyntax:'java',readerName:match[2],
    reads:[read],rawInput:read.expectedRaw});
}

function programInputParseSourceLine(text,context){
  return context.language==='c'?programInputParseC(text,context):programInputParseJava(text,context);
}
