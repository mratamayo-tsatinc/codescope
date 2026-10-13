// Standalone authoring surface for teacher-managed Profile Set JSON files.
// Drafts live only in memory; this tool deliberately does not share the
// application-settings persistence used by the login Settings modal.
let profileDesignerDraft=null;

const PROFILE_DESIGNER_KINDS=Object.freeze([
  {id:'expression',label:'Generated expression'},
  {id:'trace-source',label:'Trace source program'},
  {id:'simulate-output',label:'Simulate source program'},
  {id:'code-ordering',label:'Code ordering'},
  {id:'bug-catcher',label:'Bug catcher'},
  {id:'token-classification',label:'Token classification'},
  {id:'falling-token-sort',label:'Falling token sort'},
]);
const PROFILE_DESIGNER_OPERATORS=Object.freeze([...new Set(Object.values(OPS).flat())]);

function profileDesignerClone(value){return JSON.parse(JSON.stringify(value));}
function profileDesignerSlug(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'new-item';}
function profileDesignerUniqueId(base,used){let id=profileDesignerSlug(base),suffix=2;while(used.has(id))id=`${profileDesignerSlug(base)}-${suffix++}`;return id;}
function profileDesignerKind(profile){
  if(profile&&profile.activity&&profile.activity.kind)return profile.activity.kind;
  if(profile&&profile.content&&profile.content.mode==='source-files')return 'trace-source';
  return 'expression';
}
function profileDesignerCategory(){return profileDesignerDraft&&profileDesignerDraft.categories.find(row=>row.id===profileDesignerDraft.categoryId);}
function profileDesignerProfile(){return profileDesignerDraft&&profileDesignerDraft.profiles.find(row=>row.meta&&row.meta.id===profileDesignerDraft.profileId);}
function profileDesignerSetStatus(message,tone){
  const status=document.getElementById('profileDesignerStatus');if(!status)return;
  status.textContent=message||'';status.className=`profile-designer-status${tone?` ${tone}`:''}`;
}
function profileDesignerCurrentData(){
  const profiles=PROFILES_RAW.map(raw=>{
    const profile=profileDesignerClone(raw);
    if(!profile.behavior)profile.behavior=profileDesignerClone(finalizeProfileBehavior(null,profile.feedback));
    return profile;
  });
  return {set:profileDesignerClone(ACTIVE_PROFILE_SET),
    session:profileDesignerClone(typeof PROFILE_SESSION==='undefined'?{timing:{enabled:false,minutes:120},persistence:{enabled:true}}:ACTIVE_PROFILE_SESSION),
    profiles,categories:profileDesignerClone(PROFILE_CATEGORIES)};
}

function openProfileDesigner(){
  const modal=document.getElementById('profileDesignerModal'),overlay=document.getElementById('profileDesignerOverlay');
  if(!modal||!overlay)return;
  if(!profileDesignerDraft)resetProfileDesigner(false);
  modal.style.display='flex';overlay.style.display='block';renderProfileDesigner();
  setTimeout(()=>{const first=modal.querySelector('button,input,select,textarea');if(first)first.focus();},0);
}
function closeProfileDesigner(){
  const modal=document.getElementById('profileDesignerModal'),overlay=document.getElementById('profileDesignerOverlay');
  if(modal)modal.style.display='none';if(overlay)overlay.style.display='none';
}
function resetProfileDesigner(renderNow=true){
  const current=profileDesignerCurrentData(),firstCategory=current.categories[0]||null;
  profileDesignerDraft={set:current.set,session:current.session,profiles:current.profiles,categories:current.categories,
    categoryId:firstCategory&&firstCategory.id,profileId:null,editorMode:'category'};
  if(renderNow){renderProfileDesigner();profileDesignerSetStatus('Draft restored from the active configuration.','neutral');}
}

