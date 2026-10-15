// ============================================================================
// LOGIN HANDLING WITH STUDENT DATABASE VALIDATION
// ============================================================================

let studentDatabase = []; // Will be populated from data/students.csv

// Load student database from CSV file
async function loadStudentDatabase() {
  try {
    const response = await fetch('data/students.csv');
    if (!response.ok) {
      console.error('Failed to load students.csv:', response.status);
      return false;
    }
    
    const text = await response.text();
    const rows = text.split('\n').slice(1); // Skip header row
    
    studentDatabase = rows
      .filter(row => row.trim().length > 0) // Skip empty rows
      .map(row => {
        const [email, studentNumber] = row.split(',');
        return { 
          email: email?.trim(), 
          studentNumber: studentNumber?.trim() 
        };
      })
      .filter(record => record.email && record.studentNumber); // Filter out invalid records
    
    console.log(`Student database loaded: ${studentDatabase.length} students`);
    return true;
  } catch (err) {
    console.error('Error loading student database:', err);
    return false;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('emailInput');
  const studentNumInput = document.getElementById('studentNumInput');
  const errorDiv = document.getElementById('loginError');
  
  // Clear previous errors
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
  
  const email = emailInput.value.trim();
  const studentNumber = studentNumInput.value.trim();
  
  // Validation
  if (!email) {
    showLoginError('Please enter your email address');
    emailInput.focus();
    return;
  }
  
  if (!studentNumber) {
    showLoginError('Please enter your student number');
    studentNumInput.focus();
    return;
  }
  
  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showLoginError('Please enter a valid email address');
    emailInput.focus();
    return;
  }
  
  // Check if user exists in student database
  const user = studentDatabase.find(s => s.email === email && s.studentNumber === studentNumber);
  
  if (!user) {
    showLoginError('Invalid email or student number. Please check and try again.');
    return;
  }

  try{
    await ensureActivityContentReady();
  }catch(error){
    console.error('Failed to load activity content:',error);
    showLoginError(`Exercise content could not be loaded: ${error.message}`);
    return;
  }
  
  // Save login to localStorage
  const loginData = {
    email: email,
    studentId: studentNumber,
    timestamp: new Date().toISOString()
  };
  
  localStorage.setItem('precedifyLogin', JSON.stringify(loginData));
  
  // Profile configuration controls activity behavior; login only establishes
  // the student identity and starts or resumes the shared session.
  state.userEmail = email;
  state.userStudentId = studentNumber;
  state.mode = 'practice';
  // startSession() prepares every enabled profile while leaving selection to
  // the student. No profile or category is chosen implicitly.
  
  // Animate transition
  const loginOverlay = document.getElementById('loginOverlay');
  loginOverlay.style.opacity = '0';
  loginOverlay.style.pointerEvents = 'none';
  
  setTimeout(() => {
    // Each mode has its own deployment-controlled persistence switch and
    // storage key. A disabled mode always starts fresh without deleting an
    // existing snapshot from the other mode.
    if (tryResumeSession('session',email)) {
      return;
    }
    startSession();
  }, 300);
}

