const aliases={райзен:'ryzen',интел:'intel',амд:'amd',нвидиа:'nvidia',нвидия:'nvidia',джифорс:'geforce',радеон:'radeon',асус:'asus',самсунг:'samsung',кингстон:'kingston',гб:'gb',тб:'tb',мгц:'mhz',гц:'hz',вт:'w',ватт:'w',ваттный:'w',мм:'mm'};
const categoryWords={gpu:'видеокарта видеокарты графика gpu',cpu:'процессор процессоры cpu',board:'материнская плата материнские платы motherboard',ram:'оперативная память озу ram',ssd:'накопитель накопители диск ssd hdd',psu:'блок питания блоки питания psu',case:'корпус корпуса case',cooler:'кулер кулеры охлаждение cooler',monitor:'монитор мониторы monitor',peripheral:'клавиатура мышь периферия',pc:'компьютер компьютеры готовый пк игровой сборка'};
export const specFields={gpu:[['memory','Видеопамять'],['type','Тип видеопамяти']],cpu:[['socket','Сокет']],board:[['socket','Сокет'],['ram','Тип памяти']],ram:[['ram','Тип памяти'],['size','Объём, GB']],ssd:[['size','Объём, GB'],['type','Тип накопителя']],psu:[['power','Мощность, Вт']],case:[['form','Форм-фактор']],cooler:[['sockets','Поддерживаемый сокет']],monitor:[['resolution','Разрешение'],['hz','Частота, Гц']]};
export function normalizeSearch(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/([\p{L}])(\d)/gu,'$1 $2').replace(/(\d)([\p{L}])/gu,'$1 $2').replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).map(t=>aliases[t]||t).join(' ')}
const keyboardFrom='йцукенгшщзхъфывапролджэячсмитьбю',keyboardTo="qwertyuiop[]asdfghjkl;'zxcvbnm,.",keyboardMap=Object.fromEntries([...keyboardFrom].map((c,i)=>[c,keyboardTo[i]]));
export const fixKeyboard=q=>q.toLowerCase().replace(/[а-я]/g,c=>keyboardMap[c]||c);
function referenceModel(p,products){return p.spec?.referenceId?products.find(model=>model.id===p.spec.referenceId&&model.demo&&model.category===p.category):null}
function index(p,products){
  const units={watts:'w',power:'w',tdp:'w',hz:'hz',speed:'mhz',size:'gb',length:'mm',height:'mm',gpuMax:'mm',coolerMax:'mm'};
  const specs=Object.entries(p.spec||{}).filter(([k])=>k!=='referenceId').map(([k,v])=>Array.isArray(v)?v.join(' '):`${v} ${units[k]||''}`).join(' ');
  const reference=referenceModel(p,products);
  const storage=p.category==='ssd'&&Number(p.spec?.size)>=1000&&Number(p.spec.size)%1000===0?`${Number(p.spec.size)/1000} tb`:'';
  return normalizeSearch(`${p.title} ${p.brand} ${reference?.title||''} ${categoryWords[p.category]||''} ${specs} ${storage} ${p.description||''} ${/geforce|\brtx\b/i.test(p.title+' '+(reference?.title||''))?'nvidia':''}`);
}
export function searchScore(p,query,products=[]){
  const q=normalizeSearch(query);if(!q)return 1;
  const tokens=q.split(' '),text=index(p,products),words=new Set(text.split(' '));
  if(!tokens.every(t=>words.has(t)||(!/\d/.test(t)&&t.length>=4&&[...words].some(w=>w.startsWith(t)))))return 0;
  for(const [,amount,unit] of q.matchAll(/(?:^| )(\d+) (gb|tb|mhz|hz|w|mm)(?= |$)/g))if(!(' '+text+' ').includes(` ${amount} ${unit} `))return 0;
  const title=normalizeSearch(p.title),titleWords=new Set(title.split(' '));
  const reference=normalizeSearch(referenceModel(p,products)?.title||'');
  return (title.includes(q)?100:0)+tokens.filter(t=>titleWords.has(t)).length*10+(reference.includes(q)?50:0)+1;
}
export function createSearchContext(products){
  const queries=new Map();
  return {effective:new Map(),score(p,q){if(!q)return 1;if(!queries.has(q))queries.set(q,new Map());const scores=queries.get(q);if(!scores.has(p))scores.set(p,searchScore(p,q,products));return scores.get(p)}};
}
export function effectiveQuery(products,query,context){
  const clean=normalizeSearch(query),key=String(query||'');
  if(context?.effective.has(key))return context.effective.get(key);
  const score=(p,q)=>context?context.score(p,q):searchScore(p,q,products);
  let result={query:clean,corrected:false};
  if(clean&&!products.some(p=>score(p,clean))){const alternate=normalizeSearch(fixKeyboard(key));if(alternate!==clean&&products.some(p=>score(p,alternate)))result={query:alternate,corrected:true}}
  context?.effective.set(key,result);return result;
}
export function filterProducts(products,f,city='',ignore='',context=createSearchContext(products)){
  const query=effectiveQuery(products,f.q,context).query;
  const score=p=>context.score(p,query);
  return products.filter(p=>(ignore==='category'||!f.category||f.category==='all'||p.category===f.category)&&(ignore==='condition'||!f.condition||f.condition==='all'||p.condition===f.condition)&&(ignore==='city'||!city||p.city===city)&&(ignore==='source'||!f.source||f.source==='all'||(f.source==='real'?!p.demo:p.demo))&&(ignore==='q'||score(p)>0)&&(ignore==='brand'||!f.brand?.length||f.brand.includes(p.brand))&&(ignore==='price'||((!f.min||p.price>=Number(f.min))&&(!f.max||p.price<=Number(f.max))))&&Object.entries(f.spec||{}).every(([key,values])=>ignore==='spec.'+key||!values.length||values.some(v=>[].concat(p.spec?.[key]??[]).map(String).includes(v)))).sort((a,b)=>{
    if(f.sort==='cheap')return a.price-b.price||a.id-b.id;
    if(f.sort==='expensive')return b.price-a.price||a.id-b.id;
    if(f.sort==='recent')return b.id-a.id;
    return (query?score(b)-score(a):0)||Number(a.demo)-Number(b.demo)||b.id-a.id;
  });
}
function distance(a,b){const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old}}return prev[b.length]}
export function suggestQueries(products,query){
  const tokens=normalizeSearch(query).split(' '),words=[...new Set(products.flatMap(p=>normalizeSearch(p.title+' '+p.brand).split(' ')))].filter(t=>t.length>=4&&!/\d/.test(t));
  const found=[];
  tokens.forEach((token,i)=>{if(token.length<4||/\d/.test(token)||words.includes(token))return;for(const word of words){const d=distance(token,word);if(d>(token.length>=5?2:1))continue;const next=tokens.map((t,j)=>j===i?word:t).join(' ');if(products.some(p=>searchScore(p,next,products)))found.push({query:next,d})}});
  return [...new Set(found.sort((a,b)=>a.d-b.d||a.query.localeCompare(b.query)).map(x=>x.query))].slice(0,3);
}
export function parsePrice(value){const s=String(value).replace(/[\s\u00a0\u202f]/g,'');if(!s)return '';if(!/^\d{1,9}$/.test(s))throw new Error('Укажи целую цену в тенге, например 150 000.');return String(Number(s))}
export function refineCategory(products,filter,category){
  const brands=new Set(products.filter(p=>category==='all'||p.category===category).map(p=>p.brand));
  return {...filter,category,brand:(filter.brand||[]).filter(b=>brands.has(b)),spec:{}};
}
