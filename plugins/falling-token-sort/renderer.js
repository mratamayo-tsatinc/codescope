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

const ftsDropStateByItem=new WeakMap();
let ftsPendingTokenSnapshots=null;
let ftsStageResizeObserver=null;
let ftsNextDropTimer=null;
let ftsDragSession=null;

function ftsResetLandingAnimation(item){ftsDropStateByItem.delete(item);}

function ftsDropHash(value){
  let hash=2166136261;
  for(const character of String(value)){hash=Math.imul(hash^character.charCodeAt(0),16777619);}
  return hash>>>0;
}

function ftsMotionEnabled(){
  return (typeof flyAnimEnabled==='undefined'||flyAnimEnabled)
    &&!(typeof window!=='undefined'&&typeof window.matchMedia==='function'
      &&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function ftsLandingBehavior(profile){return profile.activity.dropArea.landingBehavior||'stack';}

function ftsPassPosition(entry,cycle){
  return (entry.basePosition+cycle*entry.positionStep)%1;
}

function ftsPassCycle(entry,now){
  return Math.max(0,Math.floor((now-entry.startAt)/entry.duration));
}

function ftsDropPlan(item,visible,now,motion){
  let entries=ftsDropStateByItem.get(item);
  if(!entries){entries=new Map();ftsDropStateByItem.set(item,entries);}
  let nextStart=now;
  visible.forEach((token,index)=>{
    let entry=entries.get(token.id);
    if(!entry){
      const hash=ftsDropHash(`${item.itemNumber||0}:${token.id}:${token.text}`);
      const duration=3200+(hash%1500)+Math.max(0,(typeof flightDurationMs==='number'?flightDurationMs:1000)-1000)*.5;
      entry={startAt:motion?nextStart:now,duration,position:(hash%1000)/1000,
        basePosition:(hash%1000)/1000,positionStep:.31+((hash>>>11)%360)/1000,cycle:0};
      entries.set(token.id,entry);
    }else if(!motion&&entry.startAt>now)entry.startAt=now;
    if(motion)nextStart=Math.max(nextStart,entry.startAt+entry.duration+260);
  });
  return entries;
}

function ftsStageHeightFromBounds(appBottom,middleTop,scrollTop,followingHeight,paddingBottom,minimum){
  return Math.max(minimum,Math.floor(appBottom-(middleTop+scrollTop)-followingHeight-paddingBottom));
}

function ftsFitStageToApp(middle,stage){
  const app=stage.closest('#app');
  if(ftsStageResizeObserver){ftsStageResizeObserver.disconnect();ftsStageResizeObserver=null;}
  if(!app)return;
  const fit=()=>{
    if(!middle.isConnected)return;
    const appBottom=app.getBoundingClientRect().bottom;
    const middleRect=middle.getBoundingClientRect();
    const followingHeight=app.lastElementChild.getBoundingClientRect().bottom-middleRect.bottom;
    const paddingBottom=parseFloat(getComputedStyle(app).paddingBottom)||0;
    const mobile=typeof window!=='undefined'&&typeof window.matchMedia==='function'
      &&window.matchMedia('(max-width: 680px)').matches;
    const height=ftsStageHeightFromBounds(appBottom,middleRect.top,app.scrollTop,
      followingHeight,paddingBottom,mobile?380:340);
    middle.style.setProperty('--fts-stage-height',`${height}px`);
    ftsLayoutTokenPile(stage);
  };
  fit();
  if(typeof ResizeObserver==='function'){
    ftsStageResizeObserver=new ResizeObserver(fit);
    ftsStageResizeObserver.observe(app);
  }
}

function ftsLayoutTokenPile(stage){
  const lane=stage.querySelector('.fts-token-lane');
  if(!lane)return;
  const tokens=[...lane.querySelectorAll('.fts-current-token')];
  const placed=[],passThrough=lane.classList.contains('fts-lane-pass-through');
  const width=lane.clientWidth,item=typeof currentItem==='function'?currentItem():null;
  tokens.forEach(element=>{
    const entry=ftsDropStateByItem.get(item)?.get(element.dataset.tokenId);
    if(passThrough&&element.classList.contains('fts-token-passing')
      &&!element.classList.contains('fts-token-drag-origin')){
      if(entry){
        entry.cycle=ftsPassCycle(entry,Date.now());
        entry.position=ftsPassPosition(entry,entry.cycle);
        element.dataset.position=String(entry.position);
      }
    }
    const tokenWidth=element.offsetWidth,tokenHeight=element.offsetHeight;
    const usable=Math.max(0,width-tokenWidth-24);
    const left=12+Math.round(usable*Number(element.dataset.position));
    let bottom=!passThrough&&entry?.landingBottom!==undefined?entry.landingBottom:22;
    if(!passThrough&&entry?.landingBottom===undefined)placed.forEach(previous=>{
      if(left<previous.left+previous.width+8&&left+tokenWidth+8>previous.left)
        bottom=Math.max(bottom,previous.bottom+previous.height+8);
    });
    if(!passThrough&&entry&&entry.landingBottom===undefined)entry.landingBottom=bottom;
    element.style.left=`${left}px`;
    element.style.bottom=`${bottom}px`;
    placed.push({left,width:tokenWidth,bottom,height:tokenHeight});
    if(element.classList.contains('fts-token-resuming')
      &&!element.classList.contains('fts-token-drag-origin')){
      const resume=entry?.resume;
      if(resume){
        const laneRect=lane.getBoundingClientRect();
        const landingTop=laneRect.bottom-bottom-tokenHeight;
        element.style.setProperty('--fts-resume-x',`${resume.left-(laneRect.left+left)}px`);
        element.style.setProperty('--fts-resume-y',`${resume.top-landingTop}px`);
        element.style.setProperty('--fts-resume-duration',`${resume.duration}ms`);
        const clock=`resume:${resume.startAt}`;
        if(element.dataset.motionClock!==clock){
          element.style.setProperty('--fts-resume-delay',`${-Math.min(resume.duration,Date.now()-resume.startAt)}ms`);
          element.dataset.motionClock=clock;
        }
        element.style.setProperty('--fts-resume-exit',passThrough?`${bottom+tokenHeight+8}px`:'0px');
      }
    }
    if(element.classList.contains('fts-token-dropping')
      &&!element.classList.contains('fts-token-drag-origin')){
      const elapsed=Math.min(Date.now()-Number(element.dataset.startAt),Number(element.dataset.duration));
      element.style.setProperty('--fts-drop-duration',`${element.dataset.duration}ms`);
      const clock=`drop:${element.dataset.startAt}`;
      if(element.dataset.motionClock!==clock){
        element.style.setProperty('--fts-drop-delay',`${-Math.max(0,elapsed)}ms`);
        element.dataset.motionClock=clock;
      }
      element.style.setProperty('--fts-drop-distance',`${Math.round(lane.clientHeight-bottom)}px`);
    }
    if(element.classList.contains('fts-token-passing')
      &&!element.classList.contains('fts-token-drag-origin')){
      const duration=Number(element.dataset.duration);
      const phase=Math.max(0,Date.now()-Number(element.dataset.startAt))%duration;
      element.style.setProperty('--fts-drop-duration',`${duration}ms`);
      const clock=`pass:${element.dataset.startAt}`;
      if(element.dataset.motionClock!==clock){
        element.style.setProperty('--fts-drop-delay',`${-phase}ms`);
        element.dataset.motionClock=clock;
      }
      element.style.setProperty('--fts-drop-distance',`${Math.round(lane.clientHeight-bottom)}px`);
      element.style.setProperty('--fts-pass-exit',`${bottom+tokenHeight+8}px`);
    }
  });
}

function ftsSnapshotTokenMotion(container,item){
  const lane=container.querySelector('.fts-token-lane');
  if(!lane||lane._ftsItem!==item)return null;
  const snapshots=new Map(),laneBottom=lane.getBoundingClientRect().bottom;
  lane.querySelectorAll('.fts-current-token').forEach(element=>{
    const entry=ftsDropStateByItem.get(item)?.get(element.dataset.tokenId);
    if(entry?.resume&&!element.classList.contains('fts-token-resuming'))return;
    const bottom=Number.parseFloat(element.style.bottom);
    const animation=element.getAnimations?.().find(candidate=>
      ['fts-token-drop','fts-token-pass','fts-token-resume'].includes(candidate.animationName));
    snapshots.set(element.dataset.tokenId,{
      rect:element.getBoundingClientRect(),laneBottom,
      bottom:Number.isFinite(bottom)?bottom:22,
      progress:animation?.effect?.getComputedTiming().progress,
      resuming:element.classList.contains('fts-token-resuming'),
      dropping:element.classList.contains('fts-token-dropping')
    });
  });
  return snapshots;
}

function ftsCaptureBeforeRender(container,item){
  ftsPendingTokenSnapshots=ftsSnapshotTokenMotion(container,item);
}

function ftsTakeTokenSnapshots(container,item){
  const snapshots=ftsPendingTokenSnapshots||ftsSnapshotTokenMotion(container,item);
  ftsPendingTokenSnapshots=null;
  return snapshots;
}

function ftsRestoreTokenMotion(stage,item,snapshots){
  if(!snapshots?.size)return;
  const lane=stage.querySelector('.fts-token-lane'),laneRect=lane.getBoundingClientRect();
  const passThrough=lane.classList.contains('fts-lane-pass-through'),now=Date.now();
  lane.querySelectorAll('.fts-current-token').forEach(element=>{
    const snapshot=snapshots.get(element.dataset.tokenId);
    const entry=ftsDropStateByItem.get(item)?.get(element.dataset.tokenId);
    if(!snapshot||!entry)return;
    const width=element.offsetWidth,height=element.offsetHeight;
    const usable=Math.max(0,lane.clientWidth-width-24);
    const position=usable?Math.max(0,Math.min(1,
      (snapshot.rect.left-laneRect.left-lane.clientLeft-12)/usable)):0;
    entry.position=position;
    element.dataset.position=String(position);
    if(snapshot.resuming&&entry.resume){
      const progress=Number.isFinite(snapshot.progress)?snapshot.progress
        :Math.min(1,(now-entry.resume.startAt)/entry.resume.duration);
      entry.resume={left:snapshot.rect.left,top:snapshot.rect.top,startAt:now,
        duration:Math.max(80,entry.resume.duration*(1-progress))};
    }else if(passThrough&&element.classList.contains('fts-token-passing')){
      const startTop=laneRect.top-height,endTop=laneRect.bottom+8;
      const phase=Math.max(0,Math.min(.9999,(snapshot.rect.top-startTop)/(endTop-startTop)));
      entry.basePosition=position;entry.cycle=0;
      entry.startAt=now-phase*entry.duration;
      element.dataset.startAt=String(entry.startAt);
    }else if(snapshot.dropping&&element.classList.contains('fts-token-dropping')){
      entry.landingBottom=laneRect.bottom-snapshot.laneBottom+snapshot.bottom;
      const startTop=laneRect.top-height;
      const landingTop=laneRect.bottom-entry.landingBottom-height;
      const fall=Math.max(0,Math.min(1,(snapshot.rect.top-startTop)/(landingTop-startTop)));
      const progress=Number.isFinite(snapshot.progress)&&snapshot.progress>.78
        ?snapshot.progress:.78*fall;
      entry.startAt=now-progress*entry.duration;
      element.dataset.startAt=String(entry.startAt);
    }else if(!passThrough){
      entry.landingBottom=laneRect.bottom-snapshot.laneBottom+snapshot.bottom;
    }
  });
  ftsLayoutTokenPile(stage);
}

function ftsScheduleNextDrop(item,profile){
  if(ftsNextDropTimer!==null){clearTimeout(ftsNextDropTimer);ftsNextDropTimer=null;}
  if(!ftsMotionEnabled())return;
  const entries=ftsDropStateByItem.get(item),now=Date.now();
  const next=ftsVisibleTokens(item,profile).map(token=>entries.get(token.id)?.startAt)
    .filter(startAt=>startAt>now).sort((a,b)=>a-b)[0];
  if(next===undefined)return;
  ftsNextDropTimer=setTimeout(()=>{
    ftsNextDropTimer=null;
    if(currentItem()!==item)return;
    ftsRevealScheduledTokens(item,profile);
  },Math.max(1,next-now));
}

function ftsRevealScheduledTokens(item,profile){
  const stage=document.querySelector('.falling-token-sort-workspace .fts-stage');
  const choices=stage?.querySelector('.fts-token-choices');
  if(!choices||currentItem()!==item)return;
  const now=Date.now(),motion=ftsMotionEnabled();
  const visible=ftsVisibleTokens(item,profile),entries=ftsDropPlan(item,visible,now,motion);
  visible.forEach(token=>{
    const entry=entries.get(token.id);
    if(motion&&entry.startAt>now)return;
    if([...choices.children].some(element=>element.getAttribute('data-token-id')===token.id))return;
    choices.appendChild(ftsCreateTokenElement(item,profile,token,entry,now,motion));
  });
  ftsLayoutTokenPile(stage);
  ftsScheduleNextDrop(item,profile);
}

function ftsBucketAtPoint(x,y,stage){
  const target=document.elementFromPoint(x,y);
  const bucket=target&&target.closest('.fts-bucket');
  return bucket&&stage.contains(bucket)&&!bucket.disabled?bucket:null;
}

function ftsSetDragTarget(session,bucket){
  if(session.bucket===bucket)return;
  if(session.bucket)session.bucket.classList.remove('fts-bucket-drag-over');
  session.bucket=bucket;
  if(bucket)bucket.classList.add('fts-bucket-drag-over');
}

function ftsEndDrag(session){
  ftsDragSession=null;
  if(session.bucket)session.bucket.classList.remove('fts-bucket-drag-over');
  if(session.ghost)session.ghost.remove();
  session.source.classList.remove('fts-token-drag-origin');
  session.source.style.animationPlayState='';
  if(session.source.hasPointerCapture?.(session.pointerId))session.source.releasePointerCapture(session.pointerId);
}

function ftsCommitDraggedToken(session,bucket){
  const item=currentItem(),profile=currentProfile();
  if(item!==session.item||item.checked||item._transferInProgress)return null;
  const token=ftsVisibleTokens(item,profile).find(candidate=>candidate.id===session.tokenId);
  const bucketId=bucket?.getAttribute('data-bucket-id');
  if(!token||!ftsBucketById(profile,bucketId))return null;
  if(profile.activity.dropArea.visibleTokens>1){
    const selection=applyActivityAction(item,{type:'SELECT_TOKEN',tokenId:token.id});
    if(!selection.applied)return null;
  }
  const result=applyActivityAction(item,{type:'SORT_TOKEN',tokenId:token.id,bucketId});
  if(!result.applied)return null;
  if(result.accepted)item._arrivedBucketId=bucketId;
  else item._rejectedBucketId=bucketId;
  item._focusBucketsAfterRender=false;
  return result;
}

function ftsReleasePlan(laneRect,laneWidth,tokenWidth,tokenHeight,releaseLeft,releaseTop,passThrough){
  const usable=Math.max(0,laneWidth-tokenWidth-24);
  const position=usable?Math.max(0,Math.min(1,(releaseLeft-laneRect.left-12)/usable)):0;
  const landingTop=passThrough?laneRect.bottom+8:laneRect.bottom-22-tokenHeight;
  return {position,duration:Math.max(320,Math.min(3200,Math.abs(landingTop-releaseTop)/.18))};
}

function ftsContinueFromRelease(session,rerender){
  const entry=ftsDropStateByItem.get(session.item)?.get(session.tokenId);
  const lane=session.stage.querySelector('.fts-token-lane');
  const ghostRect=session.ghost?.getBoundingClientRect();
  if(!entry||!lane||!ghostRect){ftsEndDrag(session);if(rerender)render();return;}
  const laneRect=lane.getBoundingClientRect();
  const passThrough=ftsLandingBehavior(currentProfile())==='pass-through';
  const plan=ftsReleasePlan(laneRect,lane.clientWidth,session.width,session.height,
    ghostRect.left,ghostRect.top,passThrough);
  entry.position=plan.position;
  if(passThrough)entry.basePosition=plan.position;
  entry.resume=ftsMotionEnabled()?{left:ghostRect.left,top:ghostRect.top,startAt:Date.now(),
    duration:plan.duration}:null;
  if(!entry.resume){entry.startAt=Date.now()-(passThrough?0:entry.duration);entry.cycle=0;}
  ftsEndDrag(session);
  if(rerender){render();return;}
  session.source.dataset.position=String(entry.position);
  session.source.classList.remove('fts-token-dropping','fts-token-passing');
  if(entry.resume)session.source.classList.add('fts-token-resuming');
  lane.classList.toggle('fts-lane-free-drop',!!entry.resume);
  ftsLayoutTokenPile(session.stage);
}

function ftsPointerDown(event){
  const source=event.currentTarget,item=currentItem();
  if((event.button!==undefined&&event.button!==0)||event.isPrimary===false
    ||!item||item.checked||item._transferInProgress||ftsDragSession)return;
  const tokenId=source.getAttribute('data-token-id');
  if(!ftsVisibleTokens(item,currentProfile()).some(token=>token.id===tokenId))return;
  const rect=source.getBoundingClientRect();
  ftsDragSession={item,source,tokenId,pointerId:event.pointerId,
    startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,
    offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,
    stage:source.closest('.fts-stage'),dragging:false,ghost:null,bucket:null};
  source.setPointerCapture?.(event.pointerId);
}

function ftsPointerMove(event){
  const session=ftsDragSession;
  if(!session||event.pointerId!==session.pointerId||event.currentTarget!==session.source)return;
  if(!session.dragging){
    if(Math.hypot(event.clientX-session.startX,event.clientY-session.startY)<6)return;
    session.dragging=true;
    const rect=session.source.getBoundingClientRect();
    session.offsetX=event.clientX-rect.left;session.offsetY=event.clientY-rect.top;
    session.source.style.animationPlayState='paused';
    const ghost=session.source.cloneNode(true);
    ghost.classList.add('fts-drag-ghost');
    ghost.removeAttribute('aria-pressed');ghost.setAttribute('aria-hidden','true');
    ghost.tabIndex=-1;
    ghost.style.width=`${session.width}px`;ghost.style.height=`${session.height}px`;
    document.body.appendChild(ghost);
    session.ghost=ghost;
    session.source.classList.add('fts-token-drag-origin');
  }
  event.preventDefault();
  session.ghost.style.left=`${event.clientX-session.offsetX}px`;
  session.ghost.style.top=`${event.clientY-session.offsetY}px`;
  ftsSetDragTarget(session,ftsBucketAtPoint(event.clientX,event.clientY,session.stage));
}

function ftsPointerUp(event){
  const session=ftsDragSession;
  if(!session||event.pointerId!==session.pointerId||event.currentTarget!==session.source)return;
  const bucket=session.dragging?ftsBucketAtPoint(event.clientX,event.clientY,session.stage):null;
  const dragged=session.dragging;
  if(dragged){session.source._ftsWasDragged=true;event.preventDefault();}
  if(dragged){
    session.ghost.style.left=`${event.clientX-session.offsetX}px`;
    session.ghost.style.top=`${event.clientY-session.offsetY}px`;
  }
  const result=dragged&&bucket?ftsCommitDraggedToken(session,bucket):null;
  if(result?.accepted){
    ftsEndDrag(session);render();return;
  }
  if(dragged){ftsContinueFromRelease(session,!!result);return;}
  ftsEndDrag(session);
}

function ftsPointerCancel(event){
  const session=ftsDragSession;
  if(!session||event.pointerId!==session.pointerId||event.currentTarget!==session.source)return;
  if(session.dragging)ftsContinueFromRelease(session,false);
  else ftsEndDrag(session);
}

function ftsPointerLostCapture(event){
  if(ftsDragSession&&ftsDragSession.source===event.currentTarget)ftsPointerCancel(event);
}

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
    item._focusBucketsAfterRender=true;
    if(result.accepted)item._arrivedBucketId=bucketId;
    else item._rejectedBucketId=bucketId;
    render();
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
    class:`fts-bucket fts-tone-${definition.tone}${item._arrivedBucketId===bucket.id?' fts-bucket-arrived':''}${item._rejectedBucketId===bucket.id?' fts-bucket-rejected':''}`,
    type:'button','data-bucket-id':bucket.id,
    disabled:item.checked||item._transferInProgress||!ftsVisibleTokens(item,profile).length,
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
    style:`--fts-region-count:${buckets.length}`,
    'aria-label':`${name} bucket region`},...buckets.map(bucket=>ftsRenderBucket(item,profile,bucket)));
}

