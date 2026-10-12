import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

test('users, builds, edited listings and request statuses survive restart; legacy requests backfill',async()=>{
 const file=path.join(tmpdir(),'component-test-'+randomUUID()+'.sqlite');
 let child;
 const start=async()=>{child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DB_PATH:file,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});return await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{const url=String(d).match(/http:\/\/127.0.0.1:\d+/)?.[0];if(url)resolve(url)});child.on('error',reject);setTimeout(()=>reject(new Error('startup timeout')),10000).unref()})};
 const stop=async()=>{if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})};
 try{
  let base=await start();
  const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Persistence QA',email:'persistence@example.test',password:'StrongPassword123!'})});
  assert.equal(response.status,201);const cookie=response.headers.get('set-cookie').split(';')[0];
  const saved=await fetch(base+'/api/builds',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({name:'Persisted build',ids:[1,2]})});assert.equal(saved.status,201);
  const api=async(session,url,method='GET',data)=>{const r=await fetch(base+'/api'+url,{method,headers:{'Content-Type':'application/json',Cookie:session},body:data===undefined?undefined:JSON.stringify(data)});assert.ok(r.ok);return r.json()};
  const fields={title:'Persisted GPU listing',category:'gpu',modelId:1,price:150000,condition:'used',city:'Алматы',brand:'MSI',description:'Fully working graphics card with box and test results.'};
  const listing=await api(cookie,'/listings','POST',fields);
  await api(cookie,'/listings/'+listing.id,'PUT',{...fields,price:149000});
  const buyerResponse=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Persistence Buyer',email:'persistbuyer@example.test',password:'StrongPassword123!'})});assert.equal(buyerResponse.status,201);
  const buyerCookie=buyerResponse.headers.get('set-cookie').split(';')[0];
  const data={kind:'purchase',ids:[listing.id],name:'Persistence Buyer',phone:'+77001234567',city:'Алматы'};
  const order=await api(buyerCookie,'/orders','POST',data),legacy=await api(buyerCookie,'/orders','POST',data);
  await api(cookie,'/orders/'+order.id,'PATCH',{status:'accepted'});
  await stop();
  const db=new DatabaseSync(file);db.prepare('DELETE FROM order_sellers WHERE order_id=?').run(legacy.id);db.close();
  base=await start();
  const p=await(await fetch(base+'/api/profile',{headers:{Cookie:cookie}})).json();
  assert.equal(p.user.name,'Persistence QA');assert.equal(p.builds[0].name,'Persisted build');
  assert.equal(p.listings[0].price,149000);
  assert.equal(p.inquiries.find(o=>o.id===order.id).statusCode,'accepted');
  assert.equal(p.inquiries.find(o=>o.id===legacy.id).statusCode,'pending');
  assert.equal((await api(buyerCookie,'/orders/'+order.id)).statusCode,'accepted');
 }finally{await stop();for(const suffix of ['','-wal','-shm'])await unlink(file+suffix).catch(()=>{})}
});
