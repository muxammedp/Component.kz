import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
await fs.mkdir('.qa',{recursive:true});
const testDB=path.resolve('.qa','assembly-browser-'+Date.now()+'.sqlite');
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
 await call('Page.navigate',{url:baseURL+'/#ai'});await wait('!!document.querySelector("#ai-form")');
 const post=async(url,data)=>evaluate(`fetch('/api'+${JSON.stringify(url)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(data)})}).then(async r=>({status:r.status,data:await r.json()}))`);
 const operator=await post('/auth/register',{name:'Оператор сборки',email:'operator@example.test',password:'StrongPassword123!'});
 await post('/auth/register',{name:'Покупатель сборки',email:'buyer@example.test',password:'StrongPassword123!'});
 const db=new DatabaseSync(testDB);db.prepare('INSERT INTO store_operators VALUES(?)').run(operator.data.user.id);db.close();
 await call('Page.reload');await wait('!!document.querySelector("#ai-form")');
 await click('[data-action=ai-task][data-value=work]');await submit('#ai-form');await wait('!!document.querySelector("[data-action=apply-recommendation]")');await click('[data-action=apply-recommendation]');await wait('!!document.querySelector("[data-action=assembly]")');
 await click('[data-action=assembly]');await wait('!!document.querySelector("#checkout-form")');
 assert(await evaluate('document.querySelector("#checkout-form").textContent.includes("Отправить сборку оператору")'),'builder checkout explains operator fulfillment');
 await fill('#checkout-form [name=phone]','+77001234567');await fill('#checkout-form [name=address]','улица Тестовая, дом 10, квартира 5');await fill('#checkout-form [name=note]','Позвонить перед отправкой');
 await evaluate('document.querySelector("#checkout-form input[type=checkbox]").checked=true');await submit('#checkout-form');await wait('document.querySelector("#modal")?.textContent.includes("переданы оператору")');
 await click('[data-action=close-modal]');await navigate('profile');await wait('!!document.querySelector("[data-action=order-detail]")');
 assert(await evaluate('document.querySelectorAll("[data-action=order-detail]").length===1'),'one assembly request appears in buyer profile');
 await click('[data-action=order-detail]');await wait('document.querySelector("#modal").open');assert(await evaluate('document.querySelector("#modal").textContent.includes("дом 10")&&document.querySelector(".assembly-progress")'),'buyer sees delivery address and progress');await click('[data-action=close-modal]');
 await post('/auth/login',{email:'operator@example.test',password:'StrongPassword123!'});await evaluate('location.hash="operator/assemblies"');await call('Page.reload');await wait('!!document.querySelector(".admin-record")');
 assert(await evaluate('document.querySelector(".admin-eyebrow").textContent==="ПАНЕЛЬ ОПЕРАТОРА"&&[...document.querySelectorAll(".admin-nav a")].every(a=>a.hash!=="#admin/users")'),'operator can work with builds without administrator role');
 await click('.admin-record details summary');
 assert(await evaluate('document.querySelector(".admin-record").textContent.includes("дом 10")&&document.querySelector(".admin-record").textContent.includes("Позвонить перед отправкой")'),'operator receives composition, address and buyer notes');
 await fill('#admin-filter [name=q]','buyer@example.test');await submit('#admin-filter');await wait('document.querySelectorAll(".admin-record").length===1');assert(await evaluate('document.querySelector(".admin-record").textContent.includes("Покупатель сборки")'),'operator search finds buyer email');
 await evaluate('document.documentElement.dataset.theme="light"');await click('.admin-record details summary');await shot('assembly-operator-desktop');
 for(const status of ['В работе','Готова к отправке','Отправлена']){
  await click('[data-action=admin-edit]');await evaluate(`var select=document.querySelector('#admin-edit-form [name=status]');select.value=${JSON.stringify(status)};select.dispatchEvent(new Event('change',{bubbles:true}))`);
  if(status==='Отправлена'){assert(await evaluate('document.querySelector("#admin-edit-form [name=address]").value.includes("дом 10")'),'shipping form preserves buyer address');await fill('[name=carrier]','Тестовая доставка');await fill('[name=tracking]','DEMO-PC-123')}
  await fill('#admin-edit-form [name=reason]',status==='В работе'?'Свяжемся для согласования стоимости и сроков':status==='Готова к отправке'?'Компьютер собран, стресс-тест пройден':'Передано в тестовую доставку');await submit('#admin-edit-form');await wait('!document.querySelector("#modal").open');await wait(`document.querySelector('.admin-record .pill')?.textContent===${JSON.stringify(status)}`);
 }
 assert(await evaluate('document.querySelector(".admin-record").textContent.includes("DEMO-PC-123")'),'operator moves build through assembly and shipping');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('document.documentElement.dataset.theme="dark"');await shot('assembly-operator-mobile');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'operator panel fits mobile');
 await post('/auth/login',{email:'buyer@example.test',password:'StrongPassword123!'});await evaluate('location.hash="profile"');await call('Page.reload');await wait('!!document.querySelector("[data-action=order-detail]")');await click('[data-action=order-detail]');await wait('document.querySelector("#modal").open');
 assert(await evaluate('document.querySelector("#modal").textContent.includes("DEMO-PC-123")&&document.querySelector(".assembly-history").textContent.includes("стресс-тест пройден")'),'buyer sees shipment and full operator history');await shot('assembly-buyer-mobile');
 await click('#modal [data-value=received]');await wait('!!document.querySelector("#order-status-form")');await submit('#order-status-form');await wait('!document.querySelector("#modal").open');await wait('document.querySelector("#my-orders")?.textContent.includes("Завершена")');assert(true,'buyer confirms delivery from profile');
 await post('/auth/login',{email:'operator@example.test',password:'StrongPassword123!'});await evaluate('location.hash="operator/assemblies"');await call('Page.reload');await wait('document.querySelector(".admin-record .pill")?.textContent==="Завершена"');assert(await evaluate('!document.querySelector("[data-action=admin-edit]")'),'operator sees completed request with no further transitions');
 assert(errors.length===0,'no browser JavaScript exceptions');
} finally {await call('Browser.close').catch(()=>{});ws.close();proc.kill();appServer.kill()}
