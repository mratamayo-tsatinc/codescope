const PROFILE_SET_CATALOG_URL='profile-sets/manifest.json';
const PROFILE_SET_SELECTION_KEY='codescopeSelectedProfileSet';
let profileSetCatalog=null;

function profileSetEntry(id){return profileSetCatalog&&profileSetCatalog.sets.find(entry=>entry.id===id&&entry.enabled!==false);}
function selectedProfileSetId(){
  try{return localStorage.getItem(PROFILE_SET_SELECTION_KEY)||profileSetCatalog.defaultSetId;}
  catch(error){return profileSetCatalog.defaultSetId;}
}
function renderProfileSetSelector(){
  const select=document.getElementById('profileSetSelect'),details=document.getElementById('profileSetDetails');
  if(!select||!profileSetCatalog)return;
  select.textContent='';
  profileSetCatalog.sets.filter(entry=>entry.enabled!==false).forEach(entry=>{
    const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;select.appendChild(option);
  });
  select.value=ACTIVE_PROFILE_SET.id;
  const entry=profileSetEntry(ACTIVE_PROFILE_SET.id);
  if(details)details.textContent=entry&&entry.description||ACTIVE_PROFILE_SET.description||'';
}
async function activateProfileSet(id,{remember=true}={}){
  const entry=profileSetEntry(id);if(!entry)throw new Error(`Unknown Profile Set '${id}'`);
  const response=await fetch(`profile-sets/${entry.file}`,{cache:'no-store'});
  if(!response.ok)throw new Error(`${entry.file}: HTTP ${response.status}`);
  const config=await response.json();
  if(config.schemaVersion!==1)throw new Error(`${entry.file}: unsupported schemaVersion`);
  if(config.id!==entry.id)throw new Error(`${entry.file}: id must match manifest entry '${entry.id}'`);
  rebuildProfileRegistry(config.profiles,config.categories,config.session,{
    id:config.id,name:config.name||entry.name,version:String(config.version||'1'),description:config.description||entry.description||'',file:entry.file
  });
  activityContentReadyPromise=null;
  if(remember){try{localStorage.setItem(PROFILE_SET_SELECTION_KEY,id);}catch(error){}}
  profileDesignerDraft=null;renderProfileSetSelector();
  return ACTIVE_PROFILE_SET;
}
async function loadProfileSetCatalog(){
  const response=await fetch(PROFILE_SET_CATALOG_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`Profile Set catalog: HTTP ${response.status}`);
  const catalog=await response.json();
  if(catalog.schemaVersion!==1||!Array.isArray(catalog.sets)||!catalog.sets.length)
    throw new Error('Profile Set catalog is invalid');
  profileSetCatalog=catalog;
  let id=selectedProfileSetId();if(!profileSetEntry(id))id=catalog.defaultSetId;
  await activateProfileSet(id,{remember:true});
  renderProfileSetSelector();
  const begin=document.getElementById('beginSessionBtn');if(begin)begin.disabled=false;
}
async function handleProfileSetChange(event){
  const select=event.currentTarget,error=document.getElementById('loginError'),begin=document.getElementById('beginSessionBtn');
  select.disabled=true;if(begin)begin.disabled=true;
  try{
    await activateProfileSet(select.value,{remember:true});
    await ensureActivityContentReady();
    if(error){error.textContent='';error.style.display='none';}
  }catch(loadError){
    if(error){error.textContent=`Profile Set could not be loaded: ${loadError.message}`;error.style.display='block';}
    renderProfileSetSelector();
  }finally{select.disabled=false;if(begin)begin.disabled=false;}
}
