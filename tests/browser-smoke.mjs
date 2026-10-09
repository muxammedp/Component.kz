import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const appServer=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DB_PATH:':memory:',OPENAI_API_KEY:'',OPENAI_MODEL:''},stdio:['ignore','pipe','pipe']});
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
 await call('Page.navigate',{url:baseURL});await wait('document.querySelectorAll(".product-card").length>=8');
 assert(await evaluate('document.querySelector("h1").textContent.includes("идеальный")'),'home page rendered');await shot('home-desktop');
 await fill('#search-form input','RTX 3070');await submit('#search-form');await wait('document.querySelector(".page-heading")?.textContent.includes("Каталог")');
 assert(await evaluate('document.querySelectorAll(".product-card").length===2'),'search finds matching GPU and ready PC');
 await navigate('catalog?category=gpu');await click('[data-action="reset-filters"]');await navigate('catalog?category=gpu');await wait('document.querySelectorAll(".product-card").length===8');await shot('catalog-desktop');
 await navigate('product/1');await wait('!!document.querySelector(".detail-photo")');await shot('detail-desktop');await click('[data-action="cart-add"][data-id="1"]');assert(await evaluate('JSON.parse(localStorage.getItem("component-cart")).includes(1)'),'cart persists locally');
 await click('[data-action="login"]');await click('[data-action="register"]');await fill('#auth-form [name="name"]','Browser Tester');await fill('#auth-form [name="email"]',`browser${Date.now()}@example.test`);await fill('#auth-form [name="password"]','BrowserPassword123!');await submit('#auth-form');await wait('document.querySelector(".user-btn").textContent.includes("профиль")');assert(true,'browser registration sets session');
 await navigate('ai');await submit('#ai-form');await wait('!!document.querySelector("[data-action=apply-recommendation]")');await shot('ai-desktop');await click('[data-action="apply-recommendation"]');await wait('document.querySelectorAll(".selected-part").length===8');assert(await evaluate('!document.querySelector("[data-action=assembly]").disabled'),'compatible complete build enables assembly order');await shot('builder-desktop');
 await click('[data-action="build-save"]');await fill('#save-build-form [name="name"]','Browser gaming build');await submit('#save-build-form');await wait('!document.querySelector("#modal").open');
 await click('[data-action="assembly"]');await fill('#checkout-form [name="phone"]','+77001234567');await evaluate('document.querySelector("#checkout-form input[type=checkbox]").checked=true');await submit('#checkout-form');await wait('document.querySelector(".modal-head")?.textContent.includes("сохранена")');await click('[data-action="close-modal"]');
 await navigate('profile');await wait('!!document.querySelector("#my-orders .order-row")');assert(await evaluate('document.querySelector("#my-builds").textContent.includes("Browser gaming build")'),'saved build and assembly order appear in profile');await shot('profile-desktop');
 await navigate('sell');await fill('#sell-form [name="title"]','Test GPU listing from browser');await fill('#sell-form [name="description"]','Used graphics card tested in the local browser acceptance flow.');await fill('#sell-form [name="price"]','160000');await fill('#sell-form [name="modelId"]','1');await submit('#sell-form');await wait('!!document.querySelector(".detail-title")');assert(await evaluate('document.querySelector(".detail-title").textContent==="Test GPU listing from browser"'),'seller can publish actual listing');
 await navigate('product/1');await click('.buy-panel [data-action="favorite"]');await navigate('favorites');await wait('document.querySelectorAll(".product-card").length===1');assert(true,'favorite saved on server');
 for(const width of [360,390,768,1440]){
 await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
 for(const hash of ['home','catalog','builder','ai','product/1','profile','sell','cart','favorites','help']){
  await navigate(hash);await wait('!!document.querySelector(".page")');const overflow=await evaluate('document.documentElement.scrollWidth>innerWidth+1');assert(!overflow,'no overflow at '+width+'px: '+hash);if(width===390&&['home','builder','catalog'].includes(hash))await shot(hash+'-mobile');
 }
 }
 assert(errors.length===0,'no browser JavaScript exceptions');console.log(JSON.stringify({browserErrors:errors}));
} finally {await call('Browser.close').catch(()=>{});ws.close();proc.kill();appServer.kill()}
