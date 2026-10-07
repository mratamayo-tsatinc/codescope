// ============================================================================
// SHARED SOURCE PROGRAM PIPELINE
// ----------------------------------------------------------------------------
// Manifest-backed activities load bytes and configuration. This shell-owned
// pipeline normalizes source files, reads CodeScope metadata, materializes
// seeded declarations, and sends every live program through coreParseProgram.
// ============================================================================

function sourceProgramValidateManifest(manifest,url,defaultTitle){
  if(!manifest||typeof manifest!=='object')throw new Error(`${url}: manifest must be a JSON object`);
  if(!Array.isArray(manifest.exercises)||!manifest.exercises.length)
    throw new Error(`${url}: exercises must be a non-empty array`);
  const seen=new Set(),exercises=manifest.exercises.map(filename=>{
    if(typeof filename!=='string'||!filename.trim())throw new Error(`${url}: every exercise must be a filename`);
    const clean=filename.trim();
    if(clean.includes('/')||clean.includes('\\')||clean==='.'||clean==='..')
      throw new Error(`${url}: exercise '${clean}' must be a filename inside the exercise-set directory`);
    if(seen.has(clean))throw new Error(`${url}: duplicate exercise '${clean}'`);
    seen.add(clean);return clean;
  });
  return {title:String(manifest.title||defaultTitle||'Source Programs').trim()||defaultTitle||'Source Programs',exercises};
}

function sourceProgramMetadataAndSource(raw,filename){
  const normalized=String(raw||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const leading=/^\s*\/\*([\s\S]*?)\*\/\s*/.exec(normalized);
  const metadata=leading&&/@codescope\b/.test(leading[1])?leading[1]:'';
  const source=metadata?normalized.slice(leading[0].length):normalized;
  const result=/@result\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(metadata);
  const title=/@title\s+([^\n]+)/.exec(metadata);
  if(!source.trim())throw new Error(`${filename}: source code is required`);
  return {source,metadata,resultName:result?result[1]:null,
    title:title?title[1].trim():String(filename||'source').replace(/\.[^.]+$/,'')};
}

function sourceProgramSeedDirectives(metadata,filename){
  const directives=new Map();
  String(metadata||'').split('\n').forEach((raw,index)=>{
    const line=raw.replace(/^\s*\*?\s*/,'').trim();if(!line.startsWith('@seed'))return;
    const head=/^@seed\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/.exec(line);
    if(!head)throw new Error(`${filename}: metadata line ${index+1}: expected @seed name min=<number> max=<number> [step=<positive-number>] or values=<literal>|<literal>`);
    const name=head[1],spec=head[2].trim();let directive;
    const range=/^min=(-?(?:\d+(?:\.\d*)?|\.\d+))\s+max=(-?(?:\d+(?:\.\d*)?|\.\d+))(?:\s+step=((?:\d+(?:\.\d*)?|\.\d+)))?(?:\s+decimals=(\d+))?$/.exec(spec);
    const choices=/^values=(.+)$/.exec(spec);
    if(range){
      const min=Number(range[1]),max=Number(range[2]),step=range[3]===undefined?null:Number(range[3]),
        decimals=range[4]===undefined?null:Number(range[4]);
      if(!Number.isFinite(min)||!Number.isFinite(max)||min>max
        ||step!==null&&(!Number.isFinite(step)||step<=0)
        ||decimals!==null&&(!Number.isSafeInteger(decimals)||decimals<0||decimals>8))
        throw new Error(`${filename}: invalid @seed range for '${name}'`);
      directive={name,kind:'range',min,max,step,decimals};
    }else if(choices){
      const values=sourceProgramSplitSeedChoices(choices[1],filename,index+1,name);
      directive={name,kind:'choices',values};
    }else throw new Error(`${filename}: metadata line ${index+1}: expected @seed name min=<number> max=<number> [step=<positive-number>] or values=<literal>|<literal>`);
    if(directives.has(name))throw new Error(`${filename}: duplicate @seed directive for '${name}'`);
    directives.set(name,directive);
  });
  return directives;
}

function sourceProgramSplitSeedChoices(source,filename,metadataLine,name){
  const values=[];let quote=null,escaped=false,start=0;
  for(let index=0;index<=source.length;index++){
    const character=source[index];
    if(index===source.length||character==='|'&&!quote){
      const value=source.slice(start,index).trim();
      if(!value)throw new Error(`${filename}: metadata line ${metadataLine}: @seed '${name}' contains an empty choice`);
      values.push(value);start=index+1;continue;
    }
    if(escaped){escaped=false;continue;}
    if(character==='\\'&&quote){escaped=true;continue;}
    if(character==='"'||character==="'") quote=quote===character?null:(quote||character);
  }
  if(quote)throw new Error(`${filename}: metadata line ${metadataLine}: @seed '${name}' has an unterminated quoted choice`);
  return values;
}

function sourceProgramLiteralValue(raw,dataType,filename,line,name){
  const value=String(raw).trim(),label=`${filename}:${line}: @seed '${name}'`;
  if(dataType==='int'){
    if(!/^-?\d+$/.test(value))throw new Error(`${label} requires an integer literal initializer and choices`);
    const parsed=Number(value);if(!Number.isSafeInteger(parsed))throw new Error(`${label} integer is outside the safe range`);return parsed;
  }
  if(dataType==='float'||dataType==='double'){
    if(!/^-?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)[fFdD]?$/.test(value))
      throw new Error(`${label} requires a numeric literal initializer and choices`);
    const parsed=Number(value.replace(/[fFdD]$/,''));if(!Number.isFinite(parsed))throw new Error(`${label} requires a finite number`);return parsed;
  }
  if(dataType==='char'){
    const match=/^'((?:\\.|[^'\\]))'$/.exec(value);
    if(!match)throw new Error(`${label} requires character literal choices such as values='A'|'B'`);
    return decodeCoreStringEscape(match[1],label);
  }
  if(dataType==='string'){
    const match=/^"((?:\\.|[^"\\])*)"$/.exec(value);
    if(!match)throw new Error(`${label} requires string literal choices such as values="Ada"|"Grace"`);
    return decodeCoreStringEscape(match[1],label);
  }
  if(dataType==='boolean'){
    if(value!=='true'&&value!=='false')
      throw new Error(`${label} requires boolean literal choices such as values=true|false`);
    return value==='true';
  }
  throw new Error(`${label} does not support data type '${dataType}'`);
}

