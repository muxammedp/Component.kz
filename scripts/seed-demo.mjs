import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seedDemoListings} from '../demo-listings.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dbPath=process.env.DB_PATH||path.join(root,'data/component.sqlite');
if(!existsSync(dbPath))throw new Error('Сначала выполните npm.cmd start для создания базы данных.');
const count=Number(process.argv[2]||3000);
const db=new DatabaseSync(dbPath);
try{
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  const result=seedDemoListings(db,count);
  const total=db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='active'").get().count;
  console.log(`Добавлено демо-объявлений: ${result.added}. Уже существовали: ${result.skipped}. Всего активных: ${total}.`);
}finally{db.close()}