function profileDesignerButton(label,icon,onclick,className,title){
  return h('button',{type:'button',class:className||'pd-icon-button',onclick,title:title||label},
    icon?h('i',{class:`fa-solid ${icon}`,'aria-hidden':'true'}):null,h('span',{},label));
}
function profileDesignerField(label,control,hint){
  return h('label',{class:'pd-field'},h('span',{class:'pd-field-label'},label),control,
    hint?h('small',{},hint):null);
}
function profileDesignerTextInput(value,oninput,attrs){
  return h('input',Object.assign({type:'text',value:value==null?'':String(value),oninput:event=>oninput(event.target.value)},attrs||{}));
}
function profileDesignerSelect(value,options,onchange){
  const select=h('select',{onchange:event=>onchange(event.target.value)},...options.map(option=>
    h('option',{value:option.value,selected:String(option.value)===String(value)},option.label)));
  select.value=value==null?'':String(value);return select;
}
function profileDesignerToggle(label,checked,onchange,hint){
  return h('label',{class:'pd-toggle'},h('input',{type:'checkbox',checked:!!checked,onchange:event=>onchange(event.target.checked)}),
    h('span',{},h('b',{},label),hint?h('small',{},hint):null));
}
function profileDesignerMove(list,index,direction){
  const target=index+direction;if(target<0||target>=list.length)return;
  [list[index],list[target]]=[list[target],list[index]];renderProfileDesigner();
}

function renderProfileDesigner(){
  const root=document.getElementById('profileDesignerRoot');if(!root||!profileDesignerDraft)return;
  root.textContent='';
  const category=profileDesignerCategory();
  if(!category&&profileDesignerDraft.categories.length){profileDesignerDraft.categoryId=profileDesignerDraft.categories[0].id;return renderProfileDesigner();}
  root.appendChild(h('div',{class:'profile-designer-workspace'},
    renderProfileDesignerCategories(),renderProfileDesignerProfiles(category),renderProfileDesignerEditor(category)));
}

function renderProfileDesignerCategories(){
  const categories=profileDesignerDraft.categories;
  return h('section',{class:'pd-column pd-browser','aria-label':'Profile categories'},
    h('div',{class:'pd-column-header'},h('div',{},h('span',{class:'pd-eyebrow'},'Structure'),h('h3',{},'Categories')),
      profileDesignerButton('Add','fa-plus',addProfileDesignerCategory,'pd-add-button','Add category')),
    h('button',{type:'button',class:`pd-category-edit${profileDesignerDraft.editorMode==='session'?' active':''}`,
      onclick:()=>{profileDesignerDraft.profileId=null;profileDesignerDraft.editorMode='session';renderProfileDesigner();}},
      h('i',{class:'fa-solid fa-clock','aria-hidden':'true'}),' Session policy'),
    h('div',{class:'pd-list'},...categories.map((category,index)=>{
      const active=category.id===profileDesignerDraft.categoryId;
      return h('div',{class:`pd-list-row${active?' active':''}`},
        h('button',{type:'button',class:'pd-list-main',onclick:()=>{
          profileDesignerDraft.categoryId=category.id;profileDesignerDraft.profileId=null;profileDesignerDraft.editorMode='category';renderProfileDesigner();
        }},h('span',{class:'pd-list-title'},category.name),
          h('span',{class:'pd-list-meta'},`${category.profileIds.length} profile${category.profileIds.length===1?'':'s'}${category.enabled===false?' · disabled':''}`)),
        h('div',{class:'pd-row-actions'},
          profileDesignerButton('Up','fa-chevron-up',()=>profileDesignerMove(categories,index,-1),'pd-icon-button','Move category up'),
          profileDesignerButton('Down','fa-chevron-down',()=>profileDesignerMove(categories,index,1),'pd-icon-button','Move category down')));
    })));
}

function renderProfileDesignerProfiles(category){
  const profiles=category?category.profileIds.map(id=>profileDesignerDraft.profiles.find(row=>row.meta&&row.meta.id===id)).filter(Boolean):[];
  return h('section',{class:'pd-column pd-browser','aria-label':'Profiles in selected category'},
    h('div',{class:'pd-column-header'},h('div',{},h('span',{class:'pd-eyebrow'},category?'Selected category':'No category'),h('h3',{},category?category.name:'Profiles')),
      profileDesignerButton('Add','fa-plus',addProfileDesignerProfile,'pd-add-button','Add profile')),
    category?h('button',{type:'button',class:`pd-category-edit${profileDesignerDraft.editorMode==='category'?' active':''}`,
      onclick:()=>{profileDesignerDraft.profileId=null;profileDesignerDraft.editorMode='category';renderProfileDesigner();}},
      h('i',{class:'fa-solid fa-pen-to-square','aria-hidden':'true'}),' Edit category settings'):null,
    h('div',{class:'pd-list'},...profiles.map((profile,index)=>{
      const id=profile.meta.id,active=id===profileDesignerDraft.profileId;
      return h('div',{class:`pd-list-row${active?' active':''}`},
        h('button',{type:'button',class:'pd-list-main',onclick:()=>{
          profileDesignerDraft.profileId=id;profileDesignerDraft.editorMode='profile';renderProfileDesigner();
        }},h('span',{class:'pd-list-title'},profile.meta.name),
          h('span',{class:'pd-list-meta'},`${profileDesignerKind(profile)}${profile.enabled===false?' · disabled':''}`)),
        h('div',{class:'pd-row-actions'},
          profileDesignerButton('Up','fa-chevron-up',()=>moveProfileDesignerProfile(category,index,-1),'pd-icon-button','Move profile up'),
          profileDesignerButton('Down','fa-chevron-down',()=>moveProfileDesignerProfile(category,index,1),'pd-icon-button','Move profile down')));
    })),
    !profiles.length?h('div',{class:'pd-empty'},h('i',{class:'fa-regular fa-folder-open','aria-hidden':'true'}),'This category has no profiles yet.'):null);
}

