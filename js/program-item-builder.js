// ============================================================================
// GENERATED PROGRAM ADAPTER
// ----------------------------------------------------------------------------
// Converts a generated expression item into either the unchanged one-statement
// compatibility program or an opt-in declaration chain followed by that same
// expression item. Generation remains independent of rendering/evaluation.
// ============================================================================

function engineNodeToProgramIr(node){
  if(node.kind === 'literal') return literalExpression(node.value, {id:node.id});
  if(node.kind === 'variable' || node.kind === 'constant'){
    return identifierExpression(node.name, {id:node.id});
  }
  if(node.kind === 'unary'){
    return unaryExpression(node.op, engineNodeToProgramIr(node.inner), {id:node.id, form:node.form});
  }
  return binaryExpression(node.op, engineNodeToProgramIr(node.left), engineNodeToProgramIr(node.right), {id:node.id});
}

function declarationInitializerTree(declarations, index){
  const target = declarations[index];
  if(index === 0) return makeLiteral(target.value);

  // The profile currently selects `previous`: each declaration truly depends
  // on the statement immediately before it. The adapter preserves the seeded
  // target value by expressing its difference as + or -, so the later final
  // expression receives exactly the values the existing generator selected.
  const previous = declarations[index-1];
  const previousRef = makeNamed(previous.kind, previous.name, previous.value);
  const difference = Math.abs(target.value - previous.value);
  const operator = target.value >= previous.value ? '+' : '-';
  return makeBinOp(operator, previousRef, makeLiteral(difference));
}

function buildDeclarationRuntime(tree, expectedValue){
  const originalFlat = flattenInstance(tree);
  return {
    originalTree: tree,
    originalFlat,
    workingFlat: deepCloneFlat(originalFlat),
    history: [deepCloneFlat(originalFlat)],
    trace: [],
    canonicalTrace: buildCanonicalTrace(tree),
    expectedValue,
    checked: false,
    correctSteps: 0,
    totalOpSteps: 0,
    wasCorrectAssignment: null,
    assignedValue: null
  };
}

function buildUninitializedDeclarationRuntime(){
  const empty={operands:[],operators:[]};
  return {
    originalTree:null,
    originalFlat:empty,
    workingFlat:deepCloneFlat(empty),
    history:[deepCloneFlat(empty)],
    trace:[],
    canonicalTrace:{steps:[],finalValue:null,treeStates:[]},
    expectedValue:null,
    checked:false,
    correctSteps:0,
    totalOpSteps:0,
    wasCorrectAssignment:null,
    assignedValue:null
  };
}

function namedValueTree(declaration,memory){
  return makeNamed(declaration.kind,declaration.name,memory[declaration.name]);
}

function buildAssignmentStatementRuntime(target,operator,rhsTree,memory,index){
  const expectedBefore=memory[target];
  const expectedRhs=evalTree(rhsTree);
  const expectedAfter=applyAssignmentOperator(operator,expectedBefore,expectedRhs);
  const statement=assignmentStatement({id:`assignment-${index+1}`,target,operator,value:engineNodeToProgramIr(rhsTree)});
  statement.runtime=buildDeclarationRuntime(rhsTree,expectedRhs);
  statement.runtime.expectedBefore=expectedBefore;
  statement.runtime.expectedRhs=expectedRhs;
  statement.runtime.expectedAfter=expectedAfter;
  statement.runtime.beforeValue=null;
  statement.runtime.rhsValue=null;
  statement.runtime.targetRevealed=false;
  statement.runtime.targetReadValue=null;
  statement.runtime.assignmentActionOrder=[];
  statement.runtime.assignmentResultNodeId=null;
  statement.runtime.assignmentMergePending=false;
  statement.dependencies=[...collectExpressionDependencies(statement.value)];
  memory[target]=expectedAfter;
  return statement;
}

