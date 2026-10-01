// ============================================================================
// SHARED INPUT STATEMENT CORE
// ----------------------------------------------------------------------------
// Parses C scanf and Java Scanner nextInt statements and describes their
// console-read and memory-write semantics without presentation state.
// ============================================================================

function coreInputLooksLikeSource(source,language){
  const text=String(source||'').trim().replace(/;\s*$/,'').trim();
  return language==='c'?/^scanf\s*\(/.test(text)
    :/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*[A-Za-z_][A-Za-z0-9_]*\.nextInt\s*\(\s*\)$/.test(text);
}

function coreInputValue(inputValues,target){
  if(!inputValues||!Object.prototype.hasOwnProperty.call(inputValues,target))return null;
  const entry=inputValues[target];
  return entry&&typeof entry==='object'&&Object.prototype.hasOwnProperty.call(entry,'value')?entry.value:entry;
}

function coreInputRead(target,conversion,symbols,inputValues,label){
  const binding=symbols[target];
  if(!binding||binding.mutable===false||binding.kind==='constant'||binding.dataType!=='int')
    throw new Error(`${label}: integer input requires mutable int target '${target}'`);
  const value=coreInputValue(inputValues,target);
  return {target,dataType:'int',conversion,expectedRaw:value==null?'':String(value),expectedValue:value};
}

function parseCoreInputStatement(request,symbols,location){
  const language=String(request.language||'c').toLowerCase();
  const source=String(request.source||'').trim().replace(/;\s*$/,'').trim();
  const label=`${location.filename||'source'}:${location.start.line}`;
  if(language==='c'){
    const match=/^scanf\s*\(\s*"([^"]*)"\s*,\s*(.+)\)$/.exec(source);if(!match)return null;
    const format=match[1],formats=[...format.matchAll(/%([di])/g)];
    if(!formats.length)throw new Error(`${label}: scanf requires a supported integer conversion`);
    if(!/^%[di](?:\s+%[di])*$/.test(format))
      throw new Error(`${label}: numeric scanf supports integer conversions separated by whitespace`);
    const args=coreSplitDelimited(match[2],',',label);
    if(args.length!==formats.length)throw new Error(`${label}: scanf conversion and destination counts differ`);
    const reads=args.map((argument,index)=>{
      const target=/^&([A-Za-z_][A-Za-z0-9_]*)$/.exec(argument);
      if(!target)throw new Error(`${label}: scanf integer destinations must use &identifier`);
      return coreInputRead(target[1],formats[index][1],symbols,request.inputValues,label);
    });
    let readIndex=0;const rawInput=format.replace(/%[di]/g,()=>reads[readIndex++].expectedRaw);
    return inputStatement({inputSyntax:'c',readerName:'scanf',format,reads,rawInput,sourceSpan:location});
  }
  const match=/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.nextInt\s*\(\s*\)$/.exec(source);
  if(!match)return null;
  const read=coreInputRead(match[1],'nextInt',symbols,request.inputValues,label);
  return inputStatement({inputSyntax:'java',readerName:match[2],reads:[read],rawInput:read.expectedRaw,sourceSpan:location});
}

function evaluateCoreInputStatement(statement){
  const effects=[{kind:'input',scope:'statement',rawText:statement.rawInput,
    tokens:statement.reads.map(read=>read.expectedRaw)}];
  const trace=[{action:'CALL_INPUT',readerName:statement.readerName},
    {action:'INPUT_SUBMIT',rawText:statement.rawInput},
    {action:'CONVERT_INPUT_BATCH',transfers:statement.reads.map((read,index)=>({readIndex:index,
      rawValue:read.expectedRaw,value:read.expectedValue,target:read.target}))}];
  statement.reads.forEach((read,index)=>{
    effects.push({kind:'write',scope:'statement',target:read.target,previousValue:undefined,
      nextValue:read.expectedValue,dataType:read.dataType,inputReadIndex:index});
    trace.push({action:'WRITE_INPUT',readIndex:index,target:read.target,result:read.expectedValue});
  });
  return {value:statement.reads[statement.reads.length-1].expectedValue,
    dependencies:statement.reads.map(read=>read.target),effects,trace};
}