function renderProfileDesignerEditor(category){
  const profile=profileDesignerProfile();
  const section=h('section',{class:'pd-column pd-editor','aria-label':'Configuration editor'});
  if(profileDesignerDraft.editorMode==='session')section.appendChild(renderProfileDesignerSessionForm());
  else if(profileDesignerDraft.editorMode==='profile'&&profile)section.appendChild(renderProfileDesignerProfileForm(profile,category));
  else if(category)section.appendChild(renderProfileDesignerCategoryForm(category));
  else section.appendChild(h('div',{class:'pd-empty'},'Add a category to begin.'));
  return section;
}

function renderProfileDesignerSessionForm(){
  const set=profileDesignerDraft.set||(profileDesignerDraft.set={id:'new-profile-set',name:'New Profile Set',version:'1',description:''});
  const session=profileDesignerDraft.session||(profileDesignerDraft.session={timing:{enabled:false,minutes:120},persistence:{enabled:true}});
  session.timing=session.timing||{enabled:false,minutes:120};
  session.persistence=session.persistence&&typeof session.persistence==='object'?session.persistence:{enabled:session.persistence!==false};
  return h('div',{class:'pd-form'},
    h('div',{class:'pd-editor-heading'},h('div',{},h('span',{class:'pd-eyebrow'},'Shared configuration'),h('h3',{},'Session policy'))),
    h('div',{class:'pd-form-section'},h('h4',{},'Profile Set identity'),h('div',{class:'pd-form-grid'},
      profileDesignerField('Set name',profileDesignerTextInput(set.name,value=>{set.name=value;})),
      profileDesignerField('Set ID',profileDesignerTextInput(set.id,value=>{set.id=profileDesignerSlug(value);}), 'Used in the filename and saved-session key.'),
      profileDesignerField('Version',profileDesignerTextInput(set.version||'1',value=>{set.version=value||'1';}))),
      profileDesignerField('Description',h('textarea',{rows:'3',oninput:event=>{set.description=event.target.value;}},set.description||''))),
    h('div',{class:'pd-callout'},h('i',{class:'fa-solid fa-circle-info','aria-hidden':'true'}),
      h('span',{},'This timer starts once when the student begins and continues across every category, profile, and item.')),
    h('div',{class:'pd-form-section'},h('h4',{},'Session timing'),h('div',{class:'pd-form-grid'},
      profileDesignerToggle('Enable shared timer',session.timing.enabled===true,value=>{session.timing.enabled=value;}),
      profileDesignerField('Duration in minutes',profileDesignerTextInput(session.timing.minutes||120,value=>{
        session.timing.minutes=Math.max(1,Math.min(999,Math.round(Number(value)||1)));
      },{type:'number',min:'1',max:'999'}),'One allowance for the entire session; profile switches never restart it.'),
      profileDesignerToggle('Resume saved session',session.persistence.enabled===true,value=>{session.persistence.enabled=value;},
        'Keeps the same generated items, progress, and absolute timer deadline after refresh or login.'))));
}

