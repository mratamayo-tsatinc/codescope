const TC_CATEGORY_DEFS=Object.freeze({
  'valid-identifier':{label:'Valid identifier',icon:'fa-circle-check',tone:'valid'},
  'invalid-identifier':{label:'Invalid identifier',icon:'fa-circle-xmark',tone:'invalid'},
  'reserved-word':{label:'Reserved word',icon:'fa-lock',tone:'reserved'},
  operator:{label:'Operator',icon:'fa-code',tone:'operator'},
  'arithmetic-operator':{label:'Arithmetic',icon:'fa-calculator',tone:'arithmetic'},
  'relational-operator':{label:'Relational',icon:'fa-scale-balanced',tone:'relational'},
  'boolean-operator':{label:'Boolean',icon:'fa-code-branch',tone:'boolean'},
  'assignment-operator':{label:'Assignment',icon:'fa-arrow-right-to-bracket',tone:'assignment'},
  'operator-distractor':{label:'Not an operator',icon:'fa-ban',tone:'distractor'},
  literal:{label:'Literal',icon:'fa-quote-left',tone:'literal'},
  separator:{label:'Separator',icon:'fa-grip-lines-vertical',tone:'separator'}
});
function tcLanguage(language){return language==='c'?TOKEN_C_LANGUAGE:TOKEN_JAVA_LANGUAGE;}
function tcLexicalCategory(token,language){
  if(token.role==='operator')return 'operator';
  if(token.role==='literal')return 'literal';
  if(token.role==='separator')return 'separator';
  const rules=tcLanguage(language);
  if(rules.reserved.has(token.text))return 'reserved-word';
  return rules.identifierPattern.test(token.text)?'valid-identifier':'invalid-identifier';
}
function tcContextualCategory(token,language){
  const lexical=token.lexicalCategory||tcLexicalCategory(token,language);
  if(token.position==='operator')return 'operator';
  if(token.position==='literal')return 'literal';
  if(token.position==='separator')return 'separator';
  if(token.position==='modifier'||token.position==='type')return lexical==='reserved-word'?'reserved-word':lexical;
  if(token.position==='declaration-name'||token.position==='assignment-target'||token.position==='assignment-source'){
    if(token.role==='literal')return 'literal';
    return lexical==='valid-identifier'?'valid-identifier':'invalid-identifier';
  }
  return lexical;
}
function tcIdentifierViolations(text,rules,lexicalCategory,contextualCategory){
  const violations=[];
  if(lexicalCategory==='reserved-word'){
    if(contextualCategory==='invalid-identifier')violations.push({id:'reserved-word-used-as-identifier',word:text});
    return violations;
  }
  if(lexicalCategory!=='invalid-identifier')return violations;
  if(!text){violations.push({id:'empty-identifier'});return violations;}
  [...text].forEach((character,index)=>{
    if(/\s/.test(character)){
      violations.push({id:'whitespace',character,index});return;
    }
    if(index===0&&!rules.identifierStartPattern.test(character)){
      violations.push({id:/\d/.test(character)?'starts-with-digit':'invalid-start-character',character,index});return;
    }
    if(index>0&&!rules.identifierPartPattern.test(character))violations.push({id:'illegal-character',character,index});
  });
  if(!violations.length)violations.push({id:'invalid-pattern'});
  return violations;
}
function tcAnalyzeIdentifierText(text,language,context){
  const details=context||{},token={text:String(text),role:details.role||'word',position:details.position||'standalone'};
  const rules=tcLanguage(language),lexicalCategory=tcLexicalCategory(token,language);
  token.lexicalCategory=lexicalCategory;
  const contextualCategory=tcContextualCategory(token,language);
  return {
    text:token.text,language:rules.id,position:token.position,
    lexicalCategory,contextualCategory,category:contextualCategory,
    identifierForm:rules.identifierPattern.test(token.text),reserved:rules.reserved.has(token.text),
    violations:tcIdentifierViolations(token.text,rules,lexicalCategory,contextualCategory)
  };
}
function tcAnalyzeToken(token,language){
  const analysis=tcAnalyzeIdentifierText(token.text,language,{role:token.role,position:token.position});
  token.lexicalCategory=analysis.lexicalCategory;
  token.contextualCategory=analysis.contextualCategory;
  token.category=analysis.contextualCategory;
  token.identifierForm=analysis.identifierForm;
  token.reserved=analysis.reserved;
  token.violations=analysis.violations;
  token.violation=analysis.violations.length?analysis.violations[0].id:null;
  return token;
}
function tcClassifyToken(token,language){return tcContextualCategory(token,language);}
const TC_ANSWER_RESOLVERS=Object.freeze({
  'contextual-category':({token})=>token.contextualCategory,
  'lexical-category':({token})=>token.lexicalCategory
});
function tcResolveAnswer(resolverId,context){
  const resolver=TC_ANSWER_RESOLVERS[resolverId];
  if(!resolver)throw new Error(`Unknown token answer resolver '${resolverId}'`);
  return resolver(context);
}
function tcReason(token,category,language){
  const rules=tcLanguage(language);
  const violation=(token.violations&&token.violations[0])||(token.violation?{id:token.violation}:null);
  if(violation&&violation.id==='reserved-word-used-as-identifier')return `“${token.text}” is invalid in this identifier position because ${rules.label} reserves it for language syntax.`;
  if(category==='reserved-word')return token.position==='standalone'
    ?`“${token.text}” is reserved by ${rules.label}.`
    :`“${token.text}” occupies a reserved-word position in this ${rules.label} statement.`;
  if(category==='valid-identifier')return token.position==='standalone'
    ?`“${token.text}” follows ${rules.label} identifier rules.`
    :`“${token.text}” is valid in this identifier position under ${rules.label} rules.`;
  if(category==='operator')return `“${token.text}” occupies an operator position.`;
  if(category==='literal')return `“${token.text}” occupies a literal-value position.`;
  if(category==='separator')return `“${token.text}” terminates and separates the statement.`;
  if(violation&&violation.id==='starts-with-digit')return `“${token.text}” is invalid because an identifier cannot begin with the digit “${violation.character}”.`;
  if(violation&&violation.id==='whitespace')return `“${token.text}” is invalid because an identifier cannot contain whitespace.`;
  if(violation&&violation.id==='invalid-start-character')return `“${token.text}” is invalid because “${violation.character}” cannot begin a ${rules.label} identifier.`;
  if(violation&&violation.id==='illegal-character')return `“${token.text}” is invalid because “${violation.character}” is not permitted in a ${rules.label} identifier.`;
  if(violation&&violation.id==='empty-identifier')return 'An identifier cannot be empty.';
  return `“${token.text}” is not permitted in this ${rules.label} identifier position.`;
}
