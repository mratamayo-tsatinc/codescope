const TOKEN_JAVA_LANGUAGE=Object.freeze({
  id:'java',label:'Java',constantKeyword:'final',types:['int','double','float','char','long','short','byte','boolean','final'],
  reserved:new Set(['abstract','assert','boolean','break','byte','case','catch','char','class','const','continue','default','do','double','else','enum','extends','final','finally','float','for','goto','if','implements','import','instanceof','int','interface','long','native','new','package','private','protected','public','return','short','static','strictfp','super','switch','synchronized','this','throw','throws','transient','try','void','volatile','while','true','false','null','_']),
  identifierPattern:/^[A-Za-z_$][A-Za-z0-9_$]*$/,
  invalidNames:['2ndScore','student-name','total score','score%','first.name','9lives'],
  reservedNames:['class','while','return','final','int','switch'],
  validNames:['score','studentCount','totalScore','$rate','MAX_SCORE','item2']
});