function buildAssignmentLessonStatements(item,lesson,memory){
  const variables=item.decls.filter(d=>d.kind==='variable');
  const constants=item.decls.filter(d=>d.kind==='constant');
  const a=variables[0], b=variables[1]||variables[0], c=variables[2]||variables[0];
  const k=constants[0];
  const specs=[];
  const add=(target,operator,tree)=>specs.push({target,operator,tree});

  if(lesson==='basic-set') add(a.name,'=',makeLiteral(memory[a.name]+2));
  else if(lesson==='add-sub'){
    add(a.name,'+=',makeLiteral(5)); add(a.name,'-=',makeLiteral(3));
  } else if(lesson==='multiply') add(a.name,'*=',makeLiteral(4));
  else if(lesson==='divide-remainder'){
    add(a.name,'/=',makeLiteral(2)); add(a.name,'%=',makeLiteral(5));
  } else if(lesson==='rhs-expression'){
    add(a.name,'+=',makeBinOp('*',namedValueTree(b,memory),makeLiteral(4)));
  } else if(lesson==='sequential'){
    add(a.name,'+=',makeLiteral(8)); add(a.name,'*=',makeLiteral(2)); add(a.name,'-=',makeLiteral(5));
  } else if(lesson==='dependent'){
    add(a.name,'+=',namedValueTree(b,memory));
    const constantNode=k?namedValueTree(k,memory):makeLiteral(3);
    // This tree is created after the first spec is applied below, so its
    // target reference must use the then-current memory value.
    specs.push({target:b.name,operator:'*=',treeFactory:()=>makeBinOp('-',namedValueTree(a,memory),constantNode)});
  } else if(lesson==='advanced'){
    add(a.name,'+=',makeBinOp('*',namedValueTree(b,memory),namedValueTree(c,memory)));
    specs.push({target:b.name,operator:'*=',treeFactory:()=>makeBinOp('-',namedValueTree(a,memory),makeLiteral(10))});
    specs.push({target:a.name,operator:'%=',treeFactory:()=>makeBinOp('+',namedValueTree(c,memory),makeLiteral(5))});
  }

  return specs.map((spec,index)=>{
    const tree=spec.treeFactory?spec.treeFactory():spec.tree;
    return buildAssignmentStatementRuntime(spec.target,spec.operator,tree,memory,index);
  });
}

function buildUnaryUpdateStatementRuntime(target,operator,form,memory,index){
  const expectedBefore=memory[target];
  const expectedAfter=expectedBefore+(operator==='++'?1:-1);
  const tree=makeUnary(operator,form,makeNamed('variable',target,expectedBefore));
  const statement=unaryUpdateStatement({
    id:`unary-update-${index+1}`,target,operator,form
  });
  statement.runtime=buildDeclarationRuntime(tree,expectedAfter);
  statement.runtime.expectedBefore=expectedBefore;
  statement.runtime.expectedAfter=expectedAfter;
  statement.runtime.beforeMemory=null;
  statement.runtime.beforeValue=null;
  statement.runtime.assignedValue=null;

  // The generic unary engine correctly models postfix expression values as
  // the original value. In a standalone statement that value is discarded;
  // the observable result is the updated memory value, so canonical playback
  // normalizes only this statement-local final state to that stored value.
  const canonical=statement.runtime.canonicalTrace;
  const finalTree=canonical&&canonical.treeStates&&canonical.treeStates[canonical.treeStates.length-1];
  const finalStep=canonical&&canonical.steps&&canonical.steps[canonical.steps.length-1];
  if(finalTree&&finalTree.kind==='unary') finalTree.resultValue=expectedAfter;
  if(finalStep&&finalStep.action==='UNARY'){
    finalStep.result=expectedAfter;
    finalStep.expressionAfter=renderString(finalTree);
  }
  statement.dependencies=[target];
  memory[target]=expectedAfter;
  return statement;
}

function buildUnaryUpdateLessonStatements(item,lesson,memory){
  const variables=item.decls.filter(declaration=>declaration.kind==='variable');
  const first=variables[0],second=variables[1]||variables[0];
  if(!first) return [];
  const specs=lesson==='standalone-sequence'
    ? [
        {target:first.name,operator:'++',form:'postfix'},
        {target:second.name,operator:'--',form:'prefix'},
        {target:first.name,operator:'++',form:'prefix'},
        {target:second.name,operator:'--',form:'postfix'}
      ]
    : [];
  return specs.map((spec,index)=>buildUnaryUpdateStatementRuntime(
    spec.target,spec.operator,spec.form,memory,index));
}

