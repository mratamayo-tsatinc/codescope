// ============================================================================
// SHARED SIMPLE STATEMENT PARSER
// ----------------------------------------------------------------------------
// Owns the C/Java grammar shared by sourced activities for declarations,
// assignments, standalone unary updates, break, and the C `return 0` marker.
// Future constructs remain with their adapters until their dedicated core
// migration phases.
// ============================================================================

function coreStatementLocation(request,source){
  if(request.location) return languageCoreSourceLocation(request.location);
  return languageCoreSourceLocation({filename:request.filename||null,
    start:{line:request.line||1,column:1},
    end:{line:request.line||1,column:Math.max(1,String(source).length+1)}});
}

function coreStatementUnsupported(source,location){
  return {ir:null,diagnostics:[{code:'UNSUPPORTED_STATEMENT',severity:'info',
    message:`Unsupported statement '${source.trim()}'`,location,recoverable:true}],
    dependencies:[],effects:[],trace:[]};
}

function coreSplitTopLevelCommaSegments(source){
  const segments=[];let start=0,quote=null,escaped=false,paren=0,bracket=0,brace=0;
  for(let index=0;index<=source.length;index++){
    const character=source[index];
    if(index===source.length||character===','&&!quote&&paren===0&&bracket===0&&brace===0){
      segments.push({text:source.slice(start,index),start,end:index});start=index+1;continue;
    }
    if(escaped){escaped=false;continue;}
    if(quote){if(character==='\\')escaped=true;else if(character===quote)quote=null;continue;}
    if(character==='"'||character==="'"){quote=character;continue;}
    if(character==='(')paren++;else if(character===')')paren=Math.max(0,paren-1);
    else if(character==='[')bracket++;else if(character===']')bracket=Math.max(0,bracket-1);
    else if(character==='{')brace++;else if(character==='}')brace=Math.max(0,brace-1);
  }
  return segments;
}

function coreDeclarationFragments(source,language){
  const pattern=language==='java'
    ?/^(\s*(final\s+)?(int|float|double|char|String)\s+)([\s\S]*?)(\s*;\s*)$/
    :/^(\s*(const\s+)?(int|float|double|char)\s+)([\s\S]*?)(\s*;\s*)$/;
  const declaration=pattern.exec(String(source||''));if(!declaration)return null;
  const prefix=declaration[1],body=declaration[4],bodyStart=prefix.length;
  const fragments=coreSplitTopLevelCommaSegments(body).map(segment=>{
    const match=/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(?:(\s*=\s*)([\s\S]*?))?(\s*)$/.exec(segment.text);
    if(!match)return null;
    const initializerStart=match[3]===undefined?null:bodyStart+segment.start+match[1].length+match[2].length+match[3].length;
    return {name:match[2],dataType:declaration[3]==='String'?'string':declaration[3],
      immutable:!!declaration[2],initializer:match[4]===undefined?null:match[4],initializerStart,
      initializerEnd:initializerStart===null?null:initializerStart+match[4].length,
      statementText:`${prefix}${segment.text.trim()};`};
  });
  return fragments.some(fragment=>!fragment)?null:fragments;
}

function coreStatementParseExpression(spec,statementSource,location){
  try{return coreParseExpression(spec);}
  catch(error){
    if(/unsupported expression(?: token)?/.test(String(error&&error.message)))
      return null;
    throw error;
  }
}

