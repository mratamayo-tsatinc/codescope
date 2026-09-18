function soValidateProfile(profile){
  const generator=profile.activity&&profile.activity.generator;
  if(!generator||generator.bank!=='it3-midterm-a')
    throw new Error(`${profile.id}: unknown simulate-output exercise bank`);
  if(profile.activity.language!=='c')throw new Error(`${profile.id}: this exercise bank requires C`);
  if(!Number.isInteger(profile.itemCount)||profile.itemCount<1||profile.itemCount>soCatalog().length)
    throw new Error(`${profile.id}: itemCount must be between 1 and ${soCatalog().length}`);
  if(!Number.isFinite(profile.pointsPerItem)||profile.pointsPerItem<=0)
    throw new Error(`${profile.id}: pointsPerItem must be positive`);
  if(generator.shuffle!==undefined&&typeof generator.shuffle!=='boolean')
    throw new Error(`${profile.id}: generator.shuffle must be a boolean`);
  const ids=new Set();
  soCatalog().forEach(exercise=>{
    if(ids.has(exercise.id))throw new Error(`Duplicate exercise '${exercise.id}'`);
    ids.add(exercise.id);soParseExercise(exercise);
  });
}

function soCanonicalTrace({item}){
  const output=item.expectedLines.map((value,index)=>({kind:'output-line',index,value}));
  const variables=item.variables.flatMap((variable,index)=>Array.isArray(variable.expected)
    ?variable.expected.map((value,element)=>({kind:'variable',index,element,name:variable.name,value}))
    :[{kind:'variable',index,name:variable.name,value:variable.expected}]);
  return output.concat(variables);
}

const simulateOutputPlugin=registerActivityPlugin({
  id:SIMULATE_OUTPUT_MANIFEST.id,manifest:SIMULATE_OUTPUT_MANIFEST,
  validateProfile:soValidateProfile,generateItem:soGenerateItem,render:soRender,
  applyAction:soApplyAction,check:soCheck,reset:soReset,retry:soRetry,
  buildCanonicalTrace:soCanonicalTrace,
  buildConsoleContent:soBuildConsoleContent,buildFeedback:soBuildFeedback,
  hasAttempt({item}){return !!(item&&soHasResponse(item));}
});
