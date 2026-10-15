const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const context=vm.createContext({
  console,
  structuredClone:global.structuredClone,
  setTimeout(){return 1;},
  clearTimeout(){}
});

function load(relative){
  const filename=path.join(ROOT,relative);
  vm.runInContext(fs.readFileSync(filename,'utf8'),context,{filename});
}
function evaluate(source){return vm.runInContext(source,context);}

[
  'js/engine.js',
  'js/flat-model.js',
  'js/template-engine.js',
  'js/generator.js',
  'js/program-ir.js',
  'js/language-core.js',
  'js/expression-parser.js',
  'js/expression-semantics.js',
  'js/output-statement-core.js',
  'js/input-statement-core.js',
  'js/selection-statement-core.js',
  'js/loop-statement-core.js',
  'js/statement-parser.js',
  'js/statement-semantics.js',
  'js/program-parser.js',
  'js/source-program-pipeline.js'
].forEach(load);

const profileSetPath=path.join(ROOT,'profile-sets','c-semifinals-selection-statements.json');
const profileSet=JSON.parse(fs.readFileSync(profileSetPath,'utf8'));
assert.strictEqual(profileSet.id,'c-semifinals-selection-statements');
assert.deepStrictEqual(profileSet.session,{language:'c',timing:{allowReset:true,enabled:true,minutes:100},persistence:{enabled:true},results:{unified:true}});
assert.strictEqual(profileSet.categories.length,6);
assert.strictEqual(profileSet.profiles.length,20);

context.semifinalProfiles=profileSet.profiles;
const profileResult=JSON.parse(evaluate(`(()=>{
  const finalized=semifinalProfiles.map(finalizeProfile);
  validateProfiles(finalized);
  const expressionProfiles=finalized.filter(profile=>[
    'semifinals-relational-expressions','semifinals-boolean-expressions'
  ].includes(profile.id));
  const generated=expressionProfiles.map(profile=>{
    const items=[];
    for(let index=0;index<25;index++)items.push(generateInstance(profile));
    return {id:profile.id,items:items.length,
      allVariableOnly:items.every(item=>item.decls.length===collectOperandSpecs(profile._ast,[]).length
        &&item.decls.every(declaration=>declaration.kind==='variable'))};
  });
  return JSON.stringify({ids:finalized.map(profile=>profile.id),generated});
})()`));
assert.strictEqual(new Set(profileResult.ids).size,20);
profileResult.generated.forEach(result=>{
  assert.strictEqual(result.items,25);
  assert(result.allVariableOnly,`${result.id} must generate variable-only operands`);
});

context.state={mode:'exam',examExpired:false};
context.roundPoints=value=>Math.round(value*100)/100;
context.tcValidateIdentifierGeneration=()=>{};
context.registerActivityPlugin=plugin=>plugin;
context.TC_CATEGORY_DEFS={
  'arithmetic-operator':{label:'Arithmetic'},
  'assignment-operator':{label:'Assignment'},
  'relational-operator':{label:'Relational'},
  'boolean-operator':{label:'Boolean'},
  'operator-distractor':{label:'Not an operator'}
};
[
  'plugins/falling-token-sort/manifest.js',
  'plugins/falling-token-sort/generator.js',
  'plugins/falling-token-sort/actions.js',
  'plugins/falling-token-sort/feedback.js',
  'plugins/falling-token-sort/renderer.js',
  'plugins/falling-token-sort/plugin.js'
].forEach(load);
context.semifinalFalling=profileSet.profiles.find(profile=>profile.meta.id==='semifinals-operator-qualification');
const fallingResult=JSON.parse(evaluate(`(()=>{
  const profile=finalizeProfile(semifinalFalling);
  ftsValidateProfile(profile);
  seededRandom=()=>0.37;
  const item=ftsGenerateItem({profile,index:0,language:'c',generationContext:{}});
  return JSON.stringify({count:item.tokens.length,target:item.generatedTokenTarget,
    categories:Object.fromEntries(Object.entries(item.generatedCounts).sort())});
})()`));
assert.strictEqual(fallingResult.count,20);
assert.strictEqual(fallingResult.target,20);
assert.deepStrictEqual(fallingResult.categories,{
  'arithmetic-operator':4,
  'assignment-operator':4,
  'boolean-operator':3,
  'operator-distractor':5,
  'relational-operator':4
});

