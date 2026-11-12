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
  'js/engine.js','js/flat-model.js','js/template-engine.js','js/profile-vocabulary.js','js/generator.js',
  'js/program-ir.js','js/language-core.js','js/expression-parser.js','js/expression-semantics.js',
  'js/output-statement-core.js','js/input-statement-core.js','js/selection-statement-core.js','js/loop-statement-core.js',
  'js/statement-parser.js','js/statement-semantics.js','js/program-parser.js','js/source-program-pipeline.js'
].forEach(load);

const set=JSON.parse(fs.readFileSync(path.join(ROOT,'profile-sets','c-final-exam.json'),'utf8'));
assert.strictEqual(set.id,'c-final-exam');
assert.strictEqual(set.name,'C Final Exam');
assert.strictEqual(set.version,'2');
assert.strictEqual(set.session.language,'c');
assert.deepStrictEqual(set.session.timing,{allowReset:false,enabled:true,minutes:90});
assert.deepStrictEqual(set.categories.map(category=>category.name),
  ['Trace','Code Ordering','Complete the Code','Simulate']);
assert.strictEqual(set.profiles.length,4);
for(const profile of set.profiles){
  assert.strictEqual(profile.behavior.allowRetry,false,profile.meta.id+' retry');
  assert.strictEqual(profile.behavior.showCorrectSolution,false,profile.meta.id+' solution');
  assert.strictEqual(profile.behavior.lockItemAfterCheck,true,profile.meta.id+' lock');
  assert.strictEqual(profile.behavior.feedbackRelease,'after-timeout',profile.meta.id+' feedback');
}
const profileByKind=new Map(set.profiles.map(profile=>[
  profile.activity&&profile.activity.kind||'trace',profile
]));
assert.deepStrictEqual({
  trace:profileByKind.get('trace').scoring.pointsPerItem,
  ordering:profileByKind.get('code-ordering').scoring.pointsPerItem,
  completion:profileByKind.get('code-completion').scoring.pointsPerItem,
  simulate:profileByKind.get('simulate-output').scoring.pointsPerItem
},{trace:2,ordering:3,completion:4,simulate:5});
assert.deepStrictEqual(profileByKind.get('code-completion').content.values,
  {variables:'authored',input:'authored'});
for(const kind of ['code-ordering','simulate-output']){
  assert.strictEqual(profileByKind.get(kind).activity.generator.shuffle,false,kind+' order');
}
assert.deepStrictEqual(profileByKind.get('code-ordering').activity.execution.loopGuard,
  {maxIterations:32,detectCycles:true},'final exam ordering loop guard');
assert.strictEqual(profileByKind.get('trace').content.selection.shuffle,false,'trace order');

const banks=[
  {name:'final-exam-trace',files:['alpha.c','bravo.c','charlie.c','delta.c','echo.c'],seeded:true},
  {name:'final-exam-ordering',files:['papa.c','quebec.c','romeo.c','sierra.c','tango.c'],seeded:true},
  {name:'final-exam-completion',files:['kilo.c','lima.c','mike.c','november.c','oscar.c'],seeded:false},
  {name:'final-exam-simulate',files:['foxtrot.c','golf.c','hotel.c','india.c','juliett.c'],seeded:true}
];
const expectedLines={
  'final-exam-trace/alpha.c':{authored:4,min:3,max:4},
  'final-exam-trace/bravo.c':{authored:5,min:4,max:5},
  'final-exam-trace/charlie.c':{authored:4,min:3,max:4},
  'final-exam-trace/delta.c':{authored:4,min:4,max:5},
  'final-exam-trace/echo.c':{authored:6,min:4,max:8},
  'final-exam-ordering/papa.c':{authored:4,min:3,max:4},
  'final-exam-ordering/quebec.c':{authored:5,min:4,max:6},
  'final-exam-ordering/romeo.c':{authored:4,min:3,max:5},
  'final-exam-ordering/sierra.c':{authored:4,min:3,max:5},
  'final-exam-ordering/tango.c':{authored:9,min:6,max:12},
  'final-exam-completion/kilo.c':{authored:6},
  'final-exam-completion/lima.c':{authored:5},
  'final-exam-completion/mike.c':{authored:7},
  'final-exam-completion/november.c':{authored:7},
  'final-exam-completion/oscar.c':{authored:7},
  'final-exam-simulate/foxtrot.c':{authored:6,min:5,max:6},
  'final-exam-simulate/golf.c':{authored:7,min:6,max:7},
  'final-exam-simulate/hotel.c':{authored:9,min:8,max:10},
  'final-exam-simulate/india.c':{authored:6,min:5,max:7},
  'final-exam-simulate/juliett.c':{authored:7,min:7,max:10}
};
const authoredVariables={
  'final-exam-trace/echo.c':{row:'3',col:'4'},
  'final-exam-ordering/tango.c':{row:'4',col:'3'},
  'final-exam-completion/mike.c':{n:'7',big:'3'},
  'final-exam-completion/oscar.c':{row:'4',col:'4',count:'6'},
  'final-exam-simulate/hotel.c':{i:'8',even:'3',odd:'4'},
  'final-exam-simulate/juliett.c':{row:'4',col:'4',count:'6'}
};
let parsedPrograms=0;
for(const bank of banks){
  const directory=path.join(ROOT,'exercise-libraries','source-programs','c',bank.name);
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  assert.deepStrictEqual(manifest.exercises,bank.files,bank.name+' order');
  for(const filename of bank.files){
    const raw=fs.readFileSync(path.join(directory,filename),'utf8');
    assert(/@codescope\b/.test(raw)&&/@title\s+\S/.test(raw),bank.name+'/'+filename+' metadata');
    assert.strictEqual(/@seed\b/.test(raw),bank.seeded,bank.name+'/'+filename+' seed policy');
    context.examRaw=raw;context.examFilename=filename;
    const selectors=bank.seeded?['authored','min','mid','max']:['authored'];
    for(const selector of selectors){
      context.examSelector=selector;
      const result=JSON.parse(evaluate(`(()=>{const details=sourceProgramMetadataAndSource(examRaw,examFilename);
        const choose=(min,max)=>examSelector==='min'?min:examSelector==='max'?max:Math.floor((min+max)/2);
        const parsed=sourceProgramParseExercise({details,filename:examFilename,language:'c',
          sourceValueMode:examSelector==='authored'?'authored':'seeded',randomInteger:choose,inputValues:{}});
        const answer=sourceProgramGenerateAnswer(parsed,examFilename,{allowDiagnostics:true});
        return JSON.stringify({diagnostics:parsed.coreProgramResult.diagnostics,output:answer.output,
          lines:answer.expectedLines.length,variables:Object.fromEntries(answer.variables.map(row=>[row.name,row.expected])),
          seeds:Object.keys(parsed.seedValues).length,loops:parsed.coreProgramResult.ir.statements.filter(row=>row.kind==='loop').length});})()`));
      const key=bank.name+'/'+filename,expected=expectedLines[key]&&expectedLines[key][selector];
      assert.deepStrictEqual(result.diagnostics,[],bank.name+'/'+filename+'/'+selector+' diagnostics');
      assert(result.output.length>0,bank.name+'/'+filename+'/'+selector+' output');
      if(expected!==undefined)assert.strictEqual(result.lines,expected,key+'/'+selector+' output lines');
      if(selector==='authored'&&authoredVariables[key])
        Object.entries(authoredVariables[key]).forEach(([name,value])=>
          assert.strictEqual(result.variables[name],value,key+' authored '+name));
      assert(result.loops>0,bank.name+'/'+filename+'/'+selector+' loop');
      assert.strictEqual(result.seeds>0,bank.seeded,bank.name+'/'+filename+'/'+selector+' materialized seeds');
      parsedPrograms++;
    }
  }
}

