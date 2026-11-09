const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}

function fmtBytes(n) {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(1) : Math.round(n)) + " " + u[i];
}
function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + " d " : "") + (h ? h + " h " : "") + m + " min";
}

/* ---------------- live cards ---------------- */
const H = { cpu: [], mem: [], rx: [], tx: [] };
let prev = null;
const push = (a, v) => { a.push(v); if (a.length > 60) a.shift(); };

function setBar(id, pct) {
  const bar = $(id);
  bar.firstElementChild.style.width = Math.min(100, pct) + "%";
  bar.classList.toggle("warn", pct >= 85 && pct < 95);
  bar.classList.toggle("crit", pct >= 95);
}

// Smooth curve through the points that never overshoots (monotone cubic), as bezier control points per segment.
function curveSegments(p) {
  const n = p.length, d = [], m = new Array(n).fill(0), out = [];
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / ((p[i + 1][0] - p[i][0]) || 1));
  if (n > 1) { m[0] = d[0]; m[n - 1] = d[n - 2]; }
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = Math.hypot(a, b);
    if (h > 3) { m[i] = 3 * a / h * d[i]; m[i + 1] = 3 * b / h * d[i]; }
  }
  for (let i = 0; i < n - 1; i++) {
    const dx = (p[i + 1][0] - p[i][0]) / 3;
    out.push([p[i][0] + dx, p[i][1] + m[i] * dx, p[i + 1][0] - dx, p[i + 1][1] - m[i + 1] * dx]);
  }
  return out;
}
function rgba(ctx, color, a) {
  ctx.fillStyle = color; const c = ctx.fillStyle;           // the browser turns any CSS colour into #rrggbb
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : c;
}

// opts.smooth draws curves instead of straight segments; opts.fill adds a soft fade under the first line.
function spark(cv, series, colors, max, opts) {
  opts = opts || {};
  const ctx = cv.getContext("2d"), w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  const top = max || Math.max(1, ...series.flat());
  series.forEach((arr, k) => {
    const pts = arr.map((v, i) => [arr.length < 2 ? 0 : (i / (arr.length - 1)) * (w - 1), h - 2 - (v / top) * (h - 4)]);
    if (!pts.length) return;
    ctx.beginPath();
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    if (opts.smooth && pts.length > 2) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      curveSegments(pts).forEach((c, i) => ctx.bezierCurveTo(c[0], c[1], c[2], c[3], pts[i + 1][0], pts[i + 1][1]));
    } else {
      pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    }
    ctx.stroke();
    if (opts.fill && k === 0 && pts.length > 1) {
      ctx.lineTo(pts[pts.length - 1][0], h); ctx.lineTo(pts[0][0], h); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgba(ctx, colors[k], 0.30)); g.addColorStop(1, rgba(ctx, colors[k], 0));
      ctx.fillStyle = g; ctx.fill();
    }
  });
}

