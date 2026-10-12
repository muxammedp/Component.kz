import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {seedProducts} from '../catalog.mjs';
import {initModels,importModels} from '../model-store.mjs';
import {urls,download,parseAMD,parseIntel,parseIcecat} from '../imports/sources.mjs';
const args=process.argv.slice(2),source=args[0],flag=name=>args.includes(name),value=name=>args[args.indexOf(name)+1];
if(!['amd-cpu','amd-gpu','intel','icecat','manual'].includes(source)){
 console.log('Импорт: npm.cmd run models:import -- amd-cpu|amd-gpu|intel [--file путь] [--dry-run]\nIcecat: icecat --id ID --category gpu (ICECAT_USERNAME + ICECAT_API_TOKEN в .env)\nСвоя выгрузка: manual --file models.json\n--snapshot путь сохраняет нормализованный JSON для повторного локального импорта.');process.exit(source?1:0);
}
try{
 let records;
 if(source==='manual')records=JSON.parse(await readFile(value('--file'),'utf8'));
 else if(source==='icecat'){
  let data;if(flag('--file'))data=JSON.parse(await readFile(value('--file'),'utf8'));
  else{
   if(!process.env.ICECAT_USERNAME||!process.env.ICECAT_API_TOKEN)throw Error('Задайте ICECAT_USERNAME и ICECAT_API_TOKEN в локальном .env. Не передавайте токен через аргументы.');
   if(!/^\d+$/.test(value('--id')||''))throw Error('Укажите --id Icecat');
   const url=new URL('https://live.icecat.biz/api');url.search=new URLSearchParams({lang:'en',shopname:process.env.ICECAT_USERNAME,icecat_id:value('--id'),content:''});
   data=JSON.parse((await download(url,{'api-token':process.env.ICECAT_API_TOKEN})).toString());
  }
  records=parseIcecat(data,value('--category'));
 }else{const buffer=flag('--file')?await readFile(value('--file')):await download(urls[source]);records=source==='intel'?parseIntel(buffer):parseAMD(buffer.toString('utf8'),source==='amd-cpu'?'cpu':'gpu')}
 const root=fileURLToPath(new URL('../',import.meta.url));await mkdir(path.join(root,'data'),{recursive:true});
 const db=new DatabaseSync(process.env.DB_PATH||path.join(root,'data/component.sqlite'));
 try{initModels(db,seedProducts);const result=importModels(db,source,records,{dryRun:flag('--dry-run')});console.log(JSON.stringify({source,records:records.length,dryRun:flag('--dry-run'),...result}));}finally{db.close()}
 if(flag('--snapshot'))await writeFile(value('--snapshot'),JSON.stringify(records,null,2)+'\n');
}catch(e){console.error(`Импорт ${source} не выполнен:`,e.message);process.exitCode=1}
