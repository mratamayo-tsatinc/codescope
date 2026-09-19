// ============================================================================
// RESPONSIVE SHELL UI
// ----------------------------------------------------------------------------
// Owns account-menu presentation and the compact, persistent session context.
// Activity renderers remain responsible only for their learning surfaces.
// ============================================================================

let activeAccountTrigger = null;

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
