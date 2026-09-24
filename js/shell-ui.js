// ============================================================================
// RESPONSIVE SHELL UI
// ----------------------------------------------------------------------------
// Owns account-menu presentation and the compact, persistent session context.
// Activity renderers remain responsible only for their learning surfaces.
// ============================================================================

let activeAccountTrigger = null;
const ACTIVITY_ZOOM_STORAGE_PREFIX='precedifyActivityZoom:';
let activityZoomPreferenceOwner=null;
let activityZoomResizeObserver=null;
let activityZoomGeometryFrame=null;

function activityZoomSettings(){
  return DEFAULT_APP_SETTINGS.shell.activityZoom;
}

function clampActivityZoomPercent(value){
  const settings=activityZoomSettings(),number=Number(value);
  const fallback=settings.defaultPercent;
  if(!Number.isFinite(number)) return fallback;
  const stepped=Math.round((number-settings.minPercent)/settings.stepPercent)*settings.stepPercent+settings.minPercent;
  return Math.max(settings.minPercent,Math.min(settings.maxPercent,stepped));
}

function activityZoomPreferenceKey(email){
  const normalized=String(email||'').trim().toLowerCase();
  return normalized?ACTIVITY_ZOOM_STORAGE_PREFIX+encodeURIComponent(normalized):null;
}

function syncActivityZoomPreferenceForUser(force){
  const owner=String(state.userEmail||'').trim().toLowerCase();
  if(!force&&activityZoomPreferenceOwner===owner) return state.activityZoomPercent;
  activityZoomPreferenceOwner=owner;
  let value=activityZoomSettings().defaultPercent;
  const key=activityZoomPreferenceKey(owner);
  if(key&&activityZoomSettings().persistPreference){
    try{value=localStorage.getItem(key)||value;}catch(error){/* use configured default */}
  }
  state.activityZoomPercent=clampActivityZoomPercent(value);
  return state.activityZoomPercent;
}

function persistActivityZoomPreference(){
  const settings=activityZoomSettings(),key=activityZoomPreferenceKey(state.userEmail);
  if(!settings.persistPreference||!key) return;
  try{localStorage.setItem(key,String(state.activityZoomPercent));}catch(error){/* preference remains session-local */}
}

function applyActivityZoomToElement(element){
  if(!element) return element;
  const settings=activityZoomSettings();
  const percent=settings.enabled?clampActivityZoomPercent(state.activityZoomPercent):100;
  const factor=percent/100;
  element.classList.add('activity-zoom-surface');
  element.style.setProperty('--activity-zoom-factor',String(factor));
  element.style.zoom=String(factor);
  element.style.width=`${100/factor}%`;
  element.setAttribute('data-activity-zoom',String(percent));
  observeActivityZoomElement(element);
  return element;
}

function scheduleActivityZoomGeometryRefresh(){
  if(activityZoomGeometryFrame!==null||typeof requestAnimationFrame!=='function') return;
  activityZoomGeometryFrame=requestAnimationFrame(()=>{
    activityZoomGeometryFrame=null;
    const item=typeof currentItem==='function'?currentItem():null;
    if(item&&!item.activityKind){
      if(typeof drawConnectorLines==='function') drawConnectorLines(item);
      if(typeof drawDeclarationConnectorLines==='function') drawDeclarationConnectorLines(item);
      if(typeof drawCanonicalConnectorLines==='function') drawCanonicalConnectorLines(item);
      if(typeof drawCanonicalProgramConnectorLines==='function') drawCanonicalProgramConnectorLines(item);
    }
    const fallingStage=document.querySelector('.falling-token-sort-workspace .fts-stage');
    const fallingMiddle=fallingStage&&fallingStage.querySelector('.fts-stage-middle');
    if(fallingMiddle&&typeof ftsFitStageToApp==='function') ftsFitStageToApp(fallingMiddle,fallingStage);
  });
}

function observeActivityZoomElement(element){
  if(typeof ResizeObserver!=='function') return;
  if(!activityZoomResizeObserver) activityZoomResizeObserver=new ResizeObserver(scheduleActivityZoomGeometryRefresh);
  activityZoomResizeObserver.observe(element);
}

function resetActivityZoomObservers(){
  if(activityZoomResizeObserver) activityZoomResizeObserver.disconnect();
}

