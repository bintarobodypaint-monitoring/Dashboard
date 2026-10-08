'use strict';

(function(){
  const by = id => document.getElementById(id);
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  const TAM_CPUS_2026=[299,273,195,323,243,312,338,283,327,331,321,345];

  const ROWS = [
    ['ue','UE','count'],
    ['cpus','CPUS','count'],
    ['closing','Closing Rate','pct'],
    ['insurance','Asuransi — Unit','count'],
    ['insurancePct','Asuransi — % UE','pct'],
    ['cash','Personal/Cash — Unit','count'],
    ['cashPct','Personal/Cash — % UE','pct'],
    ['light','Light','count'],
    ['medium','Medium','count'],
    ['heavy','Heavy','count'],
    ['labor','Revenue Jasa','money'],
    ['parts','Revenue Part','money'],
    ['revenue','Revenue Total','money'],
    ['revUnit','Revenue Total/Unit','money'],
    ['productivity','Productivity SA','decimal']
  ];

  let source = null;
  let mode = 'YTD';
  let loading = false;

  function fmt(v,type){
    if (!Number.isFinite(v)) return '—';

    if (type === 'pct') {
      return (v * 100).toLocaleString('id-ID',{
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }) + '%';
    }

    if (type === 'money') {
      const abs = Math.abs(v);
      const sign = v < 0 ? '-' : '';

      if (abs >= 1e9) {
        const n = abs / 1e9;
        return sign + 'Rp ' + n.toLocaleString('id-ID',{
          minimumFractionDigits: n < 10 && n % 1 !== 0 ? 1 : 0,
          maximumFractionDigits: 2
        }) + ' Miliar';
      }

      if (abs >= 1e6) {
        const n = abs / 1e6;
        return sign + 'Rp ' + n.toLocaleString('id-ID',{
          minimumFractionDigits: n < 10 && n % 1 !== 0 ? 1 : 0,
          maximumFractionDigits: 1
        }) + ' Juta';
      }

      if (abs >= 1e3) {
        const n = abs / 1e3;
        return sign + 'Rp ' + n.toLocaleString('id-ID',{
          maximumFractionDigits: 1
        }) + ' Ribu';
      }

      return sign + 'Rp ' + abs.toLocaleString('id-ID',{
        maximumFractionDigits: 0
      });
    }

    if (type === 'decimal') {
      return v.toLocaleString('id-ID',{
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    return v.toLocaleString('id-ID',{maximumFractionDigits:0});
  }

  function emptyBin(){
    return {
      ue:0,cpus:0,insurance:0,cash:0,other:0,unmapped:0,
      light:0,medium:0,heavy:0,unknownRepair:0,
      labor:0,parts:0,revenue:0
    };
  }

  function addInto(a,b){
    Object.keys(a).forEach(k => {
      if (Number.isFinite(b[k])) a[k] += b[k];
    });
  }

  function divide(a,b){
    return Number.isFinite(a) && Number.isFinite(b) && b > 0
      ? a / b
      : null;
  }

  function dateWeight(detail,date){
    if (Object.prototype.hasOwnProperty.call(detail.calendar || {},date)) {
      return detail.calendar[date];
    }

    // fallback: Senin-Sabtu kerja, Minggu libur.
    const d = new Date(date + 'T00:00:00');
    return d.getDay() === 0 ? 0 : 1;
  }

  function metric(bin,workdays,saCount){
    const targetBase =
      Number.isFinite(workdays) && workdays >= 0
        ? workdays * saCount
        : null;

    return {
      ...bin,
      closing: divide(bin.cpus,bin.ue),
      insurancePct: divide(bin.insurance,bin.ue),
      cashPct: divide(bin.cash,bin.ue),
      revUnit: divide(bin.revenue,bin.cpus),
      productivity: divide(bin.ue,targetBase)
    };
  }

  function buildView(detail,year,month,selectedSa){
    const sas = selectedSa === 'ALL'
      ? detail.sas.slice()
      : [selectedSa];

    const cutoff = detail.asOf;
    const count = mode === 'MTD'
      ? new Date(year,month,0).getDate()
      : month;

    const slots = Array.from({length:count},emptyBin);
    const total = emptyBin();

    (detail.bins || []).forEach(b => {
      if (!sas.includes(b.sa)) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||Number(b.date.slice(0,4))!==year||b.date > cutoff) return;

      const m = Number(b.date.slice(5,7));

      if (m>month||(mode === 'MTD' && m !== month)) return;

      const idx = mode === 'MTD'
        ? Number(b.date.slice(8,10)) - 1
        : m - 1;

      if (!slots[idx]) return;

      addInto(slots[idx],b);
      addInto(total,b);
    });

    const slotWorkdays = slots.map((_,i) => {
      if (mode === 'YTD') {
        const m = i + 1;
        const ym = String(year) + '-' + String(m).padStart(2,'0');

        if (ym > cutoff.slice(0,7)) return null;

        // Bulan selesai: pakai workday KPI SA.
        const last = new Date(year,m,0).getDate();
        const monthEnd =
          String(year) + '-' + String(m).padStart(2,'0') + '-' +
          String(last).padStart(2,'0');

        if (monthEnd <= cutoff && Number.isFinite(detail.workdays[i])) {
          return detail.workdays[i];
        }

        // Bulan berjalan: hanya hari kerja yang sudah lewat.
        let sum = 0;

        for (let d=1; d<=last; d++) {
          const date =
            String(year) + '-' + String(m).padStart(2,'0') + '-' +
            String(d).padStart(2,'0');

          if (date > cutoff) break;
          sum += dateWeight(detail,date);
        }

        return sum;
      }

      const d = i + 1;
      const date =
        String(year) + '-' + String(month).padStart(2,'0') + '-' +
        String(d).padStart(2,'0');

      if (date > cutoff) return null;
      return dateWeight(detail,date);
    });

    const metrics = slots.map((b,i) =>
      metric(b,slotWorkdays[i],sas.length)
    );

    let totalWorkdays = 0;
    let hasWorkdays = false;

    slotWorkdays.forEach(w => {
      if (Number.isFinite(w)) {
        totalWorkdays += w;
        hasWorkdays = true;
      }
    });

    const totalMetric = metric(
      total,
      hasWorkdays ? totalWorkdays : null,
      sas.length
    );

    // Target TAM is a monthly branch total, not 5 units/day multiplied by SA.
    function targetForMonth(m){
      if(year!==2026)return null;
      const prefix=String(year)+'-'+String(m).padStart(2,'0');
      if(prefix>cutoff.slice(0,7))return 0;
      let fraction=1;
      if(prefix===cutoff.slice(0,7)){
        let all=0,elapsed=0;
        for(let d=1;d<=new Date(year,m,0).getDate();d++){
          const date=prefix+'-'+String(d).padStart(2,'0');
          const weight=dateWeight(detail,date);all+=weight;if(date<=cutoff)elapsed+=weight;
        }
        fraction=all?elapsed/all:0;
      }
      return TAM_CPUS_2026[m-1]*fraction*(selectedSa==='ALL'?1:1/3);
    }
    const tamTarget=year!==2026?null:mode==='MTD'?targetForMonth(month):Array.from({length:month},(_,i)=>targetForMonth(i+1)).reduce((a,b)=>a+b,0);
    totalMetric.uePct=divide(total.ue,tamTarget);
    totalMetric.cpusPct=divide(total.cpus,tamTarget);
    totalMetric.tamTarget=tamTarget;

    return {
      slots:metrics,
      total:totalMetric,
      count:count,
      sas:sas,
      workdays:hasWorkdays ? totalWorkdays : null
    };
  }

  function render(){
    if (!source || !source.performanceDetail) return;

    const detail = source.performanceDetail;
    const year = Number(by('detail-year').value);
    const month = Number(by('detail-month').value);
    const sa = by('detail-sa').value;

    by('detail-month').disabled = false;

    document.querySelectorAll('[data-detail-mode]').forEach(btn => {
      btn.setAttribute(
        'aria-pressed',
        String(btn.dataset.detailMode === mode)
      );
    });

    const view = buildView(detail,year,month,sa);

    by('detail-period').textContent =
      mode + ' ' +
      (mode === 'MTD' ? MONTHS[month-1] + ' ' : 'Jan–'+MONTHS[month-1]+' ') +
      year+' · '+(sa==='ALL'?'Semua SA':sa)+' · Target TAM '+fmt(view.total.tamTarget,'count')+' unit';

    const n = view.count;

    // Cards
    const cards = [
      ['% CPUS ' + mode, fmt(view.total.cpusPct,'pct')],
      ['% UE ' + mode, fmt(view.total.uePct,'pct')],
      ['% Unit Asuransi', fmt(view.total.insurancePct,'pct')],
      ['% Unit Personal/Cash', fmt(view.total.cashPct,'pct')],
      ['Revenue/Unit', fmt(view.total.revUnit,'money')]
    ];

    cards.forEach((c,i) => {
      by('detail-label-' + i).textContent = c[0];
      const value=by('detail-value-'+i);value.textContent=c[1];
      if(i<2){const actual=i===0?view.total.cpus:view.total.ue;const target=view.total.tamTarget;value.style.color=Number.isFinite(target)&&target>0&&actual<target?'#b91c1c':'';const caption=by('detail-target-'+i);if(caption)caption.textContent='Actual '+fmt(actual,'count')+' · Target TAM '+fmt(target,'count');}
    });

    // Header
    const head = by('detail-head');
    head.replaceChildren();

    const tr = document.createElement('tr');
    const headerLabels = [
      'INDIKATOR',
      ...Array.from(
        {length:n},
        (_,i) => mode === 'YTD' ? MONTHS[i] : String(i+1)
      ),
      mode
    ];

    headerLabels.forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      tr.append(th);
    });

    head.append(tr);

    // Body
    const body = by('detail-body');
    body.replaceChildren();

    ROWS.forEach(([key,label,type]) => {
      const row = document.createElement('tr');

      if (key === 'closing') row.classList.add('detail-closing-row');
      if (key === 'insurancePct' || key === 'cashPct') {
        row.classList.add('detail-percent-row');
      }

      const labelCell = document.createElement('th');
      labelCell.textContent = label;
      row.append(labelCell);

      for (let i=0; i<n; i++) {
        const td = document.createElement('td');

        // Future date/month is intentionally blank.
        const v = view.slots[i][key];

        td.textContent = fmt(v,type);
        row.append(td);
      }

      const totalCell = document.createElement('td');
      totalCell.textContent = fmt(view.total[key],type);
      totalCell.className = 'detail-total';
      row.append(totalCell);

      body.append(row);
    });

    const notes = [];

    if (view.total.unmapped) {
      notes.push(
        view.total.unmapped +
        ' UE belum memiliki data pembayar.'
      );
    }

    if (view.total.other) {
      notes.push(
        view.total.other +
        ' UE berada di kategori pembayar selain Asuransi/Personal.'
      );
    }

    if (view.total.unknownRepair) {
      notes.push(
        view.total.unknownRepair +
        ' UE belum terbaca sebagai Light/Medium/Heavy.'
      );
    }

    notes.push('% CPUS = actual CPUS ÷ target CPUS TAM. % UE = actual UE ÷ target CPUS TAM. Semua SA memakai target cabang; satu SA memakai target TAM ÷ 3. Bulan berjalan memakai proporsi hari kerja sampai tanggal data.');
    notes.push('Closing Rate = CPUS ÷ UE.');
    notes.push('Revenue/Unit = Revenue Total ÷ CPUS.');
    notes.push(
      'Productivity SA = UE ÷ hari kerja ÷ jumlah SA terpilih.'
    );

    by('detail-note').textContent = notes.join(' ');
  }

  function jsonp(url,timeoutMs=90000){
    return new Promise((resolve,reject) => {
      const callback =
        '__kpiSaDetail_' + Date.now() + '_' +
        Math.random().toString(36).slice(2);

      const script = document.createElement('script');
      const u = new URL(url);
      let done = false;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Waktu koneksi API habis'));
      },timeoutMs);

      function cleanup(){
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[callback]; }
        catch (_) { window[callback] = undefined; }
        script.remove();
      }

      window[callback] = data => {
        cleanup();
        resolve(data);
      };

      u.searchParams.set('callback',callback);
      script.src = u.toString();
      script.async = true;

      script.onerror = () => {
        cleanup();
        reject(new Error('API KPI tidak dapat dimuat'));
      };

      document.head.appendChild(script);
    });
  }

  async function load(refresh){
    if (loading) return;

    const endpoint = window.KPI_SA_API_URL;

    if (!endpoint) {
      by('detail-status').textContent =
        'Koneksi API KPI belum aktif.';
      return;
    }

    loading = true;
    by('detail-refresh').disabled = true;
    by('detail-status').textContent =
      'Memuat Performance MTD/YTD...';

    try {
      const u = new URL(endpoint);
      u.searchParams.set('year',by('detail-year').value);

      if (refresh) u.searchParams.set('refresh','1');

      const data = await jsonp(u.toString());

      if (
        !data ||
        !data.success ||
        !data.performanceDetail ||
        !Array.isArray(data.performanceDetail.bins)
      ) {
        throw new Error(
          (data && data.error) ||
          'API belum memakai versi Performance Detail'
        );
      }

      source = data;
      render();

      by('detail-status').textContent =
        'Data diperbarui ' +
        new Date(data.updatedAt).toLocaleString('id-ID');

    } catch (err) {
      by('detail-status').textContent =
        'Gagal memuat tabel detail: ' +
        (err && err.message ? err.message : String(err));

    } finally {
      loading = false;
      by('detail-refresh').disabled = false;
    }
  }

  // Setup controls
  MONTHS.forEach((m,i) => {
    by('detail-month').add(new Option(m,i+1));
  });

  by('detail-month').value =
    String(Math.min(new Date().getMonth()+1,12));

  // Detail opens for the whole branch; choosing an individual SA is explicit.
  by('detail-sa').value='ALL';

  ['detail-sa','detail-month'].forEach(id => {
    by(id).addEventListener('change',render);
  });

  by('detail-year').addEventListener('change',() => {
    source = null;
    load(false);
  });

  document.querySelectorAll('[data-detail-mode]').forEach(btn => {
    btn.addEventListener('click',() => {
      mode = btn.dataset.detailMode;
      render();
    });
  });

  by('detail-refresh').addEventListener('click',() => load(true));

  load(false);
})();

