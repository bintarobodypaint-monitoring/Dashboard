(function(root){
 const fields=['ue','cpus','insurance','cash','other','unmapped','light','medium','heavy','unknownRepair','labor','parts','revenue'];
 const blank=()=>Object.fromEntries(fields.map(f=>[f,0]));
 function model(data,{mode,month,sa}){
  if(!['MTD','YTD'].includes(mode)||!Number.isInteger(month)||month<1||month>12)throw Error('Periode tidak valid');
  const count=mode==='MTD'?new Date(data.year,month,0).getDate():12,slots=Array.from({length:count},blank),total=blank();
  const selected=sa==='ALL'?data.sas:[sa];if(selected.some(s=>!data.sas.includes(s)))throw Error('SA tidak valid');
  const cutoff=data.asOf;
  for(const b of data.bins){if(!selected.includes(b.sa)||b.date>cutoff)continue;const m=Number(b.date.slice(5,7));if(mode==='MTD'&&m!==month)continue;const i=mode==='MTD'?Number(b.date.slice(8,10))-1:m-1;if(!slots[i])continue;for(const f of fields){slots[i][f]+=b[f];total[f]+=b[f];}}
  function weight(m,d){const date=String(data.year)+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');return date>cutoff?null:data.calendar[date]??null;}
  const days=slots.map((_,i)=>{if(mode==='MTD')return weight(month,i+1);const m=i+1,last=new Date(data.year,m,0).getDate(),end=String(data.year)+'-'+String(m).padStart(2,'0')+'-'+last;if(end<=cutoff)return data.workdays[i];let sum=0;for(let d=1;d<=last;d++){const date=end.slice(0,8)+String(d).padStart(2,'0');if(date>cutoff)break;const w=weight(m,d);if(w===null)return null;sum+=w;}return end.slice(0,7)>cutoff.slice(0,7)?null:sum;});
  const active=days.filter((_,i)=>mode==='MTD'?(String(data.year)+'-'+String(month).padStart(2,'0')+'-'+String(i+1).padStart(2,'0')<=cutoff):(String(data.year)+'-'+String(i+1).padStart(2,'0')<=cutoff.slice(0,7)));
  const wd=active.length&&active.every(Number.isFinite)?active.reduce((a,b)=>a+b,0):null;
  const divide=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null;
  const metric=(b,w)=>({...b,insurance:b.unmapped?null:b.insurance,cash:b.unmapped?null:b.cash,insurancePct:b.unmapped?null:divide(b.insurance,b.ue),cashPct:b.unmapped?null:divide(b.cash,b.ue),light:b.unknownRepair?null:b.light,medium:b.unknownRepair?null:b.medium,heavy:b.unknownRepair?null:b.heavy,closing:divide(b.cpus,b.ue),revUnit:divide(b.revenue,b.cpus),productivity:divide(b.ue,Number.isFinite(w)?w*selected.length:null),uePct:divide(b.ue,Number.isFinite(w)?w*selected.length*data.targets.ue:null),cpusPct:divide(b.cpus,Number.isFinite(w)?w*selected.length*data.targets.cpus:null)});
  return {slots:slots.map((b,i)=>metric(b,days[i])),total:metric(total,wd),count};
 }
 root.PerformanceModel={model};if(typeof module!=='undefined')module.exports=root.PerformanceModel;
})(typeof window==='undefined'?globalThis:window);
