import {inflateRawSync} from 'node:zlib';
export const urls={
 'amd-cpu':'https://www.amd.com/en/products/specifications/processors.html',
 'amd-gpu':'https://www.amd.com/en/products/specifications/graphics.html',
 intel:'https://cdrdv2.intel.com/v1/dl/getContent/841923?fileName=Intel-Core-Desktop-Boxed-Processors-Comparison-Chart.xlsx'
};
const decode=s=>s.replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const text=v=>(Array.isArray(v)?v.join(', '):String(v??'')).replace(/[™®©]/g,'').replace(/\s+/g,' ').trim();
const number=v=>{const n=Number(text(v).match(/^\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(n)&&n>0?n:null};
export function parseAMD(html,category){
 const chunks=[...html.matchAll(/data-json="([^"]+)"/g)].map(m=>JSON.parse(decode(m[1]))).filter(d=>Array.isArray(d.items));
 const rows=chunks.flatMap(d=>d.items).filter(p=>p.elements);
 if(!rows.length)throw Error('Формат AMD изменился: таблица не найдена');
 return rows.flatMap(p=>{
  const v=Object.fromEntries(Object.entries(p.elements).map(([k,v])=>[k,v.value]));
  const platform=text(category==='cpu'?v.formFactor:v.boardType);
  if(!/Desktop|Boxed Processor/i.test(platform))return [];
  if(category==='cpu'&&!/^(AM[1-5]\+?|FM[12]\+?|s?TR\w*|sWRX\w*)$/i.test(text(v.cpuSocket)))return [];
  const title=text(v.name||p.title),url=p.productPages?.en||urls[category==='cpu'?'amd-cpu':'amd-gpu'];
  const spec=category==='cpu'?{socket:text(v.cpuSocket),cores:number(v.numOfCpuCores),threads:number(v.numOfThreads),tdp:number(v.defaultTdp),memoryTypes:text(v.systemMemoryType),graphics:/discrete|not included|no graphics/i.test(text(v.graphicsModel))?'Нет':text(v.graphicsModel),baseClockMHz:number(v.baseClock),boostClockMHz:number(v.maxBoostClock),generation:text(v.series),partNumbers:[...v.productIdBoxed||[],...v.productIdTray||[]]}:{memory:number(v.maxMemorySize)?`${number(v.maxMemorySize)} GB`:null,type:text(v.memoryType),watts:number(v.typicalBoardPowerDesktop),length:number(v.length),powerConnectors:text(v.additionalPowerConnector),recommendedPsu:number(v.minimumPsuRecommendation),generation:text(v.series)};
  return [{category,title,brand:'AMD',externalId:title,url,spec,model:category==='gpu'?{maker:'AMD',family:text(v.family)||'Radeon',generation:text(v.series)||'Другие серии',chip:title.replace(/^AMD\s+/,''),brand:'AMD'}:undefined}];
 });
}
function unzip(buffer){
 let end=buffer.length-22;while(end>=Math.max(0,buffer.length-65557)&&buffer.readUInt32LE(end)!==0x06054b50)end--;
 if(end<0||buffer.readUInt32LE(end)!==0x06054b50)throw Error('Некорректный XLSX');
 const files=new Map();let pos=buffer.readUInt32LE(end+16),total=0;
 for(let i=0;i<buffer.readUInt16LE(end+10);i++){
  if(buffer.readUInt32LE(pos)!==0x02014b50)throw Error('Некорректный ZIP');
  const method=buffer.readUInt16LE(pos+10),size=buffer.readUInt32LE(pos+20),raw=buffer.readUInt32LE(pos+24),len=buffer.readUInt16LE(pos+28),extra=buffer.readUInt16LE(pos+30),comment=buffer.readUInt16LE(pos+32),offset=buffer.readUInt32LE(pos+42),name=buffer.subarray(pos+46,pos+46+len).toString();
  if((total+=raw)>50000000)throw Error('XLSX слишком большой');
  if(name.endsWith('.xml')){const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28),data=buffer.subarray(start,start+size);files.set(name,(method===8?inflateRawSync(data,{maxOutputLength:50000000}):method===0?data:Buffer.alloc(0)).toString('utf8'))}
  pos+=46+len+extra+comment;
 }
 return files;
}
export function parseIntel(buffer){
 const files=unzip(buffer),strings=[...(files.get('xl/sharedStrings.xml')||'').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>decode(t[1])).join(''));
 const rows=[...(files.get('xl/worksheets/sheet1.xml')||'').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(c=>{const col=c[1].match(/\br="([A-Z]+)\d+"/)?.[1],value=c[2].match(/<v>(.*?)<\/v>/)?.[1]||'';return [col,/\bt="s"/.test(c[1])?strings[Number(value)]:decode(value)]})));
 const h=rows.findIndex(r=>r.A==='Processor Number');
 if(h<0||rows[h].S!=='Supported Socket'||!rows[h].T.includes('Graphics'))throw Error('Формат Intel изменился: проверьте колонки');
 return rows.slice(h+1).filter(r=>r.A&&/LGA/.test(r.S||'')).map(r=>{
  const brand=text(r.B),tier=text(r.D),name=text(r.A),title=/Core Ultra/.test(brand)?`${brand} ${tier} ${name}`:/Core$/.test(brand)?`${brand} ${tier}-${name.replace(/^i[3579]-/,'')}`:`${brand} ${name}`;
  return {category:'cpu',title,brand:'Intel',externalId:title,url:'https://www.intel.com/content/www/us/en/support/articles/000005505/processors.html',spec:{socket:text(r.S),cores:number(r.F),threads:number(r.I),tdp:number(r.O),graphics:/^(No|N\/A)$/i.test(text(r.T))?'Нет':text(r.T),memoryTypes:text(r.Q),generation:text(r.C),boostClockGHz:number(r.J),launchYear:number(r.E)}};
 });
}
export function parseIcecat(response,category){
 const d=response.data,g=d?.GeneralInfo;
 if(response.msg!=='OK'||!g?.IcecatId||!g.BrandPartCode||!g.Brand)throw Error('Icecat: нет доступной карточки');
 const categoryNames={cpu:/^processors$/i,gpu:/^(graphics|video) cards$/i,board:/^motherboards$/i,ram:/^(memory modules|memory)$/i,ssd:/^(internal hard drives|internal solid state drives|solid state drives)$/i,psu:/^power supply units$/i,case:/^computer cases$/i,cooler:/^(computer cooling systems|computer cooling components|processor coolers)$/i};
 if(!categoryNames[category]?.test(g.Category?.Name?.Value||''))throw Error('Категория Icecat не совпадает или ещё не поддерживается адаптером');
 const features=Object.fromEntries((d.FeaturesGroups||[]).flatMap(group=>(group.Features||[]).map(f=>[f.Feature?.Name?.Value||f.Feature?.Name,f.PresentationValue||f.Value])).filter(([k,v])=>typeof k==='string'&&v));
 const spec={};const mappings={cpu:{'Processor socket':'socket','Processor cores':'cores','Processor threads':'threads'},board:{'Processor socket':'socket','Motherboard form factor':'form'},ram:{'Internal memory type':'ram','Memory clock speed':'memoryClock','Internal memory':'size'},gpu:{'Discrete graphics card memory':'memory','Graphics card memory type':'type'},ssd:{'SSD capacity':'size','HDD capacity':'size'},psu:{'Total power':'power'},case:{'Supported motherboard form factors':'form'},cooler:{'Type':'coolingType'}};
 if(!mappings[category])throw Error('Категория Icecat не поддерживается');
 for(const [key,target] of Object.entries(mappings[category]))if(features[key])spec[target]=['cores','threads','speed','size','power'].includes(target)?number(features[key]):text(features[key]);
 for(const [key,target] of Object.entries(mappings[category]))if(target==='size'&&features[key]&&spec.size)spec.size*= /\bTB\b/i.test(features[key])?1000:/\bMB\b/i.test(features[key])?.001:1;
 if(spec.socket)spec.socket=spec.socket.replace(/^Socket\s*/i,'').replace(/^FCLGA/i,'LGA');
 spec.manufacturerPartNumber=g.BrandPartCode;
 return [{category,title:text(g.Title||`${g.Brand} ${g.ProductName}`),brand:text(g.Brand),mpn:g.BrandPartCode,externalId:String(g.IcecatId),url:`https://icecat.biz/p/${g.IcecatId}.html`,spec}];
}
export async function download(url,headers={}){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
   if(!r.ok){await r.body?.cancel();throw Object.assign(Error(`Источник ответил HTTP ${r.status}`),{permanent:r.status<500&&r.status!==429})}
   let size=0;const chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>25000000)throw Object.assign(Error('Файл источника больше 25 МБ'),{permanent:true});chunks.push(chunk)}return Buffer.concat(chunks);
  }catch(e){if(e.permanent||attempt===2)throw e;await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)))}
 }
}
