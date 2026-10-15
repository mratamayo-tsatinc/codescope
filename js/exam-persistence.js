// ============================================================================
// MODE-SCOPED PROGRESS PERSISTENCE (localStorage, keyed by student email)
// ----------------------------------------------------------------------------
// state.js controls persistence independently for Practice and Exam. Both
// modes save generated items and progress; Exam additionally saves its
// deadline and timeout lock state. Separate keys prevent cross-mode restores.
//
// Both storage keys are per-student. Logging out removes only the separate
// 'precedifyLogin' record, so an enabled mode can resume on the next login.
// ============================================================================

function examProgressKey(email){ return 'precedifyExamProgress:' + email; }
function practiceProgressKey(email){ return 'precedifyPracticeProgress:' + email; }
function sessionProgressKey(mode,email){
  return 'codescopeSessionProgress:' + email + ':' + ACTIVE_PROFILE_SET.id;
}

function parseSavedProgress(raw){
  if(!raw)return null;
  try{return JSON.parse(raw);}catch(error){return null;}
}

function savedProgressMatchesActiveSet(record){
  if(!record||!record.itemsByProfile||typeof record.itemsByProfile!=='object')return false;
  if(record.profileSetId)return record.profileSetId===ACTIVE_PROFILE_SET.id;
  const savedIds=Object.keys(record.itemsByProfile);
  if(!savedIds.length)return false;
  const activeIds=new Set(enabledProfiles().map(profile=>profile.id));
  return savedIds.every(id=>activeIds.has(id));
}

function savedProgressAmount(record){
  if(!record||!record.itemsByProfile)return 0;
  return Object.values(record.itemsByProfile).flat().reduce((amount,item)=>{
    if(!item)return amount;
    if(item.checked)return amount+1000;
    const traceCount=Array.isArray(item.trace)?item.trace.length:0;
    const actionCount=Array.isArray(item.examActionLog)?item.examActionLog.length:0;
    const cursor=item.program&&Number(item.program.cursor)||0;
    return amount+Math.min(999,traceCount+actionCount+cursor);
  },0);
}

function itemNeedsPersistence(item){
  if(!item)return false;
  if(item.checked||item.flagged)return true;
  return typeof itemHasAttempt==='function'&&itemHasAttempt(item);
}

function compactItemsForPersistence(itemsByProfile){
  return Object.fromEntries(Object.entries(itemsByProfile||{}).flatMap(([profileId,items])=>{
    if(!Array.isArray(items))return [];
    const compact=items.map(item=>itemNeedsPersistence(item)?item:null);
    return compact.some(Boolean)?[[profileId,compact]]:[];
  }));
}

function loadSessionProgress(mode,email){
  if(!email||!sessionPersistenceEnabled()) return null;
  try{
    // Older builds used one pair of mode-scoped keys for every deployment.
    // Accept those records only when all saved profile IDs belong to the
    // selected Profile Set. Prefer the record containing more actual student
    // work so a newly-created blank session cannot hide a compatible legacy
    // attempt after an additive application update.
    const candidates=[
      parseSavedProgress(localStorage.getItem(sessionProgressKey(mode,email))),
      parseSavedProgress(localStorage.getItem(examProgressKey(email))),
      parseSavedProgress(localStorage.getItem(practiceProgressKey(email)))
    ].filter(savedProgressMatchesActiveSet).sort((a,b)=>
      savedProgressAmount(b)-savedProgressAmount(a)||(b.savedAt||0)-(a.savedAt||0));
    return candidates[0]||null;
  }catch(e){ return null; }
}

function loadExamProgress(email){
  return loadSessionProgress('exam',email);
}

function clearExamProgress(email){
  if(!email) return;
  try{ localStorage.removeItem(examProgressKey(email));localStorage.removeItem(sessionProgressKey('session',email)); }catch(e){ /* ignore */ }
}
function clearPracticeProgress(email){
  if(!email) return;
  try{ localStorage.removeItem(practiceProgressKey(email));localStorage.removeItem(sessionProgressKey('session',email)); }catch(e){ /* ignore */ }
}

