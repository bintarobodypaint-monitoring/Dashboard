'use strict';

const $ = id => document.getElementById(id);
const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const names = [
  'Prod SA',
  'Unit Out',
  'CPUS',
  'Revenue',
  'Revenue/Unit',
  'WIP >60 hari',
  'NPS'
];

const fmtMoneyCompact = v => {
  if (!Number.isFinite(v)) return '—';

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
};

const fmtNumber = (v,d=2) =>
  Number.isFinite(v)
    ? v.toLocaleString('id-ID',{maximumFractionDigits:d})
    : '—';

const fmtRowValue = (v,row) => {
  if (!Number.isFinite(v)) return '—';

  if (row.type === 'pctNumber') {
    return v.toLocaleString('id-ID',{
      minimumFractionDigits:0,
      maximumFractionDigits:1
    }) + '%';
  }

  if (row.sourceIndex === 3 || row.sourceIndex === 4) {
    return fmtMoneyCompact(v);
  }

  return v.toLocaleString('id-ID',{maximumFractionDigits:2});
};

let source = null;
let loading = false;

// Getting Commitment - Target 2026, Bintaro BP: CPUS TARGET TAM.
const tamCpus2026 = [299,273,195,323,243,312,338,283,327,331,321,345];
const tamSaNames = ['DWI NANTO','IWAN ISKANDAR','HENDI'];

function tamCpusComparison(data, count) {
  const targets = Number(data.year) === 2026 ? tamCpus2026 : null;
  const actual = months.map((_,m) => {
    const values = tamSaNames.map(name => data.data[name]?.[2]?.[m]);
    return values.every(Number.isFinite)
      ? values.reduce((sum,value) => sum + value,0)
      : null;
  });
  const selected = actual.slice(0,count);
  return {
    targets, actual,
    total: selected.every(Number.isFinite)
      ? selected.reduce((sum,value) => sum + value,0) : null,
    target: targets ? targets.slice(0,count).reduce((sum,value) => sum + value,0) : null
  };
}

function appendTamCpusRows(count) {
  const report = tamCpusComparison(source,count);
  const targetValues = report.targets || months.map(() => null);
  const percentage = Number.isFinite(report.total) && report.target > 0
    ? fmtNumber(report.total / report.target * 100,1) + '%' : '—';
  const rows = [
    ['Target TAM', targetValues, report.target, '—'],
    ['CPUS Cabang (3 SA)', report.actual, report.total, percentage]
  ];
  rows.forEach(([label,values,total,achievement],rowIndex) => {
    const tr = document.createElement('tr');
    tr.className = 'tam-cpus-row';
    const cells = [label,'—',...values.map(v => fmtNumber(v,0)),
      fmtNumber(total,0),'—',fmtNumber(report.target,0),achievement,'—'];
    cells.forEach((value,index) => {
      const td = document.createElement('td');
      td.textContent = value;
      if (index === 0) td.className = 'kpi-name';
      td.title = 'CPUS cabang = DWI NANTO + IWAN ISKANDAR + HENDI. Target penuh bulanan TAM 2026; total Januari–' + months[count-1] + '.';
      const month = index - 2;
      const actual = index === 14 ? report.total : report.actual[month];
      const target = index === 14 ? report.target : report.targets?.[month];
      if (rowIndex === 1 && ((month >= 0 && month < 12) || index === 14)
          && Number.isFinite(actual) && Number.isFinite(target) && actual < target) {
        td.style.setProperty('color','#b91c1c','important');
        td.style.setProperty('-webkit-print-color-adjust','exact','important');
        td.style.setProperty('print-color-adjust','exact','important');
        td.style.setProperty('font-weight','700','important');
        td.title += ' Actual ' + actual + ' < target ' + target + '.';
      }
      tr.append(td);
    });
    $('body').append(tr);
  });
}

months.forEach((m,i) => $('month').add(new Option(m,i+1)));
$('month').value = '9';