function sourceProgramSeedLiteral(value,dataType,language,decimals){
  if(dataType==='boolean')return value?'true':'false';
  if(dataType==='char'){
    const escaped=String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/\r/g,'\\r');
    return `'${escaped}'`;
  }
  if(dataType==='string'){
    const escaped=String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/\r/g,'\\r');
    return `"${escaped}"`;
  }
  if(dataType==='int')return String(value);
  let result=decimals===null||decimals===undefined?String(value):Number(value).toFixed(decimals);
  if(!/[.eE]/.test(result))result+='.0';
  return dataType==='float'&&language==='java'?`${result}f`:result;
}

function sourceProgramSeedBindings(raw,language){
  let match;
  if(language==='c'){
    match=/^(\s*(?:const\s+)?char\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*\]\s*=\s*)([^;]+)(;\s*)$/.exec(raw);
    if(match)return [{name:match[2],initializer:match[3],dataType:'string',
      initializerStart:match[1].length,initializerEnd:match[1].length+match[3].length}];
    match=/^(\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+)(.+?)(\s*)$/.exec(raw);
    if(match){
      const initializer=match[3].trim();let dataType;
      if(/^"/.test(initializer))dataType='string';else if(/^'/.test(initializer))dataType='char';
      else dataType=/[.eEfFdD]/.test(initializer)?'double':'int';
      const initializerStart=match[1].length+match[3].indexOf(initializer);
      return [{name:match[2],initializer,dataType,initializerStart,initializerEnd:initializerStart+initializer.length}];
    }
  }
  const fragments=coreDeclarationFragments(raw,language);
  return fragments?fragments.map(fragment=>({name:fragment.name,dataType:fragment.dataType,
    initializer:fragment.initializer,initializerStart:fragment.initializerStart,
    initializerEnd:fragment.initializerEnd})):[];
}

