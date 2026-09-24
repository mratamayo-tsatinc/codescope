const PROGRAM_SELECTION_EXERCISE_ROOT='plugins/program-selection/exercises';
const programSelectionExerciseBanks=new Map();

function psManifestUrl(profile,language){
  return `${PROGRAM_SELECTION_EXERCISE_ROOT}/${poContentSlug(language,'CodeScope language')}/${poContentSlug(profile.content.exerciseSet,'exerciseSet')}/manifest.json`;
}

function psSourceValueMode(profile){
  const mode=profile&&profile.content&&profile.content.sourceValueMode||'authored';
  if(mode!=='authored'&&mode!=='seeded') throw new Error(`${profile&&profile.id||'program-selection'}: sourceValueMode must be 'authored' or 'seeded'`);
  return mode;
}

function psSeedDirectives(metadata,filename){
  const directives=new Map();
  String(metadata||'').split('\n').forEach((raw,index)=>{
    const line=raw.replace(/^\s*\*?\s*/,'').trim();
    if(!line.startsWith('@seed')) return;
    const match=/^@seed\s+([A-Za-z_][A-Za-z0-9_]*)\s+min=(-?\d+)\s+max=(-?\d+)\s*$/.exec(line);
    if(!match) throw new Error(`${filename}: metadata line ${index+1}: expected @seed name min=<integer> max=<integer>`);
    const name=match[1],min=Number(match[2]),max=Number(match[3]);
    if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min>max)
      throw new Error(`${filename}: invalid @seed range for '${name}'`);
    if(directives.has(name)) throw new Error(`${filename}: duplicate @seed directive for '${name}'`);
    directives.set(name,{name,min,max});
  });
  return directives;
}

function psMaterializeSource(details,language,filename,mode){
  const directives=psSeedDirectives(details.metadata,filename),seen=new Set(),seedValues={};
  const pattern=language==='c'
    ?/^(\s*(?:const\s+)?int\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)([^;]+)(;\s*)$/
    :/^(\s*(?:final\s+)?int\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)([^;]+)(;\s*)$/;
  const lines=details.source.split('\n').map((raw,index)=>{
    const match=pattern.exec(raw);if(!match)return raw;
    const name=match[2],directive=directives.get(name);if(!directive)return raw;
    if(seen.has(name)) throw new Error(`${filename}:${index+1}: seeded binding '${name}' is declared more than once`);
    seen.add(name);
    const initializer=match[3].trim();
    if(!/^-?\d+$/.test(initializer))
      throw new Error(`${filename}:${index+1}: @seed '${name}' requires a literal integer initializer`);
    const value=mode==='seeded'?randInt(directive.min,directive.max):Number(initializer);
    seedValues[name]=value;
    return mode==='seeded'?`${match[1]}${value}${match[4]}`:raw;
  });
  directives.forEach((directive,name)=>{
    if(!seen.has(name)) throw new Error(`${filename}: @seed references undeclared binding '${name}'`);
  });
  return {source:lines.join('\n'),seedValues,directives};
}

function psExpressionTokens(source,filename,line){
  const tokens=[];let index=0;
  while(index<source.length){
    if(/\s/.test(source[index])){index++;continue;}
    const pair=/^(\|\||&&|==|!=|<=|>=)/.exec(source.slice(index));
    if(pair){tokens.push({type:pair[1],value:pair[1]});index+=pair[1].length;continue;}
    const number=/^\d+/.exec(source.slice(index));
    if(number){tokens.push({type:'number',value:Number(number[0])});index+=number[0].length;continue;}
    const name=/^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
    if(name){tokens.push({type:'name',value:name[0]});index+=name[0].length;continue;}
    if('+-*/%()!<>'.includes(source[index])){tokens.push({type:source[index],value:source[index++]});continue;}
    throw new Error(`${filename}:${line}: unsupported condition token '${source[index]}'`);
  }
  return tokens;
}

