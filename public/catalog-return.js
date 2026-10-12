export function createCatalogReturn({esc,icon,go}){
  let saved=null,pending=null;
  try{const value=JSON.parse(sessionStorage.getItem('component-catalog-return'));if(valid(value))saved=value}catch{}
  function valid(value){return value&&typeof value.hash==='string'&&/^#catalog(?:\?|$)/.test(value.hash)&&value.hash.length<8000&&Number.isFinite(value.y)&&value.y>=0&&Number.isInteger(value.id)}
  document.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#product/"]');
    if(!link||!/^#catalog(?:\?|$)/.test(location.hash))return;
    saved={hash:location.hash,y:scrollY,panelY:document.getElementById('filters')?.scrollTop||0,id:Number(link.getAttribute('href').split('/')[1])};
    try{sessionStorage.setItem('component-catalog-return',JSON.stringify(saved))}catch{}
  });
  function afterRender(){
    if(location.hash.startsWith('#product/')&&saved){const page=document.querySelector('#main .page');if(page&&!page.querySelector('.catalog-return'))page.insertAdjacentHTML('afterbegin',`<a class="catalog-return link" href="${esc(saved.hash)}" data-action="catalog-return">${icon('arrow')} Вернуться к результатам</a>`)}
    if(pending&&location.hash===pending.hash){const position=pending;pending=null;requestAnimationFrame(()=>{if(location.hash!==position.hash)return;const panel=document.getElementById('filters');if(panel)panel.scrollTop=position.panelY;document.querySelector(`.product-title[href="#product/${position.id}"]`)?.focus({preventScroll:true});window.scrollTo(0,position.y)})}
  }
  function action(action){if(action!=='catalog-return'||!saved)return false;pending={...saved};go(saved.hash.slice(1));return true}
  return {afterRender,action};
}
