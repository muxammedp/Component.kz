import {classifyModel} from './public/model-taxonomy.js';

export const modelKey=value=>String(value).normalize('NFKC').replace(/[™®©]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const clean=value=>String(value??'').replace(/[™®©]/g,'').replace(/\s+/g,' ').trim();
export function initModels(db,seeds=[]){
 db.exec(`PRAGMA busy_timeout=10000;
 CREATE TABLE IF NOT EXISTS hardware_models(id INTEGER PRIMARY KEY,identity TEXT UNIQUE NOT NULL,category TEXT NOT NULL,brand TEXT NOT NULL,title TEXT NOT NULL,spec TEXT NOT NULL,taxonomy TEXT NOT NULL,score INTEGER,ready INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS model_aliases(alias INTEGER PRIMARY KEY,model_id INTEGER NOT NULL REFERENCES hardware_models(id));
 CREATE TABLE IF NOT EXISTS model_sources(source TEXT NOT NULL,external_id TEXT NOT NULL,model_id INTEGER NOT NULL REFERENCES hardware_models(id),url TEXT NOT NULL,checked TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(source,external_id));
 CREATE TABLE IF NOT EXISTS model_imports(id INTEGER PRIMARY KEY,source TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP,added INTEGER NOT NULL,updated INTEGER NOT NULL,unchanged INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS model_requests(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),category TEXT NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,category,title));`);
 const insert=db.prepare('INSERT OR IGNORE INTO hardware_models(id,identity,category,brand,title,spec,taxonomy,score,ready,updated) VALUES(?,?,?,?,?,?,?,?,1,?)');
 for(const p of seeds){
  const identity=[p.category,modelKey(p.brand),modelKey(p.title)].join(':');
  insert.run(p.id,identity,p.category,p.brand,p.title,JSON.stringify(p.spec),JSON.stringify(p.model||classifyModel(p)),p.score,new Date().toISOString());
  const id=db.prepare('SELECT id FROM hardware_models WHERE identity=?').get(identity).id;
  db.prepare('INSERT OR IGNORE INTO model_aliases VALUES(?,?)').run(p.id,id);
 }
}
function view(db,row){
 if(!row)return null;
 const latest=db.prepare('SELECT payload FROM model_sources WHERE model_id=? ORDER BY checked DESC LIMIT 1').get(row.id);
 return {id:row.id,category:row.category,brand:row.brand,title:row.title,spec:JSON.parse(row.spec),facts:latest?JSON.parse(latest.payload).spec:JSON.parse(row.spec),model:JSON.parse(row.taxonomy),score:row.score,evaluationReady:!!row.ready,updated:row.updated,sources:db.prepare('SELECT source,url,checked FROM model_sources WHERE model_id=? ORDER BY source').all(row.id)};
}
export function getModel(db,id){return view(db,db.prepare('SELECT * FROM hardware_models WHERE id=COALESCE((SELECT model_id FROM model_aliases WHERE alias=?),?)').get(id,id))}
export function listModels(db){return db.prepare('SELECT * FROM hardware_models ORDER BY title COLLATE NOCASE').all().map(row=>view(db,row))}
export function importModels(db,source,records,{dryRun=false}={}){
 if(!['amd-cpu','amd-gpu','intel','icecat','manual'].includes(source))throw Error('Неизвестный источник');
 if(!Array.isArray(records)||!records.length||records.length>20000)throw Error('Пустой или слишком большой импорт');
 const allowed=['cpu','gpu','board','ram','ssd','psu','case','cooler'];
 const normalized=records.map(p=>{
  if(!allowed.includes(p.category)||!clean(p.title)||clean(p.title).length>240||!clean(p.brand)||!p.externalId||!p.spec||Array.isArray(p.spec)||typeof p.spec!=='object')throw Error('Некорректная модель');
  const url=new URL(p.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Источник должен быть HTTPS');
  if(JSON.stringify(p).length>30000)throw Error('Слишком большая запись');
  const spec=Object.fromEntries(Object.entries(p.spec).filter(([k,v])=>!['__proto__','constructor','prototype','referenceId','graphicsScore','evaluationReady'].includes(k)&&v!==null&&v!==undefined&&v!==''));
  const title=clean(p.title),brand=clean(p.brand),identity=[p.category,modelKey(brand),modelKey(p.mpn||title)].join(':');
  const model={...classifyModel({category:p.category,brand,title,spec}),...p.model,name:title,brand};
  return {...p,title,brand,spec,model,identity,externalId:String(p.externalId),url:url.href};
 });
 const counts={added:0,updated:0,unchanged:0};const checked=new Date().toISOString();
 db.exec('BEGIN IMMEDIATE');
 try{
  for(const p of normalized){
   let row=db.prepare('SELECT m.* FROM hardware_models m JOIN model_sources s ON s.model_id=m.id WHERE s.source=? AND s.external_id=?').get(source,p.externalId)||db.prepare('SELECT * FROM hardware_models WHERE identity=?').get(p.identity);
   // CPU names identify the processor independently of tray/boxed packaging.
   if(!row&&p.category==='cpu')row=db.prepare("SELECT * FROM hardware_models WHERE category='cpu' AND brand=?").all(p.brand).find(r=>modelKey(r.title)===modelKey(p.title));
   if(row&&row.category!==p.category)throw Error('Источник изменил категорию существующей модели');
   const payload=JSON.stringify({title:p.title,brand:p.brand,spec:p.spec,model:p.model,mpn:p.mpn||null});
   const previous=db.prepare('SELECT payload FROM model_sources WHERE source=? AND external_id=?').get(source,p.externalId);
   if(!row){
    const id=Math.max(10000000,Number(db.prepare('SELECT MAX(id) AS id FROM hardware_models').get().id||0)+1);
    db.prepare('INSERT INTO hardware_models VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,p.identity,p.category,p.brand,p.title,JSON.stringify(p.spec),JSON.stringify(p.model),null,0,checked);
    row={id};counts.added++;
   }else if(previous?.payload===payload)counts.unchanged++;
   else{
    // Preserve the existing demo calculation profile; external specs remain separately auditable.
    if(!row.ready)db.prepare('UPDATE hardware_models SET title=?,spec=?,taxonomy=?,updated=? WHERE id=?').run(p.title,JSON.stringify(p.spec),JSON.stringify(p.model),checked,row.id);
    counts.updated++;
   }
   db.prepare('INSERT INTO model_sources VALUES(?,?,?,?,?,?) ON CONFLICT(source,external_id) DO UPDATE SET url=excluded.url,checked=excluded.checked,payload=excluded.payload').run(source,p.externalId,row.id,p.url,checked,payload);
  }
  if(dryRun)db.exec('ROLLBACK');
  else{db.prepare('INSERT INTO model_imports(source,added,updated,unchanged) VALUES(?,?,?,?)').run(source,counts.added,counts.updated,counts.unchanged);db.exec('COMMIT')}
  return counts;
 }catch(e){db.exec('ROLLBACK');throw e}
}
