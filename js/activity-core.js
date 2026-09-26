// Activity-plugin orchestration owned by the app shell. Activity plugins live
// under /plugins and communicate with the shell only through this registry.
const activityPluginRegistry = new Map();
const profileContentProviderRegistry = new Map();
let activityContentReadyPromise = null;

function registerActivityPlugin(plugin){
  if(!plugin||typeof plugin!=='object'||!plugin.id) throw new Error('Activity plugin requires an id');
  if(activityPluginRegistry.has(plugin.id)) throw new Error(`Activity plugin '${plugin.id}' is already registered`);
  ['generateItem','render','applyAction','check'].forEach(name=>{
    if(typeof plugin[name]!=='function') throw new Error(`Activity plugin '${plugin.id}' requires ${name}()`);
  });
  // Activity configuration lives in the shell's global profile catalog, but
  // remains dormant when its optional plugin is unavailable. Activate and
  // validate matching profiles when that plugin registers.
  const matchingProfiles=(typeof ACTIVITY_PROFILES==='undefined'?[]:ACTIVITY_PROFILES)
    .filter(profile=>profile.activity&&profile.activity.kind===plugin.id);
  matchingProfiles.forEach(profile=>{
    if(PROFILES.some(candidate=>candidate.id===profile.id)) throw new Error(`Duplicate profile id '${profile.id}'`);
    if(typeof plugin.validateProfile==='function') plugin.validateProfile(profile);
  });
  activityPluginRegistry.set(plugin.id,Object.freeze(Object.assign({},plugin)));
  matchingProfiles.forEach(profile=>PROFILES.push(Object.freeze(profile)));
  return plugin;
}

// Profiles may obtain item content from generated data or from runtime-loaded
// source files without teaching the shell either domain. The provider owns
// validation, loading, parsing and item construction; the shell supplies the
// existing seeded generator as an explicit fallback for generated mode.
function registerProfileContentProvider(provider){
  if(!provider||typeof provider!=='object'||!provider.id)
    throw new Error('Profile content provider requires an id');
  if(profileContentProviderRegistry.has(provider.id))
    throw new Error(`Profile content provider '${provider.id}' is already registered`);
  if(typeof provider.generateItems!=='function')
    throw new Error(`Profile content provider '${provider.id}' requires generateItems()`);
  const matchingProfiles=PROFILES.filter(profile=>profile.content&&profile.content.provider===provider.id);
  matchingProfiles.forEach(profile=>{
    if(typeof provider.validateProfile==='function') provider.validateProfile(profile);
  });
  profileContentProviderRegistry.set(provider.id,Object.freeze(Object.assign({},provider)));
  return provider;
}

function profileContentProviderFor(profile){
  return profile&&profile.content
    ?profileContentProviderRegistry.get(profile.content.provider)||null:null;
}

function generateProfileContentItems(profile,generateDefault){
  const provider=profileContentProviderFor(profile);
  if(!provider) throw new Error(`${profile.id}: unknown content provider '${profile.content&&profile.content.provider}'`);
  const items=provider.generateItems({profile,language:state.language,generateDefault});
  if(!Array.isArray(items)||!items.length)
    throw new Error(`${profile.id}: content provider '${provider.id}' returned no items`);
  return items;
}

// Try again may ask a source provider to rebuild just the current manifest
// item. This keeps every other item and its progress intact while allowing
// embedded seed directives to materialize new values for this one file.
function regenerateProfileContentItem(profile,item){
  const provider=profileContentProviderFor(profile);
  if(!provider||typeof provider.regenerateItem!=='function') return null;
  return provider.regenerateItem({profile,item,language:item&&item.language||state.language});
}

function ensureActivityContentReady(){
  if(activityContentReadyPromise) return activityContentReadyPromise;
  const loaders=[...activityPluginRegistry.values(),...profileContentProviderRegistry.values()];
  activityContentReadyPromise=Promise.all(loaders.map(owner=>
    typeof owner.loadContent==='function'?owner.loadContent():Promise.resolve()
  ));
  return activityContentReadyPromise;
}

function activityPluginForProfile(profile){
  return profile&&profile.activity ? activityPluginRegistry.get(profile.activity.kind)||null : null;
}

function activityPluginForItem(item){
  return item&&item.activityKind ? activityPluginRegistry.get(item.activityKind)||null : null;
}

function generateActivityItems(profile){
  const plugin=activityPluginForProfile(profile);
  if(!plugin) throw new Error(`No activity plugin registered for '${profile.activity.kind}'`);
  const itemCount=typeof plugin.itemCount==='function'
    ?plugin.itemCount({profile,language:state.language}):profile.itemCount;
  if(!Number.isInteger(itemCount)||itemCount<1)
    throw new Error(`${profile.id}: activity item count must be a positive integer`);
  // One opaque context is shared only across items generated for this profile.
  // Plugins may use it for deterministic uniqueness without exposing domain
  // knowledge to the shell or leaking values between profiles.
  const generationContext={};
  return Array.from({length:itemCount},(_,index)=>plugin.generateItem({profile,index,language:state.language,generationContext}));
}


function activityItemMaxPoints(item,profile){
  const plugin=activityPluginForItem(item);
  return plugin&&typeof plugin.maxPoints==='function'?plugin.maxPoints({item,profile}):null;
}

function renderActivityItem(container,item){
  const plugin=activityPluginForItem(item);
  if(!plugin) throw new Error(`No activity plugin registered for item '${item&&item.activityKind}'`);
  return plugin.render({container,item,profile:currentProfile(),state});
}

function applyActivityAction(item,action){
  if(typeof examInteractionLocked==='function'&&examInteractionLocked()) return {applied:false,reason:'exam-expired'};
  const plugin=activityPluginForItem(item);
  return plugin ? plugin.applyAction({item,profile:currentProfile(),action,state}) : {applied:false};
}

function checkActivityItem(item){
  if(typeof examInteractionLocked==='function'&&examInteractionLocked()) return {applied:false,reason:'exam-expired'};
  const plugin=activityPluginForItem(item);
  return plugin ? plugin.check({item,profile:currentProfile(),state}) : {applied:false};
}

function undoActivityItem(item){
  if(typeof examInteractionLocked==='function'&&examInteractionLocked()) return {applied:false,reason:'exam-expired'};
  const plugin=activityPluginForItem(item);
  return plugin&&typeof plugin.undo==='function' ? plugin.undo({item,profile:currentProfile(),state}) : {applied:false};
}

function resetActivityItem(item){
  if(typeof examInteractionLocked==='function'&&examInteractionLocked()) return {applied:false,reason:'exam-expired'};
  const plugin=activityPluginForItem(item);
  return plugin&&typeof plugin.reset==='function' ? plugin.reset({item,profile:currentProfile(),state}) : {applied:false};
}

function retryActivityItem(item){
  if(typeof examInteractionLocked==='function'&&examInteractionLocked()) return {applied:false,reason:'exam-expired'};
  const plugin=activityPluginForItem(item);
  return plugin&&typeof plugin.retry==='function' ? plugin.retry({item,profile:currentProfile(),state}) : {applied:false};
}

function activityItemHasAttempt(item){
  const plugin=activityPluginForItem(item);
  return !!(plugin&&typeof plugin.hasAttempt==='function'&&plugin.hasAttempt({item}));
}
