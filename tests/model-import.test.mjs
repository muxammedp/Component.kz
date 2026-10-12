import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {seedProducts,evaluate,recommend} from '../catalog.mjs';
import {initModels,importModels,listModels,getModel} from '../model-store.mjs';
import {parseAMD,parseIcecat,parseIntel} from '../imports/sources.mjs';
const open=()=>{const db=new DatabaseSync(':memory:');initModels(db,seedProducts);return db};
const record={category:'cpu',brand:'Intel',title:'Intel Core i5-14600K',externalId:'14600K',url:'https://www.intel.com/',spec:{socket:'LGA1700',cores:14,threads:20,tdp:125,graphics:'UHD 770'}};
test('model migration deduplicates packaging/condition while preserving every legacy reference',()=>{
 const db=open();try{assert.equal(listModels(db).length,87);assert.equal(getModel(db,16).id,2);for(const p of seedProducts)assert.equal(getModel(db,p.id).title,p.title)}finally{db.close()}
});
test('imports are atomic, repeatable, preserve identity and retain source provenance',()=>{
 const db=open();try{
  assert.deepEqual(importModels(db,'intel',[record],{dryRun:true}),{added:1,updated:0,unchanged:0});assert.equal(listModels(db).length,87);
  assert.equal(importModels(db,'intel',[record]).added,1);const p=listModels(db).find(p=>p.title===record.title);assert.equal(p.score,null);assert.equal(p.evaluationReady,false);assert.equal(p.price,undefined);assert.equal(p.sources[0].source,'intel');
  assert.equal(importModels(db,'intel',[record]).unchanged,1);assert.equal(importModels(db,'intel',[{...record,spec:{...record.spec,cores:16}}]).updated,1);assert.equal(getModel(db,p.id).spec.cores,16);
  assert.throws(()=>importModels(db,'intel',[{...record,externalId:'new',title:'New CPU'},{...record,spec:null}]));assert.equal(listModels(db).length,88);
  assert.throws(()=>importModels(db,'intel',[{...record,category:'gpu'}]));assert.equal(getModel(db,p.id).category,'cpu');
 }finally{db.close()}
});
test('official CPU specs match legacy model without changing demo scoring or seller records',()=>{
 const db=open();try{const r={...record,title:'AMD Ryzen™ 5 5600X',brand:'AMD',externalId:'5600X',spec:{socket:'AM4',tdp:65,graphics:'Нет'}};importModels(db,'amd-cpu',[r]);const p=getModel(db,2);assert.equal(p.score,65);assert.equal(p.spec.watts,65);assert.equal(p.facts.tdp,65);assert.equal(p.sources.length,1);assert.equal(listModels(db).length,87)}finally{db.close()}
});
test('incomplete reference specs never yield a confident build or enter recommendations',()=>{
 const parts=[2,3,4,1,24,26,29,31].map(id=>({...seedProducts.find(p=>p.id===id)}));parts[0].evaluationReady=false;
 const result=evaluate(parts);assert.equal(result.compatible,false);assert.equal(result.performance,null);assert.equal(result.value,null);assert.equal(result.tasks,null);assert.equal(recommend(parts,1000000,'mixed'),null);
});
test('bundled official data excludes soldered laptop CPUs and distinguishes no graphics from unknown',()=>{
 const db=open();try{
  for(const source of ['amd-cpu','amd-gpu','intel']){const records=JSON.parse(readFileSync(new URL('../data/reference/'+source+'.json',import.meta.url)));assert.ok(records.length>30);importModels(db,source,records);assert.equal(importModels(db,source,records).added,0)}
  const rows=listModels(db);assert.ok(rows.length>700);assert.ok(rows.find(p=>p.title==='Intel Core i5-14600K'));assert.ok(rows.find(p=>p.title==='AMD Ryzen 9 9950X'));assert.ok(!rows.some(p=>/^FP|^FT/.test(p.spec.socket)));assert.ok(!rows.some(p=>/undefined|NaN/.test(p.title)));
  const f=rows.find(p=>p.title==='Intel Core i5-14400F');assert.equal(f.spec.graphics,'Нет');assert.equal(f.spec.watts,undefined);
 }finally{db.close()}
});
test('AMD adapter fails on changed markup and filters mobile platform despite broad manufacturer tagging',()=>{
 assert.throws(()=>parseAMD('<html>Access denied</html>','cpu'));
 const item=socket=>({title:'Test CPU',elements:Object.fromEntries(Object.entries({name:'Test CPU',formFactor:['Desktops','Laptops'],cpuSocket:[socket],numOfCpuCores:'4',graphicsModel:null}).map(([k,value])=>[k,{value}]))});
 const html='<div data-json="'+JSON.stringify({items:[item('FP7'),item('AM5')]}).replaceAll('"','&#34;')+'">';
 const rows=parseAMD(html,'cpu');assert.equal(rows.length,1);assert.equal(rows[0].spec.graphics,'');
 assert.throws(()=>parseIntel(Buffer.from('Not an XLSX')));
});
test('Icecat adapter uses manufacturer part code and does not fabricate performance',()=>{
 const data={msg:'OK',data:{GeneralInfo:{IcecatId:123,Brand:'Kingston',BrandPartCode:'KF560C36BBE-16',Title:'Kingston FURY 16 GB DDR5',Category:{Name:{Value:'Memory modules'}}},FeaturesGroups:[{Features:[{Feature:{Name:{Value:'Internal memory'}},PresentationValue:'16 GB'},{Feature:{Name:{Value:'Internal memory type'}},PresentationValue:'DDR5'}]}]}};
 const [r]=parseIcecat(data,'ram');assert.equal(r.spec.size,16);assert.equal(r.spec.ram,'DDR5');assert.equal(r.mpn,'KF560C36BBE-16');assert.equal(r.score,undefined);assert.throws(()=>parseIcecat({msg:'Denied'},'ram'));
});
