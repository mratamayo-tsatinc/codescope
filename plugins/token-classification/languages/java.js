const TOKEN_JAVA_LANGUAGE=Object.freeze({
  id:'java',label:'Java',constantKeyword:'final',types:['int','double','float','char','long','short','byte','boolean','final'],
  reserved:new Set(['abstract','assert','boolean','break','byte','case','catch','char','class','const','continue','default','do','double','else','enum','extends','final','finally','float','for','goto','if','implements','import','instanceof','int','interface','long','native','new','package','private','protected','public','return','short','static','strictfp','super','switch','synchronized','this','throw','throws','transient','try','void','volatile','while','true','false','null','_']),
  identifierStartPattern:/^[A-Za-z_$]$/,
  identifierPartPattern:/^[A-Za-z0-9_$]$/,
  identifierPattern:/^[A-Za-z_$][A-Za-z0-9_$]*$/,
  generation:{
    vocabulary:{
      modifiers:['total','min','max','avg','current','final','temp'],
      measurements:['count','price','score','value','amount','grade'],
      entities:['student','item','user','product','record','account'],
      technicalNouns:['buffer','index','data','result','flag','node']
    },
    templates:{
      'modifier-measurement':['modifiers','measurements'],
      'entity-measurement':['entities','measurements'],
      'entity-technical':['entities','technicalNouns']
    },
    styles:['camel-case','snake-case','constant-case','pascal-case','underscore-prefix','digit-suffix','dollar-prefix','case-mutated-reserved'],
    invalidStrategies:['leading-digit','illegal-character','embedded-space','punctuation','reserved-as-identifier'],
    invalidCharacters:['-','@','#','%','!','?','.']
  }
});