function sourceProgramRangeDecimals(directive,binding){
  if(directive.decimals!==null)return directive.decimals;
  const places=value=>{const match=/(?:\.(\d+))/.exec(String(value).replace(/[fFdD]$/,''));return match?match[1].length:0;};
  return Math.min(8,Math.max(places(directive.min),places(directive.max),
    directive.step===null?0:places(directive.step),places(binding.initializer)));
}

function sourceProgramInputFields(spec,filename,line){
  const fields={};let index=0;
  while(index<spec.length){
    while(/\s/.test(spec[index]||''))index++;
    if(index>=spec.length)break;
    const name=/^[A-Za-z][A-Za-z0-9]*/.exec(spec.slice(index));
    if(!name||spec[index+name[0].length]!=='=')
      throw new Error(`${filename}: metadata line ${line}: invalid @input field near '${spec.slice(index)}'`);
    const key=name[0];index+=key.length+1;
    if(key==='choices'||key==='values'){
      fields[key]=spec.slice(index).trim();index=spec.length;continue;
    }
    const quote=spec[index];let value='';
    if(quote==='"'||quote==="'"){
      const start=index++;let escaped=false;
      while(index<spec.length){
        const character=spec[index++];
        if(escaped){escaped=false;continue;}
        if(character==='\\'){escaped=true;continue;}
        if(character===quote)break;
      }
      if(spec[index-1]!==quote)throw new Error(`${filename}: metadata line ${line}: unterminated ${key} literal`);
      value=spec.slice(start,index);
    }else{
      const start=index;while(index<spec.length&&!/\s/.test(spec[index]))index++;
      value=spec.slice(start,index);
    }
    fields[key]=value;
  }
  return fields;
}

function sourceProgramInputLiteral(raw,filename,line,target){
  const value=String(raw==null?'':raw).trim(),label=`${filename}: metadata line ${line}: @input '${target}'`;
  if(/^-?\d+$/.test(value)){
    const parsed=Number(value);if(!Number.isSafeInteger(parsed))throw new Error(`${label} integer is outside the safe range`);
    return {value:parsed,kind:'int',raw:String(parsed)};
  }
  if(/^-?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)[fFdD]?$/.test(value)){
    const parsed=Number(value.replace(/[fFdD]$/,''));if(!Number.isFinite(parsed))throw new Error(`${label} requires a finite number`);
    return {value:parsed,kind:'number',raw:value.replace(/[fFdD]$/,'')};
  }
  let match=/^'((?:\\.|[^'\\]))'$/.exec(value);
  if(match)return {value:decodeCoreStringEscape(match[1],label),kind:'char',raw:decodeCoreStringEscape(match[1],label)};
  match=/^"((?:\\.|[^"\\])*)"$/.exec(value);
  if(match)return {value:decodeCoreStringEscape(match[1],label),kind:'string',raw:decodeCoreStringEscape(match[1],label)};
  throw new Error(`${label} value must be a number, character literal, or string literal`);
}

