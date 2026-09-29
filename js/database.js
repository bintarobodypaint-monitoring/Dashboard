(function(){
'use strict';

const PRIMARY_API_URL='https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec';
const LEGACY_API_URL='https://script.google.com/macros/s/AKfycbw4DNX95MfrMfq7Uisd2r1EQXhMQ3xIY9AE8SNv00TaT5LTIO_bQU8FpRDcz5-p9ao/exec';
const EXCEL_PASSWORD='BintaroBP123';
const PAGE_SIZE=100;
const DATE_FIELDS=['TGL CETAK PKB','TANGGAL CETAK PKB','TGL PKB'];

let rawRows=[];
let headers=[];
let dateField='';
let filteredRows=[];
let currentPage=1;
let toastTimer=null;

const $=id=>document.getElementById(id);
const el={
 monthFrom:$('monthFrom'),monthTo:$('monthTo'),search:$('searchInput'),
 apply:$('applyBtn'),refresh:$('refreshBtn'),excel:$('excelBtn'),
 head:$('tableHead'),body:$('tableBody'),filteredCount:$('filteredCount'),
 showing:$('showingLabel'),loadInfo:$('loadInfo'),pageLabel:$('pageLabel'),
 prev:$('prevBtn'),next:$('nextBtn'),status:$('status'),apiState:$('apiState'),
 rangeLabel:$('rangeLabel'),dateFieldLabel:$('dateFieldLabel'),toast:$('toast')
};

function getApiCandidates(){
  let stored=[];
  try{stored=[localStorage.getItem('DATABASE_API_URL'),localStorage.getItem('DASHBOARD_API_URL')]}catch(_){/* Storage may be disabled. */}
  const list=[PRIMARY_API_URL,window.DATABASE_API_URL,window.DASHBOARD_API_URL,...stored,LEGACY_API_URL]
    .map(v=>String(v||'').trim()).filter(Boolean);
  return [...new Set(list)];
}
function setStatus(msg,error){
  el.status.textContent=msg;
  el.apiState.textContent=error?'API ERROR':'DATABASE UNIT';
  el.apiState.style.color=error?'#b42318':'#175cd3';
}
function showToast(msg){
  el.toast.textContent=msg;el.toast.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2600);
}
function pad2(n){return String(n).padStart(2,'0')}
function monthValue(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)}
function initMonthRange(){
  const now=new Date();
  const cur=monthValue(now);
  el.monthFrom.value=cur;
  el.monthTo.value=cur;
}
function normalizeHeader(v){return String(v==null?'':v).trim().toUpperCase()}
function pickDateField(){
  const set=new Set(headers.map(normalizeHeader));
  dateField=DATE_FIELDS.find(x=>set.has(x))||'';
  el.dateFieldLabel.textContent=dateField?('Filter: '+dateField):'Kolom tanggal tidak ditemukan';
}
function parseSheetDate(value){
  if(value==null||value==='')return null;
  if(value instanceof Date && !isNaN(value))return value;
  if(typeof value==='number'&&isFinite(value)){
    // Excel/Sheets serial date fallback.
    const ms=Math.round((value-25569)*86400*1000);
    const d=new Date(ms);return isNaN(d)?null:d;
  }
  const s=String(value).trim();
  if(!s)return null;
  const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+.*)?$/);
  if(m){const d=new Date(+m[3],+m[2]-1,+m[1]);return isNaN(d)?null:d;}
  const ym=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if(ym){const d=new Date(+ym[1],+ym[2]-1,+ym[3]);return isNaN(d)?null:d;}
  const d=new Date(s);return isNaN(d)?null:d;
}
function safeText(v){
  if(v==null)return '';
  if(typeof v==='object'){
    if(v instanceof Date)return formatDate(v);
    try{return JSON.stringify(v)}catch(_){return String(v)}
  }
  return String(v);
}
function formatDate(v){
  const d=parseSheetDate(v);if(!d)return safeTextRaw(v);
  return pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear();
}
function safeTextRaw(v){return v==null?'':String(v)}
function escapeHtml(s){return safeText(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function monthBounds(){
  if(!el.monthFrom.value||!el.monthTo.value)throw new Error('Pilih BULAN AWAL dan BULAN AKHIR.');
  if(el.monthFrom.value>el.monthTo.value)throw new Error('BULAN AWAL tidak boleh melewati BULAN AKHIR.');
  const [fy,fm]=el.monthFrom.value.split('-').map(Number);
  const [ty,tm]=el.monthTo.value.split('-').map(Number);
  return {start:new Date(fy,fm-1,1),end:new Date(ty,tm,1),from:el.monthFrom.value,to:el.monthTo.value};
}
function getDateValue(row){
  if(!dateField)return null;
  return row[dateField] ?? row[Object.keys(row).find(k=>normalizeHeader(k)===dateField)] ?? null;
}
function filterData(resetPage=true){
  try{
    const b=monthBounds();
    const q=el.search.value.trim().toUpperCase();
    filteredRows=rawRows.filter(row=>{
      const d=parseSheetDate(getDateValue(row));
      if(!d||d<b.start||d>=b.end)return false;
      if(!q)return true;
      return headers.some(h=>safeText(row[h]).toUpperCase().includes(q));
    });
    if(resetPage)currentPage=1;
    const fromLabel=b.from.split('-').reverse().join('/');
    const toLabel=b.to.split('-').reverse().join('/');
    el.rangeLabel.textContent='Periode '+fromLabel+' s.d. '+toLabel+(q?' • pencarian aktif':'');
    render();
  }catch(err){showToast(err.message);setStatus(err.message,true)}
}
function render(){
  const pages=Math.max(1,Math.ceil(filteredRows.length/PAGE_SIZE));
  if(currentPage>pages)currentPage=pages;
  const start=(currentPage-1)*PAGE_SIZE;
  const rows=filteredRows.slice(start,start+PAGE_SIZE);
  el.filteredCount.textContent=filteredRows.length.toLocaleString('id-ID');
  el.showing.textContent=filteredRows.length?('Menampilkan '+(start+1)+'–'+(start+rows.length)+' dari '+filteredRows.length.toLocaleString('id-ID')):'0 data';
  el.pageLabel.textContent='Halaman '+currentPage+' / '+pages;
  el.prev.disabled=currentPage<=1;el.next.disabled=currentPage>=pages;
  el.loadInfo.textContent=rawRows.length.toLocaleString('id-ID')+' total baris DATABASE UNIT';
  if(!headers.length){el.head.innerHTML='<tr><th>DATABASE UNIT</th></tr>';el.body.innerHTML='<tr><td class="empty">Data belum tersedia.</td></tr>';return;}
  el.head.innerHTML='<tr>'+headers.map(h=>'<th title="'+escapeHtml(h)+'">'+escapeHtml(h)+'</th>').join('')+'</tr>';
  if(!rows.length){el.body.innerHTML='<tr><td class="empty" colspan="'+headers.length+'">Tidak ada data pada rentang bulan/filter ini.</td></tr>';return;}
  el.body.innerHTML=rows.map(row=>'<tr>'+headers.map(h=>{
    const val=row[h];
    const txt=normalizeHeader(h).includes('TGL')||normalizeHeader(h).includes('TANGGAL')?formatDate(val):safeText(val);
    return '<td title="'+escapeHtml(txt)+'">'+escapeHtml(txt||'-')+'</td>';
  }).join('')+'</tr>').join('');
}
function fetchJsonp(api){
  return new Promise((resolve,reject)=>{
    const cb='DMS_DATABASE_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    let done=false;
    const cleanup=()=>{try{delete window[cb]}catch(_){window[cb]=undefined}script.remove()};
    const fail=err=>{if(done)return;done=true;clearTimeout(timer);cleanup();reject(err)};
    const timer=setTimeout(()=>fail(new Error('JSONP timeout setelah 70 detik')),70000);
    window[cb]=data=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(data)};
    script.onerror=()=>fail(new Error('Script JSONP gagal dimuat'));
    script.onload=()=>{if(!done)setTimeout(()=>fail(new Error('API tidak memanggil callback JSONP')),0)};
    const url=new URL(api);
    url.searchParams.set('action','unit');
    url.searchParams.set('callback',cb);
    url.searchParams.set('_',Date.now());
    script.async=true;script.src=url.toString();document.head.appendChild(script);
  });
}
async function fetchOneApi(api){
  let data;
  try{data=await fetchJsonp(api)}
  catch(jsonpError){
    if(/timeout/i.test(String(jsonpError&&jsonpError.message)))throw jsonpError;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const url=new URL(api);url.searchParams.set('action','unit');url.searchParams.set('_',Date.now());
      const res=await fetch(url.toString(),{method:'GET',cache:'no-store',signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      data=await res.json();
    }catch(fetchError){throw new Error('JSONP: '+jsonpError.message+' | fetch: '+(fetchError.name==='AbortError'?'timeout':fetchError.message))}
    finally{clearTimeout(timer)}
  }
  if(!data||data.success!==true)throw new Error((data&&(data.error||data.message))||'Response action=unit tidak valid');
  return data;
}
async function fetchUnits(){
  const candidates=getApiCandidates();
  if(!candidates.length)throw new Error('URL API Database kosong.');
  const errors=[];
  for(const api of candidates){
    try{
      const data=await fetchOneApi(api);
      const rows=Array.isArray(data.data)?data.data:[];
      if(!rows.length && Number(data.total||0)>0)throw new Error('API menyatakan ada data tetapi array data kosong');
      window.__DATABASE_ACTIVE_API=api;
      return rows;
    }catch(err){
      errors.push(api.replace(/\/s\/[^/]+\/exec.*/,'/s/[deployment]/exec')+' → '+String(err&&err.message||err));
    }
  }
  console.error('DATABASE API attempts:',errors);
  throw new Error('Semua endpoint action=unit gagal: '+errors.join(' | ').slice(0,350));
}
async function loadData(){
  el.refresh.disabled=true;el.apply.disabled=true;el.excel.disabled=true;
  setStatus('Mengambil DATABASE UNIT...',false);el.apiState.textContent='MEMUAT...';
  try{
    rawRows=await fetchUnits();
    headers=rawRows.length?Object.keys(rawRows[0]):[];
    pickDateField();
    if(!dateField)throw new Error('Kolom TGL CETAK PKB / TGL PKB tidak ditemukan pada DATABASE UNIT.');
    setStatus('DATABASE UNIT berhasil dimuat: '+rawRows.length.toLocaleString('id-ID')+' baris • API aktif terhubung.',false);
    filterData(true);
    showToast('DATABASE UNIT berhasil dimuat');
  }catch(err){
    console.error('DATABASE UNIT load error:',err);
    rawRows=[];headers=[];filteredRows=[];render();
    setStatus('Gagal memuat data: '+(err.name==='AbortError'?'API timeout':err.message),true);
    showToast('Gagal memuat DATABASE UNIT');
  }finally{el.refresh.disabled=false;el.apply.disabled=false;el.excel.disabled=false;}
}
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=src;s.async=true;
    s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('Gagal memuat library Excel.'))};
    document.head.appendChild(s);
  });
}
async function ensureXlsxPopulate(){
  if(window.XlsxPopulate)return window.XlsxPopulate;
  try{await loadScript('https://cdn.jsdelivr.net/npm/xlsx-populate@1.21.0/browser/xlsx-populate.min.js');}
  catch(_){await loadScript('https://unpkg.com/xlsx-populate@1.21.0/browser/xlsx-populate.min.js');}
  if(!window.XlsxPopulate)throw new Error('Library Excel terenkripsi tidak tersedia.');
  return window.XlsxPopulate;
}
function columnLetter(n){
  let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s;
}
function excelValue(h,v){
  const key=normalizeHeader(h);
  if((key.includes('TGL')||key.includes('TANGGAL'))&&v){
    const d=parseSheetDate(v);if(d)return d;
  }
  if(v==null)return '';
  if(typeof v==='object')return safeText(v);
  return v;
}
async function exportExcel(){
  if(!filteredRows.length){showToast('Tidak ada data untuk diexport.');return;}
  el.excel.disabled=true;el.excel.textContent='MEMBUAT EXCEL...';
  try{
    const XP=await ensureXlsxPopulate();
    const wb=await XP.fromBlankAsync();
    const sh=wb.sheet(0).name('DATABASE UNIT');
    const matrix=[headers].concat(filteredRows.map(r=>headers.map(h=>excelValue(h,r[h]))));
    sh.cell('A1').value(matrix);
    const endCol=columnLetter(headers.length);
    sh.range('A1:'+endCol+'1').style({bold:true,fill:'D71920',fontColor:'FFFFFF',horizontalAlignment:'center',verticalAlignment:'center'});
    sh.range('A1:'+endCol+(matrix.length)).style({border:true,fontFamily:'Arial',fontSize:9,verticalAlignment:'center'});
    sh.row(1).height(24);
    headers.forEach((h,i)=>{
      let max=Math.max(10,String(h).length+2);
      for(let r=0;r<Math.min(filteredRows.length,300);r++)max=Math.max(max,Math.min(32,safeText(filteredRows[r][h]).length+2));
      sh.column(i+1).width(Math.min(32,max));
    });
    // Agile XLSX encryption. Password diminta saat file dibuka di Excel.
    const blob=await wb.outputAsync({password:EXCEL_PASSWORD});
    const b=monthBounds();
    const name='DATABASE_UNIT_'+b.from+'_sd_'+b.to+'.xlsx';
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    showToast('Excel terenkripsi berhasil dibuat');
  }catch(err){
    console.error(err);showToast('Export Excel gagal: '+err.message);setStatus('Export Excel gagal: '+err.message,true);
  }finally{el.excel.disabled=false;el.excel.textContent='⇩ DOWNLOAD EXCEL';}
}

el.apply.addEventListener('click',()=>filterData(true));
el.refresh.addEventListener('click',loadData);
el.excel.addEventListener('click',exportExcel);
el.search.addEventListener('input',()=>filterData(true));
el.monthFrom.addEventListener('change',()=>filterData(true));
el.monthTo.addEventListener('change',()=>filterData(true));
el.prev.addEventListener('click',()=>{if(currentPage>1){currentPage--;render()}});
el.next.addEventListener('click',()=>{const p=Math.max(1,Math.ceil(filteredRows.length/PAGE_SIZE));if(currentPage<p){currentPage++;render()}});

initMonthRange();
loadData();
})();
