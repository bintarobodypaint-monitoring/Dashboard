const JPCB_API_URL = 'https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec';
const JPCB_MASTER = [
  '1.WAITING PANEL REPAIR','2.PANEL REPAIR','3.WAITING PUTTY','4.PUTTY',
  '5.WAITING SURFACER','6.SURFACER','7.WAITING PAINTING','8.PAINTING',
  '9.WAITING POLISH','10.POLISHING','11.WAITING REASSEMBLY','12.REASSEMBLY',
  '13.WASHING/FINISHING','14.WAITING FINAL CHECK','15.FINAL CHECK',
  '16.WAITING DELIVERY','18.JOB STOPPED','19.RAWAT JALAN',
  '00.ESTIMASI','01.WAITING SPK'
];
function jpcbDisplayName(masterValue){ return String(masterValue).replace(/^\d+\./,''); }

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch];
  });
}

function setJpcbApiStatus(state,text){
  const dot=document.getElementById('jpcbApiDot'), label=document.getElementById('jpcbApiStatus');
  if(!dot || !label) return;
  dot.className='api-dot' + (state==='loading' ? ' loading' : state==='error' ? ' error' : '');
  label.textContent=text;
}
function field(label,value){return '<div class="profile-field"><span>'+label+'</span><strong>'+escapeHtml(value||'-')+'</strong></div>'; }
function clock(){const d=new Date(),p=n=>String(n).padStart(2,'0');const m=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];const a=document.getElementById('clockTime'),b=document.getElementById('clockDate');if(a)a.textContent=`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;if(b)b.textContent=`${p(d.getDate())} ${m[d.getMonth()]} ${d.getFullYear()}`;}setInterval(clock,1000);clock();
const JPCB_SLIDES=[
  {name:'SLIDE 1 • WAITING',processes:[
    '1.WAITING PANEL REPAIR','3.WAITING PUTTY','5.WAITING SURFACER','7.WAITING PAINTING',
    '9.WAITING POLISH','11.WAITING REASSEMBLY','14.WAITING FINAL CHECK','16.WAITING DELIVERY'
  ]},
  {name:'SLIDE 2 • PROSES',processes:[
    '2.PANEL REPAIR','4.PUTTY','6.SURFACER','8.PAINTING',
    '10.POLISHING','12.REASSEMBLY','13.WASHING/FINISHING','15.FINAL CHECK'
  ]},
  {name:'SLIDE 3 • RAWAT JALAN',rawatJalan:true}
];
let jpcbCurrentSlide=0,jpcbTickerTimer=null,jpcbSlideTimer=null;


function calculateJpcbWip(data){
  // WIP dihitung dari data WIP yang dikirim API, UNIQUE berdasarkan NO PKB.
  // PROGRESS kosong = bukan WIP. 17.Delivery = bukan WIP.
  // GROUP kosong = WIP BENGKEL.
  const wg=(data&&data.wipByGroup)||null;
  if(wg && typeof wg.total !== 'undefined'){
    return {
      total:Number(wg.total)||0,
      atu1:Number(wg.atu1)||0,
      atu2:Number(wg.atu2)||0,
      bengkel:Number(wg.bengkel)||0
    };
  }

  // Fallback untuk API lama.
  const processes=(data&&data.processes)||{};
  const byPkb={};
  Object.keys(processes).forEach(function(processName){
    const units=Array.isArray(processes[processName])?processes[processName]:[];
    units.forEach(function(unit){
      unit=unit||{};
      const pkb=String(unit.noPKB||unit.noPkb||unit.pkb||unit['NO PKB']||unit['No PKB']||'').trim().toUpperCase();
      const progress=String(unit.progress||unit.PROGRESS||unit['PROGRESS']||'').trim();
      if(!pkb || !progress)return;
      if(progress.replace(/\s+/g,'').toUpperCase()==='17.DELIVERY' || progress.replace(/\s+/g,'').toUpperCase()==='17DELIVERY')return;
      const group=String(unit.group||unit.GROUP||unit['GROUP']||'').trim().toUpperCase();
      const groupKey=group===''?'WIP BENGKEL':(group==='ATU 1'||group==='ATU1'?'ATU 1':(group==='ATU 2'||group==='ATU2'?'ATU 2':''));
      if(!groupKey)return;
      if(!byPkb[pkb] || (byPkb[pkb].group==='WIP BENGKEL' && groupKey!=='WIP BENGKEL')) byPkb[pkb]={group:groupKey};
    });
  });
  const items=Object.keys(byPkb).map(function(k){return byPkb[k];});
  return {total:items.length,atu1:items.filter(function(x){return x.group==='ATU 1';}).length,atu2:items.filter(function(x){return x.group==='ATU 2';}).length,bengkel:items.filter(function(x){return x.group==='WIP BENGKEL';}).length};
}


function jpcbKategori(unit){
  unit=unit||{};
  const values=[
    unit.kategori,unit.KATEGORI,unit.category,unit.CATEGORY,
    unit['KATEGORI'],unit['Kategori'],unit['CATEGORY'],unit['Category']
  ];
  return values.filter(function(v){return v!==undefined&&v!==null;})
    .map(function(v){return String(v).trim().toUpperCase();})
    .find(function(v){return v!=='';}) || '';
}

function isJpcbRawatJalanUnit(unit){
  // RAWAT JALAN ditentukan dari KATEGORI, bukan dari PROGRESS.
  // Semua progress tetap boleh masuk selama KATEGORI = RJ.
  const kategori=jpcbKategori(unit);
  return kategori==='RJ' || kategori==='RAWAT JALAN' || kategori==='RAWATJALAN';
}

function jpcbUnitProgress(unit, fallbackKey){
  unit=unit||{};
  return String(
    unit.progress||unit.PROGRESS||unit['PROGRESS']||fallbackKey||''
  ).trim().toUpperCase();
}

function jpcbProgressNorm(value){
  return String(value||'').trim().toUpperCase().replace(/\s+/g,' ');
}

function getJpcbRawatUnits(processes){
  processes=processes||{};
  const pesan=[];
  const proses=[];
  const siap=[];
  const seen={};

  // Hanya unit dengan KATEGORI = RJ yang boleh masuk slide ini.
  // Progress menentukan kolomnya.
  const PESAN='02.RJ PESAN PART';
  const PROSES=[
    '1.WAITING PANEL REPAIR','2.PANEL REPAIR','3.WAITING PUTTY','4.PUTTY',
    '5.WAITING SURFACER','6.SURFACER','7.WAITING PAINTING','8.PAINTING'
  ];
  const SIAP='11.WAITING REASSEMBLY';

  function add(list,unit){
    unit=unit||{};
    const key=String(
      unit.noPKB||unit.noPkb||unit.pkb||unit['NO PKB']||
      unit.nopol||unit.NOPOL||unit['NO POLISI']||Math.random()
    ).trim().toUpperCase();
    if(seen[key]) return;
    seen[key]=1;
    list.push(unit);
  }

  // Iterasi SEMUA process bucket. Jangan bergantung pada nama bucket untuk
  // menentukan RJ; filter utama tetap KATEGORI = RJ.
  Object.keys(processes).forEach(function(bucketKey){
    const units=Array.isArray(processes[bucketKey])?processes[bucketKey]:[];
    units.forEach(function(unit){
      if(!isJpcbRawatJalanUnit(unit)) return;

      const progress=jpcbProgressNorm(jpcbUnitProgress(unit,bucketKey));
      if(progress==='02.RJ PESAN PART' || progress==='2.RJ PESAN PART'){
        add(pesan,unit);
        return;
      }

      if(PROSES.some(function(x){return jpcbProgressNorm(x)===progress;})){
        add(proses,unit);
        return;
      }

      if(progress===SIAP){
        add(siap,unit);
        return;
      }
    });
  });

  return {pesan:pesan,proses:proses,siap:siap};
}

function renderJpcbRawatJalanSlide(slideEl, processes, slideIndex){
  const groups=getJpcbRawatUnits(processes);
  const defs=[
    {name:'PESAN PART',key:'pesan',sub:'02.RJ PESAN PART'},
    {name:'PROSES',key:'proses',sub:'RAWAT JALAN'},
    {name:'SIAP PASANG',key:'siap',sub:'WAITING REASSEMBLY'}
  ];

  defs.forEach(function(def){
    const units=groups[def.key]||[];
    const col=document.createElement('div');
    col.className='column rawat-column';

    const head=document.createElement('div');
    head.className='column-head rawat-column-head';
    head.innerHTML='<div>'+escapeHtml(def.name)+'</div>'+
      '<span class="count">'+units.length+'</span>'+
      '<small>'+escapeHtml(def.sub)+'</small>';
    col.appendChild(head);

    const list=document.createElement('div');
    list.className='unit-list rawat-unit-list';
    list.dataset.process=def.sub;

    if(!units.length){
      list.innerHTML='<div class="empty">Tidak ada unit</div>';
    }else{
      units.forEach(function(unit){
        const card=makeJpcbUnitCard(unit,slideIndex);
        card.classList.add('rawat-unit-card');
        list.appendChild(card);
      });
    }
    col.appendChild(list);
    slideEl.appendChild(col);
  });
}

function renderJPCB(data){
  const board=document.getElementById('jpcbBoard');
  const bar=document.getElementById('jpcbSlideBar');

  if(!data || data.success===false){
    board.innerHTML='<div class="empty">Data JPCB tidak tersedia.</div>';
    if(bar)bar.innerHTML='';
    setJpcbApiStatus('error',(data&&data.message)||'API error');
    return;
  }

  const processes=data.processes || {};
  board.innerHTML='';
  let total=0;

  JPCB_SLIDES.forEach(function(slide,si){
    const slideEl=document.createElement('div');
    slideEl.className='jpcb-slide'+(si===jpcbCurrentSlide?' active':'')+(slide.rawatJalan?' rawat-jalan-slide':'');
    slideEl.dataset.slide=si;

    if(slide.rawatJalan){
      renderJpcbRawatJalanSlide(slideEl, processes, si);
    }else{
      slide.processes.forEach(function(masterValue){
        const units=Array.isArray(processes[masterValue])?processes[masterValue]:[];
        total+=units.length;

        const col=document.createElement('div');
        col.className='column';

        const head=document.createElement('div');
        head.className='column-head';
        head.innerHTML='<div>'+escapeHtml(jpcbDisplayName(masterValue))+
          '</div><span class="count">'+units.length+'</span>';
        col.appendChild(head);

        const list=document.createElement('div');
        list.className='unit-list';
        list.dataset.process=masterValue;

        if(!units.length){
          list.innerHTML='<div class="empty">Tidak ada unit</div>';
        }else{
          units.forEach(function(unit){
            unit=unit||{};
            const card=makeJpcbUnitCard(unit,si);
            list.appendChild(card);
          });
        }
        col.appendChild(list);
        slideEl.appendChild(col);
      });
    }
    board.appendChild(slideEl);
  });

  renderJpcbBottomStatus(processes);

  if(bar){
    bar.innerHTML='';
    JPCB_SLIDES.forEach(function(slide,i){
      const b=document.createElement('button');
      b.className='jpcb-slide-btn'+(i===jpcbCurrentSlide?' active':'');
      b.textContent=slide.name;
      b.onclick=function(){showJpcbSlide(i,true);};
      bar.appendChild(b);
    });
  }

  // WIP: UNIQUE berdasarkan NO PKB.
  // Progress kosong tidak dihitung, dan 17.Delivery tidak dihitung.
  const wip=document.getElementById('jpcbWipCount');
  const wipCalc=calculateJpcbWip(data);
  const summary=document.getElementById('jpcbWipSummary');

  if(summary){
    summary.innerHTML='';

    function addWipBox(label,value,extraClass){
      const box=document.createElement('div');
      box.className='wip-box '+(extraClass||'');

      const lbl=document.createElement('span');
      lbl.textContent=label;

      const count=document.createElement('strong');
      count.textContent=Number(value||0);

      const small=document.createElement('small');
      small.textContent='UNIT WIP';

      box.appendChild(lbl);
      box.appendChild(count);
      box.appendChild(small);
      summary.appendChild(box);
    }

    addWipBox('ATU 1',wipCalc.atu1,'wip-group-1');
    addWipBox('ATU 2',wipCalc.atu2,'wip-group-2');

    addWipBox('WIP BENGKEL',wipCalc.bengkel,'wip-group-other');

    addWipBox('TOTAL',wipCalc.total,'wip-total-box');
  }

  if(wip)wip.textContent=Number(wipCalc.total||0);

  setJpcbApiStatus('ok','Terhubung • '+wipCalc.total+' unit WIP');
  startJpcbTicker();
  startJpcbSlideshow();
}

function makeJpcbUnitCard(unit,slideIndex){
  const card=document.createElement('div');
  card.className='unit';
  card.dataset.nopol=unit.nopol||'';
  card.dataset.wo=unit.noWO||unit.noWo||unit.wo||'';
  card.dataset.pkb=unit.noPKB||unit.noPkb||unit.pkb||'';
  card.dataset.group=unit.group||unit.GROUP||'';
  card.dataset.type=unit.type||unit.TYPE||'';
  card.dataset.sa=unit.sa||unit.SA||unit.serviceAdvisor||unit.service_advisor||'';
  card.dataset.progress=unit.progress||unit.PROGRESS||'';
  card.dataset.tglmasuk=unit.tglMasuk||unit['TGL PKB']||'';
  card.dataset.janjiselesai=unit.janjiSelesai||unit['JANJI SELESAI']||'';
  card.dataset.slide=String(slideIndex);
  card.dataset.status='slide';

  const group=String(unit.group||'').trim().toUpperCase();
  const tagClass=group.includes('2')?'tag-atu2':'tag-atu1';

  const sa=String(
    unit.sa||unit.SA||unit.serviceAdvisor||unit.service_advisor||''
  ).trim();

  // KERUSAKAN hanya menentukan warna garis kiri kartu.
  // Teks LIGHT/MEDIUM/HEAVY tidak ditampilkan.
  const rawKerusakan=String(
    unit.kerusakan||unit.KERUSAKAN||unit['KERUSAKAN']||''
  ).trim().toLowerCase();

  const level=
    rawKerusakan.includes('heavy')||rawKerusakan.includes('berat')
      ? 'heavy'
      : (
        rawKerusakan.includes('medium')||rawKerusakan.includes('sedang')
          ? 'medium'
          : (
            rawKerusakan.includes('light')||rawKerusakan.includes('ringan')
              ? 'light'
              : ''
          )
      );

  if(level) card.classList.add('level-'+level);

  // JANJI SELESAI lewat dari hari ini = tanda ! merah.
  const overdue = isJpcbOverdueDate(
    unit.janjiSelesai || unit['JANJI SELESAI'] || ''
  );

  card.innerHTML=
    '<span class="unit-nopol">'+escapeHtml(unit.nopol||'-')+'</span>'+
    (sa?'<span class="unit-sa">SA: '+escapeHtml(sa)+'</span>':'')+
    '<span class="team-tag '+tagClass+'">'+escapeHtml(group||'-')+'</span>'+
    (overdue
      ? '<span class="jpcb-overdue" title="Janji selesai sudah lewat">!</span>'
      : '');

  card.onclick=function(){openJpcbUnitDetail(unit);};
  return card;
}

function isJpcbOverdueDate(raw){
  if(raw===null || raw===undefined || String(raw).trim()==='') return false;

  const text=String(raw).trim();
  let d=null;

  // Format Apps Script: dd/MM/yyyy HH:mm:ss
  let m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m){
    d=new Date(
      Number(m[3]),
      Number(m[2])-1,
      Number(m[1])
    );
  }else{
    // Format yyyy-MM-dd atau ISO
    d=new Date(text);
  }

  if(!d || isNaN(d.getTime())) return false;

  const now=new Date();
  const today=new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return d < today;
}


function showJpcbPage(page){
  const isOverdue=page==='overdue';
  const isUnitInap=page==='unitinap';
  const isRedo=page==='redo';
  const isQcReport=page==='qcReport';
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  const map={jpcb:'jpcb',overdue:'overdue',unitinap:'unitinap',redo:'redo',qcReport:'qcReport'};
  const target=document.getElementById(map[page]||'jpcb');
  if(target)target.classList.add('active');

  const j=document.getElementById('navJpcbBtn');
  const o=document.getElementById('navOverdueBtn');
  const u=document.getElementById('navUnitInapBtn');
  const r=document.getElementById('navRedoBtn');
  const q=document.getElementById('navQcBtn');
  if(j)j.classList.toggle('active',page==='jpcb');
  if(o)o.classList.toggle('active',isOverdue);
  if(u)u.classList.toggle('active',isUnitInap);
  if(r)r.classList.toggle('active',isRedo);
  if(q)q.classList.toggle('active',isQcReport);

  if(isOverdue) renderJpcbOverdue(jpcbLastData);
  if(isUnitInap) openUnitInapPage();
  if(isRedo && window.REDOMonitor) REDOMonitor.init();
  if(isQcReport && window.QCReport) QCReport.init();
}

let jpcbLastData=null;

function parseJpcbDateOnly(raw){
  if(raw===null || raw===undefined || String(raw).trim()==='') return null;
  const text=String(raw).trim();
  let d=null;

  // Apps Script umum: dd/MM/yyyy HH:mm:ss
  let m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m){
    d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  }else{
    // yyyy-MM-dd, ISO, atau tanggal yang bisa dipahami browser
    d=new Date(text);
  }
  if(!d || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(),d.getMonth(),d.getDate());
}

function getJpcbOverdueDays(raw){
  const due=parseJpcbDateOnly(raw);
  if(!due)return 0;
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const diff=Math.floor((today-due)/86400000);
  return diff>0?diff:0;
}

function formatJpcbDueDate(raw){
  const d=parseJpcbDateOnly(raw);
  if(!d)return '-';
  const p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
}

function collectJpcbOverdueUnits(data){
  const result=[];
  const seen={};
  const processes=(data&&data.processes)||{};

  Object.keys(processes).forEach(function(processName){
    const units=Array.isArray(processes[processName])?processes[processName]:[];
    units.forEach(function(unit){
      unit=unit||{};
      const nopol=String(unit.nopol||unit.NOPOL||unit.noPolisi||'').trim();
      const pkb=String(unit.noPKB||unit.noPkb||unit.pkb||'').trim();
      const due=unit.janjiSelesai||unit['JANJI SELESAI']||unit.janji||'';
      const days=getJpcbOverdueDays(due);
      if(!days || (!nopol && !pkb))return;

      const key=(nopol||pkb).toUpperCase()+'|'+pkb.toUpperCase();
      if(seen[key])return;
      seen[key]=true;

      result.push({
        nopol:nopol||'-',
        pkb:pkb||'-',
        sa:String(unit.sa||unit.SA||unit.serviceAdvisor||unit.service_advisor||'-').trim(),
        group:String(unit.group||unit.GROUP||'').trim().toUpperCase(),
        janjiSelesai:due,
        overdueDays:days,
        progress:String(
          unit.progress ||
          unit.PROGRESS ||
          unit.currentProcess ||
          unit.current_process ||
          processName ||
          '-'
        ).trim(),
        type:String(unit.type||unit.TYPE||'').trim()
      });
    });
  });

  result.sort(function(a,b){
    if(a.group!==b.group)return a.group.localeCompare(b.group);
    return b.overdueDays-a.overdueDays;
  });
  return result;
}

function renderJpcbOverdue(data){
  const units=collectJpcbOverdueUnits(data);
  const atu1=units.filter(function(u){return u.group.includes('1');});
  const atu2=units.filter(function(u){return u.group.includes('2');});
  const unknown=units.filter(function(u){return !u.group.includes('1')&&!u.group.includes('2');});

  // Jika ada group kosong/berbeda, tetap tampilkan di ATU 2 agar tidak hilang.
  unknown.forEach(function(u){atu2.push(u);});

  const total=document.getElementById('overdueTotal');
  const c1=document.getElementById('overdueAtu1');
  const c2=document.getElementById('overdueAtu2');
  if(total)total.textContent=units.length;
  if(c1)c1.textContent=atu1.length;
  if(c2)c2.textContent=atu2.length;

  const h1=document.getElementById('overdueAtu1Count');
  const h2=document.getElementById('overdueAtu2Count');
  if(h1)h1.textContent=atu1.length+' UNIT';
  if(h2)h2.textContent=atu2.length+' UNIT';

  renderJpcbOverdueTable('overdueAtu1Body',atu1);
  renderJpcbOverdueTable('overdueAtu2Body',atu2);
}

function renderJpcbOverdueTable(id,units){
  const body=document.getElementById(id);
  if(!body)return;
  body.innerHTML='';

  if(!units.length){
    body.innerHTML='<tr><td colspan="5" class="overdue-empty">Tidak ada unit terlambat</td></tr>';
    return;
  }

  units.forEach(function(unit){
    const tr=document.createElement('tr');
    tr.innerHTML=
      '<td><div class="overdue-nopol">'+escapeHtml(unit.nopol)+'</div></td>'+
      '<td><div class="overdue-sa">'+escapeHtml(unit.sa||'-')+'</div></td>'+
      '<td><div class="overdue-process">'+escapeHtml(jpcbDisplayName(unit.process||unit.progress||'-'))+'</div></td>'+
      '<td><span class="overdue-date">'+escapeHtml(formatJpcbDueDate(unit.janjiSelesai))+'</span></td>'+
      '<td><span class="overdue-days '+(unit.overdueDays>=7?'severe':'')+'">'+unit.overdueDays+' HARI</span></td>';

    tr.onclick=function(){openJpcbUnitDetail({
      nopol:unit.nopol,
      noPKB:unit.pkb,
      group:unit.group,
      type:unit.type,
      sa:unit.sa,
      progress:unit.process||unit.progress||'',
      janjiSelesai:unit.janjiSelesai
    });};
    body.appendChild(tr);
  });
}

function downloadOverdueGroupImage(groupId,groupName){
  const group=document.getElementById(groupId);
  if(!group)return;

  const button=group.querySelector('.overdue-download-btn');
  if(button){
    button.disabled=true;
    button.textContent='⏳ MEMBUAT...';
  }

  // Export seluruh isi group, bukan viewport tabel.
  group.classList.add('overdue-exporting');

  // Hilangkan tombol download dari hasil gambar agar hasil bersih.
  const buttons=group.querySelectorAll('.overdue-download-btn');
  buttons.forEach(function(b){b.dataset.oldDisplay=b.style.display;b.style.display='none';});

  const tableWrap=group.querySelector('.overdue-table-wrap');
  const oldOverflow=tableWrap?tableWrap.style.overflow:'';
  const oldMaxHeight=tableWrap?tableWrap.style.maxHeight:'';
  if(tableWrap){
    tableWrap.style.overflow='visible';
    tableWrap.style.maxHeight='none';
  }

  const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));

  html2canvas(group,{
    backgroundColor:'#121a22',
    scale:scale,
    useCORS:true,
    logging:false,
    width:group.scrollWidth,
    height:group.scrollHeight,
    windowWidth:Math.max(document.documentElement.clientWidth,group.scrollWidth),
    windowHeight:Math.max(window.innerHeight,group.scrollHeight)
  }).then(function(canvas){
    const link=document.createElement('a');
    const date=new Date();
    const p=n=>String(n).padStart(2,'0');
    const filename='UNIT_TERLAMBAT_'+groupName.replace(/\s+/g,'_')+'_'+
      date.getFullYear()+p(date.getMonth()+1)+p(date.getDate())+'.png';
    link.download=filename;
    link.href=canvas.toDataURL('image/png');
    link.click();
  }).catch(function(err){
    console.error('Export Unit Terlambat:',err);
    alert('Gagal membuat gambar. Coba lagi.');
  }).finally(function(){
    if(tableWrap){
      tableWrap.style.overflow=oldOverflow;
      tableWrap.style.maxHeight=oldMaxHeight;
    }
    buttons.forEach(function(b){b.style.display=b.dataset.oldDisplay||'';});
    group.classList.remove('overdue-exporting');
    if(button){
      button.disabled=false;
      button.textContent='⬇ GAMBAR';
    }
  });
}


function renderJpcbBottomStatus(processes){
  const stopped=Array.isArray(processes['18.JOB STOPPED'])?processes['18.JOB STOPPED']:[];
  const rawat=Array.isArray(processes['19.RAWAT JALAN'])?processes['19.RAWAT JALAN']:[];
  const estimasi=Array.isArray(processes['00.ESTIMASI'])?processes['00.ESTIMASI']:[];
  const waitingSpk=Array.isArray(processes['01.WAITING SPK'])?processes['01.WAITING SPK']:[];

  const stoppedCount=document.getElementById('jpcbStoppedCount');
  const rawatCount=document.getElementById('jpcbRawatCount');
  const estimasiCount=document.getElementById('jpcbEstimasiCount');
  const waitingSpkCount=document.getElementById('jpcbWaitingSpkCount');

  if(stoppedCount)stoppedCount.textContent=stopped.length;
  if(rawatCount)rawatCount.textContent=rawat.length;
  if(estimasiCount)estimasiCount.textContent=estimasi.length;
  if(waitingSpkCount)waitingSpkCount.textContent=waitingSpk.length;

  renderJpcbStatusList('jpcbStoppedList',stopped);
  renderJpcbStatusList('jpcbRawatList',rawat);
  renderJpcbStatusList('jpcbEstimasiList',estimasi);
  renderJpcbStatusList('jpcbWaitingSpkList',waitingSpk);
}

function renderJpcbStatusList(id,units){
  const list=document.getElementById(id);
  if(!list)return;
  list.innerHTML='';
  if(!units.length){
    list.innerHTML='<div class="status-empty">Tidak ada unit</div>';
    return;
  }
  units.forEach(function(unit){
    const card=makeJpcbUnitCard(unit,0);
    card.dataset.status='bottom';
    card.dataset.bottomId=id;
    list.appendChild(card);
  });
}

function showJpcbSlide(index,userAction){
  jpcbCurrentSlide=(index+JPCB_SLIDES.length)%JPCB_SLIDES.length;
  document.querySelectorAll('.jpcb-slide').forEach(function(el,i){
    el.classList.toggle('active',i===jpcbCurrentSlide);
  });
  document.querySelectorAll('.jpcb-slide-btn').forEach(function(el,i){
    el.classList.toggle('active',i===jpcbCurrentSlide);
  });
  startJpcbTicker();
  if(userAction)startJpcbSlideshow();
}

function startJpcbTicker(){
  if(jpcbTickerTimer)clearInterval(jpcbTickerTimer);
  const active=document.querySelector('.jpcb-slide.active');
  if(active)active.querySelectorAll('.unit-list').forEach(function(list){list.scrollTop=0;});
  document.querySelectorAll('.status-list').forEach(function(list){list.scrollLeft=0;});

  jpcbTickerTimer=setInterval(function(){
    const current=document.querySelector('.jpcb-slide.active');
    if(current){
      current.querySelectorAll('.unit-list').forEach(function(list){
        // Jika user sedang scroll manual, auto-scroll ditunda sementara.
        if(list.dataset.manualPause==='1')return;
        if(list.scrollHeight<=list.clientHeight+4)return;
        const first=list.querySelector('.unit');
        if(!first)return;
        const step=first.offsetHeight+6;
        const max=list.scrollHeight-list.clientHeight;
        list.scrollTo({top:list.scrollTop+step>=max-3?0:list.scrollTop+step,behavior:'smooth'});
      });
    }
    document.querySelectorAll('.status-list').forEach(function(list){
      if(list.dataset.manualPause==='1')return;
      if(list.scrollWidth<=list.clientWidth+4)return;
      const first=list.querySelector('.unit');
      if(!first)return;
      const step=first.offsetWidth+6;
      const max=list.scrollWidth-list.clientWidth;
      list.scrollTo({left:list.scrollLeft+step>=max-3?0:list.scrollLeft+step,behavior:'smooth'});
    });
  },3000);
}

// MANUAL SCROLL: mouse wheel, touch/drag dan scrollbar tetap bisa dipakai.
// Setelah user berhenti scroll, auto-scroll aktif kembali setelah 8 detik.
(function enableJpcbManualScroll(){
  let resumeTimers=new WeakMap();

  function pauseAuto(list){
    if(!list)return;
    list.dataset.manualPause='1';
    clearTimeout(resumeTimers.get(list));
    resumeTimers.set(list,setTimeout(function(){
      list.dataset.manualPause='0';
    },8000));
  }

  document.addEventListener('wheel',function(e){
    const list=e.target.closest && e.target.closest('.unit-list,.status-list');
    if(list)pauseAuto(list);
  },{passive:true});

  ['touchstart','touchmove','pointerdown'].forEach(function(evt){
    document.addEventListener(evt,function(e){
      const list=e.target.closest && e.target.closest('.unit-list,.status-list');
      if(list)pauseAuto(list);
    },{passive:true});
  });

  // Drag manual untuk scroll vertikal unit-list DAN horizontal status-list.
  document.querySelectorAll('.unit-list,.status-list').forEach(function(list){
    let dragging=false,startX=0,startY=0,startLeft=0,startTop=0;

    list.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse' && e.button!==0)return;
      dragging=true;
      startX=e.clientX; startY=e.clientY;
      startLeft=list.scrollLeft; startTop=list.scrollTop;
      pauseAuto(list);
      if(e.pointerType==='mouse') list.setPointerCapture?.(e.pointerId);
    });

    list.addEventListener('pointermove',function(e){
      if(!dragging)return;
      const dx=e.clientX-startX;
      const dy=e.clientY-startY;

      if(list.classList.contains('status-list')){
        // Bagian bawah: geser kiri-kanan.
        if(Math.abs(dx)>2){
          list.scrollLeft=startLeft-dx;
          pauseAuto(list);
        }
      }else{
        // Kolom utama: geser atas-bawah.
        if(Math.abs(dy)>2){
          list.scrollTop=startTop-dy;
          pauseAuto(list);
        }
      }
    });

    ['pointerup','pointercancel','pointerleave'].forEach(function(evt){
      list.addEventListener(evt,function(){dragging=false;});
    });
  });
})();

function startJpcbSlideshow(){
  if(jpcbSlideTimer)clearInterval(jpcbSlideTimer);
  jpcbSlideTimer=setInterval(function(){
    showJpcbSlide(jpcbCurrentSlide+1,false);
  },12000);
}

function normalizeJpcbSearch(v){
  return String(v==null?'':v)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g,'');
}

function getJpcbSearchUnits(){
  const data=window.jpcbLastData || jpcbLastData;
  const out=[];
  const seen={};
  const processes=(data&&data.processes)||{};
  Object.keys(processes).forEach(function(processName){
    const units=Array.isArray(processes[processName])?processes[processName]:[];
    units.forEach(function(raw){
      const unit=raw||{};
      const nopol=String(unit.nopol||unit.NOPOL||unit.noPolisi||unit['NO POLISI']||'').trim();
      const pkb=String(unit.noPKB||unit.noPkb||unit.pkb||unit['NO PKB']||'').trim();
      const wo=String(unit.noWO||unit.noWo||unit.wo||unit['NO WO']||unit['NO WO 8 DIGIT']||'').trim();
      const key=(nopol+'|'+pkb+'|'+wo+'|'+processName).toUpperCase();
      if(seen[key])return;
      seen[key]=true;
      out.push({
        raw:unit,
        nopol:nopol,
        pkb:pkb,
        wo:wo,
        group:String(unit.group||unit.GROUP||'').trim(),
        type:String(unit.type||unit.TYPE||'').trim(),
        sa:String(unit.sa||unit.SA||unit.serviceAdvisor||unit.service_advisor||'').trim(),
        progress:String(unit.progress||unit.PROGRESS||processName||'').trim(),
        process:processName
      });
    });
  });
  return out;
}

function findJPCBUnit(query){
  const q=normalizeJpcbSearch(query);
  const status=document.getElementById('jpcbSearchStatus');
  document.querySelectorAll('.unit.jpcb-found').forEach(function(x){x.classList.remove('jpcb-found');});

  if(!q){
    if(status)status.textContent='Masukkan No. Polisi / No. WO';
    return false;
  }

  const units=getJpcbSearchUnits();
  if(!units.length){
    if(status)status.textContent='Data JPCB masih dimuat...';
    return false;
  }

  const hit=units.find(function(u){
    return [u.nopol,u.pkb,u.wo,u.raw&&u.raw.text,u.progress]
      .map(normalizeJpcbSearch)
      .some(function(v){return v && v.includes(q);});
  });

  if(!hit){
    if(status)status.textContent='Unit tidak ditemukan: '+query;
    return false;
  }

  // Cari kartu berdasarkan identitas unit. Tidak memanggil API/detail.
  const cards=Array.from(document.querySelectorAll('#jpcbBoard .unit'));
  const card=cards.find(function(c){
    const cn=normalizeJpcbSearch(c.dataset.nopol||'');
    const cp=normalizeJpcbSearch(c.dataset.pkb||'');
    const cw=normalizeJpcbSearch(c.dataset.wo||'');
    return (hit.nopol && cn===normalizeJpcbSearch(hit.nopol)) ||
           (hit.pkb && cp===normalizeJpcbSearch(hit.pkb)) ||
           (hit.wo && cw===normalizeJpcbSearch(hit.wo));
  });

  if(card){
    const slide=Number(card.dataset.slide||0);
    if(!Number.isNaN(slide))showJpcbSlide(slide,true);
    card.classList.add('jpcb-found');
    setTimeout(function(){card.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});},80);
    setTimeout(function(){card.classList.remove('jpcb-found');},5000);
  }

  if(status)status.textContent='Unit ditemukan ✓ '+(hit.nopol||hit.pkb||hit.wo);
  showSearchFound({
    nopol:hit.nopol||'-',
    noPKB:hit.pkb||'-',
    group:hit.group||'-',
    type:hit.type||'-',
    sa:hit.sa||'-',
    progress:hit.progress||'-'
  });
  return false;
}

(function bindJpcbSearch(){
  function bind(){
    const input=document.getElementById('jpcbSearchInput');
    const button=document.getElementById('jpcbSearchButton');
    if(!input)return;
    if(input.dataset.searchBound==='1')return;
    input.dataset.searchBound='1';
    input.addEventListener('keydown',function(e){
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopPropagation();
        findJPCBUnit(input.value);
      }
    });
    if(button){
      button.type='button';
      button.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        findJPCBUnit(input.value);
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
  else bind();
})();


let jpcbLoading=false;
let jpcbInitialSnapshot=null;
let jpcbToastQueue=[];
let jpcbToastBusy=false;

function flattenJpcbUnits(data){
  const result=[];
  const processes=(data&&data.processes)||{};
  Object.keys(processes).forEach(function(processName){
    const units=Array.isArray(processes[processName])?processes[processName]:[];
    units.forEach(function(unit){
      unit=unit||{};
      const nopol=String(unit.nopol||unit.NOPOL||'').trim().toUpperCase();
      const pkb=String(unit.noPKB||unit.noPkb||unit.pkb||'').trim().toUpperCase();
      const key=(nopol||pkb||Math.random().toString(36).slice(2))+'|'+pkb;
      result.push({
        key:key,
        nopol:nopol||'-',
        pkb:pkb||'-',
        process:String(unit.progress||unit.PROGRESS||processName||'-'),
        progress:String(unit.progress||unit.PROGRESS||processName||'-'),
        group:String(unit.group||unit.GROUP||'-'),
        type:String(unit.type||unit.TYPE||'-'),
        sa:String(unit.sa||unit.SA||unit.serviceAdvisor||unit.service_advisor||'-')
      });
    });
  });
  return result;
}

function snapshotJpcb(data){
  const units=flattenJpcbUnits(data);
  const map={};
  units.forEach(function(u){
    // Unit yang sama bisa muncul di satu process saja; gunakan identitas unit.
    map[u.key]=u;
  });
  return map;
}

function liveLogTime(){
  const d=new Date();
  return String(d.getHours()).padStart(2,'0')+':'+
         String(d.getMinutes()).padStart(2,'0')+':'+
         String(d.getSeconds()).padStart(2,'0');
}

function playLiveLogTone(){
  try{
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A)return;
    const c=new A(),n=c.currentTime;
    // Nada tinggi pendek, berbeda dari nada pencarian unit.
    const notes=[[1760,0,.16],[2349,.08,.22]];
    notes.forEach(function(x){
      const o=c.createOscillator(),g=c.createGain();
      o.type='sine';
      o.frequency.setValueAtTime(x[0],n+x[1]);
      g.gain.setValueAtTime(.0001,n+x[1]);
      g.gain.exponentialRampToValueAtTime(.13,n+x[1]+.012);
      g.gain.exponentialRampToValueAtTime(.0001,n+x[2]);
      o.connect(g);g.connect(c.destination);
      o.start(n+x[1]);o.stop(n+x[2]+.02);
    });
    setTimeout(function(){try{c.close()}catch(e){}},500);
  }catch(e){}
}

function enqueueLiveLogToast(item,kind){
  jpcbToastQueue.push({item:item,kind:kind});
  processLiveLogToastQueue();
}

function processLiveLogToastQueue(){
  if(jpcbToastBusy||!jpcbToastQueue.length)return;
  jpcbToastBusy=true;
  const entry=jpcbToastQueue.shift();
  const item=entry.item||{};
  const wrap=document.getElementById('liveLogToastWrap');
  if(!wrap){jpcbToastBusy=false;return;}

  const toast=document.createElement('div');
  toast.className='live-log-toast';

  const title=entry.kind==='new'
    ? 'UNIT BARU TERDETEKSI'
    : 'LOG / UPDATE BARU';

  const action=entry.kind==='new'
    ? 'Masuk ke monitoring'
    : 'Perubahan progress';

  toast.innerHTML=
    '<div class="live-log-top">'+
      '<div class="live-log-icon">🔔</div>'+
      '<div class="live-log-title">'+title+'</div>'+
      '<div class="live-log-time">'+liveLogTime()+'</div>'+
    '</div>'+
    '<div class="live-log-main">'+escSF(item.nopol||'-')+'</div>'+
    '<div class="live-log-sub">'+
      'PKB: <strong>'+escSF(item.pkb||'-')+'</strong><br>'+
      'Progress: <strong>'+escSF(jpcbDisplayName(item.progress||item.process||'-'))+'</strong>'+
      (item.group&&item.group!=='-'?' • '+escSF(item.group):'')+
      (item.sa&&item.sa!=='-'?'<br>SA: <strong>'+escSF(item.sa)+'</strong>':'')+
    '</div>'+
    '<div class="live-log-badge">'+action+'</div>';

  wrap.appendChild(toast);
  playLiveLogTone();

  setTimeout(function(){
    toast.classList.add('hide');
    setTimeout(function(){
      if(toast.parentNode)toast.parentNode.removeChild(toast);
      jpcbToastBusy=false;
      processLiveLogToastQueue();
    },480);
  },3900);
}

function detectJpcbChanges(data){
  const current=snapshotJpcb(data);

  // Saat pertama kali halaman dibuka, jangan membunyikan semua unit lama.
  if(!jpcbInitialSnapshot){
    jpcbInitialSnapshot=current;
    return;
  }

  const previous=jpcbInitialSnapshot;
  const changed=[];
  const added=[];

  Object.keys(current).forEach(function(key){
    const now=current[key], old=previous[key];
    if(!old){
      added.push(now);
      return;
    }

    // Deteksi perubahan yang biasanya berasal dari update/log database.
    if(
      now.process!==old.process ||
      now.progress!==old.progress ||
      now.group!==old.group ||
      now.sa!==old.sa
    ){
      changed.push(now);
    }
  });

  // Update snapshot setelah dibandingkan.
  jpcbInitialSnapshot=current;

  // Maksimal 5 notifikasi per siklus agar TV tidak banjir notifikasi.
  added.slice(0,5).forEach(function(item){
    enqueueLiveLogToast(item,'new');
  });
  changed.slice(0,5).forEach(function(item){
    enqueueLiveLogToast(item,'changed');
  });
}


let unitInapLastDate='';
let unitInapLoading=false;

function parseUnitInapDateOnly(raw){
  if(raw===null||raw===undefined||String(raw).trim()==='')return null;
  const text=String(raw).trim();
  let m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  m=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  const d=new Date(text);
  return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
}
function formatUnitInapDateLabel(raw){
  const d=parseUnitInapDateOnly(raw);
  if(!d)return '-';
  const m=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return String(d.getDate()).padStart(2,'0')+' '+m[d.getMonth()]+' '+d.getFullYear();
}
function formatUnitInapInputDate(raw){
  const d=parseUnitInapDateOnly(raw);
  if(!d)return '';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function unitInapMissingPkb(pkb){
  const v=String(pkb||'').trim().toUpperCase();
  return v==='' || v.indexOf('105PBP')!==0;
}
function renderUnitInap(data){
  const body=document.getElementById('unitInapBody');
  const totalEl=document.getElementById('unitInapTotal');
  const missingEl=document.getElementById('unitInapMissingPkb');
  const status=document.getElementById('unitInapStatus');
  const sub=document.getElementById('unitInapSubtitle');
  const input=document.getElementById('unitInapDate');
  if(!body)return;

  const rows=Array.isArray(data&&data.rows)?data.rows:[];
  const dateUsed=data&&data.dateUsed?data.dateUsed:'';
  if(input && dateUsed) input.value=formatUnitInapInputDate(dateUsed);
  unitInapLastDate=dateUsed||'';

  // Hitung unit unik. Prioritas NO PKB; jika kosong gunakan NO POLISI.
  const seen={};
  const unique=[];
  rows.forEach(function(r){
    const pkb=String(r.noPKB||'').trim();
    const nopol=String(r.noPolisi||'').trim();
    const key=(pkb?'PKB:'+pkb.toUpperCase():(nopol?'NOPOL:'+nopol.toUpperCase():'ROW:'+unique.length));
    if(!seen[key]){seen[key]=true;unique.push(r);}
  });
  const missing=unique.filter(function(r){return unitInapMissingPkb(r.noPKB);}).length;
  if(totalEl)totalEl.textContent=unique.length;
  if(missingEl)missingEl.textContent=missing;
  if(sub)sub.textContent='Audit Unit Inap • '+formatUnitInapDateLabel(dateUsed)+' • '+rows.length+' audit record';
  if(status)status.textContent=data&&data.latestDate&&dateUsed!==data.latestDate
    ? 'Tanggal dipilih: '+formatUnitInapDateLabel(dateUsed)+' • Tanggal terbaru: '+formatUnitInapDateLabel(data.latestDate)
    : 'Menampilkan audit unit inap tanggal '+formatUnitInapDateLabel(dateUsed);

  if(!rows.length){
    body.innerHTML='<tr><td colspan="6" class="unitinap-empty">Tidak ada audit unit inap pada tanggal tersebut.</td></tr>';
    return;
  }
  body.innerHTML=rows.map(function(r,i){
    const pkb=String(r.noPKB||'').trim();
    const nopol=String(r.noPolisi||'').trim();
    const group=String(r.group||'').trim();
    const process=String(r.proses||'').trim();
    const note=String(r.keterangan||'').trim();
    const pkbHtml=unitInapMissingPkb(pkb)
      ? '<span class="unitinap-no-pkb-missing">'+escapeHtml(pkb||'BELUM ADA PKB')+'</span>'
      : '<span class="unitinap-no-pkb-ok">'+escapeHtml(pkb)+'</span>';
    return '<tr><td>'+String(i+1)+'</td><td>'+escapeHtml(nopol||'-')+'</td><td>'+pkbHtml+'</td><td>'+escapeHtml(group||'-')+'</td><td>'+escapeHtml(process||'-')+'</td><td>'+escapeHtml(note||'-')+'</td></tr>';
  }).join('');
}

// Logo PDF diambil langsung dari logo base64 yang sudah tertanam di HTML.
// Ini mencegah error "tunasLogo is not defined" dan tidak membutuhkan file logo terpisah.
const tunasLogo = (document.querySelector('.tunas-real-logo') || {}).src || '';
const toyotaLogo = (document.querySelector('.toyota-real-logo') || {}).src || '';

async function downloadUnitInapPDF(){
  const input=document.getElementById('unitInapDate');
  const selectedDate=input && input.value ? input.value : unitInapLastDate;
  if(!selectedDate){
    alert('Tanggal Unit Inap belum tersedia. Silakan pilih tanggal terlebih dahulu.');
    return;
  }

  const btn=document.querySelector('.unitinap-datebox .unitinap-btn[onclick="downloadUnitInapPDF()"]');
  const oldText=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='⏳ MEMBUAT PDF...';}

  try{
    const url=JPCB_API_URL+'?action=unitInap&tanggal='+encodeURIComponent(selectedDate)+'&ts='+Date.now();
    const response=await fetch(url,{method:'GET',cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    if(!data || data.success===false)throw new Error((data&&data.message)||'Data Unit Inap tidak valid');

    const rows=Array.isArray(data.rows)?data.rows:[];
    const seen={};
    const unique=[];
    rows.forEach(function(r){
      const pkb=String(r.noPKB||'').trim();
      const nopol=String(r.noPolisi||'').trim();
      const key=(pkb?'PKB:'+pkb.toUpperCase():(nopol?'NOPOL:'+nopol.toUpperCase():'ROW:'+unique.length));
      if(!seen[key]){seen[key]=true;unique.push(r);}
    });
    const missing=unique.filter(function(r){return unitInapMissingPkb(r.noPKB);}).length;

    if(!window.jspdf || !window.jspdf.jsPDF) throw new Error('Library PDF belum termuat. Periksa koneksi internet.');
    const {jsPDF}=window.jspdf;

    // A4 LANDSCAPE supaya tabel lebih lebar dan hemat kertas.
    const doc=new jsPDF({
      orientation:'landscape',
      unit:'mm',
      format:'a4',
      compress:true
    });

    const pageW=doc.internal.pageSize.getWidth();
    const pageH=doc.internal.pageSize.getHeight();
    const dateLabel=formatUnitInapDateLabel(data.dateUsed||selectedDate);

    // =========================================================
    // HEADER HALAMAN PERTAMA
    // =========================================================
    doc.setFillColor(255,255,255);
    doc.rect(0,0,pageW,pageH,'F');

    // Logo Tunas Toyota kiri.
    if(tunasLogo) doc.addImage(tunasLogo,'PNG',14,6,62,11);
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.setTextColor(35,35,35);
    doc.text('BINTARO BODY & PAINT',45,20,{align:'center'});

    // Logo Toyota Let's Go Beyond kanan.
    if(toyotaLogo) doc.addImage(toyotaLogo,'PNG',pageW-78,5,64,14);

    // Judul tengah.
    doc.setTextColor(20,20,20);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text('DATA UNIT INAP',pageW/2,13,{align:'center'});

    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    doc.setTextColor(80,80,80);
    doc.text('AUDIT UNIT INAP',pageW/2,18,{align:'center'});

    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.setTextColor(30,30,30);
    doc.text('TANGGAL: '+dateLabel,pageW/2,23,{align:'center'});

    doc.setDrawColor(180,180,180);
    doc.setLineWidth(0.3);
    doc.line(14,26,pageW-14,26);

    // KPI dibuat tipis agar tidak memakan ruang.
    const boxY=29, boxW=57, boxH=12;
    [[14,'JUMLAH UNIT INAP',unique.length],
     [76,'BELUM ADA PKB',missing],
     [138,'AUDIT RECORD',rows.length]].forEach(function(k){
       doc.setFillColor(255,255,255);
       doc.setDrawColor(175,175,175);
       doc.roundedRect(k[0],boxY,boxW,boxH,1.5,1.5,'FD');
       doc.setTextColor(65,65,65);
       doc.setFontSize(6);
       doc.setFont('helvetica','bold');
       doc.text(k[1],k[0]+3,boxY+4);
       doc.setTextColor(20,20,20);
       doc.setFontSize(10);
       doc.text(String(k[2]),k[0]+3,boxY+9.5);
    });

    // =========================================================
    // TABEL KOMPAK
    // Keterangan dibatasi maksimal 2 baris agar tidak membuat
    // satu baris menjadi sangat tinggi.
    // =========================================================
    function compactNote(v){
      const s=String(v||'-').replace(/\s+/g,' ').trim()||'-';
      if(s.length<=75)return s;
      return s.slice(0,72)+'...';
    }

    const body=unique.map(function(r,i){
      const pkb=String(r.noPKB||'').trim();
      return [
        String(i+1),
        String(r.noPolisi||'-').trim()||'-',
        pkb||'BELUM ADA PKB',
        String(r.group||'-').trim()||'-',
        String(r.proses||'-').trim()||'-',
        compactNote(r.keterangan)
      ];
    });

    doc.autoTable({
      startY:45,
      margin:{left:10,right:10,top:10,bottom:10},
      head:[['NO','NO POLISI','NO PKB','GROUP','PROSES','KETERANGAN']],
      body:body,
      theme:'grid',
      pageBreak:'auto',
      rowPageBreak:'avoid',
      styles:{
        font:'helvetica',
        fontSize:6.5,
        textColor:[25,25,25],
        fillColor:[255,255,255],
        cellPadding:{top:1.2,right:1.8,bottom:1.2,left:1.8},
        overflow:'linebreak',
        valign:'middle',
        lineColor:[185,185,185],
        lineWidth:0.2,
        minCellHeight:5
      },
      headStyles:{
        fontStyle:'bold',
        halign:'center',
        textColor:[20,20,20],
        fillColor:[235,235,235],
        lineColor:[155,155,155],
        lineWidth:0.25,
        fontSize:6.5
      },
      alternateRowStyles:{fillColor:[250,250,250]},
      columnStyles:{
        0:{cellWidth:8,halign:'center'},
        1:{cellWidth:28},
        2:{cellWidth:43},
        3:{cellWidth:28},
        4:{cellWidth:39},
        5:{cellWidth:'auto'}
      },
      didParseCell:function(hook){
        if(hook.section==='body' && hook.column.index===2 && unitInapMissingPkb(hook.cell.raw)){
          hook.cell.styles.fontStyle='bold';
        }
      },
      didDrawPage:function(hook){
        // Header kecil pada halaman lanjutan.
        if(hook.pageNumber>1){
          doc.setFillColor(255,255,255);
          doc.rect(0,0,pageW,9,'F');
          doc.setFont('helvetica','bold');
          doc.setFontSize(7);
          doc.setTextColor(50,50,50);
          doc.text('DATA UNIT INAP • '+dateLabel,pageW/2,6,{align:'center'});
        }
        // Nomor halaman kecil.
        doc.setFont('helvetica','normal');
        doc.setFontSize(6);
        doc.setTextColor(110,110,110);
        doc.text(
          'TUNAS TOYOTA BINTARO • BINTARO BODY & PAINT',
          10,pageH-4
        );
        doc.text(
          'Halaman '+hook.pageNumber,
          pageW-10,pageH-4,{align:'right'}
        );
      }
    });

    // =========================================================
    // TANDA TANGAN
    // HANYA DI HALAMAN TERAKHIR.
    // Ini menghindari ruang kosong besar di setiap halaman.
    // =========================================================
    let sigPage=doc.getNumberOfPages();
    doc.setPage(sigPage);

    let sigY=(doc.lastAutoTable && doc.lastAutoTable.finalY)
      ? doc.lastAutoTable.finalY+8
      : 55;

    // Jika tabel terlalu dekat footer, pindahkan tanda tangan
    // ke halaman baru. Tetap hanya 1 halaman tanda tangan.
    if(sigY>pageH-30){
      doc.addPage();
      sigPage=doc.getNumberOfPages();
      doc.setPage(sigPage);
      doc.setFillColor(255,255,255);
      doc.rect(0,0,pageW,pageH,'F');
      sigY=pageH-38;
    }else{
      sigY=Math.max(sigY,pageH-34);
    }

    doc.setTextColor(45,45,45);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    doc.text('Mengetahui,',14,sigY-7);

    const sigCols=[pageW*0.18,pageW*0.50,pageW*0.82];

    sigCols.forEach(function(x,i){
      const title=['FOREMAN','KABENG','SECURITY'][i];

      doc.setFont('helvetica','bold');
      doc.setFontSize(8);
      doc.setTextColor(30,30,30);
      doc.text(title,x,sigY,{align:'center'});

      doc.setDrawColor(70,70,70);
      doc.setLineWidth(0.3);
      doc.line(x-25,sigY+20,x+25,sigY+20);

      doc.setFont('helvetica','normal');
      doc.setFontSize(6.5);
      doc.setTextColor(90,90,90);
      doc.text('Tanda tangan / nama',x,sigY+24,{align:'center'});
    });

    // Footer final.
    doc.setFont('helvetica','normal');
    doc.setFontSize(6);
    doc.setTextColor(110,110,110);
    doc.text(
      'Laporan Unit Inap • '+dateLabel,
      pageW/2,pageH-4,{align:'center'}
    );

    doc.save('Laporan_Unit_Inap_'+(data.dateUsed||selectedDate)+'.pdf');

  }catch(err){
    console.error(err);
    alert('Gagal membuat PDF Unit Inap.\n'+(err&&err.message?err.message:err));
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||'⬇ DOWNLOAD PDF';}
  }
}


function dailyReportTodayISO(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dailyReportEsc(v){return escapeHtml(String(v==null?'':v));}
function dailyReportGroupName(raw){
  const g=String(raw||'').trim().toUpperCase();
  if(g==='ATU 1'||g==='ATU1')return 'ATU 1';
  if(g==='ATU 2'||g==='ATU2')return 'ATU 2';
  if(!g)return 'WIP BENGKEL';
  return g;
}
function dailyReportProcessList(data, unitRows){
  // Report memakai seluruh status PROGRESS dari DATABASE UNIT.
  // DELIVERY (16.WAITING DELIVERY dan 17.Delivery) sengaja dikeluarkan.
  const order=[
    '00.ESTIMASI',
    '01.WAITING SPK',
    '1.WAITING PANEL REPAIR',
    '2.PANEL REPAIR',
    '3.WAITING PUTTY',
    '4.PUTTY',
    '5.WAITING SURFACER',
    '6.SURFACER',
    '7.WAITING PAINTING',
    '8.PAINTING',
    '9.WAITING POLISH',
    '10.POLISHING',
    '11.WAITING REASSEMBLY',
    '12.REASSEMBLY',
    '13.WASHING/FINISHING',
    '14.WAITING FINAL CHECK',
    '15.FINAL CHECK',
    '18.JOB STOPPED',
    '19.RAWAT JALAN'
  ];
  const rows=Array.isArray(unitRows)?unitRows:[];
  const counts={};
  order.forEach(function(p){counts[p]=0;});
  rows.forEach(function(unit){
    const p=String(unit.PROGRESS||unit.progress||'').trim();
    if(!p || p==='16.WAITING DELIVERY' || /^17\.DELIVERY$/i.test(p))return;
    const hit=order.find(function(x){return x.toUpperCase()===p.toUpperCase();});
    if(hit)counts[hit]++;
  });
  return order.map(function(name){return {name:name,count:counts[name]||0};});
}

function dailyReportUniqueKey(row, index){
  const pkb=String(row && (row['NO PKB']||row.noPKB||'')||'').trim();
  const nopol=String(row && (row['NO POLISI']||row.noPolisi||'')||'').trim();
  return pkb ? 'PKB:'+pkb.toUpperCase() : (nopol ? 'NOPOL:'+nopol.toUpperCase() : 'ROW:'+index);
}
function dailyReportDateOnly(value){
  if(!value)return '';
  const s=String(value).trim();
  if(!s)return '';
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m)return m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0');
  m=s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
  if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
  const d=new Date(s);
  if(!isNaN(d.getTime()))return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  return '';
}
function dailyReportParseNumber(value){
  if(value==null||value==='')return 0;
  const s=String(value).trim().replace(/\./g,'').replace(',','.');
  const n=parseFloat(s);
  return isNaN(n)?0:n;
}
function dailyReportEntryDate(row){
  const keys=['TGL PKB KE GROUP','TANGGAL PKB KE GROUP','TGL PKB KE GRUP','TANGGAL PKB KE GRUP','PKB KE GROUP','PKB KE GRUP'];
  for(let i=0;i<keys.length;i++){if(row[keys[i]]!=null&&String(row[keys[i]]).trim()!=='')return row[keys[i]];}
  return row.tglMasuk||row.tanggalMasuk||'';
}
function dailyReportPanelCount(row){
  const keys=['JUMLAH PANEL','JML PANEL','TOTAL PANEL','PANEL','JUMLAH PANEL KERUSAKAN','JUMLAH PANEL REPAIR'];
  for(let i=0;i<keys.length;i++){if(row[keys[i]]!=null&&String(row[keys[i]]).trim()!=='')return dailyReportParseNumber(row[keys[i]]);}
  return dailyReportParseNumber(row.jumlahPanel||row.jumlahpanel||row.totalPanel||row.totalPanels||row.panel);
}
function monthNameID(dateObj){
  const names=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return names[dateObj.getMonth()]+' '+dateObj.getFullYear();
}
function dailyReportEntryStats(unitRows,today){
  const d=new Date(today+'T00:00:00');
  const monthPrefix=today.slice(0,7);
  const groups=['ATU 1','ATU 2'];
  const todayMap={},monthMap={};
  groups.forEach(function(g){todayMap[g]={units:0,panels:0};monthMap[g]={units:0,panels:0};});
  const seenToday={},seenMonth={};
  (Array.isArray(unitRows)?unitRows:[]).forEach(function(row,i){
    const dateKey=dailyReportDateOnly(dailyReportEntryDate(row));
    if(!dateKey)return;
    const group=dailyReportGroupName(row.GROUP||row.group||'');
    if(groups.indexOf(group)<0)return;
    const key=dailyReportUniqueKey(row,i);
    const panels=dailyReportPanelCount(row);
    if(dateKey===today && !seenToday[key]){seenToday[key]=true;todayMap[group].units++;todayMap[group].panels+=panels;}
    if(dateKey.slice(0,7)===monthPrefix && !seenMonth[key]){seenMonth[key]=true;monthMap[group].units++;monthMap[group].panels+=panels;}
  });
  return {today:todayMap,month:monthMap};
}
function dailyReportFinishedStats(unitRows,today){
  const dateKeys=['TGL SELESAI','TANGGAL SELESAI','TGL SELESAI UNIT','TANGGAL SELESAI UNIT','DATE SELESAI'];
  const groups=['ATU 1','ATU 2'];
  const result={total:0,groups:{'ATU 1':0,'ATU 2':0}};
  (Array.isArray(unitRows)?unitRows:[]).forEach(function(row,i){
    let raw='';
    for(let j=0;j<dateKeys.length;j++){if(row[dateKeys[j]]!=null && String(row[dateKeys[j]]).trim()!==''){raw=row[dateKeys[j]];break;}}
    if(!raw || dailyReportDateOnly(raw)!==today)return;
    // UNIT PAINTING dihitung berdasarkan setiap record yang memiliki TGL SELESAI
    // pada tanggal laporan. Jangan deduplikasi berdasarkan No PKB, karena satu
    // No PKB yang sama dapat menghasilkan lebih dari satu record selesai.
    result.total++;
    const g=dailyReportGroupName(row.GROUP||row.group||'');
    if(groups.indexOf(g)>=0) result.groups[g]++;
  });
  return result;
}
function dailyReportFinishedToday(unitRows,today){
  return dailyReportFinishedStats(unitRows,today).total;
}
function dailyReportProcessClass(name){
  const n=String(name||'').toUpperCase();
  if(n.indexOf('WAITING')>=0)return 'waiting';
  if(n.indexOf('ESTIMASI')>=0)return 'estimasi';
  if(n.indexOf('STOPPED')>=0)return 'stopped';
  if(n.indexOf('RAWAT')>=0)return 'rawat';
  return '';
}
function dailyReportBarChartSVG(processRows, labels, chartTitle){
  const W=1120,H=320,left=58,right=24,top=42,bottom=78;
  const plotW=W-left-right, plotH=H-top-bottom;
  const max=Math.max(1,...processRows.map(x=>Number(x.count)||0));
  const step=processRows.length ? plotW/processRows.length : plotW;
  const barW=Math.min(46,Math.max(24,step*0.58));
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img">';
  svg+='<rect width="100%" height="100%" fill="#fff"/>';
  svg+='<text x="'+left+'" y="22" font-family="Arial" font-size="15" font-weight="900" fill="#17212b">'+dailyReportEsc(chartTitle||'JUMLAH UNIT')+'</text>';
  for(let i=0;i<=5;i++){
    const y=top+plotH-(plotH*i/5), val=Math.round(max*i/5);
    svg+='<line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(W-right)+'" y2="'+y.toFixed(1)+'" stroke="#e5eaee" stroke-width="1"/>';
    svg+='<text x="'+(left-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-family="Arial" font-size="10" font-weight="700" fill="#7b8790">'+val+'</text>';
  }
  svg+='<line x1="'+left+'" y1="'+(top+plotH)+'" x2="'+(W-right)+'" y2="'+(top+plotH)+'" stroke="#87939c" stroke-width="1.5"/>';
  processRows.forEach(function(item,i){
    const x=left+i*step+(step-barW)/2;
    const count=Number(item.count)||0;
    const bh=count?Math.max(5,plotH*count/max):0;
    const y=top+plotH-bh;
    const colors=['#c9000a','#087bd1','#ef8b22','#45a66f','#9345dc','#e65a9d','#45525e'];
    if(count) svg+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="3" fill="'+colors[i%colors.length]+'"/>';
    svg+='<text x="'+(x+barW/2).toFixed(1)+'" y="'+Math.max(36,y-7).toFixed(1)+'" text-anchor="middle" font-family="Arial" font-size="12" font-weight="900" fill="#17212b">'+count+'</text>';
    const label=labels[item.name]||item.name;
    const words=String(label).split(' '); let line1=label,line2='';
    if(label.length>16){ const mid=Math.ceil(words.length/2); line1=words.slice(0,mid).join(' '); line2=words.slice(mid).join(' '); }
    svg+='<text x="'+(x+barW/2).toFixed(1)+'" y="'+(top+plotH+22)+'" text-anchor="middle" font-family="Arial" font-size="8.5" font-weight="900" fill="#33404a"><tspan x="'+(x+barW/2).toFixed(1)+'">'+dailyReportEsc(line1)+'</tspan>'+(line2?'<tspan x="'+(x+barW/2).toFixed(1)+'" dy="11">'+dailyReportEsc(line2)+'</tspan>':'')+'</text>';
  });
  svg+='</svg>'; return svg;
}
function dailyReportDonutSVG(total,missing,hasPkb){
  const W=260,H=175,cx=130,cy=78,r=54,sw=18;
  const pct=total?missing/total:0;
  const circ=2*Math.PI*r;
  const dash=(circ*pct).toFixed(2);
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">';
  svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#e0e5e8" stroke-width="'+sw+'"/>';
  if(missing>0) svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#c9000a" stroke-width="'+sw+'" stroke-dasharray="'+dash+' '+circ.toFixed(2)+'" stroke-linecap="butt" transform="rotate(-90 '+cx+' '+cy+')"/>';
  svg+='<text x="'+cx+'" y="'+(cy+3)+'" text-anchor="middle" font-family="Arial" font-size="26" font-weight="900" fill="#17212b">'+total+'</text>';
  svg+='<text x="'+cx+'" y="'+(cy+19)+'" text-anchor="middle" font-family="Arial" font-size="9" font-weight="900" fill="#66737d">UNIT INAP</text>';
  svg+='<circle cx="24" cy="150" r="5" fill="#c9000a"/><text x="36" y="154" font-family="Arial" font-size="9" font-weight="700" fill="#53616c">Belum PKB</text><text x="112" y="154" font-family="Arial" font-size="10" font-weight="900" fill="#c9000a">'+missing+'</text>';
  svg+='<circle cx="153" cy="150" r="5" fill="#aeb5ba"/><text x="165" y="154" font-family="Arial" font-size="9" font-weight="700" fill="#53616c">Sudah PKB</text><text x="241" y="154" text-anchor="end" font-family="Arial" font-size="10" font-weight="900" fill="#45525e">'+hasPkb+'</text>';
  svg+='</svg>';
  return svg;
}
async function downloadDailyReportImage(reportDate){
  const btn=document.querySelector('.daily-report-btn');
  const oldText=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='⏳ MEMBUAT REPORT...';}
  let stage=null;
  try{
    if(typeof html2canvas!=='function')throw new Error('Library gambar belum termuat. Periksa koneksi internet.');
    const selectedReportDate = reportDate || document.getElementById('unitInapDate')?.value || dailyReportTodayISO();
    const today=selectedReportDate;

    // Ambil JPCB terbaru + seluruh DATABASE UNIT agar status khusus
    // (ESTIMASI, WAITING SPK, JOB STOPPED, RAWAT JALAN) dan tanggal selesai
    // ikut masuk ke report.
    let jpcbData=jpcbLastData;
    const jr=await fetch(JPCB_API_URL+'?action=jpcb&ts='+Date.now(),{method:'GET',cache:'no-store'});
    if(jr.ok){
      const fresh=await jr.json();
      if(fresh && fresh.success!==false){jpcbData=fresh;jpcbLastData=fresh;}
    }
    if(!jpcbData || jpcbData.success===false)throw new Error('Data JPCB belum tersedia.');

    const ur=await fetch(JPCB_API_URL+'?action=unit&ts='+Date.now(),{method:'GET',cache:'no-store'});
    if(!ur.ok)throw new Error('Gagal mengambil DATABASE UNIT. HTTP '+ur.status);
    const unitApi=await ur.json();
    if(!unitApi || unitApi.success===false)throw new Error((unitApi&&unitApi.message)||'Data DATABASE UNIT tidak valid.');
    const unitRows=Array.isArray(unitApi.data)?unitApi.data:[];

    const ar=await fetch(JPCB_API_URL+'?action=unitInap&tanggal='+encodeURIComponent(today)+'&ts='+Date.now(),{method:'GET',cache:'no-store'});
    if(!ar.ok)throw new Error('Gagal mengambil audit Unit Inap hari ini. HTTP '+ar.status);
    const auditData=await ar.json();
    if(!auditData || auditData.success===false)throw new Error((auditData&&auditData.message)||'Data audit Unit Inap tidak valid.');

    const rows=Array.isArray(auditData.rows)?auditData.rows:[];
    const seen={}; const unique=[];
    rows.forEach(function(r,i){const key=dailyReportUniqueKey(r,i);if(!seen[key]){seen[key]=true;unique.push(r);}});
    const missing=unique.filter(function(r){return unitInapMissingPkb(r.noPKB);}).length;
    const hasPkb=Math.max(0,unique.length-missing);

    const wip=calculateJpcbWip(jpcbData);
    const overdue=collectJpcbOverdueUnits(jpcbData);
    const overdueGroups={
      'ATU 1':overdue.filter(function(u){return dailyReportGroupName(u.group)==='ATU 1';}).length,
      'ATU 2':overdue.filter(function(u){return dailyReportGroupName(u.group)==='ATU 2';}).length
    };
    const overdueWaitingDelivery=overdue.filter(function(u){
      const p=String(u.progress||'').trim().toUpperCase();
      return p==='16.WAITING DELIVERY' || p==='WAITING DELIVERY';
    }).length;
    const overdueNonWaitingDelivery=Math.max(0,overdue.length-overdueWaitingDelivery);
    const processRows=dailyReportProcessList(jpcbData,unitRows);
    const maxWip=Math.max(1,wip.atu1,wip.atu2,wip.bengkel);
    const maxLate=Math.max(1,overdueGroups['ATU 1'],overdueGroups['ATU 2']);
    const maxProc=Math.max(1,...processRows.map(function(x){return x.count;}));
    const finishedStats=dailyReportFinishedStats(unitRows,today);
    const finishedToday=finishedStats.total;
    const entryStats=dailyReportEntryStats(unitRows,today);
    const dateLabel=formatUnitInapDateLabel(today);
    const isTodayReport = today===dailyReportTodayISO();
    const reportMonthDate=new Date(today+'T00:00:00');
    const tunasSrc=(document.querySelector('.tunas-real-logo')||{}).src||'';
    const toyotaSrc=(document.querySelector('.toyota-real-logo')||{}).src||'';

    stage=document.createElement('div');
    stage.className='daily-report-stage';
    const report=document.createElement('div');
    report.className='daily-report';
    stage.appendChild(report); document.body.appendChild(stage);

    const missingPct=unique.length?Math.round(missing/unique.length*100):0;
    const hasPkbPct=unique.length?100-missingPct:0;
    const processLabels={
      '00.ESTIMASI':'ESTIMASI',
      '01.WAITING SPK':'WAITING SPK',
      '1.WAITING PANEL REPAIR':'WAITING PANEL REPAIR',
      '2.PANEL REPAIR':'PANEL REPAIR',
      '3.WAITING PUTTY':'WAITING PUTTY',
      '4.PUTTY':'PUTTY / DEMPUL',
      '5.WAITING SURFACER':'WAITING SURFACER',
      '6.SURFACER':'SURFACER',
      '7.WAITING PAINTING':'WAITING PAINTING',
      '8.PAINTING':'PAINTING',
      '9.WAITING POLISH':'WAITING POLISH',
      '10.POLISHING':'POLISHING',
      '11.WAITING REASSEMBLY':'WAITING REASSEMBLY',
      '12.REASSEMBLY':'REASSEMBLY',
      '13.WASHING/FINISHING':'WASHING / FINISHING',
      '14.WAITING FINAL CHECK':'WAITING FINAL CHECK',
      '15.FINAL CHECK':'FINAL CHECK',
      '18.JOB STOPPED':'JOB STOPPED',
      '19.RAWAT JALAN':'RAWAT JALAN'
    };

    report.innerHTML=
      '<div class="dr-header">'+
        '<div><img class="dr-logo" src="'+dailyReportEsc(tunasSrc)+'" alt="Tunas Toyota"></div>'+ 
        '<div class="dr-title"><h1>DAILY REPORT</h1><p>WORKSHOP OPERATION</p><span class="dr-date">📅 '+dailyReportEsc(dateLabel)+'</span></div>'+ 
        '<div><img class="dr-logo toyota" src="'+dailyReportEsc(toyotaSrc)+'" alt="Toyota Let’s Go Beyond"></div>'+ 
      '</div>'+ 
      '<div class="dr-accent"><span>DAILY DASHBOARD REPORT</span></div>'+ 
      '<div class="dr-kpis">'+
        '<div class="dr-kpi"><div class="label">UNIT INAP</div><div class="value">'+unique.length+'</div><div class="sub">Hasil audit '+(isTodayReport?'hari ini':dailyReportEsc(dateLabel))+'</div><div class="dr-kpi-mini"><span>Belum PKB</span><b>'+missing+'</b><span>Sudah PKB</span><b>'+hasPkb+'</b></div></div>'+ 
        '<div class="dr-kpi blue"><div class="label">TOTAL WIP</div><div class="value">'+wip.total+'</div><div class="sub">Non Delivery</div><div class="dr-kpi-mini"><span>ATU 1</span><b>'+wip.atu1+'</b><span>ATU 2</span><b>'+wip.atu2+'</b></div></div>'+ 
        '<div class="dr-kpi dark"><div class="label">WIP BENGKEL</div><div class="value">'+wip.bengkel+'</div><div class="sub">Hari ini • Group kosong</div><div class="dr-kpi-mini single"><span>Bagian dari total WIP</span><b>'+wip.bengkel+'</b></div></div>'+ 
        '<div class="dr-kpi orange"><div class="label">UNIT TERLAMBAT</div><div class="value">'+overdue.length+'</div><div class="sub">Janji selesai sudah lewat</div><div class="dr-kpi-mini"><span>ATU 1</span><b>'+overdueGroups['ATU 1']+'</b><span>ATU 2</span><b>'+overdueGroups['ATU 2']+'</b></div></di<div class=\"dr-kpi-mini\"><span>WAITING DELIVERY</span><b>'+overdueWaitingDelivery+'</b><span>BUKAN WAITING DELIVERY</span><b>'+overdueNonWaitingDelivery+'</b></div></div>'+ 
        '<div class="dr-kpi green"><div class="label">UNIT PAINTING</div><div class="value">'+finishedToday+'</div><div class="sub">Berdasarkan TGL SELESAI</div><div class="dr-kpi-mini"><span>ATU 1</span><b>'+finishedStats.groups['ATU 1']+'</b><span>ATU 2</span><b>'+finishedStats.groups['ATU 2']+'</b></div></div>'+ 
      '</div>'+ 
      '<div class="dr-entry-grid">'+
        '<div class="dr-entry-panel"><h2>UNIT MASUK <span class="red">'+(isTodayReport?'HARI INI':dailyReportEsc(dateLabel))+'</span></h2>'+
          '<div class="dr-entry-head"><span>GROUP</span><span style="text-align:right">UNIT</span><span style="text-align:right">PANEL</span></div>'+
          ['ATU 1','ATU 2'].map(function(k){return '<div class="dr-entry-row"><div class="name">'+k+'</div><div class="val">'+entryStats.today[k].units+'</div><div class="panel-val">'+entryStats.today[k].panels+'</div></div>';}).join('')+
          '<div class="dr-entry-total"><span>TOTAL HARI INI</span><b>'+['ATU 1','ATU 2'].reduce(function(a,k){return a+entryStats.today[k].units;},0)+'</b><b>'+['ATU 1','ATU 2'].reduce(function(a,k){return a+entryStats.today[k].panels;},0)+'</b></div>'+
        '</div>'+
        '<div class="dr-entry-panel"><h2>UNIT MASUK <span class="red">BULAN INI</span></h2><div class="dr-month-badge">Periode '+dailyReportEsc(monthNameID(reportMonthDate))+'</div>'+
          '<div class="dr-entry-head"><span>GROUP</span><span style="text-align:right">UNIT</span><span style="text-align:right">PANEL</span></div>'+
          ['ATU 1','ATU 2'].map(function(k){return '<div class="dr-entry-row"><div class="name">'+k+'</div><div class="val">'+entryStats.month[k].units+'</div><div class="panel-val">'+entryStats.month[k].panels+'</div></div>';}).join('')+
          '<div class="dr-entry-total"><span>TOTAL BULAN INI</span><b>'+['ATU 1','ATU 2'].reduce(function(a,k){return a+entryStats.month[k].units;},0)+'</b><b>'+['ATU 1','ATU 2'].reduce(function(a,k){return a+entryStats.month[k].panels;},0)+'</b></div>'+
        '</div>'+
      '</div>'+
      '<div class="dr-finished-group-panel"><div class="dr-panel"><h2>UNIT PAINTING <span class="red">PER GROUP • '+dailyReportEsc(dateLabel)+'</span></h2>'+
          ['ATU 1','ATU 2'].map(function(k){return '<div class="dr-row greenbar"><div class="name">'+k+'</div><div class="dr-bar"><span style="width:'+Math.round((finishedStats.groups[k]/Math.max(1,finishedToday))*100)+'%"></span></div><div class="num">'+finishedStats.groups[k]+'</div></div>';}).join('')+
          '<div class="dr-total finish"><span>TOTAL SELESAI • '+dailyReportEsc(dateLabel)+'</span><strong>'+finishedToday+'</strong></div>'+
        '</div></div>'+
      '<div class="dr-grid3">'+
        '<div class="dr-panel"><h2>WIP <span class="red">PER GROUP</span></h2>'+ 
          [['ATU 1',wip.atu1],['ATU 2',wip.atu2],['WIP BENGKEL',wip.bengkel]].map(function(x){return '<div class="dr-row"><div class="name">'+x[0]+'</div><div class="dr-bar"><span style="width:'+Math.round(x[1]/maxWip*100)+'%"></span></div><div class="num">'+x[1]+'</div></div>';}).join('')+
          '<div class="dr-total"><span>TOTAL WIP</span><strong>'+wip.total+'</strong></div>'+ 
        '</div>'+ 
        '<div class="dr-panel"><h2>UNIT TERLAMBAT <span class="red">PER GROUP</span></h2>'+ 
          Object.keys(overdueGroups).map(function(k){return '<div class="dr-row redbar"><div class="name">'+k+'</div><div class="dr-bar"><span style="width:'+Math.round(overdueGroups[k]/maxLate*100)+'%"></span></div><div class="num">'+overdueGroups[k]+'</div></div>';}).join('')+
          '<div class="dr-late-split"><div><span>WAITING DELIVERY</span><strong>'+overdueWaitingDelivery+'</strong></div><div><span>BUKAN WAITING DELIVERY</span><strong>'+overdueNonWaitingDelivery+'</strong></div></div>'+
          '<div class="dr-total late"><span>TOTAL TERLAMBAT</span><strong>'+overdue.length+'</strong></div>'+ 
        '</div>'+ 
        '<div class="dr-panel dr-pkb"><h2>STATUS PKB <span class="red">UNIT INAP</span></h2>'+ 
          '<div class="dr-pkb-svg">'+dailyReportDonutSVG(unique.length,missing,hasPkb)+'</div>'+ 
        '</div>'+ 
      '</div>'+ 
      '<div class="dr-process"><h2>JUMLAH UNIT PER PROSES</h2><div class="dr-process-split"><div class="dr-process-chart">'+dailyReportBarChartSVG(processRows.filter(function(x){return dailyReportProcessClass(x.name)==='waiting'||dailyReportProcessClass(x.name)==='estimasi';}),processLabels,'WAITING')+'</div><div class="dr-process-chart">'+dailyReportBarChartSVG(processRows.filter(function(x){return dailyReportProcessClass(x.name)!=='waiting'&&dailyReportProcessClass(x.name)!=='estimasi';}),processLabels,'PROSES')+'</div></div></div>'+ 
      '<div class="dr-grid2 compact">'+
        '<div class="dr-panel"><h2>RINGKASAN <span class="red">AKTIVITAS HARI INI</span></h2>'+ 
          '<div class="dr-summary-list">'+
            '<div><span>📋 Unit Audit Unit Inap • '+dailyReportEsc(dateLabel)+'</span><b>'+unique.length+'</b></div>'+ 
            '<div><span>📄 Belum Ada PKB</span><b>'+missing+'</b></div>'+ 
            '<div><span>✓ Sudah Ada PKB</span><b>'+hasPkb+'</b></div>'+ 
            '<div><span>⚙ Unit Masih Proses (WIP)</span><b>'+wip.total+'</b></div>'+ 
            '<div><span>🏭 WIP Bengkel Hari Ini</span><b>'+wip.bengkel+'</b></div>'+ 
            '<div><span>⚠ Unit Terlambat</span><b>'+overdue.length+'</b></div>'+
            '<div><span>↳ Waiting Delivery</span><b>'+overdueWaitingDelivery+'</b></div>'+
            '<div><span>↳ Bukan Waiting Delivery</span><b>'+overdueNonWaitingDelivery+'</b></div>'+ 
            '<div><span>✅ Unit Selesai • '+dailyReportEsc(dateLabel)+'</span><b style="color:#22a66f">'+finishedToday+'</b></div>'+ 
          '</div>'+ 
        '</div>'+ 
        '<div class="dr-panel"><h2>RINGKASAN <span class="red">STATUS</span></h2>'+ 
          '<div class="dr-summary-list">'+
            '<div><span>🔴 Job Stopped</span><b>'+((processRows.find(function(x){return x.name==='18.JOB STOPPED';})||{}).count||0)+'</b></div>'+ 
            '<div><span>🟠 Estimasi</span><b>'+((processRows.find(function(x){return x.name==='00.ESTIMASI';})||{}).count||0)+'</b></div>'+ 
            '<div><span>⚪ Waiting SPK</span><b>'+((processRows.find(function(x){return x.name==='01.WAITING SPK';})||{}).count||0)+'</b></div>'+ 
            '<div><span>🔵 Rawat Jalan</span><b>'+((processRows.find(function(x){return x.name==='19.RAWAT JALAN';})||{}).count||0)+'</b></div>'+ 
            '<div><span>📦 Total WIP</span><b>'+wip.total+'</b></div>'+ 
            '<div><span>🚘 Selesai • '+dailyReportEsc(dateLabel)+'</span><b style="color:#22a66f">'+finishedToday+'</b></div>'+ 
            '<div><span>↳ ATU 1</span><b>'+finishedStats.groups['ATU 1']+'</b></div>'+ 
            '<div><span>↳ ATU 2</span><b>'+finishedStats.groups['ATU 2']+'</b></div>'+ 
            
          '</div>'+ 
        '</div>'+ 
      '</div>'+ 
      '<div class="dr-audit-summary-only"><div><span>HASIL AUDIT UNIT INAP • '+dailyReportEsc(dateLabel)+'</span><b>'+unique.length+'</b></div><div><span>BELUM ADA PKB</span><b>'+missing+'</b></div><div><span>TOTAL WIP</span><b>'+wip.total+'</b></div><div class="dr-finish-box"><span>UNIT PAINTING • '+dailyReportEsc(dateLabel)+'</span><b>'+finishedToday+'</b></div></div>'+ 
      '<div class="dr-great">GREAT PEOPLE <span>GREAT RESULT</span></div>'+ 
      '<div class="dr-footer"><div>🛡 SAFETY</div><div>⚙ QUALITY</div><div>◷ ON TIME</div><div>👥 CUSTOMER SATISFACTION</div><div class="dr-footer-logo">TOYOTA • LET’S GO BEYOND</div></div>';

    await new Promise(function(resolve){
      const imgs=Array.from(report.querySelectorAll('img'));
      if(!imgs.length){resolve();return;}
      let left=imgs.length;
      imgs.forEach(function(img){
        if(img.complete){left--;if(left===0)resolve();}
        else {img.onload=img.onerror=function(){left--;if(left===0)resolve();};}
      });
      setTimeout(resolve,1500);
    });

    const canvas=await html2canvas(report,{backgroundColor:'#eef2f5',scale:Math.min(2,Math.max(1,window.devicePixelRatio||1)),useCORS:true,allowTaint:false,logging:false,width:1200,height:report.scrollHeight,windowWidth:1200,windowHeight:report.scrollHeight});
    const link=document.createElement('a');
    link.download='Daily_Report_'+today.replace(/-/g,'')+'.png';
    link.href=canvas.toDataURL('image/png');
    link.click();
  }catch(err){
    console.error('Daily Report:',err);
    alert('Gagal membuat Daily Report.\n'+(err&&err.message?err.message:err));
  }finally{
    if(stage&&stage.parentNode)stage.parentNode.removeChild(stage);
    if(btn){btn.disabled=false;btn.textContent=oldText||'⬇ DAILY REPORT';}
  }
}

async function loadUnitInap(dateValue){
  if(unitInapLoading)return;
  unitInapLoading=true;
  const body=document.getElementById('unitInapBody');
  const status=document.getElementById('unitInapStatus');
  if(status)status.textContent='Mengambil audit unit inap...';
  if(body && !body.children.length)body.innerHTML='<tr><td colspan="6" class="unitinap-empty">Memuat data...</td></tr>';
  try{
    let url=JPCB_API_URL+'?action=unitInap&ts='+Date.now();
    if(dateValue)url+='&tanggal='+encodeURIComponent(dateValue);
    const r=await fetch(url,{method:'GET',cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();
    if(!data||data.success===false)throw new Error((data&&data.message)||'Response Unit Inap tidak valid');
    renderUnitInap(data);
  }catch(e){
    console.error('Unit Inap API:',e);
    if(status)status.textContent='Gagal mengambil data Unit Inap';
    if(body)body.innerHTML='<tr><td colspan="6" class="unitinap-empty">Gagal mengambil data audit unit inap.<br><small>'+escapeHtml(e.message||'Error')+'</small></td></tr>';
  }finally{unitInapLoading=false;}
}

function openUnitInapPage(){
  const input=document.getElementById('unitInapDate');
  // Saat menu pertama kali dibuka, backend menentukan tanggal terbaru.
  if(!unitInapLastDate && input && !input.value){
    loadUnitInap('');
  }else if(input && input.value){
    loadUnitInap(input.value);
  }else{
    loadUnitInap('');
  }
}

async function loadJPCB(){
  if(jpcbLoading)return;
  jpcbLoading=true;
  setJpcbApiStatus('loading','Memuat data...');
  try{
    const response=await fetch(JPCB_API_URL+'?action=jpcb&ts='+Date.now(),{
      method:'GET',
      cache:'no-store'
    });
    if(!response.ok) throw new Error('HTTP '+response.status);
    const data=await response.json();

    jpcbLastData=data;
    detectJpcbChanges(data);
    renderJPCB(data);
    if(document.getElementById('overdue')?.classList.contains('active')) renderJpcbOverdue(data);
  }catch(error){
    console.error('JPCB API:',error);
    setJpcbApiStatus('error','Gagal terhubung');
    const board=document.getElementById('jpcbBoard');
    if(board && !jpcbInitialSnapshot){
      board.innerHTML='<div class="empty">Gagal mengambil data dari Apps Script. Periksa deployment Web App dan akses Anyone.</div>';
    }
  }finally{
    jpcbLoading=false;
  }
}

if(window.__MODULE_PAGE__==='jpcb' || window.__MODULE_PAGE__==='overdue'){
  loadJPCB();
  // Live polling: cek perubahan database setiap 15 detik.
  setInterval(loadJPCB,15000);
}


const SEARCH_API_URL='https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec';
function openUnit(nopol,team,entry,promise,type='',sa='',progress='',extra={}){
  openJpcbUnitDetail(Object.assign({nopol:nopol,group:team,tglMasuk:entry,janjiSelesai:promise,type:type,sa:sa,progress:progress},extra||{}));
}
function openJpcbUnitDetail(unit){
  unit=unit||{};
  const modal=document.getElementById('unitModal');
  const title=document.getElementById('modalTitle');
  const sub=document.getElementById('modalSub');
  const body=document.getElementById('modalDetailBody');
  if(!modal||!body)return;

  const nopol=String(unit.nopol||unit.noPolisi||'').trim();
  const noPKB=String(unit.noPKB||unit.noPkb||unit.pkb||'').trim();

  if(title)title.textContent='DETAIL UNIT — '+(nopol||noPKB||'-');
  if(sub)sub.textContent='JPCB • Detail progress, audit WIP & log update';
  body.innerHTML='<div class="detail-loading">Mengambil detail unit...<span>'+escapeHtml(nopol||noPKB||'-')+'</span></div>';
  modal.classList.add('show');

  const url=JPCB_API_URL+
    '?action=unitDetail'+
    '&nopol='+encodeURIComponent(nopol)+
    '&noPKB='+encodeURIComponent(noPKB)+
    '&ts='+Date.now();

  fetch(url,{method:'GET',cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){
      if(!d||d.success===false)throw new Error((d&&d.message)||'Response unitDetail tidak valid');
      renderJpcbDetailBase(Object.assign({},unit,d.unit||{}),d);
    })
    .catch(function(err){
      console.error('JPCB unitDetail:',err);
      body.innerHTML='<div class="detail-empty">Gagal mengambil detail unit.<br><small>'+escapeHtml(err.message||'Error')+'</small></div>';
    });
}

function renderJpcbDetailBase(unit,extra){
  const body=document.getElementById('modalDetailBody');
  if(!body)return;
  extra=extra||{};
  const progress=unit.progress||'';
  const idx=JPCB_MASTER.indexOf(progress);
  const audits=Array.isArray(extra.audits)?extra.audits:[];
  const logs=Array.isArray(extra.logs)?extra.logs:[];

  const steps=JPCB_MASTER.map(function(v,i){
    return '<div class="detail-step '+(idx>=0&&i<idx?'done ':'')+(idx===i?'current':'')+'">'+
      '<span class="detail-step-dot"></span><span>'+escapeHtml(jpcbDisplayName(v))+'</span></div>';
  }).join('');

  const auditHtml=audits.length?audits.map(function(a){
    return '<div class="detail-history-item">'+
      '<div class="history-date">'+escapeHtml(a.tanggalAudit||'-')+'</div>'+
      '<strong>'+escapeHtml(a.progress||'-')+'</strong>'+
      '<span>Status PKB: '+escapeHtml(a.statusPKB||'-')+'</span>'+ 
      '<span>Catatan: '+escapeHtml(a.catatan||'-')+'</span>'+ 
      '<span>User: '+escapeHtml(a.user||'-')+'</span>'+ 
      '</div>';
  }).join(''):'<div class="detail-empty">Belum ada data Audit WIP.</div>';

  const logHtml=logs.length?logs.map(function(l){
    return '<div class="detail-history-item">'+
      '<div class="history-date">'+escapeHtml(l.timestamp||'-')+'</div>'+
      '<span>Keterangan: '+escapeHtml(l.keterangan||'-')+'</span>'+
      '</div>';
  }).join(''):'<div class="detail-empty">Belum ada data UPDATE.</div>';

  function f(label,value){
    return '<div class="profile-field"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value||'-')+'</strong></div>';
  }

  body.innerHTML=
    '<div class="detail-profile-grid">'+
      f('NO POLISI',unit.nopol)+
      f('NO PKB',unit.noPKB||unit.noPkb||unit.pkb)+
      f('GROUP',unit.group)+
      f('TYPE',unit.type)+
      f('SERVICE ADVISOR',unit.sa||unit.SA||unit.serviceAdvisor||unit.service_advisor)+
      f('JUMLAH PANEL',unit.jumlahPanel||unit.jumlahpanel||unit.panel||unit.panels||unit.totalPanel||unit.totalPanels)+
      f('KERUSAKAN',unit.kerusakan||unit.KERUSAKAN)+
      f('INSURANCE',unit.insurance||unit.asuransi)+
      f('TANGGAL MASUK',unit.tglMasuk)+
      f('JANJI SELESAI',unit.janjiSelesai)+
      f('PROGRESS SAAT INI',jpcbDisplayName(progress))+ 
    '</div>'+ 
    '<div class="detail-current-progress"><span>PROGRESS SAAT INI</span><strong>'+escapeHtml(jpcbDisplayName(progress)||'-')+'</strong></div>'+ 
    '<div class="detail-section"><h4>TRACKING PROSES</h4><div class="detail-timeline">'+steps+'</div></div>'+ 
    '<div class="detail-two-col">'+
      '<div class="detail-section"><h4>HISTORI AUDIT WIP ('+audits.length+')</h4><div class="detail-history">'+auditHtml+'</div></div>'+ 
      '<div class="detail-section"><h4>LOG UPDATE UNIT ('+logs.length+')</h4><div class="detail-history">'+logHtml+'</div></div>'+ 
    '</div>';
}

function closeModal(event){if(event&&event.target&&event.target.id!=='unitModal')return;const m=document.getElementById('unitModal');if(m)m.classList.remove('show');}document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
function getJpcbDamageClass(item) {
  const k = String((item && (item.kerusakan || item.KERUSAKAN)) || '').trim().toUpperCase();
  if (k === 'LIGHT') return 'damage-light';
  if (k === 'MEDIUM') return 'damage-medium';
  if (k === 'HEAVY') return 'damage-heavy';
  return '';
}
function isJpcbOverdue(item) {
  const raw = item && (item.janjiSelesai || item['JANJI SELESAI']);
  if (!raw) return false;
  let d = new Date(raw);
  if (isNaN(d.getTime())) {
    const m = String(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return false;
    d = new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
  }
  if (isNaN(d.getTime())) return false;
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return d < today;
}

