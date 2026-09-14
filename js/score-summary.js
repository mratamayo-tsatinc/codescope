// ============================================================================
// SCORE SUMMARY MODAL
// ----------------------------------------------------------------------------
// Purely additive, read-only reporting UI. Reads state.itemsByProfile (never
// mutates it) to show:
//   - the logged-in user + a live timestamp (ticked by live-clock.js while
//     this modal is open — see #scoreSummaryUser / #scoreSummaryClock)
//   - a grand total score (earned/max points) summed across every profile
//   - a per-profile breakdown, toggleable show/hide
// Lives in its own static modal markup in index.html (same pattern as the
// existing Settings modal) — entirely independent of render()'s #app
// rebuild, so opening/closing/toggling it never touches the session view.
// ============================================================================

// Sums earned/max points across ALL profiles, not just the current one.
// Every profile's items are generated up front at login (see startSession),
// so `max` always reflects every profile's full point budget even for a
// profile the student hasn't opened yet; `earned` only counts points from
// items that have actually been checked.
function computeGrandTotalScore(){
  let earned = 0, max = 0;
  PROFILES.forEach(p=>{
    const items = state.itemsByProfile[p.id];
    if(!items || items.length===0) return;
    // pointsPerItem is per-profile now (generator.js's PROFILES) — each
    // profile contributes against its OWN point budget, not one shared
    // constant, so the grand total honestly reflects that harder profiles
    // are worth more.
    max += items.length * p.pointsPerItem;
    earned += items.reduce((sum, it)=> sum + (it.points || 0), 0);
  });
  // roundPoints() (state.js) strips floating-point noise from summing many
  // already-rounded decimal .points values (PER_CHECK's default model
  // produces 1-decimal fractions like 0.6/1.8/2.4) — rounded once here,
  // after every profile's contribution is folded in, rather than per-profile,
  // so the noise can't re-accumulate across the outer sum.
  return {earned: roundPoints(earned), max};
}

function openScoreSummaryModal(){
  if(!examResultsVisible()) return;
  // .modal is centered via CSS display:flex + align-items/justify-content —
  // setting display:'block' here would silently defeat that centering and
  // drop the modal into the page's normal top-left flow instead.
  document.getElementById('scoreSummaryModal').style.display = 'flex';
  document.getElementById('scoreSummaryOverlay').style.display = 'block';
  renderScoreSummaryContent();
  // Encryption + QR draw is async — fire it and let the box fill in once
  // ready, same pattern as the reference app's showScoreSummaryModal.
  renderScoreSummaryQr();
}

function closeScoreSummaryModal(){
  if(scoreSummaryDownloadInProgress) return;
  document.getElementById('scoreSummaryModal').style.display = 'none';
  document.getElementById('scoreSummaryOverlay').style.display = 'none';
}

let scoreSummaryDownloadInProgress = false;

function scoreSummaryPngFilename(now){
  const pad=value=>String(value).padStart(2,'0');
  const stamp=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${DEFAULT_APP_SETTINGS.shell.scoreSummary.filenamePrefix}-${stamp}.png`;
}

function scoreSummaryCanvasBlob(canvas){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG creation returned no image data.')),'image/png');
  });
}

async function downloadScoreSummaryPng(){
  if(scoreSummaryDownloadInProgress) return;
  const modal=document.getElementById('scoreSummaryModal');
  const capture=modal&&modal.querySelector('.modal-content');
  const button=document.getElementById('scoreSummaryDownloadBtn');
  const buttonLabel=button&&button.querySelector('span');
  const status=document.getElementById('scoreSummaryDownloadStatus');
  if(!capture) return;

  scoreSummaryDownloadInProgress=true;
  if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
  if(buttonLabel) buttonLabel.textContent='Preparing…';
  if(status) status.textContent='Preparing PNG…';

  try{
    if(typeof html2canvas!=='function') throw new Error('The PNG export component is unavailable.');
    renderScoreSummaryContent();
    if(typeof tickLiveClock==='function') tickLiveClock();
    if(typeof renderScoreSummaryQr==='function') await renderScoreSummaryQr();
    if(document.fonts&&document.fonts.ready) await document.fonts.ready;

    const configuredScale=Number(DEFAULT_APP_SETTINGS.shell.scoreSummary.pngScale)||2;
    const canvas=await html2canvas(capture,{
      backgroundColor:getComputedStyle(capture).backgroundColor,
      scale:Math.max(1,configuredScale),
      useCORS:true,
      logging:false,
      onclone:clonedDocument=>{
        const clonedCapture=clonedDocument.querySelector('#scoreSummaryModal .modal-content');
        if(clonedCapture) clonedCapture.classList.add('score-summary-exporting');
      }
    });
    const blob=await scoreSummaryCanvasBlob(canvas);
    const objectUrl=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=objectUrl;
    link.download=scoreSummaryPngFilename(new Date());
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),0);
    if(status) status.textContent='PNG downloaded.';
  }catch(error){
    console.error('Score summary PNG export failed:',error);
    if(status) status.textContent='Could not download PNG. Please try again.';
  }finally{
    scoreSummaryDownloadInProgress=false;
    if(button){button.disabled=false;button.removeAttribute('aria-busy');}
    if(buttonLabel) buttonLabel.textContent='Download PNG';
  }
}

// Local UI-only toggle state for the breakdown list — deliberately not on
// `state` (state.js), since this is purely a modal display preference with
// no bearing on scoring, session progress, or persistence.
let scoreSummaryDetailsOpen = false;
function toggleScoreSummaryDetails(){
  scoreSummaryDetailsOpen = !scoreSummaryDetailsOpen;
  renderScoreSummaryContent();
}

function renderScoreSummaryContent(){
  const totalEl = document.getElementById('scoreSummaryTotal');
  if(totalEl){
    const {earned, max} = computeGrandTotalScore();
    totalEl.textContent = `${earned} / ${max}`;
  }

  const toggleBtn = document.getElementById('scoreSummaryDetailsToggle');
  if(toggleBtn) toggleBtn.textContent = scoreSummaryDetailsOpen ? 'Hide profile breakdown' : 'Show profile breakdown';

  const detailsEl = document.getElementById('scoreSummaryDetails');
  if(!detailsEl) return;
  detailsEl.style.display = scoreSummaryDetailsOpen ? 'block' : 'none';
  if(!scoreSummaryDetailsOpen) return;

  detailsEl.innerHTML = '';
  PROFILES.forEach(p=>{
    const items = state.itemsByProfile[p.id];
    const row = document.createElement('div');
    row.className = 'score-summary-row';

    const name = document.createElement('div');
    name.className = 'ssr-name';
    name.textContent = p.name;

    const value = document.createElement('div');
    value.className = 'ssr-value';
    if(!items || items.length===0){
      value.textContent = '—';
    } else {
      const max = items.length * p.pointsPerItem;
      const anyChecked = items.some(it=>it.checked);
      // roundPoints() (state.js) — see computeGrandTotalScore's comment.
      const earned = roundPoints(items.reduce((sum, it)=> sum + (it.points || 0), 0));
      const correctCount = items.filter(it=>it.wasCorrectFinal).length;
      value.textContent = anyChecked
        ? `${earned} / ${max}  ·  ${correctCount}/${items.length} correct`
        : 'Not started';
    }

    row.appendChild(name);
    row.appendChild(value);
    detailsEl.appendChild(row);
  });
}
