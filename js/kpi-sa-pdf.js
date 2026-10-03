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