// Input metadata is shared by every source-file activity. A value is the
// authored input. Numeric ranges may add step/decimals, while characters and
// strings use choices (values is accepted as the shared @seed vocabulary).
function sourceProgramInputDirectives(metadata,filename,mode='authored',randomInteger){
  if(!['authored','seeded'].includes(mode))throw new Error(`${filename}: inputValueMode must be 'authored' or 'seeded'`);
  const definitions=[],choose=typeof randomInteger==='function'?randomInteger:
    (typeof randInt==='function'?randInt:(min,max)=>min+Math.floor(Math.random()*(max-min+1)));
  String(metadata||'').split('\n').forEach((raw,index)=>{
    const line=raw.replace(/^\s*\*?\s*/,'').trim();
    if(!line.startsWith('@input'))return;
    const fields=sourceProgramInputFields(line.slice(6).trim(),filename,index+1);
    const allowed=new Set(['target','value','min','max','step','decimals','choices','values']);
    Object.keys(fields).forEach(name=>{if(!allowed.has(name))
      throw new Error(`${filename}: metadata line ${index+1}: unsupported @input field '${name}'`);});
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fields.target||''))
      throw new Error(`${filename}: metadata line ${index+1}: @input requires target=<identifier>`);
    if(fields.value===undefined)throw new Error(`${filename}: metadata line ${index+1}: @input requires value=<literal>`);
    if(fields.choices!==undefined&&fields.values!==undefined)
      throw new Error(`${filename}: metadata line ${index+1}: use either choices= or values=, not both`);
    const authored=sourceProgramInputLiteral(fields.value,filename,index+1,fields.target);
    const choiceSpec=fields.choices===undefined?fields.values:fields.choices;
    let kind='fixed',min=null,max=null,step=null,decimals=null,choices=null,materialized=authored;
    if(choiceSpec!==undefined){
      if(fields.min!==undefined||fields.max!==undefined||fields.step!==undefined||fields.decimals!==undefined)
        throw new Error(`${filename}: metadata line ${index+1}: choices cannot be combined with a numeric range`);
      const rawChoices=sourceProgramSplitSeedChoices(choiceSpec,filename,index+1,fields.target);
      choices=rawChoices.map(choice=>sourceProgramInputLiteral(choice,filename,index+1,fields.target));
      const compatible=choice=>choice.kind===authored.kind
        ||['int','number'].includes(choice.kind)&&['int','number'].includes(authored.kind);
      if(choices.some(choice=>!compatible(choice)))
        throw new Error(`${filename}: metadata line ${index+1}: @input choices must match the authored value type`);
      if(!choices.some(choice=>choice.value===authored.value))
        throw new Error(`${filename}: metadata line ${index+1}: authored input value must appear in choices`);
      kind='choices';if(mode==='seeded')materialized=choices[choose(0,choices.length-1)];
    }else if(fields.min!==undefined||fields.max!==undefined||fields.step!==undefined||fields.decimals!==undefined){
      if(!['int','number'].includes(authored.kind)||fields.min===undefined||fields.max===undefined)
        throw new Error(`${filename}: metadata line ${index+1}: numeric input ranges require min and max`);
      min=Number(fields.min);max=Number(fields.max);step=fields.step===undefined?null:Number(fields.step);
      decimals=fields.decimals===undefined?null:Number(fields.decimals);
      if(!Number.isFinite(min)||!Number.isFinite(max)||min>max||authored.value<min||authored.value>max
        ||step!==null&&(!Number.isFinite(step)||step<=0)
        ||decimals!==null&&(!Number.isSafeInteger(decimals)||decimals<0||decimals>8))
        throw new Error(`${filename}: metadata line ${index+1}: invalid @input numeric range`);
      const rangeKind=authored.kind==='number'||decimals!==null&&decimals>0
        ||![min,max].every(Number.isSafeInteger)||step!==null&&!Number.isSafeInteger(step)?'number':'int';
      if(rangeKind==='int'&&(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)
        ||step!==null&&!Number.isSafeInteger(step)))
        throw new Error(`${filename}: metadata line ${index+1}: integer input range and step require whole numbers`);
      const places=value=>{const match=/\.(\d+)/.exec(String(value));return match?match[1].length:0;};
      decimals=decimals===null?(rangeKind==='int'?0:Math.min(8,Math.max(places(fields.value),places(fields.min),places(fields.max),places(fields.step||0)))):decimals;
      const scale=10**decimals,scaledMin=Math.round(min*scale),scaledMax=Math.round(max*scale);
      const scaledStep=step===null?1:Math.round(step*scale);
      if(step!==null&&(scaledStep<=0||Math.abs(scaledStep/scale-step)>1e-10))
        throw new Error(`${filename}: metadata line ${index+1}: step cannot be represented with decimals=${decimals}`);
      if(step!==null&&Math.abs((authored.value-min)/step-Math.round((authored.value-min)/step))>1e-8)
        throw new Error(`${filename}: metadata line ${index+1}: authored value does not align with step`);
      kind='range';
      if(mode==='seeded'){
        const slots=Math.floor((scaledMax-scaledMin)/scaledStep),value=(scaledMin+choose(0,slots)*scaledStep)/scale;
        materialized={value,kind:rangeKind,raw:decimals?value.toFixed(decimals):String(value)};
      }
    }
    if(definitions.some(definition=>definition.target===fields.target))
      throw new Error(`${filename}: metadata line ${index+1}: duplicate @input target '${fields.target}'`);
    definitions.push({target:fields.target,value:authored.value,valueKind:authored.kind,min,max,step,decimals,choices,kind,
      materializedValue:materialized.value,materializedRaw:materialized.raw,used:false,metadataLine:index+1});
  });
  return definitions;
}

