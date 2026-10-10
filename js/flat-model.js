// ============================================================================
// INTERACTIVE (FLAT) EVALUATION MODEL
// ----------------------------------------------------------------------------
// The core expression tree remains the source of truth for dependencies,
// precedence, parentheses, and valid next operations. The modal uses a flat
// left-to-right representation so strict mode can let a learner attempt any
// locally executable adjacent pair. Each flat operand carries sourceLeafIds,
// which map reductions back to the original tree.
//
// Guided mode enables every operation on the core dependency frontier. Strict
// mode keeps all locally executable pairs available, while grading the chosen
// pair against that same frontier. Independent sibling subexpressions can be
// evaluated in either order; parent operations become valid only after both
// child subexpressions have resolved.
//
// Parenthesis tags preserve the authored visual grouping. They are presentation
// metadata and are not a second semantic or scoring engine.
// ============================================================================
function tagParenGroups(node,ctxMinPrec,groupId,visualGroupId){
  ctxMinPrec=ctxMinPrec||0;
  groupId=groupId==null?null:groupId;
  visualGroupId=visualGroupId===false?false:(visualGroupId==null?null:visualGroupId);
  if(node.kind==='unary'&&node.inner&&node.inner.kind==='binop'){
    // The unary operand is its own scoring partition, while an enclosing
    // authored branch remains one continuous visual parenthesis span.
    tagParenGroups(node.inner,0,node.id,visualGroupId==null?false:visualGroupId);
    return;
  }
  if(node.kind!=='binop'){
    node.parenGroup=groupId;
    node.visualParenGroup=visualGroupId===false?null:visualGroupId;
    return;
  }
  const p=prec(node.op);
  if(node.authoredParentheses||p<ctxMinPrec){
    const gid=groupId==null?nextId():groupId;
    const visualGid=visualGroupId===false?false:(visualGroupId==null?gid:visualGroupId);
    tagParenGroups(node.left,0,gid,visualGid);
    tagParenGroups(node.right,0,gid,visualGid);
    return;
  }
  tagParenGroups(node.left,p,groupId,visualGroupId);
  tagParenGroups(node.right,p+1,groupId,visualGroupId);
}
function flattenFull(node){
  if(node.kind==='unary'&&node.inner&&node.inner.kind==='binop'){
    const flat=flattenFull(node.inner);
    flat.operands.forEach(operand=>{
      operand.unaryGroup=node.id;operand.unaryGroupOperator=node.op;operand.unaryGroupForm=node.form;
      operand.unaryGroupParentheses=Math.max(1,Number(node.inner.authoredParentheses)||0);
    });
    return flat;
  }
  if(node.kind!=='binop'){
    if(!Array.isArray(node.sourceLeafIds))node.sourceLeafIds=[node.id];
    return {operands:[node],operators:[]};
  }
  const l = flattenFull(node.left);
  const r = flattenFull(node.right);
  return {operands: l.operands.concat(r.operands), operators: l.operators.concat([node.op], r.operators)};
}
// Tags parenGroup on every leaf, then produces the fully flat interaction
// structure. Call this once per generated instance instead of flattenTree.
function flattenInstance(tree){
  tagParenGroups(tree,0,null,null);
  const flat=flattenFull(tree);flat.originalTree=tree;return flat;
}
function deepCloneFlat(flat){
  return {
    operands:flat.operands.map(op=>{
      const clone=op.kind==='unary'?deepClone(op):Object.assign({},op);
      if(Array.isArray(op.sourceLeafIds))clone.sourceLeafIds=op.sourceLeafIds.slice();
      return clone;
    }),
    operators:flat.operators.slice(),
    originalTree:flat.originalTree||null
  };
}
function isFlatOperandReady(op){
  if(op.kind==='literal') return true;
  if(op.kind==='variable'||op.kind==='constant') return op.resolved;
  if(op.kind==='unary') return op.resolved;
  return false;
}
function flatOperandValue(op){
  if(op.kind==='literal') return op.value;
  if(op.kind==='unary') return op.resultValue;
  return op.declaredValue;
}
// A pair is only actually clickable if both neighbors are resolved values,
// AND (for / and %) the right-hand value isn't zero — a genuine arithmetic
// error, not an evaluation-order choice, so it's never offered as a target.
// Deliberately NOT gated by parenGroup — crossing a paren boundary is a
// scoring concern (see getMaxPrecCandidatesFlat), never a click-blocking one.
function pairReady(L,R,op){
  if(!isFlatOperandReady(L) || !isFlatOperandReady(R)) return false;
  if((op==='/'||op==='%') && flatOperandValue(R)===0) return false;
  return true;
}
function collectUnresolvedFlat(flat, out){
  out = out || [];
  for(const op of flat.operands){
    if((op.kind==='variable'||op.kind==='constant'||op.kind==='unary') && !op.resolved) out.push(op);
  }
  return out;
}
function findFlatOperandById(flat, id){
  return flat.operands.find(op=>op.id===id) || null;
}
function resolveFlatById(flat, targetId){
  return {
    operands: flat.operands.map(op=>{
      if(op.id!==targetId) return op;
      if(op.kind==='variable'||op.kind==='constant') return Object.assign({}, op, {resolved:true});
      if(op.kind==='unary') return Object.assign({}, op, {resolved:true, resultValue: unaryComputedValue(op)});
      return op;
    }),
    operators:flat.operators,
    originalTree:flat.originalTree||null
  };
}
// First half of a unary token's two-step resolution: reveals the wrapped
// variable's value (e.g. "++x" -> "++7") but leaves the operator unapplied
// (resolved stays false), so the operand is still not usable by EVALUATE
// until a subsequent 'apply-unary' click.
function substituteFlatById(flat, targetId){
  return {
    operands: flat.operands.map(op=>{
      if(op.id!==targetId || op.kind!=='unary') return op;
      return Object.assign({}, op, {substituted:true});
    }),
    operators:flat.operators,
    originalTree:flat.originalTree||null
  };
}
// Returns every locally executable adjacent pair. Strict mode uses this list
// to permit attempts; semantic correctness comes from the core tree below.
function collectReadyOperatorsFlat(flat, out){
  out = out || [];
  for(let i=0;i<flat.operators.length;i++){
    const L = flat.operands[i], R = flat.operands[i+1], opStr = flat.operators[i];
    if(pairReady(L,R,opStr)) out.push({op:opStr, leftId:L.id, rightId:R.id, leftGroup:L.parenGroup==null?null:L.parenGroup, rightGroup:R.parenGroup==null?null:R.parenGroup});
  }
  return out;
}
// Returns the core tree dependency frontier for real expressions. The fallback
// only supports legacy or synthetic flat fixtures that have no source tree.
function getMaxPrecCandidatesFlat(flat){
  if(flat&&flat.originalTree&&typeof coreExpressionOperationCandidates==='function'){
    return coreExpressionOperationCandidates(flat.originalTree,flat).filter(candidate=>{
      const index=flat.operands.findIndex(operand=>operand.id===candidate.leftId);
      return index>=0&&flat.operands[index+1]
        &&flat.operands[index+1].id===candidate.rightId
        &&pairReady(flat.operands[index],flat.operands[index+1],candidate.op);
    }).map(candidate=>{
      const left=findFlatOperandById(flat,candidate.leftId),right=findFlatOperandById(flat,candidate.rightId);
      return Object.assign({},candidate,{leftGroup:left&&left.parenGroup==null?null:left.parenGroup,
        rightGroup:right&&right.parenGroup==null?null:right.parenGroup});
    });
  }
  // Compatibility for legacy/synthetic expressions that predate provenance.
  const byPartition=new Map();
  for(let i=0;i<flat.operators.length;i++){
    const L=flat.operands[i],R=flat.operands[i+1],op=flat.operators[i];
    const leftGroup=L.parenGroup==null?null:L.parenGroup;
    const rightGroup=R.parenGroup==null?null:R.parenGroup;
    if(leftGroup!==rightGroup)continue;
    const key=leftGroup==null?'__free__':leftGroup;
    if(!byPartition.has(key))byPartition.set(key,[]);
    byPartition.get(key).push({op,leftId:L.id,rightId:R.id,leftGroup,rightGroup,ready:pairReady(L,R,op)});
  }
  let result=[];
  for(const arr of byPartition.values()){
    const maxP=Math.max.apply(null,arr.map(candidate=>prec(candidate.op)));
    result=result.concat(arr.filter(candidate=>candidate.ready&&prec(candidate.op)===maxP));
  }
  return result;
}
function countGroupMembers(flat, groupId){
  if(groupId==null) return 0;
  let n = 0;
  for(const op of flat.operands) if(op.parenGroup===groupId) n++;
  return n;
}
function visualParenGroupOf(operand){
  return Object.prototype.hasOwnProperty.call(operand,'visualParenGroup')
    ?operand.visualParenGroup:operand.parenGroup;
}
function countVisualParenGroupMembers(flat,groupId){
  if(groupId==null)return 0;
  return flat.operands.filter(operand=>visualParenGroupOf(operand)===groupId).length;
}
function countUnaryGroupMembers(flat,groupId){
  if(groupId==null)return 0;
  return flat.operands.filter(operand=>operand.unaryGroup===groupId).length;
}
// Locates the specific adjacent (leftId,rightId) pair and, if found, returns
// a NEW flat structure with that pair collapsed into a single new literal.
// The new literal's parenGroup: if both merged operands belonged to the SAME
// still-open group, it stays in that group unless this merge was the group's
// last remaining pair (then the group is fully resolved and it becomes
// free); any other combination (different groups, or one/both free) is a
// crossing merge and the result is always free.
function evaluateFlatAt(flat, leftId, rightId, resultOverride){
  for(let i=0;i<flat.operators.length;i++){
    const L = flat.operands[i], R = flat.operands[i+1];
    if(L.id===leftId && R.id===rightId){
      const op = flat.operators[i];
      const a = flatOperandValue(L), b = flatOperandValue(R);
      let result;
      try{ result = evalOp(op,a,b,L.dataType,R.dataType); } catch(e){ return {applied:false}; }
      const computedResult=result;
      if(arguments.length>=4) result=resultOverride;
      let newLiteral = makeLiteral(result,{dataType:operationResultDataType(op,L.dataType,R.dataType)});
      newLiteral.sourceLeafIds=[...new Set([...(L.sourceLeafIds||[L.id]),...(R.sourceLeafIds||[R.id])])];
      if(L.parenGroup!=null && L.parenGroup===R.parenGroup){
        const remainingBefore = countGroupMembers(flat, L.parenGroup);
        newLiteral.parenGroup = (remainingBefore - 1) <= 1 ? null : L.parenGroup;
      } else {
        newLiteral.parenGroup = null;
      }
      const leftVisualGroup=visualParenGroupOf(L),rightVisualGroup=visualParenGroupOf(R);
      if(leftVisualGroup!=null&&leftVisualGroup===rightVisualGroup){
        const remainingVisual=countVisualParenGroupMembers(flat,leftVisualGroup)-1;
        newLiteral.visualParenGroup=remainingVisual<=1?null:leftVisualGroup;
      }else newLiteral.visualParenGroup=null;
      if(L.unaryGroup!=null&&L.unaryGroup===R.unaryGroup){
        const remaining=countUnaryGroupMembers(flat,L.unaryGroup)-1;
        if(remaining<=1){
          const inner=newLiteral;
          newLiteral=makeUnary(L.unaryGroupOperator,L.unaryGroupForm||'prefix',inner);
          newLiteral.id=L.unaryGroup;newLiteral.substituted=true;newLiteral.sourceLeafIds=inner.sourceLeafIds;
          newLiteral.parenGroup=inner.parenGroup;newLiteral.visualParenGroup=inner.visualParenGroup;
        }else{
          newLiteral.unaryGroup=L.unaryGroup;
          newLiteral.unaryGroupOperator=L.unaryGroupOperator;
          newLiteral.unaryGroupForm=L.unaryGroupForm;
          newLiteral.unaryGroupParentheses=L.unaryGroupParentheses;
        }
      }
      const newOperands = flat.operands.slice(0,i).concat([newLiteral], flat.operands.slice(i+2));
      const newOperators = flat.operators.slice(0,i).concat(flat.operators.slice(i+1));
      return {newFlat:{operands:newOperands,operators:newOperators,originalTree:flat.originalTree||null}, applied:true, op, a, b, result, computedResult, resultId:newLiteral.id};
    }
  }
  return {applied:false};
}
function flatLeafToString(op){
  if(op.kind==='literal') return formatLiteralNode(op);
  if(op.kind==='unary'){
    if(op.resolved) return formatValue(op.resultValue);
    const nm = op.substituted ? String(unaryBaseValue(op)) : (op.inner.kind==='literal' ? String(op.inner.value) : op.inner.name);
    if(op.op==='!') return '!'+nm;
    return op.form==='prefix' ? op.op+nm : nm+op.op;
  }
  return op.resolved ? formatValue(op.declaredValue,op.dataType) : op.name;
}
// Maximal contiguous runs (length >= 2) of operands sharing the same
// non-null parenGroup — these are the spans still shown wrapped in "( )".
// A group that's been whittled down to one surviving operand (properly
// resolved, or via a crossing merge) is no longer tagged, so it naturally
// stops being bracketed, exactly like an ordinary value.
function computeParenRuns(flat){
  const runs = [];
  let i = 0;
  while(i < flat.operands.length){
    const g=visualParenGroupOf(flat.operands[i]);
    if(g==null){i++;continue;}
    let j=i;
    while(j<flat.operands.length&&visualParenGroupOf(flat.operands[j])===g)j++;
    if(j - i >= 2) runs.push({start:i, end:j-1});
    i = j;
  }
  return runs;
}
function computeUnaryRuns(flat){
  const runs=[];let index=0;
  while(index<flat.operands.length){
    const group=flat.operands[index].unaryGroup;
    if(group==null){index++;continue;}
    let end=index;
    while(end<flat.operands.length&&flat.operands[end].unaryGroup===group)end++;
    runs.push({start:index,end:end-1,group,operator:flat.operands[index].unaryGroupOperator||'!',
      parentheses:Math.max(1,Number(flat.operands[index].unaryGroupParentheses)||0)});
    index=end;
  }
  return runs;
}
function flatToString(flat){
  const runs=computeParenRuns(flat);
  const openAt=new Set(runs.map(run=>run.start)),closeAt=new Set(runs.map(run=>run.end));
  const unaryRuns=computeUnaryRuns(flat),unaryOpen=new Map(unaryRuns.map(run=>[run.start,run])),
    unaryClose=new Map(unaryRuns.map(run=>[run.end,run]));
  let s='';
  for(let i=0;i<flat.operands.length;i++){
    if(openAt.has(i))s+='(';
    if(unaryOpen.has(i)){
      const unary=unaryOpen.get(i);s+=unary.operator+'('.repeat(unary.parentheses);
    }
    s+=flatLeafToString(flat.operands[i]);
    if(unaryClose.has(i))s+=')'.repeat(unaryClose.get(i).parentheses);
    if(closeAt.has(i))s+=')';
    if(i<flat.operators.length)s+=' '+flat.operators[i]+' ';
  }
  return s;
}

