(function(){
  'use strict';
  var API='https://script.google.com/macros/s/AKfycbxX3UnuRwNcYWpGhyWsz-WVopHttb3tM5Qe381lLSdPR7gkeHjKJrExFxmByYem1Toz/exec';
  var data={headers:[],rows:[]},page=0,size=100,loading=false;
  function el(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function render(){
    var query=el('logSearch').value.trim().toLowerCase();
    var rows=data.rows.filter(function(r){return !query||r.values.some(function(v){return String(v).toLowerCase().indexOf(query)>=0})});
    var pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages-1);
    el('logHead').innerHTML='<tr><th>BARIS SHEET</th>'+data.headers.map(function(h){return '<th>'+esc(h)+'</th>'}).join('')+'</tr>';
    el('logBody').innerHTML=rows.slice(page*size,(page+1)*size).map(function(r){return '<tr><td>'+esc(r.sheetRow)+'</td>'+data.headers.map(function(_,i){return '<td>'+esc(r.values[i])+'</td>'}).join('')+'</tr>'}).join('')||'<tr><td class="log-empty" colspan="'+(data.headers.length+1)+'">'+(query?'Tidak ada log yang cocok.':'Sheet LOG belum berisi data.')+'</td></tr>';
    el('logPage').textContent=(page+1)+' / '+pages+' • '+rows.length+' log';
    el('logPrev').disabled=page===0;el('logNext').disabled=page>=pages-1;
  }
  function load(){
    if(loading)return;loading=true;el('logRefresh').disabled=true;el('logStatus').classList.remove('log-error');el('logStatus').textContent='Memuat sheet LOG…';
    var cb='sheet_log_'+Date.now(),script=document.createElement('script'),timer;
    function finish(err,j){
      clearTimeout(timer);script.remove();delete window[cb];loading=false;el('logRefresh').disabled=false;
      if(err){el('logStatus').classList.add('log-error');el('logStatus').textContent='LOG gagal dimuat: '+err;return}
      data=j;page=0;render();el('logStatus').textContent=j.rows.length+' log • Baris terbaru di atas • Diperbarui '+new Date().toLocaleString('id-ID');
    }
    window[cb]=function(j){if(!j||j.success===false)return finish(j&&j.error||'Respons API tidak valid');if(j.sheet!=='LOG'||!Array.isArray(j.headers)||!Array.isArray(j.rows)||j.rows.some(function(r){return !Array.isArray(r.values)}))return finish('API belum mendukung sheet LOG');finish(null,j)};
    script.onerror=function(){finish('Tidak dapat menghubungi API')};timer=setTimeout(function(){finish('Timeout API')},30000);
    script.src=API+'?action=log&callback='+cb+'&_='+Date.now();document.head.appendChild(script);
  }
  el('logSearch').addEventListener('input',function(){page=0;render()});el('logRefresh').onclick=load;
  el('logPrev').onclick=function(){page--;render()};el('logNext').onclick=function(){page++;render()};
  if(DMSAuth.isLoggedIn()&&DMSAuth.canAccess(location.pathname))load();
})();