function psParseExpression(source,memory,kinds,filename,line){
  const tokens=psExpressionTokens(source,filename,line),precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  let cursor=0;
  const primary=()=>{
    const token=tokens[cursor++];
    if(!token) throw new Error(`${filename}:${line}: incomplete condition`);
    if(token.type==='number') return makeLiteral(token.value);
    if(token.type==='name'){
      if(token.value==='true'||token.value==='false') return makeLiteral(token.value==='true');
      if(!Object.prototype.hasOwnProperty.call(memory,token.value))
        throw new Error(`${filename}:${line}: '${token.value}' is used before initialization`);
      return makeNamed(kinds[token.value]||'variable',token.value,memory[token.value]);
    }
    if(token.type==='!') return makeUnary('!','prefix',primary());
    if(token.type==='-'&&tokens[cursor]&&tokens[cursor].type==='number') return makeLiteral(-tokens[cursor++].value);
    if(token.type==='('){const value=parse(0);if(!tokens[cursor]||tokens[cursor].type!==')')throw new Error(`${filename}:${line}: missing ')'`);cursor++;return value;}
    throw new Error(`${filename}:${line}: expected condition operand`);
  };
  const parse=min=>{let left=primary();while(tokens[cursor]&&precedence[tokens[cursor].type]>=min){
    const operator=tokens[cursor++].type;const right=parse(precedence[operator]+1);left=makeBinOp(operator,left,right);
  }return left;};
  const tree=parse(0);if(cursor!==tokens.length)throw new Error(`${filename}:${line}: unsupported condition '${source.trim()}'`);return tree;
}

function psNextCodeLine(lines,start){
  for(let index=start;index<lines.length;index++){
    const text=lines[index].trim();
    if(text&&text!=='{'&&text!=='}'&&!/^break\s*;/.test(text)&&!/^case\b|^default\s*:/.test(text))
      return {line:index+1,text:lines[index]};
  }
  return {line:lines.length,text:lines[lines.length-1]||''};
}

function psBlockEnd(lines,start){
  let depth=0,opened=false;
  for(let index=start;index<lines.length;index++){
    for(const character of lines[index]){
      if(!opened){if(character==='{'){opened=true;depth=1;}continue;}
      if(character==='{')depth++;
      else if(character==='}'&&--depth===0)return index;
    }
  }
  return start;
}

function psIfHeader(line){
  const match=/^\s*(?:}\s*)?(if|else\s+if)\s*\((.+)\)\s*\{/.exec(line);
  return match?{kind:match[1]==='if'?'if':'else-if',condition:match[2]}:null;
}

function psSwitchHeader(line){
  const match=/^\s*switch\s*\((.+)\)\s*\{/.exec(line);
  return match?{condition:match[1]}:null;
}

function psElseHeader(line){return /^\s*(?:}\s*)?else\s*\{/.test(line);}

function psNextMeaningfulLine(lines,start){
  for(let index=start;index<lines.length;index++) if(lines[index].trim()) return index;
  return -1;
}

function psFollowingClauseLine(lines,blockEnd){
  if(blockEnd>=0&&/^\s*}\s*else\b/.test(lines[blockEnd])) return blockEnd;
  return psNextMeaningfulLine(lines,blockEnd+1);
}

function psBuildSelection(id,kind,condition,lineIndex,lines,memory,kinds,branches){
  const tree=psParseExpression(condition,memory,kinds,'selection source',lineIndex+1);
  const statement={id,kind:'selection',selectionKind:kind,keyword:kind==='switch'?'switch':(kind==='else-if'?'else if':'if'),
    branches,conditionSource:condition.trim(),sourceLine:lineIndex+1,sourceEndLine:lineIndex+1,sourceText:lines[lineIndex],
    sourceIndent:(lines[lineIndex].match(/^\s*/)||[''])[0],runtime:buildDeclarationRuntime(tree,evalTree(tree))};
  statement.runtime.selectedTargetLine=null;statement.runtime.selectedTargetText=null;statement.runtime.selectedLabel=null;
  return statement;
}

