export function initMessages(db){
 db.exec(`CREATE TABLE IF NOT EXISTS conversations(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),buyer_id INTEGER NOT NULL REFERENCES users(id),seller_id INTEGER NOT NULL REFERENCES users(id),title TEXT NOT NULL,price INTEGER NOT NULL,buyer_read_id INTEGER NOT NULL DEFAULT 0,seller_read_id INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(product_id,buyer_id),CHECK(buyer_id<>seller_id));
 CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,conversation_id INTEGER NOT NULL REFERENCES conversations(id),sender_id INTEGER NOT NULL REFERENCES users(id),text TEXT NOT NULL,client_key TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(conversation_id,sender_id,client_key));
 CREATE INDEX IF NOT EXISTS messages_thread ON messages(conversation_id,id);
 CREATE INDEX IF NOT EXISTS conversations_buyer ON conversations(buyer_id);
 CREATE INDEX IF NOT EXISTS conversations_seller ON conversations(seller_id);`);
}
export const unreadMessages=(db,user)=>user?db.prepare(`SELECT count(*) n FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE (c.buyer_id=? OR c.seller_id=?) AND m.sender_id<>? AND m.id>CASE WHEN c.buyer_id=? THEN c.buyer_read_id ELSE c.seller_read_id END`).get(user.id,user.id,user.id,user.id).n:0;
export function createMessages(db,{fail,txt,int,body,json,rate}){
 db.function('chat_lower',v=>String(v??'').toLocaleLowerCase('ru'));
 const member=(id,user)=>{const r=db.prepare('SELECT * FROM conversations WHERE id=? AND (buyer_id=? OR seller_id=?)').get(id,user.id,user.id);if(!r)fail(404,'Диалог не найден.');return r};
 const view=(c,user)=>{
  const buyer=c.buyer_id===user.id,peerId=buyer?c.seller_id:c.buyer_id,peer=db.prepare('SELECT id,name FROM users WHERE id=?').get(peerId),p=db.prepare('SELECT status,moderation FROM products WHERE id=?').get(c.product_id);
  return {id:c.id,productId:c.product_id,title:c.title,price:c.price,peer,role:buyer?'buyer':'seller',available:p?.status==='active'&&p?.moderation==='visible',peerReadId:buyer?c.seller_read_id:c.buyer_read_id,readId:buyer?c.buyer_read_id:c.seller_read_id,unread:db.prepare('SELECT count(*) n FROM messages WHERE conversation_id=? AND sender_id<>? AND id>?').get(c.id,user.id,buyer?c.buyer_read_id:c.seller_read_id).n};
 };
 const validMessage=b=>{if(!b||typeof b!=='object')fail(400,'Введите сообщение.');return {text:txt(b.text,1,3000,'Сообщение'),key:txt(b.clientKey,16,80,'Ключ сообщения')}};
 const save=(c,user,m)=>{const old=db.prepare('SELECT * FROM messages WHERE conversation_id=? AND sender_id=? AND client_key=?').get(c.id,user.id,m.key);if(old){if(old.text!==m.text)fail(409,'Ключ уже использован для другого сообщения.');return old}rate('chat-send:'+user.id,30);const r=db.prepare('INSERT INTO messages(conversation_id,sender_id,text,client_key) VALUES(?,?,?,?)').run(c.id,user.id,m.text,m.key);return db.prepare('SELECT * FROM messages WHERE id=?').get(Number(r.lastInsertRowid))};
 const publicMessage=m=>({id:m.id,senderId:m.sender_id,text:m.text,created:m.created});
 return async(req,res,url,user)=>{
  if(!url.pathname.startsWith('/api/conversations'))return false;
  if(!user)fail(401,'Войдите, чтобы открыть сообщения.');
  const route=url.pathname,method=req.method,q=url.searchParams;
  if(route==='/api/conversations/unread'&&method==='GET'){json(res,{unread:unreadMessages(db,user)});return true}
  if(route==='/api/conversations'&&method==='GET'){
   const search=txt(q.get('q')||'',0,120,'Поиск'),offset=int(q.get('offset')||0,0,1e7,'Смещение');
   const from=`FROM conversations c JOIN users u ON u.id=CASE WHEN c.buyer_id=? THEN c.seller_id ELSE c.buyer_id END WHERE (c.buyer_id=? OR c.seller_id=?) AND (instr(chat_lower(c.title),chat_lower(?))>0 OR instr(chat_lower(u.name),chat_lower(?))>0)`,params=[user.id,user.id,user.id,search,search];
   const total=db.prepare('SELECT count(*) n '+from).get(...params).n;
   const items=db.prepare(`SELECT c.*,(SELECT max(id) FROM messages WHERE conversation_id=c.id) last_id ${from} ORDER BY last_id DESC,c.id DESC LIMIT 30 OFFSET ?`).all(...params,offset).map(c=>({...view(c,user),last:publicMessage(db.prepare('SELECT * FROM messages WHERE id=?').get(c.last_id))}));
   json(res,{items,total,offset,unread:unreadMessages(db,user)});return true;
  }
  if(route==='/api/conversations'&&method==='POST'){
   const b=await body(req),m=validMessage(b),productId=int(b.productId,1,1e9,'Объявление');
   const p=db.prepare('SELECT * FROM products WHERE id=?').get(productId);
   if(!p||p.demo||!p.owner_id)fail(400,'Написать можно только реальному продавцу.');if(p.owner_id===user.id)fail(400,'Нельзя написать самому себе.');
   db.exec('BEGIN IMMEDIATE');let c,message;
   try{
    c=db.prepare('SELECT * FROM conversations WHERE product_id=? AND buyer_id=?').get(productId,user.id);
    if(!c){if(p.status!=='active'||p.moderation!=='visible')fail(409,'Объявление недоступно. Новый диалог создать нельзя.');const r=db.prepare('INSERT INTO conversations(product_id,buyer_id,seller_id,title,price) VALUES(?,?,?,?,?)').run(p.id,user.id,p.owner_id,p.title,p.price);c=db.prepare('SELECT * FROM conversations WHERE id=?').get(Number(r.lastInsertRowid))}
    message=save(c,user,m);db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e}
   json(res,{conversation:view(c,user),message:publicMessage(message)},201);return true;
  }
  const match=route.match(/^\/api\/conversations\/(\d+)(?:\/(messages|read))?$/);if(!match)fail(404,'Раздел сообщений не найден.');
  const id=int(match[1],1,1e9,'Диалог'),c=member(id,user);
  if(method==='GET'&&!match[2]){
   if(q.has('before')&&q.has('after'))fail(400,'Выберите одно направление загрузки.');
   const after=q.has('after')?int(q.get('after'),0,Number.MAX_SAFE_INTEGER,'Курсор'):null,before=q.has('before')?int(q.get('before'),1,Number.MAX_SAFE_INTEGER,'Курсор'):null;
   const messages=db.prepare(`SELECT * FROM messages WHERE conversation_id=? ${after!==null?'AND id>?':before!==null?'AND id<?':''} ORDER BY id ${after!==null?'ASC':'DESC'} LIMIT 51`).all(id,...(after!==null?[after]:before!==null?[before]:[]));
   const more=messages.length>50,items=messages.slice(0,50);if(after===null)items.reverse();
   json(res,{conversation:view(c,user),items:items.map(publicMessage),hasOlder:after===null?more:undefined,hasMore:after!==null?more:undefined});return true;
  }
  if(method==='POST'&&match[2]==='messages'){
   const m=validMessage(await body(req)),message=save(c,user,m);json(res,{message:publicMessage(message)},201);return true;
  }
  if(method==='POST'&&match[2]==='read'){
   const b=await body(req),through=int(b?.throughId,1,Number.MAX_SAFE_INTEGER,'Сообщение');
   if(!db.prepare('SELECT 1 FROM messages WHERE id=? AND conversation_id=?').get(through,id))fail(400,'Сообщение не принадлежит диалогу.');
   const column=c.buyer_id===user.id?'buyer_read_id':'seller_read_id';db.prepare(`UPDATE conversations SET ${column}=max(${column},?) WHERE id=?`).run(through,id);
   json(res,{unread:unreadMessages(db,user)});return true;
  }
  fail(405,'Метод не поддерживается.');
 };
}
