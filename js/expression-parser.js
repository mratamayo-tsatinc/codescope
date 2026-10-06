// ============================================================================
// SHARED EXPRESSION PARSER
// ----------------------------------------------------------------------------
// Converts supported C/Java expression text into canonical Program IR. Source
// providers use the same service; activity renderers never define grammar.
// The engine-tree adapter preserves existing timelines during migration.
// ============================================================================

const CORE_EXPRESSION_PRECEDENCE=Object.freeze({
  '||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,
  '+':5,'-':5,'*':6,'/':6,'%':6
});

function decodeCoreStringEscape(raw,label){
  let value='';label=label||'source';
  for(let index=0;index<raw.length;index++){
    const character=raw[index];
    if(character!=='\\'){value+=character;continue;}
    const escaped=raw[++index];
    if(escaped===undefined) throw new Error(`${label}: incomplete string escape`);
    if(escaped==='n') value+='\n';
    else if(escaped==='t') value+='\t';
    else if(escaped==='r') value+='\r';
    else if(escaped==='"') value+='"';
    else if(escaped==="'") value+="'";
    else if(escaped==='\\') value+='\\';
    else throw new Error(`${label}: unsupported string escape '\\${escaped}'`);
  }
  return value;
}

function coreExpressionTokenize(source,context){
  const tokens=[];let index=0;
  while(index<source.length){
    if(/\s/.test(source[index])){index++;continue;}
    const pair=/^(\+\+|--|\|\||&&|==|!=|<=|>=)/.exec(source.slice(index));
    if(pair){tokens.push({type:pair[1],value:pair[1],offset:index});index+=pair[1].length;continue;}
    const number=/^(?:(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)[fFdD]?/.exec(source.slice(index));
    if(number){
      const raw=number[0],numeric=raw.replace(/[fFdD]$/,'');
      tokens.push({type:'literal',value:Number(numeric),dataType:/[.eEfFdD]/.test(raw)?'float':'int',sourceText:raw,offset:index});
      index+=raw.length;continue;
    }
    const character=/^'((?:\\.|[^'\\]))'/.exec(source.slice(index));
    if(character){
      tokens.push({type:'literal',value:decodeCoreStringEscape(character[1],context.label),dataType:'char',sourceText:character[0],offset:index});
      index+=character[0].length;continue;
    }
    const string=/^"((?:\\.|[^"\\])*)"/.exec(source.slice(index));
    if(string){tokens.push({type:'literal',value:decodeCoreStringEscape(string[1],context.label),
      dataType:'string',sourceText:string[0],offset:index});index+=string[0].length;continue;}
    const name=/^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
    if(name){tokens.push({type:'name',value:name[0],offset:index});index+=name[0].length;continue;}
    if('+-*/%()!<>'.includes(source[index])){tokens.push({type:source[index],value:source[index],offset:index++});continue;}
    throw new Error(`${context.label}: unsupported expression token '${source[index]}'`);
  }
  return tokens;
}

function coreExpressionSymbolTable(symbols){
  const result={};
  if(symbols instanceof Map){
    symbols.forEach((value,name)=>{result[name]=value;});
  }else Object.assign(result,symbols||{});
  Object.keys(result).forEach(name=>{
    const row=result[name];
    result[name]=row&&typeof row==='object'&&!Array.isArray(row)
      ?Object.assign({name,kind:'variable',initialized:row.value!==undefined},row)
      :{name,kind:'variable',value:row,initialized:row!==undefined};
  });
  return result;
}

