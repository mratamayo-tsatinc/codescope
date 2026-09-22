const soExerciseBanks=new Map();
const SO_EXERCISE_ROOT='plugins/simulate-output/exercises';

function soPathSlug(value,label){
  const slug=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error(`${label} must be a lowercase path slug`);
  return slug;
}

function soExerciseSet(profile){
  return soPathSlug(profile&&profile.activity&&profile.activity.generator
    &&profile.activity.generator.exerciseSet,`${profile&&profile.id||'simulate-output'}: exerciseSet`);
}

function soManifestUrl(profile,language){
  const languageSlug=soPathSlug(language,'CodeScope language');
  return `${SO_EXERCISE_ROOT}/${languageSlug}/${soExerciseSet(profile)}/manifest.json`;
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
  if(!manifest||typeof manifest!=='object')throw new Error(`${url}: manifest must be a JSON object`);
  if(!Array.isArray(manifest.exercises)||!manifest.exercises.length)
    throw new Error(`${url}: exercises must be a non-empty array`);
  const seen=new Set();
  const exercises=manifest.exercises.map(filename=>{
    if(typeof filename!=='string'||!filename.trim())throw new Error(`${url}: every exercise must be a filename`);
    const clean=filename.trim();
    if(clean.includes('/')||clean.includes('\\')||clean==='.'||clean==='..')
      throw new Error(`${url}: exercise '${clean}' must be a filename inside the exercises directory`);
    if(seen.has(clean))throw new Error(`${url}: duplicate exercise '${clean}'`);
    seen.add(clean);return clean;
  });
  return {title:String(manifest.title||'Simulate Output').trim()||'Simulate Output',exercises};
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
  exercises.forEach(soParseExercise);
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

function soParseExercise(exercise){
  const raw=exercise.raw.replace(/\r\n?/g,'\n');
  const metadata=/^\/\*\s*\n([\s\S]*?)\*\/\s*\n?/.exec(raw);
  if(!metadata)throw new Error(`${exercise.filename}: missing leading answer metadata`);
  const outputMatch=/@output\s*\n([\s\S]*?)(?=@variables|$)/.exec(metadata[1]);
  const variablesMatch=/@variables\s*\n([\s\S]*?)$/.exec(metadata[1]);
  if(!outputMatch||!variablesMatch)throw new Error(`${exercise.filename}: invalid answer metadata`);
  const expectedLines=outputMatch[1].replace(/\n$/,'').split('\n');
  const variables=variablesMatch[1].trim().split('\n')
    .filter(line=>line.trim()&&!/^\(this program does not declare any variables\)$/i.test(line.trim()))
    .map(line=>{
    const equal=line.indexOf('=');
    if(equal<1)throw new Error(`${exercise.filename}: invalid variable answer '${line}'`);
    const name=line.slice(0,equal).trim(),value=line.slice(equal+1).trim();
    if(!name||!value)throw new Error(`${exercise.filename}: empty variable answer`);
    const array=/^\{(.*)\}$/.exec(value);
    return {name,expected:array?array[1].split(',').map(part=>part.trim()):value};
  });
  const source=raw.slice(metadata[0].length);
  if(!source||!expectedLines.length)throw new Error(`${exercise.filename}: source and output are required`);
  return {id:exercise.id,filename:exercise.filename,source,expectedLines,variables};
}

function soShuffle(values){
  const result=values.slice();
  for(let index=result.length-1;index>0;index--){
    const swap=Math.floor(seededRandom()*(index+1));
    [result[index],result[swap]]=[result[swap],result[index]];
  }
  return result;
}

function soGenerateItem({profile,index,language,generationContext}){
  if(!generationContext.order){
    const catalog=soCatalog(profile,language).map(soParseExercise);
    generationContext.order=profile.activity.generator.shuffle===false?catalog:soShuffle(catalog);
  }
  const exercise=generationContext.order[index];
  if(!exercise)throw new Error(`${profile.id}: no exercise at item ${index+1}`);
  const bank=soBank(profile,language);
  const maximum=exercise.expectedLines.length+exercise.variables.reduce((sum,variable)=>
    sum+(Array.isArray(variable.expected)?variable.expected.length:1),0);
  return {
    activityKind:SIMULATE_OUTPUT_MANIFEST.id,profileId:profile.id,itemNumber:index+1,
    language:bank.language,exerciseId:exercise.id,filename:exercise.filename,source:exercise.source,
    expectedLines:exercise.expectedLines,variables:exercise.variables,
    response:{output:'',variables:exercise.variables.map(variable=>
      Array.isArray(variable.expected)?variable.expected.map(()=>''):'')},
    result:null,checked:false,itemScore:null,points:null,maxPoints:maximum,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,showSolution:false,
    flagged:false,lockedAt:null,examActionLog:[]
  };
}
