import {categories,seedProducts} from './catalog.mjs';

export const demoCities=['Астана','Алматы','Шымкент','Караганда','Актобе','Кызылорда','Атырау','Актау','Павлодар','Костанай','Семей','Усть-Каменогорск','Тараз','Уральск','Петропавловск','Туркестан'];

export function generateDemoListings(count=3000){
  if(!Number.isInteger(count)||count<1||count>10000)throw new Error('Количество: целое число от 1 до 10 000.');
  let randomState=20261012;
  const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)/4294967296};
  const models=[...new Map(seedProducts.filter(p=>p.condition==='new').map(p=>[p.title,p])).values()];
  for(const p of seedProducts)if(!models.some(m=>m.title===p.title))models.push(p);
  const choose=items=>items[Math.floor(random()*items.length)];
  return Array.from({length:count},(_,i)=>{
    const category=categories[i%categories.length].id;
    const model=choose(models.filter(p=>p.category===category));
    const condition=random()<.52?'used':'new';
    const base=model.price/(model.condition==='used'?.74:1);
    const price=Math.max(1000,Math.round(base*(condition==='used'?.58+random()*.25:.88+random()*.26)/500)*500);
    const city=choose(demoCities);
    const phrase=choose(condition==='used'?['после апгрейда','домашнее использование','с комплектом','для новой сборки','продажа комплектующего']:['для новой сборки','в коробке','комплект поставки','для апгрейда','новое предложение']);
    const key=`catalog-demo-v1-${String(i+1).padStart(5,'0')}`;
    const date=new Date(Date.UTC(2026,9,12)-Math.floor(random()*60*86400000)).toISOString().slice(0,19).replace('T',' ');
    return {key,title:`${model.title} — ${phrase}`,category,price,condition,city,brand:model.brand,spec:{...structuredClone(model.spec),referenceId:model.id},art:model.art,score:model.score,demo:true,created:date,
      description:`Демонстрационное объявление №${i+1}. ${model.title}. ${condition==='used'?'Б/у':'Новый товар'}, ${city}. ${phrase[0].toUpperCase()+phrase.slice(1)}.\n\nХарактеристики взяты из демонстрационного справочника. Изображение иллюстративное. Цена, состояние и наличие придуманы для проверки каталога, это не предложение реального продавца.`};
  });
}

export function seedDemoListings(db,count=3000){
  const rows=generateDemoListings(count);
  let added=0,skipped=0;
  db.exec('BEGIN IMMEDIATE');
  try{
    db.exec('CREATE TABLE IF NOT EXISTS demo_listing_seeds(seed_key TEXT PRIMARY KEY,product_id INTEGER NOT NULL UNIQUE REFERENCES products(id))');
    const exists=db.prepare('SELECT product_id FROM demo_listing_seeds WHERE seed_key=?');
    const insert=db.prepare('INSERT INTO products(title,category,price,condition,city,brand,description,spec,art,score,demo,created) VALUES(?,?,?,?,?,?,?,?,?,?,1,?)');
    const track=db.prepare('INSERT INTO demo_listing_seeds(seed_key,product_id) VALUES(?,?)');
    for(const p of rows){
      if(exists.get(p.key)){skipped++;continue}
      if(!db.prepare('SELECT id FROM products WHERE id=? AND demo=1').get(p.spec.referenceId))throw new Error('Сначала запустите сервер, чтобы создать справочник моделей.');
      const result=insert.run(p.title,p.category,p.price,p.condition,p.city,p.brand,p.description,JSON.stringify(p.spec),p.art,p.score,p.created);
      track.run(p.key,Number(result.lastInsertRowid));added++;
    }
    db.exec('COMMIT');return {added,skipped};
  }catch(error){db.exec('ROLLBACK');throw error}
}