function renderProfileDesignerCategoryForm(category){
  const used=new Set(profileDesignerDraft.categories.filter(row=>row!==category).map(row=>row.id));
  return h('div',{class:'pd-form'},
    h('div',{class:'pd-editor-heading'},h('div',{},h('span',{class:'pd-eyebrow'},'Category configuration'),h('h3',{},category.name)),
      profileDesignerButton('Delete','fa-trash',()=>deleteProfileDesignerCategory(category),'pd-danger-button')),
    h('div',{class:'pd-form-grid'},
      profileDesignerField('Category name',profileDesignerTextInput(category.name,value=>{category.name=value;})),
      profileDesignerField('Category ID',profileDesignerTextInput(category.id,value=>{
        const next=profileDesignerSlug(value);if(!next||used.has(next))return;
        category.id=next;profileDesignerDraft.categoryId=next;
      }), 'Lowercase letters, numbers, and hyphens.'),
      profileDesignerToggle('Enabled',category.enabled!==false,value=>{category.enabled=value;},'Disabled categories do not appear on the login screen.')),
    h('div',{class:'pd-callout'},h('i',{class:'fa-solid fa-circle-info','aria-hidden':'true'}),
      h('span',{},'Profile membership and order are controlled in the Profiles column.')));
}

function renderProfileDesignerProfileForm(profile,category){
  const kind=profileDesignerKind(profile),meta=profile.meta||(profile.meta={}),scoring=profile.scoring||(profile.scoring={});
  const used=new Set(profileDesignerDraft.profiles.filter(row=>row!==profile).map(row=>row.meta&&row.meta.id));
  return h('div',{class:'pd-form'},
    h('div',{class:'pd-editor-heading'},h('div',{},h('span',{class:'pd-eyebrow'},'Profile configuration'),h('h3',{},meta.name||meta.id)),
      h('div',{class:'pd-editor-actions'},
        profileDesignerButton('Duplicate','fa-copy',()=>duplicateProfileDesignerProfile(profile,category),'pd-secondary-button'),
        profileDesignerButton('Delete','fa-trash',()=>deleteProfileDesignerProfile(profile,category),'pd-danger-button'))),
    h('div',{class:'pd-form-section'},h('h4',{},'Identity'),h('div',{class:'pd-form-grid'},
      profileDesignerField('Profile name',profileDesignerTextInput(meta.name,value=>{meta.name=value;})),
      profileDesignerField('Profile ID',profileDesignerTextInput(meta.id,value=>{
        const next=profileDesignerSlug(value);if(!next||used.has(next))return;const previous=meta.id;meta.id=next;
        category.profileIds=category.profileIds.map(id=>id===previous?next:id);profileDesignerDraft.profileId=next;
      }), 'Must be unique across every category.'),
      profileDesignerField('Activity type',profileDesignerSelect(kind,PROFILE_DESIGNER_KINDS.map(row=>({value:row.id,label:row.label})),
        value=>changeProfileDesignerKind(profile,value))),
      profileDesignerToggle('Enabled',profile.enabled!==false,value=>{profile.enabled=value;})),
      profileDesignerField('Description',h('textarea',{rows:'3',oninput:event=>{meta.description=event.target.value;}},meta.description||''))),
    h('div',{class:'pd-form-section'},h('h4',{},'Scoring'),h('div',{class:'pd-form-grid'},
      profileDesignerField('Item count',profileDesignerTextInput(scoring.itemCount,value=>{scoring.itemCount=profileDesignerScalar(value);}), 'Use a number or manifest.'),
      profileDesignerField('Points per item',profileDesignerTextInput(scoring.pointsPerItem,value=>{scoring.pointsPerItem=profileDesignerScalar(value);}), 'Use a number or generated-answer.'),
      profileDesignerToggle('Score statement commits',scoring.statementCommits===true,value=>{scoring.statementCommits=value;}))),
    renderProfileDesignerKindFields(profile,kind),renderProfileDesignerBehavior(profile),renderProfileDesignerAdvanced(profile,category));
}

