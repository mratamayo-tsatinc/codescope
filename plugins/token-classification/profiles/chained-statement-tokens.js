const TC_PROFILE_CHAINED_TOKENS={
  /*
  id:'token-program-chain',name:'Chained Statement Tokens',
  description:'Classify tokens by position across connected declarations and assignments.',
  itemCount:5,pointsPerItem:12,
  activity:{
    kind:'token-classification',
    generator:{capability:'statement-generator',pattern:'statement-chain',statementKinds:['declaration','assignment']},
    instructions:'Work through each statement and classify every token according to its syntax position.',
    sets:{
      classificationTargets:{match:{positions:['modifier','type','declaration-name','assignment-target','assignment-source','operator','literal','separator']}},
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
    */
};
