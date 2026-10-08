(function(root){
'use strict';

function calculate(source, name, endMonth, original, period = 'YTD') {
  const monthly = period === 'MTD';
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

  const rows = raw.map((values,i) => {
    const n = original ? (i < 3 ? 8 : 12) : endMonth;
    const start = monthly ? endMonth - 1 : 0;
    const selected = values.slice(start,monthly ? endMonth : n);
    const dayValues = source.days.slice(start,monthly ? endMonth : n);

    let avg;

    // NPS = 100 dan nol tetap valid jika sewaktu-waktu ada nilai nol.
    if (monthly) {
      avg = selected.every(Number.isFinite) ? average(selected) : null;
    } else if (i === 6) {
      avg = average(selected.filter(Number.isFinite));
    } else if (i === 5) {
      // WIP >60 hari: nol harus dihitung, karena target adalah < 1.
      avg = average(selected.filter(Number.isFinite));
    } else {
      avg = positiveAverage(selected);
    }

    let achievement = null;

    if (i < 3) {
      achievement = divide(
        sum(selected),
        sum(dayValues) * source.targets[i]
      );

    } else if (i === 5) {
      // TARGET WIP >60 HARI = < 1.
      // Bila rata-rata <1 => target tercapai 100%.
      // Bila >=1 => target tidak tercapai.
      achievement = Number.isFinite(avg)
        ? (avg < 1 ? 1 : 0)
        : null;

    } else {
      achievement = divide(avg, source.targets[i]);
    }

    if (monthly && (!selected.length || !selected.every(Number.isFinite) || !dayValues.every(Number.isFinite))) achievement = null;

    const points = Number.isFinite(achievement)
      ? achievement * source.weights[i]
      : null;

    return {
      sourceIndex: i,
      values: values,
      total: monthly && (!selected.length || !selected.every(Number.isFinite)) ? null : sum(selected),
      average: avg,
      achievement: achievement,
      points: points,
      weight: source.weights[i],
      target: source.targets[i],
      months: monthly ? 1 : n,
      period: monthly ? 'MTD' : 'YTD',
      type: (i === 6 ? 'pctNumber' : 'number'),
      scored: true
    };
  });

  const score = rows.every(r => Number.isFinite(r.points))
    ? sum(rows.map(r => r.points))
    : null;

  return {rows, score};
}

function rank(source,endMonth,original=false,period='MTD') {
  const entries=Object.keys(source.data).map(name=>({name,...calculate(source,name,endMonth,original,period)}));
  entries.sort((a,b)=>Number.isFinite(a.score)&&Number.isFinite(b.score)?b.score-a.score:Number.isFinite(a.score)?-1:Number.isFinite(b.score)?1:a.name.localeCompare(b.name));
  let previous=null,position=0;
  entries.forEach((entry,i)=>{if(!Number.isFinite(entry.score)){entry.rank=null;return;}if(previous===null||Math.abs(entry.score-previous)>1e-9)position=i+1;entry.rank=position;previous=entry.score;});
  return entries;
}
root.KpiSa = {calculate,rank};

if (typeof module !== 'undefined') {
  module.exports = root.KpiSa;
}

})(typeof window === 'undefined' ? globalThis : window);