function buildAdvancedAssignmentUnaryStatements(item,memory){
  const variables=item.decls.filter(declaration=>declaration.kind==='variable');
  const constants=item.decls.filter(declaration=>declaration.kind==='constant');
  const a=variables[0],b=variables[1]||a,c=variables[2]||a,k=constants[0];
  if(!a) return [];
  const statements=[];
  statements.push(buildAssignmentStatementRuntime(a.name,'+=',
    makeBinOp('*',namedValueTree(b,memory),makeLiteral(2)),memory,0));
  statements.push(buildUnaryUpdateStatementRuntime(c.name,'--','postfix',memory,0));
  statements.push(buildUnaryUpdateStatementRuntime(a.name,'++','prefix',memory,1));
  statements.push(buildAssignmentStatementRuntime(b.name,'*=',
    makeBinOp('-',namedValueTree(a,memory),k?namedValueTree(k,memory):makeLiteral(2)),memory,1));
  statements.push(buildAssignmentStatementRuntime(c.name,'+=',
    makeBinOp('%',namedValueTree(a,memory),makeLiteral(5)),memory,2));
  return statements;
}

function buildOutputStatementRuntime(spec,index,memory){
  const statement=outputStatement({
    id:`output-${index+1}`,
    newline:spec.newline!==false,
    parts:spec.parts
  });
  statement.runtime={
    parts:statement.parts.map(part=>({
      stagedValue:null,
      resolvedValue:null,
      expectedValue:part.kind==='expression'?memory[part.expression.name]:null
    })),
    trace:[],checked:false,assignedValue:null,wasCorrectAssignment:null,
    correctSteps:0,totalOpSteps:0
  };
  statement.dependencies=statement.parts.filter(part=>part.kind==='expression')
    .map(part=>part.expression&&part.expression.kind==='identifier'?part.expression.name:null)
    .filter(Boolean);
  return statement;
}

function buildOutputLessonStatements(item,lesson,memory){
  const variables=item.decls.filter(declaration=>declaration.kind==='variable');
  if(lesson!=='formatted-values'||variables.length<3) return [];
  const first=variables[0],second=variables[1],sum=variables[2];
  const text=value=>({kind:'text',value});
  const value=declaration=>({kind:'expression',expression:identifierExpression(declaration.name),format:'d'});
  const specs=[
    {parts:[text('OUTPUT LESSON')]},
    {parts:[text(`Value of ${first.name} is `),value(first)]},
    {parts:[text(`Value of ${second.name} is `),value(second)]},
    {parts:[text(`Sum of ${first.name} and ${second.name} is `),value(sum)]}
  ];
  return specs.map((spec,index)=>buildOutputStatementRuntime(spec,index,memory));
}

function applyProgramMemoryToTree(node,memory){
  if(!node) return;
  if(node.kind==='variable'||node.kind==='constant'){
    if(Object.prototype.hasOwnProperty.call(memory,node.name)){
      const stored=memory[node.name];
      node.declaredValue=stored&&typeof stored==='object'&&Object.prototype.hasOwnProperty.call(stored,'value')
        ?stored.value:stored;
    }
    return;
  }
  if(node.kind==='unary') return applyProgramMemoryToTree(node.inner,memory);
  if(node.kind==='binop'){
    applyProgramMemoryToTree(node.left,memory);
    applyProgramMemoryToTree(node.right,memory);
  }
}

function rebuildFinalExpressionForMemory(item,memory){
  applyProgramMemoryToTree(item.originalTree,memory);
  item.originalFlat=flattenInstance(item.originalTree);
  item.workingFlat=deepCloneFlat(item.originalFlat);
  item.history=[deepCloneFlat(item.originalFlat)];
  item.trace=[];
  item.correctFinalValue=evalTree(item.originalTree);
  item.canonicalTrace=buildCanonicalTrace(item.originalTree);
}