function ftsPassIteration(event){
  const element=event.currentTarget,item=currentItem();
  const entry=ftsDropStateByItem.get(item)?.get(element.dataset.tokenId);
  const lane=element.closest('.fts-token-lane');
  if(!entry||!lane||element.classList.contains('fts-token-drag-origin'))return;
  entry.cycle=Math.max(entry.cycle+1,ftsPassCycle(entry,Date.now()));
  entry.position=ftsPassPosition(entry,entry.cycle);
  element.dataset.position=String(entry.position);
  element.style.left=`${12+Math.round(Math.max(0,lane.clientWidth-element.offsetWidth-24)*entry.position)}px`;
}

function ftsResumeFinished(event){
  if(event.animationName!=='fts-token-resume')return;
  const element=event.currentTarget,item=currentItem();
  const entry=ftsDropStateByItem.get(item)?.get(element.dataset.tokenId);
  if(!entry?.resume)return;
  entry.resume=null;
  const lane=element.closest('.fts-token-lane');
  if(!lane)return;
  element.classList.remove('fts-token-resuming');
  if(lane.classList.contains('fts-lane-pass-through')){
    entry.basePosition=(entry.position+entry.positionStep)%1;
    entry.position=entry.basePosition;
    entry.cycle=0;
    entry.startAt=Date.now();
    element.dataset.position=String(entry.position);
    element.dataset.startAt=String(entry.startAt);
    if(ftsMotionEnabled())element.classList.add('fts-token-passing');
  }else entry.startAt=Date.now()-entry.duration;
  lane.classList.toggle('fts-lane-free-drop',!!lane.querySelector('.fts-token-resuming'));
  ftsLayoutTokenPile(element.closest('.fts-stage'));
}

