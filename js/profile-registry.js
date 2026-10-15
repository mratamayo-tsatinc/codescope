// Runtime registry for the active Profile Set. Teacher-authored configuration
// can be replaced after startup without replacing application code.
let FINALIZED_PROFILES=[];
let ACTIVE_PROFILE_SESSION=null;
let ACTIVE_PROFILE_SET={id:'default',name:'CodeScope Default',version:'1'};
const categoryByProfileId=new Map();
const PROFILES=[];
const ACTIVITY_PROFILES=[];

function normalizeProfileSession(session){
  session=session&&typeof session==='object'?session:{};
  const language=String(session.language||'c').trim().toLowerCase();
  if(!['c','java'].includes(language))throw new Error("Profile Set session language must be 'c' or 'java'");
  const timing=session.timing&&typeof session.timing==='object'?session.timing:{};
  const persistence=session.persistence;
  const results=session.results&&typeof session.results==='object'?session.results:{};
  return Object.freeze({
    language,
    timing:Object.freeze({enabled:!!timing.enabled,
      minutes:Math.max(1,Math.min(999,Math.round(Number(timing.minutes)||120)))}),
    persistence:Object.freeze({enabled:persistence===true||!!(persistence&&persistence.enabled)}),
    results:Object.freeze({unified:results.unified===true})
  });
}

function rebuildProfileRegistry(rawProfiles,categories,session,setMeta){
  if(!Array.isArray(rawProfiles)||!Array.isArray(categories))throw new Error('Profile Set requires profiles and categories arrays');
  const finalized=rawProfiles.map(finalizeProfile),membership=new Map();
  categories.forEach(category=>{
    if(!category.id||!category.name||!Array.isArray(category.profileIds))throw new Error('Invalid profile category');
    if(category.enabled!==undefined&&typeof category.enabled!=='boolean')throw new Error(`Category '${category.id}': enabled must be a boolean`);
    category.enabled=category.enabled!==false;
    category.profileIds.forEach(id=>{
      if(membership.has(id))throw new Error(`Profile '${id}' belongs to multiple categories`);
      membership.set(id,category.id);
    });
  });
  finalized.forEach(profile=>{
    const categoryId=membership.get(profile.id);
    if(!categoryId)throw new Error(`Profile '${profile.id}' has no category`);
    profile.categoryId=categoryId;
  });
  membership.forEach((categoryId,id)=>{
    if(!finalized.some(profile=>profile.id===id)
      &&!['token-identifier-position','token-declaration-complete','token-program-chain'].includes(id))
      throw new Error(`Category '${categoryId}' references unknown profile '${id}'`);
  });
  validateProfiles(finalized);

  PROFILES_RAW.splice(0,PROFILES_RAW.length,...rawProfiles);
  PROFILE_CATEGORIES.splice(0,PROFILE_CATEGORIES.length,...categories);
  FINALIZED_PROFILES.splice(0,FINALIZED_PROFILES.length,...finalized);
  categoryByProfileId.clear();membership.forEach((value,key)=>categoryByProfileId.set(key,value));
  ACTIVITY_PROFILES.splice(0,ACTIVITY_PROFILES.length,...finalized.filter(profile=>profile.activity));
  PROFILES.splice(0,PROFILES.length,...finalized.filter(profile=>!profile.activity));
  ACTIVE_PROFILE_SESSION=normalizeProfileSession(session);
  if(typeof state==='object'&&state)state.language=ACTIVE_PROFILE_SESSION.language;
  ACTIVE_PROFILE_SET=Object.freeze(Object.assign({id:'default',name:'CodeScope Default',version:'1'},setMeta||{}));

  if(typeof activityPluginRegistry!=='undefined'){
    ACTIVITY_PROFILES.forEach(profile=>{
      const plugin=activityPluginRegistry.get(profile.activity.kind);
      if(!plugin)return;
      if(typeof plugin.validateProfile==='function')plugin.validateProfile(profile);
      if(!PROFILES.some(candidate=>candidate.id===profile.id))PROFILES.push(Object.freeze(profile));
    });
  }
  if(typeof profileContentProviderRegistry!=='undefined'){
    PROFILES.forEach(profile=>{
      const provider=profileContentProviderFor(profile);
      if(provider&&typeof provider.validateProfile==='function')provider.validateProfile(profile);
    });
  }
  return ACTIVE_PROFILE_SET;
}

function profilesForCategory(categoryId){
  const category=PROFILE_CATEGORIES.find(candidate=>candidate.id===categoryId);
  if(!category||category.enabled===false)return [];
  return PROFILES.filter(profile=>profile.categoryId===categoryId&&profile.enabled!==false);
}
function profileIsEnabled(profileOrId){
  const profile=typeof profileOrId==='string'?PROFILES.find(candidate=>candidate.id===profileOrId):profileOrId;
  if(!profile||profile.enabled===false)return false;
  const category=PROFILE_CATEGORIES.find(candidate=>candidate.id===profile.categoryId);
  return !!category&&category.enabled!==false;
}
function enabledProfiles(){return PROFILES.filter(profileIsEnabled);}
function enabledCategories(){return PROFILE_CATEGORIES.filter(category=>category.enabled!==false&&profilesForCategory(category.id).length>0);}
function profileContentSource(profile){const content=profile&&profile.content||{},source=content.source||{};return {library:source.library||null,exerciseSet:source.exerciseSet||null};}
function profileVariableValueMode(profile){const values=profile&&profile.content&&profile.content.values||{};return values.variables||'authored';}
function profileInputValueMode(profile){const values=profile&&profile.content&&profile.content.values||{};return values.input||'authored';}
function profileWorkspacePresentation(profile){return profile&&profile.presentation&&profile.presentation.workspace||'statement-flow';}
function profileTimelineMode(profile){return profile&&profile.presentation&&profile.presentation.timeline||'inline';}
function profileScoresStatementCommits(profile){return !!(profile&&profile.scoring&&profile.scoring.statementCommits===true);}

rebuildProfileRegistry(PROFILES_RAW,PROFILE_CATEGORIES,PROFILE_SESSION,{id:'codescope-default',name:'CodeScope Default',version:'1'});
