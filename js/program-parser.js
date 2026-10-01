// ============================================================================
// SHARED PROGRAM PARSER
// ----------------------------------------------------------------------------
// Scans a complete C/Java source file into source-positioned simple statements
// and composes the shared statement parser and executor. Specialized adapters
// may claim the recoverable rows that are not yet part of the core grammar.
// ============================================================================

function coreProgramStatementRows(source){
  const rows=[];let buffer='',startLine=1,line=1,parenDepth=0,pendingDoTails=0;
  let quote=null,escaped=false,lineComment=false,blockComment=false;
  const reset=()=>{buffer='';startLine=line;};
  const begin=character=>{if(!buffer.trim()&&!/\s/.test(character))startLine=line;};
  for(let index=0;index<source.length;index++){
    const character=source[index],next=source[index+1];
    if(lineComment){if(character==='\n'){lineComment=false;line++;reset();}continue;}
    if(blockComment){
      if(character==='*'&&next==='/'){blockComment=false;index++;continue;}
      if(character==='\n')line++;
      continue;
    }
    if(quote){
      buffer+=character;
      if(escaped)escaped=false;
      else if(character==='\\')escaped=true;
      else if(character===quote)quote=null;
      if(character==='\n')line++;
      continue;
    }
    if(character==='/'&&next==='/'){lineComment=true;index++;continue;}
    if(character==='/'&&next==='*'){blockComment=true;index++;continue;}
    if(character==='"'||character==="'"){begin(character);quote=character;buffer+=character;continue;}
    if(character==='\n'){
      if(buffer.trim().startsWith('#')){
        const directive=buffer.trim();
        if(/^#define\b/.test(directive))rows.push({text:directive,startLine,endLine:line});
        reset();
      }
      else buffer+='\n';
      line++;continue;
    }
    if(character==='('){begin(character);parenDepth++;buffer+=character;continue;}
    if(character===')'){parenDepth=Math.max(0,parenDepth-1);buffer+=character;continue;}
    if(character===':'&&parenDepth===0){
      buffer+=character;
      if(/^(?:case\b[\s\S]*|default)\s*:$/.test(buffer.trim()))reset();
      continue;
    }
    if(character==='{'&&parenDepth===0){
      const header=buffer.trim();
      const loopHeader=coreLoopHeader(header);
      if(coreSelectionHeader(header)||loopHeader)rows.push({text:`${header} {`,startLine,endLine:line});
      if(loopHeader&&loopHeader.loopKind==='do')pendingDoTails++;
      reset();continue;
    }
    if(character==='}'&&parenDepth===0){reset();continue;}
    begin(character);buffer+=character;
    if(character===';'&&parenDepth===0){
      const text=buffer.trim();
      if(text){const isDoWhile=pendingDoTails>0&&!!coreLoopHeader(text,{doWhile:true})&&/^while\b/.test(text);
        rows.push({text,startLine,endLine:line,doWhile:isDoWhile});if(isDoWhile)pendingDoTails--;}
      reset();
    }
  }
  return rows;
}

function coreProgramDiagnostic(error,row,filename,code){
  return {code:code||'PROGRAM_STATEMENT_UNAVAILABLE',severity:'warning',
    message:String(error&&error.message||error),recoverable:true,
    location:{filename:filename||null,start:{line:row.startLine,column:1},
      end:{line:row.endLine,column:Math.max(1,row.text.length+1)}}};
}

function parseCoreProgram(request){
  const source=String(request.source||''),language=String(request.language||'c').toLowerCase();
  const filename=request.filename||(request.location&&request.location.filename)||null;
  const rows=coreProgramStatementRows(source),memory=coreExpressionMemory(request.symbols||{});
  const statements=[],diagnostics=[],effects=[],trace=[],counts={};
  rows.flatMap(row=>{
    const declarations=coreDeclarationFragments(row.text,language);
    if(!declarations||declarations.length<2)return [row];
    return declarations.map((declaration,index)=>Object.assign({},row,{text:declaration.statementText,
      authoredText:row.text,declarationIndex:index,declarationCount:declarations.length}));
  }).forEach(row=>{
    const location={filename,start:{line:row.startLine,column:1},
      end:{line:row.endLine,column:Math.max(1,row.text.length+1)}};
    let parsed;
    try{parsed=coreParseStatement({language,source:row.text,symbols:memory,location,inputValues:request.inputValues,
      doWhile:row.doWhile===true});}
    catch(error){diagnostics.push(coreProgramDiagnostic(error,row,filename));return;}
    if(!parsed.ir){diagnostics.push(...parsed.diagnostics);return;}
    const statement=parsed.ir;
    counts[statement.kind]=(counts[statement.kind]||0)+1;
    statement.id=statement.id||`${statement.kind}-${counts[statement.kind]}`;
    statement.sourceLine=row.startLine;statement.sourceEndLine=row.endLine;statement.sourceText=row.authoredText||row.text;
    if(row.declarationCount){statement.declarationIndex=row.declarationIndex;statement.declarationCount=row.declarationCount;}
    statement.dependencies=parsed.dependencies.slice();
    statements.push(statement);
    try{
      const executions=[];
      if(statement.kind==='loop'&&statement.initializer){
        const initialized=coreExecuteStatement({language,statement,memory,phase:'initialize'});
        applyCoreStatementEffects(memory,initialized.effects,statement.id,'bindings');
        executions.push(initialized);
      }
      executions.push(evaluateAndApplyCoreStatement(statement,memory,language,statement.id,'bindings'));
      executions.forEach(executed=>{
        effects.push(...executed.effects.map(effect=>Object.assign({statementId:statement.id},effect)));
        trace.push(...executed.trace.map(step=>Object.assign({statementId:statement.id},step)));
      });
    }catch(error){diagnostics.push(coreProgramDiagnostic(error,row,filename,'PROGRAM_STATE_UNAVAILABLE'));}
  });
  if(!statements.length) return {ir:null,diagnostics,dependencies:[],effects,trace};
  const dependencies=[...new Set(statements.flatMap(statement=>statement.dependencies||[]))];
  return {ir:languageCoreProgramIr({language,source,statements,metadata:{filename,
      statementRows:rows.map(row=>Object.assign({},row)),expectedMemory:memory}}),
    diagnostics,dependencies,effects,trace};
}

registerLanguageCoreService('parseProgram',parseCoreProgram);