function psParseExercise(exercise,language,sourceValueMode='authored'){
  if(sourceValueMode!=='authored'&&sourceValueMode!=='seeded')
    throw new Error(`${exercise.filename}: sourceValueMode must be 'authored' or 'seeded'`);
  const rawDetails=poMetadataAndSource(exercise.raw,exercise.filename),materialized=psMaterializeSource(rawDetails,language,exercise.filename,sourceValueMode);
  const details=Object.assign({},rawDetails,{templateSource:rawDetails.source,source:materialized.source,
    sourceValueMode,seedValues:materialized.seedValues}),lines=details.source.split('\n');
  const memory={},kinds={},declarations=[],statements=[],supported=new Map();let declarationIndex=0,outputIndex=0;
  const mark=statement=>supported.set(statement.sourceLine,{statementId:statement.id,primary:true});
  lines.forEach((raw,index)=>{
    const pattern=language==='c'?/^\s*(const\s+)?int\s+(\w+)\s*=\s*([^;]+);\s*$/:/^\s*(final\s+)?int\s+(\w+)\s*=\s*([^;]+);\s*$/;
    const match=pattern.exec(raw);if(!match)return;
    const tree=psParseExpression(match[3],memory,kinds,exercise.filename,index+1),name=match[2],kind=match[1]?'constant':'variable',value=evalTree(tree);
    memory[name]=value;kinds[name]=kind;declarations.push({kind,name,value});
    const statement=declarationStatement({id:`declaration-${++declarationIndex}`,name,dataType:'int',mutable:kind!=='constant',initializer:engineNodeToProgramIr(tree)});
    statement.binding.kind=kind;statement.runtime=buildDeclarationRuntime(tree,value);statement.dependencies=[...collectExpressionDependencies(statement.initializer)];
    statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);
  });
  const controlStructures=[],attachedElseIf=new Set();let selectionIndex=0;
  lines.forEach((line,index)=>{
    const header=psIfHeader(line);
    if(!header||header.kind!=='if'||attachedElseIf.has(index)) return;
    const clauses=[];let current={index,kind:'if',condition:header.condition},chainEnd=index,elseClause=null;
    while(current){
      current.end=psBlockEnd(lines,current.index);clauses.push(current);chainEnd=current.end;
      const following=psFollowingClauseLine(lines,current.end),nextHeader=following>=0?psIfHeader(lines[following]):null;
      if(nextHeader&&nextHeader.kind==='else-if'){
        attachedElseIf.add(following);current={index:following,kind:'else-if',condition:nextHeader.condition};continue;
      }
      if(following>=0&&psElseHeader(lines[following])){
        elseClause={index:following,end:psBlockEnd(lines,following)};chainEnd=elseClause.end;
      }
      current=null;
    }
    clauses.forEach(clause=>{
      const statement=psBuildSelection(`selection-${++selectionIndex}`,clause.kind,clause.condition,clause.index,lines,memory,kinds,[]);
      statement.selectionHasAlternative=clauses.length>1||!!elseClause;clause.statement=statement;mark(statement);statements.push(statement);
    });
    controlStructures.push({type:'if-chain',clauses,elseClause,end:chainEnd});
  });
  lines.forEach((line,index)=>{
    const header=psSwitchHeader(line);if(!header)return;
    const end=psBlockEnd(lines,index),cases=[];
    for(let row=index+1;row<end;row++){
      const caseMatch=/^\s*case\s+(-?\d+)\s*:/.exec(lines[row]),isDefault=/^\s*default\s*:/.test(lines[row]);
      if(caseMatch||isDefault)cases.push({index:row,value:caseMatch?Number(caseMatch[1]):null,default:isDefault,
        label:isDefault?'default':`case ${caseMatch[1]}`});
    }
    cases.forEach((entry,position)=>{entry.end=(cases[position+1]?cases[position+1].index:end)-1;});
    const statement=psBuildSelection(`selection-${++selectionIndex}`,'switch',header.condition,index,lines,memory,kinds,[]);
    mark(statement);statements.push(statement);controlStructures.push({type:'switch',statement,cases,end});
  });
  lines.forEach((raw,index)=>{
    const trimmed=raw.trim();
    if(!trimmed.endsWith(';')) return;
    const text=trimmed.slice(0,-1).trim();
    if(language==='c'&&/^return\s+0$/.test(text)){
      const statement=programReturnStatement({id:'program-return',value:0});
      statement.sourceLine=index+1;statement.sourceEndLine=index+1;statement.sourceText=raw;
      statement.sourceIndent=(raw.match(/^\s*/)||[''])[0];mark(statement);statements.push(statement);return;
    }
    const output=language==='c'
      ?poParseCOutput(text,memory,exercise.filename,index+1,outputIndex)
      :poParseJavaOutput(text,memory,exercise.filename,index+1,outputIndex);
    if(!output) return;
    outputIndex++;output.sourceLine=index+1;output.sourceEndLine=index+1;output.sourceText=raw;
    output.sourceIndent=(raw.match(/^\s*/)||[''])[0];output.nextStatementId='$end';mark(output);statements.push(output);
  });
  statements.sort((left,right)=>left.sourceLine-right.sourceLine);
  const firstStatementIn=(start,end)=>statements.find(statement=>statement.sourceLine>=start&&statement.sourceLine<=end)||null;
  const firstStatementAfter=end=>statements.find(statement=>statement.sourceLine>end)||null;
  const statementsIn=(start,end)=>statements.filter(statement=>statement.sourceLine>=start&&statement.sourceLine<=end);
  const targetDetails=statement=>statement?{line:statement.sourceLine,text:lines[statement.sourceLine-1],id:statement.id}
    :{line:lines.length,text:lines[lines.length-1]||'',id:'$end'};
  statements.forEach((statement,index)=>{
    if(statement.kind==='program-return')statement.nextStatementId='$end';
    else statement.nextStatementId=statements[index+1]?statements[index+1].id:'$end';
  });
  controlStructures.forEach(structure=>{
    const after=firstStatementAfter(structure.end),afterTarget=targetDetails(after);
    if(structure.type==='if-chain'){
      structure.clauses.forEach((clause,position)=>{
        const body=statementsIn(clause.index+2,clause.end),trueTarget=targetDetails(body[0]||after);
        const nextClause=structure.clauses[position+1];let falseStatement=null;
        if(nextClause) falseStatement=nextClause.statement;
        else if(structure.elseClause) falseStatement=firstStatementIn(structure.elseClause.index+2,structure.elseClause.end);
        else falseStatement=after;
        const falseTarget=targetDetails(falseStatement);
        clause.statement.branches=[
          {when:true,label:'TRUE',targetLine:trueTarget.line,targetText:trueTarget.text,nextStatementId:trueTarget.id,targetStatementId:trueTarget.id},
          {when:false,label:'FALSE',targetLine:falseTarget.line,targetText:falseTarget.text,nextStatementId:falseTarget.id,targetStatementId:falseTarget.id}
        ];
        if(body.length) body[body.length-1].nextStatementId=afterTarget.id;
      });
      if(structure.elseClause){
        const body=statementsIn(structure.elseClause.index+2,structure.elseClause.end);
        if(body.length) body[body.length-1].nextStatementId=afterTarget.id;
      }
      return;
    }
    structure.cases.forEach(entry=>{
      const body=statementsIn(entry.index+2,entry.end+1),target=targetDetails(body[0]||after);
      structure.statement.branches.push({value:entry.value,default:entry.default,label:entry.label,
        targetLine:target.line,targetText:target.text,nextStatementId:target.id,targetStatementId:target.id});
      if(body.length)body[body.length-1].nextStatementId=afterTarget.id;
    });
  });
  if(!declarations.length||!statements.some(statement=>statement.kind==='selection'))throw new Error(`${exercise.filename}: declarations and a selection statement are required`);
  const sourceDisplay={filename:exercise.filename,lines:lines.map((text,index)=>{const support=supported.get(index+1);return {number:index+1,text,supported:!!support,statementId:support&&support.statementId||null,primary:!!support};})};
  return {details,lines,memory,kinds,declarations,statements,sourceDisplay};
}

