let tcModalState=null;
function tcEnsureModal(){
  let modal=document.getElementById('tcClassificationModal');
  if(modal) return modal;
  modal=document.createElement('div');modal.id='tcClassificationModal';modal.className='tc-modal';modal.style.display='none';
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.innerHTML='<div class="tc-modal-card"><div class="tc-modal-heading"><i class="fa-solid fa-tags"></i><h2>Classify</h2></div><div class="tc-modal-token"></div><div class="tc-modal-options"></div><div class="tc-modal-actions"><button type="button" data-tc-cancel>Cancel</button><button type="button" data-tc-confirm disabled>Confirm</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('[data-tc-cancel]').onclick=tcCloseModal;
  modal.querySelector('[data-tc-confirm]').onclick=tcConfirmModal;
  modal.addEventListener('click',event=>{if(event.target===modal)tcCloseModal();});
  return modal;
}
function tcOpenClassificationModal(item,profile,token,origin){
  const modal=tcEnsureModal(),response=tcResponseFor(item,token.id),selected=response?response.category:null;
  tcModalState={item,profile,token,origin,selection:selected,initialCategory:selected};
  modal.querySelector('.tc-modal-token').textContent=token.text;
  const options=modal.querySelector('.tc-modal-options');options.innerHTML='';
  profile.activity.response.categories.forEach(category=>{
    const def=TC_CATEGORY_DEFS[category],button=document.createElement('button');
    button.type='button';button.className=`tc-category-option tc-${def.tone}${category===selected?' selected':''}`;button.dataset.category=category;
    button.innerHTML=`<i class="fa-solid ${def.icon}"></i><span>${def.label}</span>`;
    button.onclick=()=>{options.querySelectorAll('button').forEach(candidate=>candidate.classList.remove('selected'));button.classList.add('selected');tcModalState.selection=category;modal.querySelector('[data-tc-confirm]').disabled=category===tcModalState.initialCategory;};
    options.appendChild(button);
  });
  modal.querySelector('[data-tc-confirm]').disabled=!selected;modal.style.display='flex';
  const card=modal.querySelector('.tc-modal-card');
  if(origin&&origin.getBoundingClientRect){const rect=origin.getBoundingClientRect();card.style.transformOrigin=`${rect.left+rect.width/2}px ${rect.top+rect.height/2}px`;}
  requestAnimationFrame(()=>modal.classList.add('open'));
}
function tcCloseModal(){const modal=document.getElementById('tcClassificationModal');if(modal){modal.classList.remove('open');modal.style.display='none';}tcModalState=null;}
function tcConfirmModal(){
  if(!tcModalState||!tcModalState.selection||tcModalState.selection===tcModalState.initialCategory)return;
  const {item,profile,token}=tcModalState,category=tcModalState.selection;tcCloseModal();
  const result=tcApplyAction({item,profile,action:{type:'CLASSIFY_TOKEN',tokenId:token.id,category},state});
  if(result.applied) render();
}
