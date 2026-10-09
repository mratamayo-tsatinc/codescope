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

// Build the canonical statement graph used by both answer generation and
// interactive trace presentations. Plugins may decorate this graph, but they
// must not independently decide which statement executes next.
function coreBuildProgramControlFlow(spec){
  const lines=Array.isArray(spec.lines)?spec.lines:String(spec.source||'').split(/\r?\n/);
  const language=spec.language||'c',filename=spec.filename||null,symbols=spec.symbols||{};
  const statements=(spec.statements||[]).slice().sort((left,right)=>left.sourceLine-right.sourceLine);
  const diagnostics=[],byLine=new Map();
  statements.forEach(statement=>{
    if(!byLine.has(statement.sourceLine))byLine.set(statement.sourceLine,[]);
    byLine.get(statement.sourceLine).push(statement);
  });
  const selectionAt=(index,kind)=>(byLine.get(index+1)||[])
    .find(statement=>statement.kind==='selection'&&(!kind||statement.selectionKind===kind))||null;
  const firstStatementIn=(start,end)=>statements.find(statement=>statement.sourceLine>=start&&statement.sourceLine<=end)||null;
  const firstStatementAfter=end=>statements.find(statement=>statement.sourceLine>end)||null;
  const statementsIn=(start,end)=>statements.filter(statement=>statement.sourceLine>=start&&statement.sourceLine<=end);
  const targetDetails=statement=>statement
    ?{line:statement.sourceLine,text:lines[statement.sourceLine-1],id:statement.id}
    :{line:lines.length,text:lines[lines.length-1]||'',id:'$end'};
  const structures=[],attachedElseIf=new Set();

  lines.forEach((line,index)=>{
    const header=coreSelectionHeader(line);
    if(!header||header.selectionKind!=='if'||attachedElseIf.has(index))return;
    const clauses=[];let current={index,kind:'if'},end=index,elseClause=null;
    while(current){
      current.end=coreProgramBlockEnd(lines,current.index);
      current.statement=selectionAt(current.index,current.kind);
      if(current.statement)clauses.push(current);
      end=current.end;
      const following=coreProgramFollowingClauseLine(lines,current.end);
      const nextHeader=following>=0?coreSelectionHeader(lines[following]):null;
      if(nextHeader&&nextHeader.selectionKind==='else-if'){
        attachedElseIf.add(following);current={index:following,kind:'else-if'};continue;
      }
      if(following>=0&&coreProgramElseHeader(lines[following])){
        elseClause={index:following,end:coreProgramBlockEnd(lines,following)};end=elseClause.end;
      }
      current=null;
    }
    if(clauses.length)structures.push({type:'if-chain',clauses,elseClause,end});
  });

  lines.forEach((line,index)=>{
    const header=coreSelectionHeader(line);if(!header||header.selectionKind!=='switch')return;
    const statement=selectionAt(index,'switch');if(!statement)return;
    const end=coreProgramBlockEnd(lines,index),cases=[];
    for(let row=index+1;row<end;row++){
      const location={filename,start:{line:row+1,column:1},end:{line:row+1,column:Math.max(1,lines[row].length+1)}};
      try{const label=coreSwitchLabel(lines[row],{language},symbols,location);if(label)cases.push(Object.assign({index:row},label));}
      catch(error){diagnostics.push(coreProgramDiagnostic(error,{text:lines[row],startLine:row+1,endLine:row+1},filename));}
    }
    cases.forEach((entry,position)=>{entry.end=(cases[position+1]?cases[position+1].index:end)-1;});
    structures.push({type:'switch',statement,cases,end});
  });

  statements.forEach((statement,index)=>{
    statement.nextStatementId=statement.kind==='program-return'?'$end'
      :(statements[index+1]?statements[index+1].id:'$end');
    if(statement.kind==='selection')statement.branches=[];
  });
  const structureStart=structure=>structure.type==='if-chain'
    ?structure.clauses[0].index:structure.statement.sourceLine-1;
  const regions=[];
  structures.forEach(owner=>{
    if(owner.type==='if-chain'){
      owner.clauses.forEach(clause=>regions.push({owner,start:clause.index+1,end:clause.end-1}));
      if(owner.elseClause)regions.push({owner,start:owner.elseClause.index+1,end:owner.elseClause.end-1});
    }else owner.cases.forEach(entry=>regions.push({owner,start:entry.index+1,end:entry.end}));
  });
  const containingRegion=structure=>regions
    .filter(region=>region.owner!==structure&&structureStart(structure)>=region.start&&structure.end<=region.end)
    .sort((left,right)=>(left.end-left.start)-(right.end-right.start))[0]||null;
  const continuationAfter=structure=>{
    const candidate=firstStatementAfter(structure.end),region=containingRegion(structure);
    if(!region||!candidate||candidate.sourceLine-1<=region.end)return candidate;
    return region.owner.type==='if-chain'?continuationAfter(region.owner):candidate;
  };

  structures.forEach(structure=>{
    const after=continuationAfter(structure),afterTarget=targetDetails(after);
    if(structure.type==='if-chain'){
      structure.clauses.forEach((clause,position)=>{
        const body=statementsIn(clause.index+2,clause.end),trueTarget=targetDetails(body[0]||after);
        const nextClause=structure.clauses[position+1];
        const falseStatement=nextClause?nextClause.statement
          :(structure.elseClause?firstStatementIn(structure.elseClause.index+2,structure.elseClause.end):after);
        const falseTarget=targetDetails(falseStatement);
        clause.statement.branches=[
          {when:true,label:'TRUE',targetLine:trueTarget.line,targetText:trueTarget.text,
            nextStatementId:trueTarget.id,targetStatementId:trueTarget.id},
          {when:false,label:'FALSE',targetLine:falseTarget.line,targetText:falseTarget.text,
            nextStatementId:falseTarget.id,targetStatementId:falseTarget.id}
        ];
        if(body.length)body[body.length-1].nextStatementId=afterTarget.id;
      });
      if(structure.elseClause){
        const body=statementsIn(structure.elseClause.index+2,structure.elseClause.end);
        if(body.length)body[body.length-1].nextStatementId=afterTarget.id;
      }
      return;
    }
    const caseBodies=structure.cases.map(entry=>statementsIn(entry.index+2,entry.end+1));
    const nextCaseTarget=start=>{
      for(let position=start;position<caseBodies.length;position++)if(caseBodies[position].length)return caseBodies[position][0];
      return after;
    };
    structure.cases.forEach((entry,position)=>{
      const body=caseBodies[position],target=targetDetails(body[0]||nextCaseTarget(position+1));
      structure.statement.branches.push({value:entry.value,default:entry.default,label:entry.label,
        targetLine:target.line,targetText:target.text,nextStatementId:target.id,targetStatementId:target.id});
      body.filter(statement=>statement.kind==='program-break').forEach(statement=>{
        statement.switchStatementId=structure.statement.id;statement.nextStatementId=afterTarget.id;
      });
      if(body.length&&body[body.length-1].kind!=='program-break')
        body[body.length-1].nextStatementId=targetDetails(nextCaseTarget(position+1)).id;
    });
    if(!structure.cases.some(entry=>entry.default))structure.statement.branches.push({noMatch:true,label:'NO MATCH',
      targetLine:afterTarget.line,targetText:afterTarget.text,nextStatementId:afterTarget.id,targetStatementId:afterTarget.id});
  });
  return {statements,structures,diagnostics};
}