function profileDesignerScalar(value){const text=String(value).trim();return /^\d+(?:\.\d+)?$/.test(text)?Number(text):text;}
function profileDesignerSourceSettings(profile,kind){
  if(kind==='trace-source'){
    profile.content=profile.content||{};profile.content.mode='source-files';profile.content.source=profile.content.source||{};
    return profile.content.source;
  }
  profile.activity=profile.activity||{};profile.activity.generator=profile.activity.generator||{};return profile.activity.generator;
}
function renderProfileDesignerKindFields(profile,kind){
  if(kind==='expression')return renderProfileDesignerExpressionFields(profile);
  const source=profileDesignerSourceSettings(profile,kind),content=profile.content||(profile.content={}),values=content.values||(content.values={});
  const isFileActivity=['trace-source','simulate-output','code-ordering','bug-catcher'].includes(kind);
  if(!isFileActivity)return h('div',{class:'pd-form-section'},h('h4',{},'Activity configuration'),
    h('div',{class:'pd-callout'},h('i',{class:'fa-solid fa-sliders','aria-hidden':'true'}),h('span',{},'Use Advanced configuration below for this specialized activity schema.')));
  return h('div',{class:'pd-form-section'},h('h4',{},'Exercise source'),h('div',{class:'pd-form-grid'},
    profileDesignerField('Exercise library',profileDesignerTextInput(source.library||'source-programs',value=>{source.library=value;})),
    profileDesignerField('Exercise set',profileDesignerTextInput(source.exerciseSet||'',value=>{source.exerciseSet=value;})),
    profileDesignerField('Variable values',profileDesignerSelect(values.variables||'authored',[
      {value:'authored',label:'Authored values'},{value:'seeded',label:'Seeded values'}],value=>{values.variables=value;})),
    profileDesignerField('Input values',profileDesignerSelect(values.input||'authored',[
      {value:'authored',label:'Authored values'},{value:'seeded',label:'Seeded values'}],value=>{values.input=value;})),
    kind!=='trace-source'?profileDesignerToggle('Shuffle exercises',source.shuffle===true,value=>{source.shuffle=value;}):null),
    kind!=='trace-source'?profileDesignerField('Student instructions',h('textarea',{rows:'3',oninput:event=>{profile.activity.instructions=event.target.value;}},profile.activity.instructions||'')):null,
    kind==='bug-catcher'?profileDesignerField('Seeded bugs per item',profileDesignerTextInput(content.bugs&&content.bugs.count||3,value=>{
      content.bugs=content.bugs||{mode:'seeded'};content.bugs.count=Math.max(1,Number(value)||1);
    },{type:'number',min:'1'})):null);
}
function renderProfileDesignerExpressionFields(profile){
  profile.shape=profile.shape||{operandSources:{literal:3},operandRange:{min:1,max:20},allowNegativeOperands:false};
  profile.shape.operandSources=profile.shape.operandSources||{};profile.shape.operandRange=profile.shape.operandRange||{min:1,max:20};
  profile.operators=profile.operators||{allowed:['+','-']};const allowed=new Set(profile.operators.allowed||[]);
  return h('div',{class:'pd-form-section'},h('h4',{},'Expression generation'),
    profileDesignerField('Template',profileDesignerTextInput(profile.template||'operand op operand',value=>{profile.template=value;})),
    h('fieldset',{class:'pd-operator-field'},h('legend',{},'Allowed operators'),h('div',{class:'pd-operator-grid'},...PROFILE_DESIGNER_OPERATORS.map(operator=>
      profileDesignerToggle(operator,allowed.has(operator),checked=>{
        if(checked)allowed.add(operator);else allowed.delete(operator);profile.operators.allowed=PROFILE_DESIGNER_OPERATORS.filter(value=>allowed.has(value));
      })))),
    h('div',{class:'pd-form-grid'},
      ...['literal','variable','constant'].map(type=>profileDesignerField(`${type[0].toUpperCase()+type.slice(1)} operands`,
        profileDesignerTextInput(profile.shape.operandSources[type]||0,value=>{profile.shape.operandSources[type]=Math.max(0,Number(value)||0);},{type:'number',min:'0'}))),
      profileDesignerField('Minimum operand',profileDesignerTextInput(profile.shape.operandRange.min,value=>{profile.shape.operandRange.min=Number(value);},{type:'number'})),
      profileDesignerField('Maximum operand',profileDesignerTextInput(profile.shape.operandRange.max,value=>{profile.shape.operandRange.max=Number(value);},{type:'number'})),
      profileDesignerToggle('Allow negative operands',profile.shape.allowNegativeOperands===true,value=>{profile.shape.allowNegativeOperands=value;})));
}
function renderProfileDesignerBehavior(profile){
  const behavior=profile.behavior||(profile.behavior=profileDesignerClone(DEFAULT_PROFILE_BEHAVIOR));
  behavior.manualResponses=behavior.manualResponses||{mode:'profile',namedValueRate:50,operatorRate:50};
  return h('div',{class:'pd-form-section'},h('h4',{},'Student behavior'),
    h('div',{class:'pd-form-grid'},
      profileDesignerField('Evaluation interaction',profileDesignerSelect(behavior.interactionMode,[
        {value:'guided',label:'Guided readiness'},{value:'strict-sequence',label:'Strict sequence'}],value=>{behavior.interactionMode=value;})),
      profileDesignerField('Feedback release',profileDesignerSelect(behavior.feedbackRelease,[
        {value:'immediate',label:'After checking the item'},{value:'after-timeout',label:'After session timeout'},{value:'never',label:'Never'}],value=>{behavior.feedbackRelease=value;})),
      profileDesignerToggle('Allow undo',behavior.allowUndo!==false,value=>{behavior.allowUndo=value;}),
      profileDesignerToggle('Allow retry',behavior.allowRetry!==false,value=>{behavior.allowRetry=value;}),
      profileDesignerToggle('Lock item after check',behavior.lockItemAfterCheck===true,value=>{behavior.lockItemAfterCheck=value;}),
      profileDesignerToggle('Allow review flags',behavior.allowReviewFlags===true,value=>{behavior.allowReviewFlags=value;}),
      profileDesignerToggle('Show neutral guidance',behavior.showNeutralGuidance!==false,value=>{behavior.showNeutralGuidance=value;}),
      profileDesignerToggle('Show running scores',behavior.showScores!==false,value=>{behavior.showScores=value;}),
      profileDesignerToggle('Show correct solution',behavior.showCorrectSolution===true,value=>{behavior.showCorrectSolution=value;})));
}
function renderProfileDesignerAdvanced(profile,category){
  const textarea=h('textarea',{class:'pd-json-editor',rows:'16',spellcheck:'false'},JSON.stringify(profile,null,2));
  return h('details',{class:'pd-advanced'},h('summary',{},'Advanced profile configuration'),
    h('p',{},'Every profile field is available here. Apply valid JSON to replace this profile while preserving its category position.'),textarea,
    h('div',{class:'pd-advanced-actions'},profileDesignerButton('Apply JSON','fa-code',()=>{
      try{
        const parsed=JSON.parse(textarea.value);if(!parsed||!parsed.meta||!parsed.meta.id)throw new Error('meta.id is required');
        const duplicate=profileDesignerDraft.profiles.some(row=>row!==profile&&row.meta&&row.meta.id===parsed.meta.id);
        if(duplicate)throw new Error(`Profile ID '${parsed.meta.id}' is already used`);
        const profileIndex=profileDesignerDraft.profiles.indexOf(profile),membershipIndex=category.profileIds.indexOf(profile.meta.id);
        profileDesignerDraft.profiles[profileIndex]=parsed;category.profileIds[membershipIndex]=parsed.meta.id;profileDesignerDraft.profileId=parsed.meta.id;
        renderProfileDesigner();profileDesignerSetStatus('Advanced profile JSON applied.','success');
      }catch(error){profileDesignerSetStatus(error.message,'error');}
    },'pd-secondary-button')));
}

