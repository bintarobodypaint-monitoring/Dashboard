'use strict';
const by=id=>document.getElementById(id),months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const rows=[['ue','UE','count'],['cpus','CPUS','count'],['closing','Closing Rate','pct'],['insurance','UE Asuransi','count'],['insurancePct','% UE Asuransi','pct'],['cash','UE Personal/Cash','count'],['cashPct','% UE Personal/Cash','pct'],['light','Light','count'],['medium','Medium','count'],['heavy','Heavy','count'],['labor','Revenue Jasa','money'],['parts','Revenue Part','money'],['revenue','Revenue Total','money'],['revUnit','Revenue Total/Unit','money'],['productivity','Productivity SA','decimal']];
let data=null,mode='YTD',serial=0;
const fmt=(v,type)=>!Number.isFinite(v)?'—':(type==='pct'?(v*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%':v.toLocaleString('id-ID',{maximumFractionDigits:type==='decimal'?2:0}));
function draw(){
 const month=Number(by('month').value),year=Number(by('year').value);by('month').disabled=mode==='YTD';
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 const n=mode==='YTD'?12:new Date(year,month,0).getDate();
 let view=data?PerformanceModel.model(data,{mode,month,sa:by('sa').value}):null;
 by('period').textContent=mode+' '+(mode==='MTD'?months[month-1]+' ':'')+year;
 by('head').replaceChildren();const tr=document.createElement('tr');
 ['INDIKATOR',...Array.from({length:n},(_,i)=>mode==='YTD'?months[i]:String(i+1)),mode].forEach(t=>{const th=document.createElement('th');th.textContent=t;tr.append(th)});by('head').append(tr);
 by('body').replaceChildren();
 rows.forEach(([key,label,type])=>{const row=document.createElement('tr');if(type==='pct')row.className='percent';[label,...Array.from({length:n},(_,i)=>fmt(view?.slots[i][key],type)),fmt(view?.total[key],type)].forEach((t,i)=>{const td=document.createElement(i?'td':'th');td.textContent=t;row.append(td)});by('body').append(row);});
 [['cpusPct','CPUS'],['uePct','UE'],['insurancePct','Unit Asuransi'],['cashPct','Unit Personal/Cash'],['revUnit','Revenue/Unit']].forEach(([key,title],i)=>{by('label'+i).textContent=(i<4?'% ':'')+title+' '+mode;by('value'+i).textContent=fmt(view?.total[key],i===4?'money':'pct');});
 by('notes').textContent=view?['Closing Rate = CPUS ÷ UE × 100%.',view.total.unmapped?view.total.unmapped+' UE belum dipetakan sebagai Asuransi/Cash/Lainnya.':'',view.total.unknownRepair?view.total.unknownRepair+' UE belum memiliki kategori kerusakan.':'','Productivity dan pencapaian target harian memerlukan kalender hari kerja. Revenue/Unit = revenue ÷ CPUS.'].filter(Boolean).join(' '):'Data akan muncul setelah koneksi Google Sheets diaktifkan.';
}
async function load(refresh=false){
 const id=++serial,year=Number(by('year').value);by('status').textContent='Memperbarui data Google Sheets...';
 const url=window.PERFORMANCE_API_URL;
 if(!url){by('status').textContent='Koneksi Google Sheets belum diaktifkan.';draw();return;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
 try{const u=new URL(url);u.searchParams.set('year',year);if(refresh)u.searchParams.set('refresh','1');const response=await fetch(u,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const j=await response.json();if(!j.success||j.version!==2||!Array.isArray(j.bins)||j.year!==year)throw Error(j.error||'Respons tidak sesuai');if(id!==serial)return;data=j;draw();by('status').textContent='Diperbarui '+new Date(j.updatedAt).toLocaleString('id-ID');}catch(e){if(id===serial)by('status').textContent='Gagal memperbarui: '+e.message+(data?' · Data sebelumnya tetap tampil.':'');}finally{clearTimeout(timer);}
}
months.forEach((v,i)=>by('month').add(new Option(v,i+1)));by('month').value=String(new Date().getMonth()+1);
['sa','month'].forEach(id=>by(id).addEventListener('change',draw));by('year').addEventListener('change',()=>{data=null;draw();load()});document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;draw()}));by('refresh').onclick=()=>load(true);draw();load();
