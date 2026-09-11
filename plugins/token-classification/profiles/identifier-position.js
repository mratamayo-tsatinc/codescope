const TC_PROFILE_IDENTIFIER_POSITION={
  id:'token-identifier-position',name:'Identifier Position',
  description:'Locate the declaration name and decide whether it is a valid identifier.',
  itemCount:5,pointsPerItem:3,
  activity:{
    kind:'token-classification',
    generator:{capability:'statement-generator',pattern:'declaration',statementKinds:['variable','constant']},
    instructions:'Tap the name used in the declaration, then classify it as a valid or invalid identifier.',
    sets:{
      identifierTargets:{match:{positions:['declaration-name']}},
      everyToken:{include:[{source:'all'}]}
    },
    interaction:{policies:{
      'practice:guided':{selectable:{include:[{set:'identifierTargets'}],exclude:[]},onOffTarget:'ignore'},
      'practice:strict-sequence':{selectable:{include:[{set:'everyToken'}],exclude:[]},onOffTarget:'block-until-undo'},
      'exam:guided':{selectable:{include:[{set:'identifierTargets'}],exclude:[]},onOffTarget:'ignore'},
      'exam:strict-sequence':{selectable:{include:[{set:'everyToken'}],exclude:[]},onOffTarget:'terminate-item'}
    }},
    assessment:{targets:{set:'identifierTargets'},checks:[
      {id:'target-selection',action:'SELECT_TOKEN',targets:{set:'identifierTargets'},cardinality:'once',weight:1,bonus:true},
      {id:'identifier-classification',action:'CLASSIFY_TOKEN',targets:{set:'identifierTargets'},cardinality:'per-target',answerResolver:'contextual-category',weight:2}
    ]},
    response:{mode:'classify',categories:['valid-identifier','invalid-identifier']}
  }
};
