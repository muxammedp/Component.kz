export function createMessenger({state,api,esc,money,icon,go,toast,openModal,requireUser,loginGate}){
 let timer=null,generation=0,active=null,busy=false,lastUser=null;
 const drafts=new Map();
 const route=()=>location.hash.slice(1).split('?')[0];
 const date=v=>new Date(v+'Z').toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const key=id=>`${state.user?.id}:${id}`;
 function count(n){state.messageUnread=n;document.querySelectorAll('[data-message-count]').forEach(el=>{el.textContent=n>99?'99+':n;el.hidden=!n});document.querySelectorAll('[data-message-link]').forEach(el=>el.setAttribute('aria-label',n?`Сообщения: ${n} непрочитанных`:'Сообщения'))}
 function contactButton(p){return p.demo||!p.owner_id?'<p class="small muted">У демо-объявления нет реального продавца для переписки.</p>':p.owner_id===state.user?.id?`<a class="btn soft wide" href="#messages">${icon('chat')} Сообщения покупателей</a>`:`<button class="btn soft wide" data-action="message-start" data-id="${p.id}">${icon('chat')} Написать продавцу</button>`}
 function list(data,id){const q=new URLSearchParams(location.hash.split('?')[1]||''),pageLink=offset=>{const p=new URLSearchParams(q);p.set('offset',offset);return '#messages'+(id?'/'+id:'')+'?'+esc(p)};return `${data.items.length?data.items.map(c=>`<a class="chat-thread ${c.id===id?'selected':''}" href="#messages/${c.id}?${esc(q)}" ${c.id===id?'aria-current="page"':''}><span class="chat-avatar">${esc(c.peer.name.slice(0,2).toUpperCase())}</span><span class="chat-thread-copy"><strong>${esc(c.peer.name)}</strong><span>${esc(c.title)}</span><small>${c.last.senderId===state.user.id?'Вы: ':''}${esc(c.last.text)}</small></span>${c.unread?`<span class="chat-unread">${c.unread>99?'99+':c.unread}</span>`:''}</a>`).join(''):'<div class="chat-empty-list"><strong>Диалогов пока нет</strong><p>Напиши продавцу из объявления или измени поисковый запрос.</p><a class="link" href="#catalog">Открыть каталог →</a></div>'}<div class="chat-pagination">${data.offset>0?`<a href="${pageLink(Math.max(0,data.offset-30))}">← Назад</a>`:''}${data.offset+30<data.total?`<a href="${pageLink(data.offset+30)}">Далее →</a>`:''}</div>`}
 function bubble(m,peerRead){const own=m.senderId===state.user.id;return `<article class="chat-message ${own?'own':''}" data-message-id="${m.id}"><p>${esc(m.text)}</p><small><time>${esc(date(m.created))}</time>${own?`<span data-receipt="${m.id}">${m.id<=peerRead?'Прочитано':'Отправлено'}</span>`:''}</small></article>`}
 async function page(path,query=''){
  if(!state.user)return loginGate('Сообщения с продавцами','Войди, чтобы обсуждать товары и получать ответы.');
  const id=path.split('/')[1]?Number(path.split('/')[1]):null;
  if(id!==null&&(!Number.isSafeInteger(id)||id<1))throw new Error('Диалог не найден.');
  const data=await api('/conversations?'+query),thread=id?await api('/conversations/'+id):null,c=thread?.conversation;
  const q=new URLSearchParams(query);
  return `<div class="container page messages-page"><div class="messages-heading"><div><h1 class="page-heading">Сообщения</h1><p class="page-subtitle">Обсуди состояние, цену и передачу товара напрямую.</p></div><a class="btn soft" href="#catalog">В каталог ${icon('arrow')}</a></div><div class="chat-layout ${id?'has-thread':''}" data-chat-user="${state.user.id}" data-chat-id="${id||''}"><aside class="chat-sidebar"><form id="chat-search" class="search"><input name="q" maxlength="120" value="${esc(q.get('q')||'')}" aria-label="Поиск диалогов" placeholder="Продавец или товар"><button type="submit" aria-label="Найти диалог">${icon('search')}</button></form><div id="chat-threads">${list(data,id)}</div></aside><section class="chat-main">${c?`<header class="chat-head"><a class="chat-back icon-btn" href="#messages" aria-label="Назад к диалогам">←</a><span class="chat-avatar">${esc(c.peer.name.slice(0,2).toUpperCase())}</span><div><h2>${esc(c.peer.name)}</h2><p>${c.role==='buyer'?'Продавец':'Покупатель'}</p></div></header><div class="chat-product">${icon('box')}<div>${c.available?`<a href="#product/${c.productId}">${esc(c.title)} ↗</a>`:`<strong>${esc(c.title)}</strong>`}<small>${money(c.price)} · цена при начале диалога<span id="chat-availability">${c.available?'':' · Объявление недоступно, переписка сохранена'}</span></small></div></div><div class="chat-messages" id="chat-messages" tabindex="0" aria-label="История сообщений"><button class="btn soft compact chat-older" data-action="message-older" ${thread.hasOlder?'':'hidden'}>Загрузить предыдущие</button><div id="chat-bubbles">${thread.items.map(m=>bubble(m,c.peerReadId)).join('')}</div></div><button class="chat-new" data-action="message-bottom" hidden>Новые сообщения ↓</button><p id="chat-connection" class="small muted" role="status">Сообщения обновляются автоматически</p><form id="chat-send" data-id="${id}" class="chat-compose"><label class="sr-only" for="chat-text">Сообщение</label><textarea id="chat-text" name="text" required maxlength="3000" rows="2" placeholder="Напиши сообщение…">${esc(drafts.get(key(id))?.text||'')}</textarea><button class="btn primary" type="submit" aria-label="Отправить сообщение">${icon('arrow')}<span>Отправить</span></button><p class="form-error" role="alert"></p><small class="muted">До 3 000 символов · Ctrl + Enter — отправить</small></form>`:`<div class="chat-welcome">${icon('chat')}<h2>Выбери диалог</h2><p>Здесь можно уточнить характеристики, договориться о цене и встрече.</p><a class="btn primary" href="#catalog">Найти товар</a></div>`}</section></div></div>`;
 }
 const valid=a=>a&&active===a&&state.user?.id===a.user&&route()==='messages/'+a.id;
 const nearBottom=el=>el.scrollHeight-el.scrollTop-el.clientHeight<75;
 function fitChat(){
  const el=document.querySelector('.chat-layout'),vv=window.visualViewport,mobile=innerWidth<=600;
  const keyboard=!!(el&&mobile&&vv&&innerHeight-vv.height>150&&document.activeElement?.id==='chat-text');
  document.body.classList.toggle('chat-keyboard',keyboard);
  if(!el)return;if(!mobile){el.style.removeProperty('height');el.style.removeProperty('min-height');el.style.removeProperty('top');return}
  const scroll=document.querySelector('#chat-messages'),bottom=scroll&&nearBottom(scroll),nav=document.querySelector('.mobile-bottom');
  const available=keyboard?vv.height-16:(vv?.height||innerHeight)+(vv?.offsetTop||0)-Math.max(el.getBoundingClientRect().top,vv?.offsetTop||0)-(nav?.getBoundingClientRect().height||0)-16;
  el.style.height=Math.max(280,available)+'px';el.style.minHeight='0';el.style.top=keyboard?(vv.offsetTop+8)+'px':'';
  if(bottom)scroll.scrollTop=scroll.scrollHeight;
 }
 function append(items,a){const box=document.querySelector('#chat-bubbles');if(!box||!valid(a))return;for(const m of items){if(!box.querySelector(`[data-message-id="${m.id}"]`))box.insertAdjacentHTML('beforeend',bubble(m,a.peerRead));a.last=Math.max(a.last,m.id)}}
 async function acknowledge(a){if(!valid(a)||document.hidden||!nearBottom(document.querySelector('#chat-messages'))||a.last<=a.read||a.acking)return;a.acking=true;const through=a.last;try{const r=await api(`/conversations/${a.id}/read`,'POST',{throughId:through});if(valid(a)){a.read=Math.max(a.read,through);count(r.unread)}}catch{}finally{a.acking=false}}
 async function poll(){
  const g=generation,user=state.user?.id;if(!user||document.hidden||busy)return;busy=true;
  try{
   if(!route().startsWith('messages')){const r=await api('/conversations/unread');if(g===generation&&state.user?.id===user)count(r.unread);return}
   const a=active;if(a){const r=await api(`/conversations/${a.id}?after=${a.last}`);if(g!==generation||!valid(a))return;const scroll=document.querySelector('#chat-messages'),bottom=nearBottom(scroll);a.peerRead=r.conversation.peerReadId;append(r.items,a);document.querySelectorAll('[data-receipt]').forEach(el=>el.textContent=Number(el.dataset.receipt)<=a.peerRead?'Прочитано':'Отправлено');document.querySelector('#chat-availability').textContent=r.conversation.available?'':' · Объявление недоступно, переписка сохранена';if(bottom)scroll.scrollTop=scroll.scrollHeight;else if(r.items.length)document.querySelector('.chat-new').hidden=false;await acknowledge(a);if(valid(a))document.querySelector('#chat-connection').textContent='Сообщения обновляются автоматически'}
   const r=await api('/conversations?'+(location.hash.split('?')[1]||''));if(g!==generation||state.user?.id!==user)return;count(r.unread);const el=document.querySelector('#chat-threads');if(el){const pos=el.scrollTop;el.innerHTML=list(r,active?.id);el.scrollTop=pos}
  }catch(e){if(g===generation){const el=document.querySelector('#chat-connection');if(el)el.textContent=e.status===401?'Сессия закончилась. Войди снова.':'Нет связи. Сообщения сохранены на сервере; повторяем подключение…'}}finally{busy=false}
 }
 function afterRender(){
  generation++;clearInterval(timer);active=null;
  if(lastUser!==state.user?.id){drafts.clear();lastUser=state.user?.id;count(state.messageUnread||0)}else count(state.messageUnread||0);
  fitChat();if(!state.user)return;
  const layout=document.querySelector('.chat-layout');if(layout?.dataset.chatId){const ids=[...layout.querySelectorAll('[data-message-id]')].map(el=>Number(el.dataset.messageId));active={id:Number(layout.dataset.chatId),user:state.user.id,last:Math.max(0,...ids),read:0,peerRead:0,acking:false};const a=active,scroll=document.querySelector('#chat-messages');scroll.scrollTop=scroll.scrollHeight;scroll.addEventListener('scroll',()=>{if(nearBottom(scroll)){document.querySelector('.chat-new').hidden=true;acknowledge(a)}});acknowledge(a)}
  poll();timer=setInterval(poll,4000);
 }
 async function action(name,b){
  if(name==='message-start'){
   if(!requireUser())return true;const p=state.products.find(p=>p.id===Number(b.dataset.id));if(!p||p.demo||!p.owner_id||p.owner_id===state.user.id)return true;
   openModal('Написать продавцу',esc(p.title),`<form id="chat-start" class="stack" data-product="${p.id}" data-key="${crypto.randomUUID()}"><label class="field">Сообщение<textarea name="text" required maxlength="3000" rows="4" placeholder="Здравствуйте! Товар ещё в продаже?"></textarea></label><p class="small muted">Продавец увидит твоё имя и сообщение. Телефон и email автоматически не передаются.</p><p class="form-error" role="alert"></p><button class="btn primary" type="submit">Отправить сообщение ${icon('arrow')}</button></form>`);return true;
  }
  if(name==='message-bottom'){const el=document.querySelector('#chat-messages');el.scrollTop=el.scrollHeight;b.hidden=true;await acknowledge(active);return true}
  if(name==='message-older'){
   const a=active;if(!a)return true;const scroll=document.querySelector('#chat-messages'),first=Number(document.querySelector('[data-message-id]')?.dataset.messageId);b.disabled=true;
   try{const r=await api(`/conversations/${a.id}?before=${first}`);if(!valid(a))return true;const height=scroll.scrollHeight,pos=scroll.scrollTop;document.querySelector('#chat-bubbles').insertAdjacentHTML('afterbegin',r.items.map(m=>bubble(m,r.conversation.peerReadId)).join(''));b.hidden=!r.hasOlder;scroll.scrollTop=pos+scroll.scrollHeight-height}finally{b.disabled=false}return true;
  }
  return false;
 }
 async function submit(form,f){
  if(form.id==='chat-search'){go('messages?q='+encodeURIComponent(f.q.trim()));return true}
  if(form.id==='chat-start'){const text=f.text.trim();if(form.dataset.sentText&&form.dataset.sentText!==text)form.dataset.key=crypto.randomUUID();form.dataset.sentText=text;const r=await api('/conversations','POST',{productId:Number(form.dataset.product),text,clientKey:form.dataset.key});document.querySelector('#modal').close();go('messages/'+r.conversation.id);return true}
  if(form.id!=='chat-send')return false;
  const a=active,text=f.text.trim();if(!valid(a))throw new Error('Открой диалог заново.');const draft=drafts.get(key(a.id));const clientKey=draft?.sentText===text?draft.clientKey:crypto.randomUUID();drafts.set(key(a.id),{text:f.text,sentText:text,clientKey});
  const r=await api(`/conversations/${a.id}/messages`,'POST',{text,clientKey});
  if(valid(a)){try{const fresh=await api(`/conversations/${a.id}?after=${a.last}`);if(valid(a)){a.peerRead=fresh.conversation.peerReadId;append(fresh.items,a)}}catch{}if(!valid(a))return true;if(form.elements.text.value.trim()===text){form.elements.text.value='';drafts.delete(key(a.id))}const scroll=document.querySelector('#chat-messages');scroll.scrollTop=scroll.scrollHeight;await acknowledge(a);poll();form.elements.text.focus()}return true;
 }
 document.addEventListener('input',e=>{if(e.target.id==='chat-text'&&active){const k=key(active.id);drafts.set(k,{...drafts.get(k),text:e.target.value})}});
 document.addEventListener('keydown',e=>{if(e.target.id==='chat-text'&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();const form=e.target.form;if(!form.querySelector('button[type=submit]').disabled)form.requestSubmit()}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
 window.addEventListener('resize',fitChat);window.visualViewport?.addEventListener('resize',fitChat);window.visualViewport?.addEventListener('scroll',fitChat);
 document.addEventListener('focusin',()=>requestAnimationFrame(fitChat));document.addEventListener('focusout',()=>requestAnimationFrame(fitChat));
 return {page,action,submit,afterRender,contactButton};
}
