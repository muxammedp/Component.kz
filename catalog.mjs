import {expandedModels} from './expanded-models.mjs';
import {classifyModel} from './public/model-taxonomy.js';
export const categories = [
  ['gpu','Видеокарты','Видеокарта',0],['cpu','Процессоры','Процессор',1],
  ['board','Материнские платы','Материнская плата',2],['ram','Оперативная память','Оперативная память',3],
  ['ssd','SSD / HDD','Накопитель',4],['psu','Блоки питания','Блок питания',5],
  ['case','Корпуса','Корпус',6],['cooler','Охлаждение','Охлаждение',7],
  ['monitor','Мониторы','Монитор',8],['peripheral','Периферия','Периферия',9],
  ['pc','Готовые ПК','Готовый ПК',10]
].map(([id,name,singular,art])=>({id,name,singular,art}));
const item=(id,category,title,price,condition,brand,spec,art,score=0)=>({id,category,title,price,condition,brand,spec,art,score,city:'Астана',description:`${title}. Демонстрационное предложение для знакомства с Component.kz. Цена и наличие являются примерами и не подтверждены продавцом.`,demo:true});
export const seedProducts = [
item(1,'gpu','MSI GeForce RTX 4060 Ti 8GB',189990,'new','MSI',{memory:'8 GB',type:'GDDR6',watts:160,length:199},'gpu0',66),
item(2,'cpu','AMD Ryzen 5 5600X',74990,'new','AMD',{socket:'AM4',cores:6,threads:12,watts:65},'cat1',65),
item(3,'board','ASUS PRIME B550M-A',59990,'new','ASUS',{socket:'AM4',ram:'DDR4',form:'mATX'},'cat2'),
item(4,'ram','Kingston Fury Beast 32GB',39990,'new','Kingston',{ram:'DDR4',size:32,speed:3200},'cat3'),
item(5,'ssd','Samsung 990 PRO 1TB',64990,'new','Samsung',{size:1000,type:'M.2 NVMe'},'cat4'),
item(6,'case','Lian Li Lancool 216',89990,'new','Lian Li',{form:'ATX',gpuMax:392,coolerMax:180},'cat6'),
item(7,'gpu','ASUS Radeon RX 7800 XT 16GB',256990,'new','ASUS',{memory:'16 GB',type:'GDDR6',watts:263,length:320},'gpu1',82),
item(8,'gpu','Gigabyte GeForce RTX 4070 12GB',314990,'new','Gigabyte',{memory:'12 GB',type:'GDDR6X',watts:200,length:261},'gpu2',80),
item(9,'gpu','Palit GeForce RTX 3060 12GB',124990,'used','Palit',{memory:'12 GB',type:'GDDR6',watts:170,length:245},'gpu3',49),
item(10,'gpu','Sapphire Radeon RX 7700 XT',193990,'new','Sapphire',{memory:'12 GB',type:'GDDR6',watts:245,length:280},'gpu4',73),
item(11,'gpu','Zotac GeForce RTX 4080 16GB',529990,'used','Zotac',{memory:'16 GB',type:'GDDR6X',watts:320,length:356},'gpu5',95),
item(12,'gpu','MSI GeForce RTX 3070 8GB',139990,'used','MSI',{memory:'8 GB',type:'GDDR6',watts:220,length:323},'gpu7',67),
item(13,'gpu','Gigabyte Radeon RX 7600 8GB',114990,'new','Gigabyte',{memory:'8 GB',type:'GDDR6',watts:165,length:282},'gpu8',52),
item(14,'cpu','Intel Core i5-13400F',89990,'new','Intel',{socket:'LGA1700',cores:10,threads:16,watts:148},'cat1',76),
item(15,'cpu','AMD Ryzen 7 5700X',89990,'new','AMD',{socket:'AM4',cores:8,threads:16,watts:65},'cat1',74),
item(16,'cpu','AMD Ryzen 5 5600X',49990,'used','AMD',{socket:'AM4',cores:6,threads:12,watts:65},'cat1',65),
item(17,'cpu','AMD Ryzen 7 7800X3D',189990,'new','AMD',{socket:'AM5',cores:8,threads:16,watts:120},'cat1',97),
item(18,'board','MSI PRO B760M-P DDR4',64990,'new','MSI',{socket:'LGA1700',ram:'DDR4',form:'mATX'},'cat2'),
item(19,'board','Gigabyte B650M DS3H',79990,'new','Gigabyte',{socket:'AM5',ram:'DDR5',form:'mATX'},'cat2'),
item(20,'board','ASUS PRIME B550M-A',39990,'used','ASUS',{socket:'AM4',ram:'DDR4',form:'mATX'},'cat2'),
item(21,'ram','Kingston Fury Beast 16GB',19990,'new','Kingston',{ram:'DDR4',size:16,speed:3200},'cat3'),
item(22,'ram','Kingston Fury Beast 32GB DDR5',54990,'new','Kingston',{ram:'DDR5',size:32,speed:6000},'cat3'),
item(23,'ram','Kingston Fury Beast 32GB',27990,'used','Kingston',{ram:'DDR4',size:32,speed:3200},'cat3'),
item(24,'ssd','Kingston NV2 1TB',29990,'new','Kingston',{size:1000,type:'M.2 NVMe'},'cat4'),
item(25,'ssd','Samsung 970 EVO 500GB',15990,'used','Samsung',{size:500,type:'M.2 NVMe'},'cat4'),
item(26,'psu','Corsair RM750e 750W',52990,'new','Corsair',{power:750,certificate:'80+ Gold'},'cat5'),
item(27,'psu','DeepCool PK650D 650W',29990,'new','DeepCool',{power:650,certificate:'80+ Bronze'},'cat5'),
item(28,'psu','Corsair RM750e 750W',34990,'used','Corsair',{power:750,certificate:'80+ Gold'},'cat5'),
item(29,'case','DeepCool CC560',24990,'new','DeepCool',{form:'ATX',gpuMax:370,coolerMax:163},'cat6'),
item(30,'case','DeepCool CC560',14990,'used','DeepCool',{form:'ATX',gpuMax:370,coolerMax:163},'cat6'),
item(31,'cooler','DeepCool AK400',19990,'new','DeepCool',{sockets:['AM4','AM5','LGA1700'],tdp:180,height:155},'cat7'),
item(32,'cooler','DeepCool AG400',9990,'used','DeepCool',{sockets:['AM4','AM5','LGA1700'],tdp:160,height:150},'cat7'),
item(33,'monitor','LG UltraGear 27″ 144Hz',119990,'new','LG',{resolution:'2560 × 1440',hz:144},'cat8'),
item(34,'peripheral','Logitech G213 + G102',34990,'new','Logitech',{type:'Клавиатура и мышь'},'cat9'),
item(35,'pc','Игровой ПК • RTX 4060 Ti / Ryzen 5',459990,'new','Custom',{cpu:'Ryzen 5 5600X',gpu:'RTX 4060 Ti',ram:'32 GB DDR4',ssd:'1 TB'},'cat10',66),
item(36,'pc','Игровой ПК • RTX 3070 / Ryzen 5',329990,'used','Custom',{cpu:'Ryzen 5 5600X',gpu:'RTX 3070',ram:'16 GB DDR4',ssd:'512 GB'},'cat10',63),
item(1000001,'cpu','AMD Ryzen 5 5600G',59990,'new','AMD',{socket:'AM4',cores:6,threads:12,watts:65,graphics:'Radeon Graphics (7 ядер)',graphicsScore:16},'cat1',60),
item(1000002,'cpu','AMD Ryzen 5 5600G',39990,'used','AMD',{socket:'AM4',cores:6,threads:12,watts:65,graphics:'Radeon Graphics (7 ядер)',graphicsScore:16},'cat1',60)
];
seedProducts.push(...expandedModels(item));
for(const p of seedProducts){
 if(p.category==='cpu'&&!p.spec.graphics) Object.assign(p.spec,p.id===17?{graphics:'Radeon Graphics (2 ядра)',graphicsScore:8}:{graphics:'Нет',graphicsScore:0});
 if([3,20].includes(p.id)) p.spec.displayOutputs='HDMI, DVI-D, VGA';
 if(p.id===19) p.spec.displayOutputs='HDMI, DisplayPort';
 if(p.id===18) p.spec.displayOutputs='HDMI, DisplayPort, VGA';
 p.model=classifyModel(p);
}
const referenceModels=new Map(seedProducts.map(p=>[p.id,p]));
export function withGraphicsMetadata(p){
 const model=referenceModels.get(p.spec.referenceId||(p.demo?p.id:0));
 if(!model||model.category!==p.category||(!p.spec.referenceId&&p.title!==model.title)) return p;
 const fields=p.category==='cpu'?['graphics','graphicsScore']:p.category==='board'?['displayOutputs']:[];
 return {...p,model:model.model,spec:{...p.spec,...Object.fromEntries(fields.filter(k=>model.spec[k]!==undefined).map(k=>[k,model.spec[k]]))}};
}
export const hasIntegratedGraphics=cpu=>Boolean(cpu?.spec.graphics&&cpu.spec.graphics!=='Нет');
export const requiredParts=['cpu','board','ram','gpu','ssd','psu','case','cooler'];
export function evaluate(parts,askingPrice) {
 const map=Object.fromEntries(parts.map(p=>[p.category,p]));
 const errors=[],warnings=[];
 const unverified=parts.filter(p=>p.evaluationReady===false);
 if(unverified.length)errors.push('Для выбранных моделей пока недостаточно проверенных данных совместимости: '+unverified.map(p=>p.model?.name||p.title).join(', ')+'.');
 const {cpu,board,ram,gpu,psu,cooler}=map;
 const integrated=!gpu&&hasIntegratedGraphics(cpu);
 if(integrated&&board&&!board.spec.displayOutputs) errors.push('Для встроенной графики нужна плата с подтверждёнными видеовыходами. Выберите другую плату или добавьте видеокарту.');
 if(cpu&&board&&cpu.spec.socket!==board.spec.socket) errors.push(`Процессор ${cpu.spec.socket} несовместим с платой ${board.spec.socket}.`);
 if(cpu?.spec.supportedBoards&&board&&!cpu.spec.supportedBoards.includes(board.model?.name||board.title)) errors.push('Для этого процессора совместимость платы не подтверждена. Выберите плату из списка поддерживаемых моделей CPU; одного совпадения сокета недостаточно.');
 if(ram&&board&&ram.spec.ram!==board.spec.ram) errors.push(`Плата поддерживает ${board.spec.ram}, выбрана память ${ram.spec.ram}.`);
 if(cpu&&cooler&&!cooler.spec.sockets?.includes(cpu.spec.socket)) errors.push('Кулер не поддерживает сокет процессора.');
 const watts=(cpu?.spec.watts||0)+(gpu?.spec.watts||0)+80;
 const recommendedPower=Math.ceil(watts*1.3/50)*50;
 if(psu&&psu.spec.power<recommendedPower) errors.push(`Нужен блок питания от ${recommendedPower} Вт с запасом мощности.`);
 if(cpu&&cooler&&cooler.spec.tdp<cpu.spec.watts) errors.push('Мощности охлаждения недостаточно для процессора.');
 if(map.case&&gpu&&gpu.spec.length>map.case.spec.gpuMax) errors.push('Видеокарта не помещается в корпус.');
 if(map.case&&cooler&&cooler.spec.height>map.case.spec.coolerMax) errors.push('Кулер слишком высокий для корпуса.');
 if(map.case&&board&&map.case.spec.form==='mATX'&&board.spec.form==='ATX') errors.push('ATX-плата не помещается в mATX-корпус.');
 const missing=requiredParts.filter(k=>!map[k]&&!(k==='gpu'&&integrated));
 if(integrated) warnings.push('Подключите монитор к видеовыходу материнской платы. Встроенная графика использует оперативную память; для игр её возможности ограничены.');
 if(cpu&&!gpu&&!integrated) warnings.push('У процессора нет подтверждённой встроенной графики — нужна отдельная видеокарта.');
 if(parts.some(p=>p.condition==='used')) warnings.push('Для б/у деталей запросите стресс-тест, температуры и историю ремонта.');
 if(cpu&&gpu&&gpu.score-cpu.score>25) warnings.push('В некоторых играх процессор может ограничивать видеокарту.');
 if(parts.some(p=>!p.demo&&p.spec.referenceId)) warnings.push('Модель реального товара указана продавцом; соответствие справочнику не проверено сервисом.');
 warnings.push('Проверьте версию BIOS, разъёмы питания и комплектацию у продавца.');
 const total=parts.reduce((s,p)=>s+p.price,0);
 const graphicsScore=gpu?.score??(integrated?cpu.spec.graphicsScore:null);
 const performance=!unverified.length&&cpu&&graphicsScore!=null?gpu?Math.round(Math.min(graphicsScore,cpu.score*1.2)*.75+cpu.score*.25):Math.round(Math.min(graphicsScore,cpu.score)):null;
 const estimated=true;
 const price=Number(askingPrice)||total;
 const value=total&&performance?Math.max(1,Math.min(10,Math.round((performance/price*42000)*10)/10)):null;
 return {total,askingPrice:price,performance,value,watts:unverified.length?null:watts,recommendedPower:unverified.length?null:recommendedPower,dataIncomplete:!!unverified.length,errors,warnings,missing,graphics:gpu?{type:'discrete',name:gpu.title}:integrated?{type:'integrated',name:cpu.spec.graphics}:null,compatible:errors.length===0,complete:missing.length===0,estimated,method:'Ориентировочный индекс 0–100 на основе демонстрационных коэффициентов CPU/GPU. Не бенчмарк и не оценка рыночной стоимости.',tasks:performance?{games:performance,work:Math.min(100,Math.round(cpu.score*.85+Math.min(ram?.spec.size||0,32)*.45)),render:Math.round(cpu.score*.55+graphicsScore*.45)}:null};
}
export function recommend(products,budget,condition,task='games',preferences={}) {
 const {cpuMaker='any',gpuMaker='any',peripherals=false}=preferences;
 const eligible=products.filter(p=>p.evaluationReady!==false&&(p.demo||p.spec.referenceId)&&(condition==='mixed'||p.condition===condition));
 const extras=peripherals?['monitor','peripheral'].map(kind=>eligible.filter(p=>p.category===kind&&(kind!=='peripheral'||/клавиатура.*мышь/i.test(p.spec.type||''))).sort((a,b)=>a.price-b.price)[0]):[];
 if(extras.some(p=>!p))return preferences.pool?[]:null;
 const maker=p=>p.model?.maker||classifyModel(p).maker;
 const candidates=eligible.filter(p=>requiredParts.includes(p.category)&&(p.category!=='cpu'||cpuMaker==='any'||maker(p)===cpuMaker)&&(p.category!=='gpu'||gpuMaker==='any'||maker(p)===gpuMaker));
 const equivalent=new Map();
 for(const p of candidates){
  const specs=Object.fromEntries(Object.entries(p.spec).filter(([key])=>key!=='referenceId').sort(([a],[b])=>a.localeCompare(b)));
  const key=JSON.stringify([p.category,p.score,specs]);
  if(!equivalent.has(key)||p.price<equivalent.get(key).price)equivalent.set(key,p);
 }
 const available=[...equivalent.values()];
 let best=null;
 const pool=new Map();
 for(const cpu of available.filter(p=>p.category==='cpu')) for(const gpu of [...(hasIntegratedGraphics(cpu)&&['any','integrated'].includes(gpuMaker)?[null]:[]),...available.filter(p=>p.category==='gpu')]) for(const board of available.filter(p=>p.category==='board'&&p.spec.socket===cpu.spec.socket)) {
  const selected=[cpu,...(gpu?[gpu]:[]),board,...extras];
  if(evaluate(selected).errors.length) continue;
  for(const kind of ['ram','ssd','psu','case','cooler']) {
   const options=available.filter(p=>p.category===kind).filter(p=>task!=='work'||(kind!=='ram'||p.spec.size>=16)&&(kind!=='ssd'||p.spec.size>=240)).filter(p=>evaluate([...selected,p]).errors.length===0).sort((a,b)=>a.price-b.price);
   if(options[0]) selected.push(options[0]);
  }
  const result=evaluate(selected);
  if(!result.complete||!result.compatible||result.total>budget) continue;
  const utility=task==='work'?Math.min(result.tasks.work,55):result.tasks[task==='render'?'render':'games'];
  if(preferences.pool){
   const key=JSON.stringify(selected.filter(p=>['cpu','gpu','ram','ssd'].includes(p.category)).map(p=>[p.category,p.score,p.spec]));
   if(!pool.has(key)||result.total<pool.get(key).evaluation.total)pool.set(key,{parts:selected,evaluation:result,utility});
  }
  if(!best||utility>best.utility||(utility===best.utility&&result.total<best.evaluation.total)) best={parts:selected,evaluation:result,utility};
 }
 if(best&&task==='work') best.reason=best.evaluation.graphics.type==='integrated'?'Для документов, браузера и учёбы достаточно встроенной графики. Выбрана недорогая конфигурация с 16 ГБ памяти или больше; весь бюджет тратить необязательно.':'В подходящей конфигурации нет встроенной графики, поэтому добавлена отдельная видеокарта. Для офисных задач выбираем достаточную мощность по меньшей цене.';
 return preferences.pool?[...pool.values()]:best;
}

