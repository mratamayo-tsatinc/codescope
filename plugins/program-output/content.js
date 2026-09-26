// Runtime exercise-bank loading and constrained C/Java source parsing for
// Program Output profiles. Source files are the authored truth; they are
// parsed into the same Program IR used by seeded generation.
const PROGRAM_OUTPUT_EXERCISE_ROOT='plugins/program-output/exercises';
const programOutputExerciseBanks=new Map();

function poContentSlug(value,label){
  const slug=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${label} must be a lowercase path slug`);
  return slug;
}

function poContentConfig(profile){return profile&&profile.content||{};}

function poExerciseSet(profile){
  return poContentSlug(poContentConfig(profile).exerciseSet,`${profile&&profile.id||'program-output'}: exerciseSet`);
}

function poManifestUrl(profile,language){
  return `${PROGRAM_OUTPUT_EXERCISE_ROOT}/${poContentSlug(language,'CodeScope language')}/${poExerciseSet(profile)}/manifest.json`;
}

function poValidateManifest(manifest,url){
  if(!manifest||typeof manifest!=='object') throw new Error(`${url}: manifest must be a JSON object`);
  if(!Array.isArray(manifest.exercises)||!manifest.exercises.length)
    throw new Error(`${url}: exercises must be a non-empty array`);
  const seen=new Set();
  const exercises=manifest.exercises.map(filename=>{
    if(typeof filename!=='string'||!filename.trim()) throw new Error(`${url}: every exercise must be a filename`);
    const clean=filename.trim();
    if(clean.includes('/')||clean.includes('\\')||clean==='.'||clean==='..')
      throw new Error(`${url}: exercise '${clean}' must be a filename inside the exercise-set directory`);
    if(seen.has(clean)) throw new Error(`${url}: duplicate exercise '${clean}'`);
    seen.add(clean);return clean;
  });
  return {title:String(manifest.title||'Program Output').trim()||'Program Output',exercises};
}

function poDecodeString(raw,filename){
  let value='';
  for(let index=0;index<raw.length;index++){
    const character=raw[index];
    if(character!=='\\'){value+=character;continue;}
    const escaped=raw[++index];
    if(escaped===undefined) throw new Error(`${filename}: incomplete string escape`);
    if(escaped==='n') value+='\n';
    else if(escaped==='t') value+='\t';
    else if(escaped==='r') value+='\r';
    else if(escaped==='"') value+='"';
    else if(escaped==="'") value+="'";
    else if(escaped==='\\') value+='\\';
    else throw new Error(`${filename}: unsupported string escape '\\${escaped}'`);
  }
  return value;
}

function poMetadataAndSource(raw,filename){
  const normalized=String(raw||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const leading=/^\s*\/\*([\s\S]*?)\*\/\s*/.exec(normalized);
  const metadata=leading&&/@codescope\b/.test(leading[1])?leading[1]:'';
  const source=metadata?normalized.slice(leading[0].length):normalized;
  const result=/@result\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(metadata);
  const title=/@title\s+([^\n]+)/.exec(metadata);
  if(!source.trim()) throw new Error(`${filename}: source code is required`);
  return {source,metadata,resultName:result?result[1]:null,title:title?title[1].trim():filename.replace(/\.[^.]+$/,'')};
}

function poFindMatchingBrace(source,openIndex,filename){
  let depth=0,quote=null,escaped=false;
  for(let index=openIndex;index<source.length;index++){
    const character=source[index];
    if(quote){
      if(escaped) escaped=false;
      else if(character==='\\') escaped=true;
      else if(character===quote) quote=null;
      continue;
    }
    if(character==='"'||character==="'"){quote=character;continue;}
    if(character==='{') depth++;
    else if(character==='}'&&--depth===0) return index;
  }
  throw new Error(`${filename}: main method has an unmatched brace`);
}

function poProgramBody(source,language,filename){
  const main=language==='c'
    ?/\b(?:int|void)\s+main\s*\([^)]*\)\s*\{/.exec(source)
    :/\bstatic\s+void\s+main\s*\([^)]*\)\s*\{/.exec(source);
  if(!main) throw new Error(`${filename}: supported source must contain a main entry point`);
  const open=main.index+main[0].lastIndexOf('{');
  return {body:source.slice(open+1,poFindMatchingBrace(source,open,filename)),
    baseLine:source.slice(0,open+1).split('\n').length};
}

function poSplitStatements(body,filename,baseLine){
  const rows=[];let start=0,startLine=null,line=baseLine||1,quote=null,escaped=false,paren=0;
  for(let index=0;index<body.length;index++){
    const character=body[index];
    if(startLine===null&&!/\s/.test(character)) startLine=line;
    if(character==='\n') line++;
    if(quote){
      if(escaped) escaped=false;
      else if(character==='\\') escaped=true;
      else if(character===quote) quote=null;
      continue;
    }
    if(character==='"'||character==="'"){quote=character;continue;}
    if(character==='(') paren++;
    else if(character===')') paren--;
    else if(character===';'&&paren===0){
      const text=body.slice(start,index).trim();
      if(text) rows.push({text,line:startLine||line,endLine:line});
      start=index+1;startLine=null;
    }
  }
  if(quote||paren!==0) throw new Error(`${filename}: unterminated string or parenthesized expression`);
  return rows;
}

function poExpressionTokens(source,filename,line){
  const tokens=[];let index=0;
  while(index<source.length){
    if(/\s/.test(source[index])){index++;continue;}
    const pair=/^(\|\||&&|==|!=|<=|>=)/.exec(source.slice(index));
    if(pair){tokens.push({type:pair[1],value:pair[1]});index+=pair[1].length;continue;}
    const number=/^(?:(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)[fFdD]?/.exec(source.slice(index));
    if(number){
      const raw=number[0],numeric=raw.replace(/[fFdD]$/,'');
      tokens.push({type:'literal',value:Number(numeric),dataType:/[.eEfFdD]/.test(raw)?'float':'int'});
      index+=raw.length;continue;
    }
    const character=/^'((?:\\.|[^'\\]))'/.exec(source.slice(index));
    if(character){
      tokens.push({type:'literal',value:poDecodeString(character[1],filename),dataType:'char'});
      index+=character[0].length;continue;
    }
    const name=/^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
    if(name){tokens.push({type:'name',value:name[0]});index+=name[0].length;continue;}
    if('+-*/%()!<>'.includes(source[index])){tokens.push({type:source[index],value:source[index++]});continue;}
    throw new Error(`${filename}:${line}: unsupported expression token '${source[index]}'`);
  }
  return tokens;
}

function poParseExpression(source,memory,kinds,filename,line,dataTypes){
  const tokens=poExpressionTokens(source,filename,line);let cursor=0;
  const precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  const primary=()=>{
    const token=tokens[cursor++];
    if(!token) throw new Error(`${filename}:${line}: incomplete expression '${source.trim()}'`);
    if(token.type==='literal') return makeLiteral(token.value,{dataType:token.dataType});
    if(token.type==='name'){
      if(token.value==='true'||token.value==='false') return makeLiteral(token.value==='true');
      if(!Object.prototype.hasOwnProperty.call(memory,token.value)||memory[token.value]===undefined)
        throw new Error(`${filename}:${line}: '${token.value}' is used before it is initialized`);
      return makeNamed(kinds[token.value]||'variable',token.value,memory[token.value],
        {dataType:dataTypes&&dataTypes[token.value]});
    }
    if(token.type==='!') return makeUnary('!','prefix',primary());
    if(token.type==='-'&&tokens[cursor]&&tokens[cursor].type==='literal'
      &&typeof tokens[cursor].value==='number'){
      const literal=tokens[cursor++];
      return makeLiteral(-literal.value,{dataType:literal.dataType});
    }
    if(token.type==='('){
      const nested=parse(0);
      if(!tokens[cursor]||tokens[cursor].type!==')') throw new Error(`${filename}:${line}: missing ')'`);
      cursor++;return nested;
    }
    throw new Error(`${filename}:${line}: expected an operand in '${source.trim()}'`);
  };
  const parse=min=>{
    let left=primary();
    while(tokens[cursor]&&precedence[tokens[cursor].type]>=min){
      const operator=tokens[cursor++].type;
      const right=parse(precedence[operator]+1);
      left=makeBinOp(operator,left,right);
    }
    return left;
  };
  const tree=parse(0);
  if(cursor!==tokens.length) throw new Error(`${filename}:${line}: unsupported expression '${source.trim()}'`);
  return tree;
}

function poSplitArguments(source,filename,line){
  const parts=[];let start=0,quote=null,escaped=false,depth=0;
  for(let index=0;index<source.length;index++){
    const character=source[index];
    if(quote){
      if(escaped) escaped=false;
      else if(character==='\\') escaped=true;
      else if(character===quote) quote=null;
      continue;
    }
    if(character==='"'||character==="'"){quote=character;continue;}
    if(character==='(') depth++;
    else if(character===')') depth--;
    else if(character===','&&depth===0){parts.push(source.slice(start,index).trim());start=index+1;}
  }
  if(quote||depth!==0) throw new Error(`${filename}:${line}: malformed argument list`);
  parts.push(source.slice(start).trim());return parts;
}

function poParseCStringLiteral(source,filename,line){
  let index=0,value='',found=false;
  while(index<source.length){
    while(/\s/.test(source[index]||'')) index++;
    if(source[index]!== '"') throw new Error(`${filename}:${line}: printf format must be a string literal`);
    found=true;index++;let raw='',escaped=false;
    for(;index<source.length;index++){
      const character=source[index];
      if(escaped){raw+='\\'+character;escaped=false;continue;}
      if(character==='\\'){escaped=true;continue;}
      if(character==='"'){index++;break;}
      raw+=character;
    }
    value+=poDecodeString(raw,filename);
  }
  if(!found) throw new Error(`${filename}:${line}: printf format string is required`);
  return value;
}

function poOutputPartsFromFormat(format,args,memory,filename,line,dataTypes){
  const parts=[];let text='',argumentIndex=0;
  const flush=()=>{if(text){parts.push({kind:'text',value:text});text='';}};
  for(let index=0;index<format.length;index++){
    if(format[index]!=='%'){text+=format[index];continue;}
    let token='',specifier=format[++index];
    if(specifier==='%'){text+='%';continue;}
    if(specifier==='.'){
      token='.';specifier=format[++index];
      while(/\d/.test(specifier||'')){token+=specifier;specifier=format[++index];}
    }
    token+=specifier||'';
    if(!/^(?:d|i|c|f|\.\d+f)$/.test(token))
      throw new Error(`${filename}:${line}: unsupported printf format '%${token}'`);
    flush();const name=args[argumentIndex++];
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name||'')
      ||!Object.prototype.hasOwnProperty.call(memory,name)||memory[name]===undefined)
      throw new Error(`${filename}:${line}: %${token} requires an initialized identifier argument`);
    parts.push({kind:'expression',expression:identifierExpression(name,{dataType:dataTypes&&dataTypes[name]}),format:token});
  }
  flush();
  if(argumentIndex!==args.length) throw new Error(`${filename}:${line}: printf argument count does not match its placeholders`);
  if(!parts.length) parts.push({kind:'text',value:''});
  return parts;
}

function poParseCOutput(text,memory,filename,line,index,dataTypes){
  const match=/^printf\s*\(([\s\S]*)\)$/.exec(text);
  if(!match) return null;
  const args=poSplitArguments(match[1],filename,line);
  const format=poParseCStringLiteral(args.shift(),filename,line);
  const newline=format.endsWith('\n');
  const visibleFormat=newline?format.slice(0,-1):format;
  return buildOutputStatementRuntime({newline,
    parts:poOutputPartsFromFormat(visibleFormat,args,memory,filename,line,dataTypes)},index,memory);
}

function poSplitJavaConcatenation(source,filename,line){
  const pieces=[];let start=0,quote=null,escaped=false,depth=0;
  for(let index=0;index<source.length;index++){
    const character=source[index];
    if(quote){
      if(escaped) escaped=false;
      else if(character==='\\') escaped=true;
      else if(character===quote) quote=null;
      continue;
    }
    if(character==='"'){quote=character;continue;}
    if(character==='(') depth++;
    else if(character===')') depth--;
    else if(character==='+'&&depth===0){pieces.push(source.slice(start,index).trim());start=index+1;}
  }
  if(quote||depth!==0) throw new Error(`${filename}:${line}: malformed output concatenation`);
  pieces.push(source.slice(start).trim());return pieces;
}

function poParseJavaOutput(text,memory,filename,line,index,dataTypes){
  const match=/^System\.out\.(print|println)\s*\(([\s\S]*)\)$/.exec(text);
  if(!match) return null;
  const parts=poSplitJavaConcatenation(match[2],filename,line).map(piece=>{
    const string=/^"((?:\\.|[^"\\])*)"$/.exec(piece);
    if(string) return {kind:'text',value:poDecodeString(string[1],filename)};
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(piece)||!Object.prototype.hasOwnProperty.call(memory,piece))
      throw new Error(`${filename}:${line}: output expressions must be initialized identifiers`);
    return {kind:'expression',expression:identifierExpression(piece,{dataType:dataTypes&&dataTypes[piece]}),format:'raw'};
  });
  return buildOutputStatementRuntime({newline:match[1]==='println',parts},index,memory);
}

function poParseSourceExercise(exercise,language){
  const details=poMetadataAndSource(exercise.raw,exercise.filename);
  const sourceLines=details.source.split('\n');
  const region=poProgramBody(details.source,language,exercise.filename);
  const rows=poSplitStatements(region.body,exercise.filename,region.baseLine);
  const memory={},kinds={},dataTypes={},declarations=[],statements=[];
  const supportedLines=new Map();
  const markSupported=(row,statement)=>{
    statement.sourceLine=row.line;
    statement.sourceEndLine=row.endLine;
    statement.sourceText=sourceLines.slice(row.line-1,row.endLine).join('\n');
    statement.sourceIndent=(sourceLines[row.line-1]||'').match(/^\s*/)[0];
    for(let line=row.line;line<=row.endLine;line++){
      supportedLines.set(line,{statementId:statement.id,primary:line===row.line});
    }
  };
  let declarationIndex=0,assignmentIndex=0,unaryIndex=0,outputIndex=0;
  rows.forEach(row=>{
    if(/^return\b/.test(row.text)){
      if(language==='c'&&/^return\s+0$/.test(row.text)){
        const statement=programReturnStatement({id:'program-return',value:0});
        markSupported(row,statement);statements.push(statement);
      }
      return;
    }
    try{
    const output=language==='c'
      ?poParseCOutput(row.text,memory,exercise.filename,row.line,outputIndex,dataTypes)
      :poParseJavaOutput(row.text,memory,exercise.filename,row.line,outputIndex,dataTypes);
    if(output){markSupported(row,output);outputIndex++;statements.push(output);return;}
    const declarationPattern=language==='c'
      ?/^(const\s+)?(int|float|double|char)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*([\s\S]+))?$/
      :/^(final\s+)?(int|float|double|char)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*([\s\S]+))?$/;
    const declaration=declarationPattern.exec(row.text);
    if(declaration){
      const dataType=declaration[2],name=declaration[3],kind=declaration[1]?'constant':'variable';
      if(Object.prototype.hasOwnProperty.call(memory,name)) throw new Error(`${exercise.filename}:${row.line}: duplicate declaration '${name}'`);
      const initialized=declaration[4]!==undefined;
      if(kind==='constant'&&!initialized) throw new Error(`${exercise.filename}:${row.line}: constant '${name}' requires an initializer`);
      const tree=initialized?poParseExpression(declaration[4],memory,kinds,exercise.filename,row.line,dataTypes):null;
      const value=initialized?evalTree(tree):undefined;memory[name]=value;kinds[name]=kind;dataTypes[name]=dataType;
      declarations.push({kind,name,value,dataType,initialized});
      const statement=declarationStatement({id:`declaration-${++declarationIndex}`,name,dataType,
        mutable:kind!=='constant',initialized,initializer:tree?engineNodeToProgramIr(tree):null});
      statement.binding.kind=kind;statement.runtime=initialized
        ?buildDeclarationRuntime(tree,value):buildUninitializedDeclarationRuntime();
      statement.dependencies=tree?[...collectExpressionDependencies(statement.initializer)]:[];
      markSupported(row,statement);statements.push(statement);return;
    }
    const unary=/^(?:([+]{2}|[-]{2})\s*([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*)\s*([+]{2}|[-]{2}))$/.exec(row.text);
    if(unary){
      const prefix=!!unary[1],name=unary[2]||unary[3],operator=unary[1]||unary[4];
      if(kinds[name]!=='variable') throw new Error(`${exercise.filename}:${row.line}: unary update requires a mutable variable`);
      const statement=buildUnaryUpdateStatementRuntime(name,operator,prefix?'prefix':'postfix',memory,unaryIndex++);
      markSupported(row,statement);statements.push(statement);return;
    }
    const assignment=/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=|\*=|\/=|%=)\s*([\s\S]+)$/.exec(row.text);
    if(assignment){
      if(kinds[assignment[1]]!=='variable') throw new Error(`${exercise.filename}:${row.line}: assignment requires a mutable variable`);
      const tree=poParseExpression(assignment[3],memory,kinds,exercise.filename,row.line,dataTypes);
      const statement=buildAssignmentStatementRuntime(assignment[1],assignment[2],tree,memory,assignmentIndex++);
      statement.targetDataType=dataTypes[assignment[1]];
      markSupported(row,statement);statements.push(statement);return;
    }
    return;
    }catch(error){
      if(/unsupported expression|unsupported statement|output expressions must/.test(String(error&&error.message))) return;
      throw error;
    }
  });
  if(!declarations.length||!statements.some(statement=>statement.kind==='output'))
    throw new Error(`${exercise.filename}: at least one declaration and one output statement are required`);
  const resultName=details.resultName||declarations[declarations.length-1].name;
  if(!Object.prototype.hasOwnProperty.call(memory,resultName)) throw new Error(`${exercise.filename}: @result '${resultName}' is not declared`);
  const sourceDisplay={filename:exercise.filename,lines:sourceLines.map((text,index)=>{
    const support=supportedLines.get(index+1);
    return {number:index+1,text,supported:!!support,
      statementId:support&&support.statementId||null,primary:!!(support&&support.primary)};
  })};
  return {details,declarations,statements,memory,kinds,dataTypes,resultName,sourceDisplay};
}

function poBuildSourceItem(profile,exercise,language,itemNumber){
  const parsed=poParseSourceExercise(exercise,language);
  const sourceFlow=poContentConfig(profile).presentation==='source-flow';
  const programStatements=sourceFlow?parsed.statements:parsed.statements.filter(statement=>statement.kind!=='program-return');
  const resultKind=parsed.kinds[parsed.resultName]||'variable';
  const originalTree=makeNamed(resultKind,parsed.resultName,parsed.memory[parsed.resultName]);
  const originalFlat=flattenInstance(originalTree);
  let resultTarget='result',suffix=2;
  while(Object.prototype.hasOwnProperty.call(parsed.memory,resultTarget)) resultTarget=`result${suffix++}`;
  const item={
    profileId:profile.id,itemNumber,exerciseId:exercise.id,filename:exercise.filename,
    exerciseTitle:parsed.details.title,source:parsed.details.source,sourceDisplay:parsed.sourceDisplay,
    sourceFlow,language,
    originalTree,originalFlat,decls:parsed.declarations,resultName:resultTarget,
    correctFinalValue:parsed.memory[parsed.resultName],canonicalTrace:buildCanonicalTrace(originalTree),
    workingFlat:deepCloneFlat(originalFlat),history:[deepCloneFlat(originalFlat)],trace:[],
    checked:false,itemScore:null,points:null,maxPoints:null,correctSteps:0,totalOpSteps:0,
    wasCorrectFinal:null,showSolution:false,playback:null,flagged:false,lockedAt:null,
    examActionLog:[],examSequenceFailure:null,practiceInvalidExecution:null,_bindings:null
  };
  if(!sourceFlow) programStatements.push({id:'final-expression',kind:'legacy-expression',status:'locked'});
  item.program=createProgram(programStatements,{id:`${profile.id}-${exercise.id}`,language});
  item.program.mode='interactive-program';item.program.scoreAssignments=profile.program.scoreAssignments!==false;
  return item;
}

function poInstallExerciseBank(url,language,exerciseSet,manifest,rows){
  const checked=poValidateManifest(manifest,url),byFilename=new Map(rows.map(row=>[row.filename,row]));
  const exercises=checked.exercises.map(filename=>{
    const row=byFilename.get(filename);
    if(!row||typeof row.raw!=='string') throw new Error(`${url}: '${filename}' was not loaded`);
    const exercise={id:filename.replace(/\.[^.]+$/,''),filename,raw:row.raw};
    poParseSourceExercise(exercise,language);
    return Object.freeze(exercise);
  });
  programOutputExerciseBanks.set(url,Object.freeze({language:poContentSlug(language,'CodeScope language'),
    exerciseSet:poContentSlug(exerciseSet,'exerciseSet'),title:checked.title,exercises:Object.freeze(exercises)}));
}

async function poFetchExerciseBank(profile,language){
  const url=poManifestUrl(profile,language),response=await fetch(url,{cache:'no-store'});
  if(!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const manifest=poValidateManifest(await response.json(),url),directory=url.slice(0,url.lastIndexOf('/')+1);
  const rows=await Promise.all(manifest.exercises.map(async filename=>{
    const exerciseUrl=directory+encodeURIComponent(filename),exerciseResponse=await fetch(exerciseUrl,{cache:'no-store'});
    if(!exerciseResponse.ok) throw new Error(`${exerciseUrl}: HTTP ${exerciseResponse.status}`);
    return {filename,raw:await exerciseResponse.text()};
  }));
  poInstallExerciseBank(url,language,poExerciseSet(profile),manifest,rows);
}

async function poLoadExerciseContent(){
  const profiles=PROFILES.filter(profile=>profileIsEnabled(profile)&&profile.content
    &&profile.content.provider===PROGRAM_OUTPUT_PLUGIN_MANIFEST.id&&profile.content.mode==='source-files');
  const unique=new Map(profiles.map(profile=>[poManifestUrl(profile,state.language),profile]));
  await Promise.all([...unique.values()].map(profile=>poFetchExerciseBank(profile,state.language)));
}

function poShuffle(values){
  const result=values.slice();
  for(let index=result.length-1;index>0;index--){
    const swap=Math.floor(seededRandom()*(index+1));
    [result[index],result[swap]]=[result[swap],result[index]];
  }
  return result;
}

function poValidateContentProfile(profile){
  const content=poContentConfig(profile);
  if(!['generated','source-files'].includes(content.mode))
    throw new Error(`${profile.id}: content.mode must be 'generated' or 'source-files'`);
  if(content.mode==='generated'){
    if(typeof content.recipe!=='string'||!content.recipe.trim()) throw new Error(`${profile.id}: generated content requires recipe`);
    return;
  }
  poExerciseSet(profile);
  const selection=content.selection||{};
  if(selection.count!==undefined&&selection.count!=='all'
    &&(!Number.isInteger(selection.count)||selection.count<1))
    throw new Error(`${profile.id}: content.selection.count must be 'all' or a positive integer`);
  if(Number.isInteger(selection.count)&&selection.count!==profile.itemCount)
    throw new Error(`${profile.id}: content.selection.count must match scoring.itemCount`);
  if(selection.count==='all'&&profile.itemCount!=='manifest')
    throw new Error(`${profile.id}: scoring.itemCount must be 'manifest' when content.selection.count is 'all'`);
  if(selection.shuffle!==undefined&&typeof selection.shuffle!=='boolean')
    throw new Error(`${profile.id}: content.selection.shuffle must be a boolean`);
  if(content.presentation!==undefined&&!['statement-only','source-flow'].includes(content.presentation))
    throw new Error(`${profile.id}: content.presentation must be 'statement-only' or 'source-flow'`);
}

function poGenerateContentItems({profile,language,generateDefault}){
  const content=poContentConfig(profile);
  if(content.mode==='generated') return generateDefault();
  const url=poManifestUrl(profile,language),bank=programOutputExerciseBanks.get(url);
  if(!bank) throw new Error(`${profile.id}: exercise manifest '${url}' has not been loaded`);
  const selection=content.selection||{},ordered=selection.shuffle?poShuffle(bank.exercises):bank.exercises.slice();
  const count=selection.count==='all'?ordered.length:(selection.count||profile.itemCount);
  if(count>ordered.length) throw new Error(`${profile.id}: requested ${count} items from a ${ordered.length}-exercise manifest`);
  if(profile.itemCount!=='manifest'&&count!==profile.itemCount)
    throw new Error(`${profile.id}: selected item count ${count} must match scoring.itemCount ${profile.itemCount}`);
  const items=ordered.slice(0,count).map((exercise,index)=>poBuildSourceItem(profile,exercise,bank.language,index+1));
  if(typeof assignManualResponsePlans==='function') assignManualResponsePlans(profile,items);
  return items;
}

registerProfileContentProvider({
  id:PROGRAM_OUTPUT_PLUGIN_MANIFEST.id,
  validateProfile:poValidateContentProfile,
  loadContent:poLoadExerciseContent,
  generateItems:poGenerateContentItems
});
