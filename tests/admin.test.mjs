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
test('admin permissions, reversible moderation and service workflows',async t=>{
 const users=[];for(const name of ['Admin','Operator','Buyer']){const r=await request('','/auth/register','POST',{name,email:name+'@example.test',password:'StrongPassword123!',isAdmin:true});assert.equal(r.status,201);assert.equal(r.data.user.isAdmin,false);users.push(r)}
 const [admin,operator,buyer]=users.map(r=>r.cookie);
 db.prepare('INSERT INTO store_operators VALUES(?)').run(users[1].data.user.id);
 const cli=spawnSync(process.execPath,['scripts/admin-user.mjs','admin@example.test'],{env:{...process.env,DB_PATH:dbPath},encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);
 await t.test('anonymous, ordinary accounts and store-only operators cannot access admin API',async()=>{
  for(const section of ['overview','listings','assemblies','models','users','audit']){
   assert.equal((await request('','/admin/'+section)).status,401);
   assert.equal((await request(operator,'/admin/'+section)).status,403);
  }
  assert.equal((await request(buyer,'/admin/listings/1','PATCH',{status:'hidden',version:0,reason:'No rights'})).status,403);
  assert.equal((await request(admin,'/bootstrap')).data.user.isAdmin,true);
  const accounts=(await request(admin,'/admin/users')).data;assert.equal(accounts.total,3);assert.ok(accounts.items.every(u=>!('password' in u)&&!('token' in u)));
 });
 let listing;
 await t.test('admin listing search is paginated and supports Cyrillic case-insensitive queries',async()=>{
  const r=await request(buyer,'/listings','POST',{title:'ПРОЦЕССОР Ryzen 5 5600X',category:'cpu',modelId:2,price:74000,condition:'new',city:'Астана',brand:'AMD',description:'Новый процессор с документами и оригинальной коробкой.'});assert.equal(r.status,201);listing=r.data.id;
  const found=await request(admin,'/admin/listings?source=real&q='+encodeURIComponent('процессор'));assert.equal(found.data.total,1);assert.equal(found.data.items[0].id,listing);
  assert.equal((await request(admin,'/admin/listings')).data.items.length,20);
  assert.equal((await request(admin,'/admin/listings?offset=20')).data.offset,20);
 });
 await t.test('moderation hides public offers and cannot be bypassed by seller status changes',async()=>{
  assert.equal((await request(admin,'/admin/listings/'+listing,'PATCH',{status:'hidden',version:0,reason:'Проверка описания'})).status,200);
  assert.ok(!(await request('','/bootstrap')).data.products.some(p=>p.id===listing));
  assert.equal((await request(buyer,'/listings/'+listing,'PATCH',{status:'active'})).status,200);
  assert.ok(!(await request('','/bootstrap')).data.products.some(p=>p.id===listing));
  assert.equal((await request(operator,'/orders','POST',{kind:'purchase',ids:[listing],name:'Operator',phone:'+77001234567',city:'Астана'})).status,409);
  assert.equal((await request(operator,'/evaluate','POST',{ids:[listing]})).status,400);
  assert.equal((await request(admin,'/admin/listings/'+listing,'PATCH',{status:'visible',version:0,reason:'Stale change'})).status,409);
  await request(buyer,'/listings/'+listing,'PATCH',{status:'sold'});
  assert.equal((await request(admin,'/admin/listings/'+listing,'PATCH',{status:'visible',version:1,reason:'Проверка завершена'})).status,200);
  assert.ok(!(await request('','/bootstrap')).data.products.some(p=>p.id===listing));
  await request(buyer,'/listings/'+listing,'PATCH',{status:'active'});
  assert.ok((await request('','/bootstrap')).data.products.some(p=>p.id===listing));
  assert.equal((await request(admin,'/admin/audit')).data.total,2);
 });
 await t.test('assembly transitions are visible to buyer and require shipping details',async()=>{
  const rec=(await request(buyer,'/recommend','POST',{budget:450000,condition:'new',task:'work'})).data;
  const created=await request(buyer,'/orders','POST',{kind:'assembly',address:'улица Тестовая, дом 10, квартира 5',ids:rec.parts.map(p=>p.id),name:'Buyer',phone:'+77001234567',city:'Астана'});assert.equal(created.status,201);const id=created.data.id;
  const patch=(status,version,expectedStatus,extra={})=>request(admin,'/admin/assemblies/'+id,'PATCH',{status,version,expectedStatus,reason:'Проверка сборки',...extra});
  assert.equal((await patch('Отправлена',0,'Новая заявка')).status,409);
  assert.equal((await patch('В работе',0,'Новая заявка')).status,200);
  const own=(await request(buyer,'/orders/'+id)).data;assert.equal(own.status,'В работе');assert.equal(own.statusCode,'accepted');assert.equal(own.canCancel,false);
  assert.equal((await request(buyer,'/orders/'+id,'PATCH',{status:'cancelled'})).status,409);
  assert.equal((await patch('Готова к отправке',1,'В работе')).status,200);
  assert.equal((await patch('Отправлена',2,'Готова к отправке')).status,400);
  assert.equal((await patch('Отправлена',2,'Готова к отправке',{carrier:'Test courier',tracking:'TEST42'})).status,200);
  const shipped=(await request(buyer,'/orders/'+id)).data;assert.equal(shipped.shipping_tracking,'TEST42');assert.equal(shipped.status,'Отправлена');
  assert.equal((await patch('Завершена',3,'Отправлена')).status,200);
  assert.equal((await patch('В работе',4,'Завершена')).status,409);
 });
 await t.test('model requests resolve only against an existing matching category',async()=>{
  const created=await request(buyer,'/model-requests','POST',{category:'cpu',title:'Ryzen 5 5600X',url:'https://example.test/cpu'});assert.equal(created.status,201);const id=created.data.id;
  const patch=(status,version,modelId)=>request(admin,'/admin/models/'+id,'PATCH',{status,version,modelId,reason:'Проверено по справочнику'});
  assert.equal((await patch('resolved',0,999999999)).status,400);
  assert.equal((await patch('resolved',0,1)).status,400);
  assert.equal((await patch('reviewing',0)).status,200);
  assert.equal((await patch('resolved',0,2)).status,409);
  assert.equal((await patch('resolved',1,2)).status,200);
  const r=(await request(admin,'/admin/models?status=resolved')).data.items[0];assert.equal(r.resolved_model_id,2);assert.equal(r.review_note,'Проверено по справочнику');
  const overview=(await request(admin,'/admin/overview')).data;assert.equal(overview.pendingModels,0);assert.equal(overview.realListings,1);assert.ok(overview.demoListings>0);
 });
 await t.test('user search and independent role changes enforce last-admin and stale-write protection',async()=>{
  const buyerId=users[2].data.user.id,adminId=users[0].data.user.id,operatorId=users[1].data.user.id;
  for(const query of [String(buyerId),'buyer@example.test','buYeR']){const r=await request(admin,'/admin/users?q='+encodeURIComponent(query));assert.equal(r.data.total,1);assert.equal(r.data.items[0].id,buyerId)}
  const roles=(who,id,version,isAdmin,isOperator)=>request(who,'/admin/users/'+id,'PATCH',{version,isAdmin,isOperator,reason:'Изменение обязанностей'});
  const ownVersion=(await request(admin,'/admin/users?q='+adminId)).data.items[0].admin_version;
  const last=await roles(admin,adminId,ownVersion,false,false);assert.equal(last.status,409);assert.match(last.data.error,/последнего/);
  assert.equal((await roles(buyer,buyerId,0,true,true)).status,403);
  assert.equal((await roles(admin,buyerId,0,true,true)).status,200);
  const flags=(await request(buyer,'/bootstrap')).data.user;assert.equal(flags.isAdmin,true);assert.equal(flags.isStoreOperator,true);
  assert.equal((await request(buyer,'/admin/overview')).status,200);
  assert.equal((await request(buyer,'/store-requests?scope=operator')).status,200);
  assert.equal((await roles(admin,buyerId,0,false,false)).status,409);
  assert.equal((await roles(buyer,buyerId,1,false,false)).status,200);
  assert.equal((await request(buyer,'/admin/users')).status,403);
  assert.equal((await request(buyer,'/store-requests?scope=operator')).status,403);
  assert.equal((await roles(operator,operatorId,0,true,true)).status,403);
  assert.equal((await roles(admin,operatorId,0,true,true)).status,200);
  assert.equal((await request(admin,'/admin/audit?q='+encodeURIComponent('обязанностей'))).data.total,3);
 });
 await t.test('revocation applies to an existing authenticated admin session',async()=>{
  const revoke=spawnSync(process.execPath,['scripts/admin-user.mjs','admin@example.test','--revoke'],{env:{...process.env,DB_PATH:dbPath},encoding:'utf8'});assert.equal(revoke.status,0,revoke.stderr);
  assert.equal((await request(admin,'/admin/overview')).status,403);
 });
});
