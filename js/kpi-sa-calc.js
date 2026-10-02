(function(root){
'use strict';

function calculate(source, name, endMonth, original) {
  const raw = source.data[name];

  if (!raw || !Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) {
    throw Error('Pilihan KPI tidak valid');
  }

  const sum = a => a.reduce(
    (s,v) => s + (Number.isFinite(v) ? v : 0), 0
  );

  const average = a => {
    const v = a.filter(x => Number.isFinite(x));
    return v.length ? sum(v) / v.length : null;
  };

  const positiveAverage = a => {
    const v = a.filter(x => Number.isFinite(x) && x > 0);
    return v.length ? sum(v) / v.length : null;
  };

  const divide = (a,b) =>
    Number.isFinite(a) && Number.isFinite(b) && b > 0
      ? a / b
      : null;

  // 7 KPI asli yang mempunyai bobot/target.
  const scored = raw.map((values,i) => {
    const n = original ? (i < 3 ? 8 : 12) : endMonth;
    const selected = values.slice(0,n);

    // NPS boleh dihitung dari bulan yang memang sudah memiliki survey.
    const avg = i === 6
      ? average(selected.filter(Number.isFinite))
      : positiveAverage(selected);

    let achievement = null;

    if (i < 3) {
      achievement = divide(
        sum(selected),
        sum(source.days.slice(0,n)) * source.targets[i]
      );
    } else if (i === 5) {
      achievement = divide(source.targets[i], avg);
    } else {
      achievement = divide(avg, source.targets[i]);
    }

    const points = Number.isFinite(achievement)
      ? achievement * source.weights[i]
      : null;

    return {
      sourceIndex: i,
      values: values,
      total: sum(values.slice(0,n)),
      average: avg,
      achievement: achievement,
      points: points,
      weight: source.weights[i],
      target: source.targets[i],
      months: n,
      type: (i === 6 ? 'pctNumber' : 'number'),
      scored: true
    };
  });

  // Closing Rate = CPUS / UE.
  // Untuk total periode digunakan total CPUS / total UE, bukan rata-rata % bulanan.
  const closingMonths = raw[0].map((ue,m) =>
    divide(raw[2][m], ue)
  );

  const closingN = original ? 8 : endMonth;
  const closingSelectedUe = raw[0].slice(0,closingN);
  const closingSelectedCpus = raw[2].slice(0,closingN);
  const closingRate = divide(
    sum(closingSelectedCpus),
    sum(closingSelectedUe)
  );

  const closing = {
    sourceIndex: 'closing',
    values: closingMonths,
    total: closingRate,
    average: closingRate,
    achievement: null,
    points: null,
    weight: null,
    target: null,
    months: closingN,
    type: 'ratioPct',
    scored: false
  };

  // Sisipkan setelah CPUS.
  const rows = [
    scored[0],
    scored[1],
    scored[2],
    closing,
    scored[3],
    scored[4],
    scored[5],
    scored[6]
  ];

  const scoreRows = scored.filter(r => r.scored);
  const score = scoreRows.every(r => Number.isFinite(r.points))
    ? sum(scoreRows.map(r => r.points))
    : null;

  return {rows, score};
}

root.KpiSa = {calculate};

if (typeof module !== 'undefined') {
  module.exports = root.KpiSa;
}

})(typeof window === 'undefined' ? globalThis : window);
