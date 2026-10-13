import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
let server,base,dir,dbPath,db;
before(async()=>{
 dir=await mkdtemp(path.join(tmpdir(),'component-store-'));dbPath=path.join(dir,'test.sqlite');
 server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:dbPath},stdio:['ignore','pipe','pipe']});
 base=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const u=String(d).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(u)resolve(u)});server.on('error',reject);setTimeout(()=>reject(Error('Server timeout')),10000).unref()});
 db=new DatabaseSync(dbPath);
});
after(async()=>{db?.close();if(server&&server.exitCode===null){const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped}await rm(dir,{recursive:true,force:true})});
async function request(cookie,url,method='GET',data){const r=await fetch(base+'/api'+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie||''},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const payload={requestKey:'store-request-test-1',items:[{title:'Kingston Fury 32GB',store:'Demo shop',url:'https://example.test/ram',quantity:2}],contact:{name:'Buyer Test',phone:'+77001234567',city:'Астана',address:'Test street 10'},note:'Factory sealed'};
const offer={action:'quote',prices:[40000],delivery:3000,fee:5000,validHours:24,terms:'Delivery within 5 days'};
test('store procurement authorization, price agreement and demo lifecycle',async t=>{
 const users=[];
 for(const name of ['Operator','Buyer','Stranger']){const r=await request('','/auth/register','POST',{name,email:name+'@example.test',password:'StrongPassword123!',isStoreOperator:true});assert.equal(r.status,201);assert.equal(r.data.user.isStoreOperator,false);users.push(r)}
 const [operator,buyer,stranger]=users.map(u=>u.cookie);
 const cli=spawnSync(process.execPath,['scripts/store-operator.mjs','operator@example.test'],{env:{...process.env,DB_PATH:dbPath},encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);
 assert.equal((await request(operator,'/bootstrap')).data.user.isStoreOperator,true);
 let order;
 const update=async(who,action,extra={})=>request(who,'/store-requests/'+order.id,'PATCH',{version:order.version,action,...extra});
 await t.test('private requests and operator role cannot be claimed by form fields',async()=>{
  assert.equal((await request('','/store-requests')).status,401);
  assert.equal((await request(buyer,'/store-requests?scope=operator')).status,403);
  assert.equal((await request(stranger,'/store-requests')).data.total,0);
 });
 await t.test('unsafe links and invalid quantities do not create requests',async()=>{
  for(const item of [{url:'javascript:alert(1)'},{url:'https://user:password@example.test/item'},{quantity:0}])assert.equal((await request(buyer,'/store-requests','POST',{...payload,items:[{...payload.items[0],...item}]})).status,400);
  assert.equal((await request(buyer,'/store-requests')).data.total,0);
 });
 await t.test('request saved once and visible only to buyer and operator',async()=>{
  const r=await request(buyer,'/store-requests','POST',payload);assert.equal(r.status,201);order=r.data;
  assert.equal(order.demo,true);assert.equal(order.status,'pending');assert.equal(order.events.length,1);
  const retry=await request(buyer,'/store-requests','POST',payload);assert.equal(retry.data.id,order.id);
  assert.equal((await request(buyer,'/store-requests','POST',{...payload,note:'Changed'})).status,409);
  assert.equal((await request(stranger,'/store-requests/'+order.id)).status,404);
  assert.equal((await update(stranger,'cancel')).status,404);
  assert.equal((await request(operator,'/store-requests?scope=operator')).data.total,1);
  assert.equal((await request(buyer,'/profile')).data.orders.length,0);
 });
 await t.test('only operator quotes; totals computed on server including quantity',async()=>{
  assert.equal((await update(buyer,'quote',offer)).status,403);
  assert.equal((await update(operator,'quote',{...offer,prices:[-1]})).status,400);
  const r=await update(operator,'quote',{...offer,total:1});assert.equal(r.status,200);order=r.data;
  assert.equal(order.quote.total,88000);assert.equal(order.quote.revision,1);
 });
 await t.test('new quote prevents accepting a stale price and keeps old quote history',async()=>{
  const oldVersion=order.version;order=(await update(operator,'quote',{...offer,prices:[45000]})).data;
  assert.equal(order.quote.total,98000);assert.equal(order.quote.revision,2);
  assert.equal(order.events[1].detail.quote.total,88000);
  assert.equal((await update(buyer,'demo-pay',{version:oldVersion,confirmDemo:true})).status,409);
  assert.equal((await update(operator,'demo-pay',{confirmDemo:true})).status,403);
  assert.equal((await update(buyer,'demo-pay')).status,400);
 });
 await t.test('expired quote cannot be paid; customer can ask for recalculation',async()=>{
  db.prepare('UPDATE store_requests SET quote=? WHERE id=?').run(JSON.stringify({...order.quote,expiresAt:'2000-01-01T00:00:00Z'}),order.id);
  assert.equal((await update(buyer,'demo-pay',{confirmDemo:true})).status,409);
  order=(await update(buyer,'recalculate')).data;assert.equal(order.status,'pending');
  assert.equal((await update(buyer,'demo-pay',{confirmDemo:true})).status,409);
  order=(await update(operator,'quote',offer)).data;
 });
 await t.test('payment remains explicitly demo and freezes price',async()=>{
  order=(await update(buyer,'demo-pay',{confirmDemo:true})).data;assert.equal(order.status,'paid');assert.equal(order.quote.total,88000);
  assert.equal((await update(operator,'quote',offer)).status,409);
  assert.equal((await update(buyer,'cancel')).status,409);
  assert.equal((await update(buyer,'purchase',{message:'Buy now'})).status,403);
  assert.equal((await update(operator,'ship',{carrier:'Demo',tracking:'TEST123'})).status,409);
 });
 await t.test('operator procurement, tracking, buyer receipt and audit persist',async()=>{
  order=(await update(operator,'purchase',{message:'Demo shop order TEST42'})).data;assert.equal(order.status,'purchased');
  order=(await update(operator,'ship',{carrier:'Test courier',tracking:'TEST123'})).data;assert.equal(order.status,'shipped');
  assert.equal(order.shipment.tracking,'TEST123');assert.equal((await update(operator,'receive')).status,403);
  order=(await update(buyer,'receive')).data;assert.equal(order.status,'completed');
  assert.equal((await update(buyer,'receive')).status,409);
  assert.equal((await request(buyer,'/store-requests?status=completed')).data.total,1);
  const reopened=new DatabaseSync(dbPath);assert.equal(reopened.prepare('SELECT status FROM store_requests WHERE id=?').get(order.id).status,'completed');reopened.close();
  assert.equal(order.events.at(-1).status,'completed');assert.equal(order.quote.total,88000);
 });
 await t.test('role revocation takes effect on existing session',async()=>{
  const revoke=spawnSync(process.execPath,['scripts/store-operator.mjs','operator@example.test','--revoke'],{env:{...process.env,DB_PATH:dbPath},encoding:'utf8'});assert.equal(revoke.status,0,revoke.stderr);
  assert.equal((await request(operator,'/store-requests?scope=operator')).status,403);
  assert.equal((await request(operator,'/store-requests/'+order.id)).status,404);
 });
});