// No-op when persistence for the active mode is disabled or no session is
// active, so render() can call this after every state change.
function saveSessionProgress(){
  const mode='session';
  if(!sessionPersistenceEnabled()||!state.userEmail) return;
  if(state.screen!=='session') return;
  try{
    const record = {
      schemaVersion: 6,
      mode,
      profileSetId:ACTIVE_PROFILE_SET.id,
      profileSetVersion:ACTIVE_PROFILE_SET.version,
      language:state.language,
      email: state.userEmail,
      studentId: state.userStudentId,
      profileId: state.profileId,
      itemIndex: state.itemIndex,
      itemIndexByProfile: state.itemIndexByProfile,
      sessionSeed: state.sessionSeed,
      // Untouched items are reproducible from sessionSeed. Persist only items
      // containing student work so large source-based sessions stay within
      // browser storage limits.
      itemsByProfile: compactItemsForPersistence(state.itemsByProfile),
      showConnectors: state.showConnectors,
      timerMinutes:sessionTimingEnabled()?ACTIVE_PROFILE_SESSION.timing.minutes:null,
      expired:!!state.examExpired,
      expiredAt:state.examExpiredAt,
      timeoutCheckpointReady:state.timeoutCheckpointReady===true,
      examEndTimestamp:sessionTimingEnabled()?examEndTimestamp:null,
      savedAt: Date.now()
    };
    const serialized=JSON.stringify(record,(key,value)=>key==='_bindings'?null:value);
    localStorage.setItem(sessionProgressKey(mode,state.userEmail),serialized);
    return true;
  }catch(error){
    console.error('CodeScope could not save session progress:',error);
    return false;
  }
}
function saveExamProgress(){ saveSessionProgress(); }

// Generic recursive walk over the restored (plain-JSON) itemsByProfile tree
// for the highest `id` value anywhere in it. Needed because engine.js's
// nextId()/__idCounter resets to 1 on every page load — without resyncing
// it here, the very next node created during a resumed session (e.g. a new
// literal from an EVALUATE click) would reuse an id already held by an
// existing node in that same item, and every id-keyed lookup in this app
// (data-token-id, colorMap, connector-lines' findConnectorSourceEl/DestEl,
// etc.) would start matching the wrong element.
function findMaxSerializedId(value, maxSoFar){
  if(value == null) return maxSoFar;
  if(Array.isArray(value)){
    for(const v of value) maxSoFar = findMaxSerializedId(v, maxSoFar);
    return maxSoFar;
  }
  if(typeof value === 'object'){
    if(typeof value.id === 'number' && value.id > maxSoFar) maxSoFar = value.id;
    for(const k in value){
      if(Object.prototype.hasOwnProperty.call(value,k)) maxSoFar = findMaxSerializedId(value[k], maxSoFar);
    }
  }
  return maxSoFar;
}