export function recommendVariants(products,budget,task='games',preferences={}) {
 let pool=recommend(products,budget,'new',task,{...preferences,pool:true});
 if(!pool.length)return null;
 // An office alternative should not spend the spare budget on a gaming GPU.
 if(task==='work'&&(preferences.gpuMaker||'any')==='any'&&pool.some(r=>r.evaluation.graphics.type==='integrated'&&r.utility>=55))pool=pool.filter(r=>r.evaluation.graphics.type==='integrated');
 pool.sort((a,b)=>b.utility-a.utility||a.evaluation.total-b.evaluation.total);
 const first=pool[0],variants=[];
 const add=(result,label)=>{if(result&&!variants.includes(result)){result.label=label;result.id=result.parts.map(p=>p.id).sort((a,b)=>a-b).join('-');variants.push(result)}};
 add(first,task==='work'?'Для повседневной работы':'Максимум мощности');
 const suitable=pool.filter(r=>r.utility>=Math.min(first.utility,task==='work'?55:first.utility*.65));
 add([...suitable].sort((a,b)=>a.evaluation.total-b.evaluation.total||b.utility-a.utility)[0],'Экономнее');
 add([...suitable].filter(r=>!variants.includes(r)).sort((a,b)=>(b.utility/b.evaluation.total)-(a.utility/a.evaluation.total)||a.evaluation.total-b.evaluation.total)[0],'Баланс цены и мощности');
 for(const r of pool){if(variants.length>=3)break;add(r,'Альтернативная конфигурация')}
 for(const r of variants)if(task==='work')r.reason=r.evaluation.graphics.type==='integrated'?'Встроенной графики достаточно для повседневных офисных задач. Бюджет — верхний предел: тратить его целиком не обязательно.':'Отдельная видеокарта добавлена с учётом выбранного производителя или отсутствия подходящей встроенной графики.';
 return {...variants[0],variants,budget,preferences:{cpuMaker:preferences.cpuMaker||'any',gpuMaker:preferences.gpuMaker||'any',peripherals:!!preferences.peripherals},notice:variants.length<3?`По этим условиям найдено ${variants.length} различных конфигураций. Можно увеличить бюджет или убрать ограничения по производителям.`:null};
}
