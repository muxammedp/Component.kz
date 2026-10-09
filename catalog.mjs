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
item(36,'pc','Игровой ПК • RTX 3070 / Ryzen 5',329990,'used','Custom',{cpu:'Ryzen 5 5600X',gpu:'RTX 3070',ram:'16 GB DDR4',ssd:'512 GB'},'cat10',63)
];
export const requiredParts=['cpu','board','ram','gpu','ssd','psu','case','cooler'];
export function evaluate(parts,askingPrice) {
 const map=Object.fromEntries(parts.map(p=>[p.category,p]));
 const errors=[],warnings=[];
 const {cpu,board,ram,gpu,psu,cooler}=map;
 if(cpu&&board&&cpu.spec.socket!==board.spec.socket) errors.push(`Процессор ${cpu.spec.socket} несовместим с платой ${board.spec.socket}.`);
 if(ram&&board&&ram.spec.ram!==board.spec.ram) errors.push(`Плата поддерживает ${board.spec.ram}, выбрана память ${ram.spec.ram}.`);
 if(cpu&&cooler&&!cooler.spec.sockets?.includes(cpu.spec.socket)) errors.push('Кулер не поддерживает сокет процессора.');
 const watts=(cpu?.spec.watts||0)+(gpu?.spec.watts||0)+80;
 const recommendedPower=Math.ceil(watts*1.3/50)*50;
 if(psu&&psu.spec.power<recommendedPower) errors.push(`Нужен блок питания от ${recommendedPower} Вт с запасом мощности.`);
 if(cpu&&cooler&&cooler.spec.tdp<cpu.spec.watts) errors.push('Мощности охлаждения недостаточно для процессора.');
 if(map.case&&gpu&&gpu.spec.length>map.case.spec.gpuMax) errors.push('Видеокарта не помещается в корпус.');
 if(map.case&&cooler&&cooler.spec.height>map.case.spec.coolerMax) errors.push('Кулер слишком высокий для корпуса.');
 if(map.case&&board&&map.case.spec.form==='mATX'&&board.spec.form==='ATX') errors.push('ATX-плата не помещается в mATX-корпус.');
 const missing=requiredParts.filter(k=>!map[k]);
 if(parts.some(p=>p.condition==='used')) warnings.push('Для б/у деталей запросите стресс-тест, температуры и историю ремонта.');
 if(cpu&&gpu&&gpu.score-cpu.score>25) warnings.push('В некоторых играх процессор может ограничивать видеокарту.');
 if(parts.some(p=>p.spec.referenceId)) warnings.push('Модель реального товара указана продавцом; соответствие справочнику не проверено сервисом.');
 warnings.push('Проверьте версию BIOS, разъёмы питания и комплектацию у продавца.');
 const total=parts.reduce((s,p)=>s+p.price,0);
 const performance=cpu&&gpu?Math.round(Math.min(gpu.score,cpu.score*1.2)*.75+cpu.score*.25):null;
 const estimated=true;
 const price=Number(askingPrice)||total;
 const value=total&&performance?Math.max(1,Math.min(10,Math.round((performance/price*42000)*10)/10)):null;
 return {total,askingPrice:price,performance,value,watts,recommendedPower,errors,warnings,missing,compatible:errors.length===0,complete:missing.length===0,estimated,method:'Ориентировочный индекс 0–100 на основе демонстрационных коэффициентов CPU/GPU. Не бенчмарк и не оценка рыночной стоимости.',tasks:performance?{games:performance,work:Math.min(100,Math.round(cpu.score*.85+Math.min(ram?.spec.size||0,32)*.45)),render:Math.round(cpu.score*.55+gpu.score*.45)}:null};
}
export function recommend(products,budget,condition,task='games') {
 const available=products.filter(p=>(p.demo||p.spec.referenceId)&&(condition==='mixed'||p.condition===condition)&&requiredParts.includes(p.category));
 let best=null;
 for(const cpu of available.filter(p=>p.category==='cpu')) for(const gpu of available.filter(p=>p.category==='gpu')) {
  const selected=[cpu,gpu];
  for(const kind of ['board','ram','ssd','psu','case','cooler']) {
   const options=available.filter(p=>p.category===kind).filter(p=>evaluate([...selected,p]).errors.length===0).sort((a,b)=>a.price-b.price);
   if(options[0]) selected.push(options[0]);
  }
  const result=evaluate(selected);
  if(!result.complete||!result.compatible||result.total>budget) continue;
  const utility=result.tasks[task==='work'?'work':task==='render'?'render':'games'];
  if(!best||utility>best.utility||(utility===best.utility&&result.total<best.evaluation.total)) best={parts:selected,evaluation:result,utility};
 }
 return best;
}
