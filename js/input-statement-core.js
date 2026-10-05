// ============================================================================
// SHARED INPUT STATEMENT CORE
// ----------------------------------------------------------------------------
// Parses C scanf and Java Scanner statements and describes their
// console-read and memory-write semantics without presentation state.
// ============================================================================

function coreInputLooksLikeSource(source,language){
  const text=String(source||'').trim().replace(/;\s*$/,'').trim();
  return language==='c'?/^scanf\s*\(/.test(text)
    :/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*[A-Za-z_][A-Za-z0-9_]*\.(?:nextInt|nextFloat|nextDouble|next|nextLine)\s*\(\s*\)(?:\.charAt\s*\(\s*0\s*\))?$/.test(text);
}

function coreInputValueEntry(inputValues,target){
  if(!inputValues||!Object.prototype.hasOwnProperty.call(inputValues,target))return null;
  const entry=inputValues[target];
  return entry&&typeof entry==='object'&&Object.prototype.hasOwnProperty.call(entry,'value')
    ?entry:{value:entry,raw:entry==null?'':String(entry)};
}

function coreInputTypeForConversion(conversion){
  return ({d:'int',i:'int',f:'float',lf:'double',c:'char',s:'string',nextInt:'int',nextFloat:'float',
    nextDouble:'double',next:'string',nextLine:'string',nextChar:'char'})[conversion]||null;
}

function coreInputFormatParts(format,label){
  const parts=[];let text='',index=0;
  const flush=()=>{if(text){parts.push({kind:'text',value:text});text='';}};
  while(index<format.length){
    if(format[index]!=='%'){text+=format[index++];continue;}
    if(format[index+1]==='%'){text+='%';index+=2;continue;}
    const conversion=/^(lf|[difcs])/.exec(format.slice(index+1));
    if(!conversion)throw new Error(`${label}: unsupported scanf conversion near '${format.slice(index)}'`);
    flush();parts.push({kind:'conversion',conversion:conversion[1]});index+=1+conversion[1].length;
  }
  flush();
  if(!parts.some(part=>part.kind==='conversion'))throw new Error(`${label}: scanf requires a supported conversion`);
  return parts;
}

function coreInputRawText(format,reads,label='scanf'){
  const parts=coreInputFormatParts(format,label);let readIndex=0;
  return parts.map((part,index)=>{
    if(part.kind==='conversion')return reads[readIndex++].expectedRaw;
    let value=part.value.replace(/\s+/g,' ');
    if(!parts.slice(0,index).some(candidate=>candidate.kind==='conversion'))value=value.replace(/^\s+/, '');
    if(!parts.slice(index+1).some(candidate=>candidate.kind==='conversion'))value=value.replace(/\s+$/, '');
    return value;
  }).join('');
}

function coreInputRead(target,conversion,symbols,inputValues,label){
  const binding=symbols[target];
  const dataType=coreInputTypeForConversion(conversion);
  if(!binding||binding.mutable===false||binding.kind==='constant'||binding.dataType!==dataType)
    throw new Error(`${label}: ${conversion} input requires mutable ${dataType} target '${target}'`);
  const entry=coreInputValueEntry(inputValues,target),value=entry&&entry.value;
  const raw=value==null?'':String(entry.raw==null?value:entry.raw);
  if(value!=null){
    if(dataType==='int'&&!Number.isSafeInteger(value))throw new Error(`${label}: input for '${target}' must be an integer`);
    if(dataType==='int'&&!/^[+-]?\d+$/.test(raw))throw new Error(`${label}: input text for '${target}' must be an integer`);
    if((dataType==='float'||dataType==='double')&&(typeof value!=='number'||!Number.isFinite(value)))
      throw new Error(`${label}: input for '${target}' must be a finite number`);
    if((dataType==='float'||dataType==='double')&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
      throw new Error(`${label}: input text for '${target}' must be numeric`);
    if(dataType==='char'&&(typeof value!=='string'||[...value].length!==1))
      throw new Error(`${label}: input for '${target}' must be one character`);
    if(dataType==='string'&&typeof value!=='string')throw new Error(`${label}: input for '${target}' must be a string`);
    if((conversion==='s'||conversion==='next')&&/\s/.test(value))
      throw new Error(`${label}: ${conversion} input for '${target}' must be one whitespace-free token`);
  }
  return {target,dataType,conversion,addressRequired:dataType!=='string',
    expectedRaw:raw,expectedValue:value};
}

function parseCoreInputStatement(request,symbols,location){
  const language=String(request.language||'c').toLowerCase();
  const source=String(request.source||'').trim().replace(/;\s*$/,'').trim();
  const label=`${location.filename||'source'}:${location.start.line}`;
  if(language==='c'){
    const match=/^scanf\s*\(\s*"([^"]*)"\s*,\s*(.+)\)$/.exec(source);if(!match)return null;
    const format=match[1],formatParts=coreInputFormatParts(format,label),
      formats=formatParts.filter(part=>part.kind==='conversion');
    const args=coreSplitDelimited(match[2],',',label);
    if(args.length!==formats.length)throw new Error(`${label}: scanf conversion and destination counts differ`);
    const reads=args.map((argument,index)=>{
      const conversion=formats[index].conversion,stringInput=conversion==='s';
      const target=(stringInput?/^([A-Za-z_][A-Za-z0-9_]*)$/:/^&([A-Za-z_][A-Za-z0-9_]*)$/).exec(argument);
      if(!target)throw new Error(`${label}: scanf ${conversion} destination must use ${stringInput?'identifier':'&identifier'}`);
      return coreInputRead(target[1],conversion,symbols,request.inputValues,label);
    });
    const rawInput=coreInputRawText(format,reads,label);
    return inputStatement({inputSyntax:'c',readerName:'scanf',format,reads,rawInput,sourceSpan:location});
  }
  const match=/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.(nextInt|nextFloat|nextDouble|next|nextLine)\s*\(\s*\)(\.charAt\s*\(\s*0\s*\))?$/.exec(source);
  if(!match)return null;
  const conversion=match[4]?'nextChar':match[3];
  if(match[4]&&match[3]!=='next')throw new Error(`${label}: character input must use next().charAt(0)`);
  const read=coreInputRead(match[1],conversion,symbols,request.inputValues,label);
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
