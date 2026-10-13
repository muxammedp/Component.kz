import {modelSteps,modelMatches,modelOptionsAt,narrowSelection} from './model-taxonomy.js';
export function createModelGuide({state,esc,render,modelOptions}){
 let focus=null;
 const save=()=>{try{localStorage.setItem('component-model-filters',JSON.stringify(state.builderFilters))}catch{}};
 function controls(category,selection,products,scope,includeModel=true){
  const steps=(modelSteps[category]||[]).filter(([k])=>includeModel||k!=='name');
  if(!steps.length)return '';
  return `<div class="model-guide" data-guide="${scope}"><div class="model-guide-heading"><div><strong>Подбор по модели</strong><small>Уточняй по шагам или используй поиск</small></div><button type="button" class="reset" data-action="model-guide-reset" data-scope="${scope}">Сбросить</button></div><div class="model-guide-fields">${steps.map(([key,label],i)=>{
   const options=modelOptionsAt(products,category,selection,i),value=selection[key]||'',enabled=i===0||!!selection[steps[i-1][0]];
   if(value&&!options.some(o=>o.value===value))options.push({value,count:0});
   return `<label class="field"><span><b>${i+1}</b> ${label}</span><select data-model-step="${key}" data-scope="${scope}" aria-label="${esc(label)}" ${enabled?'':'disabled'}><option value="">${enabled?'Все варианты':'Сначала выбери выше'}</option>${options.map(o=>`<option value="${esc(o.value)}" ${o.value===value?'selected':''}>${esc(o.value)} · ${o.count}</option>`).join('')}</select></label>`;
  }).join('')}</div></div>`;
 }
 const selection=()=>state.builderFilters[state.builderCategory]||{};
 function builder(){return controls(state.builderCategory,selection(),state.products.filter(p=>p.condition==='new'),'builder')+'<p class="small muted">Здесь модели с объявлениями. <a href="#models">Весь справочник →</a></p>'}
 function matches(p){return modelMatches(p,selection())}
 function formGuide(form,fromModel=false){
  const category=form.elements.category.value,field=form.elements.modelId;
  let host=form.querySelector('.listing-guide');
  if(!host){host=document.createElement('div');host.className='listing-guide';field.closest('label').before(host)}
  let hidden=form.elements.modelGuide;
  if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.name='modelGuide';form.append(hidden)}
  let path={};try{path=JSON.parse(hidden.value||'{}')}catch{}
  const model=state.models.find(p=>p.id===Number(field.value));
  if(model&&(fromModel||field.value))path=Object.fromEntries((modelSteps[category]||[]).filter(([key])=>key!=='name').map(([key])=>[key,model.model[key]]));
  if(!modelSteps[category])path={};
  hidden.value=JSON.stringify(path);
  host.innerHTML=controls(category,path,state.models,'listing',false);
  const id=field.value;field.innerHTML=modelOptions(category,path);field.value=id;
 }
 function afterRender(){
  const form=document.querySelector('#sell-form,#edit-listing-form');if(form)formGuide(form);
  if(focus){document.querySelector(focus)?.focus({preventScroll:true});focus=null}
 }
 function change(el){
  if(el.dataset.modelStep){
   const key=el.dataset.modelStep,scope=el.dataset.scope;
   if(scope==='builder'){
    state.builderFilters[state.builderCategory]=narrowSelection(state.builderCategory,selection(),key,el.value);state.builderLimit=24;save();
    focus=`[data-scope="builder"][data-model-step="${key}"]`;render();
   }else{
    const form=el.closest('form'),hidden=form.elements.modelGuide;
    hidden.value=JSON.stringify(narrowSelection(form.elements.category.value,JSON.parse(hidden.value||'{}'),key,el.value));
    form.elements.modelId.value='';formGuide(form);form.querySelector(`[data-model-step="${key}"]`)?.focus();hidden.dispatchEvent(new Event('change',{bubbles:true}));
   }
   return true;
  }
  if(el.id==='listing-category'){const form=el.form;if(form.elements.modelGuide)form.elements.modelGuide.value='{}';form.elements.modelId.innerHTML=modelOptions(el.value);formGuide(form);return true}
  if(el.id==='listing-model')formGuide(el.form,true);
  return false;
 }
 function action(action,b){
  if(action!=='model-guide-reset')return false;
  if(b.dataset.scope==='builder'){state.builderFilters[state.builderCategory]={};state.builderQ='';state.builderCondition='new';state.builderLimit=24;save();render()}
  else{const form=b.closest('form');form.elements.modelGuide.value='{}';form.elements.modelId.value='';formGuide(form);form.elements.modelGuide.dispatchEvent(new Event('change',{bubbles:true}))}
  return true;
 }
 document.addEventListener('model-guide-restore',e=>formGuide(e.target));
 return {builder,matches,afterRender,change,action};
}
