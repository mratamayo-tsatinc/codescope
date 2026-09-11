const TC_PROFILE_DECLARATION_TOKENS={
  id:'token-declaration-complete',name:'Declaration Token Classification',
  description:'Classify every token according to its position in a variable or constant declaration.',
  itemCount:5,pointsPerItem:6,
  activity:{
    kind:'token-classification',
    generator:{capability:'statement-generator',pattern:'declaration',statementKinds:['variable','constant']},
    instructions:'Tap each token and classify it according to its position in the statement.',
    sets:{
      classificationTargets:{match:{positions:['modifier','type','declaration-name','operator','literal','separator']}},
      everyToken:{include:[{source:'all'}]}
    },
    interaction:{policies:{
      'practice:guided':{selectable:{include:[{set:'classificationTargets'}],exclude:[]},onOffTarget:'ignore'},
      'practice:strict-sequence':{selectable:{include:[{set:'everyToken'}],exclude:[]},onOffTarget:'block-until-undo'},
      'exam:guided':{selectable:{include:[{set:'classificationTargets'}],exclude:[]},onOffTarget:'ignore'},
      'exam:strict-sequence':{selectable:{include:[{set:'everyToken'}],exclude:[]},onOffTarget:'terminate-item'}
    }},
    assessment:{targets:{set:'classificationTargets'},checks:[
      {id:'token-classification',action:'CLASSIFY_TOKEN',targets:{set:'classificationTargets'},cardinality:'per-target',answerResolver:'contextual-category',weight:1}
    ]},
    response:{mode:'classify',categories:['valid-identifier','invalid-identifier','reserved-word','operator','literal','separator']}
  }
};
