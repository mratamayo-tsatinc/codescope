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

function coreProgramBlockEnd(lines,start){
  let depth=0,opened=false,quote=null,escaped=false;
  for(let index=start;index<lines.length;index++){
    for(const character of lines[index]){
      if(quote){
        if(escaped)escaped=false;
        else if(character==='\\')escaped=true;
        else if(character===quote)quote=null;
        continue;
      }
      if(character==='"'||character==="'"){quote=character;continue;}
      if(!opened){if(character==='{'){opened=true;depth=1;}continue;}
      if(character==='{')depth++;
      else if(character==='}'&&--depth===0)return index;
    }
  }
  return start;
}

function coreProgramNextMeaningfulLine(lines,start){
  for(let index=start;index<lines.length;index++)if(lines[index].trim())return index;
  return -1;
}

function coreProgramFollowingClauseLine(lines,blockEnd){
  if(blockEnd>=0&&/^\s*}\s*else\b/.test(lines[blockEnd]))return blockEnd;
  return coreProgramNextMeaningfulLine(lines,blockEnd+1);
}

function coreProgramElseHeader(line){return /^\s*(?:}\s*)?else\s*{/.test(String(line||''));}

// Execute parsed statements by authored control flow. Parsing and execution
// are deliberately separate: the parser may discover every statement in the
// file, while answer generation must apply only statements on the selected
// branch. This executor is shared by every sourced activity.
function coreExecuteParsedProgram(spec){
  const lines=String(spec.source||'').split(/\r?\n/),language=spec.language||'c';
  const filename=spec.filename||null,memory=coreExpressionMemory(spec.symbols||{});
  const effects=[],trace=[],diagnostics=[],byLine=new Map();
  (spec.statements||[]).forEach(statement=>{
    const line=statement.sourceLine||(statement.sourceSpan&&statement.sourceSpan.start.line);
    if(!byLine.has(line))byLine.set(line,[]);byLine.get(line).push(statement);
  });
  const rowFor=statement=>({text:statement.sourceText||'',startLine:statement.sourceLine||1,
    endLine:statement.sourceEndLine||statement.sourceLine||1});
  const executeStatement=statement=>{
    try{
      const executed=evaluateAndApplyCoreStatement(statement,memory,language,statement.id,'bindings');
      effects.push(...executed.effects.map(effect=>Object.assign({statementId:statement.id},effect)));
      trace.push(...executed.trace.map(step=>Object.assign({statementId:statement.id},step)));
      const flow=executed.effects.find(effect=>effect.kind==='flow');
      return {value:executed.value,signal:flow&&flow.flow||null};
    }catch(error){
      diagnostics.push(coreProgramDiagnostic(error,rowFor(statement),filename,'PROGRAM_STATE_UNAVAILABLE'));
      return {value:undefined,signal:'error'};
    }
  };
  const statementAt=(line,kind)=>((byLine.get(line+1)||[]).find(statement=>!kind||statement.kind===kind));
  const ifChainAt=start=>{
    const clauses=[];let current=start,elseClause=null,end=start;
    while(current>=0){
      const header=coreSelectionHeader(lines[current]);
      if(!header||!['if','else-if'].includes(header.selectionKind))break;
      const blockEnd=coreProgramBlockEnd(lines,current);
      clauses.push({index:current,end:blockEnd,kind:header.selectionKind});end=blockEnd;
      const following=coreProgramFollowingClauseLine(lines,blockEnd);
      const nextHeader=following>=0?coreSelectionHeader(lines[following]):null;
      if(nextHeader&&nextHeader.selectionKind==='else-if'){current=following;continue;}
      if(following>=0&&coreProgramElseHeader(lines[following])){
        elseClause={index:following,end:coreProgramBlockEnd(lines,following)};end=elseClause.end;
      }
      break;
    }
    return {clauses,elseClause,end};
  };
  const executeRange=(start,end)=>{
    for(let index=start;index<=end;index++){
      const header=coreSelectionHeader(lines[index]);
      if(header&&header.selectionKind==='if'){
        const chain=ifChainAt(index);let selected=false;
        for(const clause of chain.clauses){
          const selection=statementAt(clause.index,'selection');
          const outcome=selection?executeStatement(selection):{value:false};
          if(outcome.signal==='error')return outcome.signal;
          if(Boolean(outcome.value)){
            const signal=executeRange(clause.index+1,clause.end-1);selected=true;
            if(signal)return signal;
            break;
          }
        }
        if(!selected&&chain.elseClause){
          const signal=executeRange(chain.elseClause.index+1,chain.elseClause.end-1);
          if(signal)return signal;
        }
        index=chain.end;continue;
      }
      if(header&&header.selectionKind==='switch'){
        const selection=statementAt(index,'selection'),outcome=selection?executeStatement(selection):{value:undefined};
        if(outcome.signal==='error')return outcome.signal;
        const blockEnd=coreProgramBlockEnd(lines,index),cases=[];
        for(let row=index+1;row<blockEnd;row++){
          const location={filename,start:{line:row+1,column:1},end:{line:row+1,column:Math.max(1,lines[row].length+1)}};
          try{const label=coreSwitchLabel(lines[row],{language},memory,location);if(label)cases.push(Object.assign({index:row},label));}
          catch(error){diagnostics.push(coreProgramDiagnostic(error,{text:lines[row],startLine:row+1,endLine:row+1},filename));return 'error';}
        }
        const chosen=cases.find(entry=>!entry.default&&entry.value===outcome.value)||cases.find(entry=>entry.default);
        if(chosen){const signal=executeRange(chosen.index+1,blockEnd-1);if(signal&&signal!=='break')return signal;}
        index=blockEnd;continue;
      }
      const statements=byLine.get(index+1)||[];
      for(const statement of statements){
        if(statement.kind==='selection')continue;
        const outcome=executeStatement(statement);
        if(outcome.signal)return outcome.signal;
      }
    }
    return null;
  };
  executeRange(0,lines.length-1);
  return {memory,effects,trace,diagnostics};
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
    }catch(error){/* Runtime diagnostics are produced by the control-flow executor below. */}
  });
  if(!statements.length) return {ir:null,diagnostics,dependencies:[],effects,trace};
  const executed=coreExecuteParsedProgram({source,language,filename,statements,symbols:request.symbols});
  const dependencies=[...new Set(statements.flatMap(statement=>statement.dependencies||[]))];
  return {ir:languageCoreProgramIr({language,source,statements,metadata:{filename,
      statementRows:rows.map(row=>Object.assign({},row)),expectedMemory:executed.memory}}),
    diagnostics:[...diagnostics,...executed.diagnostics],dependencies,effects:executed.effects,trace:executed.trace};
}

registerLanguageCoreService('parseProgram',parseCoreProgram);