function addProfileDesignerCategory(){
  const used=new Set(profileDesignerDraft.categories.map(row=>row.id)),id=profileDesignerUniqueId('new-category',used);
  profileDesignerDraft.categories.push({id,name:'New Category',enabled:true,profileIds:[]});
  profileDesignerDraft.categoryId=id;profileDesignerDraft.profileId=null;profileDesignerDraft.editorMode='category';renderProfileDesigner();
}
function deleteProfileDesignerCategory(category){
  if(category.profileIds.length){profileDesignerSetStatus('Move or delete this category’s profiles before deleting the category.','error');return;}
  if(!confirm(`Delete category "${category.name}"?`))return;
  const index=profileDesignerDraft.categories.indexOf(category);profileDesignerDraft.categories.splice(index,1);
  const next=profileDesignerDraft.categories[Math.min(index,profileDesignerDraft.categories.length-1)]||null;
  profileDesignerDraft.categoryId=next&&next.id;profileDesignerDraft.profileId=null;profileDesignerDraft.editorMode='category';renderProfileDesigner();
}
function profileDesignerDefaultProfile(id){return {enabled:true,meta:{id,name:'New Profile',description:''},
  shape:{operandSources:{literal:2},operandRange:{min:1,max:20},allowNegativeOperands:false},operators:{allowed:['+','-']},
  template:'operand op operand',scoring:{itemCount:5,pointsPerItem:1},behavior:profileDesignerClone(DEFAULT_PROFILE_BEHAVIOR)};}
