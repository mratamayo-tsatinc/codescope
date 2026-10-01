// ============================================================================
// SHARED OUTPUT STATEMENT CORE
// ----------------------------------------------------------------------------
// Parses and evaluates C printf and Java System.out.print/println as the same
// language-neutral output Statement IR. It contains no timeline or DOM logic.
// ============================================================================

function coreSplitDelimited(source,delimiter,label){
  const parts=[];let start=0,quote=null,escaped=false,depth=0;
  for(let index=0;index<source.length;index++){
    const character=source[index];
    if(quote){
      if(escaped)escaped=false;
      else if(character==='\\')escaped=true;
      else if(character===quote)quote=null;
      continue;
    }
    if(character==='"'||character==="'"){quote=character;continue;}
    if(character==='(')depth++;
    else if(character===')')depth--;
    else if(character===delimiter&&depth===0){parts.push(source.slice(start,index).trim());start=index+1;}
  }
  if(quote||depth!==0)throw new Error(`${label}: malformed argument list`);
  parts.push(source.slice(start).trim());return parts;
}

function coreParseCStringSequence(source,label){
  let index=0,value='',found=false;
  while(index<source.length){
    while(/\s/.test(source[index]||''))index++;
    if(source[index]!=='"')throw new Error(`${label}: printf format must be a string literal`);
    found=true;index++;let raw='',escaped=false,closed=false;
    for(;index<source.length;index++){
      const character=source[index];
      if(escaped){raw+='\\'+character;escaped=false;continue;}
      if(character==='\\'){escaped=true;continue;}
      if(character==='"'){index++;closed=true;break;}
      raw+=character;
    }
    if(!closed)throw new Error(`${label}: unterminated printf format string`);
    value+=decodeCoreStringEscape(raw,label);
  }
  if(!found)throw new Error(`${label}: printf format string is required`);
  return value;
}

function coreOutputExpression(source,symbols,label,format,language,location){
  const parsed=coreParseExpression({language:language||'c',source,symbols,location});
  return {kind:'expression',expression:parsed.ir,format:format||'raw',source:String(source).trim()};
}

function coreCOutputParts(format,args,symbols,label,language,location){
  const parts=[];let text='',argumentIndex=0;
  const flush=()=>{if(text){parts.push({kind:'text',value:text});text='';}};
  for(let index=0;index<format.length;index++){
    if(format[index]!=='%'){text+=format[index];continue;}
    let token='',specifier=format[++index];
    if(specifier==='%'){text+='%';continue;}
    if(specifier==='0'){token='0';specifier=format[++index];}
    if(specifier==='.'){ 
      token+='.';specifier=format[++index];
      while(/\d/.test(specifier||'')){token+=specifier;specifier=format[++index];}
    }
    token+=specifier||'';
    if(!/^(?:d|i|c|s|f|0?\.\d+f)$/.test(token))throw new Error(`${label}: unsupported printf format '%${token}'`);
    const argument=args[argumentIndex++];
    if(argument==null)throw new Error(`${label}: printf argument count does not match its placeholders`);
    flush();parts.push(coreOutputExpression(argument,symbols,label,token,language,location));
  }
  flush();
  if(argumentIndex!==args.length)throw new Error(`${label}: printf argument count does not match its placeholders`);
  return parts.length?parts:[{kind:'text',value:''}];
}

function parseCoreOutputStatement(request,symbols,location){
  const source=String(request.source||'').trim().replace(/;\s*$/,'').trim();
  const language=String(request.language||'c').toLowerCase();
  const label=`${location.filename||'source'}:${location.start.line}`;
  if(language==='c'){
    const match=/^printf\s*\(([\s\S]*)\)$/.exec(source);if(!match)return null;
    const args=coreSplitDelimited(match[1],',',label),format=coreParseCStringSequence(args.shift(),label);
    const newline=format.endsWith('\n'),visible=newline?format.slice(0,-1):format;
    return outputStatement({newline,parts:coreCOutputParts(visible,args,symbols,label,language,location),sourceSpan:location});
  }
  const match=/^System\.out\.(print|println)\s*\(([\s\S]*)\)$/.exec(source);if(!match)return null;
  const pieces=coreSplitDelimited(match[2],'+',label),parts=pieces.map(piece=>{
    const string=/^"((?:\\.|[^"\\])*)"$/.exec(piece);
    return string?{kind:'text',value:decodeCoreStringEscape(string[1],label)}
      :coreOutputExpression(piece,symbols,label,'raw',language,location);
  });
  return outputStatement({newline:match[1]==='println',parts,sourceSpan:location});
}

function coreTerminalScreen(stream){
  const lines=[''];let row=0,column=0;
  for(const character of String(stream||'')){
    if(character==='\n'){row++;column=0;if(lines[row]===undefined)lines[row]='';continue;}
    if(character==='\r'){column=0;continue;}
    if(character==='\b'){column=Math.max(0,column-1);continue;}
    const line=lines[row]||'';
    lines[row]=column<line.length
      ?line.slice(0,column)+character+line.slice(column+1)
      :line.padEnd(column,' ')+character;
    column++;
  }
  return {lines,row,column,text:lines.join('\n')};
}

function coreFormatOutputValue(value,format){
  const spec=String(format||'d');
  if(spec==='s')return String(value==null?'':value);
  if(spec==='c')return typeof value==='number'?String.fromCodePoint(value):String(value==null?'':value);
  const float=/^0?(?:\.(\d+))?f$/.exec(spec);
  if(float){const numeric=Number(value);return Number.isFinite(numeric)
    ?numeric.toFixed(float[1]===undefined?6:Number(float[1])):String(value);}
  if(spec==='d'||spec==='i'){const numeric=Number(value);return Number.isFinite(numeric)?String(Math.trunc(numeric)):String(value);}
  return String(value==null?'':value);
}

function evaluateCoreOutputStatement(statement,memory,language){
  const effects=[],trace=[],values=[];
  const text=statement.parts.map((part,index)=>{
    if(part.kind==='text')return part.value;
    const evaluated=coreEvaluateExpression({language:language||'c',expression:part.expression,memory});
    effects.push(...evaluated.effects.map(effect=>Object.assign({scope:'expression',partIndex:index},effect)));
    trace.push(...evaluated.trace.map(step=>Object.assign({partIndex:index},step)));
    const name=part.expression.kind==='identifier'?part.expression.name:null;
    trace.push({action:'FORMAT_OUTPUT_VALUE',partIndex:index,target:name,format:part.format,value:evaluated.value,
      result:coreFormatOutputValue(evaluated.value,part.format)});
    values[index]=evaluated.value;
    return coreFormatOutputValue(evaluated.value,part.format);
  }).join('')+(statement.newline?'\n':'');
  effects.push({kind:'output',scope:'statement',text});
  trace.push({action:'PRINT',text});
  return {value:text,dependencies:[...new Set(statement.parts.flatMap(part=>part.kind==='expression'
    ?[...collectExpressionDependencies(part.expression)]:[]))],effects,trace,partValues:values};
}