function psBuildItem(profile,exercise,language,itemNumber){
  const parsed=psParseExercise(exercise,language,psSourceValueMode(profile)),last=parsed.declarations[parsed.declarations.length-1];
  const originalTree=makeNamed(last.kind,last.name,last.value),originalFlat=flattenInstance(originalTree);
  const item={profileId:profile.id,itemNumber,exerciseId:exercise.id,filename:exercise.filename,exerciseTitle:parsed.details.title,
    source:parsed.details.source,sourceTemplate:parsed.details.templateSource,sourceSeedValues:parsed.details.seedValues,
    sourceValueMode:parsed.details.sourceValueMode,sourceDisplay:parsed.sourceDisplay,sourceFlow:true,language,originalTree,originalFlat,
    decls:parsed.declarations,resultName:last.name,correctFinalValue:last.value,canonicalTrace:buildCanonicalTrace(originalTree),
    workingFlat:deepCloneFlat(originalFlat),history:[deepCloneFlat(originalFlat)],trace:[],checked:false,itemScore:null,points:null,maxPoints:null,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,showSolution:false,playback:null,flagged:false,lockedAt:null,examActionLog:[],
    examSequenceFailure:null,practiceInvalidExecution:null,_bindings:null};
  item.program=createProgram(parsed.statements,{id:`${profile.id}-${exercise.id}`,language});item.program.mode='interactive-program';item.program.scoreAssignments=true;return item;
}

