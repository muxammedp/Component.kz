import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {seedProducts,recommendVariants,evaluate} from '../catalog.mjs';
import {classifyModel} from '../public/model-taxonomy.js';

test('recommendations contain three distinct complete new builds within budget',()=>{
 const result=recommendVariants(seedProducts,650000,'games');
 assert.equal(result.variants.length,3);
 assert.equal(new Set(result.variants.map(r=>r.id)).size,3);
 assert.equal(result.parts,result.variants[0].parts);
 for(const r of result.variants){
  assert.ok(r.evaluation.complete&&r.evaluation.compatible);
  assert.ok(r.evaluation.total<=650000);
  assert.ok(r.parts.every(p=>p.condition==='new'));
  assert.equal(r.evaluation.total,r.parts.reduce((sum,p)=>sum+p.price,0));
  assert.ok(!r.parts.some(p=>['monitor','peripheral'].includes(p.category)));
 }
 assert.ok(new Set(result.variants.map(r=>r.evaluation.total)).size>1);
});

test('CPU and graphics preferences filter chip makers rather than card vendors',()=>{
 for(const cpuMaker of ['Intel','AMD'])for(const gpuMaker of ['NVIDIA','AMD','Intel']){
  const result=recommendVariants(seedProducts,1000000,'games',{cpuMaker,gpuMaker});
  assert.ok(result,`${cpuMaker}/${gpuMaker}`);
  for(const r of result.variants){
   assert.equal(classifyModel(r.parts.find(p=>p.category==='cpu')).maker,cpuMaker);
   assert.equal(classifyModel(r.parts.find(p=>p.category==='gpu')).maker,gpuMaker);
   assert.equal(r.evaluation.graphics.type,'discrete');
  }
 }
});

test('peripherals are complete and included in the common budget',()=>{
 const result=recommendVariants(seedProducts,650000,'games',{cpuMaker:'Intel',gpuMaker:'AMD',peripherals:true});
 for(const r of result.variants){
  assert.equal(r.parts.filter(p=>p.category==='monitor').length,1);
  assert.equal(r.parts.filter(p=>p.category==='peripheral').length,1);
  assert.match(r.parts.find(p=>p.category==='peripheral').spec.type,/Клавиатура и мышь/);
  assert.ok(evaluate(r.parts).total<=650000);
 }
 assert.equal(recommendVariants(seedProducts,250000,'work',{peripherals:true}),null);
 assert.equal(recommendVariants(seedProducts.filter(p=>p.category!=='peripheral'),1000000,'work',{peripherals:true}),null);
});

test('seller titles do not override the canonical chip manufacturer',()=>{
 const renamed=seedProducts.map(p=>({...p,title:'Новое предложение от продавца'}));
 const result=recommendVariants(renamed,650000,'games',{cpuMaker:'AMD',gpuMaker:'NVIDIA'});
 assert.ok(result);
 for(const r of result.variants){
  assert.equal(r.parts.find(p=>p.category==='cpu').model.maker,'AMD');
  assert.equal(r.parts.find(p=>p.category==='gpu').model.maker,'NVIDIA');
 }
});

test('office variants and explicitly integrated graphics avoid a discrete gaming card',()=>{
 for(const prefs of [{},{cpuMaker:'AMD',gpuMaker:'integrated'}]){
  const r=recommendVariants(seedProducts,1000000,'work',prefs);
  assert.ok(r.variants.length>=2);
  for(const v of r.variants){assert.equal(v.evaluation.graphics.type,'integrated');assert.ok(!v.parts.some(p=>p.category==='gpu'))}
 }
 assert.equal(recommendVariants(seedProducts.filter(p=>p.category!=='cpu'||p.id===2),1000000,'work',{gpuMaker:'integrated'}),null);
 const explicit=recommendVariants(seedProducts,1000000,'work',{gpuMaker:'NVIDIA'});
 assert.ok(explicit.variants.every(v=>classifyModel(v.parts.find(p=>p.category==='gpu')).maker==='NVIDIA'));
});

test('limited availability returns fewer actual variants without duplicates',()=>{
 const base=recommendVariants(seedProducts,250000,'work').variants[0].parts;
 const r=recommendVariants(base,1000000,'work');
 assert.equal(r.variants.length,1);assert.ok(r.notice);
 assert.equal(recommendVariants(base.map(p=>({...p,evaluationReady:false})),1000000,'work'),null);
 const duplicates=[...base,...base.map(p=>({...p,id:p.id+9000000,price:p.price+10000}))];
 assert.equal(recommendVariants(duplicates,1000000,'work').variants.length,1);
});

test('recommendation API validates preferences and supports legacy first-build fields',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
 try{
  const base=await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{const url=String(d).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url)resolve(url)});child.on('error',reject);setTimeout(()=>reject(Error('startup timeout')),10000).unref()});
  const api=async prefs=>{const r=await fetch(base+'/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({budget:650000,task:'games',...prefs})});return {status:r.status,data:await r.json()}};
  const r=await api({cpuMaker:'Intel',gpuMaker:'AMD',peripherals:true});
  assert.equal(r.status,200);assert.equal(r.data.variants.length,3);assert.deepEqual(r.data.parts,r.data.variants[0].parts);
  for(const v of r.data.variants){assert.equal(v.parts.find(p=>p.category==='cpu').brand,'Intel');assert.equal(v.evaluation.graphics.type,'discrete');assert.ok(v.parts.some(p=>p.category==='monitor'));assert.ok(v.evaluation.total<=650000)}
  for(const prefs of [{cpuMaker:'other'},{gpuMaker:'MSI'},{peripherals:'false'},{condition:'used'}])assert.equal((await api(prefs)).status,400);
  assert.equal((await api({budget:100000,peripherals:true})).status,422);
  const office=await api({task:'work'});assert.equal(office.status,200);assert.equal(office.data.evaluation.graphics.type,'integrated');
 }finally{if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}
});
