import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {initStoreOrders} from '../store-orders.mjs';
const email=process.argv[2]?.trim().toLowerCase();
if(!email)throw new Error('Usage: npm run store:operator -- existing-account@email.kz [--revoke]');
const db=new DatabaseSync(process.env.DB_PATH||fileURLToPath(new URL('../data/component.sqlite',import.meta.url)));
db.exec('PRAGMA foreign_keys=ON');initStoreOrders(db);
const user=db.prepare('SELECT id,email FROM users WHERE email=?').get(email);
if(!user)throw new Error('Account not found. Register on the site first. No role was granted.');
const revoke=process.argv.includes('--revoke');
db.exec('BEGIN IMMEDIATE');
try{
 const result=revoke?db.prepare('DELETE FROM store_operators WHERE user_id=?').run(user.id):db.prepare('INSERT OR IGNORE INTO store_operators(user_id) VALUES(?)').run(user.id);
 if(result.changes&&db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='admin_version'))db.prepare('UPDATE users SET admin_version=admin_version+1 WHERE id=?').run(user.id);
 db.exec('COMMIT');
}catch(e){db.exec('ROLLBACK');throw e}
console.log(`${revoke?'Revoked':'Granted'} store operator: ${user.email} (user ${user.id})`);db.close();
