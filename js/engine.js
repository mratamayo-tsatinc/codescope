// ============================================================================
// ENGINE (language-independent core — no UI logic here)
// ============================================================================
let __idCounter = 1;
function nextId(){ return __idCounter++; }
// Precedence table, highest number binds tightest. Comparisons throughout the
// engine only ever check relative ordering, never the literal numbers, so
// adding new tiers here is safe. Ordering (high to low): multiplicative,
// additive, relational (<,>,<=,>=), equality (==,!=), logical AND, logical OR
// — the same ordering Java/C use, which is what lets a mixed relational/
// boolean expression resolve arithmetic and comparisons before combining them.
function prec(op){
  switch(op){
    case '*': case '/': case '%': return 6;
    case '+': case '-': return 5;
    case '<': case '>': case '<=': case '>=': return 4;
    case '==': case '!=': return 3;
    case '&&': return 2;
    case '||': return 1;
    default: return 5;
  }
}
function arithmeticResultDataType(leftType,rightType){
  if(leftType==='string'||rightType==='string')return 'string';
  if(leftType==='double'||rightType==='double')return 'double';
  if(leftType==='float'||rightType==='float')return 'float';
  return 'int';
}
function operationResultDataType(op,leftType,rightType){
  if(['<','>','<=','>=','==','!=','&&','||'].includes(op))return 'boolean';
  return arithmeticResultDataType(leftType,rightType);
}
function evalOp(op,a,b,leftType,rightType){
  switch(op){
    case '+': return a+b;
    case '-': return a-b;
    case '*': return a*b;
    case '/': if(b===0) throw new EngineError('DIV_BY_ZERO');
      return arithmeticResultDataType(leftType,rightType)==='int'?Math.trunc(a/b):a/b;
    case '%': if(b===0) throw new EngineError('DIV_BY_ZERO'); return a % b;
    case '<': return a<b;
    case '>': return a>b;
    case '<=': return a<=b;
    case '>=': return a>=b;
    case '==': return a===b;
    case '!=': return a!==b;
    case '&&': return Boolean(a) && Boolean(b);
    case '||': return Boolean(a) || Boolean(b);
    default: throw new EngineError('UNKNOWN_OP:'+op);
  }
}
function evaluateUnaryOperation(operator,form,base,writeOverride){
  if(operator==='!'){
    const expressionValue=writeOverride===undefined?!base:writeOverride;
    return {expressionValue,writeValue:expressionValue,hasWrite:false};
  }
  if(operator!=='++'&&operator!=='--') throw new EngineError('UNKNOWN_UNARY:'+operator);
  const computed=base+(operator==='++'?1:-1);
  const writeValue=writeOverride===undefined?computed:writeOverride;
  return {
    expressionValue:form==='postfix'?base:writeValue,
    writeValue,
    hasWrite:true
  };
}
class EngineError extends Error{ constructor(code){ super(code); this.code=code; } }

// Renders any engine value (number OR boolean) the way it should read as
// source/output text. Centralized so every render path (tree-based,
// flat-based, live-interactive, historical, canonical playback) shows
// booleans as `true`/`false` and negative numbers parenthesized, consistently.
function formatValue(v,dataType){
  if(typeof v === 'boolean') return v ? 'true' : 'false';
  if(dataType==='char'){
    const escaped=String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/\r/g,'\\r');
    return `'${escaped}'`;
  }
  if(dataType==='string'){
    const escaped=String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/\r/g,'\\r');
    return `"${escaped}"`;
  }
  return v<0 ? '('+v+')' : String(v);
}

// Authored literals retain their exact source spelling (`2.0`, `2.00f`,
// character quotes, and escapes). Derived values intentionally have no
// sourceText and continue through the normal value formatter.
function formatLiteralNode(node){
  return node&&typeof node.sourceText==='string'&&node.sourceText.length
    ?node.sourceText:formatValue(node&&node.value,node&&node.dataType);
}

