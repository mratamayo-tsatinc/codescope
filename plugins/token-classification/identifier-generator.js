// Seeded candidate construction only. This module proposes text and records
// provenance; it never assigns or trusts a canonical answer category.
const TC_IDENTIFIER_GENERATION_DEFAULTS=Object.freeze({
  templates:['modifier-measurement','entity-measurement','entity-technical'],
  styles:['camel-case','snake-case','constant-case','pascal-case','underscore-prefix','digit-suffix','case-mutated-reserved','dollar-prefix'],
  invalidStrategies:['leading-digit','illegal-character','embedded-space','punctuation','reserved-as-identifier'],
  weights:{templates:{},styles:{},invalidStrategies:{}},
  length:{min:3,max:32},
  uniqueness:{scope:'profile-session',reuse:'avoid-until-exhausted'},
  maxAttempts:320
});

function tcGenerationPick(values){return values[Math.floor(seededRandom()*values.length)];}
function tcGenerationWeightedPick(values,weights){
  const entries=values.map(value=>({value,weight:weights&&Number.isFinite(weights[value])?Math.max(0,weights[value]):1}));
  const total=entries.reduce((sum,entry)=>sum+entry.weight,0);
  if(total<=0)return tcGenerationPick(values);
  let roll=seededRandom()*total;
  for(const entry of entries){roll-=entry.weight;if(roll<0)return entry.value;}
  return entries[entries.length-1].value;
}
function tcGenerationCapitalize(value){return value.charAt(0).toUpperCase()+value.slice(1);}

function tcIdentifierGenerationConfig(raw,rules){
  const config=raw||{},supported=rules.generation;
  const templates=(config.templates||TC_IDENTIFIER_GENERATION_DEFAULTS.templates).filter(id=>supported.templates[id]);
  const styles=(config.styles||TC_IDENTIFIER_GENERATION_DEFAULTS.styles).filter(id=>supported.styles.includes(id));
  const invalidStrategies=(config.invalidStrategies||TC_IDENTIFIER_GENERATION_DEFAULTS.invalidStrategies)
    .filter(id=>supported.invalidStrategies.includes(id));
  return {
    templates:templates.length?templates:Object.keys(supported.templates),
    styles:styles.length?styles:supported.styles.filter(id=>id!=='case-mutated-reserved'),
    invalidStrategies:invalidStrategies.length?invalidStrategies:supported.invalidStrategies.slice(),
    weights:{
      templates:Object.assign({},config.weights&&config.weights.templates||{}),
      styles:Object.assign({},config.weights&&config.weights.styles||{}),
      invalidStrategies:Object.assign({},config.weights&&config.weights.invalidStrategies||{})
    },
    length:Object.assign({},TC_IDENTIFIER_GENERATION_DEFAULTS.length,config.length||{}),
    uniqueness:Object.assign({},TC_IDENTIFIER_GENERATION_DEFAULTS.uniqueness,config.uniqueness||{}),
    maxAttempts:Number.isInteger(config.maxAttempts)&&config.maxAttempts>0?config.maxAttempts:TC_IDENTIFIER_GENERATION_DEFAULTS.maxAttempts
  };
}

function tcIdentifierWords(rules,templateId){
  const groups=rules.generation.templates[templateId],vocabulary=rules.generation.vocabulary;
  if(!groups||groups.length!==2)throw new Error(`Unknown identifier template '${templateId}'`);
  return groups.map(group=>tcGenerationPick(vocabulary[group]));
}

function tcFormatIdentifier(words,style,rules){
  const first=words[0],second=words[1];
  if(style==='snake-case')return `${first}_${second}`;
  if(style==='constant-case')return `${first}_${second}`.toUpperCase();
  if(style==='pascal-case')return words.map(tcGenerationCapitalize).join('');
  if(style==='underscore-prefix')return `_${first}${tcGenerationCapitalize(second)}`;
  if(style==='digit-suffix')return `${first}${tcGenerationCapitalize(second)}${1+Math.floor(seededRandom()*99)}`;
  if(style==='dollar-prefix')return `$${first}${tcGenerationCapitalize(second)}`;
  if(style==='case-mutated-reserved'){
    const reserved=tcGenerationPick([...rules.reserved]);
    return seededRandom()<.5?reserved.toUpperCase():tcGenerationCapitalize(reserved);
  }
  return `${first}${tcGenerationCapitalize(second)}`;
}

function tcProposeReadableIdentifier(rules,config){
  const template=tcGenerationWeightedPick(config.templates,config.weights.templates);
  const style=tcGenerationWeightedPick(config.styles,config.weights.styles);
  return {text:tcFormatIdentifier(tcIdentifierWords(rules,template),style,rules),strategy:style,template};
}