const expectedCounts={
  'semifinals-trace-output':5,
  'semifinals-trace-input-output':5,
  'semifinals-trace-if':4,
  'semifinals-trace-if-else':3,
  'semifinals-trace-else-if':3,
  'semifinals-trace-switch':3,
  'semifinals-trace-combination':2,
  'semifinals-simulate-if':1,
  'semifinals-simulate-if-else':1,
  'semifinals-simulate-else-if':1,
  'semifinals-simulate-switch':1,
  'semifinals-simulate-switch-if':1,
  'semifinals-order-values':1,
  'semifinals-order-if':1,
  'semifinals-order-if-else':1,
  'semifinals-order-else-if':1,
  'semifinals-order-switch':1
};
const selectionExpectations={
  'semifinals-trace-if':['if'],
  'semifinals-trace-if-else':['if'],
  'semifinals-trace-else-if':['if','else-if'],
  'semifinals-trace-switch':['switch'],
  'semifinals-trace-combination':['if','switch'],
  'semifinals-simulate-if':['if'],
  'semifinals-simulate-if-else':['if'],
  'semifinals-simulate-else-if':['if','else-if'],
  'semifinals-simulate-switch':['switch'],
  'semifinals-simulate-switch-if':['switch','if'],
  'semifinals-order-if':['if'],
  'semifinals-order-if-else':['if'],
  'semifinals-order-else-if':['if','else-if'],
  'semifinals-order-switch':['switch']
};

let sourceCount=0;
for(const [setName,expectedCount] of Object.entries(expectedCounts)){
  const directory=path.join(ROOT,'exercise-libraries','source-programs','c',setName);
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  assert.strictEqual(manifest.exercises.length,expectedCount,`${setName} item count`);
  assert.strictEqual(new Set(manifest.exercises).size,manifest.exercises.length,`${setName} duplicate file`);

  for(const filename of manifest.exercises){
    sourceCount++;
    const raw=fs.readFileSync(path.join(directory,filename),'utf8');
    context.semifinalRaw=raw;
    context.semifinalFilename=filename;
    for(const chooser of ['min','mid','max']){
      context.semifinalChooser=chooser;
      const result=JSON.parse(evaluate(`(()=>{
        const choose=(min,max)=>semifinalChooser==='min'?min:
          semifinalChooser==='max'?max:Math.floor((min+max)/2);
        const details=sourceProgramMetadataAndSource(semifinalRaw,semifinalFilename);
        const inputs=sourceProgramInputDirectives(details.metadata,semifinalFilename,'seeded',choose);
        const inputValues=Object.fromEntries(inputs.map(input=>[input.target,{
          value:input.materializedValue,raw:input.materializedRaw
        }]));
        const parsed=sourceProgramParseExercise({details,filename:semifinalFilename,language:'c',
          sourceValueMode:'seeded',randomInteger:choose,inputValues});
        const answer=sourceProgramGenerateAnswer(parsed,semifinalFilename);
        return JSON.stringify({
          diagnostics:parsed.coreProgramResult.diagnostics,
          kinds:parsed.coreProgramResult.ir.statements.map(statement=>statement.kind),
          selectionKinds:parsed.coreProgramResult.ir.statements
            .filter(statement=>statement.kind==='selection').map(statement=>statement.selectionKind),
          output:answer.output,
          variables:answer.variables.length
        });
      })()`));
      assert.deepStrictEqual(result.diagnostics,[],`${setName}/${filename} (${chooser}) diagnostics`);
      assert(result.output.length>0,`${setName}/${filename} must produce console output`);
      assert(result.variables>0,`${setName}/${filename} must produce final variable state`);
      for(const kind of selectionExpectations[setName]||[])
        assert(result.selectionKinds.includes(kind),`${setName}/${filename} must contain ${kind}`);
      if(setName==='semifinals-trace-output'||setName==='semifinals-trace-input-output')
        assert.strictEqual(result.selectionKinds.length,0,`${setName}/${filename} must not contain selection statements`);
    }
  }
}
assert.strictEqual(sourceCount,35);

const categoryPoints=Object.fromEntries(profileSet.categories.slice(0,4).map(category=>[
  category.id,
  category.profileIds.reduce((sum,id)=>{
    const profile=profileSet.profiles.find(candidate=>candidate.meta.id===id);
    const count=profile.scoring.itemCount==='manifest'
      ?expectedCounts[profile.content&&profile.content.source&&profile.content.source.exerciseSet]
      :profile.scoring.itemCount;
    return sum+count*profile.scoring.pointsPerItem;
  },0)
]));
assert.deepStrictEqual(categoryPoints,{
  'semifinals-token-qualification':20,
  'semifinals-trace-output':20,
  'semifinals-expression-evaluator':10,
  'semifinals-trace-selection':30
});

console.log(`C Semifinals validated: ${profileSet.profiles.length} profiles, ${sourceCount} source exercises.`);