function addProfileDesignerProfile(){
  const category=profileDesignerCategory();if(!category){profileDesignerSetStatus('Add a category before adding a profile.','error');return;}
  const used=new Set(profileDesignerDraft.profiles.map(row=>row.meta&&row.meta.id)),id=profileDesignerUniqueId('new-profile',used),profile=profileDesignerDefaultProfile(id);
  profileDesignerDraft.profiles.push(profile);category.profileIds.push(id);profileDesignerDraft.profileId=id;profileDesignerDraft.editorMode='profile';renderProfileDesigner();
}
function moveProfileDesignerProfile(category,index,direction){profileDesignerMove(category.profileIds,index,direction);}
function duplicateProfileDesignerProfile(profile,category){
  const copy=profileDesignerClone(profile),used=new Set(profileDesignerDraft.profiles.map(row=>row.meta&&row.meta.id));
  copy.meta.id=profileDesignerUniqueId(`${profile.meta.id}-copy`,used);copy.meta.name=`${profile.meta.name} Copy`;
  const profileIndex=profileDesignerDraft.profiles.indexOf(profile);profileDesignerDraft.profiles.splice(profileIndex+1,0,copy);
  const memberIndex=category.profileIds.indexOf(profile.meta.id);category.profileIds.splice(memberIndex+1,0,copy.meta.id);
  profileDesignerDraft.profileId=copy.meta.id;renderProfileDesigner();
}
function deleteProfileDesignerProfile(profile,category){
  if(!confirm(`Delete profile "${profile.meta.name}"?`))return;
  profileDesignerDraft.profiles.splice(profileDesignerDraft.profiles.indexOf(profile),1);
  category.profileIds=category.profileIds.filter(id=>id!==profile.meta.id);profileDesignerDraft.profileId=null;profileDesignerDraft.editorMode='category';renderProfileDesigner();
}
function changeProfileDesignerKind(profile,kind){
  if(profileDesignerKind(profile)===kind)return;
  if(!confirm('Changing activity type resets type-specific configuration. Continue?')){renderProfileDesigner();return;}
  const identity={enabled:profile.enabled!==false,meta:profileDesignerClone(profile.meta),scoring:profileDesignerClone(profile.scoring||{}),
    behavior:profileDesignerClone(profile.behavior||DEFAULT_PROFILE_BEHAVIOR)};
  const template=PROFILES_RAW.find(candidate=>profileDesignerKind(candidate)===kind);
  let replacement=template?profileDesignerClone(template):profileDesignerDefaultProfile(identity.meta.id);
  replacement.enabled=identity.enabled;replacement.meta=identity.meta;replacement.scoring=identity.scoring;replacement.behavior=identity.behavior;
  const index=profileDesignerDraft.profiles.indexOf(profile);profileDesignerDraft.profiles[index]=replacement;renderProfileDesigner();
}

