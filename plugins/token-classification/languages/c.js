const TOKEN_C_LANGUAGE=Object.freeze({
  id:'c',label:'C',constantKeyword:'const',types:['int','float','double','char','long','short','void','signed','unsigned','const'],
  reserved:new Set(['auto','break','case','char','const','continue','default','do','double','else','enum','extern','float','for','goto','if','inline','int','long','register','restrict','return','short','signed','sizeof','static','struct','switch','typedef','union','unsigned','void','volatile','while','_Alignas','_Alignof','_Atomic','_Bool','_Complex','_Generic','_Imaginary','_Noreturn','_Static_assert','_Thread_local']),
  identifierStartPattern:/^[A-Za-z_]$/,
  identifierPartPattern:/^[A-Za-z0-9_]$/,
  identifierPattern:/^[A-Za-z_][A-Za-z0-9_]*$/,
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
    styles:['camel-case','snake-case','constant-case','pascal-case','underscore-prefix','digit-suffix','case-mutated-reserved'],
    invalidStrategies:['leading-digit','illegal-character','embedded-space','punctuation','reserved-as-identifier'],
    invalidCharacters:['-','@','#','%','!','?','.','$']
  }
});
