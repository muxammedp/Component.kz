import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedProducts,withGraphicsMetadata,evaluate} from '../catalog.mjs';
import {modelSteps,modelMatches,modelOptionsAt,narrowSelection} from '../public/model-taxonomy.js';

test('expanded references have unique stable IDs and a complete path for every mandatory category',()=>{
 assert.ok(seedProducts.length>=90);
 assert.equal(new Set(seedProducts.map(p=>p.id)).size,seedProducts.length);
 for(const category of Object.keys(modelSteps)){
  const pool=seedProducts.filter(p=>p.category===category);assert.ok(pool.length>=5,category);
  for(const p of pool)for(const [key] of modelSteps[category])assert.ok(typeof p.model[key]==='string'&&p.model[key],p.title+': '+key);
 }
 for(const category of ['monitor','peripheral','pc'])assert.equal(modelSteps[category],undefined);
});
test('CPU hierarchy separates manufacturers, families, series and exact models',()=>{
 assert.deepEqual(modelOptionsAt(seedProducts,'cpu',{maker:'AMD'},1).map(o=>o.value),['Athlon','Ryzen 3','Ryzen 5','Ryzen 7','Ryzen 9']);
 const path={maker:'AMD',family:'Ryzen 5',generation:'Ryzen 7000'};
 const pool=seedProducts.filter(p=>p.category==='cpu'&&modelMatches(p,path));assert.deepEqual(pool.map(p=>p.title),['AMD Ryzen 5 7600']);
 const intel=modelOptionsAt(seedProducts,'cpu',{maker:'Intel'},1).map(o=>o.value);assert.ok(intel.includes('Core i3')&&intel.includes('Core i9')&&intel.includes('Pentium Gold'));
 assert.deepEqual(narrowSelection('cpu',{...path,name:'AMD Ryzen 5 7600'},'maker','Intel'),{maker:'Intel'});
 assert.deepEqual(narrowSelection('cpu',path,'family',''),{maker:'AMD'});
});
test('legacy Athlon requires a supported motherboard, not merely an AM4 socket',()=>{
 const parts=ids=>ids.map(id=>seedProducts.find(p=>p.id===id));
 assert.equal(evaluate(parts([2000018,3])).compatible,false);
 assert.equal(evaluate(parts([2000018,2000203])).compatible,true);
});
test('GPU chip manufacturer is independent from board brand',()=>{
 const p=seedProducts.find(p=>p.id===7);assert.equal(p.brand,'ASUS');assert.equal(p.model.maker,'AMD');assert.equal(p.model.chip,'RX 7800 XT');
 const a=seedProducts.find(p=>p.id===2000104);assert.equal(a.model.maker,'Intel');assert.equal(a.model.brand,'ASRock');assert.equal(a.model.generation,'A-Series');
 assert.deepEqual(modelOptionsAt(seedProducts,'gpu',{maker:'NVIDIA',family:'GeForce RTX',generation:'RTX 40',chip:'RTX 4060'},4).map(o=>o.value),['MSI']);
});
test('reference classification reaches old demo and real offers without changing seller data',()=>{
 for(const demo of [true,false]){
  const p={id:9999,title:'Продаю железо',category:'cpu',brand:'Продавец',price:34567,demo,spec:{referenceId:2000008}};
  const updated=withGraphicsMetadata(p);assert.equal(updated.model.name,'AMD Ryzen 5 7600');assert.ok(modelMatches(updated,{maker:'AMD',family:'Ryzen 5',generation:'Ryzen 7000'}));assert.equal(updated.price,p.price);assert.equal(updated.title,p.title);assert.equal(p.model,undefined);
 }
});
test('category-specific paths support DDR, capacity, power, chipset, format and cooling series',()=>{
 const checks=[['board',{maker:'Intel',socket:'LGA1700',chipset:'B760'},18],['ram',{brand:'Kingston',ram:'DDR5',size:'64 ГБ'},2000306],['ssd',{brand:'Seagate',storageType:'SATA HDD'},2000406],['psu',{brand:'Corsair',power:'1000 Вт'},2000504],['case',{brand:'DeepCool',form:'mATX'},2000601],['cooler',{brand:'DeepCool',coolingType:'Воздушное',family:'AK'},2000702]];
 for(const [category,path,id] of checks)assert.ok(seedProducts.filter(p=>p.category===category&&modelMatches(p,path)).some(p=>p.id===id));
});
