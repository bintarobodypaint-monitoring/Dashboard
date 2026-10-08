(function(root){
'use strict';
const MONTHS=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const TARGET=[299,273,195,323,243,312,338,283,327,331,321,345];
const REVENUE_TARGET=[1553108000,1449567000,1277000000,1587621000,1415054000,1518594000,1725675000,1484081000,1656648000,1691162000,1587621000,1587621000];
const REVUNIT_TARGET=5190000;
const LABOR_TARGET=[748125000,698250000,615125000,764750000,681625000,731500000,831250000,714875000,798000000,814625000,764750000,764750000];
const PART_TARGET=[778050000,726180000,639730000,795340000,708890000,760760000,864500000,743470000,829920000,847210000,795340000,795340000];
const COLORS=['#2563eb','#14b8a6','#f59e0b','#8b5cf6','#ec4899','#64748b'];
const CATEGORIES=['ASURANSI','PERSONAL','GR -WAC','TPI(GRAB)','SUDECO'];
function vehicleType(label){const name=String(label||'').trim().toUpperCase();return name.replace(/[\s-]/g,'')==='CHR'?'C-HR':name;}
function insurerName(label){const name=String(label||'').trim().toUpperCase();return ['AAB','TI','AAB / TI'].includes(name)?'AAB / TI':name;}
function invoiceMetrics(records){
 const units=new Map();for(const r of records){const key=r.sa+'|'+r.key;const u=units.get(key)||{labor:0,parts:0};u.labor+=r.labor||0;u.parts+=r.parts||0;units.set(key,u);}
 let partsUnits=0,laborOnlyUnits=0,partsRevenue=0,laborOnlyRevenue=0;
 for(const u of units.values()){if(u.parts>0){partsUnits++;partsRevenue+=u.parts;}if(u.labor>0&&u.parts===0){laborOnlyUnits++;laborOnlyRevenue+=u.labor;}}
 return {partsUnits,laborOnlyUnits,partsRevenue,laborOnlyRevenue,revPart:partsUnits?partsRevenue/partsUnits:null,revLabor:laborOnlyUnits?laborOnlyRevenue/laborOnlyUnits:null};
}
function aggregate(detail,year,month,mode,sa){
 const n=mode==='MTD'?new Date(year,month,0).getDate():month;
 const slots=Array.from({length:n},()=>({ue:0,cpus:0,labor:0,parts:0,revenue:0,light:0,medium:0,heavy:0,unknownRepair:0,categories:{},types:{},insurers:{}}));
 const cutoff=detail.asOf; const sas=sa==='ALL'?detail.sas:[sa];
 for(const b of detail.bins||[]){
  if(!sas.includes(b.sa)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||+b.date.slice(0,4)!==year||b.date>cutoff)continue;
  const m=+b.date.slice(5,7);if(m>month||(mode==='MTD'&&m!==month))continue;
  const i=mode==='MTD'?+b.date.slice(8,10)-1:m-1;const slot=slots[i];if(!slot)continue;
  for(const k of ['ue','cpus','labor','parts','revenue','light','medium','heavy','unknownRepair'])slot[k]+=Number.isFinite(b[k])?b[k]:0;
  for(const key of ['categories','types','insurers'])for(const [label,value] of Object.entries(b[key]||{})){const name=key==='types'?vehicleType(label):key==='insurers'?insurerName(label):label;slot[key][name]=(slot[key][name]||0)+(Number.isFinite(value)?value:0);}
 }
 const total={ue:0,cpus:0,labor:0,parts:0,revenue:0,light:0,medium:0,heavy:0,unknownRepair:0,categories:{},types:{},insurers:{}};
 for(const s of slots)for(const k of Object.keys(total)){
  if(typeof total[k]==='number')total[k]+=s[k];else for(const [label,value]of Object.entries(s[k]))total[k][label]=(total[k][label]||0)+value;
 }
 const invoices=(detail.unitInvoices||[]).filter(r=>sas.includes(r.sa)&&+r.date.slice(0,4)===year&&r.date<=cutoff&&+r.date.slice(5,7)<=month&&(mode!=='MTD'||+r.date.slice(5,7)===month));
 const hasInvoiceMetrics=Array.isArray(detail.unitInvoices);
 if(hasInvoiceMetrics){Object.assign(total,invoiceMetrics(invoices));slots.forEach((slot,i)=>Object.assign(slot,invoiceMetrics(invoices.filter(r=>mode==='MTD'?+r.date.slice(8,10)===i+1:+r.date.slice(5,7)===i+1))));}
 const divisor=sa==='ALL'?1:3;
 function monthFraction(m){const prefix=year+'-'+String(m).padStart(2,'0');if(prefix>cutoff.slice(0,7))return 0;if(prefix<cutoff.slice(0,7))return 1;let all=0,elapsed=0;for(let d=1;d<=new Date(year,m,0).getDate();d++){const date=prefix+'-'+String(d).padStart(2,'0');const weight=Number.isFinite(detail.calendar?.[date])?detail.calendar[date]:(new Date(date+'T12:00:00').getDay()===0?0:1);all+=weight;if(date<=cutoff)elapsed+=weight;}return all?elapsed/all:0;}
 const sumTarget=arr=>year!==2026?null:arr.reduce((sum,value,i)=>sum+((mode==='YTD'?i<month:i===month-1)?value*monthFraction(i+1)/divisor:0),0);
 const targets={ue:sumTarget(TARGET),cpus:sumTarget(TARGET),revenue:sumTarget(REVENUE_TARGET),revUnit:year===2026?REVUNIT_TARGET:null};
 const weights=Array.from({length:new Date(year,month,0).getDate()},(_,i)=>{
  const date=year+'-'+String(month).padStart(2,'0')+'-'+String(i+1).padStart(2,'0');
  const v=detail.calendar?.[date];return Number.isFinite(v)?v:(new Date(date+'T12:00:00').getDay()===0?0:1);
 });
 const weightSum=weights.reduce((a,b)=>a+b,0);
 const target=slots.map((_,i)=>year!==2026?null:mode==='YTD'?TARGET[i]*monthFraction(i+1)/divisor:weightSum?TARGET[month-1]/divisor*weights[i]/weightSum:null);
 const visible=slots.map((_,i)=> mode==='YTD'?year+'-'+String(i+1).padStart(2,'0')<=cutoff.slice(0,7):year+'-'+String(month).padStart(2,'0')+'-'+String(i+1).padStart(2,'0')<=cutoff);
 const periodTargets=arr=>slots.map((_,i)=>year!==2026?null:mode==='YTD'?arr[i]*monthFraction(i+1)/divisor:weightSum?arr[month-1]/divisor*weights[i]/weightSum:null);
 const revenueTargets={labor:periodTargets(LABOR_TARGET),parts:periodTargets(PART_TARGET),revenue:periodTargets(REVENUE_TARGET),revunit:slots.map(()=>year===2026?REVUNIT_TARGET:null)};
 const ueTargets=periodTargets(TARGET);
 return {slots,total,target,targets,revenueTargets,ueTargets,hasInvoiceMetrics,visible,labels:slots.map((_,i)=>mode==='YTD'?MONTHS[i]:String(i+1)),weightSum};
}
root.KpiComposition={aggregate,vehicleType,insurerName,invoiceMetrics};if(typeof module!=='undefined')module.exports=root.KpiComposition;
if(typeof document==='undefined')return;
const by=id=>document.getElementById(id);const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(v)?v.toLocaleString('id-ID',{maximumFractionDigits:1}):'—';
const money=v=>Number.isFinite(v)?'Rp '+v.toLocaleString('id-ID',{maximumFractionDigits:0}):'—';
let data=null,mode='YTD',loading=false;
const style=document.createElement('link');style.rel='stylesheet';style.href='../css/kpi-sa-composition.css?v=20261008-percent-tam-v4';document.head.append(style);
const main=document.querySelector('main');const old=document.createElement('div');old.id='performance-kpi-tab';while(main.firstChild)old.append(main.firstChild);
const nav=document.createElement('div');nav.className='composition-tabs';nav.innerHTML='<button type="button" aria-selected="true" data-perf-tab="kpi">KPI SA</button><button type="button" aria-selected="false" data-perf-tab="composition">Komposisi Unit Entry</button>';
const section=document.createElement('section');section.id='performance-composition-tab';section.hidden=true;section.innerHTML=`
<div class="comp-heading"><div><h1>Komposisi Unit Entry</h1><p>Tunas Toyota Bintaro · Body &amp; Paint</p></div><span class="comp-tag">MTD / YTD</span></div>
<div class="comp-controls"><label>Service Advisor<select id="comp-sa"><option value="ALL">Semua SA</option><option>DWI NANTO</option><option>IWAN ISKANDAR</option><option>HENDI</option></select></label><label>Tahun<select id="comp-year"><option>2026</option></select></label><label>Bulan akhir<select id="comp-month">${MONTHS.map((m,i)=>'<option value="'+(i+1)+'">'+m+'</option>').join('')}</select></label><div class="comp-toggle"><button type="button" data-comp-mode="MTD">MTD</button><button type="button" data-comp-mode="YTD" aria-pressed="true">YTD</button></div><button type="button" id="comp-refresh">Perbarui data</button></div>
<p id="comp-status" role="status">Buka tab untuk memuat grafik.</p><div id="comp-kpis" class="comp-kpis"></div>
<div class="comp-grid"><article class="comp-card"><h2>UE by kategori</h2><div id="comp-category"></div></article><article class="comp-card"><h2>CPUS vs UE vs Target TAM</h2><div id="comp-trend"></div></article><article class="comp-card comp-wide"><h2>UE by type</h2><p>Foto mobil sesuai tipe; angka adalah jumlah UE. <a href="../assets/cars/credits.html" target="_blank" rel="noopener">Kredit foto</a></p><div id="comp-type"></div></article><article class="comp-card"><h2>Light · Medium · Heavy</h2><div id="comp-damage"></div></article><article class="comp-card"><h2>UE by insurance</h2><div id="comp-insurance"></div></article><article class="comp-card comp-wide"><h2>Tren UE by insurance</h2><label class="comp-select-label">Asuransi <select id="comp-insurer"><option value="ALL">Semua asuransi</option></select></label><div id="comp-insurance-trend"></div></article><article class="comp-card comp-wide"><h2>Revenue</h2><div class="comp-revenue"><div><h3>REV / UNIT</h3><div id="comp-revunit"></div></div><div><h3>REV JASA</h3><div id="comp-labor"></div></div><div><h3>REV PART</h3><div id="comp-parts"></div></div><div><h3>REV TOTAL</h3><div id="comp-revenue"></div></div></div></article></div>
<p class="comp-note">REV/UNIT = revenue total ÷ CPUS. REV PART = total revenue part. REV JASA = total revenue jasa. REV TOTAL = total revenue Invoice. Target grafik memakai papan Target Tunas 2026. Angka actual merah jika di bawah target. Tabel YTD menampilkan bulan horizontal; tabel MTD menampilkan tanggal horizontal. Persentase UE = actual UE ÷ target CPUS TAM × 100%. Persentase CPUS = actual CPUS ÷ target CPUS TAM × 100%. Revenue memakai target Tunas 2026; REV/UNIT ditargetkan Rp 5.190.000. Target total untuk satu SA dibagi 3. Bulan berjalan memakai proporsi hari kerja sampai tanggal data. Target TAM 2026: satu SA ÷ 3, Semua SA memakai target cabang. MTD menampilkan target harian menurut proporsi hari kerja kalender; YTD menjumlahkan target bulan terpilih; bulan berjalan memakai proporsi hari kerja sampai tanggal data. Data belum terpetakan ditampilkan terpisah.</p>`;
main.append(nav,old,section);by('comp-month').value=String(new Date().getMonth()+1);
function svg(content,label){return '<svg viewBox="0 0 640 280" role="img" aria-label="'+esc(label)+'">'+content+'</svg>';}
function empty(){return '<p class="comp-empty">Belum ada data pada periode ini.</p>';}
function legend(series){return '<div class="comp-legend">'+series.map((s,i)=>'<span><i style="background:'+COLORS[i%COLORS.length]+'"></i>'+esc(s.name)+'</span>').join('')+'</div>';}
function axis(v){return v>=1e9?num(v/1e9)+' M':v>=1e6?num(v/1e6)+' jt':v>=1e3?num(v/1e3)+' rb':num(v);}
function line(labels,series,visible,showTable=true){
 const vals=series.flatMap(s=>s.values.filter(Number.isFinite));if(!vals.length)return empty();
 const chartWidth=Math.max(640,labels.length*75);const max=Math.max(1,...vals)*1.18;const L=65,R=chartWidth-40,T=40,B=228;let html='';
 for(let i=0;i<=4;i++){const y=B-(B-T)*i/4;html+='<path d="M'+L+' '+y+'H'+R+'" stroke="#e2e8f0"/><text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end">'+esc(axis(max*i/4))+'</text>';}
 const x=i=>labels.length===1?(L+R)/2:L+(R-L)*i/(labels.length-1),y=v=>B-(B-T)*v/max;
 labels.forEach((l,i)=>{if(i===0||i===labels.length-1||i%Math.max(1,Math.ceil(labels.length/12))===0)html+='<text x="'+x(i)+'" y="250" text-anchor="middle">'+esc(l)+'</text>';});
 series.forEach((s,k)=>{let d='';let open=false;s.values.forEach((v,i)=>{if(!Number.isFinite(v)||(visible&&!visible[i])){open=false;return;}d+=(open?'L':'M')+x(i)+' '+y(v)+' ';open=true;});html+='<path d="'+d+'" fill="none" stroke="'+COLORS[k%COLORS.length]+'" stroke-width="3"'+(s.isTarget?' stroke-dasharray="7 5"':'')+'/>';s.values.forEach((v,i)=>{if(Number.isFinite(v)&&(!visible||visible[i]))html+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3.5" fill="'+COLORS[k%COLORS.length]+'"><title>'+esc(s.name+' · '+labels[i]+': '+num(v))+'</title></circle>';});});
 const placed=[];
 series.forEach((s,k)=>s.values.forEach((value,i)=>{if(!Number.isFinite(value)||(visible&&!visible[i]))return;let ly=y(value)-9;const lx=x(i);const label=axis(value);const width=label.length*6+6;while(placed.some(p=>Math.abs(p.x-lx)<(p.w+width)/2&&Math.abs(p.y-ly)<13))ly-=14;if(ly<15){ly=y(value)+16;while(placed.some(p=>Math.abs(p.x-lx)<(p.w+width)/2&&Math.abs(p.y-ly)<13))ly+=14;}placed.push({x:lx,y:ly,w:width});html+='<text class="comp-point-value" x="'+lx+'" y="'+ly+'" text-anchor="middle" style="fill:'+(!s.isTarget&&Number.isFinite(s.targets?.[i])&&value<s.targets[i]?'#dc2626':COLORS[k%COLORS.length])+'">'+esc(label)+'</text>';}));
 const periods=labels.map((label,i)=>({label,i})).filter(p=>!visible||visible[p.i]);
 const below=(s,i)=>!s.isTarget&&Number.isFinite(s.values[i])&&Number.isFinite(s.targets?.[i])&&s.values[i]<s.targets[i];
 const table=showTable?'<div class="comp-values"><table><thead><tr><th>Indikator</th>'+periods.map(p=>'<th scope="col">'+esc(p.label)+'</th>').join('')+'</tr></thead><tbody>'+series.map(s=>'<tr><th scope="row">'+esc(s.name)+'</th>'+periods.map(p=>'<td'+(below(s,p.i)?' class="comp-below-target"':'')+'>'+(s.currency?money(s.values[p.i]):num(s.values[p.i]))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'';
 return '<div class="comp-line-scroll"><div style="min-width:'+chartWidth+'px">'+svg(html,'Grafik garis: '+series.map(s=>s.name).join(', ')).replace('0 0 640 280','0 0 '+chartWidth+' 280')+'</div></div>'+legend(series)+table;
}
function bars(entries,percent){const total=entries.reduce((sum,e)=>sum+e[1],0);if(!entries.length||!entries.some(([,v])=>v>0))return empty();const max=Math.max(1,...entries.map(e=>e[1]));return '<div class="comp-bars">'+entries.map(([name,value],i)=>'<div class="comp-bar-row"><span>'+esc(name)+'</span><div><i style="width:'+Math.max(value>0?1:0,value/max*100)+'%;background:'+COLORS[i%COLORS.length]+'"></i></div><strong>'+num(value)+(percent?' <small>('+num(total?value/total*100:0)+'%)</small>':'')+'</strong></div>').join('')+'</div>';}
function pie(entries){const total=entries.reduce((s,e)=>s+e[1],0);if(!total)return empty();let angle=0;let paths='';entries.forEach(([name,v],i)=>{if(!v)return;const start=angle;angle+=v/total*2*Math.PI;const x=a=>135+95*Math.sin(a),y=a=>135-95*Math.cos(a);paths+=v===total?'<circle cx="135" cy="135" r="95" fill="'+COLORS[i%COLORS.length]+'"/>':'<path d="M135 135 L'+x(start)+' '+y(start)+' A95 95 0 '+(v/total>.5?1:0)+' 1 '+x(angle)+' '+y(angle)+' Z" fill="'+COLORS[i%COLORS.length]+'"><title>'+esc(name+': '+v)+'</title></path>';});return '<div class="comp-pie">'+('<svg viewBox="0 0 270 270" role="img" aria-label="Komposisi UE kategori">'+paths+'</svg>')+'<div>'+entries.map(([name,v],i)=>'<p><i style="background:'+COLORS[i%COLORS.length]+'"></i><span>'+esc(name)+'</span><b>'+num(v)+' <small>('+num(v/total*100)+'%)</small></b></p>').join('')+'</div></div>';}
const PHOTO_FILES={AGYA:'agya.webp',ALPHARD:'alphard.webp',AVANZA:'avanza.webp',BZ4X:'bz4x.webp','C-HR':'c-hr.webp',CALYA:'calya.webp',CAMRY:'camry.webp',COROLLA:'corolla.webp',CROWN:'crown.webp',ETIOS:'etios.webp',FORTUNER:'fortuner.webp',FT86:'ft-86.webp','FT-86':'ft-86.webp','FT 86':'ft-86.webp',HARIER:'harier.webp',HARRIER:'harier.webp',HIACE:'hiace.webp','HI-ACE':'hiace.webp',HILUX:'hilux.webp',INNOVA:'innova.webp',NAV1:'nav1.webp',RAIZE:'raize.webp',RUSH:'rush.webp',SIENTA:'sienta.webp',VIOS:'vios.webp',VOXY:'voxy.webp',YARIS:'yaris.webp'};
function car(type){const file=PHOTO_FILES[vehicleType(type)];return file?'<img class="comp-car-photo" src="../assets/cars/'+file+'" alt="Toyota '+esc(vehicleType(type))+'" loading="lazy" decoding="async" width="120" height="80">':'<div class="comp-car-missing">Foto belum tersedia</div>';}
function typeBars(entries){if(!entries.length)return empty();const max=Math.max(1,...entries.map(e=>e[1]));return '<div class="comp-type-bars">'+entries.map(([name,value])=>'<div class="comp-type-column"><strong>'+num(value)+'</strong><div class="comp-type-track"><i style="height:'+value/max*100+'%"></i></div>'+car(name)+'<b>'+esc(name)+'</b></div>').join('')+'</div>';}
const sorted=map=>Object.entries(map).sort((a,b)=>b[1]-a[1]);
function render(){if(!data)return;const year=+by('comp-year').value,month=+by('comp-month').value,sa=by('comp-sa').value;const v=aggregate(data.detail,year,month,mode,sa),t=v.total;
 const cards=[['Unit Entry',t.ue,v.targets.ue,false],['CPUS',t.cpus,v.targets.cpus,false],['Revenue',t.revenue,v.targets.revenue,true],['REV / UNIT',t.cpus?t.revenue/t.cpus:null,v.targets.revUnit,true]];
 by('comp-kpis').innerHTML=cards.map(([label,value,target,rupiah])=>'<div><span>'+label+'</span><div class="comp-kpi-value"><strong'+(Number.isFinite(value)&&target>0&&value<target?' class="comp-below-target"':'')+'>'+(rupiah?money(value):num(value))+'</strong><b class="comp-achievement'+(Number.isFinite(value)&&target>0&&value<target?' comp-below-target':'')+'">'+(Number.isFinite(value)&&target>0?num(value/target*100)+'%':'—')+'</b></div><small>Target '+(['Unit Entry','CPUS'].includes(label)?'TAM ':'')+(rupiah?money(target):num(target))+'</small></div>').join('');
 const cats=CATEGORIES.map(k=>[k,t.categories[k]||0]);if(t.categories['BELUM TERPETAKAN'])cats.push(['BELUM TERPETAKAN',t.categories['BELUM TERPETAKAN']]);by('comp-category').innerHTML=bars(cats,true);
 by('comp-trend').innerHTML=line(v.labels,[{name:'CPUS',values:v.slots.map(s=>s.cpus),targets:v.target},{name:'UE',values:v.slots.map(s=>s.ue),targets:v.ueTargets},{name:'Target CPUS TAM'+(sa==='ALL'?'':' / 3'),values:v.target}],v.visible);
 by('comp-type').innerHTML=typeBars(sorted(t.types));by('comp-damage').innerHTML=bars([['LIGHT',t.light],['MEDIUM',t.medium],['HEAVY',t.heavy],['BELUM TERPETAKAN',t.unknownRepair]]);by('comp-insurance').innerHTML=bars(sorted(t.insurers));
 const selected=by('comp-insurer').value;by('comp-insurer').innerHTML='<option value="ALL">Semua asuransi</option>'+sorted(t.insurers).map(([n])=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');if(Object.hasOwn(t.insurers,selected))by('comp-insurer').value=selected;
 renderInsurance(v);
 for(const [id,name,get] of [['revunit','REV/UNIT',s=>s.cpus?s.revenue/s.cpus:null],['labor','REV JASA',s=>s.labor],['parts','REV PART',s=>s.parts],['revenue','REV TOTAL',s=>s.revenue]]){
  const values=v.slots.map(get),planned=v.revenueTargets[id];
  const actual=id==='revunit'?(t.cpus?t.revenue/t.cpus:null):t[id==='labor'?'labor':id==='parts'?'parts':'revenue'];
  const targetValue=id==='revunit'?v.targets.revUnit:year===2026?planned.reduce((sum,n,i)=>sum+(v.visible[i]&&Number.isFinite(n)?n:0),0):null;
  const summary='<p class="comp-note"><strong'+(Number.isFinite(actual)&&Number.isFinite(targetValue)&&actual<targetValue?' class="comp-below-target"':'')+'>'+money(actual)+'</strong> · Target '+money(targetValue)+'</p>';
  by('comp-'+id).innerHTML=summary+line(v.labels,[{name,values,currency:true,targets:planned},{name:'Target Tunas',values:planned,currency:true,isTarget:true}],v.visible);
 }

 by('comp-status').textContent=mode+' '+(mode==='MTD'?MONTHS[month-1]:'Jan–'+MONTHS[month-1])+' '+year+' · '+(sa==='ALL'?'Semua SA':sa)+' · Data sampai '+data.detail.asOf+(t.unknownRepair?' · '+t.unknownRepair+' UE belum memiliki kategori kerusakan.':'');
}
function renderInsurance(v){v=v||aggregate(data.detail,+by('comp-year').value,+by('comp-month').value,mode,by('comp-sa').value);const insurer=by('comp-insurer').value;const names=insurer==='ALL'?sorted(v.total.insurers).slice(0,5).map(e=>e[0]):[insurer];by('comp-insurance-trend').innerHTML=names.length?line(v.labels,names.map(name=>({name,values:v.slots.map(s=>s.insurers[name]||0)})),v.visible,false)+(insurer==='ALL'?'<p class="comp-note">Lima asuransi terbesar; pilih nama untuk melihat asuransi lainnya.</p>':''):empty();}
async function load(refresh){if(loading)return;loading=true;by('comp-refresh').disabled=true;by('comp-status').textContent='Mengambil data komposisi...';try{if(!root.KPI_SA_API_URL)throw Error('URL API KPI belum diatur.');const u=new URL(root.KPI_SA_API_URL);u.searchParams.set('year',by('comp-year').value);if(refresh)u.searchParams.set('refresh','1');const next=await jsonp(u.toString());if(!next.success)throw Error(next.error||'API gagal.');next.detail=next.performanceDetail||next.detail;if(!next.detail?.compositionVersion)throw Error('Deploy API komposisi versi terbaru, lalu klik Perbarui data.');data=next;render();}catch(e){by('comp-status').textContent=e.message+(data?' Data sebelumnya tetap ditampilkan.':'');}finally{loading=false;by('comp-refresh').disabled=false;}}
nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const comp=button.dataset.perfTab==='composition';old.hidden=comp;section.hidden=!comp;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b===button)));if(comp&&!data)load(false);}));
['comp-sa','comp-month'].forEach(id=>by(id).addEventListener('change',render));by('comp-year').addEventListener('change',()=>load(false));by('comp-refresh').addEventListener('click',()=>load(true));by('comp-insurer').addEventListener('change',()=>{if(data)renderInsurance();});section.querySelectorAll('[data-comp-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.compMode;section.querySelectorAll('[data-comp-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();}));
})(typeof window==='undefined'?globalThis:window);



