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

function programFlowTrailForPhase(statement){
  const phase=statement&&statement.forPhase;
  return phase==='initialize'||phase==='condition'||phase==='update'?phase:null;
}

function programFlowTrailForAnchor(statement,direction){
  const phase=programFlowTrailForPhase(statement);
  if(phase==='condition')return direction==='to'?'for-condition-in':'for-condition-out';
  return phase?`for-${phase}`:'entry';
}

function programFlowTrailLoopBranch(statement){
  if(!statement||statement.kind!=='loop'||statement.loopKind==='do'
    ||statement.forPhase&&statement.forPhase!=='condition')return null;
  const runtime=statement.runtime;
  if(!runtime||!runtime.checked)return null;
  return Boolean(runtime.assignedValue)?'true':'false';
}

function programFlowTrailSuccessfulCycle(statement){
  if(!statement||statement.kind!=='loop')return false;
  if(statement.loopKind!=='while'&&statement.loopKind!=='for')return false;
  if(statement.forPhase&&statement.forPhase!=='condition')return false;
  const runtime=statement.runtime;
  return !!(runtime&&runtime.checked&&runtime.assignedValue);
}

function programFlowTrailForClauseParts(text){
  text=String(text||'');
  const forIndex=text.search(/\bfor\s*\(/);if(forIndex<0)return null;
  const open=text.indexOf('(',forIndex),cuts=[];let depth=0,quote=null,escaped=false,close=-1;
  for(let index=open+1;index<text.length;index++){
    const char=text[index];
    if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;continue;}
    if(char==='"'||char==="'"){quote=char;continue;}
    if(char==='('||char==='['||char==='{'){depth++;continue;}
    if(char===')'){
      if(depth===0){close=index;break;}depth--;continue;
    }
    if(char===']'||char==='}')depth=Math.max(0,depth-1);
    else if(char===';'&&depth===0)cuts.push(index);
  }
  if(cuts.length!==2||close<0)return null;
  const part=(start,end)=>{
    while(start<end&&/\s/.test(text[start]))start++;
    while(end>start&&/\s/.test(text[end-1]))end--;
    return {start,end,center:start+(end-start)/2};
  };
  return {initialize:part(open+1,cuts[0]),condition:part(cuts[0]+1,cuts[1]),update:part(cuts[1]+1,close)};
}

