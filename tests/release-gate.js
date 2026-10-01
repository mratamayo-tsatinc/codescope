const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {spawnSync} = require('child_process');
const {capturePhaseZeroBaseline} = require('./phase0-baseline');

const ROOT = path.resolve(__dirname, '..');

function normalizedText(filename){
  return fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function relative(filename){
  return path.relative(ROOT, filename).split(path.sep).join('/');
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

function assertJavaScriptSyntax(){
  const roots=['js','plugins','exercise-libraries'];
  const scripts=roots.flatMap(name=>walk(path.join(ROOT,name),filename=>filename.endsWith('.js'))).sort();
  const errors=[];
  for(const filename of scripts){
    try{ new vm.Script(normalizedText(filename), {filename}); }
    catch(error){ errors.push(`${relative(filename)}: ${error.message}`); }
  }
  assert.strictEqual(errors.length,0,`JavaScript syntax failures:\n${errors.join('\n')}`);
  return scripts.length;
}

function localAssetReferences(){
  const html=normalizedText(path.join(ROOT,'index.html'));
  const scripts=[...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)].map(match=>match[1]);
  const styles=[...html.matchAll(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map(match=>match[1]).filter(value=>value.split(/[?#]/)[0].endsWith('.css'));
  const local=value=>!/^([a-z]+:)?\/\//i.test(value) && !value.startsWith('data:');
  return {html,scripts:scripts.filter(local),styles:styles.filter(local)};
}

function assertAssetsAndOrder(){
  const {scripts,styles}=localAssetReferences();
  for(const reference of [...scripts,...styles]){
    const clean=reference.split(/[?#]/)[0];
    assert(fs.existsSync(path.join(ROOT,clean)),`index.html references missing local asset '${reference}'`);
  }
  assert.strictEqual(new Set(scripts).size,scripts.length,'index.html contains duplicate local script references');
  const before=(first,second)=>assert(scripts.indexOf(first)>=0&&scripts.indexOf(second)>=0&&scripts.indexOf(first)<scripts.indexOf(second),
    `${first} must load before ${second}`);
  before('js/language-core.js','js/expression-parser.js');
  before('js/expression-parser.js','js/statement-parser.js');
  before('js/statement-semantics.js','js/program-core.js');
  before('js/program-parser.js','js/source-program-pipeline.js');
  before('js/source-program-pipeline.js','plugins/program-output/content.js');
  before('js/source-program-pipeline.js','plugins/code-simulator/content.js');
  before('js/program-item-builder.js','plugins/program-output/content.js');
  before('js/program-item-builder.js','plugins/code-simulator/content.js');
  before('js/declaration-statement-plugin.js','js/render-declaration.js');
  before('js/assignment-statement-plugin.js','js/render-assignment.js');
  before('js/unary-update-statement-plugin.js','js/render-unary-update.js');
  return {scripts:scripts.length,styles:styles.length};
}

function assertManifest(filename){
  const manifest=JSON.parse(normalizedText(filename));
  assert(Array.isArray(manifest.exercises)&&manifest.exercises.length>0,
    `${relative(filename)} must contain a non-empty exercises array`);
  assert.strictEqual(new Set(manifest.exercises).size,manifest.exercises.length,
    `${relative(filename)} contains duplicate exercise filenames`);
  for(const exercise of manifest.exercises){
    assert.strictEqual(typeof exercise,'string',`${relative(filename)} contains a non-string exercise filename`);
    assert(exercise===path.basename(exercise)&&!exercise.includes('..'),
      `${relative(filename)} contains unsafe exercise filename '${exercise}'`);
    const sourcePath=path.join(path.dirname(filename),exercise);
    assert(fs.existsSync(sourcePath),`${relative(filename)} references missing '${exercise}'`);
    assert(normalizedText(sourcePath).trim(),`${relative(sourcePath)} is empty`);
  }
  return manifest.exercises.length;
}

function registeredSourceLibraries(){
  const files=walk(path.join(ROOT,'exercise-libraries'),filename=>path.basename(filename)==='library.js');
  return files.map(filename=>{
    const source=normalizedText(filename);
    const id=/\bid\s*:\s*['"]([^'"]+)['"]/.exec(source);
    const root=/\broot\s*:\s*['"]([^'"]+)['"]/.exec(source);
    const languages=/\blanguages\s*:\s*\[([^\]]+)\]/.exec(source);
    assert(id&&root&&languages,`${relative(filename)} must declare id, root, and languages`);
    return {
      id:id[1],root:root[1],
      languages:[...languages[1].matchAll(/['"]([^'"]+)['"]/g)].map(match=>match[1])
    };
  });
}

function assertExerciseContent(){
  const manifests=walk(path.join(ROOT,'exercise-libraries'),
    filename=>path.basename(filename)==='manifest.json').sort();
  let exercises=0;
  for(const filename of manifests) exercises+=assertManifest(filename);

  const snapshot=capturePhaseZeroBaseline(ROOT);
  const libraries=registeredSourceLibraries();
  const libraryById=new Map(libraries.map(library=>[library.id,library]));
  const sourceProfiles=snapshot.profiles.filter(profile=>profile.enabled&&profile.content&&profile.content.mode==='source-files');
  for(const profile of sourceProfiles){
    const source=profile.content.source;
    assert(source&&source.library&&source.exerciseSet,`${profile.id}: source-files profile needs a library and exerciseSet`);
    const library=libraryById.get(source.library);
    assert(library,`${profile.id}: unknown source library '${source.library}'`);
    for(const language of library.languages){
      const manifest=path.join(ROOT,library.root,language,source.exerciseSet,'manifest.json');
      assert(fs.existsSync(manifest),`${profile.id}: missing ${language} manifest ${relative(manifest)}`);
    }
  }
  return {manifests:manifests.length,exercises,sourceProfiles:sourceProfiles.length};
}

function assertArchitectureCleanup(){
  const conflicts=walk(ROOT,filename=>/-DESKTOP-T37NNLA\./i.test(path.basename(filename)));
  assert.strictEqual(conflicts.length,0,`OneDrive conflict copies remain:\n${conflicts.map(relative).join('\n')}`);
  assert(!fs.existsSync(path.join(ROOT,'js','profiles_.js')),'Removed js/profiles_.js compatibility catalog returned');
  assert(!fs.existsSync(path.join(ROOT,'plugins','simulate-output','exercises')),
    'Simulate Output exercise files must live in the shared exercise library');
  const simulateGenerator=normalizedText(path.join(ROOT,'plugins','simulate-output','generator.js'));
  assert(simulateGenerator.includes('resolveExerciseManifestUrl')&&simulateGenerator.includes('sourceProgramGenerateAnswer'),
    'Simulate Output must resolve the shared library and generate answers through the source pipeline');
  assert(!simulateGenerator.includes('missing leading answer metadata')&&!simulateGenerator.includes('invalid answer metadata'),
    'Simulate Output retains embedded answer-key parsing');
  const simulateSources=walk(path.join(ROOT,'exercise-libraries','source-programs'),
    filename=>/it3-midterm-a/.test(filename)&&/\.(?:c|java)$/.test(filename));
  simulateSources.forEach(filename=>assert(!/@output\b|@variables\b/.test(normalizedText(filename)),
    `${relative(filename)} contains retired embedded answer metadata`));
  const adapters=['plugins/program-output/content.js','plugins/code-simulator/content.js','plugins/program-input/parser.js'];
  for(const name of adapters){
    const source=normalizedText(path.join(ROOT,name));
    assert(!/\bcoreParseProgram\s*\(/.test(source),`${name} must use the source pipeline rather than coreParseProgram()`);
  }
  for(const name of ['plugins/program-output/content.js','plugins/code-simulator/content.js']){
    const source=normalizedText(path.join(ROOT,name));
    assert(!/\bcoreParseStatement\s*\(/.test(source),`${name} must consume canonical Statement IR without reparsing`);
  }
}

function assertResponsiveContracts(){
  const shell=normalizedText(path.join(ROOT,'js','shell-ui.js'));
  const appCss=normalizedText(path.join(ROOT,'css','styles.css'));
  const programCss=normalizedText(path.join(ROOT,'plugins','program-output','styles.css'));
  const index=normalizedText(path.join(ROOT,'index.html'));
  const sessionRenderer=normalizedText(path.join(ROOT,'js','render-session.js'));
  assert(shell.includes('activity-zoom-surface')&&shell.includes('applyActivityZoomToElement'),
    'Activity-local zoom behavior is missing');
  assert(appCss.includes('.activity-zoom-popover')&&index.includes('activityZoomControl'),
    'Compact activity zoom control is missing');
  assert(/@media\s*\(max-width:\s*768px\)/.test(programCss),'Mobile program workspace breakpoint is missing');
  assert(/\.program-context-main\s*\{[^}]*position:sticky/s.test(programCss),'Program context dock is not sticky');
  assert(programCss.includes('.program-context-tabs')&&sessionRenderer.includes('program-context-tab'),
    'Mobile memory/output tab switch is missing');
  assert(index.includes('itemPaginationContainer')&&appCss.includes('.item-pagination-container'),
    'Responsive item navigation contract is missing');
  assert(appCss.includes('.app-header')&&appCss.includes('prefers-reduced-motion'),
    'Responsive shell or reduced-motion contract is missing');
}

function runNode(script,args=[]){
  const result=spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8'});
  if(result.stdout) process.stdout.write(result.stdout);
  if(result.stderr) process.stderr.write(result.stderr);
  assert.strictEqual(result.status,0,`${script} ${args.join(' ')} failed with exit code ${result.status}`);
}

function main(){
  const syntaxCount=assertJavaScriptSyntax();
  const assets=assertAssetsAndOrder();
  const content=assertExerciseContent();
  assertArchitectureCleanup();
  assertResponsiveContracts();
  runNode('tests/phase0-baseline.js',['--check']);
  runNode('tests/run-tests.js');
  console.log(`Phase 10 release gate passed: ${syntaxCount} scripts, ${assets.scripts} indexed scripts, ${assets.styles} stylesheets, ${content.manifests} manifests, ${content.exercises} exercises, and ${content.sourceProfiles} enabled source profiles validated.`);
}

if(require.main===module) main();

module.exports={
  assertJavaScriptSyntax,
  assertAssetsAndOrder,
  assertExerciseContent,
  assertArchitectureCleanup,
  assertResponsiveContracts
};