function profileDesignerValidationErrors(){
  const errors=[],profiles=profileDesignerDraft.profiles,categories=profileDesignerDraft.categories,slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const profileIds=new Set(),categoryIds=new Set(),membership=new Map();
  const set=profileDesignerDraft.set||{},timing=profileDesignerDraft.session&&profileDesignerDraft.session.timing;
  if(!set.id||!slug.test(set.id))errors.push('Profile Set ID must use lowercase letters, numbers, and hyphens.');
  if(!String(set.name||'').trim())errors.push('Profile Set name is required.');
  if(!timing||typeof timing.enabled!=='boolean')errors.push('Session timing must declare enabled as true or false.');
  if(timing&&(!Number.isFinite(Number(timing.minutes))||Number(timing.minutes)<1||Number(timing.minutes)>999))errors.push('Session timer minutes must be from 1 to 999.');
  if(!profileDesignerDraft.session.persistence||typeof profileDesignerDraft.session.persistence.enabled!=='boolean')
    errors.push('Session persistence must declare enabled as true or false.');
  if(!categories.length)errors.push('At least one category is required.');
  if(!profiles.length)errors.push('At least one profile is required.');
  profiles.forEach((profile,index)=>{
    const id=profile&&profile.meta&&profile.meta.id;if(!id)errors.push(`Profile ${index+1} has no ID.`);
    else{if(!slug.test(id))errors.push(`Profile ID '${id}' must use lowercase letters, numbers, and hyphens.`);if(profileIds.has(id))errors.push(`Profile ID '${id}' is duplicated.`);profileIds.add(id);}
    if(!profile.meta||!String(profile.meta.name||'').trim())errors.push(`Profile '${id||index+1}' has no name.`);
    if(!profile.scoring)errors.push(`Profile '${id||index+1}' has no scoring configuration.`);
    const behavior=profile.behavior||{};
    if(!['guided','strict-sequence'].includes(behavior.interactionMode))errors.push(`Profile '${id}' needs a valid evaluation interaction.`);
    if(!['immediate','after-timeout','never'].includes(behavior.feedbackRelease))errors.push(`Profile '${id}' needs a valid feedback release policy.`);
    if(behavior.feedbackRelease==='after-timeout'&&!(timing&&timing.enabled))
      errors.push(`Profile '${id}' releases feedback after timeout, but the shared session timer is disabled.`);
    const kind=profileDesignerKind(profile);
    if(['trace-source','simulate-output','code-ordering','bug-catcher'].includes(kind)){
      const source=kind==='trace-source'?profile.content&&profile.content.source:profile.activity&&profile.activity.generator;
      if(!source||!source.library||!source.exerciseSet)errors.push(`Profile '${id}' needs an exercise library and exercise set.`);
    }
  });
  categories.forEach((category,index)=>{
    if(!category.id)errors.push(`Category ${index+1} has no ID.`);
    else{if(!slug.test(category.id))errors.push(`Category ID '${category.id}' must use lowercase letters, numbers, and hyphens.`);if(categoryIds.has(category.id))errors.push(`Category ID '${category.id}' is duplicated.`);categoryIds.add(category.id);}
    if(!String(category.name||'').trim())errors.push(`Category '${category.id||index+1}' has no name.`);
    if(!Array.isArray(category.profileIds))errors.push(`Category '${category.id}' has an invalid profile list.`);
    else category.profileIds.forEach(id=>{membership.set(id,(membership.get(id)||0)+1);if(!profileIds.has(id))errors.push(`Category '${category.id}' references unknown profile '${id}'.`);});
  });
  profileIds.forEach(id=>{const count=membership.get(id)||0;if(count!==1)errors.push(`Profile '${id}' must belong to exactly one category; found ${count}.`);});
  if(!errors.length){
    try{
      const finalized=profileDesignerClone(profiles).map(finalizeProfile);validateProfiles(finalized);
      finalized.forEach(profile=>{
        if(profile.activity&&typeof activityPluginRegistry!=='undefined'){
          const plugin=activityPluginRegistry.get(profile.activity.kind);
          if(!plugin)throw new Error(`Profile '${profile.id}' uses unavailable activity '${profile.activity.kind}'.`);
          if(typeof plugin.validateProfile==='function')plugin.validateProfile(profile);
        }else if(profile.content&&typeof profileContentProviderFor==='function'){
          const provider=profileContentProviderFor(profile);
          if(!provider)throw new Error(`Profile '${profile.id}' has no compatible content provider.`);
          if(typeof provider.validateProfile==='function')provider.validateProfile(profile);
        }
      });
    }catch(error){errors.push(error.message);}
  }
  return [...new Set(errors)];
}
function validateProfileDesigner(){
  const errors=profileDesignerValidationErrors();
  profileDesignerSetStatus(errors.length?errors.join(' '):`${profileDesignerDraft.categories.length} categories and ${profileDesignerDraft.profiles.length} profiles are valid.`,errors.length?'error':'success');
  return !errors.length;
}
function profileDesignerExportSource(){
  return JSON.stringify({schemaVersion:1,id:profileDesignerDraft.set.id,name:profileDesignerDraft.set.name,
    version:String(profileDesignerDraft.set.version||'1'),description:profileDesignerDraft.set.description||'',
    session:profileDesignerDraft.session,categories:profileDesignerDraft.categories,profiles:profileDesignerDraft.profiles},null,2)+'\n';
}
function downloadProfileConfiguration(){
  if(!validateProfileDesigner())return;
  const blob=new Blob([profileDesignerExportSource()],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`${profileDesignerDraft.set.id}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
  profileDesignerSetStatus(`${profileDesignerDraft.set.id}.json downloaded. Copy it into profile-sets and add it to manifest.json.`,'success');
}

if(typeof document!=='undefined')document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.getElementById('profileDesignerModal')?.style.display==='flex')closeProfileDesigner();
});