function ftsCreateTokenElement(item,profile,token,entry,now,motion){
  const single=profile.activity.dropArea.visibleTokens===1;
  const passThrough=ftsLandingBehavior(profile)==='pass-through';
  if(passThrough&&motion&&!entry.resume){entry.cycle=ftsPassCycle(entry,now);entry.position=ftsPassPosition(entry,entry.cycle);}
  const motionClass=entry.resume&&motion?' fts-token-resuming':!motion?'':passThrough?' fts-token-passing'
    :now<entry.startAt+entry.duration?' fts-token-dropping':'';
  const attributes={'data-token-id':token.id,'data-position':String(entry.position),
    'data-start-at':String(entry.startAt),'data-duration':String(entry.duration),
    onpointerdown:ftsPointerDown,onpointermove:ftsPointerMove,
    onpointerup:ftsPointerUp,onpointercancel:ftsPointerCancel,
    onlostpointercapture:ftsPointerLostCapture,onanimationiteration:ftsPassIteration,
    onanimationend:ftsResumeFinished};
  if(single)return h('code',{class:`fts-current-token${motionClass}`,
    tabindex:'0',role:'button','aria-label':`Drag token ${token.text} to a bucket`,...attributes},token.text);
  return h('button',{
    class:`fts-current-token fts-token-choice${item.selectedTokenId===token.id?' fts-token-selected':''}${motionClass}`,
    type:'button',...attributes,'aria-pressed':item.selectedTokenId===token.id?'true':'false',
    'aria-label':`Drag token ${token.text} to a bucket, or select it and choose a bucket`,
    disabled:item._transferInProgress||item.checked,
    onclick:event=>{
      if(event.currentTarget._ftsWasDragged){event.currentTarget._ftsWasDragged=false;return;}
      ftsSelectToken(token.id);
    }
  },h('code',{},token.text));
}