function psInstallExerciseBank(url,language,exerciseSet,manifest,rows){
  const checked=poValidateManifest(manifest,url),byName=new Map(rows.map(row=>[row.filename,row]));
  const exercises=checked.exercises.map(filename=>{const row=byName.get(filename);if(!row)throw new Error(`${url}: '${filename}' was not loaded`);
    const exercise={id:filename.replace(/\.[^.]+$/,''),filename,raw:row.raw};psParseExercise(exercise,language);return Object.freeze(exercise);});
  programSelectionExerciseBanks.set(url,Object.freeze({language,exerciseSet,exercises:Object.freeze(exercises)}));
}

async function psLoadExerciseContent(){
  const profiles=PROFILES.filter(profile=>profileIsEnabled(profile)&&profile.content&&profile.content.provider===PROGRAM_SELECTION_PLUGIN_MANIFEST.id);
  await Promise.all(profiles.map(async profile=>{const url=psManifestUrl(profile,state.language),response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);
    const manifest=poValidateManifest(await response.json(),url),directory=url.slice(0,url.lastIndexOf('/')+1),rows=await Promise.all(manifest.exercises.map(async filename=>{
      const result=await fetch(directory+encodeURIComponent(filename),{cache:'no-store'});if(!result.ok)throw new Error(`${filename}: HTTP ${result.status}`);return {filename,raw:await result.text()};}));
    psInstallExerciseBank(url,state.language,profile.content.exerciseSet,manifest,rows); }));
}

registerProfileContentProvider({id:PROGRAM_SELECTION_PLUGIN_MANIFEST.id,
  validateProfile(profile){if(profile.content.mode!=='source-files')throw new Error(`${profile.id}: selection content must use source-files`);
    psSourceValueMode(profile);if(!profile.content.selection||profile.content.selection.count!=='all'||profile.itemCount!=='manifest')
      throw new Error(`${profile.id}: source-file selection must use manifest item count`);},
  loadContent:psLoadExerciseContent,
  generateItems({profile,language}){const bank=programSelectionExerciseBanks.get(psManifestUrl(profile,language));if(!bank)throw new Error(`${profile.id}: selection exercise bank is not loaded`);
    return bank.exercises.map((exercise,index)=>psBuildItem(profile,exercise,language,index+1));}
});