context.profileLocksCheckedItems=()=>true;
context.roundPoints=value=>Math.round(value*10)/10;
load('plugins/simulate-output/actions.js');
context.SIMULATE_OUTPUT_MANIFEST={id:'simulate-output'};
context.soPathSlug=value=>value;
context.profileVariableValueMode=profile=>profile.content.values.variables;
context.profileInputValueMode=profile=>profile.content.values.input;
context.soLoadExerciseContent=()=>{};context.soCatalog=()=>[];context.soGenerateItem=()=>{};
context.soRender=()=>{};context.soCanonicalTrace=()=>[];context.soBuildConsoleContent=()=>{};
context.soBuildFeedback=()=>{};context.registerActivityPlugin=plugin=>plugin;
load('plugins/simulate-output/plugin.js');
context.fixedSimulationProfileRaw=profileByKind.get('simulate-output');
evaluate(`soValidateProfile(finalizeProfile(fixedSimulationProfileRaw))`);
context.fixedItem={
  expectedLines:['A','B'],variables:[{name:'value',expected:'3'}],
  response:{output:'A\nB',variables:['0']},checked:false
};
context.fixedProfile={pointsPerItem:5};
const fixedScore=JSON.parse(evaluate(`(()=>{soCheck({item:fixedItem,profile:fixedProfile,state:{}});
  return JSON.stringify({points:fixedItem.points,maxPoints:fixedItem.maxPoints,
    checks:[fixedItem.correctSteps,fixedItem.totalOpSteps]});})()`));
assert.deepStrictEqual(fixedScore,{points:3.3,maxPoints:5,checks:[2,3]});

load('plugins/code-ordering/plugin.js');
context.coRun=()=>({frames:[],source:'',answer:{output:'',expectedLines:[],variables:[]}});
context.coScore=()=>({correct:2,total:4,outputResults:[],variableResults:[]});
context.fixedOrderingItem={checked:false,_coPlaybackSpeed:.6};
context.fixedOrderingProfile={pointsPerItem:3};
const orderingScore=JSON.parse(evaluate(`(()=>{coCheck({item:fixedOrderingItem,profile:fixedOrderingProfile,state:{}});
  return JSON.stringify({points:fixedOrderingItem.points,maxPoints:fixedOrderingItem.maxPoints,
    checks:[fixedOrderingItem.correctSteps,fixedOrderingItem.totalOpSteps]});})()`));
assert.deepStrictEqual(orderingScore,{points:1.5,maxPoints:3,checks:[2,4]});

const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'profile-sets','manifest.json'),'utf8'));
const entry=catalog.sets.find(row=>row.id==='c-final-exam');
assert(entry&&entry.enabled&&entry.file==='c-final-exam.json','C Final Exam manifest registration');

console.log(`C Final Exam validated ${parsedPrograms} authored/seeded program variants, four ordered profiles, exam restrictions, and fixed 2/3/4/5-point scoring.`);
