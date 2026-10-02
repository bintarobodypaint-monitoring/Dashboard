(function(root){
'use strict';
function calculate(source, name, endMonth, original) {
 const rows=source.data[name];
 if(!rows || !Number.isInteger(endMonth)||endMonth<1||endMonth>12) throw Error('Pilihan KPI tidak valid');
 const sum=a=>a.reduce((s,v)=>s+(Number.isFinite(v)?v:0),0);
 const average=a=>{const v=a.filter(x=>Number.isFinite(x)&&x>0);return v.length?sum(v)/v.length:null;};
 const divide=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null;
 const list=rows.map((values,i)=>{
   const n=original?(i<3?8:12):endMonth, selected=values.slice(0,n);
   const avg=average(original ? values : selected), complete=selected.every(Number.isFinite);
   let achievement;
   if(i<3) achievement=divide(sum(selected),sum(source.days.slice(0,n))*source.targets[i]);
   else if(i===5) achievement=divide(source.targets[i],avg);
   else achievement=divide(avg,source.targets[i]);
   if((i===5 && selected.every(v=>v===null))||(i===6&&!complete)) achievement=null;
   const points=Number.isFinite(achievement)?achievement*source.weights[i]:null;
   return {values,total:sum(values.slice(0,original?12:endMonth)),average:avg,achievement,points,weight:source.weights[i],target:source.targets[i],months:n};
 });
 return {rows:list,score:list.every(r=>Number.isFinite(r.points))?sum(list.map(r=>r.points)):null};
}
root.KpiSa={calculate};
if(typeof module!=='undefined') module.exports=root.KpiSa;
})(typeof window==='undefined'?globalThis:window);
