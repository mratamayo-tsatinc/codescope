const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const context=vm.createContext({console,structuredClone:global.structuredClone,setTimeout(){return 1;},clearTimeout(){}});
function load(relative){const filename=path.join(ROOT,relative);vm.runInContext(fs.readFileSync(filename,'utf8'),context,{filename});}
function evaluate(source){return vm.runInContext(source,context);}
[
  'js/engine.js','js/flat-model.js','js/template-engine.js','js/profile-vocabulary.js','js/generator.js',
  'js/program-ir.js','js/language-core.js','js/expression-parser.js','js/expression-semantics.js',
  'js/output-statement-core.js','js/input-statement-core.js','js/selection-statement-core.js','js/loop-statement-core.js',
  'js/statement-parser.js','js/statement-semantics.js','js/program-parser.js','js/source-program-pipeline.js',
  'js/program-flow-trail.js'
].forEach(load);
context.resolveExerciseManifestUrl=({library,language,exerciseSet})=>`${library}/${language}/${exerciseSet}/manifest.json`;
load('plugins/simulate-output/generator.js');
context.registerActivityPlugin=plugin=>{context.codeCompletionPlugin=plugin;return plugin;};
context.CODE_ORDERING_PLAYBACK_CAPABILITY={};
context.profileVariableValueMode=profile=>profile.content&&profile.content.values&&profile.content.values.variables||'authored';
context.profileInputValueMode=profile=>profile.content&&profile.content.values&&profile.content.values.input||'authored';
load('plugins/code-completion/plugin.js');

const set=JSON.parse(fs.readFileSync(path.join(ROOT,'profile-sets','c-java-loop-completion.json'),'utf8'));
const profiles=set.profiles.filter(profile=>profile.activity&&profile.activity.kind==='code-completion');
const sourceRefs=profile=>profile.activity.generator.sources||[{exerciseSet:profile.activity.generator.exerciseSet}];
assert.strictEqual(profiles.length,5);
profiles.forEach(profile=>assert.deepStrictEqual(sourceRefs(profile),[{exerciseSet:'loop-completion-basics'}]));
const pluginSource=fs.readFileSync(path.join(ROOT,'plugins','code-completion','plugin.js'),'utf8');
const orderingSource=fs.readFileSync(path.join(ROOT,'plugins','code-ordering','plugin.js'),'utf8');
const sessionSource=fs.readFileSync(path.join(ROOT,'js','render-session.js'),'utf8');
assert(pluginSource.includes("action.type==='EDIT'")&&pluginSource.includes('cc-completion-input'));
assert(!pluginSource.includes("action.type==='MOVE'")&&!pluginSource.includes('select-statement')&&!pluginSource.includes('draggable:'));
assert(pluginSource.includes('if(evaluationActions)controls.appendChild(evaluationActions)'));
assert(pluginSource.includes('renderProgramSourceFilePanel(view,program'));
assert(!pluginSource.includes('mountFlowHighlight(item,list)')&&!pluginSource.includes('mountFlowTrail(item,list)'));
assert(pluginSource.includes('scheduleTrail(item,flow)')&&!pluginSource.includes("class:'co-order-line"));
assert(!pluginSource.includes('placeholder:'));
assert(pluginSource.includes("'data-for-phase':phase"));
assert(orderingSource.includes('.program-source-file-line[data-source-line='));
assert(orderingSource.includes("item.activityKind!=='code-completion'")&&orderingSource.includes('Math.max(500,Math.min(standard,stepMs))'));
assert(sessionSource.includes('statement.terminalEmitterId||statement.id'));
context.ccPlaybackItem={templateSource:'for (i = 0; i < 3; i++) {}',_coPlayback:{index:1,frames:[{
  line:1,statementId:'loop-condition',statementKind:'loop',loopKind:'for',forPhase:'condition',
  runtime:{checked:true,assignedValue:false}}]}};
