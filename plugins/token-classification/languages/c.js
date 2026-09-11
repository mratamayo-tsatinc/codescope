const TOKEN_C_LANGUAGE=Object.freeze({
  id:'c',label:'C',constantKeyword:'const',types:['int','float','double','char','long','short','void','signed','unsigned','const'],
  reserved:new Set(['auto','break','case','char','const','continue','default','do','double','else','enum','extern','float','for','goto','if','inline','int','long','register','restrict','return','short','signed','sizeof','static','struct','switch','typedef','union','unsigned','void','volatile','while','_Alignas','_Alignof','_Atomic','_Bool','_Complex','_Generic','_Imaginary','_Noreturn','_Static_assert','_Thread_local']),
  identifierPattern:/^[A-Za-z_][A-Za-z0-9_]*$/,
  invalidNames:['2ndScore','student-name','total score','9lives','score%','first.name'],
  reservedNames:['while','switch','return','int','const','for'],
  validNames:['score','studentCount','total_score','rate','MAX_SCORE','item2']
});
