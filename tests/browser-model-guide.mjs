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
 await call('Page.navigate',{url:baseURL+'/#builder'});await wait('!!document.querySelector("[data-model-step=maker]")');
 const choose=async(scope,key,value)=>{const sel=`[data-scope="${scope}"][data-model-step="${key}"]`;await evaluate(`document.querySelector(${JSON.stringify(sel)}).value=${JSON.stringify(value)};document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new Event('change',{bubbles:true}))`);await wait(`document.querySelector(${JSON.stringify(sel)})?.value===${JSON.stringify(value)}`)};
 assert(await evaluate('document.querySelector("[data-model-step=family]").disabled'),'descendants wait for parent choice');
 await choose('builder','maker','AMD');await choose('builder','family','Ryzen 5');await choose('builder','generation','Ryzen 7000');await choose('builder','name','AMD Ryzen 5 7600');
 assert(await evaluate('document.querySelectorAll(".part-product").length===1&&document.querySelector(".part-product").textContent.includes("7600")'),'AMD Ryzen 5 7000 path returns exact model');
 await click('[data-action="build-add"][data-id="2000008"]');await wait('document.querySelector(".selected-part")?.textContent.includes("7600")');
 await choose('builder','maker','Intel');assert(await evaluate('document.querySelector("[data-model-step=family]").value===""&&document.querySelector("[data-model-step=generation]").disabled&&document.querySelector("[data-model-step=name]").value===""'),'changing manufacturer clears all dependent choices');
 await choose('builder','family','Core i5');await choose('builder','generation','12-е поколение');await choose('builder','name','Intel Core i5-12400');
 await call('Page.reload');await wait('document.querySelector("[data-model-step=name]")?.value==="Intel Core i5-12400"');assert(true,'builder hierarchy persists across reload');
 await fill('#builder-search input','no-such-new-part');await submit('#builder-search');await wait('!!document.querySelector(".model-guide-empty")');assert(true,'no new offers gives an explicit recoverable empty state');
 await click('.model-guide-empty [data-action="model-guide-reset"]');await wait('document.querySelectorAll(".part-product").length>0');assert(await evaluate('document.querySelector("[data-model-step=maker]").value===""'),'empty state reset clears hierarchy and condition');
 for(const cat of ['gpu','board','ram','ssd','psu','case','cooler']){
  await click(`[data-action="builder-category"][data-value="${cat}"]`);
  const keys=await evaluate('[...document.querySelectorAll("[data-scope=builder][data-model-step]")].map(el=>el.dataset.modelStep)');assert(keys.length>=4,'hierarchy exists for '+cat);
  for(const key of keys){const value=await evaluate(`document.querySelector('[data-scope=builder][data-model-step=${key}]').options[1]?.value`);assert(!!value,'reachable '+cat+' '+key);await choose('builder',key,value)}
  assert(await evaluate('document.querySelectorAll(".part-product").length>0'),'complete path returns offers for '+cat);
 }
 await click('[data-action="builder-category"][data-value="gpu"]');assert(await evaluate('document.querySelector("[data-model-step=name]").value!==""'),'category switching preserves each category path');await shot('model-guide-gpu-desktop');
 for(const cat of ['monitor','peripheral']){await click(`[data-action="builder-category"][data-value="${cat}"]`);assert(await evaluate('!document.querySelector(".model-guide")'),'optional category has no hierarchy: '+cat)}
 await click('[data-action="builder-category"][data-value="cpu"]');await choose('builder','maker','AMD');await choose('builder','family','Ryzen 9');await choose('builder','generation','Ryzen 5000');await shot('model-guide-cpu-desktop');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('document.querySelector(".model-guide").scrollIntoView({block:"start"})');await shot('model-guide-mobile');
 assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'mobile hierarchy has no document overflow');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
 await click('[data-action="login"]');await wait('!!document.querySelector("#auth-form")');await click('[data-action="register"]');await fill('#auth-form [name="name"]','Model Tester');await fill('#auth-form [name="email"]','models@example.test');await fill('#auth-form [name="password"]','StrongModelPass123!');await submit('#auth-form');await wait('document.querySelector(".user-btn").textContent.includes("профиль")');
 await navigate('sell');await evaluate('document.querySelector("#listing-category").value="cpu";document.querySelector("#listing-category").dispatchEvent(new Event("change",{bubbles:true}))');
 await choose('listing','maker','AMD');await choose('listing','family','Ryzen 5');await choose('listing','generation','Ryzen 7000');
 assert(await evaluate('document.querySelector("#listing-model").options.length>2&&[...document.querySelector("#listing-model").options].slice(1).every(o=>o.textContent.startsWith("AMD Ryzen 5 7"))'),'listing model dropdown narrows to exact generation');
 await call('Page.reload');await wait('document.querySelector("[data-scope=listing][data-model-step=generation]")?.value==="Ryzen 7000"');assert(true,'unfinished listing hierarchy survives draft reload');
 await fill('#listing-model','2000008');await evaluate('document.querySelector("#listing-model").dispatchEvent(new Event("change",{bubbles:true}))');
 await fill('#sell-form [name=title]','Процессор из расширенного справочника');await fill('#sell-form [name=price]','99000');await fill('#sell-form [name=description]','Процессор протестирован, полная комплектация и результаты тестирования.');await submit('#sell-form');await wait('!!document.querySelector(".detail-title")');
 const p=await evaluate('fetch("/api/profile").then(r=>r.json()).then(p=>p.listings[0])');assert(p.spec.referenceId===2000008&&p.model.family==='Ryzen 5'&&p.spec.socket==='AM5','new reference model is validated and saved by server');
 await navigate('edit/'+p.id);await wait('document.querySelector("#listing-model")?.value==="2000008"');assert(await evaluate('document.querySelector("[data-model-step=generation]").value==="Ryzen 7000"'),'editor restores complete hierarchy from saved model');await shot('model-guide-listing-desktop');
 await choose('listing','maker','Intel');assert(await evaluate('document.querySelector("#listing-model").value===""&&document.querySelector("[data-model-step=generation]").disabled'),'changing listing manufacturer clears stale reference');
 await choose('listing','family','Core i3');await navigate('profile');await navigate('edit/'+p.id);await click('[data-action="draft-restore"]');await wait('document.querySelector("[data-model-step=family]")?.value==="Core i3"');assert(true,'explicit edit draft restore preserves unfinished hierarchy');
 await evaluate('document.querySelector("#listing-category").value="monitor";document.querySelector("#listing-category").dispatchEvent(new Event("change",{bubbles:true}))');assert(await evaluate('!document.querySelector(".model-guide")'),'optional listing category uses ordinary model dropdown');
 assert(errors.length===0,'no browser JavaScript exceptions');console.log(JSON.stringify({browserErrors:errors}));
} finally {await call('Browser.close').catch(()=>{});ws.close();proc.kill();appServer.kill()}