function parseCoreStatement(request){
  const language=String(request.language||'c').toLowerCase();
  const original=String(request.source||'');
  const source=original.trim().replace(/;\s*$/,'').trim();
  const location=coreStatementLocation(request,original);
  const symbols=coreExpressionSymbolTable(request.symbols);
  if(!source) return coreStatementUnsupported(source,location);

  const loop=!request._skipLoop&&typeof parseCoreLoopStatement==='function'
    ?parseCoreLoopStatement(Object.assign({},request,{source}),symbols,location):null;
  if(loop){const dependencies=new Set();if(loop.condition)collectExpressionDependencies(loop.condition,dependencies);
    if(loop.initializer)collectStatementDependencies(loop.initializer,dependencies);
    if(loop.update)collectStatementDependencies(loop.update,dependencies);
    return {ir:loop,dependencies:[...dependencies],diagnostics:[],effects:[],trace:[]};}

  const selection=typeof parseCoreSelectionStatement==='function'
    ?parseCoreSelectionStatement(Object.assign({},request,{source}),symbols,location):null;
  if(selection)return {ir:selection,dependencies:[...collectExpressionDependencies(selection.condition)],
    diagnostics:[],effects:[],trace:[]};
  const input=typeof parseCoreInputStatement==='function'
    ?parseCoreInputStatement(Object.assign({},request,{source}),symbols,location):null;
  if(input)return {ir:input,dependencies:input.reads.map(read=>read.target),diagnostics:[],effects:[],trace:[]};
  const output=typeof parseCoreOutputStatement==='function'
    ?parseCoreOutputStatement(Object.assign({},request,{source}),symbols,location):null;
  if(output)return {ir:output,dependencies:[...collectExpressionDependenciesFromParts(output.parts)],
    diagnostics:[],effects:[],trace:[]};

  if(source==='break'){
    const statement=programBreakStatement({sourceSpan:location});
    return {ir:statement,dependencies:[],diagnostics:[],effects:[],trace:[]};
  }
  if(language==='c'&&/^return\s+0$/.test(source)){
    const statement=programReturnStatement({value:0,sourceSpan:location});
    return {ir:statement,dependencies:[],diagnostics:[],effects:[],trace:[]};
  }

  if(language==='c'){
    const define=/^#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+([\s\S]+)$/.exec(source);
    if(define){
      const name=define[1];
      if(Object.prototype.hasOwnProperty.call(symbols,name))
        throw new Error(`${location.filename||'source'}:${location.start.line}: duplicate declaration '${name}'`);
      const parsed=coreStatementParseExpression({language,source:define[2],symbols,location},source,location);
      if(!parsed)return coreStatementUnsupported(source,location);
      const dataType=parsed.ir.dataType||(typeof parsed.ir.value==='string'?'string':'float');
      const statement=declarationStatement({name,dataType,mutable:false,initializer:parsed.ir,sourceSpan:location});
      statement.binding.kind='constant';statement.declarationSyntax='define';
      return {ir:statement,dependencies:parsed.dependencies,diagnostics:[],effects:[],trace:[]};
    }
    const characterArray=/^(const\s+)?char\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*(\d*)\s*\](?:\s*=\s*([\s\S]+))?$/.exec(source);
    if(characterArray){
      const name=characterArray[2];
      if(Object.prototype.hasOwnProperty.call(symbols,name))
        throw new Error(`${location.filename||'source'}:${location.start.line}: duplicate declaration '${name}'`);
      const initialized=characterArray[4]!==undefined;
      if(characterArray[1]&&!initialized)
        throw new Error(`${location.filename||'source'}:${location.start.line}: constant '${name}' requires an initializer`);
      const parsed=initialized?coreStatementParseExpression({language,source:characterArray[4],symbols,location},source,location):null;
      if(initialized&&(!parsed||parsed.ir.kind!=='literal'||typeof parsed.ir.value!=='string'))
        throw new Error(`${location.filename||'source'}:${location.start.line}: char[] initializer must be a string literal`);
      const statement=declarationStatement({name,dataType:'string',mutable:!characterArray[1],
        initialized,initializer:parsed&&parsed.ir,sourceSpan:location});
      statement.binding.kind=characterArray[1]?'constant':'variable';statement.declarationSyntax='char-array';
      statement.arrayCapacity=characterArray[3]?Number(characterArray[3]):null;
      return {ir:statement,dependencies:[],diagnostics:[],effects:[],trace:[]};
    }
  }

  const declarationPattern=language==='java'
    ?/^(final\s+)?(int|float|double|char|String)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*([\s\S]+))?$/
    :/^(const\s+)?(int|float|double|char)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*([\s\S]+))?$/;
  const declaration=declarationPattern.exec(source);
  if(declaration){
    const immutable=!!declaration[1],dataType=declaration[2]==='String'?'string':declaration[2],name=declaration[3];
    const initialized=declaration[4]!==undefined;
    if(Object.prototype.hasOwnProperty.call(symbols,name))
      throw new Error(`${location.filename||'source'}:${location.start.line}: duplicate declaration '${name}'`);
    if(immutable&&!initialized)
      throw new Error(`${location.filename||'source'}:${location.start.line}: constant '${name}' requires an initializer`);
    const parsed=initialized?coreStatementParseExpression({language,source:declaration[4],symbols,location},source,location):null;
    if(initialized&&!parsed) return coreStatementUnsupported(source,location);
    const statement=declarationStatement({name,dataType,mutable:!immutable,initialized,
      initializer:parsed&&parsed.ir,sourceSpan:location});
    statement.binding.kind=immutable?'constant':'variable';
    return {ir:statement,dependencies:parsed?parsed.dependencies:[],diagnostics:[],effects:[],trace:[]};
  }

  const unary=/^(?:([+]{2}|[-]{2})\s*([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*)\s*([+]{2}|[-]{2}))$/.exec(source);
  if(unary){
    const prefix=!!unary[1],name=unary[2]||unary[3],operator=unary[1]||unary[4],binding=symbols[name];
    if(!binding||binding.initialized===false||binding.value===undefined)
      throw new Error(`${location.filename||'source'}:${location.start.line}: '${name}' is used before it is initialized`);
    if(binding.mutable===false||binding.kind==='constant')
      throw new Error(`${location.filename||'source'}:${location.start.line}: unary update requires a mutable variable`);
    const statement=unaryUpdateStatement({target:name,operator,form:prefix?'prefix':'postfix',sourceSpan:location});
    return {ir:statement,dependencies:[name],diagnostics:[],effects:[],trace:[]};
  }

  const assignment=/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=|\*=|\/=|%=)\s*([\s\S]+)$/.exec(source);
  if(assignment){
    const target=assignment[1],operator=assignment[2],binding=symbols[target];
    if(!binding||binding.mutable===false||binding.kind==='constant')
      throw new Error(`${location.filename||'source'}:${location.start.line}: assignment requires a mutable variable`);
    if(operator!=='='&&(binding.initialized===false||binding.value===undefined))
      throw new Error(`${location.filename||'source'}:${location.start.line}: '${target}' is used before it is initialized`);
    const parsed=coreStatementParseExpression({language,source:assignment[3],symbols,location},source,location);
    if(!parsed) return coreStatementUnsupported(source,location);
    const statement=assignmentStatement({target,operator,value:parsed.ir,sourceSpan:location});
    return {ir:statement,dependencies:parsed.dependencies,diagnostics:[],effects:[],trace:[]};
  }

  return coreStatementUnsupported(source,location);
}

function collectStatementDependencies(statement,out){
  out=out||new Set();if(!statement)return out;
  if(statement.kind==='declaration'&&statement.initializer)collectExpressionDependencies(statement.initializer,out);
  else if(statement.kind==='assignment'){out.add(statement.target);collectExpressionDependencies(statement.value,out);}
  else if(statement.kind==='unary-update')out.add(statement.target);
  else if(statement.kind==='expression')collectExpressionDependencies(statement.expression,out);
  return out;
}

registerLanguageCoreService('parseStatement',parseCoreStatement);

function collectExpressionDependenciesFromParts(parts){
  const dependencies=new Set();
  (parts||[]).forEach(part=>{if(part.kind==='expression')collectExpressionDependencies(part.expression,dependencies);});
  return dependencies;
}