function render() {
  if (!source) return;

  const original = $('mode').value === 'sheet';
  const end = Number($('month').value);
  const sa = $('sa').value;

  $('month').disabled = original;

  const r = KpiSa.calculate(source,sa,end,original);

  $('score').textContent =
    r.score === null
      ? 'Belum lengkap'
      : fmtNumber(r.score) + ' poin';

  $('period').textContent = original
    ? 'Sesuai Sheet: KPI unit Jan–Agu; KPI lainnya mengikuti data yang tersedia.'
    : 'Penilaian Januari–' + months[end-1] + ' ' + source.year;

  $('head').innerHTML =
    '<tr>' +
    [
      'KPI',
      'Bobot (poin)',
      ...months,
      'Total',
      'Rata-rata penilaian',
      'Target',
      'Pencapaian',
      'Nilai (poin)'
    ].map(x => '<th>' + x + '</th>').join('') +
    '</tr>';

  $('body').replaceChildren();

  r.rows.forEach((row,i) => {
    const tr = document.createElement('tr');

    const achievementText = Number.isFinite(row.achievement)
      ? (row.achievement * 100).toLocaleString('id-ID',{
          maximumFractionDigits:1
        }) + '%'
      : '—';

    let targetText = '—';

    if (row.sourceIndex === 5) {
      targetText = '<1';
    } else if (Number.isFinite(row.target)) {
      targetText =
        (row.sourceIndex === 3 || row.sourceIndex === 4)
          ? fmtMoneyCompact(row.target)
          : fmtNumber(row.target);
    }

    const values = [
      names[i],
      Number.isFinite(row.weight) ? fmtNumber(row.weight) : '—',
      ...row.values.map(v => fmtRowValue(v,row)),
      fmtRowValue(row.total,row),
      fmtRowValue(row.average,row),
      targetText,
      achievementText,
      Number.isFinite(row.points) ? fmtNumber(row.points) : '—'
    ];

    values.forEach((v,index) => {
      const td = document.createElement('td');
      td.textContent = v;

      if (index === 0) td.className = 'kpi-name';

      tr.append(td);
    });

    $('body').append(tr);
    if (row.sourceIndex === 2) appendTamCpusRows(original ? 8 : end);
  });

  $('status').textContent =
    'Data ' + sa + ' siap. NPS ditetapkan 100. ' +
    'Target WIP >60 hari adalah <1. ' +
    'CPUS Cabang = total 3 SA; merah jika di bawah target penuh TAM 2026. ' +
    'Data yang belum lengkap ditampilkan —.';
}

function jsonp(url, timeoutMs = 90000) {
  return new Promise((resolve,reject) => {
    const callback =
      '__kpiSaCallback_' + Date.now() + '_' +
      Math.random().toString(36).slice(2);

    const script = document.createElement('script');
    const u = new URL(url);
    let finished = false;

    function cleanup() {
      if (finished) return;
      finished = true;
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
      reject(new Error(
        'API KPI tidak dapat dimuat. Pastikan deployment Apps Script sudah memakai versi terbaru.'
      ));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Waktu koneksi API habis'));
    },timeoutMs);

    document.head.appendChild(script);
  });
}

async function load(refresh) {
  if (loading) return;

  const endpoint = window.KPI_SA_API_URL;

  if (!endpoint) {
    $('status').textContent = 'Koneksi KPI belum diaktifkan.';
    return;
  }

  loading = true;
  $('refresh').disabled = true;

  $('status').textContent = source
    ? 'Memperbarui data...'
    : 'Mengambil KPI dari Google Sheets...';

  try {
    const u = new URL(endpoint);

    if (u.protocol !== 'https:') {
      throw new Error('URL API harus HTTPS');
    }

    u.searchParams.set('year',$('year').value);

    if (refresh) {
      u.searchParams.set('refresh','1');
    }

    const data = await jsonp(u.toString());

    if (!data || !data.success) {
      throw new Error((data && data.error) || 'Respons API tidak valid');
    }

    if (
      !Array.isArray(data.days) ||
      data.days.length !== 12 ||
      !data.data ||
      !Array.isArray(data.weights) ||
      !Array.isArray(data.targets)
    ) {
      throw new Error('Struktur KPI tidak valid');
    }

    source = data;
    render();

  } catch (e) {
    $('status').textContent =
      'Gagal memperbarui: ' +
      (e && e.message ? e.message : String(e)) +
      (source ? '. Data sebelumnya tetap ditampilkan.' : '');

  } finally {
    loading = false;
    $('refresh').disabled = false;
  }
}

['sa','mode','month'].forEach(id =>
  $(id).addEventListener('change',render)
);

$('refresh').addEventListener('click',() => load(true));

load(false);
