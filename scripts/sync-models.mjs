import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let failed=false;
for(const source of ['amd-cpu','amd-gpu','intel']){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('./import-models.mjs',import.meta.url)),source,...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
 if(result.status!==0)failed=true;
}
if(failed)process.exitCode=1;
