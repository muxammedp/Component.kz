import {directorySpecLabels} from './model-directory.js';
import {specFields} from './catalog-search.js';
export function createMarketplace(ctx) {
  const {state,esc,money,icon,api,find,go,render,bootstrap,toast,openModal,productImage,categoryName,modelOptions,sell,loginGate}=ctx;
  let compared=[];
  try {const saved=JSON.parse(localStorage.getItem('component-compare'));if(Array.isArray(saved))compared=[...new Set(saved.map(v=>Number.isInteger(v)?'product:'+v:v).filter(v=>typeof v==='string'&&/^(product|model):[1-9][0-9]*$/.test(v)))].slice(0,4)} catch {}
  let differences=false;
  const own=p=>!!state.user&&p.owner_id===state.user.id;
  const saveCompare=()=>{try{localStorage.setItem('component-compare',JSON.stringify(compared))}catch{}};
  const compareKey=(id,kind='product')=>`${kind}:${id}`;
  const resolveCompare=key=>{const [kind,id]=key.split(':');const p=kind==='model'?state.models.find(m=>m.id===Number(id)):find(Number(id));if(!p)return null;const model=kind==='model'?p:state.models.find(m=>m.id===(p.modelId||p.spec.referenceId));return {...p,compareKind:kind,compareKey:key,compareSpec:model?.facts||p.spec}};
  function compareButton(p,kind='product') {
    const selected=compared.includes(compareKey(p.id,kind));
    return `<button type="button" class="compare-button ${selected?'selected':''}" data-action="compare-toggle" data-kind="${kind}" data-id="${p.id}" aria-pressed="${selected}" aria-label="${selected?'Убрать из сравнения':'Сравнить'}: ${esc(p.title)}">${icon('swap')} ${selected?'В сравнении':'Сравнить'}</button>`;
  }
  function afterRender() {
    compared=compared.filter(resolveCompare);saveCompare();
    let tools=document.getElementById('marketplace-tools');
    if(!tools){tools=document.createElement('div');tools.id='marketplace-tools';document.body.append(tools)}
    const page=location.hash.slice(1).split('?')[0]||'home';
    const showTray=compared.length>0&&(['home','catalog','favorites','cart','models'].includes(page)||page.startsWith('product/'));
    tools.innerHTML=`${showTray?`<aside class="compare-tray" aria-label="Выбрано для сравнения"><div><strong>Сравнение · ${compared.length} из 4</strong><small>${esc(categoryName(resolveCompare(compared[0])?.category))}</small></div><a class="btn primary compact" href="#compare">Сравнить ${icon('arrow')}</a><button class="icon-btn" data-action="compare-clear" aria-label="Очистить сравнение">${icon('close')}</button></aside>`:''}<nav class="mobile-bottom" aria-label="Навигация на телефоне">${[['home','box','Главная'],['catalog','grid','Каталог'],['builder','tool','Собрать ПК'],['cart','cart','Корзина'],['profile','user','Профиль']].map(([href,i,label])=>`<a href="#${href}" ${page===href?'aria-current="page"':''}>${icon(i)}<span>${label}</span></a>`).join('')}</nav>`;
    document.body.classList.toggle('has-compare-tray',showTray);
    document.querySelectorAll('.compare-button').forEach(button=>{const kind=button.dataset.kind||'product',p=resolveCompare(compareKey(Number(button.dataset.id),kind));if(p)button.outerHTML=compareButton(p,kind)});
  }
  const value=v=>v==null||v===''||Array.isArray(v)&&!v.length?'—':Array.isArray(v)?v.join(', '):typeof v==='boolean'?(v?'Да':'Нет'):String(v);
  function comparePage() {
    const items=compared.map(resolveCompare).filter(Boolean),hasModels=items.some(p=>p.compareKind==='model');
    if(!items.length)return `<div class="container page"><h1 class="page-heading">Сравнение товаров и моделей</h1><div class="empty">${icon('swap')}<h3>Выбери, что сравнить</h3><p>Добавь до четырёх товаров или моделей одной категории кнопкой «Сравнить».</p><div class="flex"><a class="btn primary" href="#models">Из справочника ${icon('arrow')}</a><a class="btn soft" href="#catalog">Из каталога</a></div></div></div>`;
    const keys=[...new Set(items.flatMap(p=>Object.keys(p.compareSpec)))].filter(k=>!['referenceId','graphicsScore'].includes(k));
    const rows=[['Цена объявления',p=>p.compareKind==='model'?'—':money(p.price)],['Состояние',p=>p.compareKind==='model'?'—':p.condition==='used'?'Б/у':'Новое'],['Город',p=>p.compareKind==='model'?'—':value(p.city)],['Бренд',p=>value(p.brand)],...keys.map(k=>[(k==='tdp'&&items[0].category==='cooler'?'Отвод тепла до, Вт':directorySpecLabels[k])||ctx.getSpecLabels()[k]||k,p=>value(p.compareSpec[k])])];
    const visible=rows.filter(([,get])=>!differences||new Set(items.map(get)).size>1);
    const link=p=>p.compareKind==='model'?`#models?category=${p.category}&q=${encodeURIComponent(p.title)}&model=${p.id}`:`#product/${p.id}`;
    return `<div class="container page"><div class="breadcrumb"><a href="#models">Справочник</a>${icon('chevron')}<span>Сравнение</span></div><div class="section-head"><div><h1 class="page-heading">Сравни и выбери своё</h1><p class="page-subtitle">${esc(categoryName(items[0].category))} · ${items.length} из 4 позиций</p></div><div class="flex"><a class="btn soft" href="#models?category=${items[0].category}">${icon('plus')} Из справочника</a><a class="btn soft" href="#catalog?category=${items[0].category}">Из каталога</a></div></div><div class="between comparison-controls"><label class="check"><input type="checkbox" id="compare-differences" ${differences?'checked':''}>Только различия</label><button class="reset" data-action="compare-clear">Очистить всё</button></div><div class="comparison-scroll" tabindex="0" role="region" aria-label="Таблица сравнения, прокручивается по горизонтали"><table class="comparison-table"><thead><tr><th scope="col">Характеристики<small>Прокрути таблицу, чтобы увидеть все позиции</small></th>${items.map(p=>`<th scope="col"><div class="comparison-product"><button class="icon-btn" data-action="compare-toggle" data-kind="${p.compareKind}" data-id="${p.id}" aria-label="Убрать из сравнения: ${esc(p.title)}">${icon('close')}</button><a class="comparison-image" href="${esc(link(p))}">${p.compareKind==='model'?`<span class="comparison-model-icon">${icon(p.category==='cpu'?'cpu':p.category==='gpu'?'gpu':'box')}</span>`:productImage(p)}</a><a href="${esc(link(p))}">${esc(p.title)}</a><small>${p.compareKind==='model'?'Модель из справочника':p.demo?'Демо-предложение':esc(p.seller)}</small>${p.compareKind==='model'?'<span class="small muted">Цена зависит от объявления</span>':`<strong class="price">${money(p.price)}</strong>`}<a class="btn soft compact" href="${esc(link(p))}">${p.compareKind==='model'?'Характеристики и предложения':'Подробнее'} ${icon('arrow')}</a></div></th>`).join('')}</tr></thead><tbody>${visible.map(([label,get])=>`<tr><th scope="row">${esc(label)}</th>${items.map(p=>`<td>${esc(get(p))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${items.length+1}">В выбранных характеристиках различий нет.</td></tr>`}</tbody></table></div><p class="ai-fineprint">${hasModels?'Модель из справочника не является объявлением: у неё нет цены, города и состояния. ':''}Используются доступные характеристики справочника; источники указаны на странице модели. Прочерк означает отсутствие данных. Состояние и комплектность товара уточни у продавца.</p></div>`;
  }
  function readFilters(query) {
    const params=new URLSearchParams(query||'');
    const category=params.get('category'),condition=params.get('condition'),sort=params.get('sort');
    const price=k=>/^\d{1,9}$/.test(params.get(k)||'')?params.get(k):'';
    state.filter={category:state.categories.some(c=>c.id===category)?category:'all',condition:['new','used'].includes(condition)?condition:'all',q:(params.get('q')||'').slice(0,120),brand:params.getAll('brand'),min:price('min'),max:price('max'),sort:['cheap','expensive','recent'].includes(sort)?sort:'popular'};
    state.filter.source=['real','demo'].includes(params.get('source'))?params.get('source'):'all';
    state.filter.spec=Object.fromEntries((specFields[state.filter.category]||[]).map(([key])=>[key,[...new Set(params.getAll('spec.'+key))]]).filter(([,v])=>v.length));
    state.city=params.get('city')||'';
    state.catalogPage=/^[1-9]\d{0,5}$/.test(params.get('page')||'')?Number(params.get('page')):1;
  }
  function syncFilters() {
    const params=new URLSearchParams();
    for(const key of ['category','condition','q','min','max','sort','source']){const v=state.filter[key];if(v&&v!=='all'&&v!=='popular')params.set(key,v)}
    for(const [key,values] of Object.entries(state.filter.spec||{}))for(const v of values)params.append('spec.'+key,v);
    for(const b of state.filter.brand)params.append('brand',b);
    if(state.city)params.set('city',state.city);
    go('catalog'+(params.size?'?'+params:''));
  }
  function filterChips() {
    const f=state.filter,items=[];
    if(f.q)items.push(['q',`Поиск: ${f.q}`]);
    if(f.condition!=='all')items.push(['condition',f.condition==='used'?'Б/у':'Новое']);
    if(f.min||f.max)items.push(['price',`${f.min?money(f.min):'0 ₸'} — ${f.max?money(f.max):'без ограничения'}`]);
    if(state.city)items.push(['city',state.city]);
    if(f.source&&f.source!=='all')items.push(['source',f.source==='real'?'Только реальные':'Демонстрационные']);
    items.push(...f.brand.map(b=>['brand',b]));
    const specChips=Object.entries(f.spec||{}).flatMap(([key,values])=>values.map(v=>{const label=(specFields[f.category]?.find(([k])=>k===key)?.[1]||key)+': '+v;return `<button data-action="filter-remove" data-key="spec.${key}" data-value="${esc(v)}" aria-label="Убрать фильтр: ${esc(label)}">${esc(label)} ${icon('close')}</button>`})).join('');
    return items.length||specChips?`<div class="filter-chips" aria-label="Применённые фильтры">${items.map(([key,label])=>`<button data-action="filter-remove" data-key="${key}" data-value="${esc(label)}" aria-label="Убрать фильтр: ${esc(label)}">${esc(label)} ${icon('close')}</button>`).join('')}${specChips}</div>`:'';
  }
  function pageItems(items){state.catalogPage=Math.min(state.catalogPage||1,Math.max(1,Math.ceil(items.length/12)));return items.slice((state.catalogPage-1)*12,state.catalogPage*12)}
  function pagination(items){
    const total=Math.ceil(items.length/12),current=state.catalogPage||1;
    if(total<2)return '';
    const link=(page,label)=>{const params=new URLSearchParams(location.hash.split('?')[1]||'');if(page===1)params.delete('page');else params.set('page',page);return `<a class="btn compact ${page===current?'primary':''}" href="#catalog${params.size?'?'+esc(params.toString()):''}" ${page===current?'aria-current="page"':''}>${label}</a>`};
    const pages=[...new Set([1,current-1,current,current+1,total])].filter(n=>n>=1&&n<=total).sort((a,b)=>a-b);
    return `<nav class="catalog-pagination" aria-label="Страницы каталога"><span>Показаны ${(current-1)*12+1}–${Math.min(current*12,items.length)} из ${items.length}</span><div>${current>1?link(current-1,'Назад'):''}${pages.map((n,i)=>(i&&n>pages[i-1]+1?'<span>…</span>':'')+link(n,n)).join('')}${current<total?link(current+1,'Далее'):''}</div></nav>`;
  }
  function photoControl(image='') {
    return `<div class="photo-preview" ${image?'':'hidden'}>${image?`<img src="${esc(image)}" alt="Предпросмотр фотографии объявления">`:''}<button class="btn compact" type="button" data-action="photo-remove">${icon('trash')} Убрать фото</button></div><p class="photo-error form-error" role="status"></p>`;
  }
  async function fileData(file) {
    if(file.size>1500000)throw new Error('Фото должно быть не больше 1,5 МБ.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Выбери JPEG, PNG или WebP.');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Не удалось прочитать фото.'));reader.readAsDataURL(file)});
  }
  async function preview(input) {
    const form=input.form,box=form.querySelector('.photo-preview'),error=form.querySelector('.photo-error');
    if(!input.files[0])return;
    const file=input.files[0];error.textContent='';
    try {const src=await fileData(file);if(input.files[0]!==file)return;box.innerHTML=`<img src="${esc(src)}" alt="Предпросмотр фотографии объявления"><button class="btn compact" type="button" data-action="photo-remove">${icon('trash')} Убрать фото</button>`;box.hidden=false;delete form.dataset.removeImage}
    catch(e){error.textContent=e.message;input.value=''}
  }
  async function editor(id) {
    if(!state.user)return loginGate('Редактирование объявления','Войди в аккаунт автора, чтобы изменить объявление.');
    const p=await api('/listings/'+id);
    const doc=new DOMParser().parseFromString(sell(),'text/html'),form=doc.querySelector('#sell-form');
    form.id='edit-listing-form';form.dataset.id=p.id;form.dataset.status=p.status;
    doc.querySelector('.page-heading').textContent='Обнови своё объявление';
    doc.querySelector('.page-subtitle').textContent=p.status==='sold'?'Объявление снято с продажи. После редактирования оно останется неактивным.':'Измени цену, описание или фотографию — покупатели увидят актуальную информацию.';
    doc.querySelector('.breadcrumb').innerHTML='<a href="#profile">Мой профиль</a> / Редактирование';
    form.querySelector('[name=modelId]').innerHTML=modelOptions(p.category);
    for(const [key,v] of Object.entries({...p,modelId:p.modelId||p.spec.referenceId||''})) {
      const el=form.elements.namedItem(key);if(!el||key==='image')continue;
      if(el.tagName==='TEXTAREA')el.textContent=v;
      else if(el.tagName==='SELECT')for(const opt of el.options){opt.toggleAttribute('selected',opt.value===String(v))}
      else el.setAttribute('value',v);
    }
    // City is free text in the account, so preserve cities outside the suggested list.
    const city=form.elements.namedItem('city');if(![...city.options].some(o=>o.value===p.city)){const o=doc.createElement('option');o.value=p.city;o.textContent=p.city;o.setAttribute('selected','');city.append(o)}
    const box=form.querySelector('.photo-preview');box.outerHTML=photoControl(p.image).replace('<p class="photo-error form-error" role="status"></p>','');
    form.querySelector('button[type=submit]').textContent='Сохранить изменения';
    form.insertAdjacentHTML('beforeend','<a class="btn wide" href="#profile">Отмена</a>');
    return doc.body.innerHTML;
  }
  function orderActions(o,seller=false) {
    const button=(status,text,primary=false)=>`<button class="btn ${primary?'primary':'soft'} compact" data-action="order-status" data-id="${o.id}" data-value="${status}">${text}</button>`;
    return `<div class="order-actions"><span class="pill ${['accepted','completed'].includes(o.statusCode)?'green':'gray'}">${esc(o.status)}</span><button class="btn compact" data-action="order-detail" data-id="${o.id}">Подробнее</button>${seller?(o.statusCode==='pending'?button('accepted','Принять',true)+button('declined','Отклонить'):o.statusCode==='accepted'?button('completed','Завершить',true)+button('declined','Отклонить'):''):o.canReceive?button('received','Подтвердить получение',true):o.canCancel?button('cancelled','Отменить'):''}</div>`;
  }
  function incomingRow(o) {
    return `<article class="order-row inquiry-row"><div><strong>Заявка №${o.id} · ${esc(o.name)}</strong><small>${esc(o.city)} · ${esc(o.phone)}</small><small>${o.items.map(i=>esc(i.title)).join(', ')}</small></div><strong class="price">${money(o.total)}</strong>${orderActions(o,true)}</article>`;
  }
  async function orderDetail(id) {
    const o=await api('/orders/'+id);
    openModal(`Заявка №${o.id}`,`${o.kind==='assembly'?'Сборка ПК':'Покупка'} · ${esc(o.status)}`,`<div class="stack"><div class="order-detail-items">${o.items.map(p=>`<div class="between"><span>${esc(p.title)}${p.demo?' · Демо':''}</span><strong class="nowrap">${money(p.price)}</strong></div>`).join('')}</div><div class="between"><strong>Итого при отправке</strong><strong class="price">${money(o.total)}</strong></div><p class="small muted">Цены зафиксированы при отправке заявки. Оплата и доставка согласовываются отдельно.</p><div class="info"><strong>${esc(o.name)}</strong><br>${esc(o.phone)} · ${esc(o.city)}${o.address?`<br>${esc(o.address)}`:''}${o.note?`<p class="order-note">${esc(o.note)}</p>`:''}</div>${o.responses.map(r=>`<div class="between small"><span>${esc(r.seller)}</span><strong>${esc(r.status)}</strong></div>`).join('')}${o.kind==='assembly'?`<ol class="assembly-progress">${['Новая заявка','В работе','Готова к отправке','Отправлена','Завершена'].map((status,index)=>`<li class="${index<=['Новая заявка','В работе','Готова к отправке','Отправлена','Завершена'].indexOf(o.status)?'done':''}" ${status===o.status?'aria-current="step"':''}>${esc(status)}</li>`).join('')}</ol><div class="info"><strong>${esc(o.status)}</strong>${o.operator_note?`<p class="order-note">${esc(o.operator_note)}</p>`:''}${o.shipping_tracking?`<p>${esc(o.shipping_carrier)} · ${esc(o.shipping_tracking)}</p>`:''}</div>${o.canReceive?`<button class="btn primary" data-action="order-status" data-id="${o.id}" data-value="received">Подтвердить получение компьютера</button>`:''}<details class="assembly-history"><summary>История сборки</summary>${(o.events||[]).map(e=>`<article><small>${esc(new Date(e.created+'Z').toLocaleString('ru-RU'))}</small><strong>${esc(e.action)}</strong><p>${esc(e.reason)}</p></article>`).join('')||'<p>История доступна для новых действий по заявке.</p>'}</details>`:''}</div>`);
  }
  async function action(action,b) {
    const id=Number(b.dataset.id);
    if(action==='compare-toggle') {
      const key=compareKey(id,b.dataset.kind||'product'),p=resolveCompare(key);if(!p)return true;
      if(compared.includes(key))compared=compared.filter(n=>n!==key);
      else {compared=compared.filter(resolveCompare);if(compared.length>=4){toast('Можно сравнить до четырёх позиций. Убери один из выбранных.');return true}if(compared.length&&resolveCompare(compared[0]).category!==p.category){toast('Выбери товары или модели одной категории. Текущее сравнение можно очистить.');return true}compared.push(key)}
      saveCompare();if(location.hash==='#compare')await render();else afterRender();return true;
    }
    if(action==='compare-clear'){compared=[];saveCompare();if(location.hash==='#compare')await render();else afterRender();return true}
    if(action==='filter-remove'){const key=b.dataset.key;if(key==='city')state.city='';else if(key==='price'){state.filter.min='';state.filter.max=''}else if(key==='brand')state.filter.brand=state.filter.brand.filter(v=>v!==b.dataset.value);else state.filter[key]=key==='condition'?'all':'';syncFilters();return true}
    if(action==='photo-remove'){const form=b.closest('form');form.querySelector('[name=image]').value='';form.dataset.removeImage='true';form.querySelector('.photo-preview').hidden=true;form.querySelector('.photo-error').textContent='';return true}
    if(action==='order-detail'){await orderDetail(id);return true}
    if(action==='order-status') {
      const status=b.dataset.value;
      const labels={received:['Компьютер получен?','Подтверди, что получил собранный ПК. Заявка будет завершена.','Да, компьютер получен'],accepted:['Принять заявку?','Покупатель увидит, что ты готов обсудить сделку.','Принять'],declined:['Отклонить заявку?','Покупатель увидит отказ. Вернуть эту заявку в работу нельзя.','Отклонить'],completed:['Завершить заявку?','Подтверди, что сделка с покупателем действительно завершена.','Завершить'],cancelled:['Отменить заявку?','Продавцы увидят отмену. При необходимости можно отправить новую заявку.','Отменить заявку']};
      const [title,subtitle,label]=labels[status];
      openModal(title,subtitle,`<form id="order-status-form" class="stack" data-id="${id}" data-status="${status}"><p class="form-error"></p><button class="btn primary" type="submit">${label}</button><button class="btn" type="button" data-action="close-modal">Вернуться</button></form>`);return true;
    }
    if(action==='cart-add'&&own(find(id)||{})){toast('Это твоё объявление. Изменить его можно в профиле.');return true}
    return false;
  }
  async function submit(form,data) {
    if(form.id==='edit-listing-form'){
      const file=data.image;delete data.image;if(file?.size)data.image=await fileData(file);
      data.removeImage=form.dataset.removeImage==='true';
      await api('/listings/'+form.dataset.id,'PUT',data);ctx.clearDraft?.(form);await bootstrap();go('profile');toast('Изменения сохранены');return true;
    }
    if(form.id==='order-status-form'){
      await api('/orders/'+form.dataset.id,'PATCH',{status:form.dataset.status});document.getElementById('modal').close();await render();toast('Статус заявки обновлён');return true;
    }
    return false;
  }
  function change(el) {
    if(el.id==='compare-differences'){differences=el.checked;render()}
    if(el.matches('input[type=file][name=image]'))preview(el);
  }
  return {own,compareButton,comparePage,afterRender,readFilters,syncFilters,filterChips,pageItems,pagination,photoControl,editor,orderActions,incomingRow,action,submit,change};
}
