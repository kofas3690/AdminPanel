const $ = (id) => document.getElementById(id);
let HW = null;

async function api(path) {
  const r = await fetch(path);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
function fmtBytes(n) {
  const u = ["B", "kB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 ? n.toFixed(0) : n >= 100 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
}
function cell(tr, text, cls) { const td = document.createElement("td"); td.textContent = text == null ? "" : String(text); if (cls) td.className = cls; tr.appendChild(td); return td; }
function kv(id, rows) {
  const tb = $(id); tb.replaceChildren();
  for (const [k, v] of rows) { const tr = document.createElement("tr"); const th = document.createElement("th"); th.textContent = k; tr.appendChild(th); cell(tr, v); tb.appendChild(tr); }
}
function empty(tb, cols, text) { tb.replaceChildren(); const tr = document.createElement("tr"); const td = cell(tr, text, "muted"); td.colSpan = cols; tb.appendChild(tr); }

function drawDisks(d) {
  const tb = $("disks"); tb.replaceChildren();
  $("disknote").textContent = d.note || "";
  if (!d.rows.length) { empty(tb, 7, d.note ? "" : "No disks found."); return; }
  for (const r of d.rows) {
    const tr = document.createElement("tr");
    const n = cell(tr, (r.depth ? "   ".repeat(r.depth) + "└ " : "") + r.name, r.depth ? "tree" : "");
    cell(tr, r.type); cell(tr, fmtBytes(r.size), "num"); cell(tr, r.model); cell(tr, r.bus); cell(tr, r.fs); cell(tr, r.mounts.join(", "));
    tb.appendChild(tr);
  }
}
function drawSensors(s) {
  const tb = $("temps"); tb.replaceChildren();
  const rows = s.temps || [];
  $("temptable").hidden = !rows.length;
  for (const t of rows) {
    const tr = document.createElement("tr");
    cell(tr, t.chip + (t.label ? " – " + t.label : ""));
    const cls = "num tmp" + (t.critical && t.value >= t.critical ? " crit" : t.high && t.value >= t.high ? " warn" : "");
    cell(tr, t.value + " °C", cls); cell(tr, t.high ? t.high + " °C" : "", "num"); cell(tr, t.critical ? t.critical + " °C" : "", "num");
    tb.appendChild(tr);
  }
  const extra = [];
  if (s.fans && s.fans.length) extra.push("Fans: " + s.fans.map((f) => (f.label || f.chip) + " " + f.rpm + " rpm").join(", "));
  if (s.battery) extra.push("Battery: " + s.battery.percent + " %" + (s.battery.plugged ? " (plugged in)" : " (on battery)"));
  $("sensornote").textContent = rows.length || extra.length ? extra.join(" · ") : "This machine reports no temperature sensors (normal on virtual machines and cloud servers).";
}
function drawPci() {
  const f = $("pcifilter").value.trim().toLowerCase();
  const rows = HW.pci.rows.filter((r) => !f || (r.slot + " " + r.class + " " + r.vendor + " " + r.device).toLowerCase().includes(f));
  const tb = $("pci"); tb.replaceChildren();
  $("pcicount").textContent = "(" + rows.length + (f ? " of " + HW.pci.rows.length : "") + ")";
  $("pcinote").textContent = HW.pci.note || (HW.pci.rows.length ? "" : "No PCI devices found.");
  for (const r of rows) { const tr = document.createElement("tr"); cell(tr, r.slot, "tmp"); cell(tr, r.class); cell(tr, r.vendor); cell(tr, r.device); tb.appendChild(tr); }
}
function draw() {
  kv("machine", HW.machine);
  kv("cpu", HW.cpu.rows); $("cpunote").textContent = HW.cpu.note;
  const m = HW.memory;
  kv("mem", [["Total", fmtBytes(m.total)], ["Available now", fmtBytes(m.available)], ["Swap", m.swap ? fmtBytes(m.swap) : "none"]]);
  $("modtable").hidden = !m.modules.length;
  const tb = $("modules"); tb.replaceChildren();
  for (const r of m.modules) { const tr = document.createElement("tr"); cell(tr, r.slot); cell(tr, r.size, "num"); cell(tr, r.type); cell(tr, r.speed); cell(tr, r.maker); cell(tr, r.form); tb.appendChild(tr); }
  $("memnote").textContent = m.note;
  drawDisks(HW.disks); drawSensors(HW.sensors); drawPci();
  const u = HW.usb, ub = $("usb"); ub.replaceChildren();
  $("usbcount").textContent = "(" + u.rows.length + ")";
  $("usbnote").textContent = u.note || (u.rows.length ? "" : "No USB devices found.");
  for (const r of u.rows) { const tr = document.createElement("tr"); cell(tr, r.bus + ":" + r.device, "tmp"); cell(tr, r.id, "tmp"); cell(tr, r.name); ub.appendChild(tr); }
}
async function load() {
  $("hwmsg").textContent = "Loading…";
  try {
    const r = await api("/api/hardware");
    if (!r.ok) { $("hwmsg").textContent = "Could not read the hardware information."; return; }
    HW = await r.json(); draw(); $("hwmsg").textContent = "";
  } catch (e) { $("hwmsg").textContent = ""; }
}
$("refresh").onclick = load;
$("pcifilter").addEventListener("input", () => { if (HW) drawPci(); });
setInterval(async () => {
  if (document.hidden || !HW) return;
  try { const r = await api("/api/hardware/sensors"); if (r.ok) drawSensors(await r.json()); } catch (e) {}
}, 5000);
load();
