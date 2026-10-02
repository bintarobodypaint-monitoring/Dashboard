'use strict';
const $=id=>document.getElementById(id), months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const names=['Prod SA','Unit Out','CPUS','Revenue','Revenue/Unit','WIP >60 hari','NPS'];
const fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
let source=null, loading=false;
months.forEach((m,i)=>$('month').add(new Option(m,i+1)));$('month').value='9';$('month').disabled=true;
function render(){
 if(!source)return;
 const original=$('mode').value==='sheet', end=Number($('month').value), r=KpiSa.calculate(source,$('sa').value,end,original);
 $('month').disabled=original;
 $('score').textContent=r.score===null?'Belum lengkap':fmt(r.score)+' poin';
 $('period').textContent=original?'Sesuai Sheet: 3 KPI unit Jan–Agu; KPI lainnya seluruh bulan template.':'Penilaian Januari–'+months[end-1]+' '+source.year;
 $('head').innerHTML='<tr>'+['KPI','Bobot (poin)',...months,'Total','Rata-rata penilaian','Target','Pencapaian','Nilai (poin)'].map(x=>'<th>'+x+'</th>').join('')+'</tr>';
 $('body').replaceChildren();
 r.rows.forEach((row,i)=>{
  const tr=document.createElement('tr');
  const values=[names[i],fmt(row.weight),...row.values.map(v=>fmt(v,i===3||i===4?0:2)),fmt(row.total),fmt(row.average),fmt(row.target),Number.isFinite(row.achievement)?fmt(row.achievement*100)+'%':'—',fmt(row.points)];
  values.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});$('body').append(tr);
 });
}
async function load(refresh){
 if(loading)return;
 const endpoint=window.KPI_SA_API_URL;
 if(!endpoint){$('status').textContent='Koneksi KPI belum diaktifkan. URL deployment API KPI SA perlu diisi pada konfigurasi.';return;}
 loading=true;$('refresh').disabled=true;$('status').textContent=source?'Memperbarui data; hasil sebelumnya tetap ditampilkan.':'Mengambil KPI dari Google Sheets...';
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),90000);
 try{
  const u=new URL(endpoint);if(u.protocol!=='https:')throw Error('URL API harus HTTPS');u.searchParams.set('year',$('year').value);if(refresh)u.searchParams.set('refresh','1');
  const response=await fetch(u,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!data.success)throw Error(data.error||'Respons API tidak valid');
  if(!Array.isArray(data.days)||data.days.length!==12||!data.data||!Array.isArray(data.weights)||!Array.isArray(data.targets))throw Error('Struktur KPI tidak valid');
  source=data;render();$('status').textContent='Data Google Sheets diperbarui '+new Date(data.updatedAt).toLocaleString('id-ID')+'. NPS yang belum tersedia ditampilkan —.';
 }catch(e){$('status').textContent='Gagal memperbarui: '+(e.name==='AbortError'?'waktu koneksi habis':e.message)+(source?'. Hasil sebelumnya tetap ditampilkan.':'');}
 finally{clearTimeout(timer);loading=false;$('refresh').disabled=false;}
}
['sa','mode','month'].forEach(id=>$(id).addEventListener('change',render));$('refresh').addEventListener('click',()=>load(true));load(false);