function tcInsertAtBoundary(text,value){
  const index=Math.max(1,Math.min(text.length-1,1+Math.floor(seededRandom()*Math.max(1,text.length-1))));
  return text.slice(0,index)+value+text.slice(index);
}

function tcProposeIdentifierCandidate({language,intent,configuration}){
  const rules=tcLanguage(language),config=tcIdentifierGenerationConfig(configuration,rules);
  if(intent==='reserved-word')return {text:String(tcGenerationPick([...rules.reserved])),strategy:'canonical-reserved-word',intent};
  const base=tcProposeReadableIdentifier(rules,config);
  if(intent!=='invalid-identifier')return Object.assign(base,{intent:'valid-identifier'});
  const strategy=tcGenerationWeightedPick(config.invalidStrategies,config.weights.invalidStrategies);
  if(strategy==='reserved-as-identifier')return {text:String(tcGenerationPick([...rules.reserved])),strategy,intent};
  if(strategy==='leading-digit')return {text:`${1+Math.floor(seededRandom()*9)}${base.text}`,strategy,intent,base:base.text};
  if(strategy==='embedded-space')return {text:tcInsertAtBoundary(base.text,' '),strategy,intent,base:base.text};
  if(strategy==='punctuation')return {text:tcInsertAtBoundary(base.text,'.'),strategy,intent,base:base.text};
  const character=tcGenerationPick(rules.generation.invalidCharacters);
  return {text:tcInsertAtBoundary(base.text,character),strategy:'illegal-character',intent,base:base.text,character};
}

function tcValidateIdentifierGeneration(profile,raw,path){
  const config=raw||{},prefix=path||'generator.identifierGeneration';
  const supported=['java','c'].map(language=>tcLanguage(language).generation);
  (config.templates||[]).forEach(id=>{if(!supported.some(spec=>spec.templates[id]))throw new Error(`${profile.id}: ${prefix}.templates contains unknown '${id}'`);});
  (config.styles||[]).forEach(id=>{if(!supported.some(spec=>spec.styles.includes(id)))throw new Error(`${profile.id}: ${prefix}.styles contains unsupported '${id}'`);});
  (config.invalidStrategies||[]).forEach(id=>{if(!supported.some(spec=>spec.invalidStrategies.includes(id)))throw new Error(`${profile.id}: ${prefix}.invalidStrategies contains unsupported '${id}'`);});
  const uniqueness=config.uniqueness||{};
  if(uniqueness.scope&&!['item','profile-session'].includes(uniqueness.scope))throw new Error(`${profile.id}: ${prefix}.uniqueness.scope is invalid`);
  if(uniqueness.reuse&&uniqueness.reuse!=='avoid-until-exhausted')throw new Error(`${profile.id}: ${prefix}.uniqueness.reuse is invalid`);
  if(config.maxAttempts!=null&&(!Number.isInteger(config.maxAttempts)||config.maxAttempts<1))throw new Error(`${profile.id}: ${prefix}.maxAttempts must be a positive integer`);
  const length=config.length||{};
  if(length.min!=null&&(!Number.isInteger(length.min)||length.min<1))throw new Error(`${profile.id}: ${prefix}.length.min must be a positive integer`);
  if(length.max!=null&&(!Number.isInteger(length.max)||length.max<1))throw new Error(`${profile.id}: ${prefix}.length.max must be a positive integer`);
  if(length.min!=null&&length.max!=null&&length.max<length.min)throw new Error(`${profile.id}: ${prefix}.length.max must be at least length.min`);
  const weights=config.weights||{},known={
    templates:new Set(supported.flatMap(spec=>Object.keys(spec.templates))),
    styles:new Set(supported.flatMap(spec=>spec.styles)),
    invalidStrategies:new Set(supported.flatMap(spec=>spec.invalidStrategies))
  };
  Object.entries(weights).forEach(([group,map])=>{
    if(!known[group]||!map||typeof map!=='object')throw new Error(`${profile.id}: ${prefix}.weights.${group} is invalid`);
    Object.entries(map).forEach(([id,value])=>{
      if(!known[group].has(id)||!Number.isFinite(value)||value<0)throw new Error(`${profile.id}: ${prefix}.weights.${group}.${id} is invalid`);
    });
  });
}

function tcIdentifierLengthAllowed(text,resolved){return text.length>=resolved.length.min&&text.length<=resolved.length.max;}

function tcGenerationUsedSet(generationContext,scope,itemUsed){
  if(scope==='item')return itemUsed;
  if(!generationContext.identifierValues)generationContext.identifierValues=new Set();
  return generationContext.identifierValues;
}
