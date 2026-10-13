export const assemblyStates={'Новая заявка':['В работе','Отклонена'],'В работе':['Готова к отправке','Отклонена'],'Готова к отправке':['Отправлена','В работе'],'Отправлена':['Завершена'],'Завершена':[],'Отклонена':[],'Отменена покупателем':[]};
export function initAdmin(db){
 db.exec(`CREATE TABLE IF NOT EXISTS admins(user_id INTEGER PRIMARY KEY REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS admin_audit(id INTEGER PRIMARY KEY,actor_id INTEGER NOT NULL REFERENCES users(id),entity TEXT NOT NULL,entity_id INTEGER NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
 const add=(table,name,type)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)};
 add('products','moderation',"TEXT NOT NULL DEFAULT 'visible'");add('products','moderation_reason',"TEXT NOT NULL DEFAULT ''");add('products','admin_version','INTEGER NOT NULL DEFAULT 0');
 for(const table of ['orders','model_requests','users'])add(table,'admin_version','INTEGER NOT NULL DEFAULT 0');
 add('orders','operator_note',"TEXT NOT NULL DEFAULT ''");add('orders','shipping_carrier',"TEXT NOT NULL DEFAULT ''");add('orders','shipping_tracking',"TEXT NOT NULL DEFAULT ''");
 add('model_requests','review_note',"TEXT NOT NULL DEFAULT ''");add('model_requests','resolved_model_id','INTEGER');
}
export const isAdmin=(db,user)=>!!user&&!!db.prepare('SELECT 1 FROM admins WHERE user_id=?').get(user.id);
export function createAdmin(db,{fail,txt,int,body,json}){
 db.function('admin_lower',v=>String(v??'').toLocaleLowerCase('ru'));
 const count=(sql,...params)=>db.prepare(sql).get(...params).n;
 const audit=(user,entity,id,action,reason)=>db.prepare('INSERT INTO admin_audit(actor_id,entity,entity_id,action,reason) VALUES(?,?,?,?,?)').run(user.id,entity,id,action,reason);
 return async(req,res,url,user)=>{
  if(!url.pathname.startsWith('/api/admin/'))return false;
  if(!user)fail(401,'Войдите в аккаунт администратора.');if(!isAdmin(db,user))fail(403,'Этот раздел доступен только администратору.');
  const route=url.pathname.slice('/api/admin/'.length),q=url.searchParams;
  if(req.method==='GET'&&route==='overview'){
   json(res,{users:count('SELECT count(*) n FROM users'),realListings:count("SELECT count(*) n FROM products WHERE demo=0"),demoListings:count('SELECT count(*) n FROM products WHERE demo=1'),hiddenListings:count("SELECT count(*) n FROM products WHERE moderation='hidden'"),pendingAssemblies:count("SELECT count(*) n FROM orders WHERE kind='assembly' AND status='Новая заявка'"),activeAssemblies:count("SELECT count(*) n FROM orders WHERE kind='assembly' AND status IN ('В работе','Готова к отправке','Отправлена')"),pendingModels:count("SELECT count(*) n FROM model_requests WHERE status IN ('pending','reviewing')"),models:count('SELECT count(*) n FROM hardware_models'),pendingStore:count("SELECT count(*) n FROM store_requests WHERE status='pending'"),activeStore:count("SELECT count(*) n FROM store_requests WHERE status IN ('quoted','paid','purchased','shipped')"),recent:db.prepare('SELECT a.*,u.name actor FROM admin_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 8').all()});return true;
  }
  if(req.method==='GET'&&['listings','assemblies','models','users','audit'].includes(route)){
   const offset=int(q.get('offset')||0,0,1e7,'Смещение'),search=txt(q.get('q')||'',0,120,'Поиск'),status=q.get('status')||'',source=q.get('source')||'';
   const params=[],where=[];let from,columns;
   const filter=(sql,v)=>{where.push(sql);params.push(v)};
   if(route==='listings'){
    from='products p LEFT JOIN users u ON u.id=p.owner_id';columns='p.id,p.title,p.category,p.price,p.condition,p.city,p.demo,p.status,p.moderation,p.moderation_reason,p.admin_version,p.created,u.name seller';
    if(status){if(!['visible','hidden'].includes(status))fail(400,'Неверный статус.');filter('p.moderation=?',status)}
    if(source){if(!['real','demo'].includes(source))fail(400,'Неверный источник.');filter('p.demo=?',source==='demo'?1:0)}
    if(search)filter("(instr(admin_lower(p.title),admin_lower(?))>0 OR CAST(p.id AS TEXT)=? OR instr(admin_lower(coalesce(u.email,'')),admin_lower(?))>0)",search),params.push(search,search);
   }else if(route==='assemblies'){
    from='orders p JOIN users u ON u.id=p.user_id';columns='p.*,u.email';where.push("p.kind='assembly'");
    if(status){if(!Object.hasOwn(assemblyStates,status))fail(400,'Неверный статус.');filter('p.status=?',status)}
    if(search)filter('(instr(admin_lower(p.name),admin_lower(?))>0 OR CAST(p.id AS TEXT)=? OR instr(p.phone,?)>0)',search),params.push(search,search);
   }else if(route==='models'){
    from='model_requests p JOIN users u ON u.id=p.user_id';columns='p.*,u.name requester';
    if(status){if(!['pending','reviewing','resolved','rejected'].includes(status))fail(400,'Неверный статус.');filter('p.status=?',status)}
    if(search)filter('(instr(admin_lower(p.title),admin_lower(?))>0 OR CAST(p.id AS TEXT)=?)',search),params.push(search);
   }else if(route==='users'){
    from='users p';columns='p.id,p.name,p.email,p.city,p.created,p.admin_version,EXISTS(SELECT 1 FROM admins WHERE user_id=p.id) is_admin,EXISTS(SELECT 1 FROM store_operators WHERE user_id=p.id) is_operator,(SELECT count(*) FROM products WHERE owner_id=p.id) listings';
    if(search)filter('(instr(admin_lower(p.name),admin_lower(?))>0 OR instr(admin_lower(p.email),admin_lower(?))>0 OR CAST(p.id AS TEXT)=?)',search),params.push(search,search);
   }else{from='admin_audit p JOIN users u ON u.id=p.actor_id';columns='p.*,u.name actor';if(search)filter('(instr(admin_lower(p.reason),admin_lower(?))>0 OR CAST(p.entity_id AS TEXT)=?)',search),params.push(search)}
   const clause=where.length?' WHERE '+where.join(' AND '):'';
   const total=count(`SELECT count(*) n FROM ${from}${clause}`,...params);
   const items=db.prepare(`SELECT ${columns} FROM ${from}${clause} ORDER BY p.id DESC LIMIT 20 OFFSET ?`).all(...params,offset).map(r=>route==='assemblies'?{...r,items:JSON.parse(r.items),next:assemblyStates[r.status]||[]}:r);
   json(res,{items,total,offset,limit:20});return true;
  }
  const match=route.match(/^(listings|assemblies|models|users)\/(\d+)$/);
  if(req.method!=='PATCH'||!match)fail(404,'Раздел администрирования не найден.');
  const [,kind,rawId]=match,id=int(rawId,1,1e9,'Запись'),b=await body(req);if(!b||typeof b!=='object')fail(400,'Заполните форму.');
  const table={listings:'products',assemblies:'orders',models:'model_requests',users:'users'}[kind];
  db.exec('BEGIN IMMEDIATE');
  try{
   if(!isAdmin(db,user))fail(403,'Права администратора были отозваны.');
   const row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);if(!row||kind==='assemblies'&&row.kind!=='assembly')fail(404,'Запись не найдена.');
   if(b.version!==row.admin_version)fail(409,'Запись изменилась. Обновите страницу и повторите действие.');
   const reason=txt(b.reason,3,1000,'Комментарий');
   if(kind==='listings'){
    if(!['visible','hidden'].includes(b.status))fail(400,'Выберите статус модерации.');if(b.status===row.moderation)fail(409,'Этот статус уже установлен.');
    db.prepare('UPDATE products SET moderation=?,moderation_reason=?,admin_version=admin_version+1 WHERE id=?').run(b.status,reason,id);
   }else if(kind==='assemblies'){
    if(b.expectedStatus!==row.status||!assemblyStates[row.status]?.includes(b.status))fail(409,'Этот переход недоступен. Обновите заявку.');
    let carrier=row.shipping_carrier,tracking=row.shipping_tracking;
    if(b.status==='Отправлена'){carrier=txt(b.carrier,2,80,'Служба доставки');tracking=txt(b.tracking,3,120,'Трек-номер')}
    db.prepare('UPDATE orders SET status=?,operator_note=?,shipping_carrier=?,shipping_tracking=?,admin_version=admin_version+1 WHERE id=?').run(b.status,reason,carrier,tracking,id);
   }else if(kind==='users'){
    if(typeof b.isAdmin!=='boolean'||typeof b.isOperator!=='boolean')fail(400,'Укажите роли пользователя.');
    const wasAdmin=isAdmin(db,row),wasOperator=!!db.prepare('SELECT 1 FROM store_operators WHERE user_id=?').get(id);
    if(wasAdmin===b.isAdmin&&wasOperator===b.isOperator)fail(409,'Роли не изменились.');
    if(wasAdmin&&!b.isAdmin&&count('SELECT count(*) n FROM admins')<=1)fail(409,'Нельзя снять права у последнего администратора. Сначала назначьте другого.');
    for(const [role,enabled]of [['admins',b.isAdmin],['store_operators',b.isOperator]]){
     if(enabled)db.prepare(`INSERT OR IGNORE INTO ${role}(user_id) VALUES(?)`).run(id);
     else db.prepare(`DELETE FROM ${role} WHERE user_id=?`).run(id);
    }
    db.prepare('UPDATE users SET admin_version=admin_version+1 WHERE id=?').run(id);
    b.status=`Роли: ${b.isAdmin?'администратор':'без прав администратора'}, ${b.isOperator?'оператор':'без прав оператора'}`;
   }else{
    const transitions={pending:['reviewing','resolved','rejected'],reviewing:['resolved','rejected'],resolved:[],rejected:['reviewing']};
    if(!transitions[row.status]?.includes(b.status))fail(409,'Этот переход недоступен. Обновите заявку.');
    let modelId=null;
    if(b.status==='resolved'){modelId=int(b.modelId,1,1e9,'Модель');const model=db.prepare('SELECT category FROM hardware_models WHERE id=?').get(modelId);if(!model||model.category!==row.category)fail(400,'Выберите существующую модель той же категории.');}
    db.prepare('UPDATE model_requests SET status=?,review_note=?,resolved_model_id=?,admin_version=admin_version+1 WHERE id=?').run(b.status,reason,modelId,id);
   }
   audit(user,kind,id,b.status,reason);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  json(res,{ok:true});return true;
 };
}
