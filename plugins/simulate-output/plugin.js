function soValidateProfile(profile){
  const generator=profile.activity&&profile.activity.generator;
  if(!generator||typeof generator.exerciseSet!=='string'||!generator.exerciseSet.trim())
    throw new Error(`${profile.id}: simulate-output requires generator.exerciseSet`);
  soPathSlug(generator.exerciseSet,`${profile.id}: exerciseSet`);
  if(profile.itemCount!=='manifest')throw new Error(`${profile.id}: itemCount must be 'manifest'`);
  if(profile.pointsPerItem!=='exercise-metadata')
    throw new Error(`${profile.id}: pointsPerItem must be 'exercise-metadata'`);
  if(generator.shuffle!==undefined&&typeof generator.shuffle!=='boolean')
    throw new Error(`${profile.id}: generator.shuffle must be a boolean`);
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
  loadContent:soLoadExerciseContent,
  itemCount({profile,language}){return soCatalog(profile,language).length;},
  maxPoints({item}){return soScoreResponse(item).total;},
  validateProfile:soValidateProfile,generateItem:soGenerateItem,render:soRender,
  applyAction:soApplyAction,check:soCheck,reset:soReset,retry:soRetry,
  buildCanonicalTrace:soCanonicalTrace,
  buildConsoleContent:soBuildConsoleContent,buildFeedback:soBuildFeedback,
  hasAttempt({item}){return !!(item&&soHasResponse(item));}
});