async function tick() {
  const r = await api("/api/system");
  if (!r.ok) return;
  const d = await r.json();

  $("subtitle").textContent = d.os + "  \u00b7  up " + fmtUptime(d.uptime);

  push(H.cpu, d.cpu_percent);
  $("cpu").textContent = d.cpu_percent.toFixed(0) + "%";
  setBar("cpubar", d.cpu_percent);
  spark($("cpuspark"), [H.cpu], [AdminTheme.css("--accent")], 100);
  $("cpuinfo").textContent = d.cpu_cores + " cores \u00b7 load " + d.load.map((x) => x.toFixed(2)).join(", ");

  push(H.mem, d.mem.percent);
  $("mem").textContent = d.mem.percent.toFixed(0) + "%";
  setBar("membar", d.mem.percent);
  spark($("memspark"), [H.mem], [AdminTheme.css("--accent")], 100);
  $("meminfo").textContent = fmtBytes(d.mem.used) + " of " + fmtBytes(d.mem.total) +
    (d.swap.total ? " \u00b7 swap " + fmtBytes(d.swap.used) : "");

  $("disk").textContent = d.disk.percent.toFixed(0) + "%";
  setBar("diskbar", d.disk.percent);
  $("diskinfo").textContent = fmtBytes(d.disk.used) + " of " + fmtBytes(d.disk.total);

  let rrx = 0, rtx = 0;
  if (prev && d.time > prev.time) {
    const dt = d.time - prev.time;
    rrx = Math.max(0, (d.net.rx - prev.rx) / dt);
    rtx = Math.max(0, (d.net.tx - prev.tx) / dt);
    push(H.rx, rrx); push(H.tx, rtx);
  }
  prev = { rx: d.net.rx, tx: d.net.tx, time: d.time };
  $("net").textContent = "\u2193 " + fmtBytes(rrx) + "/s";
  spark($("netspark"), [H.rx, H.tx], [AdminTheme.css("--accent"), AdminTheme.css("--ok")], 0, { smooth: true, fill: true });
  $("netinfo").textContent = "\u2191 " + fmtBytes(rtx) + "/s \u00b7 total \u2193 " + fmtBytes(d.net.rx) + " \u2191 " + fmtBytes(d.net.tx);

  const rows = [
    ["Hostname", d.hostname],
    ["Operating system", d.os],
    ["Kernel", d.kernel + " (" + d.arch + ")"],
    ["Processor", (d.cpu_model || "unknown") + " \u00d7 " + d.cpu_cores],
    ["Load average", d.load.map((x) => x.toFixed(2)).join(", ") + "   (1, 5, 15 min)"],
    ["Uptime", fmtUptime(d.uptime)],
    ["Server time", d.server_time],
    ["IP addresses", d.ips.map((i) => i.addr + "  (" + i.iface + ")").join("\n") || "none"],
    ["Logged-in users", String(d.users)],
  ];
  if (d.reboot_required) rows.push(["Reboot", "A reboot is required to finish updates"]);
  const body = $("sysinfo");
  body.replaceChildren();
  for (const [k, v] of rows) {
    const tr = document.createElement("tr");
    const a = document.createElement("td"); a.textContent = k;
    const b = document.createElement("td"); b.textContent = v; b.className = "addr";
    if (k === "Reboot") b.classList.add("warn");
    tr.append(a, b);
    body.appendChild(tr);
  }
}

/* ---------------- quick services and live logs ---------------- */
async function loadServices() {
  const r = await api("/api/services");
  if (!r.ok) return;
  const rows = await r.json();
  const body = $("svc");
  body.replaceChildren();
  for (const s of rows) {
    const tr = document.createElement("tr");
    for (const text of [s.name, s.boot ? s.state + " \u00b7 boot: " + s.boot : s.state, s.description]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    const td = document.createElement("td");
    for (const a of s.actions) {
      const b = document.createElement("button");
      b.textContent = (a === "enable" || a === "disable") ? a + " at boot" : a;
      b.onclick = () => act(s.name, a);
      td.appendChild(b);
    }
    if (s.state !== "not installed") {
      const lb = document.createElement("button");
      lb.textContent = "logs";
      lb.onclick = () => showLogs(s.name);
      td.appendChild(lb);
    }
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function act(name, action) {
  const boot = action === "enable" || action === "disable";
  if (!confirm(boot ? `${action} ${name} at boot? (it is not started or stopped now)` : `${action} ${name}?`)) return;
  const r = await api(`/api/services/${name}/${action}`, { method: "POST" });
  if (!r.ok) { try { alert((await r.json()).detail); } catch (e) { alert("Request failed"); } }
  loadServices();
}

async function power(action) {
  const msg = await AdminPower.run(action);
  if (msg) $("powermsg").textContent = msg;
}
$("reboot").addEventListener("click", () => power("reboot"));
$("poweroff").addEventListener("click", () => power("poweroff"));

let ws = null;
function stopLogs() {
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
}
function showLogs(name) {
  stopLogs();
  const box = $("logbox");
  box.textContent = "";
  $("logname").textContent = "\u2014 " + name;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/api/logs/${name}`);
  ws.onmessage = (e) => {
    const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
    box.textContent += e.data + "\n";
    if (box.textContent.length > 200000) box.textContent = box.textContent.slice(-100000);
    if (stick) box.scrollTop = box.scrollHeight;
  };
  ws.onclose = () => {
    if (!box.textContent) box.textContent = "(no data: not logged in, or connection closed)";
  };
}
$("logstop").onclick = stopLogs;

tick();
loadServices();
setInterval(() => { if (!document.hidden) tick(); }, 2000);
setInterval(() => { if (!document.hidden) loadServices(); }, 5000);
