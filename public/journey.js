export function createJourney({state,api,bootstrap,render,openModal,toast,money,esc,icon,authModal,checkoutForm,modelOptions}) {
  let pendingCheckout=null,busy=false;
  const fields=['modelGuide','title','category','condition','modelId','brand','description','price','city'];
  const key=form=>state.user?`component-draft:${state.user.id}:${form.id==='sell-form'?'new':form.dataset.id}`:null;
  function readDraft(form){try{const d=JSON.parse(localStorage.getItem(key(form)));return d&&typeof d==='object'&&d.values&&typeof d.values==='object'?d:null}catch{return null}}
  function clearDraft(form){try{localStorage.removeItem(key(form))}catch{}}
  function capture(form){
    if(!form?.matches('#sell-form,#edit-listing-form')||!key(form))return;
    const values=Object.fromEntries(fields.map(k=>[k,form.elements.namedItem(k)?.value||'']));
    try{localStorage.setItem(key(form),JSON.stringify({values,saved:Date.now()}));const message=form.querySelector('.draft-message');if(message)message.textContent='Черновик сохранён на этом устройстве. Фото нужно выбрать заново при возвращении.'}
    catch{const message=form.querySelector('.draft-message');if(message)message.textContent='Не удалось сохранить черновик в браузере. Не закрывай страницу до публикации.'}
  }
  function restore(form,draft){
    const values=draft.values;
    if(typeof values.category==='string'&&state.categories.some(c=>c.id===values.category)){form.elements.category.value=values.category;form.elements.modelId.innerHTML=modelOptions(values.category)}
    for(const name of fields){const input=form.elements.namedItem(name);if(input&&typeof values[name]==='string')input.value=values[name].slice(0,name==='description'?3000:name==='modelGuide'?2000:120)}
    form.dispatchEvent(new CustomEvent('model-guide-restore',{bubbles:true}));
    form.querySelector('.draft-message').textContent='Черновик восстановлен. Проверь данные перед сохранением. Фото в черновик не входит.';
    form.querySelector('[data-action=draft-restore]')?.remove();
  }
  function afterRender(){
    const form=document.querySelector('#sell-form,#edit-listing-form');if(!form||!state.user)return;
    const draft=readDraft(form);
    form.insertAdjacentHTML('afterbegin',`<aside class="draft-banner"><div>${icon('save')}<span class="draft-message" role="status">${draft?'Есть незавершённый черновик на этом устройстве.':'Текст объявления сохраняется на этом устройстве автоматически. Фото в черновик не входит.'}</span></div><div class="flex">${draft&&form.id==='edit-listing-form'?'<button class="btn compact" type="button" data-action="draft-restore">Восстановить</button>':''}<button class="reset" type="button" data-action="draft-clear">Сбросить черновик</button></div></aside>`);
    if(draft&&form.id==='sell-form')restore(form,draft);
  }
  async function checkout(kind,ids,contact){
    if(!state.user){pendingCheckout={kind,ids:[...ids]};authModal();return}
    if(busy)return;busy=true;
    const old=new Map(state.products.map(p=>[p.id,p.price]));
    try{
      await bootstrap();
      if(!state.user){pendingCheckout={kind,ids:[...ids]};authModal();return}
      const items=ids.map(id=>state.products.find(p=>p.id===id));
      if(!items.length){toast('Сначала выбери товары.');return}
      if(items.some(p=>!p)){openModal('Предложение уже недоступно','Продавец снял один из товаров с продажи. Обнови состав заявки.',`<a class="btn primary wide" href="#${kind==='assembly'?'builder':'cart'}" data-action="close-modal">${kind==='assembly'?'Вернуться к сборке':'Проверить корзину'}</a>`);await render();return}
      if(kind==='assembly'&&items.some(p=>p.condition!=='new')){openModal('Замени б/у комплектующие','ПК на заказ собирается только из новых деталей.',`<a class="btn primary" href="#builder" data-action="close-modal">Вернуться к сборке</a>`);await render();return}
      if(items.some(p=>p.owner_id===state.user.id)){toast('В составе есть твоё объявление. Убери его перед оформлением.');return}
      const changed=items.some(p=>old.has(p.id)&&old.get(p.id)!==p.price);
      checkoutForm(kind,ids);
      state.orderDraft.expectedPrices=Object.fromEntries(items.map(p=>[p.id,p.price]));
      const form=document.querySelector('#checkout-form');
      form.insertAdjacentHTML('afterbegin',`<div class="checkout-summary">${changed?'<div class="warning">Цена изменилась. Проверь актуальную сумму перед отправкой.</div>':''}<h3>Состав заявки</h3>${items.map(p=>`<div><span>${esc(p.title)}</span><strong>${money(p.price)}</strong></div>`).join('')}<div class="checkout-total"><span>Итого</span><strong>${money(items.reduce((s,p)=>s+p.price,0))}</strong></div></div>`);
      if(contact)for(const name of ['name','phone','city','note','address'])if(typeof contact[name]==='string')form.elements.namedItem(name)&&(form.elements.namedItem(name).value=contact[name]);
    }catch(e){toast(e.message)}finally{busy=false}
  }
  function takePending(){const pending=pendingCheckout;pendingCheckout=null;return pending}
  async function resume(pending){if(pending)await checkout(pending.kind,pending.ids)}
  function cancelPending(){pendingCheckout=null}
  function checkoutError(form,error){
    if(form.id!=='checkout-form'||error.status!==409)return;
    if(!form.querySelector('[data-action=checkout-refresh]'))form.insertAdjacentHTML('beforeend','<button class="btn soft" type="button" data-action="checkout-refresh">Обновить состав и цены</button>');
  }
  async function action(action,b){
    const form=b.closest('form');
    if(action==='draft-restore'){const draft=readDraft(form);if(draft)restore(form,draft);return true}
    if(action==='draft-clear'){
      openModal('Сбросить черновик?','Несохранённый текст и выбранное фото будут удалены из формы. Опубликованное объявление останется прежним.',`<button class="btn primary wide" data-action="draft-confirm" data-form="${form.id}" data-id="${form.dataset.id||''}">Сбросить</button>`);return true;
    }
    if(action==='draft-confirm'){const current=document.getElementById(b.dataset.form);if(current&&String(current.dataset.id||'')===b.dataset.id){clearDraft(current);document.getElementById('modal').close();await render()}return true}
    if(action==='checkout-refresh'){const contacts=Object.fromEntries(new FormData(form)),requestKey=state.orderDraft.requestKey;await checkout(state.orderDraft.kind,[...state.orderDraft.ids],contacts);if(requestKey)state.orderDraft.requestKey=requestKey;return true}
    if(action==='close-modal')cancelPending();
    return false;
  }
  document.addEventListener('input',e=>capture(e.target.form));
  document.addEventListener('change',e=>queueMicrotask(()=>capture(e.target.form)));
  document.getElementById('modal').addEventListener('close',cancelPending);
  return {afterRender,clearDraft,checkout,resume,takePending,action,checkoutError,cancelPending};
}
