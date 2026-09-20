(function(){
'use strict';
const API=(window.JPCB_API_URL||'https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec');
let rows=[]; let zoom=1;

const slots={
  'PANEL REPAIR':[
    [54.2,39.8],[59.0,39.8],[63.4,39.8],[67.6,39.8],[71.2,39.8]
  ],
  'PUTTY':[
    [58.0,24.6],[62.0,24.6],[66.0,24.6],[70.0,24.6]
  ],
  'SURFACER':[
    [75.0,24.6],[78.4,24.6]
  ],
  'PAINTING':[
    [50.7,24.6],[55.8,24.6]
  ],
  'POLISHING':[
    [73.2,48.5],[73.2,54.0],[73.2,59.3],[73.2,64.3]
  ],
  'REASSEMBLY':[
    [83.5,46.0],[85.5,51.8],[88.0,56.6],[90.8,61.0]
  ],
  'WASHING':[
    [39.8,25.0],[44.0,25.0]
  ],
  'FINAL CHECK':[[33.2,35.7]],
  'WAITING PAINTING':[[80.5,68.0]],
  'WAITING POLISH':[[85.2,68.0]],
  'WAITING REASSEMBLY':[[89.5,68.0]],
  'WAITING PANEL REPAIR':[[51.0,50.5],[57.0,50.5]],
  'JOB STOPPED':[[16.0,35.5],[20.0,35.5]],
  'RAWAT JALAN':[[16.0,43.0]],
  'ESTIMASI':[[16.0,50.0]],
  'WAITING SPK':[[22.0,50.0]]
};
function s(v){return String(v==null?'':v).trim()}
function n(v){return s(v).toUpperCase().replace(/\s+/g,' ')}
function esc(v){const d=document.createElement('div');d.textContent=s(v);return d.innerHTML}
function processGroup(p){
 const x=n(p);
 if(x.includes('PANEL REPAIR')) return x.includes('WAITING')?'WAITING PANEL REPAIR':'PANEL REPAIR';
 if(x.includes('PUTTY')||x.includes('DEMPUL')) return x.includes('WAITING')?'WAITING PUTTY':'PUTTY';
 if(x.includes('SURFACER')) return x.includes('WAITING')?'WAITING SURFACER':'SURFACER';
 if(x.includes('PAINTING')) return x.includes('WAITING')?'WAITING PAINTING':'PAINTING';
 if(x.includes('POLISH')) return x.includes('WAITING')?'WAITING POLISH':'POLISHING';
 if(x.includes('REASSEMBLY')||x.includes('RAKIT')) return x.includes('WAITING')?'WAITING REASSEMBLY':'REASSEMBLY';
 if(x.includes('WASHING')||x.includes('FINISHING')) return 'WASHING';
 if(x.includes('FINAL CHECK')||x==='15.FINAL CHECK') return 'FINAL CHECK';
 if(x.includes('JOB STOPPED')) return 'JOB STOPPED';
 if(x.includes('RAWAT')) return 'RAWAT JALAN';
 if(x.includes('ESTIMASI')) return 'ESTIMASI';
 if(x.includes('WAITING SPK')) return 'WAITING SPK';
 return '';
}
function isWip(r){
 const p=n(r['PROGRESS']||r.progress);
 return !!p && p!=='17.DELIVERY' && p!=='20.BILLING';
}
function getUnits(){
 return rows.filter(isWip).map(function(r){return {
   nopol:s(r['NO POLISI']||r.nopol), pkb:s(r['NO PKB']||r.noPKB), type:s(r.TYPE||r.type),
   group:n(r.GROUP||r.group), sa:s(r.SA||r.sa), progress:s(r.PROGRESS||r.progress), stage:processGroup(r['PROGRESS']||r.progress)
 };}).filter(x=>x.nopol||x.pkb);
}
function clearCars(){document.querySelectorAll('.denah-car').forEach(x=>x.remove());document.querySelectorAll('.denah-stall').forEach(x=>x.classList.remove('occupied'))}
function render(){
 clearCars();
 const stage=document.getElementById('denahStage'); if(!stage)return;
 const units=getUnits();
 const counts={};
 units.forEach(function(u){counts[u.stage]=(counts[u.stage]||0)+1});
 const grouped={}; units.forEach(u=>(grouped[u.stage]||(grouped[u.stage]=[])).push(u));
 Object.keys(grouped).forEach(function(stageName){
   const pos=slots[stageName]||[];
   grouped[stageName].slice(0,pos.length).forEach(function(u,i){
     const [x,y]=pos[i];
     const el=document.createElement('div'); el.className='denah-car active'; el.style.left=x+'%'; el.style.top=y+'%';
     el.innerHTML='<div class="car-shape">🚗</div><div class="car-label"><b>'+esc(u.nopol||u.pkb)+'</b><span>'+esc(u.progress)+'</span><small>'+esc(u.group||'-')+' • '+esc(u.sa||'-')+'</small></div>';
     el.title=(u.nopol||u.pkb)+' • '+u.progress;
     el.addEventListener('click',function(){if(typeof window.openJpcbUnitDetail==='function')window.openJpcbUnitDetail({nopol:u.nopol,noPKB:u.pkb,group:u.group,type:u.type,sa:u.sa,progress:u.progress});});
     stage.appendChild(el);
   });
 });
 const total=document.getElementById('denahWip'); if(total)total.textContent=units.length;
 const occ=document.getElementById('denahOccupied'); if(occ)occ.textContent=Object.values(counts).reduce((a,b)=>a+b,0);
 const st=document.getElementById('denahStatus'); if(st)st.textContent='● LIVE • '+new Date().toLocaleTimeString('id-ID');
}
async function load(){
 try{
   const r=await fetch(API+'?action=unit&ts='+Date.now(),{cache:'no-store'}); if(!r.ok)throw new Error('HTTP '+r.status);
   const d=await r.json(); if(!d||d.success===false)throw new Error(d&&d.message||'Data tidak valid');
   rows=Array.isArray(d.data)?d.data:[]; render();
 }catch(e){console.error('Denah live:',e); const st=document.getElementById('denahStatus');if(st)st.textContent='● DATA TIDAK TERHUBUNG';}
}
function setZoom(z){zoom=Math.max(.65,Math.min(1.8,z));const stage=document.getElementById('denahStage');if(stage)stage.style.setProperty('--denah-zoom',zoom);const label=document.getElementById('denahZoomLabel');if(label)label.textContent=Math.round(zoom*100)+'%';}
window.denahZoom=function(delta){setZoom(zoom+delta)};
window.denahResetZoom=function(){setZoom(1)};
window.addEventListener('DOMContentLoaded',function(){
 load(); setInterval(load,15000); setZoom(1);
});
})();
