function ftsCorrectnessVisible(){return state.mode!=='exam'||state.examSubmitted;}

function ftsProgressSteps(item){
  const placed=new Set(item.placements.map(placement=>placement.tokenId));
  return item.tokens.map((token,index)=>{
    if(item.checked&&ftsCorrectnessVisible()){
      const result=ftsScoreResult(item,token.id);
      return {status:result&&result.wasCorrect?'complete':'invalid'};
    }
    if(placed.has(token.id))return {status:'complete'};
    if(token.id===item.selectedTokenId||(!item.selectedTokenId&&index===item.tokens.findIndex(candidate=>!placed.has(candidate.id))))
      return {status:'current'};
    return {status:'waiting'};
  });
}

function ftsOrderedRegions(profile){
  const regions={top:[],left:[],right:[],bottom:[]};
  profile.activity.buckets.forEach(bucket=>regions[bucket.region].push(bucket));
  Object.values(regions).forEach(buckets=>buckets.sort((a,b)=>a.order-b.order));
  return regions;
}

const FTS_TRANSFER_COLORS=Object.freeze({
  'valid-identifier':'#67c7d4','invalid-identifier':'#f2a45f','reserved-word':'#e5c66e',
  operator:'#76aee8',literal:'#b5c48b',separator:'#9aa7bb'
});

function ftsChooseBucket(bucketId,bucketElement){
  const item=currentItem();
  if(!item||item.checked||item._transferInProgress)return;
  const token=ftsCurrentToken(item,currentProfile()),bucket=ftsBucketById(currentProfile(),bucketId);
  const sourceElement=[...document.querySelectorAll('.fts-current-token')]
    .find(element=>element.getAttribute('data-token-id')===token?.id);
  if(!token||!bucket||!sourceElement||!bucketElement)return;
  let finished=false;
  const commit=()=>{
    if(finished)return;finished=true;item._transferInProgress=false;
    const result=applyActivityAction(item,{type:'SORT_TOKEN',bucketId,tokenId:token.id});
    if(!result.applied){render();return;}
    item._focusBucketsAfterRender=true;item._arrivedBucketId=bucketId;render();
  };
  const reduced=typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animationEnabled=typeof flyAnimEnabled==='undefined'||flyAnimEnabled;
  if(reduced||!animationEnabled||typeof runVarFinalComet!=='function'){commit();return;}
  item._transferInProgress=true;sourceElement.classList.add('fts-token-moving');
  document.querySelectorAll('.fts-bucket').forEach(element=>{element.disabled=true;});
  document.querySelectorAll('.fts-token-choice').forEach(element=>{element.disabled=true;});
  try{
    runVarFinalComet(sourceElement.getBoundingClientRect(),bucketElement.getBoundingClientRect(),
      FTS_TRANSFER_COLORS[bucket.category]||'#ffa35c',commit);
  }catch(error){commit();}
}

function ftsSelectToken(tokenId){
  const item=currentItem();
  if(!item||item.checked||item._transferInProgress)return;
  const result=applyActivityAction(item,{type:'SELECT_TOKEN',tokenId});
  if(result.applied){item._focusBucketsAfterRender=true;render();}
}

function ftsRenderBucket(item,profile,bucket){
  const definition=TC_CATEGORY_DEFS[bucket.category],count=item.bucketCounts[bucket.id]||0;
  return h('button',{
    class:`fts-bucket fts-tone-${definition.tone}${item._arrivedBucketId===bucket.id?' fts-bucket-arrived':''}`,
    type:'button','data-bucket-id':bucket.id,
    disabled:item.checked||item._transferInProgress||!ftsCurrentToken(item,profile),
    onclick:event=>ftsChooseBucket(bucket.id,event.currentTarget),
    'aria-label':`${definition.label} bucket, ${count} ${count===1?'token':'tokens'} placed`
  },
  h('span',{class:'fts-bucket-icon','aria-hidden':'true'},h('i',{class:`fa-solid ${definition.icon}`})),
  h('span',{class:'fts-bucket-label'},definition.label),
  h('span',{class:'fts-bucket-count','aria-hidden':'true'},String(count)));
}

function ftsRenderBucketRegion(item,profile,name,buckets){
  if(!buckets.length)return null;
  return h('div',{class:`fts-bucket-region fts-region-${name}`,'data-region':name,
    'aria-label':`${name} bucket region`},...buckets.map(bucket=>ftsRenderBucket(item,profile,bucket)));
}

