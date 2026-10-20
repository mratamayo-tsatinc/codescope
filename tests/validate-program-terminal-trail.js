const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const context=vm.createContext({
  console,
  DEFAULT_APP_SETTINGS:{shell:{outputPanel:{characterAnimation:true,characterDelayMs:0,escapeDelayMs:0}}},
  document:{querySelector:()=>null},
  requestAnimationFrame:callback=>callback(),
  setTimeout:callback=>{callback();return 1;},
  matchMedia:()=>({matches:false}),
  setProgramContextTab:()=>{},
  coreTerminalScreen:stream=>({text:String(stream||''),lines:[''],row:0,column:0})
});
vm.runInContext(fs.readFileSync(path.join(root,'js','program-terminal.js'),'utf8'),context,
  {filename:'js/program-terminal.js'});

const result=JSON.parse(JSON.stringify(vm.runInContext(`(()=>{
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  const sourceRect=rect(100,120,180,24),panelRect=rect(700,80,280,180);
  const source={getBoundingClientRect:()=>sourceRect};
  document.querySelector=()=>source;
  const item={};
  let completed=0,flight=null;
  runVarFinalComet=(origin,destination,color,onArrival)=>{
    flight={origin,destination,color};onArrival();
  };
  queueProgramTerminalAnimation(item,{type:'OUTPUT',statementId:'output-frame-2',text:''},()=>completed++);
  const pending=pendingProgramTerminalAnimation;
  document.querySelector=()=>null;
  const classList={add(){},remove(){}};
  const panel={isConnected:true,classList,getBoundingClientRect:()=>panelRect};
  const pre={textContent:'',_programTerminalStream:'',childNodes:null};
  const escape={classList,textContent:'',title:''};
  const cursor={classList,setAttribute(){}};
  startProgramTerminalAnimation(panel,pre,escape,cursor,pending);
  return {flight,completed};
})()`,context)));

assert.deepStrictEqual(result.flight.origin,
  {left:100,top:120,width:180,height:24,right:280,bottom:144});
assert.deepStrictEqual(result.flight.destination,
  {left:700,top:80,width:280,height:180,right:980,bottom:260});
assert.strictEqual(result.completed,1);
console.log('Repeated direct-output terminal trail validation passed.');