function parseCoreExpressionSource(request){
  const source=String(request.source||''),location=request.location||{};
  const filename=location.filename||request.filename||'expression source';
  const line=location.start&&location.start.line||request.line||1;
  const context={label:`${filename}:${line}`},tokens=coreExpressionTokenize(source,context);
  const symbols=coreExpressionSymbolTable(request.symbols);let cursor=0;
  const requireMutableIdentifier=(expression,operator)=>{
    if(!expression||expression.kind!=='identifier')
      throw new Error(`${context.label}: ${operator} requires a variable identifier`);
    const symbol=symbols[expression.name];
    if(!symbol||symbol.kind==='constant'||symbol.mutable===false)
      throw new Error(`${context.label}: ${operator} requires a mutable variable`);
    return expression;
  };
  const primary=()=>{
    const token=tokens[cursor++];
    if(!token) throw new Error(`${context.label}: incomplete expression '${source.trim()}'`);
    let expression;
    if(token.type==='literal') expression=literalExpression(token.value,{dataType:token.dataType,sourceText:token.sourceText});
    else if(token.type==='name'){
      if(token.value==='true'||token.value==='false') expression=literalExpression(token.value==='true',{dataType:'boolean'});
      else{
        const symbol=symbols[token.value];
        if(!symbol||symbol.initialized===false||symbol.value===undefined)
          throw new Error(`${context.label}: '${token.value}' is used before it is initialized`);
        expression=identifierExpression(token.value,{bindingKind:symbol.kind||'variable',dataType:symbol.dataType});
      }
    }else if(token.type==='!'||token.type==='++'||token.type==='--'){
      const operand=primary();
      if(token.type!=='!') requireMutableIdentifier(operand,token.type);
      expression=unaryExpression(token.type,operand,{form:'prefix'});
    }else if(token.type==='-'&&tokens[cursor]&&tokens[cursor].type==='literal'
      &&typeof tokens[cursor].value==='number'){
      const literal=tokens[cursor++];
      expression=literalExpression(-literal.value,{dataType:literal.dataType,sourceText:'-'+literal.sourceText});
    }else if(token.type==='('){
      expression=parse(0);
      if(!tokens[cursor]||tokens[cursor].type!==')') throw new Error(`${context.label}: missing ')'`);
      cursor++;
    }else throw new Error(`${context.label}: expected an operand in '${source.trim()}'`);
    if(tokens[cursor]&&(tokens[cursor].type==='++'||tokens[cursor].type==='--')){
      const operator=tokens[cursor++].type;
      requireMutableIdentifier(expression,operator);
      expression=unaryExpression(operator,expression,{form:'postfix'});
    }
    return expression;
  };
  const parse=min=>{
    let left=primary();
    while(tokens[cursor]&&CORE_EXPRESSION_PRECEDENCE[tokens[cursor].type]>=min){
      const operator=tokens[cursor++].type;
      const right=parse(CORE_EXPRESSION_PRECEDENCE[operator]+1);
      left=binaryExpression(operator,left,right);
    }
    return left;
  };
  const ir=parse(0);
  if(cursor!==tokens.length) throw new Error(`${context.label}: unsupported expression '${source.trim()}'`);
  assertExpressionIr(ir);
  return {ir,dependencies:[...collectExpressionDependencies(ir)]};
}

function coreExpressionIrToEngineTree(expression,symbols){
  const table=coreExpressionSymbolTable(symbols);
  if(expression.kind==='literal') return makeLiteral(expression.value,
    {dataType:expression.dataType,sourceText:expression.sourceText});
  if(expression.kind==='identifier'){
    const symbol=table[expression.name];
    if(!symbol||symbol.initialized===false||symbol.value===undefined)
      throw new Error(`Expression identifier '${expression.name}' has no initialized value`);
    return makeNamed(symbol.kind||expression.bindingKind||'variable',expression.name,symbol.value,
      {dataType:symbol.dataType||expression.dataType});
  }
  if(expression.kind==='unary') return makeUnary(expression.operator,expression.form||'prefix',
    coreExpressionIrToEngineTree(expression.operand,table));
  return makeBinOp(expression.operator,coreExpressionIrToEngineTree(expression.left,table),
    coreExpressionIrToEngineTree(expression.right,table));
}

registerLanguageCoreService('parseExpression',parseCoreExpressionSource);
