(function(){
  'use strict';
  const API = (window.JPCB_API_URL || 'https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec');
  let dbRows = null;
  let loading = false;

  function s(v){ return String(v == null ? '' : v).trim(); }
  function norm(v){ return s(v).toUpperCase().replace(/\s+/g,' '); }
  function parseDate(raw){
    if(raw instanceof Date && !isNaN(raw)) return new Date(raw.getFullYear(),raw.getMonth(),raw.getDate());
    const x=s(raw); if(!x || x==='-') return null;
    let m=x.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if(m) return new Date(+m[3],+m[2]-1,+m[1]);
    m=x.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if(m) return new Date(+m[1],+m[2]-1,+m[3]);
    const d=new Date(x); if(!isNaN(d)) return new Date(d.getFullYear(),d.getMonth(),d.getDate());
    return null;
  }
  function today(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
  function overdueDays(raw){ const d=parseDate(raw), t=today(); return d && d<t ? Math.floor((t-d)/86400000) : 0; }
  function dueLabel(raw){ const d=parseDate(raw); return d ? String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear() : '-'; }
  function esc(v){ const el=document.createElement('div'); el.textContent=s(v); return el.innerHTML; }
  function isExcludedProgress(p){
    const n=norm(p);
    return !n || n==='17.DELIVERY' || n==='17.DELIVERY ' || n==='20.BILLING';
  }
  function getRows(){
    if(!Array.isArray(dbRows)) return [];
    const seen={}; const out=[];
    dbRows.forEach(function(r){
      r=r||{};
      const due=r['JANJI SELESAI'] ?? r.janjiSelesai ?? r.JANJISELESAI;
      const progress=r['PROGRESS'] ?? r.progress ?? '';
      const days=overdueDays(due);
      if(!days || isExcludedProgress(progress)) return;
      const nopol=s(r['NO POLISI'] ?? r.nopol ?? r.NOPOL);
      const pkb=s(r['NO PKB'] ?? r.noPKB ?? r.NOPKB ?? r.pkb);
      if(!nopol && !pkb) return;
      const key=norm(nopol)+'|'+norm(pkb);
      if(seen[key]) return; seen[key]=1;
      out.push({
        nopol:nopol||'-', pkb:pkb||'-', type:s(r['TYPE'] ?? r.type),
        group:norm(r['GROUP'] ?? r.group), sa:s(r['SA'] ?? r.sa),
        progress:s(progress), due:due, days:days
      });
    });
    out.sort((a,b)=> (a.group||'').localeCompare(b.group||'') || b.days-a.days);
    return out;
  }
  function renderTable(id, rows){
    const body=document.getElementById(id); if(!body) return;
    if(!rows.length){ body.innerHTML='<tr><td class="overdue-empty" colspan="7">Tidak ada unit terlambat</td></tr>'; return; }
    body.innerHTML=rows.map(function(u){
      return '<tr class="overdue-db-row" data-nopol="'+esc(u.nopol)+'" data-pkb="'+esc(u.pkb)+'">'+
        '<td><b>'+esc(u.nopol)+'</b><small>'+esc(u.pkb)+'</small></td>'+
        '<td>'+esc(u.type||'-')+'</td>'+
        '<td>'+esc(u.sa||'-')+'</td>'+
        '<td>'+esc((window.jpcbDisplayName?window.jpcbDisplayName(u.progress):u.progress)||'-')+'</td>'+
        '<td>'+esc(dueLabel(u.due))+'</td>'+
        '<td><b class="late-pill '+(u.days>=7?'severe':'')+'">'+u.days+' HARI</b></td>'+ 
        '<td>'+esc(u.group||'-')+'</td>'+
      '</tr>';
    }).join('');
    body.querySelectorAll('.overdue-db-row').forEach(function(tr){
      tr.addEventListener('click',function(){
        const n=tr.dataset.nopol||'', p=tr.dataset.pkb||'';
        if(typeof window.openJpcbUnitDetail==='function') window.openJpcbUnitDetail({nopol:n,noPKB:p});
      });
    });
  }
  function render(){
    const rows=getRows();
    const a1=rows.filter(u=>norm(u.group)==='ATU 1' || norm(u.group)==='ATU1');
    const a2=rows.filter(u=>norm(u.group)==='ATU 2' || norm(u.group)==='ATU2');
    const other=rows.filter(u=>!a1.includes(u)&&!a2.includes(u));
    const total=document.getElementById('overdueTotal'); if(total) total.textContent=rows.length;
    const c1=document.getElementById('overdueAtu1'); if(c1)c1.textContent=a1.length;
    const c2=document.getElementById('overdueAtu2'); if(c2)c2.textContent=a2.length;
    const h1=document.getElementById('overdueAtu1Count'); if(h1)h1.textContent=a1.length+' UNIT';
    const h2=document.getElementById('overdueAtu2Count'); if(h2)h2.textContent=(a2.length+other.length)+' UNIT';
    renderTable('overdueAtu1Body',a1);
    renderTable('overdueAtu2Body',a2.concat(other));
    const status=document.getElementById('overdueDataSource'); if(status) status.textContent='Sumber: DATABASE UNIT • JANJI SELESAI < hari ini • WIP aktif';
  }
  async function load(){
    if(loading)return; loading=true;
    try{
      const r=await fetch(API+'?action=unit&ts='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const d=await r.json();
      if(!d || d.success===false) throw new Error(d&&d.message||'Data tidak valid');
      dbRows=Array.isArray(d.data)?d.data:[];
      render();
      const st=document.getElementById('overdueApiStatus'); if(st)st.textContent='● Terhubung • '+new Date().toLocaleTimeString('id-ID');
    }catch(e){
      console.error('Overdue DATABASE UNIT:',e);
      const st=document.getElementById('overdueApiStatus'); if(st)st.textContent='● Gagal mengambil DATABASE UNIT';
    }finally{loading=false;}
  }

  // Override the old JPCB-derived overdue renderer without changing jpcb-core.js.
  window.renderJpcbOverdue=function(){ if(dbRows) render(); };
  window.__OVERDUE_DB_SOURCE__=true;
  document.addEventListener('DOMContentLoaded',function(){
    load();
    setInterval(load,15000);
  });
})();
