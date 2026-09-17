// Activity-plugin orchestration owned by the app shell. Activity plugins live
// under /plugins and communicate with the shell only through this registry.
const activityPluginRegistry = new Map();

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

function activityPluginForProfile(profile){
  return profile&&profile.activity ? activityPluginRegistry.get(profile.activity.kind)||null : null;
}

function activityPluginForItem(item){
  return item&&item.activityKind ? activityPluginRegistry.get(item.activityKind)||null : null;
}

function generateActivityItems(profile){
  const plugin=activityPluginForProfile(profile);
  if(!plugin) throw new Error(`No activity plugin registered for '${profile.activity.kind}'`);
  // One opaque context is shared only across items generated for this profile.
  // Plugins may use it for deterministic uniqueness without exposing domain
  // knowledge to the shell or leaking values between profiles.
  const generationContext={};
  return Array.from({length:profile.itemCount},(_,index)=>plugin.generateItem({profile,index,language:state.language,generationContext}));
}

function renderActivityItem(container,item){
  const plugin=activityPluginForItem(item);
  if(!plugin) throw new Error(`No activity plugin registered for item '${item&&item.activityKind}'`);
  return plugin.render({container,item,profile:currentProfile(),state});
}

function applyActivityAction(item,action){
  const plugin=activityPluginForItem(item);
  return plugin ? plugin.applyAction({item,profile:currentProfile(),action,state}) : {applied:false};
}

function checkActivityItem(item){
  const plugin=activityPluginForItem(item);
  return plugin ? plugin.check({item,profile:currentProfile(),state}) : {applied:false};
}

function undoActivityItem(item){
  const plugin=activityPluginForItem(item);
  return plugin&&typeof plugin.undo==='function' ? plugin.undo({item,profile:currentProfile(),state}) : {applied:false};
}

function resetActivityItem(item){
  const plugin=activityPluginForItem(item);
  return plugin&&typeof plugin.reset==='function' ? plugin.reset({item,profile:currentProfile(),state}) : {applied:false};
}

function retryActivityItem(item){
  const plugin=activityPluginForItem(item);
  return plugin&&typeof plugin.retry==='function' ? plugin.retry({item,profile:currentProfile(),state}) : {applied:false};
}

function activityItemHasAttempt(item){
  const plugin=activityPluginForItem(item);
  return !!(plugin&&typeof plugin.hasAttempt==='function'&&plugin.hasAttempt({item}));
}
