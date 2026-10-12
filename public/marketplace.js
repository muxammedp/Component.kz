import {specFields} from './catalog-search.js';
export function createMarketplace(ctx) {
  const {state,esc,money,icon,api,find,go,render,bootstrap,toast,openModal,productImage,categoryName,modelOptions,sell,loginGate}=ctx;
  let compared=[];
  try {const saved=JSON.parse(localStorage.getItem('component-compare'));if(Array.isArray(saved))compared=[...new Set(saved.filter(Number.isInteger))].slice(0,4)} catch {}
  let differences=false;
  const own=p=>!!state.user&&p.owner_id===state.user.id;
  const saveCompare=()=>{try{localStorage.setItem('component-compare',JSON.stringify(compared))}catch{}};
  function compareButton(p) {
    const selected=compared.includes(p.id);
    return `<button type="button" class="compare-button ${selected?'selected':''}" data-action="compare-toggle" data-id="${p.id}" aria-pressed="${selected}" aria-label="${selected?'Убрать из сравнения':'Сравнить'}: ${esc(p.title)}">${icon('swap')} ${selected?'В сравнении':'Сравнить'}</button>`;
  }
  function afterRender() {
    compared=compared.filter(id=>find(id));saveCompare();
    let tools=document.getElementById('marketplace-tools');
    if(!tools){tools=document.createElement('div');tools.id='marketplace-tools';document.body.append(tools)}
    const page=location.hash.slice(1).split('?')[0]||'home';
    const showTray=compared.length>0&&(['home','catalog','favorites','cart'].includes(page)||page.startsWith('product/'));
    tools.innerHTML=`${showTray?`<aside class="compare-tray" aria-label="Выбрано для сравнения"><div><strong>Сравнение · ${compared.length} из 4</strong><small>${esc(categoryName(find(compared[0])?.category))}</small></div><a class="btn primary compact" href="#compare">Сравнить ${icon('arrow')}</a><button class="icon-btn" data-action="compare-clear" aria-label="Очистить сравнение">${icon('close')}</button></aside>`:''}<nav class="mobile-bottom" aria-label="Навигация на телефоне">${[['home','box','Главная'],['catalog','grid','Каталог'],['builder','tool','Собрать ПК'],['cart','cart','Корзина'],['profile','user','Профиль']].map(([href,i,label])=>`<a href="#${href}" ${page===href?'aria-current="page"':''}>${icon(i)}<span>${label}</span></a>`).join('')}</nav>`;
    document.body.classList.toggle('has-compare-tray',showTray);
    document.querySelectorAll('.compare-button').forEach(button=>{const p=find(Number(button.dataset.id));if(p)button.outerHTML=compareButton(p)});
  }
  const value=v=>Array.isArray(v)?v.join(', '):String(v??'—');
  function comparePage() {
    const items=compared.map(find).filter(Boolean);
    if(!items.length)return `<div class="container page"><h1 class="page-heading">Сравнение товаров</h1><div class="empty">${icon('swap')}<h3>Выбери, что сравнить</h3><p>Добавь до четырёх товаров одной категории кнопкой «Сравнить» в каталоге.</p><a class="btn primary" href="#catalog">Выбрать товары ${icon('arrow')}</a></div></div>`;
    const keys=[...new Set(items.flatMap(p=>Object.keys(p.spec)))].filter(k=>k!=='referenceId');
    const rows=[['Цена',p=>money(p.price)],['Состояние',p=>p.condition==='used'?'Б/у':'Новое'],['Город',p=>p.city],['Бренд',p=>p.brand],...keys.map(k=>[ctx.getSpecLabels()[k]||k,p=>value(p.spec[k])])];
    const visible=rows.filter(([,get])=>!differences||new Set(items.map(get)).size>1);
    return `<div class="container page"><div class="breadcrumb"><a href="#catalog">Каталог</a>${icon('chevron')}<span>Сравнение</span></div><div class="section-head"><div><h1 class="page-heading">Сравни и выбери своё</h1><p class="page-subtitle">${esc(categoryName(items[0].category))} · ${items.length} из 4 товаров</p></div><a class="btn soft" href="#catalog?category=${items[0].category}">${icon('plus')} Добавить товар</a></div><div class="between comparison-controls"><label class="check"><input type="checkbox" id="compare-differences" ${differences?'checked':''}>Только различия</label><button class="reset" data-action="compare-clear">Очистить всё</button></div><div class="comparison-scroll" tabindex="0" role="region" aria-label="Таблица сравнения, прокручивается по горизонтали"><table class="comparison-table"><thead><tr><th scope="col">Характеристики<small>Прокрути таблицу, чтобы увидеть все товары</small></th>${items.map(p=>`<th scope="col"><div class="comparison-product"><button class="icon-btn" data-action="compare-toggle" data-id="${p.id}" aria-label="Убрать из сравнения">${icon('close')}</button><a class="comparison-image" href="#product/${p.id}">${productImage(p)}</a><a href="#product/${p.id}">${esc(p.title)}</a><small>${p.demo?'Демо-предложение':esc(p.seller)}</small><strong class="price">${money(p.price)}</strong><a class="btn soft compact" href="#product/${p.id}">Подробнее ${icon('arrow')}</a></div></th>`).join('')}</tr></thead><tbody>${visible.map(([label,get])=>`<tr><th scope="row">${esc(label)}</th>${items.map(p=>`<td>${esc(get(p))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${items.length+1}">В выбранных характеристиках различий нет.</td></tr>`}</tbody></table></div><p class="ai-fineprint">Характеристики моделей из справочника. Состояние и комплектность б/у товара уточни у продавца. Прочерк означает, что данные не указаны.</p></div>`;
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
    for(const [key,v] of Object.entries({...p,modelId:p.spec.referenceId||''})) {
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
    return `<div class="order-actions"><span class="pill ${['accepted','completed'].includes(o.statusCode)?'green':'gray'}">${esc(o.status)}</span><button class="btn compact" data-action="order-detail" data-id="${o.id}">Подробнее</button>${seller?(o.statusCode==='pending'?button('accepted','Принять',true)+button('declined','Отклонить'):o.statusCode==='accepted'?button('completed','Завершить',true)+button('declined','Отклонить'):''):o.canCancel?button('cancelled','Отменить'):''}</div>`;
  }
  function incomingRow(o) {
    return `<article class="order-row inquiry-row"><div><strong>Заявка №${o.id} · ${esc(o.name)}</strong><small>${esc(o.city)} · ${esc(o.phone)}</small><small>${o.items.map(i=>esc(i.title)).join(', ')}</small></div><strong class="price">${money(o.total)}</strong>${orderActions(o,true)}</article>`;
  }
  async function orderDetail(id) {
    const o=await api('/orders/'+id);
    openModal(`Заявка №${o.id}`,`${o.kind==='assembly'?'Сборка ПК':'Покупка'} · ${esc(o.status)}`,`<div class="stack"><div class="order-detail-items">${o.items.map(p=>`<div class="between"><span>${esc(p.title)}${p.demo?' · Демо':''}</span><strong class="nowrap">${money(p.price)}</strong></div>`).join('')}</div><div class="between"><strong>Итого при отправке</strong><strong class="price">${money(o.total)}</strong></div><p class="small muted">Цены зафиксированы при отправке заявки. Оплата и доставка согласовываются отдельно.</p><div class="info"><strong>${esc(o.name)}</strong><br>${esc(o.phone)} · ${esc(o.city)}${o.note?`<p class="order-note">${esc(o.note)}</p>`:''}</div>${o.responses.map(r=>`<div class="between small"><span>${esc(r.seller)}</span><strong>${esc(r.status)}</strong></div>`).join('')}${o.kind==='assembly'?'<p class="small muted">Заявка ожидает оператора сервиса. Автоматическая передача внешнему сборщику пока не подключена.</p>':''}</div>`);
  }
  async function action(action,b) {
    const id=Number(b.dataset.id);
    if(action==='compare-toggle') {
      const p=find(id);if(!p)return true;
      if(compared.includes(id))compared=compared.filter(n=>n!==id);
      else {compared=compared.filter(n=>find(n));if(compared.length>=4){toast('Можно сравнить до четырёх товаров. Убери один из выбранных.');return true}if(compared.length&&find(compared[0]).category!==p.category){toast('Выбери товары одной категории. Текущее сравнение можно очистить.');return true}compared.push(id)}
      saveCompare();if(location.hash==='#compare')await render();else afterRender();return true;
    }
    if(action==='compare-clear'){compared=[];saveCompare();if(location.hash==='#compare')await render();else afterRender();return true}
    if(action==='filter-remove'){const key=b.dataset.key;if(key==='city')state.city='';else if(key==='price'){state.filter.min='';state.filter.max=''}else if(key==='brand')state.filter.brand=state.filter.brand.filter(v=>v!==b.dataset.value);else state.filter[key]=key==='condition'?'all':'';syncFilters();return true}
    if(action==='photo-remove'){const form=b.closest('form');form.querySelector('[name=image]').value='';form.dataset.removeImage='true';form.querySelector('.photo-preview').hidden=true;form.querySelector('.photo-error').textContent='';return true}
    if(action==='order-detail'){await orderDetail(id);return true}
    if(action==='order-status') {
      const status=b.dataset.value;
      const labels={accepted:['Принять заявку?','Покупатель увидит, что ты готов обсудить сделку.','Принять'],declined:['Отклонить заявку?','Покупатель увидит отказ. Вернуть эту заявку в работу нельзя.','Отклонить'],completed:['Завершить заявку?','Подтверди, что сделка с покупателем действительно завершена.','Завершить'],cancelled:['Отменить заявку?','Продавцы увидят отмену. При необходимости можно отправить новую заявку.','Отменить заявку']};
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
