const soExerciseBanks=new Map();

function soPathSlug(value,label){
  const slug=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error(`${label} must be a lowercase path slug`);
  return slug;
}

function soExerciseSet(profile){
  return soPathSlug(profile&&profile.activity&&profile.activity.generator
    &&profile.activity.generator.exerciseSet,`${profile&&profile.id||'simulate-output'}: exerciseSet`);
}

function soExerciseLibrary(profile){
  return soPathSlug(profile&&profile.activity&&profile.activity.generator
    &&profile.activity.generator.library,`${profile&&profile.id||'simulate-output'}: library`);
}

function soManifestUrl(profile,language){
  return resolveExerciseManifestUrl({library:soExerciseLibrary(profile),language,
    exerciseSet:soExerciseSet(profile)});
}

function soCatalog(profile,language){
  const url=soManifestUrl(profile,language);
  const bank=soExerciseBanks.get(url);
  if(!bank)throw new Error(`${profile.id}: exercise manifest '${url}' has not been loaded`);
  return bank.exercises;
}

function soBank(profile,language){
  const url=soManifestUrl(profile,language),bank=soExerciseBanks.get(url);
  if(!bank)throw new Error(`${profile.id}: exercise manifest '${url}' has not been loaded`);
  return bank;
}

function soValidatedManifest(manifest,url){
  return sourceProgramValidateManifest(manifest,url,'Simulate Output');
}

function soInstallExerciseBank(url,language,exerciseSet,manifest,exerciseRows){
  const checked=soValidatedManifest(manifest,url);
  const byFilename=new Map(exerciseRows.map(row=>[row.filename,row]));
  const exercises=checked.exercises.map(filename=>{
    const row=byFilename.get(filename);
    if(!row||typeof row.raw!=='string')throw new Error(`${url}: '${filename}' was not loaded`);
    return {id:filename.replace(/\.[^.]+$/,''),filename,
      raw:row.raw.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')};
  });
  exercises.forEach(exercise=>soParseExercise(exercise,language));
  soExerciseBanks.set(url,Object.freeze({language:soPathSlug(language,'CodeScope language'),
    exerciseSet:soPathSlug(exerciseSet,'exerciseSet'),title:checked.title,
    exercises:Object.freeze(exercises)}));
}

async function soFetchExerciseBank(profile,language){
  const url=soManifestUrl(profile,language);
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);
  const manifest=soValidatedManifest(await response.json(),url);
  const slash=url.lastIndexOf('/');
  const directory=slash<0?'':url.slice(0,slash+1);
  const rows=await Promise.all(manifest.exercises.map(async filename=>{
    const exerciseUrl=directory+encodeURIComponent(filename);
    const exerciseResponse=await fetch(exerciseUrl,{cache:'no-store'});
    if(!exerciseResponse.ok)throw new Error(`${exerciseUrl}: HTTP ${exerciseResponse.status}`);
    return {filename,raw:await exerciseResponse.text()};
  }));
  soInstallExerciseBank(url,language,soExerciseSet(profile),manifest,rows);
}

async function soLoadExerciseContent(){
  const profiles=PROFILES.filter(profile=>profileIsEnabled(profile)
    &&profile.activity&&profile.activity.kind===SIMULATE_OUTPUT_MANIFEST.id);
  const unique=new Map(profiles.map(profile=>[soManifestUrl(profile,state.language),profile]));
  await Promise.all([...unique.values()].map(profile=>soFetchExerciseBank(profile,state.language)));
}

function soParseExercise(exercise,language,sourceValueMode='authored',inputValueMode='authored'){
  const raw=exercise.raw.replace(/\r\n?/g,'\n');
  if(/@output\b|@variables\b/.test(raw))
    throw new Error(`${exercise.filename}: embedded answer metadata is no longer supported`);
  const details=sourceProgramMetadataAndSource(raw,exercise.filename);
  const inputDefinitions=sourceProgramInputDirectives(details.metadata,exercise.filename,inputValueMode);
  const inputValues=Object.fromEntries(inputDefinitions.map(definition=>[definition.target,
    {value:definition.materializedValue,raw:definition.materializedRaw}]));
  const parsedSource=sourceProgramParseExercise({details,filename:exercise.filename,language:language||'c',
    sourceValueMode,inputValues});
  (parsedSource.coreProgramResult.ir.statements||[]).filter(statement=>statement.kind==='input').forEach(statement=>
    statement.reads.forEach(read=>sourceProgramClaimInputDefinition(inputDefinitions,read.target,exercise.filename,
      statement.sourceSpan&&statement.sourceSpan.start&&statement.sourceSpan.start.line||'?')));
  sourceProgramValidateInputDefinitions(inputDefinitions,exercise.filename);
  const answer=sourceProgramGenerateAnswer(parsedSource,exercise.filename);
  return {id:exercise.id,filename:exercise.filename,source:parsedSource.source,
    output:answer.output,expectedLines:answer.expectedLines,variables:answer.variables,
    inputs:inputDefinitions.map(definition=>({target:definition.target,value:definition.materializedValue})),
    sourceValueMode,inputValueMode,seedValues:parsedSource.seedValues,
    coreProgram:parsedSource.coreProgramResult.ir,coreDiagnostics:parsedSource.coreProgramResult.diagnostics};
}

function soShuffle(values){
  const result=values.slice();
  for(let index=result.length-1;index>0;index--){
    const swap=Math.floor(seededRandom()*(index+1));
    [result[index],result[swap]]=[result[swap],result[index]];
  }
  return result;
}

function soBuildItem(profile,exercise,index,language){
  const sourceValueMode=profileVariableValueMode(profile),inputValueMode=profileInputValueMode(profile);
  const parsed=soParseExercise(exercise,language,sourceValueMode,inputValueMode);
  const maximum=parsed.expectedLines.length+parsed.variables.reduce((sum,variable)=>
    sum+(Array.isArray(variable.expected)?variable.expected.length:1),0);
  return {
    activityKind:SIMULATE_OUTPUT_MANIFEST.id,profileId:profile.id,itemNumber:index+1,
    language,exerciseId:parsed.id,filename:parsed.filename,source:parsed.source,
    expectedLines:parsed.expectedLines,variables:parsed.variables,inputs:parsed.inputs,
    sourceValueMode:parsed.sourceValueMode,inputValueMode:parsed.inputValueMode,sourceSeedValues:parsed.seedValues,
    response:{output:'',variables:parsed.variables.map(variable=>
      Array.isArray(variable.expected)?variable.expected.map(()=>''):'')},
    result:null,checked:false,itemScore:null,points:null,maxPoints:maximum,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,showSolution:false,
    flagged:false,lockedAt:null,examActionLog:[]
  };
}

function soGenerateItem({profile,index,language,generationContext}){
  if(!generationContext.order){
    const catalog=soCatalog(profile,language).slice();
    generationContext.order=profile.activity.generator.shuffle===false?catalog:soShuffle(catalog);
  }
  const exercise=generationContext.order[index];
  if(!exercise)throw new Error(`${profile.id}: no exercise at item ${index+1}`);
  const bank=soBank(profile,language);
  return soBuildItem(profile,exercise,index,bank.language);
}

function soRegenerateItem(item,profile){
  const bank=soBank(profile,item.language||state.language);
  const exercise=bank.exercises.find(candidate=>candidate.filename===item.filename||candidate.id===item.exerciseId);
  if(!exercise)throw new Error(`${profile.id}: current exercise '${item.filename||item.exerciseId}' is not in the active manifest`);
  return soBuildItem(profile,exercise,Math.max(0,(item.itemNumber||1)-1),bank.language);
}
