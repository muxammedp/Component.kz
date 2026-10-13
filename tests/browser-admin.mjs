import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
await fs.mkdir('.qa',{recursive:true});
const testDB=path.resolve('.qa','admin-browser-'+Date.now()+'.sqlite');
const appServer=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:testDB,OPENAI_API_KEY:'',OPENAI_MODEL:''},stdio:['ignore','pipe','pipe']});
const baseURL=await new Promise((resolve,reject)=>{appServer.stdout.on('data',d=>{const url=String(d).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url)resolve(url)});appServer.on('error',reject);setTimeout(()=>reject(new Error('Test server timeout')),10000).unref()});
process.on('uncaughtException',err=>{appServer.kill();console.error(err);process.exit(1)});
const profile=path.resolve('.qa/chrome');
await fs.mkdir(profile,{recursive:true});
const proc=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--remote-debugging-port=9333',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let target;
for(let i=0;i<100;i++){try{const targets=await(await fetch('http://127.0.0.1:9333/json')).json();target=targets.find(t=>t.type==='page');if(target)break}catch{}await new Promise(r=>setTimeout(r,100))}
if(!target)throw new Error('Chrome did not start');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let seq=0;const pending=new Map(),errors=[];
ws.onmessage=e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);if(v.error)p?.reject(new Error(v.error.message));else p?.resolve(v.result)}else if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method))},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});ws.send(JSON.stringify({id,method,params}))});
await call('Page.enable');await call('Runtime.enable');
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,70))}throw new Error('Timed out: '+expression)};
const assert=(ok,text)=>{if(!ok)throw new Error(text);console.log('PASS '+text)};
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fill=(selector,value)=>evaluate(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);
const submit=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
const navigate=async hash=>{await evaluate(`location.hash=${JSON.stringify(hash)}`);await new Promise(r=>setTimeout(r,180));await wait('!document.querySelector("#main .loading")')};
const shot=async name=>{await evaluate('document.querySelector("#toast").classList.remove("visible")');await new Promise(r=>setTimeout(r,220));const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.resolve('.qa',name+'.png'),Buffer.from(r.data,'base64'))};
try {
 await call('Network.clearBrowserCookies');await call('Storage.clearDataForOrigin',{origin:baseURL,storageTypes:'all'});
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:baseURL+'/#admin'});await wait('!!document.querySelector("[data-action=login]")');
 const post=async(url,data)=>evaluate(`fetch('/api'+${JSON.stringify(url)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(data)})}).then(async r=>({status:r.status,data:await r.json()}))`);
 const admin=await post('/auth/register',{name:'Admin Demo',email:'admin@example.test',password:'StrongPassword123!'});
 const buyer=await post('/auth/register',{name:'Покупатель Ник',email:'buyer@example.test',password:'StrongPassword123!'});
 const db=new DatabaseSync(testDB);db.prepare('INSERT INTO admins VALUES(?)').run(admin.data.user.id);db.prepare('INSERT INTO store_operators VALUES(?)').run(admin.data.user.id);db.close();
 const listing=await post('/listings',{title:'ПРОЦЕССОР Ryzen 5 5600X',category:'cpu',modelId:2,price:74000,condition:'new',city:'Астана',brand:'AMD',description:'Новый процессор с документами и оригинальной коробкой.'});assert(listing.status===201,'test seller listing created');
 const modelRequest=await post('/model-requests',{category:'cpu',title:'Ryzen 5 5600X',url:'https://example.test/cpu'});assert(modelRequest.status===201,'test model request created');
 const rec=await post('/recommend',{budget:450000,condition:'new',task:'work'});const assembly=await post('/orders',{kind:'assembly',ids:rec.data.parts.map(p=>p.id),name:'Покупатель Ник',phone:'+77001234567',city:'Астана'});assert(assembly.status===201,'test assembly request created');
 await call('Page.reload');await wait('document.querySelector("#main")?.textContent.includes("Доступ ограничен")');assert(true,'non-admin cannot view administration page');
 await post('/auth/login',{email:'admin@example.test',password:'StrongPassword123!'});await call('Page.reload');await wait('!!document.querySelector(".admin-stats")');
 assert(await evaluate('document.querySelectorAll(".admin-stat").length===6'),'dashboard shows real data across service sections');
 await evaluate('document.documentElement.dataset.theme="light"');await shot('admin-overview-desktop');
 await navigate('admin/users');await wait('!!document.querySelector("#admin-filter")');
 for(const query of [String(buyer.data.user.id),'buyer@example.test','покупатель ник']){await fill('#admin-filter [name=q]',query);await submit('#admin-filter');await wait('document.querySelectorAll(".admin-record").length===1');assert(await evaluate('document.querySelector(".admin-record").textContent.includes("buyer@example.test")'),'user search: '+query)}
 await click('[data-action=admin-edit]');await wait('!!document.querySelector("#admin-edit-form [name=isAdmin]")');await evaluate('document.querySelector("[name=isAdmin]").checked=true;document.querySelector("[name=isOperator]").checked=true');await fill('#admin-edit-form [name=reason]','Назначен для демонстрации');await submit('#admin-edit-form');await wait('!document.querySelector("#modal").open');
 await wait('document.querySelector(".admin-record")?.textContent.includes("Оператор выкупа")');
 assert(await evaluate('document.querySelector(".admin-record").textContent.includes("Администратор")&&document.querySelector(".admin-record").textContent.includes("Оператор выкупа")'),'admin and operator roles can be assigned from UI');await shot('admin-users-desktop');
 await click('[data-action=admin-edit]');await evaluate('document.querySelector("[name=isAdmin]").checked=false;document.querySelector("[name=isOperator]").checked=false');await fill('#admin-edit-form [name=reason]','Демонстрация завершена');await submit('#admin-edit-form');await wait('!document.querySelector("#modal").open');await wait('!document.querySelector(".admin-record").textContent.includes("Оператор выкупа")');assert(await evaluate('!document.querySelector(".admin-record").textContent.includes("Оператор выкупа")'),'roles can be removed from UI');
 await navigate('admin/listings?source=real');await wait('document.querySelectorAll(".admin-record").length===1');await click('[data-action=admin-edit]');await fill('#admin-edit-form [name=reason]','Описание на проверке');await submit('#admin-edit-form');await wait('document.querySelector(".admin-record").textContent.includes("Скрыто модератором")');
 const boot=await evaluate('fetch("/api/bootstrap").then(r=>r.json())');assert(!boot.products.some(p=>p.id===listing.data.id),'moderated listing removed from public catalog');
 await click('[data-action=admin-edit]');await fill('#admin-edit-form [name=reason]','Описание проверено');await submit('#admin-edit-form');await wait('document.querySelector(".admin-record").textContent.includes("В каталоге")');
 await navigate('admin/assemblies');await wait('document.querySelectorAll(".admin-record").length===1');
 for(const status of ['В работе','Готова к отправке','Отправлена']){await click('[data-action=admin-edit]');await evaluate(`var select=document.querySelector('#admin-edit-form [name=status]');select.value=${JSON.stringify(status)};select.dispatchEvent(new Event('change',{bubbles:true}))`);if(status==='Отправлена'){await fill('[name=carrier]','Test courier');await fill('[name=tracking]','TEST42')}await fill('#admin-edit-form [name=reason]','Демонстрация этапа: '+status);await submit('#admin-edit-form');await wait('!document.querySelector("#modal").open');await wait(`document.querySelector('.admin-record .pill')?.textContent===${JSON.stringify(status)}`)}
 assert(await evaluate('document.querySelector(".admin-record").textContent.includes("TEST42")'),'assembly workflow records carrier and tracking');
 await navigate('admin/models');await wait('document.querySelectorAll(".admin-record").length===1');await click('[data-action=admin-edit]');await evaluate('var select=document.querySelector("#admin-edit-form [name=status]");select.value="resolved";select.dispatchEvent(new Event("change",{bubbles:true}))');await fill('#admin-edit-form [name=modelId]','2');await fill('#admin-edit-form [name=reason]','Модель уже есть в справочнике');await submit('#admin-edit-form');await wait('!document.querySelector("#modal").open');await wait('document.querySelector(".admin-record")?.textContent.includes("Модель найдена")');assert(await evaluate('document.querySelector(".admin-record").textContent.includes("Модель найдена")'),'model request links an existing reference');
 await navigate('admin/audit');await wait('!!document.querySelector(".admin-events")');assert(await evaluate('document.querySelectorAll(".admin-events li").length===8'),'all UI changes have audit entries');
 await post('/auth/login',{email:'buyer@example.test',password:'StrongPassword123!'});await evaluate('location.hash="profile"');await call('Page.reload');await wait('!!document.querySelector("[data-action=order-detail]")');await click('[data-action=order-detail]');await wait('document.querySelector("#modal").open');assert(await evaluate('document.querySelector("#modal").textContent.includes("TEST42")'),'buyer can see assembly status and tracking');await click('[data-action=close-modal]');
 await post('/auth/login',{email:'admin@example.test',password:'StrongPassword123!'});await evaluate('location.hash="admin"');await call('Page.reload');await wait('!!document.querySelector(".admin-stats")');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('document.documentElement.dataset.theme="dark"');await shot('admin-overview-mobile');
 for(const tab of ['admin','admin/users','admin/listings','admin/models','admin/assemblies','admin/audit']){await navigate(tab);await wait('!!document.querySelector(".admin-layout")');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile fits: '+tab)}
 assert(errors.length===0,'no browser JavaScript exceptions');
} finally {await call('Browser.close').catch(()=>{});ws.close();proc.kill();appServer.kill()}
