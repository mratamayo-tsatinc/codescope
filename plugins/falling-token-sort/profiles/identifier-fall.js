const FTS_PROFILE_IDENTIFIER_FALL={
  id:'falling-identifier-sort',name:'Falling Identifier Sort',
  description:'Sort standalone names as valid identifiers, invalid identifiers, or reserved words.',
  itemCount:5,pointsPerItem:3,
  activity:{
    kind:'falling-token-sort',
    instructions:'Send the current token to the bucket that correctly classifies it.',
    buckets:[
      {id:'valid',category:'valid-identifier',region:'left',order:1},
      {id:'invalid',category:'invalid-identifier',region:'left',order:2},
      {id:'reserved',category:'reserved-word',region:'left',order:3}
    ],
    dropArea:{visibleTokens:1},
    generator:{capability:'canonical-token-pools',policies:{
      practice:{counts:{
        'valid-identifier':{min:3,max:5},'invalid-identifier':{min:3,max:5},'reserved-word':{min:3,max:5}
      },shuffle:true},
      exam:{counts:{
        'valid-identifier':{exact:5},'invalid-identifier':{exact:5},'reserved-word':{exact:5}
      },shuffle:true}
    }},
    assessment:{action:'SORT_TOKEN',cardinality:'per-token',scoreAttempt:'first',completion:'all-tokens-placed'},
    response:{policies:{
      practice:{incorrectPlacement:'return-token'},
      exam:{incorrectPlacement:'accept'}
    }},
    feedback:{practice:'immediate-return',exam:'deferred-until-submit'}
  }
};