const conditionPlayback=JSON.parse(evaluate(`JSON.stringify(ccTraceProgram(ccPlaybackItem))`));
assert.strictEqual(conditionPlayback.statements[0].status,'complete');
assert.deepStrictEqual(conditionPlayback.statements[0].runtime,{checked:true,assignedValue:false});
assert.deepStrictEqual(conditionPlayback.executionHistory,[conditionPlayback.statements[0].id]);
context.ccReturnPlaybackItem={templateSource:'printf("done\\n");\nreturn 0;',_coPlayback:{index:2,frames:[
  {line:1,statementId:'print-final',statementKind:'output',runtime:{}},
  {line:2,statementId:'return-final',statementKind:'program-return',runtime:{}}
]}};
const completedPlayback=JSON.parse(evaluate(`JSON.stringify(ccTraceProgram(ccReturnPlaybackItem))`));
assert.strictEqual(completedPlayback.status,'complete');
assert.strictEqual(completedPlayback.executionHistory.length,2);
assert.strictEqual(completedPlayback.executionHistory[1],completedPlayback.statements[1].id);
context.ccCompletedPlayback=completedPlayback;
const completedTrail=JSON.parse(evaluate(`JSON.stringify(buildProgramFlowTrailModel({sourceDisplay:{lines:[
  {number:1,text:'printf("done\\\\n");',statementIds:[ccCompletedPlayback.statements[0].id]},
  {number:2,text:'return 0;',statementIds:[ccCompletedPlayback.statements[1].id]}
]}},ccCompletedPlayback))`));
assert.strictEqual(completedTrail.edges[completedTrail.edges.length-1].toLine,2);
context.ccProfiles=profiles;
evaluate(`ccProfiles.map(finalizeProfile).forEach(ccValidate)`);
let checked=0;
for(const language of ['c','java']){
  const extension=language==='c'?'.c':'.java';
  for(const profile of profiles){
    for(const reference of sourceRefs(profile)){
      const directory=path.join(ROOT,'exercise-libraries','source-programs',language,reference.exerciseSet);
      const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
      const filenames=reference.include?reference.include.map(id=>id+extension):manifest.exercises;
      for(const filename of filenames){
        const raw=fs.readFileSync(path.join(ROOT,'exercise-libraries','source-programs',language,reference.exerciseSet,filename),'utf8');
        context.ccRaw=raw;context.ccFilename=filename;context.ccLanguage=language;context.ccProfile=profile;
        const result=JSON.parse(evaluate(`(()=>{const parsed=soParseExercise({id:ccFilename.replace(/\\.[^.]+$/,''),filename:ccFilename,raw:ccRaw},ccLanguage,'seeded','seeded');
          const completion=ccCompletionSlots(parsed,ccProfile);
          const item={templateSource:parsed.source,slots:completion.slots,
            slotValues:Object.fromEntries(completion.slots.map(slot=>[slot.id,slot.answer]))};
          return JSON.stringify({
            roles:completion.slots.map(slot=>slot.role),answers:completion.slots.map(slot=>slot.answer),
            controlName:completion.controlName,output:parsed.output,reconstructed:ccCompletedSource(item,false)===parsed.source
          });})()`));
        assert.deepStrictEqual(result.roles.slice().sort(),profile.activity.completion.targets.map(target=>target.role).sort(),`${language}/${reference.exerciseSet}/${filename}`);
        assert(result.answers.every(Boolean),`${language}/${reference.exerciseSet}/${filename} completion answers`);
        assert(result.controlName,`${language}/${reference.exerciseSet}/${filename} control variable`);
        assert(result.output,`${language}/${reference.exerciseSet}/${filename} target output`);
        assert.strictEqual(result.reconstructed,true,`${language}/${reference.exerciseSet}/${filename} reconstruction`);
        checked++;
      }
    }
  }
}

let generated=0;
for(const language of ['c','java']){
  const installed=new Set();
  for(const profile of profiles){
    for(const reference of sourceRefs(profile)){
      if(installed.has(reference.exerciseSet))continue;installed.add(reference.exerciseSet);
      const directory=path.join(ROOT,'exercise-libraries','source-programs',language,reference.exerciseSet);
      const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
      const rows=manifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(directory,filename),'utf8')}));
      context.ccManifest=manifest;context.ccRows=rows;context.ccSet=reference.exerciseSet;context.ccLanguage=language;
      evaluate(`soInstallExerciseBank('source-programs/'+ccLanguage+'/'+ccSet+'/manifest.json',ccLanguage,ccSet,ccManifest,ccRows)`);
    }
  }
  for(const rawProfile of profiles){
    context.ccProfile=rawProfile;context.ccLanguage=language;
    const generatedResult=JSON.parse(evaluate(`(()=>{const profile=finalizeProfile(ccProfile),generationContext={},items=[];initializeSeededRandom(42000+profile.id.length);
      const count=ccItemCount({profile,language:ccLanguage});
      try{for(let index=0;index<count;index++)items.push(ccGenerateItem({profile,index,language:ccLanguage,generationContext}));
        return JSON.stringify({count,displayCoversAssessment:items.every(item=>item.answerKey.variables.every(variable=>
          item.displayAnswerKey.variables.some(display=>display.name===variable.name))),
          allDisplayVariables:items.every(item=>item.displayAnswerKey.variables.length>=item.answerKey.variables.length),
          includesNonScoredMemory:items.some(item=>item.displayAnswerKey.variables.length>item.answerKey.variables.length)});}
      catch(error){return JSON.stringify({error:error.message,profile:profile.id,language:ccLanguage,
        order:(generationContext.order||[]).map(row=>row.exerciseSet+'/'+row.exercise.filename)});}
      finally{resetRandomGenerator();}})()`));
    assert(!generatedResult.error,JSON.stringify(generatedResult));
    assert(generatedResult.displayCoversAssessment&&generatedResult.allDisplayVariables,JSON.stringify(generatedResult));
    if(rawProfile.meta.id==='completion-loop-control')assert(generatedResult.includesNonScoredMemory,JSON.stringify(generatedResult));
    generated+=generatedResult.count;
  }
}

