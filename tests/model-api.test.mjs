import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
let server,base,cookie;
before(async()=>{server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const u=String(d).match(/http:\/\/127.0.0.1:\d+/)?.[0];if(u)resolve(u)});server.on('error',reject);server.on('exit',c=>reject(Error('Server exit '+c)));setTimeout(()=>reject(Error('Timeout')),15000).unref()})});
after(()=>server?.kill());
async function api(route,body){const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie||''},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}}
test('official models can be searched and listed without manufacturing offers',async()=>{
 const b=await api('/bootstrap');assert.equal(b.data.products.length,93);assert.ok(b.data.models.length>700);
 const r=await api('/models?category=cpu&q=9950X&limit=1');assert.equal(r.status,200);assert.equal(r.data.items.length,1);assert.ok(r.data.total>=1);assert.equal(r.data.items[0].evaluationReady,false);assert.ok(r.data.items[0].sources.length);
 assert.equal((await api('/models?limit=-1')).status,400);
});
test('model requests require login, reject unsafe URLs and deduplicate repeated submissions',async()=>{
 const request={category:'gpu',title:'Example missing GPU',url:'https://www.amd.com/'};
 assert.equal((await api('/model-requests',request)).status,401);
 const user=await api('/auth/register',{name:'Model QA',email:'model@example.test',password:'Password123'});cookie=user.cookie.split(';')[0];
 assert.equal((await api('/model-requests',{...request,url:'javascript:alert(1)'})).status,400);
 const a=await api('/model-requests',request),b=await api('/model-requests',request);assert.equal(a.status,201);assert.equal(a.data.id,b.data.id);assert.equal(a.data.status,'pending');
 assert.equal((await api('/model-requests',{...request,category:'pc'})).status,400);
});
test('real listings inherit imported models but unknown performance cannot be used in a confident assembly',async()=>{
 const model=(await api('/models?category=cpu&q=Intel%20Core%20i5-14600K')).data.items[0];assert.ok(model);
 const listing={category:'cpu',modelId:model.id,title:'Processor for sale QA',price:120000,condition:'used',city:'Астана',description:'Working processor for imported reference testing.'};
 assert.equal((await api('/listings',{...listing,category:'gpu'})).status,400);
 const r=await api('/listings',listing);assert.equal(r.status,201);
 const p=(await api('/bootstrap')).data.products.find(p=>p.id===r.data.id);assert.equal(p.model.name,model.title);assert.equal(p.evaluationReady,false);assert.equal(p.price,120000);
 const result=await api('/evaluate',{ids:[r.data.id,18,4,1,24,26,29,31]});assert.equal(result.status,200);assert.equal(result.data.compatible,false);assert.equal(result.data.value,null);
 assert.equal((await api('/orders',{ids:[r.data.id,18,4,1,24,26,29,31],kind:'assembly',address:'улица Тестовая, дом 10, квартира 5',name:'QA',phone:'+77001234567',city:'Астана'})).status,400);
});