function buildGeneratedProgram(item, profile){
  const cfg = profile && profile.program;
  if(!cfg || cfg.declarations !== 'interactive'){
    ensureProgramEnvelope(item);
    return item.program;
  }

  const isAssignmentLesson=!!cfg.assignmentLesson;
  const isUnaryUpdateLesson=!!cfg.unaryUpdateLesson;
  const isMixedUpdateLesson=!!cfg.mixedUpdateLesson;
  const isOutputLesson=!!cfg.outputLesson;
  const isProgramLesson=isAssignmentLesson||isUnaryUpdateLesson||isMixedUpdateLesson||isOutputLesson;
  const outputVariables=isOutputLesson?item.decls.filter(declaration=>declaration.kind==='variable'):[];
  if(isOutputLesson&&outputVariables.length<3){
    throw new Error(`${profile.id}: outputLesson requires at least three variable declarations`);
  }
  if(isOutputLesson){
    outputVariables[2].value=outputVariables[0].value+outputVariables[1].value;
  }
  const statements = item.decls.map((decl, index)=>{
    let initializerTree=isProgramLesson?makeLiteral(decl.value):declarationInitializerTree(item.decls,index);
    if(isOutputLesson&&decl===outputVariables[2]){
      initializerTree=makeBinOp('+',
        makeNamed(outputVariables[0].kind,outputVariables[0].name,outputVariables[0].value),
        makeNamed(outputVariables[1].kind,outputVariables[1].name,outputVariables[1].value));
    }
    const statement = declarationStatement({
      id:`declaration-${index+1}`,
      name:decl.name,
      dataType:decl.isBoolean ? 'boolean' : 'int',
      mutable:decl.kind !== 'constant',
      initializer:engineNodeToProgramIr(initializerTree)
    });
    statement.binding.kind = decl.kind;
    statement.runtime = buildDeclarationRuntime(initializerTree, decl.value);
    statement.dependencies = [...collectExpressionDependencies(statement.initializer)];
    return statement;
  });

  if(isAssignmentLesson){
    const expectedMemory={};
    item.decls.forEach(decl=>{expectedMemory[decl.name]=decl.value;});
    statements.push(...buildAssignmentLessonStatements(item,cfg.assignmentLesson,expectedMemory));
    rebuildFinalExpressionForMemory(item,expectedMemory);
  }

  if(isUnaryUpdateLesson){
    const expectedMemory={};
    item.decls.forEach(decl=>{expectedMemory[decl.name]=decl.value;});
    statements.push(...buildUnaryUpdateLessonStatements(item,cfg.unaryUpdateLesson,expectedMemory));
    rebuildFinalExpressionForMemory(item,expectedMemory);
  }

  if(isMixedUpdateLesson){
    const expectedMemory={};
    item.decls.forEach(decl=>{expectedMemory[decl.name]=decl.value;});
    statements.push(...buildAdvancedAssignmentUnaryStatements(item,expectedMemory));
    rebuildFinalExpressionForMemory(item,expectedMemory);
  }

  if(isOutputLesson){
    const expectedMemory={};
    item.decls.forEach(decl=>{expectedMemory[decl.name]=decl.value;});
    statements.push(...buildOutputLessonStatements(item,cfg.outputLesson,expectedMemory));
    // End with the established expression check using the derived sum from
    // memory. This keeps scoring, feedback, solution playback and persistence
    // on the same path as every other expression based program profile.
    item.originalTree=makeNamed(outputVariables[2].kind,outputVariables[2].name,expectedMemory[outputVariables[2].name]);
    rebuildFinalExpressionForMemory(item,expectedMemory);
  }

  statements.push({
    id:'final-expression',
    kind:'legacy-expression',
    status:'locked'
  });

  item.program = createProgram(statements, {
    id:`${profile.id}-program`,
    language:(typeof state === 'object' && state && state.language) || 'java'
  });
  item.program.mode = isProgramLesson ? 'interactive-program' : 'interactive-declarations';
  item.program.scoreAssignments = cfg.scoreAssignments !== false;
  return item.program;
}
