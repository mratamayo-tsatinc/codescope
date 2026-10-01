const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'phase0-baseline.json');
const GENERATED_EXPRESSION_HASH = '8a2a85b83925b9a726fbce6351d76c7cb59b96bb87779f66064422e74378f53b';

function normalizedText(filename){
  return fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function sha256(value){
  return crypto.createHash('sha256').update(value).digest('hex');
}

function relative(root, filename){
  return path.relative(root, filename).split(path.sep).join('/');
}

function walk(directory, predicate, results=[]){
  if(!fs.existsSync(directory)) return results;
  for(const entry of fs.readdirSync(directory, {withFileTypes:true})){
    const filename=path.join(directory, entry.name);
    if(entry.isDirectory()) walk(filename, predicate, results);
    else if(predicate(filename)) results.push(filename);
  }
  return results;
}

function captureProfiles(root){
  const context=vm.createContext({
    console:{log(){},warn(){},error(){}},
    structuredClone:global.structuredClone,
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){}
  });
  for(const name of ['engine.js','flat-model.js','template-engine.js','generator.js','profiles.js']){
    const filename=path.join(root,'js',name);
    vm.runInContext(normalizedText(filename),context,{filename});
  }
  return JSON.parse(vm.runInContext(`JSON.stringify({
    profiles:FINALIZED_PROFILES.map(profile=>({
      id:profile.id,
      enabled:profile.enabled!==false,
      categoryId:profile.categoryId,
      profileType:profile.activity?'activity':'program',
      activityKind:profile.activity&&profile.activity.kind||null,
      content:profile.content?{
        mode:profile.content.mode||null,
        recipe:profile.content.recipe||null,
        source:profileContentSource(profile),
        values:profile.content.values||null,
        selection:profile.content.selection||null
      }:null,
      lesson:profile.lesson||null,
      interaction:profile.interaction||null,
      presentation:profile.presentation||null,
      template:profile.template||null,
      scoring:profile.scoring||null
    })),
    categories:PROFILE_CATEGORIES.map(category=>({
      id:category.id,
      name:category.name,
      enabled:category.enabled!==false,
      profileIds:category.profileIds.slice()
    }))
  })`,context));
}

function captureScriptOrder(root){
  const html=normalizedText(path.join(root,'index.html'));
  return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match=>match[1]);
}

function capturePlugins(root){
  const directory=path.join(root,'plugins');
  return fs.readdirSync(directory,{withFileTypes:true})
    .filter(entry=>entry.isDirectory())
    .map(entry=>{
      const pluginDirectory=path.join(directory,entry.name);
      return {
        id:entry.name,
        files:walk(pluginDirectory,filename=>!filename.includes(`${path.sep}exercises${path.sep}`))
          .map(filename=>relative(pluginDirectory,filename)).sort()
      };
    }).sort((left,right)=>left.id.localeCompare(right.id));
}

function captureExerciseSets(root){
  const manifests=walk(path.join(root,'exercise-libraries'),
    filename=>path.basename(filename)==='manifest.json').sort();
  return manifests.map(filename=>{
    const manifest=JSON.parse(normalizedText(filename));
    const directory=path.dirname(filename);
    const exercises=manifest.exercises.map(exercise=>{
      const exercisePath=path.join(directory,exercise);
      return {filename:exercise,sha256:sha256(normalizedText(exercisePath))};
    });
    return {
      manifest:relative(root,filename),
      title:String(manifest.title||''),
      exerciseCount:exercises.length,
      exercises
    };
  });
}

function capturePhaseZeroBaseline(root=DEFAULT_ROOT){
  const catalog=captureProfiles(root);
  return {
    schemaVersion:2,
    generatedExpressionHash:GENERATED_EXPRESSION_HASH,
    profileCount:catalog.profiles.length,
    categoryCount:catalog.categories.length,
    profiles:catalog.profiles,
    categories:catalog.categories,
    scriptOrder:captureScriptOrder(root),
    plugins:capturePlugins(root),
    exerciseSets:captureExerciseSets(root)
  };
}

function readPhaseZeroBaseline(){
  return JSON.parse(fs.readFileSync(BASELINE_PATH,'utf8'));
}

function assertPhaseZeroBaseline(root=DEFAULT_ROOT){
  const expected=readPhaseZeroBaseline();
  const actual=capturePhaseZeroBaseline(root);
  assert.deepStrictEqual(actual,expected,
    'Phase 0 architecture/content baseline changed. Review the change, then run `node tests/phase0-baseline.js --write` only when intentional.');
  return expected;
}

if(require.main===module){
  const mode=process.argv[2]||'--check';
  if(mode==='--write'){
    fs.mkdirSync(path.dirname(BASELINE_PATH),{recursive:true});
    fs.writeFileSync(BASELINE_PATH,`${JSON.stringify(capturePhaseZeroBaseline(),null,2)}\n`);
    console.log(`Wrote ${path.relative(DEFAULT_ROOT,BASELINE_PATH)}.`);
  }else if(mode==='--check'){
    assertPhaseZeroBaseline();
    console.log('Phase 0 architecture and exercise baseline matches.');
  }else{
    throw new Error(`Unknown option '${mode}'. Use --check or --write.`);
  }
}

module.exports={
  BASELINE_PATH,
  capturePhaseZeroBaseline,
  readPhaseZeroBaseline,
  assertPhaseZeroBaseline
};
