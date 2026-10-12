export const modelSteps={
 cpu:[['maker','Производитель'],['family','Семейство'],['generation','Серия / поколение'],['name','Модель']],
 gpu:[['maker','Производитель чипа'],['family','Линейка'],['generation','Серия'],['chip','Графический процессор'],['brand','Бренд карты'],['name','Модель']],
 board:[['maker','Платформа'],['socket','Сокет'],['chipset','Чипсет'],['brand','Производитель'],['name','Модель']],
 ram:[['brand','Производитель'],['ram','Тип памяти'],['size','Объём'],['speed','Скорость'],['name','Модель']],
 ssd:[['brand','Производитель'],['storageType','Тип накопителя'],['size','Объём'],['name','Модель']],
 psu:[['brand','Производитель'],['power','Мощность'],['certificate','Сертификат'],['name','Модель']],
 case:[['brand','Производитель'],['form','Формат платы'],['family','Серия'],['name','Модель']],
 cooler:[['brand','Производитель'],['coolingType','Тип охлаждения'],['family','Серия'],['name','Модель']]
};
export function classifyModel(p){
 const s=p.spec,t=p.title;
 const m={name:t,brand:p.brand,socket:s.socket,ram:s.ram,form:s.form,certificate:s.certificate};
 if(p.category==='cpu'){
  m.maker=p.brand;
  m.family=t.match(/Ryzen Threadripper(?: PRO)?|Ryzen [3579](?: PRO)?|Core i[3579]|Core Ultra [579]|Athlon|Pentium(?: Gold)?|Celeron|Sempron|Phenom|FX|A[468]|A1[02]/)?.[0]||'Другие';
  const ryzen=t.match(/Ryzen \d (\d)\d{3}/),core=t.match(/Core i\d-(\d{1,2})\d{3}/);
  m.generation=ryzen?`Ryzen ${ryzen[1]}000`:core?`${core[1]}-е поколение`:s.generation||'Другие серии';
 }else if(p.category==='gpu'){
  m.chip=t.match(/(?:RTX|GTX|GT) \d{3,4}(?: Ti| SUPER)?|RX \d{3,4}(?: XT)?|Arc [AB]\d{3}/i)?.[0]||t;
  m.maker=/Radeon|\bRX\b/i.test(t)?'AMD':/Arc|Intel/i.test(t)?'Intel':/GeForce|RTX|GTX|Quadro|NVIDIA/i.test(t)?'NVIDIA':'Не указано';
  m.family=/Quadro/i.test(t)?'Quadro':/GeForce.*RTX|RTX \d{4}/i.test(t)?'GeForce RTX':/GTX/i.test(t)?'GeForce GTX':/Radeon.*Pro/i.test(t)?'Radeon Pro':/Radeon|\bRX\b/i.test(t)?'Radeon RX':/Arc/i.test(t)?'Arc':'Другие';
  const rtx=t.match(/RTX (\d)\d{3}/i),gtx=t.match(/GTX (\d{1,2})\d{2}/i),rx=t.match(/RX (\d)(\d{2,3})/i);
  m.generation=rtx?`RTX ${rtx[1]}0`:gtx?`GTX ${gtx[1]}`:rx?`RX ${rx[1]}${'0'.repeat(rx[2].length)}`:/Arc B/i.test(t)?'B-Series':/Arc A/i.test(t)?'A-Series':'Другие серии';
 }else if(p.category==='board'){
  m.maker=/^(AM|FM|s?TR|sWRX)/i.test(s.socket||'')?'AMD':/LGA/i.test(s.socket||'')?'Intel':'Не указано';m.chipset=s.chipset||t.match(/[ABHXZ]\d{3}/)?.[0]||'Другие';
 }else if(p.category==='ram'){
  m.size=s.size?`${s.size} ГБ`:'Не указано';m.speed=s.speed?`${s.speed} MT/s`:'Не указано';
 }else if(p.category==='ssd'){
  m.size=s.size?s.size>=1000?`${s.size/1000} ТБ`:`${s.size} ГБ`:'Не указано';m.storageType=s.type;
 }else if(p.category==='psu')m.power=s.power?`${s.power} Вт`:'Не указано';
 else if(p.category==='case'){const name=t.replace(p.brand+' ','');m.family=(name.match(/^[A-Za-z]+/)?.[0]||name.split(' ')[0]).toUpperCase()}
 else if(p.category==='cooler'){m.coolingType=s.coolingType||'Воздушное';m.family=t.replace(p.brand+' ','').match(/^[A-Za-z]+/)?.[0]||t}
 for(const [key] of modelSteps[p.category]||[])if(!m[key])m[key]='Не указано';
 return m;
}
export function modelMatches(p,selection={}){return Object.entries(selection).every(([k,v])=>!v||p.model?.[k]===v)}
export function narrowSelection(category,selection,key,value){
 const keys=(modelSteps[category]||[]).map(([k])=>k),index=keys.indexOf(key);
 if(index<0)return {...selection};
 return Object.fromEntries([...keys.slice(0,index).filter(k=>selection[k]).map(k=>[k,selection[k]]),...(value?[[key,value]]:[])]);
}
export function modelOptionsAt(products,category,selection,index){
 const steps=modelSteps[category]||[],key=steps[index]?.[0];if(!key)return [];
 const previous=Object.fromEntries(steps.slice(0,index).map(([k])=>[k,selection[k]||'']));
 const counts=new Map();
 for(const p of products.filter(p=>p.category===category&&modelMatches(p,previous))){const v=p.model?.[key];if(v)counts.set(v,(counts.get(v)||0)+1)}
 return [...counts].sort(([a],[b])=>a.localeCompare(b,'ru',{numeric:true})).map(([value,count])=>({value,count}));
}