function syncActivityZoomControls(){
  const settings=activityZoomSettings(),percent=clampActivityZoomPercent(state.activityZoomPercent);
  document.querySelectorAll('[data-activity-zoom-value]').forEach(element=>element.textContent=`${percent}%`);
  document.querySelectorAll('[data-activity-zoom-decrease]').forEach(button=>button.disabled=percent<=settings.minPercent);
  document.querySelectorAll('[data-activity-zoom-increase]').forEach(button=>button.disabled=percent>=settings.maxPercent);
}

function setActivityZoomPercent(value,options){
  const settings=activityZoomSettings();
  if(!settings.enabled) return;
  const next=clampActivityZoomPercent(value);
  if(next===state.activityZoomPercent){syncActivityZoomControls();return;}
  const app=document.getElementById('app');
  const maxScroll=app?Math.max(0,app.scrollHeight-app.clientHeight):0;
  const scrollRatio=app&&maxScroll?app.scrollTop/maxScroll:0;
  state.activityZoomPercent=next;
  persistActivityZoomPreference();
  document.querySelectorAll('.activity-zoom-surface').forEach(applyActivityZoomToElement);
  syncActivityZoomControls();
  const announcement=document.getElementById('activityZoomStatus');
  if(announcement) announcement.textContent=`Activity size ${next} percent`;
  requestAnimationFrame(()=>{
    if(app){
      const updatedMax=Math.max(0,app.scrollHeight-app.clientHeight);
      app.scrollTop=updatedMax*scrollRatio;
    }
    scheduleActivityZoomGeometryRefresh();
  });
  if(options&&options.focusValue){
    const reset=document.querySelector('[data-activity-zoom-value]');
    if(reset) reset.focus();
  }
}

function changeActivityZoom(direction){
  const step=activityZoomSettings().stepPercent;
  setActivityZoomPercent(state.activityZoomPercent+(direction<0?-step:step));
}

function resetActivityZoom(){
  setActivityZoomPercent(activityZoomSettings().defaultPercent,{focusValue:true});
}