// Execute the same canonical graph consumed by Trace activities. Simulate
// activities derive their answer key from the resulting effects and memory.
function coreExecuteParsedProgram(spec){
  const language=spec.language||'c',filename=spec.filename||null;
  const memory=coreExpressionMemory(spec.symbols||{}),effects=[],trace=[],diagnostics=[],memoryBeforeByStatementId={};
  const statements=spec.statements||[],byId=new Map(statements.map(statement=>[statement.id,statement]));
  const rowFor=statement=>({text:statement.sourceText||'',startLine:statement.sourceLine||1,
    endLine:statement.sourceEndLine||statement.sourceLine||1});
  let current=statements[0]||null,steps=0;
  while(current&&current.id!=='$end'){
    if(++steps>10000){
      diagnostics.push(coreProgramDiagnostic('Program execution exceeded the supported step limit',rowFor(current),filename,'PROGRAM_STEP_LIMIT'));
      break;
    }
    try{
      if(!memoryBeforeByStatementId[current.id])memoryBeforeByStatementId[current.id]=[];
      memoryBeforeByStatementId[current.id].push(Object.fromEntries(Object.entries(memory).map(([name,binding])=>[name,
        binding&&typeof binding==='object'&&!Array.isArray(binding)
          ?Object.assign({},binding,{value:Array.isArray(binding.value)?binding.value.slice():binding.value})
          :binding])));
      const executed=evaluateAndApplyCoreStatement(current,memory,language,current.id,'bindings');
      effects.push(...executed.effects.map(effect=>Object.assign({statementId:current.id},effect)));
      trace.push(...executed.trace.map(step=>Object.assign({statementId:current.id},step)));
      const flow=executed.effects.find(effect=>effect.kind==='flow');
      const nextId=flow&&flow.nextStatementId!==undefined?flow.nextStatementId:current.nextStatementId;
      current=nextId==='$end'?null:(byId.get(nextId)||null);
    }catch(error){
      diagnostics.push(coreProgramDiagnostic(error,rowFor(current),filename,'PROGRAM_STATE_UNAVAILABLE'));
      break;
    }
  }
  return {memory,effects,trace,diagnostics,memoryBeforeByStatementId};
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
  const controlFlow=coreBuildProgramControlFlow({source,language,filename,statements,symbols:memory});
  const executed=coreExecuteParsedProgram({source,language,filename,statements,symbols:request.symbols});
  const dependencies=[...new Set(statements.flatMap(statement=>statement.dependencies||[]))];
  return {ir:languageCoreProgramIr({language,source,statements,metadata:{filename,
      statementRows:rows.map(row=>Object.assign({},row)),expectedMemory:executed.memory,
      executionMemoryBefore:executed.memoryBeforeByStatementId}}),
    diagnostics:[...diagnostics,...controlFlow.diagnostics,...executed.diagnostics],
    dependencies,effects:executed.effects,trace:executed.trace};
}

registerLanguageCoreService('parseProgram',parseCoreProgram);
