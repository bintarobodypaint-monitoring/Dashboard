(function(root){
'use strict';
const MONTHS=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const TARGET=[299,273,195,323,243,312,338,283,327,331,321,345];
const COLORS=['#2563eb','#14b8a6','#f59e0b','#8b5cf6','#ec4899','#64748b'];
const CATEGORIES=['ASURANSI','PERSONAL','GR -WAC','TPI(GRAB)','SUDECO'];
function aggregate(detail,year,month,mode,sa){
 const n=mode==='MTD'?new Date(year,month,0).getDate():month;
 const slots=Array.from({length:n},()=>({ue:0,cpus:0,labor:0,parts:0,revenue:0,light:0,medium:0,heavy:0,unknownRepair:0,categories:{},types:{},insurers:{}}));
 const cutoff=detail.asOf; const sas=sa==='ALL'?detail.sas:[sa];
 for(const b of detail.bins||[]){
  if(!sas.includes(b.sa)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||+b.date.slice(0,4)!==year||b.date>cutoff)continue;
  const m=+b.date.slice(5,7);if(m>month||(mode==='MTD'&&m!==month))continue;
  const i=mode==='MTD'?+b.date.slice(8,10)-1:m-1;const slot=slots[i];if(!slot)continue;
  for(const k of ['ue','cpus','labor','parts','revenue','light','medium','heavy','unknownRepair'])slot[k]+=Number.isFinite(b[k])?b[k]:0;
  for(const key of ['categories','types','insurers'])for(const [label,value] of Object.entries(b[key]||{}))slot[key][label]=(slot[key][label]||0)+(Number.isFinite(value)?value:0);
 }
 const total={ue:0,cpus:0,labor:0,parts:0,revenue:0,light:0,medium:0,heavy:0,unknownRepair:0,categories:{},types:{},insurers:{}};
 for(const s of slots)for(const k of Object.keys(total)){
  if(typeof total[k]==='number')total[k]+=s[k];else for(const [label,value]of Object.entries(s[k]))total[k][label]=(total[k][label]||0)+value;
 }
 const weights=Array.from({length:new Date(year,month,0).getDate()},(_,i)=>{
  const date=year+'-'+String(month).padStart(2,'0')+'-'+String(i+1).padStart(2,'0');
  const v=detail.calendar?.[date];return Number.isFinite(v)?v:(new Date(date+'T12:00:00').getDay()===0?0:1);
 });
 const weightSum=weights.reduce((a,b)=>a+b,0);const divisor=sa==='ALL'?1:3;
 const target=slots.map((_,i)=>year!==2026?null:mode==='YTD'?TARGET[i]/divisor:weightSum?TARGET[month-1]/divisor*weights[i]/weightSum:null);
 const visible=slots.map((_,i)=> mode==='YTD'?year+'-'+String(i+1).padStart(2,'0')<=cutoff.slice(0,7):year+'-'+String(month).padStart(2,'0')+'-'+String(i+1).padStart(2,'0')<=cutoff);
 return {slots,total,target,visible,labels:slots.map((_,i)=>mode==='YTD'?MONTHS[i]:String(i+1)),weightSum};
}
root.KpiComposition={aggregate};if(typeof module!=='undefined')module.exports=root.KpiComposition;
if(typeof document==='undefined')return;
const by=id=>document.getElementById(id);const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(v)?v.toLocaleString('id-ID',{maximumFractionDigits:1}):'—';
const money=v=>Number.isFinite(v)?'Rp '+v.toLocaleString('id-ID',{maximumFractionDigits:0}):'—';
let data=null,mode='YTD',loading=false;
const style=document.createElement('link');style.rel='stylesheet';style.href='../css/kpi-sa-composition.css?v=20261004';document.head.append(style);
const main=document.querySelector('main');const old=document.createElement('div');old.id='performance-kpi-tab';while(main.firstChild)old.append(main.firstChild);
const nav=document.createElement('div');nav.className='composition-tabs';nav.innerHTML='<button type="button" aria-selected="true" data-perf-tab="kpi">KPI SA</button><button type="button" aria-selected="false" data-perf-tab="composition">Komposisi Unit Entry</button>';
const section=document.createElement('section');section.id='performance-composition-tab';section.hidden=true;section.innerHTML=`
<div class="comp-heading"><div><h1>Komposisi Unit Entry</h1><p>Tunas Toyota Bintaro · Body &amp; Paint</p></div><span class="comp-tag">MTD / YTD</span></div>
<div class="comp-controls"><label>Service Advisor<select id="comp-sa"><option value="ALL">Semua SA</option><option>DWI NANTO</option><option>IWAN ISKANDAR</option><option>HENDI</option></select></label><label>Tahun<select id="comp-year"><option>2026</option></select></label><label>Bulan akhir<select id="comp-month">${MONTHS.map((m,i)=>'<option value="'+(i+1)+'">'+m+'</option>').join('')}</select></label><div class="comp-toggle"><button type="button" data-comp-mode="MTD">MTD</button><button type="button" data-comp-mode="YTD" aria-pressed="true">YTD</button></div><button type="button" id="comp-refresh">Perbarui data</button></div>
<p id="comp-status" role="status">Buka tab untuk memuat grafik.</p><div id="comp-kpis" class="comp-kpis"></div>
<div class="comp-grid"><article class="comp-card"><h2>UE by kategori</h2><div id="comp-category"></div></article><article class="comp-card"><h2>CPUS vs UE vs Target TAM</h2><div id="comp-trend"></div></article><article class="comp-card comp-wide"><h2>UE by type</h2><p>Ilustrasi mobil menurut bentuk bodi; angka adalah jumlah UE.</p><div id="comp-type"></div></article><article class="comp-card"><h2>Light · Medium · Heavy</h2><div id="comp-damage"></div></article><article class="comp-card"><h2>UE by insurance</h2><div id="comp-insurance"></div></article><article class="comp-card comp-wide"><h2>Tren UE by insurance</h2><label class="comp-select-label">Asuransi <select id="comp-insurer"><option value="ALL">Semua asuransi</option></select></label><div id="comp-insurance-trend"></div></article><article class="comp-card comp-wide"><h2>Revenue</h2><div class="comp-revenue"><div><h3>REV / UNIT</h3><div id="comp-revunit"></div></div><div><h3>REV / JASA</h3><div id="comp-labor"></div></div><div><h3>REV / PART</h3><div id="comp-parts"></div></div><div><h3>REV / TOTAL</h3><div id="comp-revenue"></div></div></div></article></div>
<p class="comp-note">REV/UNIT = revenue total ÷ CPUS. Target TAM 2026: satu SA ÷ 3, Semua SA memakai target cabang. MTD menampilkan target harian menurut proporsi hari kerja kalender; YTD memakai target penuh tiap bulan. Data belum terpetakan ditampilkan terpisah.</p>`;
main.append(nav,old,section);by('comp-month').value=String(new Date().getMonth()+1);
function svg(content,label){return '<svg viewBox="0 0 640 280" role="img" aria-label="'+esc(label)+'">'+content+'</svg>';}
function empty(){return '<p class="comp-empty">Belum ada data pada periode ini.</p>';}
function legend(series){return '<div class="comp-legend">'+series.map((s,i)=>'<span><i style="background:'+COLORS[i%COLORS.length]+'"></i>'+esc(s.name)+'</span>').join('')+'</div>';}
function axis(v){return v>=1e9?num(v/1e9)+' M':v>=1e6?num(v/1e6)+' jt':v>=1e3?num(v/1e3)+' rb':num(v);}
function line(labels,series,visible){
 const vals=series.flatMap(s=>s.values.filter(Number.isFinite));if(!vals.length)return empty();
 const max=Math.max(1,...vals);const L=65,R=610,T=30,B=228;let html='';
 for(let i=0;i<=4;i++){const y=B-(B-T)*i/4;html+='<path d="M'+L+' '+y+'H'+R+'" stroke="#e2e8f0"/><text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end">'+esc(axis(max*i/4))+'</text>';}
 const x=i=>labels.length===1?(L+R)/2:L+(R-L)*i/(labels.length-1),y=v=>B-(B-T)*v/max;
 labels.forEach((l,i)=>{if(i===0||i===labels.length-1||i%Math.max(1,Math.ceil(labels.length/12))===0)html+='<text x="'+x(i)+'" y="250" text-anchor="middle">'+esc(l)+'</text>';});
 series.forEach((s,k)=>{let d='';let open=false;s.values.forEach((v,i)=>{if(!Number.isFinite(v)||(visible&&!visible[i])){open=false;return;}d+=(open?'L':'M')+x(i)+' '+y(v)+' ';open=true;});html+='<path d="'+d+'" fill="none" stroke="'+COLORS[k%COLORS.length]+'" stroke-width="3"/>';s.values.forEach((v,i)=>{if(Number.isFinite(v)&&(!visible||visible[i]))html+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3.5" fill="'+COLORS[k%COLORS.length]+'"><title>'+esc(s.name+' · '+labels[i]+': '+num(v))+'</title></circle>';});});
 return svg(html,'Grafik garis: '+series.map(s=>s.name).join(', '))+legend(series);
}
function bars(entries){if(!entries.length||!entries.some(([,v])=>v>0))return empty();const max=Math.max(1,...entries.map(e=>e[1]));return '<div class="comp-bars">'+entries.map(([name,value],i)=>'<div class="comp-bar-row"><span>'+esc(name)+'</span><div><i style="width:'+Math.max(value>0?1:0,value/max*100)+'%;background:'+COLORS[i%COLORS.length]+'"></i></div><strong>'+num(value)+'</strong></div>').join('')+'</div>';}
function pie(entries){const total=entries.reduce((s,e)=>s+e[1],0);if(!total)return empty();let angle=0;let paths='';entries.forEach(([name,v],i)=>{if(!v)return;const start=angle;angle+=v/total*2*Math.PI;const x=a=>135+95*Math.sin(a),y=a=>135-95*Math.cos(a);paths+=v===total?'<circle cx="135" cy="135" r="95" fill="'+COLORS[i%COLORS.length]+'"/>':'<path d="M135 135 L'+x(start)+' '+y(start)+' A95 95 0 '+(v/total>.5?1:0)+' 1 '+x(angle)+' '+y(angle)+' Z" fill="'+COLORS[i%COLORS.length]+'"><title>'+esc(name+': '+v)+'</title></path>';});return '<div class="comp-pie">'+('<svg viewBox="0 0 270 270" role="img" aria-label="Komposisi UE kategori">'+paths+'</svg>')+'<div>'+entries.map(([name,v],i)=>'<p><i style="background:'+COLORS[i%COLORS.length]+'"></i><span>'+esc(name)+'</span><b>'+num(v)+' <small>('+num(v/total*100)+'%)</small></b></p>').join('')+'</div></div>';}
function car(type){const suv=/FORTUNER|RUSH|RAIZE/.test(type),mpv=/INNOVA|AVANZA|CALYA|ALPHARD|HIACE/.test(type),pickup=/HILUX/.test(type);const hatch=/AGYA|YARIS|RAIZE/.test(type);const roof=pickup?'M20 65 L32 33 H66 L83 65 H132 V77 H12Z':hatch?'M12 65 L24 35 H83 L112 65 H139 V77 H12Z':suv||mpv?'M12 65 L29 29 H100 L132 65 V77 H12Z':'M12 65 L39 39 H86 L115 65 H139 V77 H12Z';return '<svg viewBox="0 0 155 100" role="img" aria-label="Ilustrasi '+esc(type)+'"><path d="'+roof+'" fill="#cbd5e1" stroke="#475569" stroke-width="2"/><path d="M37 36 H64 V59 H25Z M70 36 H96 L112 59 H70Z" fill="#93c5fd"/><circle cx="38" cy="77" r="13" fill="#334155"/><circle cx="115" cy="77" r="13" fill="#334155"/><circle cx="38" cy="77" r="6" fill="#e2e8f0"/><circle cx="115" cy="77" r="6" fill="#e2e8f0"/></svg>';}
function typeBars(entries){if(!entries.length)return empty();const max=Math.max(1,...entries.map(e=>e[1]));return '<div class="comp-type-bars">'+entries.map(([name,value])=>'<div class="comp-type-column"><strong>'+num(value)+'</strong><div class="comp-type-track"><i style="height:'+value/max*100+'%"></i></div>'+car(name)+'<b>'+esc(name)+'</b></div>').join('')+'</div>';}
const sorted=map=>Object.entries(map).sort((a,b)=>b[1]-a[1]);
function render(){if(!data)return;const year=+by('comp-year').value,month=+by('comp-month').value,sa=by('comp-sa').value;const v=aggregate(data.detail,year,month,mode,sa),t=v.total;
 by('comp-kpis').innerHTML=[['Unit Entry',num(t.ue)],['CPUS',num(t.cpus)],['Revenue',money(t.revenue)],['REV / UNIT',money(t.cpus?t.revenue/t.cpus:null)]].map(([k,val])=>'<div><span>'+k+'</span><strong>'+val+'</strong></div>').join('');
 const cats=CATEGORIES.map(k=>[k,t.categories[k]||0]);if(t.categories['BELUM TERPETAKAN'])cats.push(['BELUM TERPETAKAN',t.categories['BELUM TERPETAKAN']]);by('comp-category').innerHTML=pie(cats);
 by('comp-trend').innerHTML=line(v.labels,[{name:'CPUS',values:v.slots.map(s=>s.cpus)},{name:'UE',values:v.slots.map(s=>s.ue)},{name:'Target CPUS TAM'+(sa==='ALL'?'':' / 3'),values:v.target}],v.visible);
 by('comp-type').innerHTML=typeBars(sorted(t.types));by('comp-damage').innerHTML=bars([['LIGHT',t.light],['MEDIUM',t.medium],['HEAVY',t.heavy],['BELUM TERPETAKAN',t.unknownRepair]]);by('comp-insurance').innerHTML=bars(sorted(t.insurers));
 const selected=by('comp-insurer').value;by('comp-insurer').innerHTML='<option value="ALL">Semua asuransi</option>'+sorted(t.insurers).map(([n])=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');if(Object.hasOwn(t.insurers,selected))by('comp-insurer').value=selected;
 renderInsurance(v);for(const [id,key]of [['labor','labor'],['parts','parts'],['revenue','revenue'],['revunit','revUnit']])by('comp-'+id).innerHTML=line(v.labels,[{name:key==='revUnit'?'Rp / CPUS':'Rupiah',values:v.slots.map(s=>key==='revUnit'?(s.cpus?s.revenue/s.cpus:null):s[key])}],v.visible);
 by('comp-status').textContent=mode+' '+(mode==='MTD'?MONTHS[month-1]:'Jan–'+MONTHS[month-1])+' '+year+' · '+(sa==='ALL'?'Semua SA':sa)+' · Data sampai '+data.detail.asOf+(t.unknownRepair?' · '+t.unknownRepair+' UE belum memiliki kategori kerusakan.':'');
}
function renderInsurance(v){v=v||aggregate(data.detail,+by('comp-year').value,+by('comp-month').value,mode,by('comp-sa').value);const insurer=by('comp-insurer').value;const names=insurer==='ALL'?sorted(v.total.insurers).slice(0,5).map(e=>e[0]):[insurer];by('comp-insurance-trend').innerHTML=names.length?line(v.labels,names.map(name=>({name,values:v.slots.map(s=>s.insurers[name]||0)})),v.visible)+(insurer==='ALL'?'<p class="comp-note">Lima asuransi terbesar; pilih nama untuk melihat asuransi lainnya.</p>':''):empty();}
async function load(refresh){if(loading)return;loading=true;by('comp-refresh').disabled=true;by('comp-status').textContent='Mengambil data komposisi...';try{if(!root.KPI_SA_API_URL)throw Error('URL API KPI belum diatur.');const u=new URL(root.KPI_SA_API_URL);u.searchParams.set('year',by('comp-year').value);if(refresh)u.searchParams.set('refresh','1');const next=await jsonp(u.toString());if(!next.success)throw Error(next.error||'API gagal.');if(!next.detail?.compositionVersion)throw Error('Deploy API komposisi versi terbaru, lalu klik Perbarui data.');data=next;render();}catch(e){by('comp-status').textContent=e.message+(data?' Data sebelumnya tetap ditampilkan.':'');}finally{loading=false;by('comp-refresh').disabled=false;}}
nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const comp=button.dataset.perfTab==='composition';old.hidden=comp;section.hidden=!comp;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b===button)));if(comp&&!data)load(false);}));
['comp-sa','comp-month'].forEach(id=>by(id).addEventListener('change',render));by('comp-year').addEventListener('change',()=>load(false));by('comp-refresh').addEventListener('click',()=>load(true));by('comp-insurer').addEventListener('change',()=>{if(data)renderInsurance();});section.querySelectorAll('[data-comp-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.compMode;section.querySelectorAll('[data-comp-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();}));
})(typeof window==='undefined'?globalThis:window);
