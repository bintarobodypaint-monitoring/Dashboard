(() => {
  "use strict";

  /* =========================================================
     DASHBOARD MENU 01 — DATA CONNECTOR
     API existing TIDAK DIUBAH.
     ========================================================= */
  const API = "https://script.google.com/macros/s/AKfycbw5a2s4WxsPFTHfbXMI0DrZBiECdFcheOEbbwkFBY-9eypxT8ybe8lPMW--ALfDpcJY/exec";
  const REDO_API = "https://script.google.com/macros/s/AKfycbzW_1V3ickfa1PVCEWtvem8PN8xTh9ho9nv-jKzogbIeL3n2slWwLzkjZuuPQgz2dII/exec";
  const QC_API = "https://script.google.com/macros/s/AKfycbxX3UnuRwNcYWpGhyWsz-WVopHttb3tM5Qe381lLSdPR7gkeHjKJrExFxmByYem1Toz/exec";

  /* API JSCB/JPCB V38 yang sudah dipakai oleh engine JSCB.
     Dipakai hanya sebagai sumber join DATABASE LEADTIME/DELIVERY.
     Tidak mengubah API tersebut. */
  const JSCB_API = "https://script.google.com/macros/s/AKfycbzKxJ52Re-WBdWkuEP_mziWSnDDqzQLSIp2oWAg7SGt24bvSemH-ABnkkDNQYpJEeI5/exec";

  let units = [];
  let leadRows = [];
  let inapDaily = [];
  let charts = {};
  let lastLead = null;
  let lastServices = {};

  const $ = id => document.getElementById(id);

  function norm(v) {
    return String(v ?? "").trim().toUpperCase();
  }

  function num(v) {
    const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) {
      return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function days(a, b) {
    return Math.round((a - b) / 86400000);
  }

  function keyDate(d) {
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  }

  function fmt(n) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(n) || 0);
  }

  function avg(n) {
    return Number(n || 0).toFixed(2);
  }

  function getField(u, names) {
    for (const n of names) {
      if (u && u[n] !== undefined && u[n] !== null && String(u[n]).trim() !== "") return u[n];
    }
    return "";
  }

  function pickRows(x) {
    if (Array.isArray(x)) return x;
    for (const k of ["data", "units", "rows", "result"]) {
      if (Array.isArray(x?.[k])) return x[k];
    }
    return [];
  }

  async function getJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  }

  function jsonp(url, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const cb = "dashCb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      let done = false;
      const cleanup = () => {
        try { delete window[cb]; } catch (e) {}
        try { script.remove(); } catch (e) {}
      };
      const fail = err => {
        if (done) return;
        done = true;
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err || "JSONP gagal")));
      };
      window[cb] = data => {
        if (done) return;
        done = true;
        cleanup();
        resolve(data);
      };
      script.async = true;
      script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
      script.onerror = () => fail("Web App tidak merespons");
      document.head.appendChild(script);
      setTimeout(() => fail("Timeout API"), timeoutMs);
    });
  }

  async function getApiJson(url) {
    try {
      return await getJson(url);
    } catch (fetchErr) {
      // Fallback JSONP untuk Apps Script yang terkena redirect/CORS.
      return await jsonp(url);
    }
  }

  function isExcludedProgress(p) {
    const x = norm(p).replace(/\s+/g, "");
    return !x || x === "17.DELIVERY" || x === "20.BILLING";
  }

  function periodRows(month, year) {
    return units.filter(u => {
      const d = parseDate(getField(u, ["TGL PKB", "TANGGAL PKB"]));
      return d && d.getMonth() === month && d.getFullYear() === year;
    });
  }

  function wipRows() {
    return units.filter(u => !isExcludedProgress(getField(u, ["PROGRESS"])));
  }

  /* =========================================================
     LEADTIME
     Prioritas:
     1. Tanggal selesai dari DATABASE UNIT bila tersedia.
     2. Delivery dari JSCB/JPCB REKAP yang join DATABASE LEADTIME.
     ========================================================= */
  function calculateLeadtime(rows, month, year, completionMap) {
    const cats = {
      LIGHT: { count: 0, sum: 0, rows: [] },
      MEDIUM: { count: 0, sum: 0, rows: [] },
      HEAVY: { count: 0, sum: 0, rows: [] }
    };

    rows.forEach(u => {
      const start = parseDate(getField(u, ["TGL PKB", "TANGGAL CETAK PKB", "TGL CETAK PKB", "TGLPKB"]));
      if (!start) return;

      let end = parseDate(getField(u, [
        "TANGGAL SELESAI", "TGL SELESAI", "TANGGAL SELESAI ACTUAL", "TGL SELESAI ACTUAL",
        "ACTUAL OUT", "TANGGAL UNIT OUT", "TGL UNIT OUT", "TANGGAL DELIVERY", "TGL DELIVERY"
      ]));

      if (!end && completionMap) {
        const pkb = norm(getField(u, ["NO PKB", "NOPKB"]));
        const nopol = norm(getField(u, ["NO POLISI", "NOPOLISI"]));
        end = completionMap[pkb] || completionMap[nopol] || null;
      }

      if (!end || end < start) return;
      if (start.getMonth() !== month || start.getFullYear() !== year) return;

      // Master kategori Dashboard: KATEGORI, fallback KERUSAKAN/category dari JSCB.
      const cat = norm(getField(u, ["KATEGORI", "CATEGORY", "KERUSAKAN"]));
      if (!cats[cat]) return;

      const lt = days(end, start);
      cats[cat].count++;
      cats[cat].sum += lt;
      cats[cat].rows.push({ u, start, end, lt });
    });

    const all = Object.values(cats);
    const totalUnit = all.reduce((s, x) => s + x.count, 0);
    const totalSum = all.reduce((s, x) => s + x.sum, 0);
    return {
      cats,
      totalUnit,
      totalSum,
      totalAvg: totalUnit ? totalSum / totalUnit : 0,
      rows: all.flatMap(x => x.rows).sort((a, b) => b.start - a.start)
    };
  }

  function buildCompletionMap(rekap) {
    const map = {};
    const list = Array.isArray(rekap?.delivery) ? rekap.delivery : [];
    list.forEach(x => {
      const d = parseDate(x.completionDate || x.delivery || x.tglSelesai);
      if (!d) return;
      const pkb = norm(x.nopkb || x.noPKB);
      const nopol = norm(x.nopol || x.noPolisi);
      if (pkb) map[pkb] = d;
      if (nopol) map[nopol] = d;
    });
    return map;
  }

  /* =========================================================
     UNIT INAP HARIAN
     Endpoint existing: action=unitInap&tanggal=yyyy-MM-dd
     ========================================================= */
  async function loadUnitInapDaily(month, year) {
    const last = new Date(year, month + 1, 0).getDate();
    const dates = Array.from({ length: last }, (_, i) => new Date(year, month, i + 1));
    const result = Array(last).fill(0);

    // Batasi paralel request supaya Apps Script tidak dibanjiri 31 request sekaligus.
    const concurrency = 6;
    let cursor = 0;

    async function worker() {
      while (cursor < dates.length) {
        const i = cursor++;
        const d = dates[i];
        const iso = keyDate(d);
        try {
          const j = await getApiJson(API + "?action=unitInap&tanggal=" + encodeURIComponent(iso) + "&t=" + Date.now());
          result[i] = num(j?.total);
        } catch (e) {
          result[i] = 0;
          console.warn("Unit Inap", iso, e);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, dates.length) }, worker));
    inapDaily = dates.map((d, i) => ({ date: d, day: i + 1, total: result[i] }));
    return inapDaily;
  }

  async function loadLatestUnitInap() {
    try {
      const j = await getApiJson(API + "?action=unitInap&t=" + Date.now());
      return {
        count: uniqueUnitInapCount(j),
        dateUsed: j?.dateUsed || "",
        latestDate: j?.latestDate || ""
      };
    } catch (e) {
      console.warn("Unit Inap terbaru", e);
      return { count: 0, dateUsed: "", latestDate: "", ok: false };
    }
  }

  function uniqueUnitInapCount(data) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const seen = new Set();
    rows.forEach((r, i) => {
      const pkb = String(r?.noPKB ?? "").trim().toUpperCase();
      const nopol = String(r?.noPolisi ?? "").trim().toUpperCase();
      const k = pkb ? "PKB:" + pkb : (nopol ? "NOPOL:" + nopol : "ROW:" + i);
      seen.add(k);
    });
    if (rows.length) return seen.size;
    return num(data?.total);
  }

  function redoRateStats(redoData, completedData) {
    const redo = pickRows(redoData);
    const done = pickRows(completedData);

    const unitKey = x => norm(
      x?.nopol ?? x?.["NO POLISI"] ?? x?.nopolisi ?? ""
    );

    const processOf = x => {
      const vals = [
        x?.defect, x?.alasan, x?.keterangan, x?.DEFECT, x?.ALASAN,
        x?.KETERANGAN, x?.["NAMA DEFECT"], x?.["JENIS DEFECT"],
        x?.["JENIS REDO"], x?.jenis
      ];
      const d = vals.map(v => norm(v)).find(v => v);
      const fi = ["PANEL GAP", "BURAM", "CAT TERKELUPAS", "POOR GLOSS"];
      const prep = ["PIN HOLE", "STRETCH", "PANEL WAVE/GELOMBANG", "DENT/PENYOK"];

      if (d) {
        if (fi.some(v => d === v || d.includes(v))) return "FI";
        if (prep.some(v => d === v || d.includes(v))) return "PREPARATION";
      }

      const p = norm(x?.process ?? x?.jenis ?? x?.["JENIS REDO"] ?? x?.["PROSES REDO"] ?? "");
      if (p.includes("FINAL") || p.includes("INSPECTION") || p.includes("FINAL CHECK")) return "FI";
      return "PAINTING";
    };

    const unitCount = arr => {
      const s = new Set();
      arr.forEach(x => { const k = unitKey(x); if (k) s.add(k); });
      return s.size;
    };

    const paintRedo = redo.filter(x => processOf(x) === "PAINTING");
    const fiRedo = redo.filter(x => processOf(x) === "FI");

    const doneUnits = unitCount(done);
    const paintUnits = unitCount(paintRedo);
    const fiUnits = unitCount(fiRedo);

    return {
      painting: doneUnits ? (paintUnits / doneUnits) * 100 : 0,
      fi: doneUnits ? (fiUnits / doneUnits) * 100 : 0,
      hasData: redo.length > 0 || done.length > 0
    };
  }

  function renderKpi(lead, pr, services, inap, latestInap) {
    $("kIn").textContent = fmt(pr.length);
    $("kOut").textContent = fmt(lead.rows.length);
    $("kWip").textContent = fmt(wipRows().length);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = wipRows().filter(u => {
      const d = parseDate(getField(u, ["JANJI SELESAI"]));
      return d && d < today;
    }).length;
    $("kOverdue").textContent = fmt(overdue);

    // UNIT INAP: selalu ambil audit paling terbaru dari endpoint Unit Inap,
    // bukan tanggal terakhir pada kalender bulan terpilih.
    const latestInapCount = latestInap?.count ?? (inap.length ? inap[inap.length - 1].total : 0);
    $("kInap").textContent = fmt(latestInapCount);
    const latestDate = parseDate(latestInap?.dateUsed || latestInap?.latestDate);
    $("kInapDate").textContent = latestDate
      ? "audit " + latestDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
      : "audit terbaru";

    // REDO: tampilkan persentase REDO PAINTING dan REDO FI.
    const rr = redoRateStats(services.redo?.data, services.redoCompleted?.data);
    $("kRedoPaintPct").textContent = services.redoOk ? rr.painting.toFixed(1) + "%" : "—";
    $("kRedoFiPct").textContent = services.redoOk ? rr.fi.toFixed(1) + "%" : "—";

    const qc = num(services.qc?.mtd?.total ?? services.qc?.totalDefect ?? 0);
    $("kQc").textContent = services.qcOk ? fmt(qc) : "—";

    $("kLead").textContent = avg(lead.totalAvg) + " hari";
  }

  function destroy(name) {
    if (charts[name]) {
      charts[name].destroy();
      delete charts[name];
    }
  }

  function chart(name, id, type, data, options = {}) {
    destroy(name);
    const ctx = $(id);
    if (!ctx) return;
    charts[name] = new Chart(ctx, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        ...options
      }
    });
  }

  function renderTrend(pr, month, year, lead) {
    const daysIn = new Date(year, month + 1, 0).getDate();
    const labels = Array.from({ length: daysIn }, (_, i) => String(i + 1).padStart(2, "0"));
    const cin = Array(daysIn).fill(0);
    const cout = Array(daysIn).fill(0);

    pr.forEach(u => {
      const d = parseDate(getField(u, ["TGL PKB"]));
      if (d) cin[d.getDate() - 1]++;
    });

    lead.rows.forEach(x => {
      if (x.end.getMonth() === month && x.end.getFullYear() === year) cout[x.end.getDate() - 1]++;
    });

    chart("trend", "trendChart", "line", {
      labels,
      datasets: [
        { label: "UNIT IN", data: cin, tension: .25 },
        { label: "UNIT OUT", data: cout, tension: .25 }
      ]
    }, { plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true } } });
  }

  function renderInapDaily() {
    const labels = inapDaily.map(x => String(x.day).padStart(2, "0"));
    chart("inap", "inapChart", "line", {
      labels,
      datasets: [{ label: "UNIT INAP", data: inapDaily.map(x => x.total), tension: .25, fill: false }]
    }, {
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    });
  }

  function renderWip() {
    const groups = { "ATU 1": 0, "ATU 2": 0, "WIP BENGKEL": 0 };
    wipRows().forEach(u => {
      const g = norm(getField(u, ["GROUP", "GRUP"])).replace(/\s+/g, " ");
      if (g === "ATU 1") groups["ATU 1"]++;
      else if (g === "ATU 2") groups["ATU 2"]++;
      else groups["WIP BENGKEL"]++;
    });
    chart("wip", "wipChart", "bar", {
      labels: Object.keys(groups),
      datasets: [{ label: "UNIT", data: Object.values(groups) }]
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } });
  }

  function renderProcess() {
    const map = {};
    wipRows().forEach(u => {
      const p = String(getField(u, ["PROGRESS"])).trim();
      if (p) map[p] = (map[p] || 0) + 1;
    });
    const arr = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12);
    chart("process", "processChart", "bar", {
      labels: arr.map(x => x[0]),
      datasets: [{ label: "WIP", data: arr.map(x => x[1]) }]
    }, { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } });
  }

  function renderLead(lead) {
    $("leadTable").querySelector("tbody").innerHTML = [
      ["LIGHT", lead.cats.LIGHT],
      ["MEDIUM", lead.cats.MEDIUM],
      ["HEAVY", lead.cats.HEAVY],
      ["TOTAL", { count: lead.totalUnit, sum: lead.totalSum, avg: lead.totalAvg }]
    ].map(([c, x]) => `<tr><td><b>${c}</b></td><td>${fmt(x.count)}</td><td>${fmt(x.sum)}</td><td><b>${avg(x.count ? x.sum / x.count : x.avg)} hari</b></td></tr>`).join("");

    chart("lead", "leadChart", "bar", {
      labels: ["LIGHT", "MEDIUM", "HEAVY"],
      datasets: [{ label: "Rata-rata hari", data: ["LIGHT", "MEDIUM", "HEAVY"].map(c => lead.cats[c].count ? lead.cats[c].sum / lead.cats[c].count : 0) }]
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } });
  }

  function renderDetails(rows) {
    const q = norm($("leadSearch").value).replace(/\s+/g, "");
    const body = $("detailTable").querySelector("tbody");
    body.innerHTML = rows.filter(x => {
      const u = x.u;
      const hay = norm(getField(u, ["NO POLISI"])).replace(/\s+/g, "") + " " + norm(getField(u, ["NO PKB"]));
      return !q || hay.includes(q);
    }).slice(0, 500).map(x => {
      const u = x.u;
      return `<tr><td>${getField(u, ["NO POLISI"]) || "-"}</td><td>${getField(u, ["NO PKB"]) || "-"}</td><td>${getField(u, ["KATEGORI", "KERUSAKAN"]) || "-"}</td><td>${getField(u, ["GROUP", "GRUP"]) || "-"}</td><td>${getField(u, ["SA"]) || "-"}</td><td>${keyDate(x.start).split("-").reverse().join("/")}</td><td>${keyDate(x.end).split("-").reverse().join("/")}</td><td><b>${x.lt} hari</b></td></tr>`;
    }).join("") || `<tr><td colspan="8" style="text-align:center">Tidak ada data leadtime.</td></tr>`;
  }

  function downloadCsv(lead) {
    const lines = [
      ["KATEGORI", "UNIT", "TOTAL HARI", "RATA-RATA HARI"],
      ["LIGHT", lead.cats.LIGHT.count, lead.cats.LIGHT.sum, avg(lead.cats.LIGHT.sum / (lead.cats.LIGHT.count || 1))],
      ["MEDIUM", lead.cats.MEDIUM.count, lead.cats.MEDIUM.sum, avg(lead.cats.MEDIUM.sum / (lead.cats.MEDIUM.count || 1))],
      ["HEAVY", lead.cats.HEAVY.count, lead.cats.HEAVY.sum, avg(lead.cats.HEAVY.sum / (lead.cats.HEAVY.count || 1))],
      ["TOTAL", lead.totalUnit, lead.totalSum, avg(lead.totalAvg)]
    ];
    const csv = "\ufeff" + lines.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "dashboard-leadtime.csv";
    a.click();
  }

  async function loadServices(month, year) {
    const services = {};

    const [redoRes, redoDoneRes, qcRes] = await Promise.allSettled([
      getApiJson(REDO_API + "?action=redo&t=" + Date.now()),
      getApiJson(REDO_API + "?action=completed&t=" + Date.now()),
      getApiJson(QC_API + "?action=qcReport&month=" + month + "&year=" + year + "&t=" + Date.now())
    ]);

    if (redoRes.status === "fulfilled" && redoRes.value?.success !== false) {
      services.redo = redoRes.value;
      services.redoOk = true;
    } else services.redoOk = false;

    if (redoDoneRes.status === "fulfilled" && redoDoneRes.value?.success !== false) {
      services.redoCompleted = redoDoneRes.value;
    } else services.redoCompleted = { data: [] };

    if (qcRes.status === "fulfilled" && qcRes.value?.success !== false) {
      services.qc = qcRes.value;
      services.qcOk = true;
    } else services.qcOk = false;

    return services;
  }

  async function loadJscbSupplement() {
    const result = { completionMap: {}, rekap: null, live: null, ok: false };
    try {
      const [live, rekap] = await Promise.all([
        getApiJson(JSCB_API + "?action=jpcbLive&t=" + Date.now()),
        getApiJson(JSCB_API + "?action=rekap&t=" + Date.now())
      ]);
      result.live = live;
      result.rekap = rekap;
      result.completionMap = buildCompletionMap(rekap);
      result.ok = Object.keys(result.completionMap).length > 0;
    } catch (e) {
      console.warn("JSCB supplement tidak tersedia", e);
    }
    return result;
  }

  async function load() {
    const month = +$("month").value;
    const year = +$("year").value;
    const status = $("status");
    status.textContent = "Mengambil DATABASE UNIT, LEADTIME, QC, REDO & UNIT INAP...";

    try {
      // DATABASE UNIT adalah sumber utama KPI WIP/Unit In.
      const unitRes = await getApiJson(API + "?action=unit&t=" + Date.now());
      units = pickRows(unitRes);

      // Ambil sumber leadtime/delivery yang memang sudah dipakai engine JSCB.
      const [supplement, services, inap, latestInap] = await Promise.all([
        loadJscbSupplement(),
        loadServices(month, year),
        loadUnitInapDaily(month - 1, year),
        loadLatestUnitInap()
      ]);

      const completionMap = supplement.completionMap;
      const pr = periodRows(month - 1, year);
      const lead = calculateLeadtime(units, month - 1, year, completionMap);
      lastLead = lead;
      lastServices = services;

      renderKpi(lead, pr, services, inap, latestInap);
      renderTrend(pr, month - 1, year, lead);
      renderInapDaily();
      renderWip();
      renderProcess();
      renderLead(lead);
      renderDetails(lead.rows);

      $("lastUpdate").textContent = "Update " + new Date().toLocaleTimeString("id-ID");

      const leadSource = lead.totalUnit ? "DATABASE UNIT + DATABASE LEADTIME/DELIVERY" : "belum ada completion date yang terbaca";
      status.textContent = `Data ${String(month).padStart(2, "0")}/${year} • ${fmt(units.length)} unit • Leadtime: ${leadSource} • Unit Inap harian: ${inap.length} hari.`;
      window.__dashboardLead = lead;
    } catch (e) {
      status.textContent = "Gagal memuat data: " + e.message;
      console.error(e);
    }
  }

  function init() {
    const now = new Date(), m = $("month"), y = $("year");
    ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].forEach((x, i) => m.insertAdjacentHTML("beforeend", `<option value="${i + 1}">${x}</option>`));
    for (let yy = now.getFullYear() - 2; yy <= now.getFullYear() + 1; yy++) y.insertAdjacentHTML("beforeend", `<option>${yy}</option>`);
    m.value = now.getMonth() + 1;
    y.value = now.getFullYear();

    $("refreshBtn").onclick = load;
    $("csvBtn").onclick = () => window.__dashboardLead && downloadCsv(window.__dashboardLead);
    $("leadSearch").oninput = () => window.__dashboardLead && renderDetails(window.__dashboardLead.rows);
    load();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
