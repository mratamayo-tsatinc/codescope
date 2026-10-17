// Persistent, profile-gated program-flow trails for the source-file workspace.
// The route model is kept independent from DOM geometry so it can be tested
// against authored programs and reused by future source renderers.
function programFlowTrailIndent(text){
  const leading=(String(text||'').match(/^\s*/)||[''])[0];
  return leading.replace(/\t/g,'    ').length;
}

function programFlowTrailLabel(text){
  const value=String(text||'');
  if(/^\s*(?:}\s*)?else\s*{/.test(value))return 'else';
  if(/^\s*case\b.*:/.test(value))return 'case';
  if(/^\s*default\s*:/.test(value))return 'default';
  return null;
}

function buildProgramFlowTrailModel(item,program){
  const lines=item&&item.sourceDisplay&&Array.isArray(item.sourceDisplay.lines)?item.sourceDisplay.lines:[];
  const statements=program&&Array.isArray(program.statements)?program.statements:[];
  if(!lines.length||!statements.length)return {nodes:[],edges:[],skippedLines:[]};
  const byId=new Map(statements.map(statement=>[statement.id,statement]));
  const byLine=new Map(lines.map(line=>[Number(line.number),line]));
  const history=Array.isArray(program.executionHistory)?program.executionHistory.slice():[];
  const current=program.status==='running'&&program.cursor>=0?statements[program.cursor]:null;
  const transition=item&&item._sourceFlowTransition;
  const revealDestination=!transition||transition.phase==='moving';
  if(current&&revealDestination&&history[history.length-1]!==current.id)history.push(current.id);
  const routeIds=history.filter((id,index)=>byId.has(id)&&(index===0||id!==history[index-1]));
  const route=[];
  routeIds.forEach(id=>{
    const statement=byId.get(id),line=Number(statement.sourceLine);
    if(line&&(!route.length||route[route.length-1].line!==line))route.push({id,line,statement});
  });
  const nodes=new Map();
  const addNode=(line,kind,statement)=>{
    const sourceLine=byLine.get(Number(line));if(!sourceLine)return null;
    const node={line:Number(line),kind:kind||'statement',statementId:statement&&statement.id||null,
      indent:programFlowTrailIndent(sourceLine.text),text:String(sourceLine.text||'')};
    nodes.set(node.line,Object.assign(nodes.get(node.line)||{},node));return node;
  };
  route.forEach(entry=>addNode(entry.line,'statement',entry.statement));
  const rawEdges=[];
  const addEdge=(from,to,routeKind)=>{
    if(!from||!to||from.line===to.line)return;
    rawEdges.push({fromLine:from.line,toLine:to.line,route:routeKind});
  };
  const labelBetween=(fromLine,toLine)=>{
    if(toLine<=fromLine)return null;
    let result=null;
    for(let number=fromLine+1;number<toLine;number++){
      const line=byLine.get(number),kind=line&&programFlowTrailLabel(line.text);
      if(kind)result={line:number,kind};
    }
    return result;
  };
  for(let index=0;index<route.length-1;index++){
    const from=route[index],to=route[index+1];
    const fromNode=nodes.get(from.line),toNode=nodes.get(to.line);
    const selection=from.statement&&from.statement.kind==='selection';
    const via=selection?labelBetween(from.line,to.line):null;
    if(via){
      const viaNode=addNode(via.line,via.kind,null);
      addEdge(fromNode,viaNode,'left');addEdge(viaNode,toNode,'inner');continue;
    }
    if(to.line<from.line){addEdge(fromNode,toNode,'right');continue;}
    if(selection&&to.statement&&to.statement.selectionKind==='else-if'){
      addEdge(fromNode,toNode,'left');continue;
    }
    const exitsBlock=toNode.indent<fromNode.indent
      ||selection&&toNode.indent<=fromNode.indent
      ||from.statement&&from.statement.kind==='program-break';
    addEdge(fromNode,toNode,exitsBlock?'left':'inner');
  }
  const edgeMap=new Map();
  rawEdges.forEach((edge,index)=>edgeMap.set(`${edge.fromLine}:${edge.toLine}:${edge.route}`,Object.assign({},edge,{order:index})));
  const edges=[...edgeMap.values()].sort((left,right)=>left.order-right.order);
  if(edges.length)edges[edges.length-1].latest=true;
  const executedLines=new Set(route.map(entry=>entry.line));
  const skipped=new Set();
  edges.filter(edge=>edge.route==='left'&&edge.toLine>edge.fromLine).forEach(edge=>{
    for(let line=edge.fromLine+1;line<edge.toLine;line++){
      const sourceLine=byLine.get(line);
      if(sourceLine&&!executedLines.has(line)&&Array.isArray(sourceLine.statementIds)&&sourceLine.statementIds.length)skipped.add(line);
    }
  });
  return {nodes:[...nodes.values()].sort((a,b)=>a.line-b.line),edges,skippedLines:[...skipped].sort((a,b)=>a-b)};
}

