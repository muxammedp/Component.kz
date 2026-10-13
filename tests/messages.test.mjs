import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
let server,base,dir,dbPath,db;
before(async()=>{
 dir=await mkdtemp(path.join(tmpdir(),'component-chat-'));dbPath=path.join(dir,'test.sqlite');
 server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:dbPath},stdio:['ignore','pipe','pipe']});
 base=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const u=String(d).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(u)resolve(u)});server.on('error',reject);setTimeout(()=>reject(Error('Server timeout')),10000).unref()});
 db=new DatabaseSync(dbPath);
});
after(async()=>{db?.close();if(server&&server.exitCode===null){const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped}await rm(dir,{recursive:true,force:true})});
async function request(cookie,url,method='GET',data){const r=await fetch(base+'/api'+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie||''},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
test('private buyer-seller messages, receipts, retries and history',async t=>{
 const users=[];for(const name of ['Seller','Buyer','Stranger']){const r=await request('','/auth/register','POST',{name,email:name+'@example.test',password:'StrongPassword123!'});assert.equal(r.status,201);users.push(r)}
 const [seller,buyer,stranger]=users.map(r=>r.cookie);db.prepare('INSERT INTO admins VALUES(?)').run(users[2].data.user.id);
 const listing=await request(seller,'/listings','POST',{title:'Процессор для продажи',category:'cpu',modelId:2,price:74000,condition:'new',city:'Астана',brand:'AMD',description:'Новый процессор с оригинальной коробкой и документами.'});assert.equal(listing.status,201);
 const productId=listing.data.id,first={productId,text:'Здравствуйте! Товар ещё в продаже?',clientKey:'first-message-key-0001'};let id,firstId,replyId;
 await t.test('only actual sellers can receive new conversations; no empty, self or anonymous threads',async()=>{
  assert.equal((await request('','/conversations','POST',first)).status,401);
  assert.equal((await request(seller,'/conversations','POST',first)).status,400);
  assert.equal((await request(buyer,'/conversations','POST',{...first,productId:1})).status,400);
  assert.equal((await request(buyer,'/conversations','POST',{...first,text:'   '})).status,400);
  assert.equal((await request(buyer,'/conversations','POST',{...first,text:'x'.repeat(3001)})).status,400);
  assert.equal((await request(seller,'/conversations')).data.total,0);
 });
 await t.test('first message and retries create one conversation and one message',async()=>{
  const r=await request(buyer,'/conversations','POST',{...first,sellerId:users[2].data.user.id,senderId:users[0].data.user.id});assert.equal(r.status,201);id=r.data.conversation.id;firstId=r.data.message.id;
  assert.equal(r.data.message.senderId,users[1].data.user.id);assert.equal(r.data.conversation.peer.id,users[0].data.user.id);
  assert.equal((await request(buyer,'/conversations','POST',first)).data.message.id,firstId);
  assert.equal((await request(buyer,'/conversations','POST',{...first,text:'Changed message'})).status,409);
  const list=(await request(seller,'/conversations?q='+encodeURIComponent('ПРОЦЕССОР'))).data;assert.equal(list.total,1);assert.equal(list.items[0].unread,1);assert.equal(list.items[0].peer.name,'Buyer');
  assert.ok(!('email' in list.items[0].peer));assert.ok(!('client_key' in list.items[0].last));
 });
 await t.test('unrelated administrator has no access to messages or read state',async()=>{
  assert.equal((await request(stranger,'/conversations')).data.total,0);
  assert.equal((await request(stranger,'/conversations/'+id)).status,404);
  assert.equal((await request(stranger,`/conversations/${id}/messages`,'POST',{text:'Intrusion',clientKey:'intrusion-key-0001'})).status,404);
  assert.equal((await request(stranger,`/conversations/${id}/read`,'POST',{throughId:firstId})).status,404);
  assert.equal((await request(seller,'/conversations/unread')).data.unread,1);
 });
 await t.test('reading requires an explicit receipt and acknowledgments only move forward',async()=>{
  await request(seller,'/conversations/'+id);assert.equal((await request(seller,'/conversations/unread')).data.unread,1);
  assert.equal((await request(seller,`/conversations/${id}/read`,'POST',{throughId:99999999})).status,400);
  assert.equal((await request(seller,`/conversations/${id}/read`,'POST',{throughId:firstId})).data.unread,0);
  assert.equal((await request(buyer,'/conversations/'+id)).data.conversation.peerReadId,firstId);
  const reply=await request(seller,`/conversations/${id}/messages`,'POST',{text:'Да, ещё в продаже. <script>alert(1)</script>',clientKey:'seller-reply-key-0001'});assert.equal(reply.status,201);replyId=reply.data.message.id;
  assert.equal((await request(buyer,'/conversations/unread')).data.unread,1);
  const next=(await request(buyer,`/conversations/${id}?after=${firstId}`)).data;assert.deepEqual(next.items.map(m=>m.id),[replyId]);
  await request(buyer,`/conversations/${id}/read`,'POST',{throughId:replyId});await request(buyer,`/conversations/${id}/read`,'POST',{throughId:firstId});
  assert.equal((await request(buyer,'/conversations/'+id)).data.conversation.readId,replyId);
 });
 await t.test('history is paginated, survives reopen and cannot acknowledge another conversation',async()=>{
  const insert=db.prepare('INSERT INTO messages(conversation_id,sender_id,text,client_key) VALUES(?,?,?,?)');for(let i=0;i<110;i++)insert.run(id,users[0].data.user.id,'History '+i,'history-fixture-'+i);
  const latest=(await request(buyer,'/conversations/'+id)).data;assert.equal(latest.items.length,50);assert.equal(latest.hasOlder,true);
  const older=(await request(buyer,`/conversations/${id}?before=${latest.items[0].id}`)).data;assert.equal(older.items.length,50);assert.ok(older.items.at(-1).id<latest.items[0].id);
  const oldest=(await request(buyer,`/conversations/${id}?before=${older.items[0].id}`)).data;assert.equal(oldest.items.length,12);assert.equal(oldest.hasOlder,false);
  const catchup=(await request(buyer,`/conversations/${id}?after=${firstId}`)).data;assert.equal(catchup.hasMore,true);assert.equal(catchup.items.length,50);
  const second=await request(stranger,'/conversations','POST',{...first,clientKey:'second-buyer-key-0001'});assert.equal(second.status,201);assert.notEqual(second.data.conversation.id,id);
  assert.equal((await request(buyer,`/conversations/${id}/read`,'POST',{throughId:second.data.message.id})).status,400);
  const reopened=new DatabaseSync(dbPath);assert.equal(reopened.prepare('SELECT count(*) n FROM messages WHERE conversation_id=?').get(id).n,112);reopened.close();
 });
 await t.test('existing discussions remain available after moderation, new threads are blocked',async()=>{
  db.prepare("UPDATE products SET moderation='hidden' WHERE id=?").run(productId);
  assert.equal((await request(buyer,'/conversations/'+id)).data.conversation.available,false);
  assert.equal((await request(buyer,`/conversations/${id}/messages`,'POST',{text:'Когда можно забрать?',clientKey:'after-hidden-key-0001'})).status,201);
  const fresh=await request('','/auth/register','POST',{name:'Fresh buyer',email:'fresh@example.test',password:'StrongPassword123!'});
  assert.equal((await request(fresh.cookie,'/conversations','POST',first)).status,409);
  assert.equal((await request(fresh.cookie,'/conversations')).data.total,0);
 });
});
