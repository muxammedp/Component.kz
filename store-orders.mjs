const labels={pending:'Ожидает расчёта',quoted:'Цена предложена',paid:'Тестовая оплата принята',purchased:'Товары закуплены',shipped:'Отправлено',completed:'Получено',cancelled:'Отменено',declined:'Отклонено',refunded:'Тестовый возврат'};
export function initStoreOrders(db){
 db.exec(`CREATE TABLE IF NOT EXISTS store_operators(user_id INTEGER PRIMARY KEY REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS store_requests(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,items TEXT NOT NULL,contact TEXT NOT NULL,note TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',version INTEGER NOT NULL DEFAULT 1,quote TEXT,shipment TEXT,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,request_key));
 CREATE TABLE IF NOT EXISTS store_events(id INTEGER PRIMARY KEY,request_id INTEGER NOT NULL REFERENCES store_requests(id),actor_id INTEGER NOT NULL REFERENCES users(id),status TEXT NOT NULL,detail TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS store_requests_buyer ON store_requests(user_id,id);`);
}
export const isStoreOperator=(db,user)=>!!user&&!!db.prepare('SELECT 1 FROM store_operators WHERE user_id=?').get(user.id);
export function createStoreOrders(db,{fail,txt,int,body,json}){
 const parse=r=>({...r,items:JSON.parse(r.items),contact:JSON.parse(r.contact),quote:r.quote?JSON.parse(r.quote):null,shipment:r.shipment?JSON.parse(r.shipment):null,statusLabel:labels[r.status],demo:true});
 const view=id=>{const r=parse(db.prepare('SELECT * FROM store_requests WHERE id=?').get(id));return {...r,events:db.prepare('SELECT status,detail,created FROM store_events WHERE request_id=? ORDER BY id').all(id).map(e=>({...e,statusLabel:labels[e.status],detail:JSON.parse(e.detail)}))}};
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
 const event=(id,user,status,detail)=>db.prepare('INSERT INTO store_events(request_id,actor_id,status,detail) VALUES(?,?,?,?)').run(id,user.id,status,JSON.stringify(detail));
 return async(req,res,url,user)=>{
  if(!url.pathname.startsWith('/api/store-requests'))return false;
  if(!user)fail(401,'Войдите в аккаунт, чтобы продолжить.');
  const operator=isStoreOperator(db,user),match=url.pathname.match(/^\/api\/store-requests\/(\d+)$/),id=match?int(match[1],1,1e9,'Заявка'):null;
  if(url.pathname==='/api/store-requests'&&req.method==='GET'){
   const all=url.searchParams.get('scope')==='operator';if(all&&!operator)fail(403,'Доступ только для оператора.');
   const offset=int(url.searchParams.get('offset')||0,0,1e7,'Смещение'),limit=30,status=url.searchParams.get('status')||'';
   if(status&&!labels[status])fail(400,'Неизвестный статус.');
   const where=`WHERE ${all?'1=1':'user_id=?'}${status?' AND status=?':''}`,params=[...(all?[]:[user.id]),...(status?[status]:[])];
   json(res,{demo:true,operator,total:db.prepare(`SELECT count(*) AS n FROM store_requests ${where}`).get(...params).n,items:db.prepare(`SELECT * FROM store_requests ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params,limit,offset).map(parse)});return true;
  }
  if(url.pathname==='/api/store-requests'&&req.method==='POST'){
   const b=await body(req);if(!b||typeof b!=='object')fail(400,'Заполните заявку.');
   const key=txt(b.requestKey,16,80,'Ключ заявки');
   if(!Array.isArray(b.items)||b.items.length<1||b.items.length>10)fail(400,'Добавьте от 1 до 10 товаров.');
   const items=b.items.map(p=>{if(!p||typeof p!=='object')fail(400,'Заполните товар.');const link=txt(p.url,8,1500,'Ссылка на товар');let u;try{u=new URL(link)}catch{fail(400,'Укажите ссылку на товар.')}if(u.protocol!=='https:'||u.username||u.password)fail(400,'Нужна HTTPS-ссылка без логина и пароля.');return {title:txt(p.title,3,160,'Товар'),store:txt(p.store,2,80,'Магазин'),url:u.href,quantity:int(p.quantity,1,20,'Количество')}});
   const c=b.contact||{},contact={name:txt(c.name,2,60,'Имя'),phone:txt(c.phone,10,25,'Телефон'),city:txt(c.city,2,60,'Город'),address:txt(c.address,5,300,'Адрес доставки')};
   if(!/^\+?[\d ()-]{10,25}$/.test(contact.phone)||contact.phone.replace(/\D/g,'').length<10)fail(400,'Введите корректный телефон.');
   const note=txt(b.note||'',0,1500,'Комментарий');
   const existing=db.prepare('SELECT id,items,contact,note FROM store_requests WHERE user_id=? AND request_key=?').get(user.id,key);
   if(existing){if(existing.items!==JSON.stringify(items)||existing.contact!==JSON.stringify(contact)||existing.note!==note)fail(409,'Эта заявка уже отправлена. Обновите страницу для новой заявки.');json(res,view(existing.id));return true}
   const result=transaction(()=>{const r=db.prepare('INSERT INTO store_requests(user_id,request_key,items,contact,note) VALUES(?,?,?,?,?)').run(user.id,key,JSON.stringify(items),JSON.stringify(contact),note);const n=Number(r.lastInsertRowid);event(n,user,'pending',{message:'Покупатель отправил заявку. Все операции демонстрационные.'});return n});
   json(res,view(result),201);return true;
  }
  if(!id||!['GET','PATCH'].includes(req.method))fail(404,'Раздел не найден.');
  let row=db.prepare('SELECT * FROM store_requests WHERE id=?').get(id);
  if(!row||(!operator&&row.user_id!==user.id))fail(404,'Заявка не найдена.');
  if(req.method==='GET'){json(res,view(id));return true}
  const b=await body(req);if(!b||typeof b!=='object')fail(400,'Укажите действие.');
  transaction(()=>{
   row=db.prepare('SELECT * FROM store_requests WHERE id=?').get(id);
   if(b.version!==row.version)fail(409,'Заявка изменилась. Обновите её и проверьте условия.');
   const r=parse(row),buyer=r.user_id===user.id;let next,quote=row.quote,shipment=row.shipment,detail;
   const onlyOperator=()=>{if(!operator)fail(403,'Действие доступно только оператору.')};
   const onlyBuyer=()=>{if(!buyer)fail(403,'Действие доступно только покупателю.')};
   const allowed=states=>{if(!states.includes(r.status))fail(409,'Действие недоступно в текущем статусе.')};
   if(b.action==='quote'){
    onlyOperator();allowed(['pending','quoted']);
    if(!Array.isArray(b.prices)||b.prices.length!==r.items.length)fail(400,'Укажите цену каждой позиции.');
    const prices=b.prices.map(n=>int(n,100,10000000,'Цена за единицу')),delivery=int(b.delivery,0,1000000,'Доставка'),fee=int(b.fee,0,1000000,'Услуга выкупа');
    const total=prices.reduce((s,n,i)=>s+n*r.items[i].quantity,0)+delivery+fee;
    if(total>100000000)fail(400,'Сумма предложения слишком большая.');
    const q={prices,delivery,fee,total,expiresAt:new Date(Date.now()+int(b.validHours,1,168,'Срок предложения')*3600000).toISOString(),terms:txt(b.terms,3,1500,'Сроки и условия'),revision:(r.quote?.revision||0)+1};
    quote=JSON.stringify(q);next='quoted';detail={message:'Оператор предложил цену.',quote:q};
   }else if(b.action==='demo-pay'){
    onlyBuyer();allowed(['quoted']);if(b.confirmDemo!==true)fail(400,'Подтвердите тестовую оплату.');
    if(Date.parse(r.quote.expiresAt)<=Date.now())fail(409,'Предложение истекло. Запросите новый расчёт.');
    next='paid';detail={message:'Покупатель принял предложение. Тестовая оплата: деньги не списывались.',total:r.quote.total,revision:r.quote.revision};
   }else if(b.action==='recalculate'){
    onlyBuyer();allowed(['quoted']);next='pending';detail={message:'Покупатель запросил новый расчёт.'};
   }else if(b.action==='cancel'){
    onlyBuyer();allowed(['pending','quoted']);next='cancelled';detail={message:'Покупатель отменил заявку.'};
   }else if(b.action==='decline'){
    onlyOperator();allowed(['pending','quoted']);next='declined';detail={message:txt(b.message,3,1000,'Причина отказа')};
   }else if(b.action==='purchase'){
    onlyOperator();allowed(['paid']);next='purchased';detail={message:txt(b.message,3,1000,'Информация о закупке')};
   }else if(b.action==='ship'){
    onlyOperator();allowed(['purchased']);const s={carrier:txt(b.carrier,2,80,'Служба доставки'),tracking:txt(b.tracking,3,120,'Трек-номер')};shipment=JSON.stringify(s);next='shipped';detail={message:'Оператор отметил отправку.',...s};
   }else if(b.action==='receive'){
    onlyBuyer();allowed(['shipped']);next='completed';detail={message:'Покупатель подтвердил получение.'};
   }else if(b.action==='refund'){
    onlyOperator();allowed(['paid','purchased','shipped']);next='refunded';detail={message:'Тестовый возврат, без движения денег. '+txt(b.message,3,1000,'Причина возврата'),total:r.quote.total};
   }else fail(400,'Неизвестное действие.');
   db.prepare('UPDATE store_requests SET status=?,quote=?,shipment=?,version=version+1,updated=CURRENT_TIMESTAMP WHERE id=?').run(next,quote,shipment,id);
   event(id,user,next,detail);
  });
  json(res,view(id));return true;
 };
}
