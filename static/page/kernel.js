const $ = (id) => document.getElementById(id);
let MODS = [];

function tr(...cells) {
  const t = document.createElement("tr");
  for (const c of cells) {
    const td = document.createElement("td");
    if (c && typeof c === "object" && !(c instanceof Node)) { td.className = c.cls || ""; td.textContent = c.text; }
    else if (c instanceof Node) td.append(c); else td.textContent = c;
    t.append(td);
  }
  return t;
}
function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
function code(t) { const c = document.createElement("code"); c.textContent = t; return c; }

function showMods() {
  const q = $("mfilter").value.trim().toLowerCase();
  const body = $("mods"); body.textContent = "";
  const rows = MODS.filter((m) => !q || m.name.toLowerCase().includes(q) || m.used_by.join(" ").toLowerCase().includes(q));
  $("mcount").textContent = rows.length + " of " + MODS.length;
  for (const m of rows) body.append(tr(m.name, { cls: "num", text: kb(m.size) }, { cls: "num", text: String(m.refs) }, m.used_by.join(", ")));
}

async function load() {
  try {
    const r = await fetch("/api/kernel");
    if (r.status === 401) { location.href = "/login.html"; return; }
    if (!r.ok) throw new Error("Request failed (" + r.status + ")");
    const d = await r.json();
    const s = $("summary"); s.textContent = "";
    const row = (k, v) => { const t = document.createElement("tr"), th = document.createElement("th"), td = document.createElement("td"); th.textContent = k; td.textContent = v; t.append(th, td); s.append(t); };
    row("Kernel", d.release + " (" + d.machine + ")");
    row("Build", d.version);
    row("Tainted", d.taint.value === null ? "Unknown" : d.taint.value === 0 ? "No" : "Yes: " + d.taint.reasons.join("; "));
    row("Loaded modules", d.modules_available ? String(d.modules.length) : "Not reported on this machine");
    const b = $("settings"); b.textContent = "";
    for (const x of d.settings) {
      const pill = document.createElement("span"); pill.className = "pill " + x.status;
      pill.textContent = { ok: "As recommended", different: "Different", info: "Info", unavailable: "Not present" }[x.status];
      const adv = document.createElement("div"); adv.className = "small"; adv.textContent = x.advice;
      b.append(tr(code(x.key), x.what, x.value === null ? "–" : x.value, (() => { const w = document.createElement("div"); w.append(pill, adv); return w; })()));
    }
    MODS = d.modules.sort((a, c) => c.size - a.size); showMods();
  } catch (e) { $("err").textContent = e.message; }
}
$("mfilter").oninput = showMods;
load();
