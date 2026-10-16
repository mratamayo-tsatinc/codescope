const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const context=vm.createContext({console,structuredClone:global.structuredClone});
function load(relative){
  const filename=path.join(ROOT,relative);
  vm.runInContext(fs.readFileSync(filename,'utf8'),context,{filename});
}
function evaluate(source){return vm.runInContext(source,context);}

[
  'js/engine.js','js/flat-model.js','js/template-engine.js','js/generator.js',
  'js/program-ir.js','js/language-core.js','js/expression-parser.js','js/expression-semantics.js',
  'js/output-statement-core.js','js/input-statement-core.js','js/selection-statement-core.js',
  'js/loop-statement-core.js','js/statement-parser.js','js/statement-semantics.js',
  'js/program-parser.js','js/source-program-pipeline.js'
].forEach(load);

const setPath=path.join(ROOT,'profile-sets','c-midterms-expressions.json');
const profileSet=JSON.parse(fs.readFileSync(setPath,'utf8'));
assert.strictEqual(profileSet.id,'c-midterms-expressions');
assert.strictEqual(profileSet.name,'C - Midterms: Expressions');
assert.deepStrictEqual(profileSet.session,{
  language:'c',timing:{allowReset:true,enabled:true,minutes:100},
  persistence:{enabled:true},results:{unified:true}
});
assert.deepStrictEqual(profileSet.categories.map(category=>category.name),[
  'Direct Output Commands','Output and Variable State',
  'Declaration and Assignment Statements','Unary and Logical Evaluation'
]);
assert.strictEqual(profileSet.profiles.length,14);
const profileIds=profileSet.profiles.map(profile=>profile.meta.id);
assert.strictEqual(new Set(profileIds).size,profileIds.length);
assert.deepStrictEqual(profileSet.categories.flatMap(category=>category.profileIds),profileIds);

context.midtermProfiles=profileSet.profiles;
const generatedResult=JSON.parse(evaluate(`(()=>{
  const finalized=midtermProfiles.map(finalizeProfile);
  validateProfiles(finalized);
  const generated=finalized.filter(profile=>!profile.activity).map(profile=>{
    const items=[];for(let index=0;index<20;index++)items.push(generateInstance(profile));
    return {id:profile.id,count:items.length};
  });
  return JSON.stringify({ids:finalized.map(profile=>profile.id),generated});
})()`));
assert.strictEqual(generatedResult.ids.length,14);
assert.strictEqual(generatedResult.generated.length,12);
generatedResult.generated.forEach(result=>assert.strictEqual(result.count,20));

const sourceSets={
  'midterms-direct-output':{count:7,variables:false,seeds:false},
  'midterms-output-variable-state':{count:12,variables:true,seeds:true}
};
let sourceCount=0;
for(const [setName,expectation] of Object.entries(sourceSets)){
  const directory=path.join(ROOT,'exercise-libraries','source-programs','c',setName);
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  assert.strictEqual(manifest.exercises.length,expectation.count,`${setName} count`);
  assert.strictEqual(new Set(manifest.exercises).size,manifest.exercises.length,`${setName} duplicates`);
  for(const filename of manifest.exercises){
    sourceCount++;
    const raw=fs.readFileSync(path.join(directory,filename),'utf8');
    assert(!/@output\b|@variables\b/.test(raw),`${setName}/${filename} contains legacy answer metadata`);
    if(expectation.seeds)assert(/@seed\s/.test(raw),`${setName}/${filename} needs seed metadata`);
    context.midtermRaw=raw;context.midtermFilename=filename;
    for(const chooser of ['min','mid','max']){
      context.midtermChooser=chooser;
      const result=JSON.parse(evaluate(`(()=>{
        const choose=(min,max)=>midtermChooser==='min'?min:
          midtermChooser==='max'?max:Math.floor((min+max)/2);
        const details=sourceProgramMetadataAndSource(midtermRaw,midtermFilename);
        const parsed=sourceProgramParseExercise({details,filename:midtermFilename,language:'c',
          sourceValueMode:'seeded',randomInteger:choose,inputValues:{}});
        const answer=sourceProgramGenerateAnswer(parsed,midtermFilename);
        return JSON.stringify({diagnostics:parsed.coreProgramResult.diagnostics,
          output:answer.output,variables:answer.variables.length});
      })()`));
      assert.deepStrictEqual(result.diagnostics,[],`${setName}/${filename} (${chooser}) diagnostics`);
      assert(result.output.length>0,`${setName}/${filename} must produce output`);
      assert.strictEqual(result.variables>0,expectation.variables,
        `${setName}/${filename} variable-state contract`);
    }
  }
}
assert.strictEqual(sourceCount,19);

const legacyPoints={
  'declaration-chain':20,'assignment-basic':10,'assignment-add-sub':15,
  'assignment-multiply':10,'assignment-div-mod':15,'assignment-rhs-expression':20,
  'assignment-sequential':20,'assignment-dependent':25,'assignment-advanced-chain':30,
  'unary-update-sequence':25,'assignment-unary-advanced-chain':35,
  'relational-logical-student-derived':20
};
for(const [id,total] of Object.entries(legacyPoints)){
  const profile=profileSet.profiles.find(candidate=>candidate.meta.id===id);
  assert(profile,`missing ${id}`);
  assert.strictEqual(profile.scoring.itemCount*profile.scoring.pointsPerItem,total,`${id} points`);
}

const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'profile-sets','manifest.json'),'utf8'));
const entry=catalog.sets.find(set=>set.id===profileSet.id);
assert(entry&&entry.file==='c-midterms-expressions.json'&&entry.enabled===true,'profile set catalog entry');

console.log(`C Midterms validated: ${profileSet.profiles.length} profiles, ${sourceCount} source exercises.`);