function makeLiteral(value,opts){ return Object.assign({id:nextId(),kind:'literal',value},opts||{}); }
function makeNamed(kind,name,declaredValue,opts){
  return Object.assign({id:nextId(),kind,name,declaredValue,resolved:false},opts||{});
}
function makeBinOp(op,left,right){ return {id:nextId(), kind:'binop', op, left, right}; }
// A unary node (`++x`, `x--`, `!flag`) wraps exactly one leaf — per this
// project's scope, always a `variable` leaf: increment/decrement and logical
// NOT are never generated on a literal or a constant. Unresolved, it renders
// as its source text (e.g. "++x"); tapping it resolves it to a plain value
// (resultValue), exactly like resolving a variable/constant, so from every
// other part of the engine (flattening, paren-tagging, readiness checks) a
// unary node behaves like any other non-binop leaf.
function makeUnary(op, form, inner){ return {id:nextId(), kind:'unary', op, form, inner, substituted:false, resolved:false}; }
function unaryBaseValue(node){
  if(node.inner.kind==='literal') return node.inner.value;
  if(node.inner.kind==='variable'||node.inner.kind==='constant') return node.inner.declaredValue;
  return evalTree(node.inner);
}
function unaryComputedValue(node){
  const base = unaryBaseValue(node);
  return evaluateUnaryOperation(node.op,node.form,base).expressionValue;
}
function isNumeric(node){
  return node.kind==='literal'
    || ((node.kind==='variable'||node.kind==='constant') && node.resolved)
    || (node.kind==='unary' && node.resolved);
}
function numericValue(node){
  if(node.kind==='literal') return node.value;
  if(node.kind==='unary') return node.resultValue;
  return node.declaredValue;
}
function deepClone(node){
  if(node.kind==='binop') return Object.assign({},node,{left:deepClone(node.left),right:deepClone(node.right)});
  if(node.kind==='unary') return Object.assign({}, node, {inner:deepClone(node.inner)});
  return Object.assign({}, node);
}
function replaceNode(node,targetId,replacement){
  if(node.id===targetId) return replacement;
  if(node.kind==='binop') return Object.assign({},node,{left:replaceNode(node.left,targetId,replacement),right:replaceNode(node.right,targetId,replacement)});
  if(node.kind==='unary') return Object.assign({},node,{inner:replaceNode(node.inner,targetId,replacement)});
  return node;
}
function resolveNode(node,targetId){
  if(node.id===targetId){
    if(node.kind==='unary') return Object.assign({}, node, {resolved:true, resultValue: unaryComputedValue(node)});
    return Object.assign({}, node, {resolved:true});
  }
  if(node.kind==='binop') return Object.assign({},node,{left:resolveNode(node.left,targetId),right:resolveNode(node.right,targetId)});
  if(node.kind==='unary') return Object.assign({},node,{inner:resolveNode(node.inner,targetId)});
  return node;
}
// Marks a unary node's underlying variable value as revealed (e.g. "++x" ->
// "++7") WITHOUT applying the operator yet — the required first half of a
// two-step unary resolution. The operator itself is applied by a later,
// separate resolveNode call on the same id (see buildCanonicalTrace), which
// is why this only ever sets `substituted`, never `resolved`.
function substituteNode(node,targetId){
  if(node.id===targetId){
    if(node.kind==='unary') return Object.assign({}, node, {substituted:true});
    return node;
  }
  if(node.kind==='binop') return Object.assign({},node,{left:substituteNode(node.left,targetId),right:substituteNode(node.right,targetId)});
  if(node.kind==='unary') return Object.assign({},node,{inner:substituteNode(node.inner,targetId)});
  return node;
}
function collectUnresolved(node,out){
  out = out || [];
  if(node.kind==='variable'||node.kind==='constant'){if(!node.resolved)out.push(node);}
  else if(node.kind==='unary'){
    if(node.inner.kind==='binop')collectUnresolved(node.inner,out);
    else if(!node.resolved)out.push(node);
  }
  else if(node.kind==='binop'){ collectUnresolved(node.left,out); collectUnresolved(node.right,out); }
  return out;
}
function collectReducible(node,out){
  out = out || [];
  if(node.kind==='unary'){collectReducible(node.inner,out);return out;}
  if(node.kind!=='binop') return out;
  collectReducible(node.left,out);
  collectReducible(node.right,out);
  if(isNumeric(node.left) && isNumeric(node.right)) out.push(node);
  return out;
}
function getMaxPrecCandidates(tree){
  const reducible = collectReducible(tree,[]);
  if(reducible.length===0) return [];
  const maxP = Math.max.apply(null, reducible.map(n=>prec(n.op)));
  return reducible.filter(n=>prec(n.op)===maxP);
}
// Returns every binary operation whose two complete child subexpressions are
// represented by adjacent values in the learner's current expression. This
// is the shared authority for interactive operation validity: sibling
// subtrees may resolve in either order, while a parent cannot resolve before
// both of its own children. The flat model supplies presentation/provenance;
// it does not reinterpret precedence or parentheses.
function coreExpressionLeafIds(node,out){
  out=out||[];
  if(!node)return out;
  if(node.kind==='binop'){
    coreExpressionLeafIds(node.left,out);coreExpressionLeafIds(node.right,out);
  }else if(node.kind==='unary'&&node.inner&&node.inner.kind==='binop'){
    coreExpressionLeafIds(node.inner,out);
  }else out.push(String(node.id));
  return out;
}
function coreExpressionBinaryNodes(node,out){
  out=out||[];
  if(!node)return out;
  if(node.kind==='binop'){
    coreExpressionBinaryNodes(node.left,out);coreExpressionBinaryNodes(node.right,out);out.push(node);
  }else if(node.kind==='unary'&&node.inner){
    coreExpressionBinaryNodes(node.inner,out);
  }
  return out;
}
function coreExpressionSameLeafIds(left,right){
  if(left.length!==right.length)return false;
  const expected=new Set(right.map(String));
  return left.every(id=>expected.has(String(id)));
}
function coreExpressionOperandLeafIds(operand){
  const ids=operand&&Array.isArray(operand.sourceLeafIds)&&operand.sourceLeafIds.length
    ?operand.sourceLeafIds:[operand&&operand.id];
  return [...new Set(ids.filter(id=>id!=null).map(String))];
}
function coreExpressionOperationCandidates(originalTree,flat){
  if(!originalTree||!flat||!Array.isArray(flat.operands)||!Array.isArray(flat.operators))return [];
  const nodes=coreExpressionBinaryNodes(originalTree,[]).map(node=>({
    node,operator:node.op,left:coreExpressionLeafIds(node.left,[]),right:coreExpressionLeafIds(node.right,[])
  }));
  const candidates=[];
  for(let index=0;index<flat.operators.length;index++){
    const left=flat.operands[index],right=flat.operands[index+1],operator=flat.operators[index];
    const leftIds=coreExpressionOperandLeafIds(left),rightIds=coreExpressionOperandLeafIds(right);
    const match=nodes.find(candidate=>candidate.operator===operator
      &&coreExpressionSameLeafIds(leftIds,candidate.left)
      &&coreExpressionSameLeafIds(rightIds,candidate.right));
    if(match)candidates.push({operator,op:operator,leftId:left.id,rightId:right.id,nodeId:match.node.id,index});
  }
  return candidates;
}
function collectReadyUnaryNodes(node,out){
  out=out||[];
  if(node.kind==='unary'){
    collectReadyUnaryNodes(node.inner,out);
    if(!node.resolved&&isNumeric(node.inner))out.push(node);
  }else if(node.kind==='binop'){
    collectReadyUnaryNodes(node.left,out);collectReadyUnaryNodes(node.right,out);
  }
  return out;
}
function expressionNodeDataType(node){
  if(!node)return null;
  if(node.kind==='literal'||node.kind==='variable'||node.kind==='constant')return node.dataType||null;
  if(node.kind==='unary')return node.op==='!'?'boolean':expressionNodeDataType(node.inner);
  return operationResultDataType(node.op,expressionNodeDataType(node.left),expressionNodeDataType(node.right));
}
function evalTree(node){
  if(node.kind==='literal') return node.value;
  if(node.kind==='variable'||node.kind==='constant') return node.declaredValue;
  if(node.kind==='unary') return unaryComputedValue(node);
  return evalOp(node.op,evalTree(node.left),evalTree(node.right),
    expressionNodeDataType(node.left),expressionNodeDataType(node.right));
}
function buildCanonicalTrace(originalTree){
  let working = deepClone(originalTree);
  const steps = [];
  const treeStates = [deepClone(working)];
  const unresolved = collectUnresolved(working,[]);
  for(const n of unresolved){
    // resolveNode/substituteNode preserve the node's id, so the substituted/
    // resolved node IS the result node — this id is what the renderer
    // highlights to show "this value came from here".
    if(n.kind==='unary'){
      // Step A: reveal the variable's value (e.g. "++x" -> "++7") without
      // applying the operator yet — a genuine SUBSTITUTE step, since a
      // unary operator always wraps a variable, never a literal/constant.
      const before1 = renderString(working);
      working = substituteNode(working, n.id);
      const after1 = renderString(working);
      steps.push({action:'SUBSTITUTE', target:(n.inner.kind==='literal'?String(n.inner.value):n.inner.name), targetKind:n.inner.kind, sourceValue:unaryBaseValue(n), expressionBefore:before1, expressionAfter:after1, resultNodeId:n.id});
      treeStates.push(deepClone(working));
      // Step B: apply the unary operator to the now-revealed value (e.g.
      // "++7" -> "8").
      const before2 = renderString(working);
      working = resolveNode(working, n.id);
      const after2 = renderString(working);
      steps.push({action:'UNARY', op:n.op, form:n.form, target:(n.inner.kind==='literal'?String(n.inner.value):n.inner.name), sourceValue:unaryBaseValue(n), result:unaryComputedValue(n), expressionBefore:before2, expressionAfter:after2, resultNodeId:n.id});
      treeStates.push(deepClone(working));
    } else {
      const before = renderString(working);
      working = resolveNode(working, n.id);
      const after = renderString(working);
      steps.push({action:'SUBSTITUTE', target:n.name, targetKind:n.kind, sourceValue:n.declaredValue, expressionBefore:before, expressionAfter:after, resultNodeId:n.id});
      treeStates.push(deepClone(working));
    }
  }
  while(!isNumeric(working)){
    const readyUnary=collectReadyUnaryNodes(working,[]);
    if(readyUnary.length){
      const node=readyUnary[0],base=unaryBaseValue(node),result=evaluateUnaryOperation(node.op,node.form,base).expressionValue;
      const before=renderString(working);
      working=resolveNode(working,node.id);
      const after=renderString(working);
      steps.push({action:'UNARY',op:node.op,form:node.form,target:renderString(node.inner),sourceValue:base,
        result,expressionBefore:before,expressionAfter:after,resultNodeId:node.id});
      treeStates.push(deepClone(working));continue;
    }
    const cands = getMaxPrecCandidates(working);
    if(cands.length===0) throw new EngineError('STUCK');
    const node = cands[0];
    const a = numericValue(node.left), b = numericValue(node.right);
    const result = evalOp(node.op,a,b,expressionNodeDataType(node.left),expressionNodeDataType(node.right));
    const before = renderString(working);
    const newLiteral = makeLiteral(result,{dataType:operationResultDataType(node.op,
      expressionNodeDataType(node.left),expressionNodeDataType(node.right))});
    working = replaceNode(working, node.id, newLiteral);
    const after = renderString(working);
    steps.push({action:'EVALUATE', target:{operator:node.op, operands:[a,b]}, result, expressionBefore:before, expressionAfter:after, resultNodeId:newLiteral.id, leftId:node.left.id, rightId:node.right.id});
    treeStates.push(deepClone(working));
  }
  return {steps, finalValue:numericValue(working), treeStates};
}
function renderString(node,minPrec){
  minPrec = minPrec || 0;
  const authored=Math.max(0,Number(node.authoredParentheses)||0);
  const wrapAuthored=text=>authored?'('.repeat(authored)+text+')'.repeat(authored):text;
  if(node.kind==='literal') return wrapAuthored(formatLiteralNode(node));
  if(node.kind==='variable'||node.kind==='constant') return wrapAuthored(node.resolved ? formatValue(node.declaredValue,node.dataType) : node.name);
  if(node.kind==='unary'){
    if(node.resolved) return wrapAuthored(formatValue(node.resultValue));
    let text;
    if(node.inner.kind==='binop')text=node.op+(node.inner.authoredParentheses?renderString(node.inner,0):'('+renderString(node.inner,0)+')');
    else{
      const inner=renderString(node.inner,0);
      text=node.op==='!'?'!'+inner:(node.form==='prefix'?node.op+inner:inner+node.op);
    }
    return wrapAuthored(text);
  }
  const p = prec(node.op);
  const left = renderString(node.left,p);
  const right = renderString(node.right,p+1);
  const text = left+' '+node.op+' '+right;
  const count=Math.max(authored,p<minPrec?1:0);
  return count?'('.repeat(count)+text+')'.repeat(count):text;
}