function programFlowTrailForClauseCenters(text){
  const parts=programFlowTrailForClauseParts(text);if(!parts)return null;
  return {initialize:parts.initialize.center,condition:parts.condition.center,update:parts.update.center};
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
  const awaitingStrictSelection=!!(item&&item._strictFlowAwaitingSelection);
  if(current&&revealDestination&&!awaitingStrictSelection&&history[history.length-1]!==current.id)history.push(current.id);
  const routeIds=history.filter((id,index)=>byId.has(id)&&(index===0||id!==history[index-1]));
  const route=[];
  routeIds.forEach(id=>{
    const statement=byId.get(id),line=Number(statement.sourceLine);
    const previous=route[route.length-1];
    if(line&&(!previous||previous.line!==line||programFlowTrailForPhase(previous.statement)!==programFlowTrailForPhase(statement)))
      route.push({id,line,statement});
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
  let transitionSuccessfulLoopLines=[];
  const addEdge=(from,to,routeKind,toAnchor,fromAnchor,loopBranch)=>{
    fromAnchor=fromAnchor||'entry';toAnchor=toAnchor||'entry';
    if(!from||!to||(from.line===to.line&&fromAnchor===toAnchor))return;
    rawEdges.push({fromLine:from.line,toLine:to.line,route:routeKind,fromAnchor,toAnchor,
      loopBranch:loopBranch||null,successfulLoopLines:transitionSuccessfulLoopLines.slice()});
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
  const activeSuccessfulLoopLines=new Set();
  const successfulLoopLinesByTransition=[];
  for(let index=0;index<route.length-1;index++){
    const from=route[index],to=route[index+1];
    if(programFlowTrailSuccessfulCycle(from.statement))activeSuccessfulLoopLines.add(from.line);
    successfulLoopLinesByTransition.push([...activeSuccessfulLoopLines]);
    if(activeSuccessfulLoopLines.has(to.line)
      &&to.statement&&to.statement.kind==='loop'
      &&(to.statement.loopKind==='while'||to.statement.loopKind==='for')
      &&(!to.statement.forPhase||to.statement.forPhase==='condition'))activeSuccessfulLoopLines.delete(to.line);
  }
  for(let index=0;index<route.length-1;index++){
    const from=route[index],to=route[index+1];
    transitionSuccessfulLoopLines=successfulLoopLinesByTransition[index]||[];
    const fromNode=nodes.get(from.line),toNode=nodes.get(to.line);
    const fromAnchor=programFlowTrailForAnchor(from.statement,'from'),toAnchor=programFlowTrailForAnchor(to.statement,'to');
    const loopBranch=programFlowTrailLoopBranch(from.statement);
    if(from.line===to.line&&fromAnchor!=='entry'&&toAnchor!=='entry'){
      addEdge(fromNode,toNode,'for-header',toAnchor,fromAnchor,loopBranch);continue;
    }
    const selection=from.statement&&from.statement.kind==='selection';
    const via=selection?labelBetween(from.line,to.line):null;
    if(via){
      const viaNode=addNode(via.line,via.kind,null);
      addEdge(fromNode,viaNode,'left','entry',fromAnchor,loopBranch);addEdge(viaNode,toNode,'inner',toAnchor);continue;
    }
    if(to.line<from.line&&from.statement&&from.statement.kind==='loop'&&from.statement.loopKind==='do-while'){
      let headerLine=null;
      for(let number=from.line-1;number>=1;number--){
        const candidate=byLine.get(number);
        if(candidate&&/^\s*do\s*\{/.test(String(candidate.text||''))
          &&programFlowTrailIndent(candidate.text)===fromNode.indent){headerLine=number;break;}
      }
      if(headerLine!==null){
        const headerStatement=statements.find(statement=>statement.kind==='loop'&&statement.loopKind==='do'
          &&Number(statement.sourceLine)===headerLine)||null;
        const headerNode=addNode(headerLine,'statement',headerStatement);
        addEdge(fromNode,headerNode,'right','statement-end',fromAnchor,loopBranch);continue;
      }
    }
    if(to.line<from.line){
      const target=toAnchor!=='entry'?toAnchor:(to.statement&&to.statement.kind==='loop'?'statement-end':'entry');
      addEdge(fromNode,toNode,'right',target,fromAnchor,loopBranch);continue;
    }
    if(selection&&to.statement&&to.statement.selectionKind==='else-if'){
      addEdge(fromNode,toNode,'left',toAnchor,fromAnchor,loopBranch);continue;
    }
    const exitsBlock=toNode.indent<fromNode.indent
      ||selection&&toNode.indent<=fromNode.indent
      ||from.statement&&from.statement.kind==='loop'&&toNode.indent<=fromNode.indent
      ||from.statement&&from.statement.kind==='program-break';
    addEdge(fromNode,toNode,exitsBlock?'left':'inner',toAnchor,fromAnchor,loopBranch);
  }
  const edgeMap=new Map();
  rawEdges.forEach((edge,index)=>edgeMap.set(`${edge.fromLine}:${edge.fromAnchor}:${edge.toLine}:${edge.route}:${edge.toAnchor}`,
    Object.assign({},edge,{order:index})));
  const edges=[...edgeMap.values()].sort((left,right)=>left.order-right.order);
  const exitedLoopLines=new Set(edges.filter(edge=>edge.loopBranch==='false').map(edge=>edge.fromLine));
  edges.forEach(edge=>{
    if((edge.loopBranch==='true'&&exitedLoopLines.has(edge.fromLine))
      ||edge.successfulLoopLines.some(line=>exitedLoopLines.has(line)))edge.priorLoopTrue=true;
  });
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

function programFlowTrailStatementEnd(text){return String(text||'').trimEnd().length;}

function programFlowTrailRenderedRight(element){
  if(!element||typeof element.getBoundingClientRect!=='function')return 0;
  const box=element.getBoundingClientRect();
  if(!(element.classList&&element.classList.contains('co-order-code'))
    ||typeof document==='undefined'||typeof document.createRange!=='function')return box.right;
  try{
    const range=document.createRange();range.selectNodeContents(element);
    const content=range.getBoundingClientRect();
    if(content&&content.width>0&&Number.isFinite(content.right))return content.right;
  }catch(error){/* Fall back to the code cell when DOM Range is unavailable. */}
  return box.right;
}

function programFlowTrailRightExtent(source,fromY,toY){
  if(!source||typeof source.querySelectorAll!=='function'||typeof source.getBoundingClientRect!=='function')return 0;
  const sourceRect=source.getBoundingClientRect();
  const scaleX=source.offsetWidth?sourceRect.width/source.offsetWidth:1;
  const scaleY=source.offsetHeight?sourceRect.height/source.offsetHeight:1;
  const originX=sourceRect.left+(source.clientLeft||0)*scaleX;
  const originY=sourceRect.top+(source.clientTop||0)*scaleY;
  const scrollLeft=source.scrollLeft||0,scrollTop=source.scrollTop||0;
  const top=Math.min(fromY,toY),bottom=Math.max(fromY,toY);
  let extent=0;
  source.querySelectorAll('.program-source-file-text,.co-order-code').forEach(code=>{
    if(!code||typeof code.getBoundingClientRect!=='function')return;
    const rect=code.getBoundingClientRect();
    const codeTop=(rect.top-originY)/scaleY+scrollTop;
    const codeBottom=(rect.bottom-originY)/scaleY+scrollTop;
    if(codeBottom<top||codeTop>bottom)return;
    const renderedRight=programFlowTrailRenderedRight(code)||rect.right;
    extent=Math.max(extent,(renderedRight-originX)/scaleX+scrollLeft);
  });
  return extent;
}

function programFlowTrailRoundedPath(from,to,route,source){
  const direction=to.y>=from.y?1:-1,radius=Math.min(8,Math.max(3,Math.abs(to.y-from.y)/4));
  if(route==='for-header'){
    const lane=Math.min(from.y,to.y)-11,r=Math.min(6,Math.max(3,Math.abs(to.x-from.x)/6));
    const horizontal=to.x>=from.x?1:-1;
    return `M ${from.x} ${from.y} V ${lane+r} Q ${from.x} ${lane} ${from.x+horizontal*r} ${lane} H ${to.x-horizontal*r} Q ${to.x} ${lane} ${to.x} ${lane+r} V ${to.y}`;
  }
  if(route==='left'){
    const gutter=source.querySelector&&source.querySelector('.program-source-file-number,.co-order-number');
    const boundary=gutter?gutter.offsetLeft+gutter.offsetWidth:36;
    const orderingGutter=!!(gutter&&gutter.classList&&gutter.classList.contains('co-order-number'));
    const laneFloor=orderingGutter?Math.max(8,boundary-7):boundary+5;
    const lane=Math.max(laneFloor,Math.min(from.x,to.x)-14);
    return `M ${from.x} ${from.y} H ${lane+radius} Q ${lane} ${from.y} ${lane} ${from.y+direction*radius} V ${to.y-direction*radius} Q ${lane} ${to.y} ${lane+radius} ${to.y} H ${to.x}`;
  }
  if(route==='right'){
    const crossedStatementRight=programFlowTrailRightExtent(source,from.y,to.y);
    const lane=Math.max(from.right||from.x,to.right||to.x,crossedStatementRight)+18;
    return `M ${from.right||from.x} ${from.y} H ${lane-radius} Q ${lane} ${from.y} ${lane} ${from.y+direction*radius} V ${to.y-direction*radius} Q ${lane} ${to.y} ${lane-radius} ${to.y} H ${to.x}`;
  }
  const middle=from.y+(to.y-from.y)/2;
  return `M ${from.x} ${from.y} C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${to.y}`;
}

function programFlowTrailRenderedCenter(source,element){
  if(!source||!element||typeof source.getBoundingClientRect!=='function'
    ||typeof element.getBoundingClientRect!=='function')return null;
  const sourceRect=source.getBoundingClientRect(),elementRect=element.getBoundingClientRect();
  const scaleX=source.offsetWidth?sourceRect.width/source.offsetWidth:1;
  const scaleY=source.offsetHeight?sourceRect.height/source.offsetHeight:1;
  const originX=sourceRect.left+(source.clientLeft||0)*scaleX;
  const originY=sourceRect.top+(source.clientTop||0)*scaleY;
  return {x:(elementRect.left+elementRect.width/2-originX)/scaleX+(source.scrollLeft||0),
    y:(elementRect.top+elementRect.height/2-originY)/scaleY+(source.scrollTop||0)};
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
  const edgeKey=edge=>`${edge.fromLine}:${edge.fromAnchor||'entry'}:${edge.toLine}:${edge.route}:${edge.toAnchor||'entry'}`;
  const modelEdgeKeys=new Set(model.edges.map(edgeKey));
  if(seenEdges)[...seenEdges].forEach(key=>{if(!modelEdgeKeys.has(key))seenEdges.delete(key);});
  const latest=model.edges[model.edges.length-1]||null;
  const latestKey=latest?edgeKey(latest):null;
  const enteringKey=latestKey&&((seenEdges&&!seenEdges.has(latestKey))
    ||(!seenEdges&&item._sourceFlowTransition&&item._sourceFlowTransition.phase==='moving'))?latestKey:null;
  const nextSeen=seenEdges||new Set();
  const orderingSource=!!(source.classList&&source.classList.contains('co-order-list'));
  const statementEndTargets=new Set(model.edges.filter(edge=>edge.toAnchor==='statement-end').map(edge=>edge.toLine));
  const returnOriginLines=new Set(orderingSource
    ?model.edges.filter(edge=>edge.route==='right').map(edge=>edge.fromLine):[]);
  const activeForPhase=program&&program.status==='running'&&program.statements&&program.statements[program.cursor]
    ?programFlowTrailForPhase(program.statements[program.cursor]):null;
  const forAnchorsByLine=new Map();
  model.edges.forEach(edge=>{
    [[edge.fromLine,edge.fromAnchor],[edge.toLine,edge.toAnchor]].forEach(([line,anchor])=>{
      if(!String(anchor||'').startsWith('for-'))return;
      if(!forAnchorsByLine.has(line))forAnchorsByLine.set(line,new Set());
      forAnchorsByLine.get(line).add(anchor);
    });
  });
  const ports=new Map();
  model.nodes.forEach(node=>{
    const entry=lineElements.get(node.line);if(!entry)return;
    const specialAnchors=forAnchorsByLine.get(node.line),anchorPorts=new Map();
    let port=null;
    if(!specialAnchors||!specialAnchors.size){
      port=document.createElement('span');port.className=`program-flow-trail-port is-${node.kind}`;
      port.setAttribute('aria-hidden','true');port.style.setProperty('--program-flow-indent',String(node.indent));
      entry.code.appendChild(port);anchorPorts.set('entry',port);
    }else{
      if(entry.row.classList)entry.row.classList.add('program-flow-trail-for-header');
      const centers=programFlowTrailForClauseCenters(node.text);
      specialAnchors.forEach(anchor=>{
        const phase=anchor.startsWith('for-condition')?'condition':anchor.slice(4),phasePort=document.createElement('span');
        phasePort.className=`program-flow-trail-port is-${anchor}${phase===activeForPhase?' is-active':''}`;
        phasePort.setAttribute('aria-hidden','true');
        phasePort.style.setProperty('--program-flow-anchor',String(centers&&centers[phase]!=null?centers[phase]:node.indent));
        entry.code.appendChild(phasePort);anchorPorts.set(anchor,phasePort);
      });
    }
    let statementEndPort=null;
    if(statementEndTargets.has(node.line)){
      statementEndPort=document.createElement('span');statementEndPort.className='program-flow-trail-port is-statement-end';
      statementEndPort.setAttribute('aria-hidden','true');
      statementEndPort.style.setProperty('--program-flow-statement-end',String(programFlowTrailStatementEnd(node.text)));
      entry.code.appendChild(statementEndPort);
    }
    let returnOriginPort=null;
    if(returnOriginLines.has(node.line)){
      returnOriginPort=document.createElement('span');returnOriginPort.className='program-flow-trail-port is-return-origin';
      returnOriginPort.setAttribute('aria-hidden','true');
      returnOriginPort.style.setProperty('--program-flow-return-origin',String(programFlowTrailStatementEnd(node.text)));
      entry.code.appendChild(returnOriginPort);
    }
    ports.set(node.line,{port,anchorPorts,statementEndPort,returnOriginPort,entry});
  });
  model.edges.forEach(edge=>{
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    const key=edgeKey(edge);
    path.setAttribute('class',`program-flow-trail-path is-${edge.route}${edge.priorLoopTrue?' is-prior-loop-true':''}${edge.latest?' is-latest':''}${key===enteringKey?' is-entering':''}`);
    path.dataset.fromLine=String(edge.fromLine);path.dataset.toLine=String(edge.toLine);svg.appendChild(path);
    nextSeen.add(key);
  });
  item._programFlowTrailEdgeKeys=nextSeen;
  source.appendChild(svg);
  const draw=()=>{
    if(!source.isConnected)return;
    const width=Math.max(source.clientWidth,source.scrollWidth),height=Math.max(source.clientHeight,source.scrollHeight);
    svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const pointFor=(line,anchor)=>{
      const record=ports.get(line);if(!record)return null;
      const {entry}=record,port=anchor==='statement-end'&&record.statementEndPort?record.statementEndPort
        :anchor==='return-origin'&&record.returnOriginPort?record.returnOriginPort
        :(record.anchorPorts.get(anchor)||record.port);
      if(!port)return null;
      const measured=programFlowTrailRenderedCenter(source,port);
      if(measured){
        const sourceRect=source.getBoundingClientRect();
        const scaleX=source.offsetWidth?sourceRect.width/source.offsetWidth:1;
        const sourceOriginX=sourceRect.left+(source.clientLeft||0)*scaleX;
        const codeRect=entry.code&&typeof entry.code.getBoundingClientRect==='function'
          ?entry.code.getBoundingClientRect():port.getBoundingClientRect();
        const renderedRight=programFlowTrailRenderedRight(entry.code)||codeRect.right;
        return {x:measured.x,y:measured.y,right:anchor==='return-origin'?measured.x
          :(renderedRight-sourceOriginX)/scaleX+(source.scrollLeft||0)};
      }
      const y=entry.row.offsetTop+entry.code.offsetTop+port.offsetTop+port.offsetHeight/2;
      const x=entry.code.offsetLeft+port.offsetLeft+port.offsetWidth/2;
      return {x,y,right:anchor==='return-origin'?x:entry.code.offsetLeft+entry.code.scrollWidth};
    };
    Array.from(svg.querySelectorAll('path')).forEach((path,index)=>{
      const edge=model.edges[index],fromAnchor=orderingSource&&edge.route==='right'?'return-origin':edge.fromAnchor;
      const from=pointFor(edge.fromLine,fromAnchor),to=pointFor(edge.toLine,edge.toAnchor);
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
