// ============================================================================
// JUICE / FEEL — fully additive celebratory-moment module
// ----------------------------------------------------------------------------
// Celebration is governed by one rule across every activity: a completed
// item with itemScore === 1 produces one confetti burst. The item-owned flag
// prevents rerenders, navigation, persistence restores, and deferred Exam
// feedback from replaying it. Feedback badges remain presentational and the
// session summary never generates another burst.
//
// Confetti itself never depends on any ancestor having position:relative
// (which would mean touching an existing selector in styles.css): each
// burst measures its reference element's live viewport rect and overlays a
// position:fixed layer sized to match, appended straight to document.body.
// ============================================================================
(function(){
  const root = (typeof globalThis !== 'undefined') ? globalThis : window;
  const celebrationSettings = DEFAULT_APP_SETTINGS.shell.celebrations;

  // --- confetti ---------------------------------------------------------
  // Fired across the FULL viewport (not scoped to any single container),
  // so a burst is a whole-page celebratory moment regardless of where the
  // triggering element lives on the page.
  const CONFETTI_COLORS = ['#ffa35c','#6fb7ff','#c39bff','#ffd166','#5ce1c9','#ff8fc7','#9ad068','#7aa2ff'];

  function spawnConfetti(referenceEl, opts){
    try{
      if(!celebrationSettings.enabled || !celebrationSettings.confettiEnabled) return;
      if(typeof document === 'undefined') return;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if(!vw || !vh) return;
      // Scaled up from the requested count for a denser, more energetic burst.
      const count = Math.round(((opts && opts.count) || 28) * 2.2);
      const wrap = document.createElement('div');
      wrap.className = 'juice-confetti-container';
      wrap.style.left = '0';
      wrap.style.top = '0';
      wrap.style.width = vw + 'px';
      wrap.style.height = vh + 'px';
      for(let i=0;i<count;i++){
        const piece = document.createElement('span');
        piece.className = 'juice-confetti-piece';
        const spreadX = (Math.random()*2 - 1) * 320;      // px horizontal drift
        const fallY = vh * (0.55 + Math.random()*0.75);     // px downward travel, viewport-relative
        const rot = (Math.random()*2 - 1) * 900;            // deg spin
        const delay = Math.random()*260;                     // ms
        const dur = 1500 + Math.random()*1200;                // ms
        const size = 5 + Math.random()*7;                     // px, varied piece size
        piece.style.setProperty('--jc-x', spreadX.toFixed(1)+'px');
        piece.style.setProperty('--jc-y', fallY.toFixed(1)+'px');
        piece.style.setProperty('--jc-rot', rot.toFixed(0)+'deg');
        piece.style.left = (Math.random()*100) + '%';
        piece.style.top = '-' + (Math.random()*16) + 'px';
        piece.style.width = size + 'px';
        piece.style.height = (size*1.7) + 'px';
        if(Math.random() < 0.3) piece.style.borderRadius = '50%'; // some pieces round instead of oblong
        piece.style.animationDelay = delay+'ms';
        piece.style.animationDuration = dur+'ms';
        piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        wrap.appendChild(piece);
      }
      document.body.appendChild(wrap);
      setTimeout(()=>{ try{ wrap.remove(); }catch(e){} }, 3000);
    }catch(e){ /* purely decorative — never let this surface an error */ }
  }

  // One celebration source for every activity. Scoring has already finished
  // when this is called, so itemScore is the shared definition of a perfect
  // answer for Trace, Simulate, Order, Bug Catcher, and token activities.
  // The item-owned flag prevents feedback rerenders, navigation, persistence
  // restores, and deferred Exam feedback from replaying the burst.
  function celebratePerfectItem(item,referenceEl){
    try{
      if(!item||!item.checked||item.wasCorrectFinal!==true||item._juicePerfectPlayed)return false;
      const ratio=Number(item.itemScore);
      if(!Number.isFinite(ratio)||Math.abs(ratio-1)>1e-9)return false;
      item._juicePerfectPlayed=true;
      spawnConfetti(referenceEl||document.body,{count:celebrationSettings.perfectItemCount});
      return true;
    }catch(e){return false;}
  }

  // --- per-item celebration ----------------------------------------------
  // Called once, right after render-session.js appends the feedback card
  // (fbEl) to the live DOM. Returns a DOM node of badges to append into
  // that same card, or null if there's nothing new to celebrate.
  function renderItemCelebration(item, fbEl){
    try{
      if(!celebrationSettings.enabled) return null;
      if(!item || !item.checked || !fbEl || typeof h !== 'function') return null;
      const badges = [];

      // First fully-correct item of the session. Session order is strictly
      // forward (state.itemIndex only ever increments — see handleNextItem
      // in state.js), so "every earlier item wasn't correct" is a reliable
      // definition of "first" without needing any extra tracking.
      const idx = (typeof state==='object' && state && Array.isArray(state.items)) ? state.items.indexOf(item) : -1;
      const isFirstCorrectSoFar = !!item.wasCorrectFinal && idx >= 0 &&
        state.items.slice(0, idx).every(it => !it.wasCorrectFinal);
      if(isFirstCorrectSoFar && !item._juiceFirstCorrectPlayed){
        item._juiceFirstCorrectPlayed = true;
        badges.push(h('span',{}, h('i',{class:'fa-solid fa-champagne-glasses'}), ' First one down!'));
      }

      // Perfect item score (100%, from whichever ITEM_SCORE_MODELS policy
      // is configured — see state.js's SCORING_CONFIG). Reusing itemScore
      // rather than re-deriving it keeps this in lockstep with whatever
      // scoring policy is active, without this file needing to know it.
      if(item.itemScore === 1 && !item._juicePerfectBadgeShown){
        item._juicePerfectBadgeShown = true;
        badges.push(h('span',{}, h('i',{class:'fa-solid fa-star'}),
          item.activityKind ? ' Perfect — every required response correct' : ' Perfect — every step in order'));
      }

      if(badges.length === 0) return null;
      return h('div',{class:'juice-celebration'}, ...badges.map(content => h('span',{class:'juice-badge'}, content)));
    }catch(e){ return null; }
  }

  function celebrateProgramCompletion(item,referenceEl){
    celebratePerfectItem(item,referenceEl);
  }

  // --- session-level celebration -------------------------------------------
  // Called once from render-done.js, after the summary card is appended to
  // the live DOM. referenceEl is whichever element the confetti should
  // visually center over (the summary hero, ideally).
  function renderSessionCelebration(referenceEl){
    // Confetti is intentionally item-scoped. The completion screen may still
    // render its summary, but it never creates an additional session burst.
    return false;
  }

  root.renderItemCelebration = renderItemCelebration;
  root.renderSessionCelebration = renderSessionCelebration;
  root.celebratePerfectItem = celebratePerfectItem;
  root.celebrateProgramCompletion = celebrateProgramCompletion;
})();
