import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

let server,base;
before(async()=>{
  server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:':memory:',OPENAI_API_KEY:'',OPENAI_MODEL:''},stdio:['ignore','pipe','pipe']});
  base=await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{const url=String(d).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url)resolve(url)});server.on('error',reject);server.on('exit',code=>reject(new Error('Server exited '+code)));setTimeout(()=>reject(new Error('Server timeout')),10000).unref()});
});
after(()=>server?.kill());
async function request(cookie,url,method='GET',data){
  const r=await fetch(base+'/api'+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie||''},body:data===undefined?undefined:JSON.stringify(data)});
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const fields={title:'RTX 4060 owner listing',category:'gpu',modelId:1,price:150000,condition:'used',city:'Алматы',brand:'MSI',description:'Working graphics card with original box and full local test results.'};
const contact={kind:'purchase',name:'Buyer Test',phone:'+77001234567',city:'Алматы',note:'Available after 6 PM'};

test('listing editor and multi-seller request lifecycle',async t=>{
  const users=[];
  for(const name of ['Seller One','Seller Two','Buyer Test','Unrelated User']){const r=await request('', '/auth/register','POST',{name,email:name.replaceAll(' ','')+'@example.test',password:'StrongPassword123!'});assert.equal(r.status,201);users.push(r.cookie)}
  const [seller,second,buyer,stranger]=users;
  const first=(await request(seller,'/listings','POST',{...fields,image})).data.id;
  const another=(await request(second,'/listings','POST',{...fields,condition:'new',title:'Second seller GPU',price:140000})).data.id;
  let orderId;
  await t.test('listing editor rejects anonymous and unrelated accounts',async()=>{
    assert.equal((await request('',`/listings/${first}`)).status,401);
    for(const method of ['GET','PUT'])assert.equal((await request(buyer,`/listings/${first}`,method,method==='PUT'?fields:undefined)).status,404);
  });
  await t.test('edit updates catalog and preserves existing image and validated model',async()=>{
    assert.equal((await request(seller,`/listings/${first}`,'PUT',{...fields,title:'Updated owner graphics card',price:149999})).status,200);
    const p=(await request('', '/bootstrap')).data.products.find(p=>p.id===first);
    assert.equal(p.price,149999);assert.equal(p.title,'Updated owner graphics card');assert.equal(p.image,image);assert.equal(p.spec.referenceId,1);assert.equal(p.spec.watts,160);
  });
  await t.test('invalid edits leave the original listing intact',async()=>{
    for(const change of [{price:0},{modelId:2},{image:'data:image/png;base64,invalid'},{category:'invalid'}])assert.equal((await request(seller,`/listings/${first}`,'PUT',{...fields,...change})).status,400);
    assert.equal((await request(seller,`/listings/${first}`)).data.price,149999);
  });
  await t.test('seller can edit a sold listing and remove its image without reactivating it',async()=>{
    await request(seller,`/listings/${first}`,'PATCH',{status:'sold'});
    await request(seller,`/listings/${first}`,'PUT',{...fields,removeImage:true});
    const p=(await request(seller,`/listings/${first}`)).data;assert.equal(p.image,null);assert.equal(p.status,'sold');
    assert.ok(!(await request('', '/bootstrap')).data.products.some(p=>p.id===first));
    await request(seller,`/listings/${first}`,'PATCH',{status:'active'});
  });
  await t.test('numeric and string duplicate IDs are rejected',async()=>{
    assert.equal((await request(buyer,'/orders','POST',{...contact,ids:[first,String(first)]})).status,400);
  });
  await t.test('changed checkout price requires confirmation and creates no order',async()=>{
    const count=(await request(buyer,'/profile')).data.orders.length;
    const mismatch=await request(buyer,'/orders','POST',{...contact,ids:[first],expectedPrices:{[first]:149000}});
    assert.equal(mismatch.status,409);assert.match(mismatch.data.error,/Цена/);
    assert.equal((await request(buyer,'/profile')).data.orders.length,count);
    assert.equal((await request(buyer,'/orders','POST',{...contact,ids:[first],expectedPrices:{}})).status,400);
    assert.equal((await request(buyer,'/orders','POST',{...contact,ids:[first],expectedPrices:{[first]:150000}})).status,201);
  });
  await t.test('seller inbox exposes only its own items and subtotal',async()=>{
    const r=await request(buyer,'/orders','POST',{...contact,ids:[first,another]});assert.equal(r.status,201);orderId=r.data.id;
    const a=(await request(seller,`/orders/${orderId}`)).data,b=(await request(second,'/profile')).data.inquiries[0];
    assert.deepEqual(a.items.map(p=>p.id),[first]);assert.equal(a.total,150000);assert.equal(a.responses.length,1);
    assert.deepEqual(b.items.map(p=>p.id),[another]);assert.equal(b.total,140000);
    assert.equal((await request(stranger,`/orders/${orderId}`)).status,404);
    assert.equal((await request(stranger,`/orders/${orderId}`,'PATCH',{status:'accepted'})).status,404);
  });
  await t.test('request prices remain fixed after a listing edit',async()=>{
    await request(seller,`/listings/${first}`,'PUT',{...fields,price:160000});
    assert.equal((await request(buyer,`/orders/${orderId}`)).data.total,290000);
  });
  await t.test('seller replies are independent, buyer sees both',async()=>{
    assert.equal((await request(seller,`/orders/${orderId}`,'PATCH',{status:'completed'})).status,409);
    assert.equal((await request(seller,`/orders/${orderId}`,'PATCH',{status:'accepted'})).status,200);
    const r=(await request(buyer,`/orders/${orderId}`)).data;
    assert.equal(r.statusCode,'partial');assert.deepEqual(r.responses.map(r=>r.statusCode).sort(),['accepted','pending']);
    assert.equal((await request(second,`/orders/${orderId}`)).data.statusCode,'pending');
    assert.equal((await request(buyer,`/orders/${orderId}`,'PATCH',{status:'accepted'})).status,409);
  });
  await t.test('buyer cancellation stops all sellers and duplicate cancellation',async()=>{
    assert.equal((await request(buyer,`/orders/${orderId}`,'PATCH',{status:'cancelled'})).status,200);
    for(const cookie of [seller,second]){assert.equal((await request(cookie,`/orders/${orderId}`)).data.statusCode,'cancelled');assert.equal((await request(cookie,`/orders/${orderId}`,'PATCH',{status:'accepted'})).status,409)}
    assert.equal((await request(buyer,`/orders/${orderId}`,'PATCH',{status:'cancelled'})).status,409);
  });
  await t.test('completed and declined requests cannot be reopened',async()=>{
    for(const terminal of ['completed','declined']){
      const id=(await request(buyer,'/orders','POST',{...contact,ids:[first]})).data.id;
      if(terminal==='completed')await request(seller,`/orders/${id}`,'PATCH',{status:'accepted'});
      assert.equal((await request(seller,`/orders/${id}`,'PATCH',{status:terminal})).status,200);
      assert.equal((await request(seller,`/orders/${id}`,'PATCH',{status:'accepted'})).status,409);
      assert.equal((await request(buyer,`/orders/${id}`,'PATCH',{status:'cancelled'})).status,409);
      assert.equal((await request(buyer,`/orders/${id}`)).data.canCancel,false);
    }
  });
  await t.test('assembly requests do not reach individual component sellers',async()=>{
    const r=await request(buyer,'/orders','POST',{...contact,kind:'assembly',address:'улица Тестовая, дом 10, квартира 5',ids:[2,3,4,another,24,26,29,31]});assert.equal(r.status,201);
    assert.ok(!(await request(second,'/profile')).data.inquiries.some(o=>o.id===r.data.id));
    assert.equal((await request(seller,`/orders/${r.data.id}`)).status,404);
    assert.equal((await request(buyer,`/orders/${r.data.id}`,'PATCH',{status:'cancelled'})).status,200);
  });
});