function sourceProgramClaimInputDefinition(definitions,target,filename,line){
  const definition=definitions.find(candidate=>!candidate.used&&candidate.target===target);
  if(!definition)throw new Error(`${filename}:${line}: input target '${target}' has no matching @input metadata`);
  definition.used=true;return definition;
}

function sourceProgramValidateInputDefinitions(definitions,filename){
  const unused=definitions.find(candidate=>!candidate.used);
  if(unused)throw new Error(`${filename}: @input target '${unused.target}' does not match a supported input statement`);
}

function sourceProgramMaterializeSource(details,language,filename,mode,randomInteger){
  mode=mode||'authored';
  if(!['authored','seeded'].includes(mode))throw new Error(`${filename}: sourceValueMode must be 'authored' or 'seeded'`);
  const directives=sourceProgramSeedDirectives(details.metadata,filename),seen=new Set(),seedValues={};
  const choose=typeof randomInteger==='function'?randomInteger:
    (typeof randInt==='function'?randInt:(min,max)=>min+Math.floor(Math.random()*(max-min+1)));
  const lines=details.source.split('\n').map((raw,index)=>{
    const bindings=sourceProgramSeedBindings(raw,language);if(!bindings.length)return raw;
    const replacements=[];
    bindings.forEach(binding=>{
      const name=binding.name,directive=directives.get(name);if(!directive)return;
      if(seen.has(name))throw new Error(`${filename}:${index+1}: seeded binding '${name}' is declared more than once`);
      if(binding.initializer===null)
        throw new Error(`${filename}:${index+1}: @seed '${name}' requires a literal initializer`);
      seen.add(name);const authoredValue=sourceProgramLiteralValue(binding.initializer,binding.dataType,filename,index+1,name);
      let value=authoredValue,decimals=null;
      if(directive.kind==='choices'){
        const choices=directive.values.map(choice=>sourceProgramLiteralValue(choice,binding.dataType,filename,index+1,name));
        if(mode==='seeded')value=choices[choose(0,choices.length-1)];
      }else{
        if(!['int','float','double'].includes(binding.dataType))
          throw new Error(`${filename}:${index+1}: @seed '${name}' must use values= choices for ${binding.dataType}`);
        decimals=binding.dataType==='int'?0:sourceProgramRangeDecimals(directive,binding);
        if(binding.dataType==='int'&&(!Number.isSafeInteger(directive.min)||!Number.isSafeInteger(directive.max)
          ||directive.step!==null&&!Number.isSafeInteger(directive.step)))
          throw new Error(`${filename}:${index+1}: @seed '${name}' integer range and step require whole numbers`);
        if(mode==='seeded'){
          const scale=10**decimals;
          const scaledMin=Math.round(directive.min*scale),scaledMax=Math.round(directive.max*scale);
          if(directive.step===null)value=choose(scaledMin,scaledMax)/scale;
          else{
            const scaledStep=Math.round(directive.step*scale);
            if(scaledStep<=0||Math.abs(scaledStep/scale-directive.step)>1e-10)
              throw new Error(`${filename}:${index+1}: @seed '${name}' step cannot be represented with decimals=${decimals}`);
            const slots=Math.floor((scaledMax-scaledMin)/scaledStep);
            value=(scaledMin+choose(0,slots)*scaledStep)/scale;
          }
        }
      }
      seedValues[name]=value;
      if(mode==='seeded')replacements.push({start:binding.initializerStart,end:binding.initializerEnd,
        text:sourceProgramSeedLiteral(value,binding.dataType,language,decimals)});
    });
    return replacements.sort((left,right)=>right.start-left.start)
      .reduce((line,replacement)=>line.slice(0,replacement.start)+replacement.text+line.slice(replacement.end),raw);
  });
  directives.forEach((directive,name)=>{if(!seen.has(name))
    throw new Error(`${filename}: @seed references undeclared binding '${name}'`);});
  return {source:lines.join('\n'),seedValues,directives};
}