// Restore a saved session for one mode and student. Returns false when its
// switch is off or no matching snapshot exists, letting login start fresh.
function tryResumeSession(mode,email){
  mode='session';
  if(!sessionPersistenceEnabled()) return false;
  const record=loadSessionProgress(mode,email);
  if(!record||!record.itemsByProfile||typeof record.itemsByProfile!=='object'
    ||(record.profileSetId&&record.profileSetId!==ACTIVE_PROFILE_SET.id)
    ||(record.profileSetVersion&&String(record.profileSetVersion)!==String(ACTIVE_PROFILE_SET.version))
    ) return false;

  // Profile Set ID and version are the compatibility contract. Early builds
  // stored the deployment-global language here, which could disagree with a
  // C Profile Set even though its generated exercises and profile IDs were
  // correct. The next save normalizes this field to the session language.

  state.userEmail = record.email;
  state.userStudentId = record.studentId;
  state.mode = 'practice';
  const sessionProfiles=enabledProfiles();
  if(!sessionProfiles.length) return false;
  state.profileId = sessionProfiles.some(profile=>profile.id===record.profileId)
    ?record.profileId:null;
  state.itemIndex = record.itemIndex || 0;
  state.itemIndexByProfile = record.itemIndexByProfile || {};
  state.sessionSeed = record.sessionSeed;
  state.practicePolicy = null;state.examPolicy = null;
  state.examTimerMinutes = sessionTimingEnabled()?ACTIVE_PROFILE_SESSION.timing.minutes:null;
  // `submitted` is read only as a one-release migration path. Earlier builds
  // used submission as their terminal lock; those attempts now reopen in the
  // same review-only state as a timer-expired attempt.
  state.examExpired = !!(record.expired||record.submitted);
  state.examExpiredAt = record.expiredAt||record.submittedAt||null;
  state.timeoutCheckpointReady=record.timeoutCheckpointReady===true;
  examEndTimestamp = sessionTimingEnabled()?(record.examEndTimestamp || null):null;
  const savedItemsByProfile = Object.fromEntries(sessionProfiles
    .filter(profile=>Array.isArray(record.itemsByProfile[profile.id]))
    .map(profile=>[profile.id,record.itemsByProfile[profile.id]]));

  // Replay the full seeded generation sequence, then overlay only the saved
  // item slots. This restores compact new records and complete legacy records
  // through the same path without changing any student's generated exercise.
  state.itemsByProfile={};
  initializeSeededRandom(state.sessionSeed);
  sessionProfiles.forEach(profile=>{
    const generated=generateItemsForProfile(profile.id);
    const saved=savedItemsByProfile[profile.id]||[];
    state.itemsByProfile[profile.id]=generated.map((item,index)=>saved[index]||item);
  });
  resetRandomGenerator();
  state.items = state.profileId ? (state.itemsByProfile[state.profileId] || []) : [];
  if(state.profileId)syncActiveProfileBehavior();
  state.showConnectors = record.showConnectors !== undefined ? record.showConnectors : state.showConnectors;
  state.screen = 'session';

  // Resync the id generator so any node created from here on gets a
  // genuinely-unused id (see findMaxSerializedId's comment above).
  __idCounter = findMaxSerializedId(state.itemsByProfile, 0) + 1;

  // One-time render/animation flags don't survive JSON serialization as
  // "already played" — nor should they; a resumed page hasn't shown any of
  // these rows yet. Clearing them just means entrance/flash animations
  // play once more on first render, which is correct and has no effect on
  // scoring or trace data.
  Object.values(state.itemsByProfile).forEach(items=>{
    items.forEach(item=>{
      // Older saved sessions predate the Program Item envelope. Rehydrate
      // them as single legacy-expression programs without invalidating the
      // student's existing expression state or score.
      if(!item.activityKind)ensureProgramEnvelope(item);
      if(typeof item.flagged!=='boolean') item.flagged=false;
      if(!Array.isArray(item.examActionLog)) item.examActionLog=[];
      if(item.examSequenceFailure===undefined) item.examSequenceFailure=null;
      if(item.practiceInvalidExecution===undefined) item.practiceInvalidExecution=null;
      if(item.lockedAt===undefined) item.lockedAt=item.checked ? (record.savedAt||null) : null;
      item._bindings = null;
      item._feedbackAnimated = false;
      if(item.trace) item.trace.forEach(t=>{ t._flashed = false; t._entered = false; });
    });
  });

  itemPaginationHandlerAttached = false;

  if(!sessionTimingEnabled()){
    render();
    return true;
  }

  if(state.examExpired){
    timeRemaining=0;
    render();
    return true;
  }

  render();

  // Resume the countdown from wherever its original deadline left off —
  // never grant a fresh full duration on resume.
  const remaining = record.examEndTimestamp
    ? Math.max(0, Math.round((record.examEndTimestamp - Date.now())/1000))
    : 0;
  if(remaining <= 0){
    // Time ran out while the student was away. Preserve the exact restored
    // attempt and lock it without moving away from category Score/QR access.
    expireExam();
  } else {
    startTimer(remaining);
  }

  return true;
}
function tryResumeExamSession(email){ return tryResumeSession('exam',email); }
function tryResumePracticeSession(email){ return tryResumeSession('practice',email); }
