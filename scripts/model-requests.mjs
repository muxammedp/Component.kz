import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
const db=new DatabaseSync(process.env.DB_PATH||fileURLToPath(new URL('../data/component.sqlite',import.meta.url)),{readOnly:true});
try{console.log(JSON.stringify(db.prepare('SELECT id,category,title,url,status,created FROM model_requests ORDER BY id DESC').all(),null,2))}finally{db.close()}