function activityZoomButton(className,label,title,icon,handler,shortcut){
  const button=document.createElement('button');
  button.type='button';button.className=className;button.setAttribute('aria-label',label);button.title=title;
  if(shortcut) button.setAttribute('aria-keyshortcuts',shortcut);
  button.innerHTML=`<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
  button.addEventListener('click',handler);return button;
}

function mountActivityZoom(container){
  syncActivityZoomPreferenceForUser();
  resetActivityZoomObservers();
  const settings=activityZoomSettings();
  if(settings.enabled&&settings.userControlVisible){
    const toolbar=document.createElement('div');toolbar.className='activity-zoom-toolbar';
    toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Activity size');
    const label=document.createElement('span');label.className='activity-zoom-label';label.textContent='Activity size';
    const controls=document.createElement('div');controls.className='activity-zoom-controls';
    const decrease=activityZoomButton('activity-zoom-button','Decrease activity size',
      'Decrease activity size (Alt+-)','fa-minus',()=>changeActivityZoom(-1),'Alt+-');
    decrease.setAttribute('data-activity-zoom-decrease','');
    const reset=document.createElement('button');reset.type='button';reset.className='activity-zoom-value';
    reset.setAttribute('data-activity-zoom-value','');reset.setAttribute('aria-label','Reset activity size to 100 percent');
    reset.setAttribute('aria-keyshortcuts','Alt+0');reset.title='Reset activity size (Alt+0)';reset.addEventListener('click',resetActivityZoom);
    const increase=activityZoomButton('activity-zoom-button','Increase activity size',
      'Increase activity size (Alt++)','fa-plus',()=>changeActivityZoom(1),'Alt++');
    increase.setAttribute('data-activity-zoom-increase','');
    controls.append(decrease,reset,increase);toolbar.append(label,controls);container.appendChild(toolbar);
    const status=document.createElement('span');status.id='activityZoomStatus';status.className='visually-hidden';
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');container.appendChild(status);
  }
  const viewport=document.createElement('div');viewport.className='activity-zoom-viewport';
  const surface=document.createElement('div');applyActivityZoomToElement(surface);
  viewport.appendChild(surface);container.appendChild(viewport);syncActivityZoomControls();return surface;
}

function shellAccountInitial(email){
  const value=String(email||'').trim();
  return value ? value.charAt(0).toUpperCase() : 'S';
}

function syncShellAccountUI(){
  const email=state.userEmail||'';
  const initial=shellAccountInitial(email);
  ['sidebarAccountAvatar','headerAccountAvatar','accountMenuAvatar'].forEach(id=>{
    const element=document.getElementById(id);
    if(element) element.textContent=initial;
  });
  const sidebarEmail=document.getElementById('sidebarAccountEmail');
  if(sidebarEmail){
    sidebarEmail.textContent=email;
    sidebarEmail.title=email;
  }
  const menuEmail=document.getElementById('accountMenuEmail');
  if(menuEmail) menuEmail.textContent=email;
}

function syncShellSessionContext(){
  const context=document.getElementById('headerSessionContext');
  const profileName=document.getElementById('headerProfileName');
  const itemPosition=document.getElementById('headerItemPosition');
  const profile=typeof currentProfile==='function' ? currentProfile() : null;
  const inSession=state.screen==='session'&&profile&&Array.isArray(state.items)&&state.items.length>0;
  if(context) context.hidden=!inSession;
  if(profileName) profileName.textContent=inSession?profile.name:'';
  if(itemPosition) itemPosition.textContent=inSession?`Item ${state.itemIndex+1} of ${state.items.length}`:'';
}

function positionAccountMenu(trigger){
  const menu=document.getElementById('accountMenu');
  if(!menu||!trigger) return;
  const rect=trigger.getBoundingClientRect();
  const menuWidth=Math.min(280,window.innerWidth-24);
  menu.style.width=`${menuWidth}px`;
  const left=Math.max(12,Math.min(rect.right-menuWidth,window.innerWidth-menuWidth-12));
  menu.style.left=`${left}px`;
  menu.style.top='auto';
  menu.style.bottom='auto';

  // Sidebar account controls sit at the bottom, while the compact header
  // control sits at the top. Open toward the available content in each case.
  if(rect.top>window.innerHeight/2){
    menu.style.bottom=`${Math.max(12,window.innerHeight-rect.top+8)}px`;
  }else{
    menu.style.top=`${Math.min(window.innerHeight-12,rect.bottom+8)}px`;
  }
}

function openAccountMenu(trigger){
  const menu=document.getElementById('accountMenu');
  if(!menu||!trigger) return;
  closeAccountMenu();
  activeAccountTrigger=trigger;
  syncShellAccountUI();
  menu.hidden=false;
  trigger.setAttribute('aria-expanded','true');
  positionAccountMenu(trigger);
  requestAnimationFrame(()=>{
    const first=menu.querySelector('[role="menuitem"]');
    if(first) first.focus();
  });
}

function closeAccountMenu(options){
  const menu=document.getElementById('accountMenu');
  if(menu) menu.hidden=true;
  const trigger=activeAccountTrigger;
  if(trigger) trigger.setAttribute('aria-expanded','false');
  activeAccountTrigger=null;
  if(options&&options.restoreFocus&&trigger) trigger.focus();
}

function toggleAccountMenu(trigger){
  const menu=document.getElementById('accountMenu');
  if(!menu) return;
  if(!menu.hidden&&activeAccountTrigger===trigger) closeAccountMenu({restoreFocus:true});
  else openAccountMenu(trigger);
}

function syncSidebarShellState(){
  const layout=document.querySelector('.main-layout');
  const sidebar=document.getElementById('profileSidebar');
  if(!layout||!sidebar) return;
  const collapsed=window.innerWidth>768&&sidebar.classList.contains('sidebar-collapsed');
  layout.classList.toggle('sidebar-is-collapsed',collapsed);
  const sidebarVisible=window.innerWidth<=768?sidebar.classList.contains('sidebar-open'):!collapsed;
  sidebar.toggleAttribute('inert',!sidebarVisible);
  sidebar.setAttribute('aria-hidden',String(!sidebarVisible));
  document.querySelectorAll('.shell-brand-trigger').forEach(toggle=>{
    toggle.setAttribute('aria-expanded',String(sidebarVisible));
    const opensSidebar=!sidebarVisible;
    toggle.setAttribute('aria-label',opensSidebar?'Show navigation':'Hide navigation');
    toggle.title=opensSidebar?'Show navigation':'Hide navigation';
  });
}

document.addEventListener('pointerdown',event=>{
  const menu=document.getElementById('accountMenu');
  if(!menu||menu.hidden) return;
  if(menu.contains(event.target)||(activeAccountTrigger&&activeAccountTrigger.contains(event.target))) return;
  closeAccountMenu();
});

document.addEventListener('keydown',event=>{
  if(event.key!=='Escape') return;
  const menu=document.getElementById('accountMenu');
  if(menu&&!menu.hidden){
    event.preventDefault();
    closeAccountMenu({restoreFocus:true});
  }
});

window.addEventListener('resize',()=>{
  closeAccountMenu();
  syncSidebarShellState();
});
