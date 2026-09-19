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
  return mode==='exam'?examProgressKey(email):practiceProgressKey(email);
}

function loadSessionProgress(mode,email){
  if(!email||!modePersistenceEnabled(mode)) return null;
  try{
    const raw=localStorage.getItem(sessionProgressKey(mode,email));
    return raw?JSON.parse(raw):null;
  }catch(e){ return null; }
}

function loadExamProgress(email){
  return loadSessionProgress('exam',email);
}

function clearExamProgress(email){
  if(!email) return;
  try{ localStorage.removeItem(examProgressKey(email)); }catch(e){ /* ignore */ }
}
function clearPracticeProgress(email){
  if(!email) return;
  try{ localStorage.removeItem(practiceProgressKey(email)); }catch(e){ /* ignore */ }
}

// No-op when persistence for the active mode is disabled or no session is
// active, so render() can call this after every state change.
function saveSessionProgress(){
  const mode=state.mode;
  if(!modePersistenceEnabled(mode)||appSettings.mode!==mode||!state.userEmail) return;
  if(state.screen!=='session') return;
  try{
    const record = {
      schemaVersion: 6,
      mode,
      email: state.userEmail,
      studentId: state.userStudentId,
      profileId: state.profileId,
      itemIndex: state.itemIndex,
      itemIndexByProfile: state.itemIndexByProfile,
      sessionSeed: state.sessionSeed,
      // Persist complete generated item snapshots so either mode restores the
      // same seeded work, not just its action history or scores.
      itemsByProfile: state.itemsByProfile,
      showConnectors: state.showConnectors,
      practicePolicy: mode==='practice'?activePracticePolicy():null,
      timerMinutes: mode==='exam'?(state.examTimerMinutes || appSettings.timerMinutes):null,
      examPolicy: mode==='exam'?activeExamPolicy():null,
      expired: mode==='exam'&&!!state.examExpired,
      expiredAt: mode==='exam'?state.examExpiredAt:null,
      examEndTimestamp: mode==='exam'?examEndTimestamp:null,
      savedAt: Date.now()
    };
    localStorage.setItem(sessionProgressKey(mode,state.userEmail), JSON.stringify(record));
  }catch(e){ /* storage full/unavailable — silently skip persistence this time */ }
}
function saveExamProgress(){ if(state.mode==='exam') saveSessionProgress(); }

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
  if(!modePersistenceEnabled(mode)) return false;
  const record=loadSessionProgress(mode,email);
  if(!record||!record.itemsByProfile||typeof record.itemsByProfile!=='object'
    ||(record.mode&&record.mode!==mode)) return false;

  appSettings.mode = mode;

  state.userEmail = record.email;
  state.userStudentId = record.studentId;
  state.mode = mode;
  const sessionProfiles=enabledProfiles();
  if(!sessionProfiles.length) return false;
  state.profileId = sessionProfiles.some(profile=>profile.id===record.profileId)
    ?record.profileId:sessionProfiles[0].id;
  state.itemIndex = record.itemIndex || 0;
  state.itemIndexByProfile = record.itemIndexByProfile || {};
  state.sessionSeed = record.sessionSeed;
  state.practicePolicy = mode==='practice'
    ?snapshotPracticePolicy({practice:record.practicePolicy||appSettings.practice}):null;
  state.examPolicy = mode==='exam'
    ?snapshotExamPolicy({exam:record.examPolicy||appSettings.exam}):null;
  state.examTimerMinutes = mode==='exam'?(record.timerMinutes || appSettings.timerMinutes):null;
  // `submitted` is read only as a one-release migration path. Earlier builds
  // used submission as their terminal lock; those attempts now reopen in the
  // same review-only state as a timer-expired attempt.
  state.examExpired = mode==='exam'&&!!(record.expired||record.submitted);
  state.examExpiredAt = mode==='exam'?(record.expiredAt||record.submittedAt||null):null;
  examEndTimestamp = mode==='exam'?(record.examEndTimestamp || null):null;
  state.itemsByProfile = Object.fromEntries(sessionProfiles
    .filter(profile=>Array.isArray(record.itemsByProfile[profile.id]))
    .map(profile=>[profile.id,record.itemsByProfile[profile.id]]));

  // A saved session from an earlier release may not contain profiles added by
  // this one. Replay the seeded generation sequence and retain only missing
  // profiles; existing student work is never regenerated or overwritten.
  const missingProfileIds = sessionProfiles.filter(p=>!state.itemsByProfile[p.id]).map(p=>p.id);
  if(missingProfileIds.length){
    initializeSeededRandom(state.sessionSeed);
    sessionProfiles.forEach(profile=>{
      const generated = generateItemsForProfile(profile.id);
      if(!state.itemsByProfile[profile.id]) state.itemsByProfile[profile.id] = generated;
    });
    resetRandomGenerator();
  }
  state.items = state.itemsByProfile[state.profileId] || [];
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

  if(mode==='practice'){
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
