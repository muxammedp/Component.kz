import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {seedProducts,evaluate,recommend,withGraphicsMetadata} from '../catalog.mjs';
const parts=ids=>ids.map(id=>structuredClone(seedProducts.find(p=>p.id===id)));
const officeIds=[1000001,3,21,24,27,29,31];

test('integrated graphics completes a seven-part PC with lower power and a modest gaming score',()=>{
 const p=parts(officeIds),e=evaluate(p);
 assert.ok(e.complete&&e.compatible);
 assert.deepEqual(e.missing,[]);
 assert.equal(e.graphics.type,'integrated');
 assert.equal(e.watts,145);
 assert.ok(e.tasks.work>=55&&e.tasks.games<20);
 assert.equal(e.total,p.reduce((s,p)=>s+p.price,0));
 const discrete=evaluate([...p,...parts([1])]);
 assert.equal(discrete.graphics.type,'discrete');
 assert.equal(discrete.watts-e.watts,160);
 assert.ok(discrete.tasks.games>e.tasks.games);
});
test('CPUs without or with unknown graphics cannot complete a PC without a GPU',()=>{
 for(const id of [2,14,15,16]) assert.ok(evaluate(parts([id,...officeIds.slice(1)])).missing.includes('gpu'));
 const p=parts(officeIds);delete p[0].spec.graphics;
 assert.equal(evaluate(p).complete,false);
 assert.equal(evaluate(p).performance,null);
});
test('integrated graphics requires confirmed motherboard display outputs and matching socket',()=>{
 const p=parts(officeIds);delete p[1].spec.displayOutputs;
 assert.equal(evaluate(p).compatible,false);
 assert.match(evaluate(p).errors.join(' '),/видеовыход/);
 assert.equal(evaluate([...p,...parts([1])]).compatible,true);
 assert.ok(evaluate(parts([17,19,22,24,27,29,31])).compatible);
 assert.equal(evaluate(parts([17,3,22,24,27,29,31])).compatible,false);
});
test('office budgets are ceilings: new, used and mixed builds avoid a gaming GPU even with a large budget',()=>{
 for(const condition of ['new','used','mixed']){
  const low=recommend(seedProducts,250000,condition,'work');
  const high=recommend(seedProducts,1000000,condition,'work');
  assert.ok(low?.evaluation.complete&&low.evaluation.compatible);
  assert.equal(high.evaluation.total,low.evaluation.total);
  assert.equal(high.evaluation.graphics.type,'integrated');
  assert.equal(high.parts.length,7);
  assert.ok(high.parts.find(p=>p.category==='ram').spec.size>=16);
  if(condition!=='mixed')assert.ok(high.parts.every(p=>p.condition===condition));
 }
 assert.equal(recommend(seedProducts,100000,'new','work'),null);
 assert.equal(recommend(seedProducts,500000,'new','games').evaluation.graphics.type,'discrete');
 assert.equal(recommend(seedProducts,500000,'new','render').evaluation.graphics.type,'discrete');
});
test('office fallback uses the cheapest compatible discrete GPU when integrated graphics is unavailable',()=>{
 const p=seedProducts.filter(p=>p.category!=='cpu'||p.id===2);
 const r=recommend(p,1000000,'new','work');
 assert.equal(r.parts.find(p=>p.category==='gpu').id,2000103);
 assert.match(r.reason,/нет встроенной графики/);
});
test('legacy demo and seller reference listings receive graphics facts without rewriting their data',()=>{
 for(const demo of [true,false]){
  const p={...parts([17])[0],id:999,title:'Seller title',demo,spec:{socket:'AM5',referenceId:17}};
  const original=structuredClone(p),updated=withGraphicsMetadata(p);
  assert.match(updated.spec.graphics,/Radeon/);
  assert.deepEqual(p,original);
  assert.equal(updated.title,p.title);assert.equal(updated.price,p.price);
 }
 const unknown={...parts([17])[0],id:999,demo:false,spec:{socket:'AM5'}};
 assert.equal(withGraphicsMetadata(unknown).spec.graphics,undefined);
});
test('HTTP recommendation, saved build and assembly order accept integrated graphics and reject a CPU swap without graphics',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
 try{
  const base=await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{const url=String(d).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url)resolve(url)});child.on('error',reject);setTimeout(()=>reject(Error('startup timeout')),10000).unref()});
  let cookie='';
  const api=async(path,body)=>{const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')}};
  const user=await api('/auth/register',{name:'Office Tester',email:'office@example.test',password:'StrongPass123!'});cookie=user.cookie.split(';')[0];
  const r=await api('/recommend',{budget:450000,condition:'new',task:'work'});
  assert.equal(r.status,200);assert.equal(r.data.parts.length,7);
  assert.equal((await api('/evaluate',{ids:officeIds})).data.graphics.type,'integrated');
  const saved=await api('/builds',{ids:officeIds,name:'Office with integrated graphics'});assert.equal(saved.status,201);
  const order={ids:officeIds,kind:'assembly',name:'Office Tester',phone:'+77001234567',city:'Астана'};
  const created=await api('/orders',order);assert.equal(created.status,201);assert.equal(created.data.total,evaluate(parts(officeIds)).total);
  assert.equal((await api('/orders',{...order,ids:[2,...officeIds.slice(1)]})).status,400);
  const p=(await api('/profile')).data;assert.equal(p.orders.length,1);assert.equal(p.builds.length,1);
 }finally{if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
});
