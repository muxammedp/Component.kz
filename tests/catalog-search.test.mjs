import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedProducts} from '../catalog.mjs';
import {filterProducts,searchScore,effectiveQuery,suggestQueries,parsePrice,refineCategory} from '../public/catalog-search.js';
const filter={category:'all',condition:'all',q:'',brand:[],min:'',max:'',sort:'popular',source:'all',spec:{}};
const find=q=>filterProducts(seedProducts,{...filter,q});
test('search accepts joined model numbers, reversed words and punctuation',()=>{
  for(const q of ['RTX4060Ti','4060 MSI','  MSI   RTX-4060  ','8гб 4060'])assert.ok(find(q).some(p=>p.id===1),q);
});
test('search indexes reference specs and Russian component names',()=>{
  assert.deepEqual(find('DDR4 32GB').map(p=>p.id).sort((a,b)=>a-b),[4,23,35]);
  assert.ok(find('райзен 5600').some(p=>p.id===2));assert.ok(find('оперативная память').every(p=>p.category==='ram'));
  assert.ok(find('интел 13400').some(p=>p.id===14));
});
test('keyboard layout recovery is used only when original query has no matches',()=>{
  assert.equal(effectiveQuery(seedProducts,'кеч 4060').corrected,true);assert.ok(find('кеч 4060').some(p=>p.id===1));
  assert.equal(effectiveQuery(seedProducts,'райзен 5600').corrected,false);
});
test('nearby numeric models are never fuzzy matched',()=>{
  assert.equal(searchScore(seedProducts[0],'RTX 4061'),0);assert.equal(find('RTX 406').length,0);assert.equal(suggestQueries(seedProducts,'RTX 4061').length,0);
});
test('typo correction proposes a real matching query without changing numeric identifiers',()=>{
  assert.ok(suggestQueries(seedProducts,'ryzne 5600').includes('ryzen 5600'));
  assert.deepEqual(suggestQueries(seedProducts,'ryzne 5601'),[]);
});
test('facet counts respect other filters and exclude only their own condition',()=>{
  const f={...filter,category:'gpu',condition:'used',max:'150000',brand:['MSI']};
  assert.deepEqual(filterProducts(seedProducts,f).map(p=>p.id),[12]);
  assert.deepEqual(filterProducts(seedProducts,f,'','brand').map(p=>p.id).sort((a,b)=>a-b),[9,12]);
});
test('spec filters combine OR within a field and AND across fields',()=>{
  const f={...filter,category:'gpu',spec:{memory:['8 GB','12 GB'],type:['GDDR6X']}};
  assert.deepEqual(filterProducts(seedProducts,f).map(p=>p.id),[8]);
  assert.ok(filterProducts(seedProducts,{...filter,category:'cooler',spec:{sockets:['AM5']}}).length===2);
});
test('sorting is numeric, deterministic, and favors actual listings for unfiltered browsing',()=>{
  const actual={...seedProducts[0],id:100,demo:false,city:'Алматы'};const products=[...seedProducts,actual];
  assert.equal(filterProducts(products,filter)[0].id,100);
  const cheap=filterProducts(products,{...filter,sort:'cheap'}).map(p=>p.price);assert.deepEqual(cheap,[...cheap].sort((a,b)=>a-b));
  assert.equal(filterProducts(products,{...filter,source:'real'})[0].id,100);assert.equal(filterProducts(products,{...filter,source:'real'},'Астана').length,0);
});
test('price parser accepts pasted spaces and rejects ambiguous decimal or malformed input',()=>{
  assert.equal(parsePrice('150 000'),'150000');assert.equal(parsePrice('150\u202f000'),'150000');assert.equal(parsePrice(''),'');
  for(const value of ['-1','10.5','100,000','1e5','hello'])assert.throws(()=>parsePrice(value));
});
test('search finds seller-declared reference model even when missing from title',()=>{
  const actual={...seedProducts[0],id:101,title:'Продам видеокарту в отличном состоянии',description:'Комплект и коробка, карта проверена.',demo:false,spec:{...seedProducts[0].spec,referenceId:1}};
  const products=[...seedProducts,actual];
  assert.ok(filterProducts(products,{...filter,q:'RTX4060',source:'real'}).some(p=>p.id===101));
  assert.equal(filterProducts([{...actual,spec:{...actual.spec,referenceId:999}}],{...filter,q:'RTX4060'}).length,0);
  assert.equal(filterProducts([...seedProducts,{...actual,category:'cpu'}],{...filter,q:'RTX4060',category:'cpu'}).length,0);
});
test('search supports typed power, frequency and capacity units with paired values',()=>{
  assert.deepEqual(find('750 вт').map(p=>p.id).sort((a,b)=>a-b),[26,28]);
  assert.deepEqual(find('144 гц').map(p=>p.id),[33]);
  assert.deepEqual(find('3200 мгц').map(p=>p.id).sort((a,b)=>a-b),[4,21,23]);
  assert.equal(find('8 вт').length,0);assert.equal(find('160 гб').length,0);
  assert.ok(find('1 тб').some(p=>p.id===24));
});
test('category refinement preserves general constraints and removes only inapplicable facets',()=>{
  const current={...filter,q:'AMD',min:'10000',max:'200000',condition:'used',source:'real',sort:'cheap',category:'gpu',brand:['MSI','AMD'],spec:{memory:['8 GB']}};
  const changed=refineCategory(seedProducts,current,'cpu');
  assert.equal(changed.q,current.q);assert.equal(changed.max,current.max);assert.equal(changed.condition,'used');assert.equal(changed.sort,'cheap');assert.equal(changed.source,'real');assert.deepEqual(changed.brand,['AMD']);assert.deepEqual(changed.spec,{});
  assert.deepEqual(current.spec,{memory:['8 GB']});assert.equal(current.category,'gpu');
});
