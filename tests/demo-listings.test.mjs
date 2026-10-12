import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {seedProducts,categories,recommend} from '../catalog.mjs';
import {generateDemoListings,seedDemoListings,demoCities} from '../demo-listings.mjs';

test('bulk examples are deterministic, diverse, explicitly demo and tied to valid reference specs',()=>{
  const rows=generateDemoListings(3000);
  assert.deepEqual(rows,generateDemoListings(3000));
  assert.equal(new Set(rows.map(p=>p.key)).size,3000);
  assert.equal(new Set(rows.map(p=>p.city)).size,demoCities.length);
  for(const {id} of categories){const pool=rows.filter(p=>p.category===id);assert.ok(pool.length>=272);assert.deepEqual(new Set(pool.map(p=>p.condition)),new Set(['used','new']))}
  for(const p of rows){const model=seedProducts.find(m=>m.id===p.spec.referenceId);assert.equal(p.category,model.category);assert.equal(p.demo,true);assert.ok(p.price>0&&Number.isInteger(p.price));assert.match(p.description,/не предложение реального продавца/);const {referenceId,...spec}=p.spec;assert.deepEqual(spec,model.spec)}
  assert.throws(()=>generateDemoListings(10001));
});

function database(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE products(id INTEGER PRIMARY KEY,title TEXT,category TEXT,price INTEGER,condition TEXT,city TEXT,brand TEXT,description TEXT,spec TEXT,art TEXT,score INTEGER,demo INTEGER,created TEXT,owner_id INTEGER,status TEXT DEFAULT \'active\');');for(const p of seedProducts)db.prepare('INSERT INTO products(id,title,demo) VALUES(?,?,1)').run(p.id,p.title);return db}
test('bulk seeding is idempotent and preserves pre-existing user listings and IDs',()=>{
  const db=database();try{
    db.prepare('INSERT INTO products(id,title,owner_id,demo) VALUES(37,?,7,0)').run('Existing seller listing');
    const original=db.prepare('SELECT * FROM products ORDER BY id').all();
    assert.deepEqual(seedDemoListings(db,3000),{added:3000,skipped:0});
    assert.deepEqual(seedDemoListings(db,3000),{added:0,skipped:3000});
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n,seedProducts.length+3001);
    assert.deepEqual(original.map(p=>db.prepare('SELECT * FROM products WHERE id=?').get(p.id)),original);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products WHERE id>37 AND (demo!=1 OR owner_id IS NOT NULL)').get().n,0);
  }finally{db.close()}
});
test('failed bulk seed rolls back the complete batch',()=>{
  const db=database();try{db.exec('DELETE FROM products WHERE id=33');assert.throws(()=>seedDemoListings(db,100));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n,seedProducts.length-1)}finally{db.close()}
});
test('recommendation keeps cheapest equivalent offer and still respects condition and budget',()=>{
  const base=[1,2,3,4,5,26,29,31].map(id=>seedProducts.find(p=>p.id===id));
  const cpu=base.find(p=>p.category==='cpu');
  const rows=[...base,{...cpu,id:900,price:10000,condition:'used'},{...cpu,id:901,price:50000,condition:'new'},...Array.from({length:300},(_,i)=>({...cpu,id:1000+i,price:100000+i}))];
  const mixed=recommend(rows,600000,'mixed'),fresh=recommend(rows,600000,'new');
  assert.equal(mixed.parts.find(p=>p.category==='cpu').id,900);
  assert.equal(fresh.parts.find(p=>p.category==='cpu').id,901);
  assert.ok(mixed.evaluation.complete&&mixed.evaluation.compatible);
  assert.equal(recommend(rows,50000,'mixed'),null);
});
