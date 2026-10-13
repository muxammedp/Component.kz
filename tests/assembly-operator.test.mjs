import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
let server,base,dir,dbPath,db;
before(async()=>{
 dir=await mkdtemp(path.join(tmpdir(),'component-admin-'));dbPath=path.join(dir,'test.sqlite');
 server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:dbPath},stdio:['ignore','pipe','pipe']});
 base=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const u=String(d).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(u)resolve(u)});server.on('error',reject);setTimeout(()=>reject(Error('Server timeout')),10000).unref()});
 db=new DatabaseSync(dbPath);
});
after(async()=>{db?.close();if(server&&server.exitCode===null){const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped}await rm(dir,{recursive:true,force:true})});
async function request(cookie,url,method='GET',data){const r=await fetch(base+'/api'+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie||''},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
test('assembly requests reach operators and continue through customer delivery',async t=>{
 const accounts=[];
 for(const name of ['Builder','Customer','Stranger'])accounts.push(await request('','/auth/register','POST',{name,email:name+'@example.test',password:'StrongPassword123!'}));
 const [operator,buyer,stranger]=accounts.map(r=>r.cookie),operatorId=accounts[0].data.user.id;
 db.prepare('INSERT INTO store_operators VALUES(?)').run(operatorId);
 const rec=(await request(buyer,'/recommend','POST',{budget:450000,task:'work'})).data;
 const draft={kind:'assembly',ids:rec.parts.map(p=>p.id),name:'Получатель',phone:'+77001234567',city:'Астана',address:'Тестовая улица, дом 10, квартира 5',note:'Позвонить перед доставкой',requestKey:'assembly-test-0001'};
 let orderId;
 await t.test('an explicit delivery address is required and repeated submission is idempotent',async()=>{
  const missing={...draft};delete missing.address;
  assert.equal((await request(buyer,'/orders','POST',missing)).status,400);
  const created=await request(buyer,'/orders','POST',draft);assert.equal(created.status,201);orderId=created.data.id;
  const retry=await request(buyer,'/orders','POST',draft);assert.equal(retry.status,200);assert.equal(retry.data.id,orderId);assert.equal(retry.data.repeated,true);
  assert.equal((await request(buyer,'/orders','POST',{...draft,address:'Другой адрес, дом 15'})).status,409);
  assert.equal(db.prepare('SELECT count(*) n FROM orders').get().n,1);
  assert.equal(db.prepare('SELECT count(*) n FROM order_sellers').get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM admin_audit WHERE entity='assemblies'").get().n,1);
 });
 await t.test('assembly operator access is separate from administration and private to authorized roles',async()=>{
  assert.equal((await request('','/operator/assemblies')).status,401);
  assert.equal((await request(buyer,'/operator/assemblies')).status,403);
  assert.equal((await request(operator,'/admin/users')).status,403);
  assert.equal((await request(operator,'/operator/users')).status,404);
  assert.equal((await request(stranger,'/orders/'+orderId)).status,404);
  assert.equal((await request(stranger,'/orders/'+orderId,'PATCH',{status:'received'})).status,404);
  assert.equal((await request(buyer,'/operator/assemblies/'+orderId,'PATCH',{})).status,403);
  for(const q of [String(orderId),'customer@example.test','получатель']){
   const found=await request(operator,'/operator/assemblies?q='+encodeURIComponent(q));assert.equal(found.status,200);assert.equal(found.data.total,1);
   const row=found.data.items[0];assert.equal(row.address,draft.address);assert.equal(row.items.length,7);assert.ok(row.items.every(p=>p.condition==='new'&&p.spec&&p.modelName));
  }
 });
 await t.test('snapshots retain prices and model facts even after catalog edits',async()=>{
  const item=rec.parts[0];db.prepare('UPDATE products SET price=price+1000 WHERE id=?').run(item.id);
  const detail=(await request(buyer,'/orders/'+orderId)).data;
  assert.equal(detail.items[0].price,item.price);assert.equal(detail.total,rec.evaluation.total);assert.equal(detail.events[0].action,'Новая заявка');
  assert.equal((await request(buyer,'/orders','POST',draft)).data.id,orderId);
 });
 const patch=(status,version,expectedStatus,extra={})=>request(operator,'/operator/assemblies/'+orderId,'PATCH',{status,version,expectedStatus,reason:'Этап проверен оператором',...extra});
 await t.test('operators assemble, test and ship in order with required shipping data',async()=>{
  assert.equal((await request(buyer,'/orders/'+orderId,'PATCH',{status:'received'})).status,409);
  assert.equal((await patch('Отправлена',0,'Новая заявка')).status,409);
  assert.equal((await patch('В работе',0,'Новая заявка')).status,200);
  assert.equal(db.prepare('SELECT operator_id FROM orders WHERE id=?').get(orderId).operator_id,operatorId);
  assert.equal((await patch('Готова к отправке',0,'В работе')).status,409);
  assert.equal((await request(buyer,'/orders/'+orderId,'PATCH',{status:'cancelled'})).status,409);
  assert.equal((await patch('Готова к отправке',1,'В работе')).status,200);
  assert.equal((await patch('Отправлена',2,'Готова к отправке')).status,400);
  assert.equal((await patch('Отправлена',2,'Готова к отправке',{carrier:'Тестовая доставка',tracking:'DEMO-123'})).status,200);
  const detail=(await request(buyer,'/orders/'+orderId)).data;
  assert.equal(detail.canReceive,true);assert.equal(detail.shipping_tracking,'DEMO-123');assert.equal(detail.events.length,4);
  assert.deepEqual(detail.events.map(e=>e.action),['Новая заявка','В работе','Готова к отправке','Отправлена']);
 });
 await t.test('the buyer confirms delivery and the operator sees the completed request',async()=>{
  assert.equal((await request(buyer,'/orders/'+orderId,'PATCH',{status:'received'})).status,200);
  assert.equal((await request(buyer,'/orders/'+orderId,'PATCH',{status:'received'})).status,409);
  const detail=(await request(buyer,'/orders/'+orderId)).data;assert.equal(detail.status,'Завершена');assert.equal(detail.canReceive,false);assert.equal(detail.events.length,5);
  const done=(await request(operator,'/operator/assemblies?status='+encodeURIComponent('Завершена'))).data;assert.equal(done.total,1);
  assert.equal((await patch('В работе',4,'Завершена')).status,409);
 });
 await t.test('buyer cancellation invalidates an already opened operator form',async()=>{
  const created=await request(buyer,'/orders','POST',{...draft,requestKey:'assembly-test-0002'});const id=created.data.id;assert.equal(created.status,201);
  assert.equal((await request(buyer,'/orders/'+id,'PATCH',{status:'cancelled'})).status,200);
  assert.equal((await request(operator,'/operator/assemblies/'+id,'PATCH',{status:'В работе',version:0,expectedStatus:'Новая заявка',reason:'Устаревшая форма'})).status,409);
  assert.equal((await request(buyer,'/orders/'+id)).data.events.at(-1).action,'Отменена покупателем');
 });
 await t.test('revoking operator rights applies immediately to the active session',async()=>{
  db.prepare('DELETE FROM store_operators WHERE user_id=?').run(operatorId);
  assert.equal((await request(operator,'/operator/assemblies')).status,403);
  assert.equal((await patch('В работе',4,'Завершена')).status,403);
 });
});
