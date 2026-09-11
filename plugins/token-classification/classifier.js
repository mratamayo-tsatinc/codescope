const TC_CATEGORY_DEFS=Object.freeze({
  'valid-identifier':{label:'Valid identifier',icon:'fa-circle-check',tone:'valid'},
  'invalid-identifier':{label:'Invalid identifier',icon:'fa-circle-xmark',tone:'invalid'},
  'reserved-word':{label:'Reserved word',icon:'fa-lock',tone:'reserved'},
  operator:{label:'Operator',icon:'fa-code',tone:'operator'},
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
function tcAnalyzeToken(token,language){
  token.lexicalCategory=tcLexicalCategory(token,language);
  token.contextualCategory=tcContextualCategory(token,language);
  token.category=token.contextualCategory;
  token.violation=token.lexicalCategory==='reserved-word'&&token.contextualCategory==='invalid-identifier'
    ?'reserved-word-used-as-identifier':null;
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
  if(token.violation==='reserved-word-used-as-identifier')return `“${token.text}” is invalid in this identifier position because ${rules.label} reserves it for language syntax.`;
  if(category==='reserved-word')return `“${token.text}” occupies a reserved-word position in this ${rules.label} statement.`;
  if(category==='valid-identifier')return `“${token.text}” is valid in this identifier position under ${rules.label} rules.`;
  if(category==='operator')return `“${token.text}” occupies an operator position.`;
  if(category==='literal')return `“${token.text}” occupies a literal-value position.`;
  if(category==='separator')return `“${token.text}” terminates and separates the statement.`;
  if(/^\d/.test(token.text))return 'An identifier cannot begin with a digit.';
  if(/\s/.test(token.text))return 'An identifier cannot contain spaces.';
  return `“${token.text}” is not permitted in this ${rules.label} identifier position.`;
}
