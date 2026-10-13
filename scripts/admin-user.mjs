import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {initAdmin} from '../admin.mjs';
const email=process.argv[2]?.trim().toLowerCase();
if(!email)throw new Error('Usage: npm run admin:user -- existing-account@email.kz [--revoke]');
const db=new DatabaseSync(process.env.DB_PATH||fileURLToPath(new URL('../data/component.sqlite',import.meta.url)));
db.exec('PRAGMA foreign_keys=ON');initAdmin(db);
const user=db.prepare('SELECT id,email FROM users WHERE email=?').get(email);
if(!user)throw new Error('Account not found. Register first. No role was granted.');
const revoke=process.argv.includes('--revoke');
db.exec('BEGIN IMMEDIATE');
try{
 if(revoke&&db.prepare('SELECT 1 FROM admins WHERE user_id=?').get(user.id)&&db.prepare('SELECT count(*) n FROM admins').get().n<=1)throw new Error('Cannot revoke the last administrator. Grant another account first.');
 const result=revoke?db.prepare('DELETE FROM admins WHERE user_id=?').run(user.id):db.prepare('INSERT OR IGNORE INTO admins(user_id) VALUES(?)').run(user.id);
 if(result.changes)db.prepare('UPDATE users SET admin_version=admin_version+1 WHERE id=?').run(user.id);
 db.exec('COMMIT');
}catch(e){db.exec('ROLLBACK');throw e}
console.log(`${revoke?'Revoked':'Granted'} admin: ${user.email} (user ${user.id}). Store operator role is managed separately.`);db.close();
