(() => {
"use strict";
const API="https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec";
const REDO_API="https://script.google.com/macros/s/AKfycbzW_1V3ickfa1PVCEWtvem8PN8xTh9ho9nv-jKzogbIeL3n2slWwLzkjZuuPQgz2dII/exec";
const QC_API="https://script.google.com/macros/s/AKfycbxX3UnuRwNcYWpGhyWsz-WVopHttb3tM5Qe381lLSdPR7gkeHjKJrExFxmByYem1Toz/exec";
let units=[], charts={};

const $=id=>document.getElementById(id);
function norm(v){return String(v??"").trim().toUpperCase();}
function num(v){const n=Number(String(v??"").replace(/[^\d.-]/g,""));return Number.isFinite(n)?n:0;}
function parseDate(v){
  if(!v)return null;
  if(v instanceof Date)return new Date(v.getFullYear(),v.getMonth(),v.getDate());
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m)return new Date(+m[3],+m[2]-1,+m[1]);
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m)return new Date(+m[1],+m[2]-1,+m[3]);
  const d=new Date(s); return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
}
function days(a,b){return Math.round((a-b)/86400000);}
function keyDate(d){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`:"";}
function fmt(n){return new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(n);}
function avg(n){return Number(n||0).toFixed(2);}
async function getJson(url){
  const r=await fetch(url,{cache:"no-store"}); if(!r.ok)throw new Error("HTTP "+r.status);
  return await r.json();
}
function pickRows(x){
  if(Array.isArray(x))return x;
  for(const k of ["data","units","rows","result"]){if(Array.isArray(x?.[k]))return x[k];}
  return [];
}
function getField(u,names){for(const n of names){if(u[n]!==undefined&&u[n]!==null&&String(u[n]).trim()!=="")return u[n];}return "";}
function isExcludedProgress(p){const x=norm(p).replace(/\s+/g,"");return !x||x==="17.DELIVERY"||x==="20.BILLING";}
function calculateLeadtime(rows,month,year){
  const cats={LIGHT:{count:0,sum:0,rows:[]},MEDIUM:{count:0,sum:0,rows:[]},HEAVY:{count:0,sum:0,rows:[]}};
  rows.forEach(u=>{
    const start=parseDate(getField(u,["TGL PKB","TANGGAL CETAK PKB","TGL CETAK PKB","TGLPKB"]));
    const end=parseDate(getField(u,["TANGGAL SELESAI","TGL SELESAI","TANGGAL SELESAI ACTUAL","TGL SELESAI ACTUAL","ACTUAL OUT","TANGGAL UNIT OUT","TGL UNIT OUT","TANGGAL DELIVERY","TGL DELIVERY"]));
    if(!start||!end)return;
    if(end<start)return;
    // Periode report berdasarkan TGL PKB, konsisten dengan performance API.
    if(start.getMonth()!==month||start.getFullYear()!==year)return;
    const cat=norm(getField(u,["KATEGORI","CATEGORY"]));
    if(!cats[cat])return;
    const lt=days(end,start);
    cats[cat].count++; cats[cat].sum+=lt;
    cats[cat].rows.push({u,start,end,lt});
  });
  const all=Object.values(cats);const totalUnit=all.reduce((s,x)=>s+x.count,0),totalSum=all.reduce((s,x)=>s+x.sum,0);
  return {cats,totalUnit,totalSum,totalAvg:totalUnit?totalSum/totalUnit:0,rows:all.flatMap(x=>x.rows).sort((a,b)=>b.start-a.start)};
}
function periodRows(month,year){
  return units.filter(u=>{const d=parseDate(getField(u,["TGL PKB","TANGGAL PKB"]));return d&&d.getMonth()===month&&d.getFullYear()===year;});
}
function wipRows(){return units.filter(u=>!isExcludedProgress(getField(u,["PROGRESS"])));}
function renderKpi(lead,pr){
  $("kIn").textContent=fmt(pr.length);
  const out=lead.rows.length; $("kOut").textContent=fmt(out);
  $("kWip").textContent=fmt(wipRows().length);
  const today=new Date();today.setHours(0,0,0,0);
  const overdue=wipRows().filter(u=>{const d=parseDate(getField(u,["JANJI SELESAI","TANGGAL SELESAI"]));return d&&d<today;}).length;
  $("kOverdue").textContent=fmt(overdue); $("kInap").textContent=fmt(wipRows().length);
  $("kLead").textContent=avg(lead.totalAvg)+" hari";
  $("kRedo").textContent="—"; $("kQc").textContent="—";
}
function destroy(name){if(charts[name]){charts[name].destroy();delete charts[name];}}
function chart(name,id,type,data,options={}){
  destroy(name); const ctx=$(id); if(!ctx)return;
  charts[name]=new Chart(ctx,{type,data,options:{responsive:true,maintainAspectRatio:false,...options}});
}
function renderTrend(pr,month,year){
  const daysIn=new Date(year,month+1,0).getDate(), labels=Array.from({length:daysIn},(_,i)=>String(i+1).padStart(2,"0"));
  const cin=Array(daysIn).fill(0),cout=Array(daysIn).fill(0);
  pr.forEach(u=>{const d=parseDate(getField(u,["TGL PKB"]));if(d)cin[d.getDate()-1]++;});
  // OUT memakai leadtime rows karena hanya completion dengan start yang valid.
  calculateLeadtime(units,month,year).rows.forEach(x=>cout[x.end.getDate()-1]++);
  chart("trend","trendChart","line",{labels,datasets:[{label:"UNIT IN",data:cin,tension:.25},{label:"UNIT OUT",data:cout,tension:.25}]},{plugins:{legend:{position:"top"}}});
}
function renderWip(){
  const groups={"ATU 1":0,"ATU 2":0,"WIP BENGKEL":0};
  wipRows().forEach(u=>{const g=norm(getField(u,["GROUP","GRUP"])).replace(/\s+/g," ");if(g==="ATU 1"||g==="ATU 2")groups[g]++;else groups["WIP BENGKEL"]++;});
  chart("wip","wipChart","bar",{labels:Object.keys(groups),datasets:[{label:"UNIT",data:Object.values(groups)}]},{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}});
}
function renderProcess(){
  const map={};wipRows().forEach(u=>{const p=String(getField(u,["PROGRESS"])).trim();if(p)map[p]=(map[p]||0)+1;});
  const arr=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12);
  chart("process","processChart","bar",{labels:arr.map(x=>x[0]),datasets:[{label:"WIP",data:arr.map(x=>x[1])}]},{indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}});
}
function renderLead(lead){
  $("leadTable").querySelector("tbody").innerHTML=[
    ["LIGHT",lead.cats.LIGHT],["MEDIUM",lead.cats.MEDIUM],["HEAVY",lead.cats.HEAVY],
    ["TOTAL", {count:lead.totalUnit,sum:lead.totalSum,avg:lead.totalAvg}]
  ].map(([c,x])=>`<tr><td><b>${c}</b></td><td>${fmt(x.count)}</td><td>${fmt(x.sum)}</td><td><b>${avg(x.avg)} hari</b></td></tr>`).join("");
  chart("lead","leadChart","bar",{labels:["LIGHT","MEDIUM","HEAVY"],datasets:[{label:"Rata-rata hari",data:["LIGHT","MEDIUM","HEAVY"].map(c=>lead.cats[c].count?lead.cats[c].sum/lead.cats[c].count:0)}]},{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}});
}
function renderDetails(rows){
  const q=norm($("leadSearch").value).replace(/\s+/g,"");
  const body=$("detailTable").querySelector("tbody");
  body.innerHTML=rows.filter(x=>{const u=x.u;const hay=norm(getField(u,["NO POLISI"])).replace(/\s+/g,"")+" "+norm(getField(u,["NO PKB"]));return !q||hay.includes(q);}).slice(0,500).map(x=>{
    const u=x.u;return `<tr><td>${getField(u,["NO POLISI"])||"-"}</td><td>${getField(u,["NO PKB"])||"-"}</td><td>${getField(u,["KATEGORI"])||"-"}</td><td>${getField(u,["GROUP","GRUP"])||"-"}</td><td>${getField(u,["SA"])||"-"}</td><td>${keyDate(x.start).split("-").reverse().join("/")}</td><td>${keyDate(x.end).split("-").reverse().join("/")}</td><td><b>${x.lt} hari</b></td></tr>`;
  }).join("")||`<tr><td colspan="8" style="text-align:center">Tidak ada data leadtime.</td></tr>`;
}
function downloadCsv(lead){
  const lines=[["KATEGORI","UNIT","TOTAL HARI","RATA-RATA HARI"],["LIGHT",lead.cats.LIGHT.count,lead.cats.LIGHT.sum,avg(lead.cats.LIGHT.sum/(lead.cats.LIGHT.count||1))],["MEDIUM",lead.cats.MEDIUM.count,lead.cats.MEDIUM.sum,avg(lead.cats.MEDIUM.sum/(lead.cats.MEDIUM.count||1))],["HEAVY",lead.cats.HEAVY.count,lead.cats.HEAVY.sum,avg(lead.cats.HEAVY.sum/(lead.cats.HEAVY.count||1))],["TOTAL",lead.totalUnit,lead.totalSum,avg(lead.totalAvg)]];
  const csv="\ufeff"+lines.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="dashboard-leadtime.csv";a.click();
}
async function load(){
  const month=+$("month").value,year=+$("year").value;
  $("status").textContent="Mengambil DATABASE UNIT...";
  try{
    const res=await getJson(API+"?action=unit&t="+Date.now()); units=pickRows(res);
    const pr=periodRows(month-1,year),lead=calculateLeadtime(units,month-1,year);
    renderKpi(lead,pr);renderTrend(pr,month-1,year);renderWip();renderProcess();renderLead(lead);renderDetails(lead.rows);
    $("lastUpdate").textContent="Update "+new Date().toLocaleTimeString("id-ID");
    $("status").textContent=`Data ${String(month).padStart(2,"0")}/${year} • ${fmt(units.length)} unit terbaca • Leadtime dihitung dari TGL PKB → TANGGAL SELESAI.`;
    window.__dashboardLead=lead;
  }catch(e){$("status").textContent="Gagal memuat data: "+e.message;console.error(e);}
}
function init(){
  const now=new Date(),m=$("month"),y=$("year");
  ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].forEach((x,i)=>m.insertAdjacentHTML("beforeend",`<option value="${i+1}">${x}</option>`));
  for(let yy=now.getFullYear()-2;yy<=now.getFullYear()+1;yy++)y.insertAdjacentHTML("beforeend",`<option>${yy}</option>`);
  m.value=now.getMonth()+1;y.value=now.getFullYear();
  $("refreshBtn").onclick=load;$("csvBtn").onclick=()=>window.__dashboardLead&&downloadCsv(window.__dashboardLead);$("leadSearch").oninput=()=>window.__dashboardLead&&renderDetails(window.__dashboardLead.rows);load();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();