function showLoginError(message) {
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function logout() {
  if(typeof closeAccountMenu==='function') closeAccountMenu();
  if(typeof closeTimerManagementModal==='function') closeTimerManagementModal();
  stopTimer();
  localStorage.removeItem('precedifyLogin');
  state.screen = 'login';
  state.userEmail = null;
  state.userStudentId = null;
  
  // Clear form
  document.getElementById('emailInput').value = '';
  document.getElementById('studentNumInput').value = '';
  document.getElementById('loginError').textContent = '';
  
  // Undo the inline fade-out applied by handleLogin() when this same
  // overlay element was last dismissed — without this, render() sets
  // display:flex again but the overlay stays invisible/unclickable at
  // opacity:0, producing a blank screen until a full page refresh clears
  // the inline styles.
  const loginOverlay = document.getElementById('loginOverlay');
  loginOverlay.style.opacity = '';
  loginOverlay.style.pointerEvents = '';
  
  render();
}

// ============================================================================
// SETTINGS MODAL FUNCTIONS
// ============================================================================

function openSettingsModal() {
  document.getElementById('settingsModal').style.display = 'flex';
  document.getElementById('settingsOverlay').style.display = 'block';

  // Re-read browser settings in local-configurable deployments. The loader
  // returns state.js defaults instead when policy is state-only.
  loadPersistedAppSettings();

  // Activity behavior and the shared timer are authored in Profile Designer.
  // This modal now contains device data-management actions only.
  const modeInput=document.querySelector(`input[name="mode"][value="${appSettings.mode}"]`);
  if(modeInput)modeInput.checked=true;
  const timerInput=document.getElementById('timerInput');if(timerInput)timerInput.value=appSettings.timerMinutes;
  const exam=appSettings.exam;
  const practice=appSettings.practice;
  const practiceInteractionMode=document.getElementById('practiceInteractionMode');
  if(practiceInteractionMode) practiceInteractionMode.value=practice.interactionMode;
  const interactionMode=document.getElementById('examInteractionMode');
  if(interactionMode) interactionMode.value=exam.interactionMode;
  setManualSettingsControls('practice',practice.manualResponses);
  setManualSettingsControls('exam',exam.manualResponses);
  const setChecked=(id,value)=>{const el=document.getElementById(id);if(el)el.checked=!!value;};
  setChecked('examAllowUndo',exam.allowUndo);
  setChecked('examAllowReviewFlags',exam.allowReviewFlags);
  setChecked('examShowNeutralGuidance',exam.showNeutralGuidance);
  setChecked('examShowScoresDuringExam',exam.showScoresDuringExam);
  const release=document.getElementById('examFeedbackRelease');
  if(release) release.value=exam.feedbackRelease;
  
  // Show/hide timer section based on mode
  const timerSection = document.getElementById('timerSection');
  const practiceSection=document.getElementById('practicePolicySection');
  if (appSettings.mode === 'exam') {
    if(timerSection)timerSection.style.display = 'block';
    if(practiceSection) practiceSection.style.display='none';
  } else {
    if(timerSection)timerSection.style.display = 'none';
    if(practiceSection) practiceSection.style.display='block';
  }

  const stateOnly=typeof settingsAreStateOnly==='function'&&settingsAreStateOnly();
  const fields=document.getElementById('settingsConfigFields');
  const notice=document.getElementById('settingsPolicyNotice');
  const saveButton=document.getElementById('saveSettingsBtn');
  if(fields) fields.disabled=stateOnly;
  if(notice) notice.style.display=stateOnly?'flex':'none';
  if(saveButton){
    saveButton.disabled=stateOnly;
    saveButton.textContent=stateOnly?'Locked':'Save';
  }

  document.querySelectorAll('.danger-result').forEach(el=>{el.style.display='none';});
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
  document.getElementById('settingsOverlay').style.display = 'none';
}

function handleModeChange() {
  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  const timerSection = document.getElementById('timerSection');
  const practiceSection=document.getElementById('practicePolicySection');
  
  if (selectedMode === 'exam') {
    timerSection.style.display = 'block';
    if(practiceSection) practiceSection.style.display='none';
  } else {
    timerSection.style.display = 'none';
    if(practiceSection) practiceSection.style.display='block';
  }
}

function setManualSettingsControls(scope,settings){
  settings=settings||{mode:'profile',namedValueRate:50,operatorRate:50};
  const mode=document.getElementById(`${scope}ManualMode`);
  const named=document.getElementById(`${scope}NamedValueRate`);
  const operator=document.getElementById(`${scope}OperatorRate`);
  if(mode) mode.value=settings.mode||'profile';
  if(named) named.value=settings.namedValueRate;
  if(operator) operator.value=settings.operatorRate;
  handleManualModeChange(scope);
}

function handleManualModeChange(scope){
  const mode=document.getElementById(`${scope}ManualMode`);
  const rates=document.getElementById(`${scope}ManualRates`);
  if(rates) rates.style.display=mode&&mode.value==='custom'?'grid':'none';
}

function readManualSettingsControls(scope){
  const mode=(document.getElementById(`${scope}ManualMode`)||{}).value;
  const rate=id=>Math.max(0,Math.min(100,Math.round(Number((document.getElementById(id)||{}).value)||0)));
  return {mode:mode==='off'||mode==='custom'?mode:'profile',
    namedValueRate:rate(`${scope}NamedValueRate`),operatorRate:rate(`${scope}OperatorRate`)};
}

function validateTimerInput(input) {
  let value = parseInt(input.value, 10);
  
  if (isNaN(value)) {
    input.classList.add('invalid');
    return false;
  }
  
  if (value < 1) {
    input.value = '1';
    input.classList.remove('invalid');
  } else if (value > 999) {
    input.value = '999';
    input.classList.remove('invalid');
  } else {
    input.classList.remove('invalid');
  }
  
  return true;
}

function saveSettings() {
  if(typeof settingsAreStateOnly==='function'&&settingsAreStateOnly()) return;
  const selected=document.querySelector('input[name="mode"]:checked');
  if(!selected){closeSettingsModal();return;}
  const selectedMode = selected.value;
  const timerInput = document.getElementById('timerInput');
  const timerValue = parseInt(timerInput.value, 10);
  
  // Validate timer input
  if (selectedMode === 'exam') {
    if (isNaN(timerValue) || timerValue < 1 || timerValue > 999) {
      alert('Please enter a valid timer value between 1 and 999 minutes.');
      return;
    }
    appSettings.timerMinutes = timerValue;
  }
  
  appSettings.mode = selectedMode;
  appSettings.practice={
    interactionMode:(document.getElementById('practiceInteractionMode')||{}).value==='strict-sequence'
      ?'strict-sequence':'guided',
    manualResponses:readManualSettingsControls('practice')
  };
  const checked=id=>{const el=document.getElementById(id);return !!(el&&el.checked);};
  appSettings.exam={
    interactionMode:(document.getElementById('examInteractionMode')||{}).value==='strict-sequence'
      ?'strict-sequence':'guided',
    allowUndo:checked('examAllowUndo'),
    allowReviewFlags:checked('examAllowReviewFlags'),
    showNeutralGuidance:checked('examShowNeutralGuidance'),
    showScoresDuringExam:checked('examShowScoresDuringExam'),
    feedbackRelease:(document.getElementById('examFeedbackRelease')||{}).value==='never'?'never':'after-timeout',
    lockItemAfterCheck:true,autoLockOnTimeout:true,showCorrectSolution:false,
    manualResponses:readManualSettingsControls('exam')
  };
  // Persist immediately — this global setting is the single source of
  // truth every subsequent refresh/login checks before resuming exam
  // progress (see main.js / login.js).
  savePersistedAppSettings();
  
  closeSettingsModal();
}

// Manual "clear everyone's exam progress" action — see
// clearAllExamProgressEverywhere's own comment for why this is the only
// sanctioned way that data disappears outside a timer expiring on its own.
function handleClearAllExamProgress() {
  const confirmed = confirm('This will permanently delete every student\'s saved session progress on this device. This cannot be undone. Continue?');
  if (!confirmed) return;
  const count = clearAllExamProgressEverywhere();
  const resultEl = document.getElementById('clearExamProgressResult');
  if (resultEl) {
    resultEl.textContent = count > 0
      ? `Cleared ${count} saved exam session${count===1?'':'s'}.`
      : 'No saved session progress was found.';
    resultEl.style.display = 'block';
  }
}

function showDangerResult(id,message){
  const resultEl=document.getElementById(id);
  if(resultEl){resultEl.textContent=message;resultEl.style.display='block';}
}

function handleResetApplicationSettings(){
  if(!confirm('Reset device settings to their built-in defaults? Student session progress will not be deleted.')) return;
  resetPersistedAppSettings();
  openSettingsModal();
  showDangerResult('resetSettingsResult','Application settings restored to defaults. Student attempts were preserved.');
}

function handleClearAllLocalData(){
  if(!confirm('Delete application settings, saved login information, and every student exam attempt on this device? This cannot be undone.')) return;
  const count=clearAllPrecedifyLocalData();
  openSettingsModal();
  showDangerResult('clearAllDataResult',`Cleared ${count} stored application record${count===1?'':'s'}.`);
}

// ============================================================================
// TIMER FUNCTIONS (EXAM MODE) — Session-level timer for all items
// ============================================================================
// The timer counts down from a fixed duration (set in appSettings.timerMinutes)
// and applies to the entire exam session across ALL items, not individual items.
// Timer starts when startSession() is called and continues until time runs
// out. Expiration leaves the session visible for category Score/QR review,
// while every answer mutation is locked.
// ============================================================================

function timerResetPinFormatFromTimestamp(timestamp){
  let seed=Math.trunc(Number(timestamp)||0)|0;
  seed=Math.imul(seed^(seed>>>16),0x45d9f3b);
  seed=Math.imul(seed^(seed>>>16),0x45d9f3b);
  seed^=seed>>>16;
  return (seed>>>0)%2===0?'YYMMDD':'MMDDYY';
}

// Chosen once per page load from the local machine timestamp. Deliberately
// excluded from saved session state so a refresh performs a new format draw.
const TIMER_RESET_PIN_FORMAT=timerResetPinFormatFromTimestamp(Date.now());

function timerResetPinForDate(date,format){
  const pad=value=>String(value).padStart(2,'0');
  const year=pad(date.getFullYear()%100),month=pad(date.getMonth()+1),day=pad(date.getDate());
  return format==='MMDDYY'?month+day+year:year+month+day;
}

let timerManagementState={step:'pin',operation:'reset',resultSeconds:null,liveInterval:null};

function timerManagementMaximumSeconds(){
  return Math.max(60,Math.round(Number(ACTIVE_PROFILE_SESSION.timing.minutes)||1)*60);
}

function timerManagementCurrentSeconds(){
  if(state.examExpired)return 0;
  if(Number.isFinite(examEndTimestamp))return Math.max(0,Math.round((examEndTimestamp-Date.now())/1000));
  return Math.max(0,Math.round(timeRemaining||0));
}

function timerManagementFormatTime(seconds){
  seconds=Math.max(0,Math.round(Number(seconds)||0));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}

function timerManagementElement(id){return typeof document!=='undefined'?document.getElementById(id):null;}

function timerManagementSetError(id,message){
  const element=timerManagementElement(id);if(element)element.textContent=message||'';
}

function timerManagementProposal(){
  const current=timerManagementCurrentSeconds(),maximum=timerManagementMaximumSeconds();
  const operation=timerManagementState.operation;
  if(operation==='reset')return {valid:true,current,maximum,result:maximum,amount:0,operation};
  const input=timerManagementElement('timerAdjustmentMinutes');
  const amount=Number(input&&input.value);
  if(!Number.isInteger(amount)||amount<1)
    return {valid:false,current,maximum,result:current,amount,operation,error:'Enter a whole number of at least 1 minute.'};
  if(operation==='add'){
    const result=current+amount*60;
    if(result>maximum)return {valid:false,current,maximum,result:current,amount,operation,
      error:'The resulting time cannot exceed the original maximum allowance.'};
    return {valid:true,current,maximum,result,amount,operation};
  }
  if(state.examExpired)return {valid:false,current,maximum,result:current,amount,operation,
    error:'Time cannot be reduced after the session has expired.'};
  const result=current-amount*60;
  if(result<60)return {valid:false,current,maximum,result:current,amount,operation,
    error:'The timer must retain at least 1 minute.'};
  return {valid:true,current,maximum,result,amount,operation};
}

function timerManagementOperationCopy(proposal){
  if(proposal.operation==='add')return {title:`Add ${proposal.amount} minute${proposal.amount===1?'':'s'}`,
    message:'The adjustment will be added to the live remaining time.'};
  if(proposal.operation==='reduce')return {title:`Reduce by ${proposal.amount} minute${proposal.amount===1?'':'s'}`,
    message:'The adjustment will be subtracted from the live remaining time.'};
  return {title:'Reset to full time',message:'The timer will return to the original maximum allowance.'};
}

function updateTimerManagementPreview(){
  const proposal=timerManagementProposal();
  const current=timerManagementElement('timerManagementCurrent'),maximum=timerManagementElement('timerManagementMaximum');
  const result=timerManagementElement('timerManagementResult'),next=timerManagementElement('timerManagementNext');
  if(current)current.textContent=timerManagementFormatTime(proposal.current);
  if(maximum)maximum.textContent=timerManagementFormatTime(proposal.maximum);
  if(result)result.textContent=timerManagementFormatTime(proposal.valid?proposal.result:proposal.current);
  timerManagementSetError('timerManagementOperationError',proposal.valid?'':proposal.error);
  const add=timerManagementElement('timerOperationAdd'),reduce=timerManagementElement('timerOperationReduce');
  if(add)add.disabled=proposal.current>=proposal.maximum;
  if(reduce)reduce.disabled=state.examExpired||proposal.current<=60;
  if(timerManagementState.step==='operation'&&next)next.disabled=!proposal.valid;
  if(timerManagementState.step==='confirm'){
    const copy=timerManagementOperationCopy(proposal);
    const title=timerManagementElement('timerConfirmationTitle'),message=timerManagementElement('timerConfirmationMessage');
    const before=timerManagementElement('timerConfirmationCurrent'),after=timerManagementElement('timerConfirmationResult');
    if(title)title.textContent=copy.title;if(message)message.textContent=copy.message;
    if(before)before.textContent=timerManagementFormatTime(proposal.current);
    if(after)after.textContent=timerManagementFormatTime(proposal.valid?proposal.result:proposal.current);
    if(next)next.disabled=!proposal.valid;
  }
  timerManagementState.resultSeconds=proposal.valid?proposal.result:null;
  return proposal;
}

function timerManagementShowStep(step){
  timerManagementState.step=step;
  document.querySelectorAll('[data-timer-step]').forEach(section=>{section.hidden=section.dataset.timerStep!==step;});
  const order=['pin','operation','confirm'],position=order.indexOf(step);
  document.querySelectorAll('[data-timer-progress]').forEach(marker=>{
    const markerPosition=order.indexOf(marker.dataset.timerProgress);
    marker.classList.toggle('active',markerPosition===position);marker.classList.toggle('complete',markerPosition<position);
  });
  const back=timerManagementElement('timerManagementBack'),next=timerManagementElement('timerManagementNext');
  if(back)back.hidden=step==='pin';
  if(next){next.disabled=false;next.textContent=step==='confirm'?'Apply timer change':step==='operation'?'Review change':'Continue';}
  if(step==='operation'||step==='confirm')updateTimerManagementPreview();
  const focusTarget=step==='pin'?timerManagementElement('timerManagementPin'):
    step==='operation'?document.querySelector('[data-timer-operation].selected'):next;
  if(focusTarget)setTimeout(()=>focusTarget.focus(),0);
}

function openTimerManagementModal(){
  if(!sessionTimingEnabled()||!sessionTimerResetAllowed())return false;
  if(state.examExpired&&!state.timeoutCheckpointReady)return false;
  const modal=timerManagementElement('timerManagementModal'),overlay=timerManagementElement('timerManagementOverlay');
  if(!modal||!overlay)return false;
  timerManagementState.operation='reset';timerManagementState.resultSeconds=null;
  const pin=timerManagementElement('timerManagementPin'),amount=timerManagementElement('timerAdjustmentMinutes');
  if(pin){pin.value='';pin.type='password';pin.setAttribute('aria-invalid','false');}
  const visibility=timerManagementElement('timerPinVisibilityBtn');
  if(visibility){visibility.setAttribute('aria-pressed','false');visibility.setAttribute('aria-label','Show PIN');
    const icon=visibility.querySelector('i');if(icon)icon.className='fa-solid fa-eye';}
  if(amount)amount.value='1';
  timerManagementSetError('timerManagementPinError','');timerManagementSetError('timerManagementOperationError','');
  selectTimerOperation('reset',false);timerManagementShowStep('pin');
  modal.style.display='flex';overlay.style.display='block';
  if(timerManagementState.liveInterval!==null)clearInterval(timerManagementState.liveInterval);
  timerManagementState.liveInterval=setInterval(()=>{
    if(timerManagementState.step!=='pin')updateTimerManagementPreview();
  },1000);
  setTimeout(()=>pin&&pin.focus(),0);
  return true;
}

function closeTimerManagementModal(){
  const modal=timerManagementElement('timerManagementModal'),overlay=timerManagementElement('timerManagementOverlay');
  if(modal)modal.style.display='none';if(overlay)overlay.style.display='none';
  if(timerManagementState.liveInterval!==null){clearInterval(timerManagementState.liveInterval);timerManagementState.liveInterval=null;}
  const pin=timerManagementElement('timerManagementPin');if(pin)pin.value='';
}

function handleTimerPinInput(event){
  event.target.value=event.target.value.replace(/\D/g,'').slice(0,6);
  event.target.setAttribute('aria-invalid','false');timerManagementSetError('timerManagementPinError','');
}

function toggleTimerPinVisibility(){
  const input=timerManagementElement('timerManagementPin'),button=timerManagementElement('timerPinVisibilityBtn');
  if(!input||!button)return;const reveal=input.type==='password';input.type=reveal?'text':'password';
  button.setAttribute('aria-pressed',String(reveal));button.setAttribute('aria-label',reveal?'Hide PIN':'Show PIN');
  const icon=button.querySelector('i');if(icon)icon.className=`fa-solid ${reveal?'fa-eye-slash':'fa-eye'}`;input.focus();
}

function selectTimerOperation(operation,focus=true){
  const button=document.querySelector(`[data-timer-operation="${operation}"]`);
  if(!button||button.disabled)return false;
  timerManagementState.operation=operation;
  document.querySelectorAll('[data-timer-operation]').forEach(candidate=>{
    const selected=candidate.dataset.timerOperation===operation;candidate.classList.toggle('selected',selected);
    candidate.setAttribute('aria-checked',String(selected));
  });
  const adjustment=timerManagementElement('timerAdjustmentField');if(adjustment)adjustment.hidden=operation==='reset';
  updateTimerManagementPreview();if(focus)button.focus();return true;
}

function timerManagementBack(){
  if(timerManagementState.step==='confirm')timerManagementShowStep('operation');
  else if(timerManagementState.step==='operation')timerManagementShowStep('pin');
}

function timerManagementNext(){
  if(timerManagementState.step==='pin'){
    const input=timerManagementElement('timerManagementPin');
    const entered=String(input&&input.value||'');
    const expected=timerResetPinForDate(new Date(),TIMER_RESET_PIN_FORMAT);
    if(!/^\d{6}$/.test(entered)||entered!==expected){
      if(input)input.setAttribute('aria-invalid','true');
      timerManagementSetError('timerManagementPinError','The teacher PIN is incorrect.');
      if(input){input.select();input.focus();}return false;
    }
    timerManagementShowStep('operation');return true;
  }
  if(timerManagementState.step==='operation'){
    const proposal=updateTimerManagementPreview();if(!proposal.valid)return false;
    timerManagementShowStep('confirm');return true;
  }
  return applyTimerManagementChange();
}

function applyTimerManagementChange(){
  const proposal=timerManagementProposal();if(!proposal.valid)return false;
  const wasExpired=state.examExpired===true;
  if(wasExpired&&!restoreSessionTimeoutCheckpoints())return false;
  if(timerIntervalId!==null){clearInterval(timerIntervalId);timerIntervalId=null;}
  state.examExpired=false;state.examExpiredAt=null;state.timeoutCheckpointReady=false;
  state.examTimerMinutes=ACTIVE_PROFILE_SESSION.timing.minutes;
  closeTimerManagementModal();startTimer(proposal.result);render();return true;
}

function startTimer(resumeSeconds) {
  if (!sessionTimingEnabled()) {
    return;
  }
  // Exam time is allotted once for the ENTIRE session across every
  // profile, not per profile — if a timer is already running, do nothing
  // rather than reinitialize it. This is a defensive guard on top of the
  // fix in selectProfile(): even if something else ever calls startTimer()
  // again mid-session, the countdown already in flight is never clobbered.
  if (timerIntervalId !== null) {
    return;
  }

  if (typeof resumeSeconds === 'number' && resumeSeconds >= 0) {
    timeRemaining = resumeSeconds;
    examEndTimestamp = Date.now() + timeRemaining * 1000;
  } else {
    // Initialize timer from the configured duration (appSettings.timerMinutes)
    timeRemaining = (state.examTimerMinutes || ACTIVE_PROFILE_SESSION.timing.minutes) * 60;
    examEndTimestamp = Date.now() + timeRemaining * 1000;
  }
  // Persist the deadline immediately, rather than waiting for the next
  // render() (which won't happen until the student's next action, or a
  // full second later) — otherwise an immediate refresh right after
  // starting/resuming an exam would save with no deadline yet.
  if (typeof saveExamProgress === 'function') saveExamProgress();

  const timerContainer = document.getElementById('timerContainer');
  if (timerContainer) timerContainer.style.display = 'flex';

  updateTimerDisplay();

  let tickCount = 0;
  timerIntervalId = setInterval(() => {
    // Recompute from the fixed deadline each tick to avoid drift
    timeRemaining = Math.max(0, Math.round((examEndTimestamp - Date.now()) / 1000));
    updateTimerDisplay();

    tickCount++;
    if (timeRemaining <= 0) {
      clearInterval(timerIntervalId);
      handleTimerExpired();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const timerDisplay = document.getElementById('timerDisplay');
  if (timerDisplay) {
    timerDisplay.textContent = display;
    timerDisplay.classList.remove('warning', 'critical');
    
    if (timeRemaining <= 60) {
      timerDisplay.classList.add('critical');
    } else if (timeRemaining <= 300) {
      timerDisplay.classList.add('warning');
    }
  }
}

function stopTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  const timerContainer = document.getElementById('timerContainer');
  if (timerContainer) timerContainer.style.display = 'none';
}

function resetSessionTimer() {
  return openTimerManagementModal();
}

function handleTimerExpired() {
  if(!expireExam()) return;
  alert('Time is up. Your current work has been scored and all activities are now locked.');
}

// ============================================================================
// SIDEBAR NAVIGATION (Profile Selection)
// ============================================================================

function toggleSidebar() {
  const sidebar = document.getElementById('profileSidebar');
  
  if (window.innerWidth <= 768) {
    // Mobile: toggle overlay
    if (sidebar.classList.contains('sidebar-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  } else {
    // Desktop: toggle collapse
    if (sidebar.classList.contains('sidebar-collapsed')) {
      expandDesktopSidebar();
    } else {
      collapseDesktopSidebar();
    }
  }
}

function openSidebar() {
  const sidebar = document.getElementById('profileSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.add('sidebar-open');
  backdrop.classList.add('show');
  if(typeof syncSidebarShellState==='function') syncSidebarShellState();
}

function closeSidebar() {
  const sidebar = document.getElementById('profileSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.remove('sidebar-open');
  backdrop.classList.remove('show');
  if(typeof syncSidebarShellState==='function') syncSidebarShellState();
}

function closeSidebarIfMobile() {
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

function collapseDesktopSidebar() {
  const sidebar = document.getElementById('profileSidebar');
  sidebar.classList.add('sidebar-collapsed');
  if(typeof closeAccountMenu==='function') closeAccountMenu();
  if(typeof syncSidebarShellState==='function') syncSidebarShellState();
}

function expandDesktopSidebar() {
  const sidebar = document.getElementById('profileSidebar');
  sidebar.classList.remove('sidebar-collapsed');
  if(typeof syncSidebarShellState==='function') syncSidebarShellState();
}

function selectProfile(profileId) {
  if(!profileIsEnabled(profileId)) return;
  // Update active state in sidebar
  document.querySelectorAll('.profile-nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`[data-profile-id="${profileId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  closeSidebarIfMobile();

  // Remember exactly which item the OUTGOING profile was on before we
  // switch away from it, so navigating back to it later (via the sidebar)
  // restores that same item instead of resetting to Item 1.
  if (state.profileId) {
    state.itemIndexByProfile[state.profileId] = state.itemIndex;
  }

  // Set profile ID
  state.profileId = profileId;
  syncActiveProfileBehavior();
  openCategoryIds.add(currentProfile().categoryId);

  // startSession() already ran exactly once at login and generated every
  // profile's items up front (see handleLogin) — a profile switch never
  // regenerates items or touches the timer. Deliberately NOT calling
  // startSession() here: the old "first selection" fallback this used to
  // have was legacy from before login always ran it, and re-invoking
  // startSession() on a later profile switch would silently reset the
  // shared exam timer back to full duration, since exam time is allotted
  // once for the whole session across all profiles, not per profile.
  state.items = state.itemsByProfile[profileId];
  state.itemIndex = state.itemIndexByProfile[profileId] || 0;
  render();
}

// Reads the live score for one profile straight from state.itemsByProfile —
// no separate tracking to keep in sync, so it's always correct as soon as
// handleCheck() writes item.points and render() re-runs. Returns null (no
// pill shown) until at least one item in that profile has been checked.
function computeProfileScore(profileId){
  if(!examResultsVisible()) return null;
  if(!profileIsEnabled(profileId)) return null;
  const items = state.itemsByProfile && state.itemsByProfile[profileId];
  if(!items || items.length===0) return null;
  const anyChecked = items.some(it => it.checked);
  if(!anyChecked) return null;
  const earned = roundPoints(items.reduce((sum, it) => sum + (it.points || 0), 0)); // roundPoints() (state.js) — strips floating-point noise from summing decimal .points values
  // pointsPerItem is per-profile now (generator.js's PROFILES), not one
  // shared constant — look up THIS profile's own budget.
  const profile = PROFILES.find(p=>p.id===profileId);
  const max = items.reduce((sum,item)=>sum+itemMaximumPoints(item,profile),0);
  return {earned, max};
}

const openCategoryIds = new Set();
function populateProfileSidebar() {
  const profileList = document.getElementById('profileList');
  profileList.innerHTML = '';

  enabledCategories().forEach(category=>{
    const profiles=profilesForCategory(category.id);
    if(!profiles.length) return;
    const categoryOpen=openCategoryIds.has(category.id);
    const li=document.createElement('li');
    li.className='category-nav-item'+(categoryOpen?' expanded':'');
    const heading=document.createElement('div');
    heading.className='category-nav-heading';
    const expand=document.createElement('button');
    expand.type='button';
    expand.className='category-expand-btn';
    expand.setAttribute('aria-expanded',String(categoryOpen));
    expand.setAttribute('aria-controls',`category-profiles-${category.id}`);
    expand.setAttribute('aria-label',`${categoryOpen?'Collapse':'Expand'} ${category.name}`);
    const chevron=document.createElement('i');
    chevron.className=`fa-solid fa-chevron-${categoryOpen?'down':'right'}`;
    chevron.setAttribute('aria-hidden','true');
    expand.appendChild(chevron);
    const name=document.createElement('span');
    name.className='category-nav-label';
    name.textContent=category.name;
    expand.appendChild(name);
    const categoryScore=examResultsVisible()?computeCategoryScore(category.id):null;
    if(categoryScore){
      const pill=document.createElement('span');
      pill.className='profile-score-pill';
      pill.textContent=`${categoryScore.earned}/${categoryScore.max}`;
      expand.appendChild(pill);
    }
    heading.appendChild(expand);
    if(examResultsVisible()){
      const scoreLink=document.createElement('button');
      scoreLink.type='button';
      scoreLink.className='category-score-link';
      scoreLink.title=`View ${category.name} results and QR code`;
      scoreLink.setAttribute('aria-label',`View ${category.name} score summary and QR code`);
      const scoreIcon=document.createElement('i');
      scoreIcon.className='fa-solid fa-qrcode';
      scoreIcon.setAttribute('aria-hidden','true');
      scoreLink.appendChild(scoreIcon);
      scoreLink.onclick=()=>openScoreSummaryModal(category.id);
      heading.appendChild(scoreLink);
    }
    const children=document.createElement('ul');
    children.id=`category-profiles-${category.id}`;
    children.className='category-profile-list';
    children.hidden=!categoryOpen;
    expand.onclick=()=>{
      if(openCategoryIds.has(category.id)) openCategoryIds.delete(category.id);
      else openCategoryIds.add(category.id);
      children.hidden=!openCategoryIds.has(category.id);
      li.classList.toggle('expanded',!children.hidden);
      expand.setAttribute('aria-expanded',String(!children.hidden));
      expand.setAttribute('aria-label',`${children.hidden?'Expand':'Collapse'} ${category.name}`);
      chevron.className=`fa-solid fa-chevron-${children.hidden?'right':'down'}`;
    };
    profiles.forEach(profile=>{
      const row=document.createElement('li');
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='profile-nav-btn'+(state.profileId===profile.id?' active':'');
      btn.setAttribute('data-profile-id',profile.id);
      btn.onclick=()=>selectProfile(profile.id);
      const title=document.createElement('span');
      title.className='profile-nav-name';
      title.textContent=profile.name;
      const score=computeProfileScore(profile.id);
      if(score){
        const pill=document.createElement('span');
        pill.className='profile-score-pill';
        pill.textContent=`${score.earned}/${score.max}`;
        title.appendChild(pill);
      }
      const desc=document.createElement('span');
      desc.className='profile-nav-desc';
      desc.textContent=profile.description;
      btn.appendChild(title);btn.appendChild(desc);row.appendChild(btn);children.appendChild(row);
    });
    li.appendChild(heading);li.appendChild(children);profileList.appendChild(li);
  });
}

// ============================================================================
// ITEM PAGINATION (Free navigation between seeded items)
// ============================================================================

const ITEM_PAGE_WINDOW_SIZE = DEFAULT_APP_SETTINGS.shell.pagination.windowSize;

function buildItemPageWindow(total, current) {
  if (total <= ITEM_PAGE_WINDOW_SIZE) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  let start = current - Math.floor(ITEM_PAGE_WINDOW_SIZE / 2);
  start = Math.max(1, Math.min(start, total - ITEM_PAGE_WINDOW_SIZE + 1));
  return Array.from({ length: ITEM_PAGE_WINDOW_SIZE }, (_, i) => start + i);
}

// Derives a page button's status purely from the item's own live fields —
// no separate tracking needed, so it's always in sync:
//   'correct'   — checked, and the final derived value matched
//   'incorrect' — checked, and it didn't match
//   'attempted' — not checked yet, but the student has made at least one move
//   ''          — untouched
function itemPageStatus(item){
  if (!item) return '';
  if(!state.examExpired&&!activeProfileBehavior().showScores){
    if(item.checked) return 'locked';
    if(item.flagged) return 'flagged';
    if(itemHasAttempt(item)) return 'attempted';
    return '';
  }
  if (item.checked) return item.wasCorrectFinal ? 'correct' : 'incorrect';
  if(itemHasAttempt(item)) return 'attempted';
  return '';
}
const ITEM_STATUS_CLASS = {correct:'item-page-correct',incorrect:'item-page-incorrect',attempted:'item-page-attempted',locked:'item-page-locked',flagged:'item-page-flagged'};
const ITEM_STATUS_LABEL = {correct:', correct',incorrect:', incorrect',attempted:', in progress',locked:', answer locked',flagged:', flagged for review','':', not yet answered'};
const ITEM_STATUS_MARK = {correct:' \u2713',incorrect:' \u2715',attempted:' \u2022',locked:' \uD83D\uDD12',flagged:' \u2691','':''};

function buildItemPaginationHtml(total, currentIdx, items) {
  if (total <= 1) return '';
  const current = currentIdx + 1; // 1-based for display

  const numbersHtml = buildItemPageWindow(total, current).map(p => {
    const isActive = p === current;
    const status = itemPageStatus(items[p - 1]);
    const statusCls = ITEM_STATUS_CLASS[status] ? ' ' + ITEM_STATUS_CLASS[status] : '';
    return '<button type="button" class="item-page-btn' + (isActive ? ' active' : '') + statusCls + '" data-page="' + (p - 1) + '"' +
        (isActive ? ' aria-current="true"' : '') + ' aria-label="Go to item ' + p + ITEM_STATUS_LABEL[status] + '">' + p + '</button>';
  }).join('');

  let jumpOptionsHtml = '';
  for (let i = 0; i < total; i++) {
    const status = itemPageStatus(items[i]);
    jumpOptionsHtml += '<option value="' + i + '"' + (i === currentIdx ? ' selected' : '') + '>Item ' + (i + 1) + ITEM_STATUS_MARK[status] + '</option>';
  }

  const atFirst = currentIdx === 0;
  const atLast = currentIdx === total - 1;

  return (
    '<nav class="item-pagination" aria-label="Item navigation">' +
      '<button type="button" class="item-page-nav-btn item-page-first" data-page="0"' + (atFirst ? ' disabled' : '') + ' aria-label="First item"><i class="fa-solid fa-angles-left" aria-hidden="true"></i></button>' +
      '<button type="button" class="item-page-nav-btn item-page-prev" data-page="' + (currentIdx - 1) + '"' + (atFirst ? ' disabled' : '') + ' aria-label="Previous item"><i class="fa-solid fa-angle-left" aria-hidden="true"></i></button>' +
      '<div class="item-page-numbers">' + numbersHtml + '</div>' +
      '<div class="item-page-mobile-indicator">' +
        '<select class="item-page-jump-select" aria-label="Jump to item">' + jumpOptionsHtml + '</select>' +
        '<span class="item-page-mobile-total">of ' + total + '</span>' +
      '</div>' +
      '<button type="button" class="item-page-nav-btn item-page-next" data-page="' + (currentIdx + 1) + '"' + (atLast ? ' disabled' : '') + ' aria-label="Next item"><i class="fa-solid fa-angle-right" aria-hidden="true"></i></button>' +
      '<button type="button" class="item-page-nav-btn item-page-last" data-page="' + (total - 1) + '"' + (atLast ? ' disabled' : '') + ' aria-label="Last item"><i class="fa-solid fa-angles-right" aria-hidden="true"></i></button>' +
    '</nav>'
  );
}

function renderItemPaginationBar() {
  const container = document.getElementById('itemPaginationContainer');
  if (!container) return;
  const total = state.items.length;
  const current = state.itemIndex;
  container.innerHTML = buildItemPaginationHtml(total, current, state.items);
  
  // Show pagination if in session and have multiple items
  if (state.screen === 'session' && total > 1) {
    container.style.display = 'flex';
    attachItemPaginationHandlers();
  } else {
    container.style.display = 'none';
  }
}

let itemPaginationHandlerAttached = false;
function attachItemPaginationHandlers() {
  if (itemPaginationHandlerAttached) return;
  itemPaginationHandlerAttached = true;
  
  const container = document.getElementById('itemPaginationContainer');
  if (!container) return;
  
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (btn) {
      const newIndex = parseInt(btn.getAttribute('data-page'), 10);
      goToItem(newIndex);
    }
  });
  
  container.addEventListener('change', (e) => {
    if (e.target.classList.contains('item-page-jump-select')) {
      const newIndex = parseInt(e.target.value, 10);
      goToItem(newIndex);
    }
  });
}

function goToItem(index) {
  const total = state.items.length;
  const safeIndex = Math.max(0, Math.min(index, total - 1));
  state.itemIndex = safeIndex;
  render();
}

if(typeof document!=='undefined'&&typeof document.addEventListener==='function')document.addEventListener('keydown',event=>{
  const modal=timerManagementElement('timerManagementModal');
  if(!modal||modal.style.display!=='flex')return;
  if(event.key==='Escape'){event.preventDefault();closeTimerManagementModal();return;}
  if(event.key==='Enter'&&event.target.tagName!=='BUTTON'){
    event.preventDefault();timerManagementNext();return;
  }
  if(event.key!=='Tab')return;
  const focusable=[...modal.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]):not([hidden])')]
    .filter(element=>element.offsetParent!==null);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
