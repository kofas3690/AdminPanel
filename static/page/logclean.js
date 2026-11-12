const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function bytes(n) {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(1) : n) + " " + u[i];
}
function card(label, value) { const c = el("div", undefined, "card"); c.append(el("b", value), el("span", label, "muted")); return c; }

function draw(d) {
  const c = $("cards"); c.replaceChildren();
  c.append(card("System journal", bytes(d.journal_bytes)), card("Other logs in /var/log", bytes(d.logs_bytes)), card("Disk free", bytes(d.disk_free)));
  const tb = $("rows"); tb.replaceChildren();
  if (!d.top.length) { const tr = el("tr"), td = el("td", "No log files.", "muted"); td.colSpan = 3; tr.append(td); tb.append(tr); }
  for (const f of d.top) {
    const tr = el("tr"); tr.append(el("td", f.path, "p"), el("td", bytes(f.bytes)), el("td", new Date(f.modified * 1000).toLocaleString())); tb.append(tr);
  }
  $("cut").textContent = d.truncated ? "The folder has very many files; only the first part was counted." : "";
}

async function vacuum(mode, value, label) {
  if (!confirm("Trim the journal to " + label + "? Older entries are removed for good.")) return;
  $("err").textContent = ""; $("msg").textContent = "Trimming...";
  const r = await api("/api/logclean/vacuum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, value }) });
  if (!r.ok) { $("err").textContent = await errText(r); $("msg").textContent = ""; return; }
  $("msg").textContent = (await r.json()).result;
  load();
}
$("sizeform").onsubmit = (e) => { e.preventDefault(); const s = $("size"); vacuum("size", parseInt(s.value, 10), s.options[s.selectedIndex].text); };
$("timeform").onsubmit = (e) => { e.preventDefault(); const s = $("days"); vacuum("time", parseInt(s.value, 10), s.options[s.selectedIndex].text); };

async function load() {
  const r = await api("/api/logclean");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  draw(await r.json());
}
load();