const finalSet=JSON.parse(fs.readFileSync(path.join(ROOT,'profile-sets','c-final-exam.json'),'utf8'));
const finalCompletion=finalSet.profiles.find(profile=>profile.activity&&profile.activity.kind==='code-completion');
assert(finalCompletion,'C Final Exam needs a Code Completion profile');
assert.deepStrictEqual(finalCompletion.content.values,{variables:'authored',input:'authored'});
context.ccProfile=finalCompletion;
evaluate(`ccValidate(finalizeProfile(ccProfile))`);
const finalDirectory=path.join(ROOT,'exercise-libraries','source-programs','c','final-exam-completion');
const finalManifest=JSON.parse(fs.readFileSync(path.join(finalDirectory,'manifest.json'),'utf8'));
const finalRows=finalManifest.exercises.map(filename=>({filename,raw:fs.readFileSync(path.join(finalDirectory,filename),'utf8')}));
context.ccManifest=finalManifest;context.ccRows=finalRows;
evaluate(`soInstallExerciseBank('source-programs/c/final-exam-completion/manifest.json','c','final-exam-completion',ccManifest,ccRows)`);
const finalResult=JSON.parse(evaluate(`(()=>{const profile=finalizeProfile(ccProfile),generationContext={},items=[];
  initializeSeededRandom(90125);
  try{for(let index=0;index<5;index++)items.push(ccGenerateItem({profile,index,language:'c',generationContext}));
    return JSON.stringify({filenames:items.map(item=>item.filename),seedCounts:items.map(item=>Object.keys(item.sourceSeedValues).length),
      maxPoints:items.map(item=>item.maxPoints),
      roles:items.map(item=>item.slots.map(slot=>slot.role)),reconstructed:items.every(item=>{
        item.slots.forEach(slot=>item.slotValues[slot.id]=slot.answer);return ccCompletedSource(item,false)===item.templateSource;
      })});}finally{resetRandomGenerator();}})()`));
assert.deepStrictEqual(finalResult.filenames,finalManifest.exercises,'final completion order');
assert.deepStrictEqual(finalResult.seedCounts,[0,0,0,0,0],'final completion must keep authored values');
assert.deepStrictEqual(finalResult.maxPoints,[4,4,4,4,4],'final completion fixed points');
assert(finalResult.roles.every(roles=>roles.slice().sort().join(',')
  ===['loop-initializer-value','loop-condition','loop-update'].sort().join(',')));
assert.strictEqual(finalResult.reconstructed,true);
context.CODE_ORDERING_PLAYBACK_CAPABILITY.score=()=>({correct:1,total:2});
context.profileLocksCheckedItems=()=>true;context.roundPoints=value=>Math.round(value*10)/10;
context.fixedCompletionItem={checked:false,slots:[{id:'slot'}],slotValues:{slot:'answer'},runResult:{ok:true}};
context.fixedCompletionProfile={pointsPerItem:4};
const fixedCompletionScore=JSON.parse(evaluate(`(()=>{ccCheck({item:fixedCompletionItem,profile:fixedCompletionProfile});
  return JSON.stringify({points:fixedCompletionItem.points,maxPoints:fixedCompletionItem.maxPoints,
    checks:[fixedCompletionItem.correctSteps,fixedCompletionItem.totalOpSteps]});})()`));
assert.deepStrictEqual(fixedCompletionScore,{points:2,maxPoints:4,checks:[1,2]});
generated+=5;

context.cycleSource=`#include <stdio.h>\nint main(void) {\n  int i = 0;\n  while (i < 3) {\n    printf("x\\n");\n  }\n  return 0;\n}`;
context.limitSource=`#include <stdio.h>\nint main(void) {\n  int i = 0;\n  while (i >= 0) {\n    i++;\n  }\n  return 0;\n}`;
const guards=JSON.parse(evaluate(`(()=>{const parse=source=>sourceProgramParseExercise({raw:source,filename:'Guard.c',language:'c',
  maxLoopIterations:5,detectLoopCycles:true}).coreProgramResult.diagnostics.map(row=>row.code);
  return JSON.stringify({cycle:parse(cycleSource),limit:parse(limitSource)});})()`));
assert(guards.cycle.includes('PROGRAM_LOOP_CYCLE'));
assert(guards.limit.includes('PROGRAM_LOOP_LIMIT'));

console.log(`Code Completion validated ${checked} seeded C/Java profile-source combinations, ${generated} generated login items including the authored-value final exam, and both loop guards.`);
