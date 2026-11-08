// History graphs for the Overview page: CPU, memory, disk and network, from /api/metrics.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const CHARTS = [
    { key: "cpu", title: "CPU", unit: "%", max: 100, series: [["cpu", "--accent", "CPU"]] },
    { key: "mem", title: "Memory", unit: "%", max: 100, series: [["mem", "--ok", "Used"]] },
    { key: "disk", title: "Disk (/)", unit: "%", max: 100, series: [["disk", "--warn", "Used"]] },
    { key: "net", title: "Network", unit: "B/s", max: 0, series: [["rx", "--accent", "Down"], ["tx", "--ok", "Up"]] },
  ];
  let DATA = { step: 60, points: [] };
  const box = document.getElementById("hist");
  const sel = document.getElementById("hrange");
  const note = document.getElementById("hnote");
  const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  function fmtBytes(n) {
    if (n == null) return "–";
    const u = ["B/s", "kB/s", "MB/s", "GB/s"]; let i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
  }
  const fmtVal = (c, v) => v == null ? "–" : c.unit === "%" ? v.toFixed(1) + " %" : fmtBytes(v);
  const span = () => (DATA.points.length ? DATA.points[DATA.points.length - 1].t - DATA.points[0].t : 0);
  function fmtTime(t) {
    const d = new Date(t * 1000);
    const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return sel.value === "7d" || sel.value === "24h" && span() > 86400 * 0.9 ? d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + hm : hm;
  }
  const niceMax = (v) => { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

  function draw(c, card) {
    const W = Math.max(240, card.clientWidth - 24), H = 130, L = 8, R = 8, T = 6, B = 18;
    const old = card.querySelector("svg"); if (old) old.remove();
    const pts = DATA.points;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": c.title + " history" });
    if (!pts.length) { card.appendChild(svg); return; }
    let max = c.max;
    if (!max) { max = 0; for (const p of pts) for (const s of c.series) if (p[s[0]] != null && p[s[0]] > max) max = p[s[0]]; max = niceMax(max * 1.1); }
    const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, t0 + DATA.step);
    const x = (t) => L + (t - t0) / (t1 - t0) * (W - L - R);
    const y = (v) => T + (1 - Math.min(v, max) / max) * (H - T - B);
    for (const f of [0, 0.5, 1]) {
      svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: y(max * f), y2: y(max * f), style: "stroke:var(--line)", "stroke-width": 1 }));
    }
    const lab = (txt, xx, yy, anchor) => { const e = svgEl("text", { x: xx, y: yy, "text-anchor": anchor, style: "fill:var(--muted)", "font-size": 10 }); e.textContent = txt; svg.appendChild(e); };
    lab(c.unit === "%" ? "100 %" : fmtBytes(max), L + 2, T + 9, "start");
    lab(fmtTime(t0), L, H - 4, "start"); lab(fmtTime(t1), W - R, H - 4, "end");
    const gap = DATA.step * 2.5;
    for (const [k, color] of c.series.map((s) => [s[0], s[1]])) {
      let d = "", prev = null, area = [];
      const flush = () => { if (area.length > 1 && c.series.length === 1) {
        const a = "M" + x(area[0][0]) + "," + y(0) + area.map((p) => "L" + x(p[0]) + "," + y(p[1])).join("") + "L" + x(area[area.length - 1][0]) + "," + y(0) + "Z";
        svg.appendChild(svgEl("path", { d: a, style: `fill:var(${color});opacity:.15` })); } area = []; };
      for (const p of pts) {
        const v = p[k];
        if (v == null || (prev != null && p.t - prev > gap)) { flush(); prev = null; }
        if (v == null) continue;
        d += (prev == null ? "M" : "L") + x(p.t).toFixed(1) + "," + y(v).toFixed(1);
        area.push([p.t, v]); prev = p.t;
      }
      flush();
      svg.appendChild(svgEl("path", { d, fill: "none", style: `stroke:var(${color})`, "stroke-width": 1.6, "stroke-linejoin": "round" }));
    }
    const cur = svgEl("line", { y1: T, y2: H - B, style: "stroke:var(--muted)", "stroke-width": 1, visibility: "hidden" });
    svg.appendChild(cur);
    const tip = card.querySelector(".tip");
    svg.onmousemove = (ev) => {
      const r = svg.getBoundingClientRect(), t = t0 + (ev.clientX - r.left) / r.width * (t1 - t0);
      let best = pts[0]; for (const p of pts) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
      const xx = x(best.t) / W * r.width;
      cur.setAttribute("x1", x(best.t)); cur.setAttribute("x2", x(best.t)); cur.setAttribute("visibility", "visible");
      tip.textContent = fmtTime(best.t) + "  " + c.series.map((s) => (c.series.length > 1 ? s[2] + " " : "") + fmtVal(c, best[s[0]])).join(" · ");
      tip.style.display = "block";
      tip.style.left = Math.min(Math.max(xx - 20, 0), card.clientWidth - tip.offsetWidth - 4) + "px"; tip.style.top = "26px";
    };
    svg.onmouseleave = () => { tip.style.display = "none"; cur.setAttribute("visibility", "hidden"); };
    card.appendChild(svg);
    const last = pts[pts.length - 1];
    card.querySelector(".now").textContent = c.series.map((s) => (c.series.length > 1 ? s[2] + " " : "") + fmtVal(c, last[s[0]])).join(" · ");
  }

  function build() {
    box.replaceChildren();
    for (const c of CHARTS) {
      const card = document.createElement("div"); card.className = "hchart"; card.dataset.key = c.key;
      const h = document.createElement("h3"); const t = document.createElement("span"); t.textContent = c.title;
      const n = document.createElement("span"); n.className = "now"; h.append(t, n); card.appendChild(h);
      const tip = document.createElement("div"); tip.className = "tip"; card.appendChild(tip);
      if (c.series.length > 1) {
        const lg = document.createElement("div"); lg.className = "leg";
        for (const s of c.series) { const sp = document.createElement("span"); const i = document.createElement("i"); i.style.background = `var(${s[1]})`; sp.append(i, s[2]); lg.appendChild(sp); }
        card.appendChild(lg);
      }
      box.appendChild(card);
    }
  }
  function redraw() { for (const c of CHARTS) { const card = box.querySelector(`[data-key="${c.key}"]`); if (card) draw(c, card); } }

  async function load() {
    let r;
    try { r = await fetch("/api/metrics?rng=" + sel.value); } catch (e) { return; }
    if (r.status === 401) { location.href = "/login.html"; return; }
    if (!r.ok) { note.textContent = "History is not available."; return; }
    DATA = await r.json();
    note.textContent = DATA.points.length < 2
      ? "Collecting data: the first points appear after a couple of minutes. The panel records one sample a minute and keeps seven days."
      : "One point per " + (DATA.step >= 3600 ? DATA.step / 3600 + " h" : DATA.step / 60 + " min") + " (averages). Gaps mean the panel or the machine was not running.";
    redraw();
  }
  sel.onchange = load;
  window.addEventListener("resize", redraw);
  build(); load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
