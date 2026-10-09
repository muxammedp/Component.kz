import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

test('users, sessions and builds survive server restart',async()=>{
 const file=path.join(tmpdir(),'component-test-'+randomUUID()+'.sqlite');
 let child;
 const start=async()=>{child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DB_PATH:file,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});return await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{const url=String(d).match(/http:\/\/127.0.0.1:\d+/)?.[0];if(url)resolve(url)});child.on('error',reject);setTimeout(()=>reject(new Error('startup timeout')),10000).unref()})};
 const stop=async()=>{if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})};
 try{
  let base=await start();
  const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Persistence QA',email:'persistence@example.test',password:'StrongPassword123!'})});
  assert.equal(response.status,201);const cookie=response.headers.get('set-cookie').split(';')[0];
  const saved=await fetch(base+'/api/builds',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({name:'Persisted build',ids:[1,2]})});assert.equal(saved.status,201);
  await stop();base=await start();
  const p=await(await fetch(base+'/api/profile',{headers:{Cookie:cookie}})).json();
  assert.equal(p.user.name,'Persistence QA');assert.equal(p.builds[0].name,'Persisted build');
 }finally{await stop();for(const suffix of ['','-wal','-shm'])await unlink(file+suffix).catch(()=>{})}
});
