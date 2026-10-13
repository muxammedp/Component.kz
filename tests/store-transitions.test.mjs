import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initStoreOrders,createStoreOrders} from '../store-orders.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1),(2)');initStoreOrders(db);db.prepare('INSERT INTO store_operators VALUES(2)').run();
 const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
 const txt=(v,min,max)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(400,'Invalid text');return v.trim()};
 const int=(v,min,max)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)fail(400,'Invalid number');return n};
 const api=createStoreOrders(db,{fail,txt,int,body:async req=>req.data,json:(res,data,status=200)=>Object.assign(res,{data,status})});
 const request=async(id,method,path,data)=>{const res={};await api({method,data},res,new URL('http://localhost/api/store-requests'+path),{id});return res.data};
 return {db,request};
}
const payload={requestKey:'transition-test-001',items:[{title:'New processor',store:'Test shop',url:'https://example.test/cpu',quantity:1}],contact:{name:'Test buyer',phone:'+77001234567',city:'Астана',address:'Test address'},note:''};
const offer={action:'quote',prices:[100000],delivery:1000,fee:2000,validHours:24,terms:'Test delivery'};
for(const end of ['cancel','decline','refund'])test(`store ${end}: terminal state, audit and rejected writes are atomic`,async()=>{
 const {db,request}=fixture();try{
  let order=await request(1,'POST','',payload);
  order=await request(2,'PATCH','/'+order.id,{...offer,version:order.version});
  if(end==='refund')order=await request(1,'PATCH','/'+order.id,{action:'demo-pay',version:order.version,confirmDemo:true});
  const count=db.prepare('SELECT count(*) AS n FROM store_events').get().n;
  if(end!=='cancel'){
   await assert.rejects(request(2,'PATCH','/'+order.id,{action:end,version:order.version,message:''}),{status:400});
   assert.equal(db.prepare('SELECT count(*) AS n FROM store_events').get().n,count);
   assert.equal(db.prepare('SELECT version FROM store_requests').get().version,order.version);
  }
  order=await request(end==='cancel'?1:2,'PATCH','/'+order.id,{action:end,version:order.version,message:'Test reason'});
  assert.equal(order.status,{cancel:'cancelled',decline:'declined',refund:'refunded'}[end]);
  assert.equal(order.events.length,count+1);assert.equal(order.quote.total,103000);
  await assert.rejects(request(2,'PATCH','/'+order.id,{...offer,version:order.version}),{status:409});
  await assert.rejects(request(1,'PATCH','/'+order.id,{action:'demo-pay',version:order.version,confirmDemo:true}),{status:409});
 }finally{db.close()}
});
