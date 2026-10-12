import {filterProducts,effectiveQuery,suggestQueries,specFields,parsePrice,normalizeSearch,refineCategory} from './catalog-search.js';
export function createDiscovery(ctx){
  const {state,esc,icon,money,market,card,categories,breadcrumb,demoNote,go}=ctx;
  let view=null,priceDraft=null,brandQuery='',brandCategory='';
  const list=(ignore='')=>filterProducts(state.products,ignore==='category'?{...state.filter,spec:{}}:state.filter,state.city,ignore);
  const context=()=>[state.filter.category,state.filter.q].join('|');
  function remember(el){
    view={y:scrollY,panelY:document.querySelector('#filters')?.scrollTop||0,selector:el?.dataset.brand?`[data-brand="${CSS.escape(el.dataset.brand)}"]`:el?.dataset.spec?`[data-spec="${el.dataset.spec}"][value="${CSS.escape(el.value)}"]`:el?.dataset.filter?`[data-filter="${el.dataset.filter}"]${el.type==='radio'?`[value="${el.value}"]`:''}`:null};
  }
  function afterRender(){
    if(!location.hash.startsWith('#catalog')){state.filtersOpen=false;document.body.classList.remove('filters-open');view=null;priceDraft=null;return}
    updateBrands();
    document.body.classList.toggle('filters-open',!!state.filtersOpen);
    document.querySelector('#filters')?.classList.toggle('open',!!state.filtersOpen);
    if(priceDraft&&priceDraft.context===context()&&priceDraft.applied===state.filter.min+'|'+state.filter.max){for(const k of ['min','max'])document.querySelector(`#price-filter [name=${k}]`).value=priceDraft[k]}else priceDraft=null;
    if(view){const saved=view;view=null;document.querySelector('#filters').scrollTop=saved.panelY;if(saved.selector)document.querySelector(saved.selector)?.focus({preventScroll:true});window.scrollTo(0,saved.y)}
  }
  function updateBrands(){
    const input=document.querySelector('#brand-search');if(!input)return;
    input.value=brandQuery;let visible=0;
    document.querySelectorAll('.brand-options .check').forEach(label=>{const control=label.querySelector('[data-brand]');const matches=normalizeSearch(control.dataset.brand).includes(normalizeSearch(brandQuery));label.hidden=!matches&&!control.checked;if(!label.hidden)visible++});
    const note=document.getElementById('brand-search-status');note.textContent=visible?'':'Такого бренда нет в этой категории. Очисти поиск по брендам.';
  }
  function facets(){
    const f=state.filter;
    if(brandCategory!==f.category){brandCategory=f.category;brandQuery=''}
    const categoryOptions=[{id:'all',name:'Все категории'},...state.categories].map(c=>{const filter=c.id===f.category?f:refineCategory(state.products,f,c.id);return `<option value="${c.id}" ${f.category===c.id?'selected':''}>${esc(c.name)} (${filterProducts(state.products,filter,state.city).length})</option>`}).join('');
    const condition=list('condition'),brandPool=list('brand');
    const brands=[...new Set([...state.products.filter(p=>f.category==='all'||p.category===f.category).map(p=>p.brand),...f.brand])].sort((a,b)=>a.localeCompare(b,'ru'));
    const count=(items,predicate)=>items.filter(predicate).length;
    const checkbox=(label,n,attributes,checked)=>`<label class="check ${!n&&!checked?'unavailable':''}"><input type="checkbox" ${attributes} ${checked?'checked':''} ${!n&&!checked?'disabled':''}><span>${esc(label)}</span><span class="facet-count">${n}</span></label>`;
    const cities=[...new Set([...state.products.map(p=>p.city),state.city].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    return `<aside class="panel filters ${state.filtersOpen?'open':''}" id="filters"><div class="between"><h3>Фильтры</h3><button class="reset" data-action="reset-filters">Сбросить всё</button></div><div class="filter-group"><strong>Категория результатов</strong><select class="select" data-filter="category" aria-label="Категория результатов">${categoryOptions}</select><small class="facet-help">Запрос, цена и город сохранятся.</small></div><div class="filter-group"><strong>Цена, ₸</strong><form id="price-filter"><div class="fields-2"><input class="input" type="text" inputmode="numeric" name="min" placeholder="От" aria-label="Цена от" value="${esc(f.min)}"><input class="input" type="text" inputmode="numeric" name="max" placeholder="До" aria-label="Цена до" value="${esc(f.max)}"></div><p class="form-error" role="alert">${f.min&&f.max&&Number(f.min)>Number(f.max)?'Цена «от» больше цены «до». Исправь диапазон.':''}</p><button class="btn soft compact wide" type="submit">Применить цену</button></form></div><div class="filter-group"><strong>Состояние</strong>${[['all','Любое'],['new','Новые'],['used','Б/у']].map(([v,t])=>{const n=count(condition,p=>v==='all'||p.condition===v);return `<label class="check ${!n&&f.condition!==v?'unavailable':''}"><input type="radio" name="condition" value="${v}" data-filter="condition" ${f.condition===v?'checked':''} ${!n&&f.condition!==v?'disabled':''}><span>${t}</span><span class="facet-count">${n}</span></label>`}).join('')}</div><div class="filter-group"><strong>Бренд</strong>${brands.length>5?`<div class="brand-search"><input id="brand-search" class="input" type="search" placeholder="Найти бренд" aria-label="Найти бренд в фильтрах" value="${esc(brandQuery)}"><button class="icon-btn" type="button" data-action="brand-search-clear" aria-label="Очистить поиск бренда">${icon('close')}</button></div><p id="brand-search-status" class="small muted" role="status"></p>`:''}<div class="brand-options">${brands.map(b=>checkbox(b,count(brandPool,p=>p.brand===b),`data-brand="${esc(b)}"`,f.brand.includes(b))).join('')}</div></div>${(specFields[f.category]||[]).map(([key,label])=>{const pool=list('spec.'+key),values=[...new Set([...state.products.filter(p=>p.category===f.category).flatMap(p=>[].concat(p.spec?.[key]??[]).map(String)),...(f.spec?.[key]||[])])].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}));return `<div class="filter-group"><strong>${label}</strong>${values.map(v=>checkbox(v,count(pool,p=>[].concat(p.spec?.[key]??[]).map(String).includes(v)),`data-spec="${key}" value="${esc(v)}"`,f.spec?.[key]?.includes(v))).join('')}</div>`}).join('')}<div class="filter-group"><strong>Город</strong><select class="select" data-filter="city" aria-label="Город"><option value="">Весь Казахстан</option>${cities.map(c=>`<option value="${esc(c)}" ${state.city===c?'selected':''}>${esc(c)} (${count(list('city'),p=>p.city===c)})</option>`).join('')}</select></div><div class="filter-group"><strong>Тип объявления</strong><select class="select" data-filter="source" aria-label="Тип объявления">${[['all','Все объявления'],['real','Только реальные'],['demo','Демонстрационные']].map(([v,t])=>`<option value="${v}" ${f.source===v?'selected':''}>${t}</option>`).join('')}</select></div><button class="btn primary wide filters-done" data-action="filters-done">Показать ${list().length} объявлений ${icon('arrow')}</button></aside>`;
  }
  function emptyResults(){
    const f=state.filter,suggestions=suggestQueries(state.products,f.q);
    const relax=[['city','Во всех городах',!!state.city],['price','Без ограничения цены',!!(f.min||f.max)],['brand','Все бренды',!!f.brand.length],['condition','Любое состояние',f.condition!=='all'],['category','Во всех категориях',f.category!=='all'],['source','Все типы объявлений',f.source!=='all'],...Object.keys(f.spec||{}).map(k=>['spec.'+k,'Без фильтра «'+(specFields[f.category]?.find(([key])=>key===k)?.[1]||k)+'»',f.spec[k].length>0])].filter(([, ,active])=>active).map(([key,label])=>({key,label,count:list(key).length})).filter(x=>x.count);
    return `<div class="empty search-empty">${icon('search')}<h3>По этим условиям ничего не найдено</h3><p>Попробуй уточнить модель или снять одно из ограничений.</p>${suggestions.length?`<div class="search-recovery"><strong>Возможно, ты искал:</strong>${suggestions.map(q=>`<button class="btn soft compact" data-action="search-suggestion" data-value="${esc(q)}">${esc(q)}</button>`).join('')}</div>`:''}${relax.length?`<div class="search-recovery">${relax.map(r=>`<button class="btn soft compact" data-action="relax-filter" data-key="${r.key}">${esc(r.label)} · ${r.count}</button>`).join('')}</div>`:''}<div class="search-recovery">${f.q?'<button class="btn" data-action="search-everywhere">Искать запрос во всём каталоге</button>':''}<button class="btn primary" data-action="reset-filters">Сбросить фильтры</button></div></div>`;
  }
  function page(){
    const f=state.filter,items=list(),effective=effectiveQuery(state.products,f.q);
    return `<div class="container page">${breadcrumb([['Каталог']])}<h1 class="page-heading">${f.category==='all'?'Каталог комплектующих':state.categories.find(c=>c.id===f.category)?.name||'Каталог'}</h1><p class="page-subtitle">Найди именно то, что нужно твоему ПК</p><div class="catalog-layout">${facets()}<section>${categories(false)}${f.q?`<div class="search-context"><span>Поиск: <strong>${esc(f.q)}</strong>${effective.corrected?`<small>Исправлена раскладка: ${esc(effective.query)}</small>`:''}</span><button class="reset" data-action="search-clear">Очистить запрос</button><button class="reset" data-action="search-everywhere">Во всём каталоге</button></div>`:''}${market.filterChips()}<div class="catalog-toolbar" id="catalog-results" tabindex="-1"><span role="status">Найдено объявлений: <strong>${items.length}</strong></span><button class="btn compact mobile-filter" data-action="filters-toggle" aria-expanded="${!!state.filtersOpen}" aria-controls="filters">${icon('filter')} Фильтры</button><select class="select" data-filter="sort" aria-label="Сортировка">${[['popular',f.q?'По релевантности':'Сначала реальные'],['cheap','Сначала дешевле'],['expensive','Сначала дороже'],['recent','Сначала новые объявления']].map(([v,t])=>`<option value="${v}" ${f.sort===v?'selected':''}>${t}</option>`).join('')}</select></div>${items.length?`<div class="products-grid">${market.pageItems(items).map(card).join('')}</div>`:emptyResults()}${market.pagination(items)}${demoNote()}</section></div></div>`;
  }
  function clear(key){const f=state.filter;if(key==='city')state.city='';else if(key==='price'){f.min='';f.max='';priceDraft=null}else if(key==='brand')f.brand=[];else if(key.startsWith('spec.'))delete f.spec[key.slice(5)];else f[key]='all'}
  async function action(action,b){
    if(action==='brand-search-clear'){brandQuery='';updateBrands();document.querySelector('#brand-search')?.focus();return true}
    if(action==='filters-toggle'){state.filtersOpen=!state.filtersOpen;document.body.classList.toggle('filters-open',state.filtersOpen);document.querySelector('#filters').classList.toggle('open',state.filtersOpen);b.setAttribute('aria-expanded',state.filtersOpen);if(state.filtersOpen)document.querySelector('#filters').scrollIntoView({block:'start',behavior:'smooth'});return true}
    if(action==='filters-done'){state.filtersOpen=false;document.body.classList.remove('filters-open');document.querySelector('#filters').classList.remove('open');document.querySelector('[data-action=filters-toggle]').setAttribute('aria-expanded','false');document.querySelector('#catalog-results').focus();return true}
    if(action==='search-clear'){state.filter.q='';market.syncFilters();return true}
    if(action==='search-suggestion'){state.filter.q=b.dataset.value;market.syncFilters();return true}
    if(action==='search-everywhere'){priceDraft=null;go('catalog?q='+encodeURIComponent(state.filter.q));return true}
    if(action==='relax-filter'){clear(b.dataset.key);market.syncFilters();return true}
    if(action==='reset-filters'){priceDraft=null;state.filtersOpen=false;brandQuery=''}
    if(action==='filter-remove'&&b.dataset.key.startsWith('spec.')){const key=b.dataset.key.slice(5);state.filter.spec[key]=state.filter.spec[key].filter(v=>v!==b.dataset.value);market.syncFilters();return true}
    return false;
  }
  function change(el){
    if(el.dataset.filter||el.dataset.brand||el.dataset.spec)remember(el);
    if(el.dataset.filter==='category'){const previous=state.filter;state.filter=refineCategory(state.products,previous,el.value);if(previous.brand.length!==state.filter.brand.length||Object.values(previous.spec||{}).some(v=>v.length))ctx.toast('Категория изменена. Несовместимые бренды и параметры сброшены.');priceDraft=null;market.syncFilters();return true}
    if(el.dataset.spec){const key=el.dataset.spec,values=state.filter.spec[key]||[];state.filter.spec[key]=el.checked?[...values,el.value]:values.filter(v=>v!==el.value);market.syncFilters();return true}
    return false;
  }
  function submit(form,values){
    if(form.id==='search-form'){const q=values.q.trim().replace(/\s+/g,' ').slice(0,120);if(location.hash.startsWith('#catalog')){state.filter.q=q;market.syncFilters()}else go('catalog?q='+encodeURIComponent(q));return true}
    if(form.id==='price-filter'){const min=parsePrice(values.min),max=parsePrice(values.max);if(min&&max&&Number(min)>Number(max))throw new Error('Цена «от» не может быть больше цены «до».');remember(form.querySelector('[name=min]'));state.filter.min=min;state.filter.max=max;priceDraft=null;market.syncFilters();return true}
    return false;
  }
  document.addEventListener('input',e=>{if(e.target.id==='brand-search'){brandQuery=e.target.value;updateBrands();return}if(e.target.form?.id==='price-filter'){const form=e.target.form;priceDraft={context:context(),applied:state.filter.min+'|'+state.filter.max,min:form.elements.min.value,max:form.elements.max.value};form.querySelector('.form-error').textContent=''}});
  return {page,afterRender,action,change,submit};
}
