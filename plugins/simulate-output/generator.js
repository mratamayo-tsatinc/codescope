function soCatalog(){return SO_EXERCISES;}

function soParseExercise(exercise){
  const raw=exercise.raw.replace(/\r\n?/g,'\n');
  const metadata=/^\/\*\s*\n([\s\S]*?)\*\/\s*\n?/.exec(raw);
  if(!metadata)throw new Error(`${exercise.filename}: missing leading answer metadata`);
  const lines=metadata[1].split('\n');
  const outputAt=lines.findIndex(line=>line.trim()==='@output');
  const variablesAt=lines.findIndex(line=>line.trim()==='@variables');
  if(outputAt<0||variablesAt<=outputAt)throw new Error(`${exercise.filename}: invalid answer metadata`);
  const expectedLines=lines.slice(outputAt+1,variablesAt);
  while(expectedLines.length&&expectedLines[expectedLines.length-1]==='')expectedLines.pop();
  const variables=lines.slice(variablesAt+1)
    .filter(line=>line.trim()&&!/^\(this program does not declare any variables\)$/i.test(line.trim()))
    .map(line=>{
    const equal=line.indexOf('=');
    if(equal<1)throw new Error(`${exercise.filename}: invalid variable answer '${line}'`);
    const name=line.slice(0,equal).trim(),value=line.slice(equal+1).trim();
    if(!name||!value)throw new Error(`${exercise.filename}: empty variable answer`);
    const array=/^\{(.*)\}$/.exec(value);
    return {name,expected:array?array[1].split(',').map(part=>part.trim()):value};
  });
  const source=raw.slice(metadata[0].length).trimEnd();
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

function soGenerateItem({profile,index,generationContext}){
  if(!generationContext.order){
    const catalog=soCatalog().map(soParseExercise);
    generationContext.order=profile.activity.generator.shuffle===false?catalog:soShuffle(catalog);
  }
  const exercise=generationContext.order[index];
  if(!exercise)throw new Error(`${profile.id}: no exercise at item ${index+1}`);
  return {
    activityKind:SIMULATE_OUTPUT_MANIFEST.id,profileId:profile.id,itemNumber:index+1,
    language:'c',exerciseId:exercise.id,filename:exercise.filename,source:exercise.source,
    expectedLines:exercise.expectedLines,variables:exercise.variables,
    response:{output:'',variables:exercise.variables.map(variable=>
      Array.isArray(variable.expected)?variable.expected.map(()=>''):'')},
    result:null,checked:false,itemScore:null,points:null,maxPoints:null,
    correctSteps:0,totalOpSteps:0,wasCorrectFinal:null,showSolution:false,
    flagged:false,lockedAt:null,examActionLog:[]
  };
}