function sourceProgramParseExercise(spec){
  spec=spec||{};const filename=spec.filename||'source',language=String(spec.language||'c').toLowerCase();
  const authored=spec.details||sourceProgramMetadataAndSource(spec.raw,filename);
  const materialized=sourceProgramMaterializeSource(authored,language,filename,spec.sourceValueMode||'authored',spec.randomInteger);
  const coreProgramResult=coreParseProgram({language,source:materialized.source,filename,inputValues:spec.inputValues||{}});
  return Object.assign({},authored,{templateSource:authored.source,source:materialized.source,
    sourceValueMode:spec.sourceValueMode||'authored',seedValues:materialized.seedValues,
    seedDirectives:materialized.directives,lines:materialized.source.split('\n'),coreProgramResult,
    statementsByLine:new Map((coreProgramResult.ir&&coreProgramResult.ir.statements||[])
      .map(statement=>[statement.sourceSpan.start.line,statement]))});
}

function sourceProgramTerminalScreen(stream){
  return coreTerminalScreen(stream).lines.slice();
}

function sourceProgramAnswerValue(binding){
  const value=binding&&binding.value;
  if(Array.isArray(value))return value.map(entry=>String(entry));
  if(typeof value==='boolean')return value?'true':'false';
  return String(value==null?'':value);
}

function sourceProgramGenerateAnswer(parsed,filename){
  const result=parsed&&parsed.coreProgramResult;
  if(!result||!result.ir)throw new Error(`${filename||'source'}: no executable program was parsed`);
  if(result.diagnostics&&result.diagnostics.length){
    const details=result.diagnostics.map(diagnostic=>{
      const line=diagnostic.location&&diagnostic.location.start&&diagnostic.location.start.line;
      return `${line?`line ${line}: `:''}${diagnostic.message||diagnostic.code}`;
    }).join('; ');
    throw new Error(`${filename||'source'}: cannot generate a complete answer key: ${details}`);
  }
  const output=result.effects.filter(effect=>effect.kind==='output').map(effect=>effect.text).join('');
  const screenLines=sourceProgramTerminalScreen(output);
  if(output.endsWith('\n'))screenLines.pop();
  const memory=result.ir.metadata&&result.ir.metadata.expectedMemory||{};
  const variables=Object.values(memory).filter(binding=>binding&&binding.mutable!==false
    &&binding.kind!=='constant'&&binding.initialized!==false&&binding.value!==undefined)
    .map(binding=>({name:binding.name,dataType:binding.dataType||null,
      expected:sourceProgramAnswerValue(binding)}));
  if(!screenLines.length&&!variables.length)
    throw new Error(`${filename||'source'}: generated answer key has no output or initialized variables`);
  return {output,expectedLines:screenLines,variables};
}
