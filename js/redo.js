
/* ================= REDO MONITORING MODULE =================
   Isolated namespace: REDOMonitor
   Existing JPCB/JPCB Daily Report functions are not replaced.
   If a dedicated REDO API is deployed, put its /exec URL below.
*/
window.REDOMonitor=(function(){
  'use strict';
  var REDO_API_URL='https://script.google.com/macros/s/AKfycbzW_1V3ickfa1PVCEWtvem8PN8xTh9ho9nv-jKzogbIeL3n2slWwLzkjZuuPQgz2dII/exec';
  var now=new Date(), year=now.getFullYear(), month=new Date(year,now.getMonth(),1);
  var mode='MTD', group='ALL', raw={redo:[],completed:[]}, loading=false;
  var DEFECTS=['STRETCH','ORANGE PEEL','RUNS/LELEH','FISH EYE','DUST/KOTOR','COLOR MISMATCH','SOLVENT POPING','PIN HOLE','MOTTLING','PANEL WAVE/GELOMBANG','DENT/PENYOK','PANEL GAP','BURAM','CAT TERKELUPAS','POOR GLOSS'];
  var PREP=['PIN HOLE','STRETCH','PANEL WAVE/GELOMBANG','DENT/PENYOK'];
  var FI=['PANEL GAP','BURAM','CAT TERKELUPAS','POOR GLOSS'];
  var PAINT=DEFECTS.filter(function(d){return PREP.indexOf(d)<0&&FI.indexOf(d)<0});
  var PROCESS={PREPARATION:PREP,PAINTING:PAINT,'FINAL INSPECTION':FI};

  function key(v){return String(v==null?'':v).trim().toUpperCase().replace(/\s+/g,' ')}
  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]})}
  function num(v){var n=Number(v);return isFinite(n)?n:0}
  function date(v){
    if(v===null||v===undefined||String(v).trim()==='')return null;
    if(v instanceof Date)return isNaN(v)?null:v;
    var t=String(v).trim(),m=t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if(m)return new Date(+m[3],+m[2]-1,+m[1]);
    var d=new Date(t);return isNaN(d)?null:d;
  }
  function monthEnd(d){return new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59,999)}
  function inMonth(v,m){var d=date(v);return !!d&&d.getFullYear()===m.getFullYear()&&d.getMonth()===m.getMonth()}
  function inYear(v,y){var d=date(v);return !!d&&d.getFullYear()===y}
  function inPeriod(v){
    var d=date(v); if(!d||d.getFullYear()!==year)return false;
    if(mode==='MTD')return d.getMonth()===month.getMonth();
    return d<=monthEnd(month);
  }
  function groupOf(x){return key(x&&(x.group||x.grup||x.ATU||x.GROUP||''))}
  function groupMatch(x){if(group==='ALL')return true;var g=groupOf(x),w=key(group);return g===w||g===w.replace(' ','')}
  function unitKey(x){return key(x&&(x.nopol||x['NO POLISI']||x.nopolisi||''))}
  function defect(x){
    var vals=[x&&x.defect,x&&x.alasan,x&&x.keterangan,x&&x.DEFECT,x&&x.ALASAN,x&&x.KETERANGAN,x&&x['NAMA DEFECT'],x&&x['JENIS DEFECT'],x&&x['JENIS REDO'],x&&x.jenis,x&&x.process,x&&x['PROSES REDO']];
    for(var j=0;j<vals.length;j++){var r=key(vals[j]);if(r==='SCRETCH')r='STRETCH';if(!r)continue;for(var i=0;i<DEFECTS.length;i++)if(r===DEFECTS[i]||r.indexOf(DEFECTS[i])>=0)return DEFECTS[i]}
    return '';
  }
  function typeOfDefect(d){
    if(PREP.indexOf(d)>=0)return 'PREPARATION';
    if(FI.indexOf(d)>=0)return 'FINAL INSPECTION';
    return 'PAINTING';
  }
  function processOf(x){
    var d=defect(x);
    if(d)return typeOfDefect(d);
    var p=key(x&&(x.process||x.jenis||x['JENIS REDO']||x['PROSES REDO']||''));
    if(p.indexOf('FINAL')>=0||p.indexOf('INSPECTION')>=0||p.indexOf('FINAL CHECK')>=0)return 'FINAL INSPECTION';
    return 'PAINTING';
  }
  function panelOf(x){
    var v=x&&(x.panel!=null?x.panel:(x.PANEL!=null?x.PANEL:(x.jumlahPanel!=null?x.jumlahPanel:x['JUMLAH PANEL'])));
    if(typeof v==='number')return isFinite(v)?v:0;
    var s=String(v==null?'':v).trim().replace(/\s/g,'');if(!s)return 0;
    if(/^\d+[.,]\d+$/.test(s))s=s.replace(',','.');else s=s.replace(/[^0-9-]/g,'');
    var n=Number(s);return isFinite(n)?n:0;
  }
  function redoDate(x){return x&&(x.date||x.tanggal||x.start||x['TANGGAL REDO']||x['TGL REDO']||x.timestamp)}
  function completedDate(x){return x&&(x.completionDate||x.tanggal||x.delivery||x['TGL SELESAI']||x['TANGGAL SELESAI']||x['TGL DELIVERY']||x['TANGGAL DELIVERY']||x.date)}
  function uniqueUnits(arr){var set=new Set();(arr||[]).forEach(function(x){if(!groupMatch(x))return;var k=unitKey(x);if(k)set.add(k)});return set.size}
  function pct(a,b){a=num(a);b=num(b);return b?(a/b*100).toFixed(1)+'%':'0.0%'}
  function periodLabel(){return month.toLocaleDateString('id-ID',{month:'long',year:'numeric'}).toUpperCase()}
  function monthLabel(i){return new Date(year,i,1).toLocaleDateString('id-ID',{month:'short'}).replace('.','').toUpperCase()}

  function initMonthSelect(){
    var el=document.getElementById('redoMonthSelect');if(!el)return;
    el.innerHTML='';
    for(var i=0;i<12;i++){var o=document.createElement('option');o.value=i;o.textContent=new Date(year,i,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'}).toUpperCase();if(i===month.getMonth())o.selected=true;el.appendChild(o)}
  }
  function filteredRedo(){return raw.redo.filter(function(x){return groupMatch(x)&&inPeriod(redoDate(x))})}
  function filteredCompleted(){return raw.completed.filter(function(x){return groupMatch(x)&&inPeriod(completedDate(x))})}
  function statsFor(redo,done){
    var units=uniqueUnits(redo),doneUnits=uniqueUnits(done);
    var panels=redo.reduce(function(s,x){var p=panelOf(x);return s+(p>0?p:1)},0);
    var donePanels=done.reduce(function(s,x){return s+panelOf(x)},0);
    return {units:units,panels:panels,doneUnits:doneUnits,donePanels:donePanels,totalDefect:redo.filter(function(x){return !!defect(x)}).length,
      paint:redo.filter(function(x){return typeOfDefect(defect(x))==='PAINTING'}).length,
      fi:redo.filter(function(x){return typeOfDefect(defect(x))==='FINAL INSPECTION'}).length};
  }
  function renderKpi(){
    var r=filteredRedo(),d=filteredCompleted(),z=statsFor(r,d),e;
    e=document.getElementById('redoKpiDefectTotal');if(e)e.textContent=z.totalDefect;
    e=document.getElementById('redoKpiUnit');if(e)e.textContent=z.units;
    e=document.getElementById('redoKpiPanel');if(e)e.textContent=z.panels;
    e=document.getElementById('redoKpiUnitPct');if(e)e.textContent=pct(z.units,z.doneUnits);
    e=document.getElementById('redoKpiPanelPct');if(e)e.textContent=pct(z.panels,z.donePanels);
    e=document.getElementById('redoKpiPaint');if(e)e.textContent=z.paint;
    e=document.getElementById('redoKpiFI');if(e)e.textContent=z.fi;
    e=document.getElementById('redoKpiPaintPct');if(e)e.textContent=pct(z.paint,z.totalDefect)+' dari defect';
    e=document.getElementById('redoKpiFIPct');if(e)e.textContent=pct(z.fi,z.totalDefect)+' dari defect';
    e=document.getElementById('redoKpiUnitSub');if(e)e.textContent=mode==='MTD'?periodLabel():'YTD s/d '+periodLabel();
    e=document.getElementById('redoKpiPanelSub');if(e)e.textContent=mode==='MTD'?periodLabel():'YTD s/d '+periodLabel();
    e=document.getElementById('redoPaintingTableTitle');if(e)e.innerHTML='REKAP REDO PAINTING — '+mode+' <span class="redo-target">TARGET &lt; 9%</span>';
    e=document.getElementById('redoFiTableTitle');if(e)e.innerHTML='REKAP REDO FINAL INSPECTION (FI) — '+mode+' <span class="redo-target">TARGET &lt; 5%</span>';
    e=document.getElementById('redoParetoTitle');if(e)e.textContent='PARETO TOP 10 DEFECT — '+mode;
    e=document.getElementById('redoPeriod');if(e)e.textContent=periodLabel();
  }

  function doneRowsForDate(dt,granularity){
    var list=raw.completed.filter(function(x){
      if(!groupMatch(x))return false;
      var d=date(completedDate(x));if(!d)return false;
      if(granularity==='day'){
        return d.getFullYear()===dt.getFullYear()&&d.getMonth()===dt.getMonth()&&d.getDate()===dt.getDate();
      }
      return d.getFullYear()===dt.getFullYear()&&d.getMonth()===dt.getMonth();
    });
    var units=new Set(),panels=0;
    list.forEach(function(x){
      var k=unitKey(x);if(k)units.add(k);
      panels+=panelOf(x);
    });
    return {unit:units.size,panel:panels};
  }

  function redoRowsForDate(dt,granularity,process){
    var rr=raw.redo.filter(function(x){
      if(!groupMatch(x))return false;
      var d=date(redoDate(x));
      if(!d)return false;
      if(process && processOf(x)!==process)return false;
      if(granularity==='day'){
        return d.getFullYear()===dt.getFullYear()&&d.getMonth()===dt.getMonth()&&d.getDate()===dt.getDate();
      }
      return d.getFullYear()===dt.getFullYear()&&d.getMonth()===dt.getMonth();
    });
    var units=new Set(),panels=0;
    rr.forEach(function(x){
      var k=unitKey(x);if(k)units.add(k);
      var p=panelOf(x);panels+=p>0?p:1;
    });
    return {unit:units.size,panel:panels};
  }

  function dayRows(m,process){
    var days=new Date(m.getFullYear(),m.getMonth()+1,0).getDate(),out=[];
    for(var day=1;day<=31;day++){
      var valid=day<=days,dt=new Date(m.getFullYear(),m.getMonth(),day);
      var r=valid?redoRowsForDate(dt,'day',process):{unit:0,panel:0};
      var d=valid?doneRowsForDate(dt,'day'):{unit:0,panel:0};
      out.push({label:String(day).padStart(2,'0'),valid:valid,unitDone:d.unit,panelDone:d.panel,unitRedo:r.unit,panelRedo:r.panel});
    }
    return out;
  }

  function monthRows(process){
    var out=[];
    for(var mi=0;mi<12;mi++){
      var m=new Date(year,mi,1),valid=mi<=month.getMonth();
      var r=valid?redoRowsForDate(m,'month',process):{unit:0,panel:0};
      var d=valid?doneRowsForDate(m,'month'):{unit:0,panel:0};
      out.push({label:monthLabel(mi),valid:valid,unitDone:d.unit,panelDone:d.panel,unitRedo:r.unit,panelRedo:r.panel});
    }
    return out;
  }

  function tableHtml(rows,title,target){
    var html='<table class="redo-daily-table redo-process-table"><thead><tr><th>'+title+'</th>';
    rows.forEach(function(r){html+='<th class="'+(r.valid?'':'redo-disabled')+'">'+r.label+'</th>';});
    html+='<th class="redo-summary-head">JUMLAH</th><th class="redo-summary-head">RATA-RATA</th></tr></thead><tbody>';

    var isFI = String(title||'').toUpperCase().indexOf('FINAL INSPECTION')>=0;
    var metrics=[
      [isFI?'UNIT FI':'UNIT PAINTING','unitDone',false],
      [isFI?'PANEL FI':'PANEL PAINTING','panelDone',false],
      ['UNIT REDO','unitRedo',false],
      ['PANEL REDO','panelRedo',false],
      ['% UNIT REDO','unitPct',true],
      ['% PANEL REDO','panelPct',true]
    ];

    rows.forEach(function(r){
      var ud=r.unitDone||0, pd=r.panelDone||0, ur=r.unitRedo||0, pr=r.panelRedo||0;
      r.unitPct=ud>0?(ur/ud*100):0;
      r.panelPct=pd>0?(pr/pd*100):0;
    });

    metrics.forEach(function(m){
      var valid=rows.filter(function(r){return r.valid});
      var total=valid.reduce(function(s,r){return s+(Number(r[m[1]])||0)},0);
      var avg=valid.length?total/valid.length:0;

      html+='<tr><th>'+m[0]+'</th>';
      rows.forEach(function(r){
        if(!r.valid){html+='<td class="redo-disabled">—</td>';return}
        var v=Number(r[m[1]])||0;
        var cls='normal';
        if(v===0)cls='zero';
        else if(m[2] && v>target)cls='target-over';
        html+='<td class="'+cls+'">'+(m[2]?v.toFixed(1)+'%':Math.round(v))+'</td>';
      });

      /* JUMLAH untuk persentase adalah total redo / total selesai, bukan penjumlahan persen. */
      var summaryText,summaryValue;
      if(m[1]==='unitPct'){
        var totalRedo=valid.reduce(function(s,r){return s+(r.unitRedo||0)},0);
        var totalDone=valid.reduce(function(s,r){return s+(r.unitDone||0)},0);
        summaryValue=totalDone?totalRedo/totalDone*100:0;
        summaryText=summaryValue.toFixed(1)+'%';
      }else if(m[1]==='panelPct'){
        var totalRedoP=valid.reduce(function(s,r){return s+(r.panelRedo||0)},0);
        var totalDoneP=valid.reduce(function(s,r){return s+(r.panelDone||0)},0);
        summaryValue=totalDoneP?totalRedoP/totalDoneP*100:0;
        summaryText=summaryValue.toFixed(1)+'%';
      }else{
        summaryValue=total;
        summaryText=String(Math.round(total));
      }

      var scls=summaryValue===0?'zero':(m[2]&&summaryValue>target?'target-over':'normal');
      var avgCls=avg===0?'zero':(m[2]&&avg>target?'target-over':'normal');
      var avgText=m[2]?avg.toFixed(1)+'%':avg.toFixed(1);

      html+='<td class="redo-summary '+scls+'">'+summaryText+'</td>';
      html+='<td class="redo-summary avg '+avgCls+'">'+avgText+'</td></tr>';
    });
    return html+'</tbody></table>';
  }

  function renderTables(){
    var pRows=mode==='MTD'?dayRows(month,'PAINTING'):monthRows('PAINTING');
    var fRows=mode==='MTD'?dayRows(month,'FINAL INSPECTION'):monthRows('FINAL INSPECTION');
    var p=document.getElementById('redoPaintingTableHost'),f=document.getElementById('redoFiTableHost');
    if(p)p.innerHTML=tableHtml(pRows,'REDO PAINTING',9);
    if(f)f.innerHTML=tableHtml(fRows,'REDO FINAL INSPECTION (FI)',5);
  }

  function defectMap(arr){
    var map={};DEFECTS.forEach(function(d){map[d]=0});
    arr.forEach(function(x){var d=defect(x);if(d)map[d]++});
    return map;
  }
  function renderPareto(){
    function draw(hostId,titleId,modeType){
      var el=document.getElementById(hostId);if(!el)return;
      var arr=DEFECTS.map(function(d,i){
        var n=filteredRedo().filter(function(x){
          var p=processOf(x);
          var include=modeType==='PAINTING_PREP'
            ? (p==='PREPARATION'||p==='PAINTING')
            : p==='FINAL INSPECTION';
          return include && defect(x)===d;
        }).length;
        return [d,n,i];
      }).sort(function(a,b){return (b[1]-a[1])||(a[2]-b[2])}).slice(0,10);

      var total=arr.reduce(function(s,x){return s+x[1]},0);
      if(!arr.length){
        el.innerHTML='<div class="redo-defect-empty">Belum ada defect master</div>';
        return;
      }

      var W=980,H=360,left=48,right=52,top=28,bottom=92;
      var chartW=W-left-right,chartH=H-top-bottom,step=chartW/10;
      var barW=Math.min(48,step*.62),max=Math.max(1,arr[0][1]),cum=0,pts=[],svg='';

      [0,.25,.5,.75,1].forEach(function(p){
        var y=top+chartH-p*chartH;
        svg+='<line class="redo-pareto-gridline" x1="'+left+'" y1="'+y+'" x2="'+(W-right)+'" y2="'+y+'"></line>'+
             '<text class="redo-pareto-pct" x="'+(W-right+7)+'" y="'+(y+3)+'">'+Math.round(p*100)+'%</text>';
      });

      arr.forEach(function(x,i){
        var cx=left+step*i+step/2,bh=x[1]>0?(x[1]/max)*chartH:0,by=top+chartH-bh;
        if(bh>0)svg+='<rect class="redo-pareto-bar-svg" x="'+(cx-barW/2)+'" y="'+by+'" width="'+barW+'" height="'+bh+'" rx="3"></rect>';
        svg+='<text class="redo-pareto-value-svg" text-anchor="middle" x="'+cx+'" y="'+Math.max(top+12,by-6)+'">'+x[1]+'</text>';

        var parts=x[0].split(' '),l1=parts.slice(0,2).join(' '),l2=parts.slice(2).join(' ');
        svg+='<text class="redo-pareto-label-svg" text-anchor="middle" x="'+cx+'" y="'+(top+chartH+19)+'">'+
             '<tspan x="'+cx+'">'+esc(l1)+'</tspan><tspan x="'+cx+'" dy="12">'+esc(l2)+'</tspan></text>';

        if(total>0){
          cum+=x[1];
          var cp=cum/total*100,py=top+chartH-(cp/100)*chartH;
          pts.push([cx,py]);
          svg+='<text class="redo-pareto-pct" text-anchor="middle" x="'+cx+'" y="'+Math.max(top+11,py-8)+'">'+cp.toFixed(0)+'%</text>';
        }
      });

      svg+='<line class="redo-pareto-axis" x1="'+left+'" y1="'+(top+chartH)+'" x2="'+(W-right)+'" y2="'+(top+chartH)+'"></line>';
      if(pts.length){
        svg+='<polyline class="redo-pareto-line" points="'+pts.map(function(p){return p[0]+','+p[1]}).join(' ')+'"></polyline>';
        pts.forEach(function(p){svg+='<circle class="redo-pareto-point" cx="'+p[0]+'" cy="'+p[1]+'" r="4"></circle>';});
      }

      el.innerHTML='<svg class="redo-pareto-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+svg+'</svg>';
    }

    draw('redoParetoPainting','redoParetoPaintingTitle','PAINTING_PREP');
    draw('redoParetoFI','redoParetoFITitle','FI');

    var p=document.getElementById('redoParetoPaintingTitle');
    var f=document.getElementById('redoParetoFITitle');
    if(p)p.textContent='PARETO TOP 10 DEFECT PREPARATION + PAINTING — '+mode;
    if(f)f.textContent='PARETO TOP 10 DEFECT FINAL INSPECTION (FI) — '+mode;
  }


  function renderYtdMonthlyTrend(){
    var card=document.getElementById('redoYtdTrendCard'),el=document.getElementById('redoYtdTrendHost');
    if(!card||!el)return;
    var show=mode==='YTD';
    card.classList.toggle('show',show);
    if(!show){el.innerHTML='';return;}

    var rows=[];
    for(var mi=0;mi<=month.getMonth();mi++){
      var dt=new Date(year,mi,1);
      var rr=redoRowsForDate(dt,'month');
      var dd=doneRowsForDate(dt,'month');
      var target=dd.unit*0.09;
      rows.push({label:monthLabel(mi),redo:rr.unit,done:dd.unit,target:target,pct:dd.unit?(rr.unit/dd.unit*100):0});
    }
    if(!rows.length){el.innerHTML='<div class="redo-ytd-empty">Belum ada data REDO YTD.</div>';return;}

    var max=1;
    rows.forEach(function(r){max=Math.max(max,r.redo,r.target);});
    max=Math.max(1,Math.ceil(max*1.2));
    var W=980,H=370,left=55,right=42,top=36,bottom=68;
    var chartW=W-left-right,chartH=H-top-bottom,step=chartW/rows.length;
    var barW=Math.min(46,step*.56),svg='';

    [0,.25,.5,.75,1].forEach(function(p){
      var y=top+chartH-p*chartH, val=max*p;
      svg+='<line class="redo-ytd-grid" x1="'+left+'" y1="'+y+'" x2="'+(W-right)+'" y2="'+y+'"></line>'+
           '<text class="redo-ytd-label" text-anchor="end" x="'+(left-8)+'" y="'+(y+4)+'">'+Math.round(val)+'</text>';
    });

    var targetPts=[];
    rows.forEach(function(r,i){
      var cx=left+step*i+step/2;
      var bh=r.redo>0?(r.redo/max)*chartH:0;
      var by=top+chartH-bh;
      if(bh>0)svg+='<rect class="redo-ytd-bar" x="'+(cx-barW/2)+'" y="'+by+'" width="'+barW+'" height="'+bh+'" rx="3"></rect>';
      svg+='<text class="redo-ytd-value" text-anchor="middle" x="'+cx+'" y="'+Math.max(top+14,by-7)+'">'+r.redo+'</text>'+
           '<text class="redo-ytd-label" text-anchor="middle" x="'+cx+'" y="'+(top+chartH+22)+'">'+esc(r.label)+'</text>'+
           '<text class="redo-ytd-subvalue" text-anchor="middle" x="'+cx+'" y="'+(top+chartH+38)+'">'+r.pct.toFixed(1)+'%</text>';
      var ty=top+chartH-(r.target/max)*chartH;
      targetPts.push([cx,ty]);
    });

    svg+='<line class="redo-ytd-axis" x1="'+left+'" y1="'+(top+chartH)+'" x2="'+(W-right)+'" y2="'+(top+chartH)+'"></line>';
    if(targetPts.length){
      svg+='<polyline class="redo-ytd-target" points="'+targetPts.map(function(p){return p[0]+','+p[1]}).join(' ')+'"></polyline>';
      targetPts.forEach(function(p){svg+='<circle class="redo-ytd-target-point" cx="'+p[0]+'" cy="'+p[1]+'" r="3.5"></circle>';});
      var last=targetPts[targetPts.length-1];
      svg+='<text class="redo-ytd-target-label" x="'+Math.min(W-right-105,last[0]+8)+'" y="'+Math.max(top+13,last[1]-9)+'">TARGET &lt; 9%</text>';
    }

    svg+='<text class="redo-ytd-label" x="'+left+'" y="18">UNIT REDO</text>'+
         '<text class="redo-ytd-target-label" x="'+(W-right-105)+'" y="18">TARGET REDO</text>';
    el.innerHTML='<svg class="redo-ytd-trend-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+svg+'</svg>';
  }

  function renderProcessMatrix(){
    var arr=filteredRedo(),map=defectMap(arr),el=document.getElementById('redoProcessMatrix');if(!el)return;
    var h='';
    Object.keys(PROCESS).forEach(function(proc){
      var list=PROCESS[proc].map(function(d,i){return[d,map[d]||0,i]}).sort(function(a,b){return(b[1]-a[1])||(a[2]-b[2])});
      var total=list.reduce(function(s,x){return s+x[1]},0),top=list.filter(function(x){return x[1]>0}).slice(0,3);
      h+='<div class="redo-process-col"><div class="redo-process-name">'+esc(proc)+'</div><div class="redo-process-total">'+total+'</div><div class="redo-process-total-label">TOTAL DEFECT</div><div class="redo-process-list">';
      if(!top.length)h+='<div class="redo-process-empty">Belum ada defect</div>';
      top.forEach(function(x){h+='<div class="redo-process-item"><span class="name">'+esc(x[0])+'</span><span class="count">'+x[1]+'</span><span class="pct">'+(total?((x[1]/total)*100).toFixed(1):'0.0')+'%</span></div>'});
      h+='</div></div>';
    });
    el.innerHTML=h;
  }

  function render(){
    if(!raw.redo.length&&!loading)return;
    renderKpi();renderYtdMonthlyTrend();renderTables();renderPareto();renderProcessMatrix();
    var m1=document.getElementById('redoModeMTD'),m2=document.getElementById('redoModeYTD');
    if(m1)m1.classList.toggle('active',mode==='MTD');if(m2)m2.classList.toggle('active',mode==='YTD');
    var sel=document.getElementById('redoMonthSelect');if(sel)sel.value=String(month.getMonth());
  }
  /*
   * REDO API loader V7
   * Uses stable, simple global callback names because Google Apps Script
   * JSONP is more reliable with plain callback identifiers.
   * JPCB API is NOT touched.
   */
  var redoJsonpSeq=0;
  function jsonp(base,action,ok,fail){
    redoJsonpSeq++;
    var cb=action==='redo'?'redoApiCallback':'completedApiCallback';
    var script=document.createElement('script'),finished=false;
    var timer=setTimeout(function(){
      finish(new Error('Timeout '+action));
    },30000);

    function cleanup(){
      clearTimeout(timer);
      script.onload=null;
      script.onerror=null;
      if(script.parentNode)script.parentNode.removeChild(script);
    }
    function finish(err,data){
      if(finished)return;
      finished=true;
      cleanup();
      if(err)fail(err);else ok(data);
    }

    window[cb]=function(data){
      if(!data || data.success===false){
        finish(new Error((data&&data.error)||('Response '+action+' tidak valid')));
        return;
      }
      finish(null,data);
    };

    script.onerror=function(){
      finish(new Error('Script error '+action));
    };
    script.onload=function(){
      /*
       * A valid JSONP response calls window[cb]. If onload fires but the
       * callback did not execute, wait briefly and then report a clear error.
       */
      setTimeout(function(){
        if(!finished)finish(new Error('Callback '+action+' tidak dipanggil API'));
      },1200);
    };

    var sep=base.indexOf('?')>=0?'&':'?';
    script.src=base+sep+
      'action='+encodeURIComponent(action)+
      '&callback='+cb+
      '&_='+Date.now()+'_'+redoJsonpSeq;
    script.async=true;
    document.head.appendChild(script);
  }

  function load(force){
    if(loading&&!force)return;
    loading=true;
    var p=document.getElementById('redoPaintingTableHost'),
        f=document.getElementById('redoFiTableHost');
    if(p)p.innerHTML='<div class="redo-loading">Memuat data REDO...</div>';
    if(f)f.innerHTML='<div class="redo-loading">Memuat data REDO...</div>';

    /*
     * First load action=redo. This endpoint is the source for all defect,
     * painting, FI, daily and Pareto calculations.
     */
    jsonp(REDO_API_URL,'redo',function(res){
      raw.redo=Array.isArray(res.data)?res.data:[];
      var apiStatus=document.getElementById('redoApiStatus');if(apiStatus)apiStatus.textContent='API REDO: '+raw.redo.length+' record';
      loading=false;
      render();

      /*
       * Completed data is supplementary. Failure here must NEVER erase
       * or block the REDO dataset.
       */
      jsonp(REDO_API_URL,'completed',function(done){
        raw.completed=Array.isArray(done.data)?done.data:[];
        render();
      },function(){
        raw.completed=[];
        render();
      });
    },function(err){
      loading=false;
      raw.redo=[];
      var msg='Gagal membaca API REDO: '+err.message;var apiStatus=document.getElementById('redoApiStatus');if(apiStatus)apiStatus.textContent='API REDO ERROR';
      if(p)p.innerHTML='<div class="redo-loading">'+esc(msg)+'</div>';
      if(f)f.innerHTML='<div class="redo-loading">'+esc(msg)+'</div>';
    });
  }

  async function downloadPDF(){
    try{
      if(!window.jspdf||!window.jspdf.jsPDF)throw new Error('Library PDF belum termuat. Periksa koneksi internet.');
      var {jsPDF}=window.jspdf;
      var doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
      var W=420,H=297,M=8,RED=[215,25,32],DARK=[23,35,43],GREY=[100,115,123],LIGHT=[246,248,249],WHITE=[255,255,255],BLACK=[25,30,33];
      var r=filteredRedo(),d=filteredCompleted(),z=statsFor(r,d);

      function txt(t,x,y,size,bold,color,align){
        doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor.apply(doc,color||DARK);
        doc.text(String(t),x,y,align?{align:align}:undefined);
      }
      function logo(cls,x,y,w,h){
        try{
          var im=document.querySelector('img.'+cls);
          if(im&&im.src)doc.addImage(im.src,'JPEG',x,y,w,h,undefined,'FAST');
        }catch(e){}
      }
      function pageHeader(label){
        doc.setFillColor.apply(doc,WHITE);doc.rect(0,0,W,22,'F');
        doc.setDrawColor(220,226,229);doc.line(0,22,W,22);
        logo('tunas-real-logo',M,3,58,15);
        logo('toyota-real-logo',W-M-58,3,58,15);
        txt('REDO MONITORING',W/2,9,13,true,DARK,'center');
        txt(label,W/2,15,5.5,false,GREY,'center');
      }
      function footer(){
        txt('Tunas Toyota Bintaro • REDO Monitoring • '+new Date().toLocaleString('id-ID'),M,H-5,4.5,false,GREY);
        txt(String(doc.internal.getNumberOfPages()),W-M,H-5,4.5,false,GREY,'right');
      }
      function box(x,y,w,h,label,value,sub){
        doc.setDrawColor(220,226,229);doc.setFillColor.apply(doc,WHITE);doc.roundedRect(x,y,w,h,2,2,'FD');
        txt(label,x+3,y+5,5.1,true,GREY);txt(value,x+3,y+14,12,true,RED);if(sub)txt(sub,x+3,y+h-2.8,4.4,false,GREY);
      }
      function title(t,y){
        doc.setFillColor.apply(doc,LIGHT);doc.setDrawColor(225,230,233);doc.roundedRect(M,y,W-2*M,6,1.5,1.5,'FD');
        txt(t,M+3,y+4.1,6.2,true,DARK);
      }
      function metricRows(rows){
        rows.forEach(function(x){
          x.unitPct=x.unitDone?(x.unitRedo/x.unitDone*100):0;
          x.panelPct=x.panelDone?(x.panelRedo/x.panelDone*100):0;
        });
        var valid=rows.filter(function(x){return x.valid}),sums={unitDone:0,panelDone:0,unitRedo:0,panelRedo:0};
        valid.forEach(function(x){Object.keys(sums).forEach(function(k){sums[k]+=Number(x[k])||0})});
        return [
          ['UNIT PAINTING','unitDone',false],['PANEL PAINTING','panelDone',false],
          ['UNIT REDO','unitRedo',false],['PANEL REDO','panelRedo',false],
          ['% UNIT REDO','unitPct',true],['% PANEL REDO','panelPct',true]
        ].map(function(mm){
          var total=mm[1]==='unitPct'?(sums.unitDone?sums.unitRedo/sums.unitDone*100:0):
                    mm[1]==='panelPct'?(sums.panelDone?sums.panelRedo/sums.panelDone*100:0):(sums[mm[1]]||0);
          var avg=valid.length?valid.reduce(function(s,x){return s+(Number(x[mm[1]])||0)},0)/valid.length:0;
          return {label:mm[0],key:mm[1],pct:mm[2],total:total,avg:avg};
        });
      }
      function addTable(proc,rows,x,y,w){
        var ms=metricRows(rows),head=['REKAP '+(proc==='PAINTING'?'REDO PAINTING — TARGET < 9%':'REDO FI — TARGET < 5%')];
        rows.forEach(function(v){head.push(v.label)});head.push('JUMLAH');head.push('RATA-RATA');
        var body=ms.map(function(mm){
          var line=[mm.label];
          rows.forEach(function(v){line.push(!v.valid?'—':(mm.pct?(Number(v[mm.key])||0).toFixed(1)+'%':String(Math.round(Number(v[mm.key])||0))))});
          line.push(mm.pct?mm.total.toFixed(1)+'%':String(Math.round(mm.total)));
          line.push(mm.pct?mm.avg.toFixed(1)+'%':mm.avg.toFixed(1));
          return line;
        });
        var first=31, rest=(w-first-26)/Math.max(1,rows.length),cs={0:{cellWidth:first},[rows.length+1]:{cellWidth:13},[rows.length+2]:{cellWidth:13}};
        rows.forEach(function(_,i){cs[i+1]={cellWidth:rest}});
        doc.autoTable({
          startY:y,head:[head],body:body,theme:'grid',margin:{left:x,right:W-x-w},tableWidth:w,
          styles:{font:'helvetica',fontSize:5.1,cellPadding:1.0,halign:'center',valign:'middle',textColor:BLACK},
          headStyles:{fillColor:RED,textColor:WHITE,fontStyle:'bold',fontSize:5.0,cellPadding:.9},
          columnStyles:cs,
          didParseCell:function(data){
            if(data.section==='body'&&data.column.index>0){
              var v=String(data.cell.raw);
              if(v==='—'||v==='0'||v==='0.0%')data.cell.styles.textColor=[150,158,163];
              if(v.indexOf('%')>=0){
                var n=parseFloat(v),target=proc==='PAINTING'?9:5;
                data.cell.styles.textColor=n>target?RED:BLACK;
                data.cell.styles.fontStyle='bold';
              }
            }
          }
        });
        return doc.lastAutoTable.finalY;
      }
      function pData(modeType){
        var map={};
        DEFECTS.forEach(function(d){map[d]=0});
        r.forEach(function(x){
          var p=processOf(x),ok=modeType==='PAINTING_PREP'?(p==='PREPARATION'||p==='PAINTING'):(p==='FINAL INSPECTION');
          if(!ok)return;var dd=defect(x);if(dd)map[dd]=(map[dd]||0)+1;
        });
        return Object.keys(map).map(function(k,i){return[k,map[k],i]})
          .sort(function(a,b){return(b[1]-a[1])||(a[2]-b[2])}).slice(0,10);
      }
      function paretoBox(modeType,x,y,w,h){
        var a=pData(modeType),total=a.reduce(function(s,v){return s+v[1]},0);
        doc.setDrawColor(220,226,229);doc.setFillColor.apply(doc,WHITE);doc.roundedRect(x,y,w,h,2,2,'FD');
        txt(modeType==='PAINTING_PREP'?'PARETO TOP 10 — PREPARATION + PAINTING':'PARETO TOP 10 — FINAL INSPECTION (FI)',x+4,y+6,6,true,DARK);
        var lx=x+13,rx=x+w-18,ty=y+14,bottom=y+h-20,cw=(rx-lx)/10,max=Math.max(1,a[0][1]),pts=[],cum=0;
        doc.setDrawColor(230,233,235);doc.setLineWidth(.2);
        for(var g=0;g<=4;g++){var gy=bottom-(g/4)*(bottom-ty);doc.line(lx,gy,rx,gy);txt((g*25)+'%',rx+3,gy+1,4.2,false,GREY)}
        a.forEach(function(v,i){
          var cx=lx+cw*i+cw/2,bh=v[1]>0?v[1]/max*(bottom-ty):0,by=bottom-bh;
          if(bh>0){doc.setFillColor.apply(doc,RED);doc.roundedRect(cx-Math.min(7,cw*.3),by,Math.min(14,cw*.6),bh,1,1,'F');}
          txt(v[1],cx,Math.max(ty+5,by-2.5),5.5,true,DARK,'center');
          var parts=v[0].split(' ');txt(parts.slice(0,2).join(' '),cx,bottom+6,4.2,false,GREY,'center');if(parts.length>2)txt(parts.slice(2).join(' '),cx,bottom+10,4.2,false,GREY,'center');
          if(total>0){
            cum+=v[1];var cp=cum/total*100,py=bottom-(cp/100)*(bottom-ty);pts.push([cx,py]);txt(cp.toFixed(0)+'%',cx,Math.max(ty+5,py-3),4.3,false,GREY,'center');
          }
        });
        if(pts.length){
          doc.setDrawColor(45,45,45);doc.setLineWidth(.5);
          for(var i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);
          pts.forEach(function(p){doc.setFillColor.apply(doc,WHITE);doc.setDrawColor.apply(doc,RED);doc.circle(p[0],p[1],1.1,'FD')});
        }
      }

      /* PAGE 1: header + KPI + BOTH FULL TABLES on ONE PAGE */
      pageHeader((mode==='MTD'?'MTD '+periodLabel():'YTD 2026 s/d '+periodLabel())+' • GROUP '+group);
      var gap=3,bw=(W-2*M-gap*6)/7;
      var labels=[['TOTAL DEFECT',z.totalDefect,'tercatat'],['UNIT REDO',z.units,''],['PANEL REDO',z.panels,''],['% UNIT REDO',pct(z.units,z.doneUnits),''],['% PANEL REDO',pct(z.panels,z.donePanels),''],['REDO PAINTING',z.paint,'TARGET < 9%'],['REDO FI',z.fi,'TARGET < 5%']];
      labels.forEach(function(v,i){box(M+i*(bw+gap),27,bw,19,v[0],v[1],v[2])});

      var y=50;
      title('REKAP REDO PAINTING — '+mode+' — TARGET < 9%',y);y+=8;
      var pr=mode==='MTD'?dayRows(month,'PAINTING'):monthRows('PAINTING');
      addTable('PAINTING',pr,M,y,W-2*M);y=doc.lastAutoTable.finalY+5;
      title('REKAP REDO FINAL INSPECTION (FI) — '+mode+' — TARGET < 5%',y);y+=8;
      var fr=mode==='MTD'?dayRows(month,'FINAL INSPECTION'):monthRows('FINAL INSPECTION');
      addTable('FINAL INSPECTION',fr,M,y,W-2*M);
      footer();

      /* PAGE 2: Pareto vertical */
      doc.addPage();pageHeader((mode==='MTD'?'MTD '+periodLabel():'YTD 2026 s/d '+periodLabel())+' • TOP 10 DEFECT');
      title('PARETO DEFECT — '+mode,27);
      paretoBox('PAINTING_PREP',M,37,W-2*M,112);
      paretoBox('FI',M,153,W-2*M,112);
      footer();

      /* PAGE 3: horizontal process matrix */
      doc.addPage();pageHeader((mode==='MTD'?periodLabel():'YTD 2026 s/d '+periodLabel())+' • REKAP PROSES');
      title('REKAP PROSES DEFECT — TOP 3',27);
      var procs=['PREPARATION','PAINTING','FINAL INSPECTION'],cw=(W-2*M)/3,py=39;
      procs.forEach(function(proc,i){
        var map={},total=0;
        r.forEach(function(x){if(processOf(x)!==proc)return;var dd=defect(x);if(dd){map[dd]=(map[dd]||0)+1;total++}});
        var top=Object.keys(map).map(function(k){return[k,map[k]]}).sort(function(a,b){return b[1]-a[1]}).slice(0,3),x=M+i*cw;
        if(i>0){doc.setDrawColor.apply(doc,RED);doc.setLineWidth(.7);doc.line(x,py,x,py+120);}
        txt(proc,x+6,py+8,9,true,DARK);txt(String(total),x+6,py+22,19,true,RED);txt('TOTAL DEFECT',x+6,py+28,5,false,GREY);
        top.forEach(function(v,j){txt((j+1)+'. '+v[0],x+6,py+43+j*13,6.2,true,DARK);txt(String(v[1]),x+cw-38,py+43+j*13,6,true,RED,'right');txt(total?(v[1]/total*100).toFixed(1)+'%':'0.0%',x+cw-8,py+43+j*13,5.5,true,GREY,'right')});
      });
      title('REKAP SELURUH 15 MASTER DEFECT',166);
      var all=DEFECTS.map(function(dd,i){var n=r.filter(function(x){return defect(x)===dd}).length;return[dd,n,i]})
        .sort(function(a,b){return(b[1]-a[1])||(a[2]-b[2])});
      doc.autoTable({
        startY:175,head:[['DEFECT','JUMLAH','% TOTAL','PROSES']],body:all.map(function(v){return[v[0],v[1],z.totalDefect?(v[1]/z.totalDefect*100).toFixed(1)+'%':'0.0%',typeOfDefect(v[0])]}),
        theme:'grid',margin:{left:M,right:M},styles:{fontSize:5.8,cellPadding:1.5,textColor:BLACK},headStyles:{fillColor:RED,textColor:WHITE,fontStyle:'bold'}
      });
      footer();

      doc.save('REDO_MONITORING_FULL_'+mode+'_'+year+'_'+String(month.getMonth()+1).padStart(2,'0')+'.pdf');
    }catch(err){alert('Gagal membuat PDF: '+err.message);console.error(err)}
  }
  function setMode(m){mode=m==='YTD'?'YTD':'MTD';render()}
  function setMonth(v){var i=Math.max(0,Math.min(11,parseInt(v,10)||0));month=new Date(year,i,1);render()}
  function setGroup(g){group=g;['All','1','2'].forEach(function(x){var b=document.getElementById('redoGroup'+x);if(b)b.classList.toggle('active',(x==='All'&&g==='ALL')||(x!=='All'&&g==='ATU '+x))});render()}
  function init(){initMonthSelect();load(false)}
  return {init:init,load:load,setMode:setMode,setMonth:setMonth,setGroup:setGroup,downloadPDF:downloadPDF};
})();
