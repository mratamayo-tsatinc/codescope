// Public registry for manifest-backed exercise libraries. Content providers
// resolve a logical library id instead of knowing another plugin's directory.
const exerciseLibraryRegistry=new Map();

function exerciseLibrarySlug(value,label){
  const slug=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error(`${label} must be a lowercase path slug`);
  return slug;
}

function registerExerciseLibrary(definition){
  if(!definition||typeof definition!=='object') throw new Error('Exercise library definition is required');
  const id=exerciseLibrarySlug(definition.id,'Exercise library id');
  const root=String(definition.root||'').trim().replace(/\\/g,'/').replace(/\/$/,'');
  if(!root||root.startsWith('/')||root.includes('..')||/^[a-z]+:/i.test(root))
    throw new Error(`${id}: exercise library root must be a safe relative path`);
  const languages=Array.isArray(definition.languages)
    ?definition.languages.map(language=>exerciseLibrarySlug(language,`${id}: language`)):[];
  const aliases=Array.isArray(definition.aliases)
    ?definition.aliases.map(alias=>exerciseLibrarySlug(alias,`${id}: alias`)):[];
  if(!languages.length) throw new Error(`${id}: exercise library must declare at least one language`);
  if(new Set(languages).size!==languages.length) throw new Error(`${id}: duplicate exercise library language`);
  const keys=[id,...aliases];
  if(new Set(keys).size!==keys.length) throw new Error(`${id}: duplicate exercise library alias`);
  const conflict=keys.find(key=>exerciseLibraryRegistry.has(key));
  if(conflict) throw new Error(`Exercise library '${conflict}' is already registered`);
  const library=Object.freeze({id,root,languages:Object.freeze(languages.slice()),
    aliases:Object.freeze(aliases.slice())});
  keys.forEach(key=>exerciseLibraryRegistry.set(key,library));
  return library;
}

function getExerciseLibrary(id){
  const key=exerciseLibrarySlug(id,'Exercise library id'),library=exerciseLibraryRegistry.get(key);
  if(!library) throw new Error(`Exercise library '${key}' is not registered`);
  return library;
}

function resolveExerciseManifestUrl({library,language,exerciseSet}){
  const resolved=getExerciseLibrary(library),languageSlug=exerciseLibrarySlug(language,'CodeScope language');
  const setSlug=exerciseLibrarySlug(exerciseSet,'Exercise set');
  if(!resolved.languages.includes(languageSlug))
    throw new Error(`${resolved.id}: language '${languageSlug}' is not supported`);
  return `${resolved.root}/${languageSlug}/${setSlug}/manifest.json`;
}
