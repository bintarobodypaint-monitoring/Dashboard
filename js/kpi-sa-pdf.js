'use strict';

(function(){
  const button = document.getElementById('download-pdf');
  if (!button) return;

  function selectedText(id){
    const el = document.getElementById(id);
    if (!el) return '';
    const option = el.options && el.selectedIndex >= 0
      ? el.options[el.selectedIndex]
      : null;
    return option ? option.textContent.trim() : String(el.value || '').trim();
  }

  function safeName(value){
    return String(value || '')
      .trim()
      .replace(/\s+/g,'_')
      .replace(/[^A-Za-z0-9_-]/g,'');
  }

  function activeDetailMode(){
    const active = document.querySelector(
      '[data-detail-mode][aria-pressed="true"]'
    );
    return active ? active.dataset.detailMode : 'YTD';
  }

  function compactPrintLabels(){
    const changes = [];

    function replaceText(selector, from, to){
      document.querySelectorAll(selector).forEach(el => {
        if (el.textContent.trim() === from) {
          changes.push([el,el.textContent]);
          el.textContent = to;
        }
      });
    }

    replaceText('#head th','Bobot (poin)','Bobot');
    replaceText('#head th','Rata-rata penilaian','Rata²');
    replaceText('#head th','Pencapaian','Capai');
    replaceText('#head th','Nilai (poin)','Nilai');

    replaceText('#detail-body th','Asuransi — Unit','Asuransi');
    replaceText('#detail-body th','Asuransi — % UE','Asuransi %');
    replaceText('#detail-body th','Personal/Cash — Unit','Cash');
    replaceText('#detail-body th','Personal/Cash — % UE','Cash %');
    replaceText('#detail-body th','Revenue Jasa','Rev Jasa');
    replaceText('#detail-body th','Revenue Part','Rev Part');
    replaceText('#detail-body th','Revenue Total','Rev Total');
    replaceText('#detail-body th','Revenue Total/Unit','Rev/Unit');
    replaceText('#detail-body th','Productivity SA','Produktivitas');

    return function restore(){
      changes.forEach(([el,text]) => {
        el.textContent = text;
      });
    };
  }

  function reportMeta(){
    const topSa = selectedText('sa') || '-';
    const detailSa = selectedText('detail-sa') || topSa;
    const year = selectedText('detail-year') || selectedText('year') || '-';
    const month = selectedText('detail-month');
    const mode = activeDetailMode();

    return {
      topSa,
      detailSa,
      year,
      month,
      mode
    };
  }

  function preparePrint(){
    const topRows = document.querySelectorAll('#body tr').length;
    const detailRows = document.querySelectorAll('#detail-body tr').length;

    if (!topRows || !detailRows) {
      alert(
        'Data belum selesai dimuat. Tunggu tabel atas dan tabel bawah terisi, lalu coba lagi.'
      );
      return;
    }

    const meta = reportMeta();
    const restorePrintLabels = compactPrintLabels();
    const body = document.body;
    const reportMetaEl = document.getElementById('pdf-report-meta');

    body.classList.remove('pdf-ytd','pdf-mtd');
    body.classList.add(meta.mode === 'MTD' ? 'pdf-mtd' : 'pdf-ytd');

    if (reportMetaEl) {
      reportMetaEl.textContent =
        'Cabang: Bintaro | KPI SA: ' + meta.topSa +
        ' | Detail: ' + meta.detailSa +
        ' | Periode: ' + meta.mode +
        (meta.mode === 'MTD' && meta.month ? ' ' + meta.month : '') +
        ' ' + meta.year;
    }

    const oldTitle = document.title;
    document.title =
      'KPI_SA_' +
      safeName(meta.detailSa || meta.topSa) + '_' +
      meta.mode + '_' +
      safeName(meta.year);

    let cleaned = false;

    function cleanup(){
      if (cleaned) return;
      cleaned = true;
      body.classList.remove('pdf-ytd','pdf-mtd');
      document.title = oldTitle;
      restorePrintLabels();
      window.removeEventListener('afterprint',cleanup);
    }

    window.addEventListener('afterprint',cleanup);

    // Memberi browser waktu menerapkan print CSS sebelum dialog tampil.
    setTimeout(() => {
      window.print();
    }, 120);

    // Fallback jika browser tidak memicu afterprint.
    setTimeout(cleanup, 30000);
  }

  button.addEventListener('click',preparePrint);
})();
