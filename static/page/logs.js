const $ = (id) => document.getElementById(id);
const Q = (o) => new URLSearchParams(o).toString();
const J = { cursor: "", entries: [], paused: false };   // entries are oldest first
const PRIO = ["Emergency", "Alert", "Critical", "Error", "Warning", "Notice", "Info", "Debug"];
const MAX_KEEP = 3000, MAX_SHOW = 1500;

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDay = (ms) => new Date(ms).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); };

function params(extra) {
  return Q({ lines: $("lines").value, rng: $("rng").value, priority: $("prio").value,
             ident: $("ident").value, q: $("q").value.trim(), ...(extra || {}) });
}

// Newest first, with consecutive identical lines (same source and text) folded into one row with a count.
function render() {
  const box = $("jbox");
  const frag = document.createDocumentFragment();
  const rows = [];
  for (let i = J.entries.length - 1; i >= 0; i--) {
    const e = J.entries[i], last = rows[rows.length - 1];
    if (last && last.e.u === e.u && last.e.m === e.m && last.e.b === e.b) { last.n++; continue; }
    rows.push({ e, n: 1 });
  }
  let day = "", shown = 0;
  for (let i = 0; i < rows.length && shown < MAX_SHOW; i++, shown++) {
    const { e, n } = rows[i];
    const dk = dayKey(e.t);
    if (dk !== day) {
      day = dk;
      const h = document.createElement("div"); h.className = "jday"; h.textContent = fmtDay(e.t); frag.appendChild(h);
    }
    const d = document.createElement("div"); d.className = "jr p" + e.p; d.title = PRIO[e.p];
    const ic = document.createElement("span"); ic.className = "ic"; ic.textContent = e.p <= 4 ? "⚠" : "";
    const t = document.createElement("span"); t.className = "t"; t.textContent = fmtTime(e.t);
    const m = document.createElement("span"); m.className = "m"; m.textContent = e.m;
    const u = document.createElement("span"); u.className = "u"; u.textContent = e.u;
    if (n > 1) { const c = document.createElement("span"); c.className = "n"; c.textContent = String(n); c.title = n + " identical entries"; u.appendChild(c); }
    d.append(ic, t, m, u);
    frag.appendChild(d);
    const next = rows[i + 1];
    if (next && next.e.b && e.b && next.e.b !== e.b) {
      const b = document.createElement("div"); b.className = "jboot"; b.textContent = "Reboot"; frag.appendChild(b);
    }
  }
  box.replaceChildren(frag);
  $("jstatus").textContent = J.entries.length
    ? J.entries.length + " entries" + (rows.length < J.entries.length ? ", " + rows.length + " after folding repeats" : "") + (J.paused ? " · paused" : "")
    : "No entries match these filters.";
}

async function load() {
  $("jstatus").textContent = "Loading…";
  let r;
  try { r = await api("/api/journal?" + params()); } catch (e) { return; }
  if (!r.ok) { $("jstatus").textContent = await errText(r); return; }
  const d = await r.json();
  J.entries = d.entries; J.cursor = d.cursor || "";
  render();
}

async function poll() {
  if (J.paused || document.hidden) return;
  if (!J.cursor) { load(); return; }
  let r;
  try { r = await api("/api/journal?" + params({ after: J.cursor, lines: "500" })); } catch (e) { return; }
  if (!r.ok) return;
  const d = await r.json();
  if (!d.entries.length) return;
  J.entries.push(...d.entries);
  if (J.entries.length > MAX_KEEP) J.entries.splice(0, J.entries.length - MAX_KEEP);
  J.cursor = d.cursor || J.cursor;
  render();
}

$("pause").onclick = () => {
  J.paused = !J.paused;
  $("pause").textContent = J.paused ? "Resume" : "Pause";
  if (!J.paused) poll(); else render();
};
for (const id of ["rng", "prio", "ident", "lines"]) $(id).onchange = load;
let qTimer;
$("q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(load, 350); });
$("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(qTimer); load(); } });
$("dl").onclick = () => {
  const text = J.entries.map((e) => `${new Date(e.t).toISOString()} ${PRIO[e.p]} ${e.u}: ${e.m}`).join("\n") + "\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = "journal.txt";
  document.body.appendChild(a); a.click(); a.remove();
};
setInterval(poll, 2000);

(async () => {
  try {
    const r = await fetch("/api/journal/identifiers");
    if (r.ok) {
      const sel = $("ident");
      for (const n of await r.json()) { const o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o); }
    }
  } catch (e) {}
  load();
})();