function ftsRenderTokenLane(item,profile){
  const visible=ftsVisibleTokens(item,profile),single=profile.activity.dropArea.visibleTokens===1;
  const completed=!visible.length;
  const lane=h('section',{class:'fts-token-lane','aria-label':'Token sorting area'});
  lane.appendChild(h('div',{class:'fts-token-lane-label'},completed?'Item ready to check':single?'Current token':'Select a token'));
  const live=h('div',{class:'fts-token-live','aria-live':'polite','aria-atomic':'true'});
  if(visible.length){
    const choices=h('div',{class:`fts-token-choices${single?'':' fts-token-choices-multiple'}`});
    visible.forEach(token=>{
      if(single)choices.appendChild(h('code',{class:'fts-current-token',tabindex:'0','data-token-id':token.id},token.text));
      else choices.appendChild(h('button',{
        class:`fts-current-token fts-token-choice${item.selectedTokenId===token.id?' fts-token-selected':''}`,
        type:'button','data-token-id':token.id,'aria-pressed':item.selectedTokenId===token.id?'true':'false',
        'aria-label':`Select token ${token.text}`,disabled:item._transferInProgress||item.checked,
        onclick:()=>ftsSelectToken(token.id)
      },h('code',{},token.text)));
    });
    live.appendChild(choices);
    live.appendChild(h('span',{class:'fts-token-position'},`${item.cursor} of ${item.tokens.length} tokens placed`));
  }else{
    live.appendChild(h('div',{class:'fts-placement-complete'},h('i',{class:'fa-solid fa-circle-check','aria-hidden':'true'}),
      h('span',{},`All ${item.tokens.length} tokens placed`)));
  }
  lane.appendChild(live);return lane;
}

function ftsRenderControls(item){
  if(item.checked)return null;
  const canUndo=item.history.length>0&&examAllowsUndo();
  const canCheck=item.cursor>=item.tokens.length;
  const canReset=state.mode==='practice'&&(item.cursor>0||item.attempts.length);
  if(!canUndo&&!canCheck&&!canReset)return null;
  const row=h('div',{class:'fts-controls'}),actions=renderInlineEvaluationActions({canUndo,canCheck});
  if(canReset){
    row.appendChild(h('button',{class:'item-reset-button fts-reset-button',type:'button',onclick:handleReset},'Reset item'));
  }
  if(actions)row.appendChild(actions);return row;
}

function ftsRenderPracticeResult(item,profile){
  if(state.mode!=='practice'||profile.activity.feedback.practice!=='immediate-return'
    ||!item.lastResult||item.lastResult.wasCorrect)return null;
  return h('div',{class:'fts-placement-message',role:'status','aria-live':'polite'},
    h('i',{class:'fa-solid fa-rotate-left','aria-hidden':'true'}),
    h('span',{},'That bucket does not match. The token returned so you can choose another bucket.'));
}

function ftsRender({container,item,profile}){
  const steps=ftsProgressSteps(item),activeIndex=item.tokens.findIndex(token=>token.id===item.selectedTokenId);
  const cursor=activeIndex>=0?activeIndex:Math.max(0,steps.findIndex(step=>step.status==='current'));
  const flow=renderProgramWorkspaceShell(container,item,{statements:steps,cursor,status:item.checked?'complete':'running',progressMode:'completion'});
  flow.parentNode.classList.add('falling-token-sort-workspace');
  flow.appendChild(h('div',{class:'fts-instruction'},h('i',{class:'fa-solid fa-circle-info','aria-hidden':'true'}),
    h('span',{},profile.activity.instructions)));
  const regions=ftsOrderedRegions(profile),stage=h('div',{class:'fts-stage'});
  const top=ftsRenderBucketRegion(item,profile,'top',regions.top);if(top)stage.appendChild(top);
  const left=ftsRenderBucketRegion(item,profile,'left',regions.left),right=ftsRenderBucketRegion(item,profile,'right',regions.right);
  const middle=h('div',{class:`fts-stage-middle${left?' has-left':''}${right?' has-right':''}`});
  if(left)middle.appendChild(left);middle.appendChild(ftsRenderTokenLane(item,profile));if(right)middle.appendChild(right);stage.appendChild(middle);
  const bottom=ftsRenderBucketRegion(item,profile,'bottom',regions.bottom);if(bottom)stage.appendChild(bottom);
  const result=ftsRenderPracticeResult(item,profile);if(result)stage.appendChild(result);
  const controls=ftsRenderControls(item);if(controls)stage.appendChild(controls);
  flow.appendChild(stage);
  if(item.checked&&state.mode==='exam'&&!state.examSubmitted){
    container.appendChild(h('div',{class:'exam-answer-recorded'},h('i',{class:'fa-solid fa-lock'}),
      h('span',{},h('b',{},'Answer recorded and locked.'),' Correctness and score are withheld until the exam is submitted.')));
  }
  if(item.checked&&state.mode==='practice'){
    container.appendChild(h('div',{class:'action-bar'},h('div',{class:'btn-group'},
      h('button',{class:'btn',onclick:handleRetrySameItem},h('i',{class:'fa-solid fa-rotate-right'}),' Try again'))));
  }
  ftsSyncDrawers(item,profile);
  if(item._arrivedBucketId)item._arrivedBucketId=null;
  if(item._focusBucketsAfterRender&&typeof requestAnimationFrame==='function'){
    item._focusBucketsAfterRender=false;
    requestAnimationFrame(()=>{
      const target=document.querySelector(item.selectedTokenId
        ?'.fts-bucket:not(:disabled)'
        :'.fts-token-choice:not(:disabled),.fts-bucket:not(:disabled)');
      if(target)target.focus();
    });
  }
}
