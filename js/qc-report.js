const QC_REPORT_API_URL = 'https://script.google.com/macros/s/AKfycbxX3UnuRwNcYWpGhyWsz-WVopHttb3tM5Qe381lLSdPR7gkeHjKJrExFxmByYem1Toz/exec';
const JPCB_DATABASE_API_URL = 'https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec';
const QCReport=(function(){
 let cursor=new Date();cursor.setDate(1),data=null,initialized=false;
 const months=['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
 const cfg={panelRepair:{label:'QC PANEL REPAIR',dateId:'qcPanelDates',detailId:'qcPanelDetail',badgeId:'qcPanelBadge'},painting:{label:'QC PAINTING',dateId:'qcPaintingDates',detailId:'qcPaintingDetail',badgeId:'qcPaintingBadge'},finalInspection:{label:'QC FINAL INSPECTION',dateId:'qcFinalDates',detailId:'qcFinalDetail',badgeId:'qcFinalBadge'}};
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
 function pad(n){return String(n).padStart(2,'0')}
 function setStatus(k,t){let d=document.getElementById('qcApiDot'),s=document.getElementById('qcApiStatus');if(d)d.className='api-dot '+(k||'');if(s)s.textContent=t||''}
 function api(){if(QC_REPORT_API_URL)return QC_REPORT_API_URL;let u=prompt('Masukkan URL Web App QC REPORT API (script.google.com/macros/s/.../exec):');if(u){u=u.trim();localStorage.setItem('QC_REPORT_API_URL',u);return u}return ''}
 function label(){let e=document.getElementById('qcMonthLabel');if(e)e.textContent=months[cursor.getMonth()]+' '+cursor.getFullYear()}
 function days(){return new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()}
 function dk(r){return String(r&&r.tanggalISO||'').slice(0,10)}
 function today(){let d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
 function parseDbDate(v){
   if(v==null||v==='')return null;
   if(v instanceof Date&&!isNaN(v.getTime()))return new Date(v.getFullYear(),v.getMonth(),v.getDate());
   const s=String(v).trim();
   let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+.*)?$/);
   if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
   m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
   if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
   const d=new Date(s);return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
 }
 function dbDateKey(v){const d=parseDbDate(v);return d?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):''}
 function buildFinalFromDatabase(rows){
   const y=cursor.getFullYear(),m=cursor.getMonth();
   const seen=new Set(),out=[];
   (Array.isArray(rows)?rows:[]).forEach(function(u){
     const raw=u['TANGGAL SELESAI']||u['TGL SELESAI']||u['TANGGAL SELESAI ACTUAL']||u['TGL SELESAI ACTUAL']||'';
     const d=parseDbDate(raw); if(!d||d.getFullYear()!==y||d.getMonth()!==m)return;
     const nopol=String(u['NO POLISI']||'').trim(),pkb=String(u['NO PKB']||'').trim();
     const key=(nopol+'|'+pkb).toUpperCase(); if(seen.has(key))return; seen.add(key);
     out.push({
       tanggalISO:dbDateKey(raw),
       noPolisi:nopol,noPKB:pkb,type:u['TYPE']||'',group:u['GROUP']||'',sa:u['SA']||'',asuransi:u['ASURANSI']||'',panel:u['PANEL']||'',kerusakan:u['KERUSAKAN']||'',hasilQC:'SELESAI',defect:'',keterangan:'Tanggal selesai dari DATABASE UNIT',inspector:'DATABASE UNIT'
     });
   });
   out.sort((a,b)=>String(a.tanggalISO).localeCompare(String(b.tanggalISO))||String(a.noPolisi).localeCompare(String(b.noPolisi)));
   return out;
 }
 async function loadFinalFromDatabase(){
   const url=JPCB_DATABASE_API_URL+'?action=unit&ts='+Date.now();
   const r=await fetch(url,{cache:'no-store'}); if(!r.ok)throw Error('HTTP '+r.status);
   const j=await r.json(); if(!j||j.success===false)throw Error(j&&j.error||'DATABASE UNIT tidak valid');
   return buildFinalFromDatabase(j.data||[]);
 }
 function renderDates(key){let c=cfg[key],w=document.getElementById(c.dateId);if(!w)return;let sec=data?.sections?.[key]||{},rows=sec.rows||[],daily=sec.daily||{},max=days(),td=today();w.innerHTML='';for(let d=1;d<=31;d++){let e=document.createElement('div');e.className='qc-day';if(d>max){e.style.visibility='hidden';w.appendChild(e);continue}let n=Number(daily[String(d)]||0),date=cursor.getFullYear()+'-'+pad(cursor.getMonth()+1)+'-'+pad(d);if(date===td)e.classList.add('today');if(n)e.classList.add('has');e.innerHTML='<div class="d">TGL</div><div class="n">'+n+'</div><div class="lab">'+pad(d)+' '+months[cursor.getMonth()].slice(0,3)+'</div>';e.onclick=()=>{w.querySelectorAll('.qc-day').forEach(x=>x.classList.remove('selected'));e.classList.add('selected');detail(key,date)};w.appendChild(e)}let auto=rows.find(r=>dk(r)===td)||rows[0];if(auto){let date=dk(auto),idx=Number(date.slice(8,10))-1,e=w.children[idx];if(e){e.classList.add('selected');detail(key,date)}}else detail(key,'');let b=document.getElementById(c.badgeId);if(b)b.textContent=rows.length+' UNIT'}
 function detail(key,date){let c=cfg[key],box=document.getElementById(c.detailId),rows=(data?.sections?.[key]?.rows||[]).filter(r=>!date||dk(r)===date);if(!date){box.innerHTML='<div class="qc-empty">Belum ada data pada bulan ini.</div>';return}let p=date.split('-'),title=p[2]+'/'+p[1]+'/'+p[0];if(!rows.length){box.innerHTML='<div class="qc-detail-title"><strong>'+esc(c.label)+' • '+title+'</strong><span>0 UNIT</span></div><div class="qc-empty">Tidak ada unit yang selesai pada tanggal tersebut.</div>';return}let h='<div class="qc-detail-title"><strong>'+esc(c.label)+' • '+title+'</strong><span>'+rows.length+' UNIT</span></div><div class="qc-table-wrap"><table class="qc-table"><thead><tr><th>NO</th><th>NO POLISI</th><th>NO PKB</th><th>TYPE</th><th>GROUP</th><th>SA</th><th>ASURANSI</th><th>PANEL</th><th>KERUSAKAN</th><th>HASIL</th><th>DEFECT</th><th>KETERANGAN</th><th>SUMBER</th></tr></thead><tbody>';rows.forEach((r,i)=>{h+='<tr><td>'+(i+1)+'</td><td>'+esc(r.noPolisi||'-')+'</td><td>'+esc(r.noPKB||'-')+'</td><td>'+esc(r.type||'-')+'</td><td>'+esc(r.group||'-')+'</td><td>'+esc(r.sa||'-')+'</td><td>'+esc(r.asuransi||'-')+'</td><td>'+esc(r.panel||'-')+'</td><td>'+esc(r.kerusakan||'-')+'</td><td>'+esc(r.hasilQC||'-')+'</td><td>'+esc(r.defect||'-')+'</td><td>'+esc(r.keterangan||'-')+'</td><td>'+esc(r.inspector||'-')+'</td></tr>'});h+='</tbody></table></div>';box.innerHTML=h}
 function render(){label();let m=data?.mtd||{};document.getElementById('qcTotal').textContent=m.total||0;document.getElementById('qcPanel').textContent=m.panelRepair||0;document.getElementById('qcPainting').textContent=m.painting||0;document.getElementById('qcFinal').textContent=m.finalInspection||0;['panelRepair','painting','finalInspection'].forEach(renderDates)}
 async function load(){
   const base=api(); if(!base)return;
   setStatus('loading','Mengambil data QC + DATABASE UNIT...');
   const cb='qc_report_cb_'+Date.now();let finished=false,script=null,timer=null;
   function cleanup(){try{delete window[cb]}catch(e){}if(script&&script.parentNode)script.parentNode.removeChild(script);if(timer)clearTimeout(timer)}
   let qcPromise=new Promise(function(resolve,reject){
     window[cb]=function(j){if(!j||j.success===false)reject(Error(j&&j.error||'API QC gagal'));else resolve(j)};
     script=document.createElement('script');script.async=true;script.src=base+(base.includes('?')?'&':'?')+'action=qcReport&month='+(cursor.getMonth()+1)+'&year='+cursor.getFullYear()+'&callback='+encodeURIComponent(cb)+'&_='+Date.now();script.onerror=function(){reject(Error('Gagal memuat QC REPORT API'))};document.body.appendChild(script);timer=setTimeout(function(){reject(Error('Timeout QC REPORT API'))},15000);
   });
   let dbPromise=loadFinalFromDatabase();
   const results=await Promise.allSettled([qcPromise,dbPromise]);cleanup();
   const qc=results[0].status==='fulfilled'?results[0].value:null;
   const fi=results[1].status==='fulfilled'?results[1].value:[];
   if(!qc){setStatus('error','QC REPORT API gagal; FI tetap dari DATABASE UNIT');data={success:true,mtd:{panelRepair:0,painting:0,finalInspection:fi.length,total:fi.length},sections:{panelRepair:{rows:[],daily:{}},painting:{rows:[],daily:{}},finalInspection:{rows:fi,daily:fi.reduce((a,r)=>(a[r.tanggalISO.slice(8,10).replace(/^0/, '')]=(a[r.tanggalISO.slice(8,10).replace(/^0/,'')]||0)+1,a),{})}}};render();return}
   data=qc;
   const sec=data.sections||{};sec.finalInspection=sec.finalInspection||{};
   sec.finalInspection.rows=fi;
   sec.finalInspection.totalUnits=fi.length;
   sec.finalInspection.daily={};
   fi.forEach(r=>{const d=Number(String(r.tanggalISO||'').slice(8,10));if(d)sec.finalInspection.daily[String(d)]=(sec.finalInspection.daily[String(d)]||0)+1});
   data.sections=sec;
   data.mtd.finalInspection=fi.length;
   data.mtd.total=(Number(data.mtd.panelRepair)||0)+(Number(data.mtd.painting)||0)+fi.length;
   render();
   const dbState=results[1].status==='fulfilled'?'DATABASE UNIT tersambung':'DATABASE UNIT gagal';
   setStatus('', 'Terhubung • FI dari DATABASE UNIT • '+dbState+' • update '+new Date().toLocaleTimeString('id-ID'));
 }
 function init(){if(initialized)return;initialized=true;render();load()}function prevMonth(){cursor.setMonth(cursor.getMonth()-1);load()}function nextMonth(){cursor.setMonth(cursor.getMonth()+1);load()}function goToday(){let d=new Date();cursor=new Date(d.getFullYear(),d.getMonth(),1);load()}
 return {init,load,prevMonth,nextMonth,today:goToday};
})();