function ftsRenderTokenLane(item,profile){
  const visible=ftsVisibleTokens(item,profile);
  const completed=!visible.length;
  const now=Date.now(),motion=ftsMotionEnabled(),entries=ftsDropPlan(item,visible,now,motion);
  if(!motion)visible.forEach(token=>{entries.get(token.id).resume=null;});
  const resuming=visible.some(token=>entries.get(token.id)?.resume);
  const lane=h('section',{class:`fts-token-lane${ftsLandingBehavior(profile)==='pass-through'?' fts-lane-pass-through':''}${resuming?' fts-lane-free-drop':''}`,
    'aria-label':'Token sorting area'});
  lane._ftsItem=item;
  lane.appendChild(h('div',{class:'fts-token-lane-label'},completed?'Item ready to check':'Drag a token to a bucket'));
  const live=h('div',{class:'fts-token-live','aria-live':'polite','aria-atomic':'true'});
  if(visible.length){
    const choices=h('div',{class:'fts-token-choices'});
    visible.forEach(token=>{
      const entry=entries.get(token.id);
      if(motion&&entry.startAt>now)return;
      choices.appendChild(ftsCreateTokenElement(item,profile,token,entry,now,motion));
    });
    live.appendChild(h('span',{class:'fts-token-position'},`${item.cursor} of ${item.tokens.length} tokens placed`));
    live.appendChild(choices);
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
    h('span',{},'That bucket does not match. The token keeps falling so you can try another bucket.'));
}

function ftsRender({container,item,profile}){
  if(ftsDragSession)ftsEndDrag(ftsDragSession);
  const tokenSnapshots=ftsTakeTokenSnapshots(container,item);
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
  ftsFitStageToApp(middle,stage);
  ftsRestoreTokenMotion(stage,item,tokenSnapshots);
  ftsScheduleNextDrop(item,profile);
  ftsSyncDrawers(item,profile);
  if(item._arrivedBucketId)item._arrivedBucketId=null;
  if(item._rejectedBucketId)item._rejectedBucketId=null;
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