function programFlowTrailRoundedPath(from,to,route,source){
  const direction=to.y>=from.y?1:-1,radius=Math.min(8,Math.max(3,Math.abs(to.y-from.y)/4));
  if(route==='left'){
    const gutter=source.querySelector&&source.querySelector('.program-source-file-number,.co-order-number');
    const boundary=gutter?gutter.offsetLeft+gutter.offsetWidth:36;
    const orderingGutter=!!(gutter&&gutter.classList&&gutter.classList.contains('co-order-number'));
    const laneFloor=orderingGutter?Math.max(8,boundary-7):boundary+5;
    const lane=Math.max(laneFloor,Math.min(from.x,to.x)-14);
    return `M ${from.x} ${from.y} H ${lane+radius} Q ${lane} ${from.y} ${lane} ${from.y+direction*radius} V ${to.y-direction*radius} Q ${lane} ${to.y} ${lane+radius} ${to.y} H ${to.x}`;
  }
  if(route==='right'){
    const lane=Math.max(from.right||from.x,to.right||to.x)+18;
    return `M ${from.right||from.x} ${from.y} H ${lane-radius} Q ${lane} ${from.y} ${lane} ${from.y+direction*radius} V ${to.y-direction*radius} Q ${lane} ${to.y} ${lane-radius} ${to.y} H ${to.x}`;
  }
  const middle=from.y+(to.y-from.y)/2;
  return `M ${from.x} ${from.y} C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${to.y}`;
}

function mountProgramFlowTrail(source,item,program,lineElements){
  if(typeof document==='undefined'||typeof document.createElementNS!=='function')return null;
  const profile=typeof PROFILES!=='undefined'&&item&&PROFILES.find(candidate=>candidate.id===item.profileId);
  if(typeof profileFlowTrailEnabled!=='function'||!profileFlowTrailEnabled(profile))return null;
  const model=buildProgramFlowTrailModel(item,program);
  if(!model.nodes.length)return null;
  source.classList.add('has-program-flow-trail');
  model.skippedLines.forEach(line=>{
    const entry=lineElements.get(line);if(entry)entry.row.classList.add('program-flow-trail-skipped');
  });
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','program-flow-trail-svg');svg.setAttribute('aria-hidden','true');
  const seenEdges=item._programFlowTrailEdgeKeys instanceof Set?item._programFlowTrailEdgeKeys:null;
  const modelEdgeKeys=new Set(model.edges.map(edge=>`${edge.fromLine}:${edge.toLine}:${edge.route}`));
  if(seenEdges)[...seenEdges].forEach(key=>{if(!modelEdgeKeys.has(key))seenEdges.delete(key);});
  const latest=model.edges[model.edges.length-1]||null;
  const latestKey=latest?`${latest.fromLine}:${latest.toLine}:${latest.route}`:null;
  const enteringKey=latestKey&&((seenEdges&&!seenEdges.has(latestKey))
    ||(!seenEdges&&item._sourceFlowTransition&&item._sourceFlowTransition.phase==='moving'))?latestKey:null;
  const nextSeen=seenEdges||new Set();
  const ports=new Map();
  model.nodes.forEach(node=>{
    const entry=lineElements.get(node.line);if(!entry)return;
    const port=document.createElement('span');port.className=`program-flow-trail-port is-${node.kind}`;
    port.setAttribute('aria-hidden','true');port.style.setProperty('--program-flow-indent',String(node.indent));
    entry.code.appendChild(port);ports.set(node.line,{port,entry});
  });
  model.edges.forEach(edge=>{
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    const key=`${edge.fromLine}:${edge.toLine}:${edge.route}`;
    path.setAttribute('class',`program-flow-trail-path is-${edge.route}${edge.latest?' is-latest':''}${key===enteringKey?' is-entering':''}`);
    path.dataset.fromLine=String(edge.fromLine);path.dataset.toLine=String(edge.toLine);svg.appendChild(path);
    nextSeen.add(key);
  });
  item._programFlowTrailEdgeKeys=nextSeen;
  source.appendChild(svg);
  const draw=()=>{
    if(!source.isConnected)return;
    const width=Math.max(source.clientWidth,source.scrollWidth),height=Math.max(source.clientHeight,source.scrollHeight);
    svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const pointFor=line=>{
      const record=ports.get(line);if(!record)return null;
      const {port,entry}=record;
      return {x:entry.code.offsetLeft+port.offsetLeft+port.offsetWidth/2,y:entry.row.offsetTop+entry.row.offsetHeight/2,
        right:entry.code.offsetLeft+entry.code.scrollWidth};
    };
    Array.from(svg.querySelectorAll('path')).forEach((path,index)=>{
      const edge=model.edges[index],from=pointFor(edge.fromLine),to=pointFor(edge.toLine);
      if(from&&to){
        path.setAttribute('d',programFlowTrailRoundedPath(from,to,edge.route,source));
        if(path.classList.contains('is-entering')&&typeof path.getTotalLength==='function'){
          const length=Math.max(1,path.getTotalLength());
          path.style.setProperty('--program-flow-trail-length',String(length));
          if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>path.classList.add('is-drawing'));
          else path.classList.add('is-drawing');
        }
      }
    });
  };
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(draw);else draw();
  return {model,draw};
}
