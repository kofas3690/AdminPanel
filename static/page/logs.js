const $ = (id) => document.getElementById(id);
const Q = (o) => new URLSearchParams(o).toString();
const J = { cursor: "", entries: [] };
const PRIO = ["Emergency", "Alert", "Critical", "Error", "Warning", "Notice", "Info", "Debug"];

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
const fmtT = (ms) => new Date(ms).toLocaleString([], { month: "short", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function params(extra) {
  return Q({ lines: $("lines").value, rng: $("rng").value, priority: $("prio").value,
             unit: $("unit").value.trim(), q: $("q").value.trim(), ...(extra || {}) });
}

function addRows(list) {
  const box = $("jbox");
  const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
  const frag = document.createDocumentFragment();
  for (const e of list) {
    const d = document.createElement("div");
    d.className = "jr p" + e.p;
    d.title = PRIO[e.p];
    const t = document.createElement("span"); t.className = "t"; t.textContent = fmtT(e.t);
    const u = document.createElement("span"); u.className = "u"; u.textContent = e.u; u.title = e.u;
    const m = document.createElement("span"); m.className = "m"; m.textContent = e.m;
    d.append(t, u, m);
    frag.appendChild(d);
  }
  box.appendChild(frag);
  while (box.childElementCount > 3000) box.firstElementChild.remove();
  J.entries.push(...list);
  if (J.entries.length > 3000) J.entries.splice(0, J.entries.length - 3000);
  if (stick) box.scrollTop = box.scrollHeight;
  $("jstatus").textContent = box.childElementCount + " entries shown";
}

async function load() {
  $("jstatus").textContent = "Loading\u2026";
  let r;
  try { r = await api("/api/journal?" + params()); } catch (e) { return; }
  if (!r.ok) { $("jstatus").textContent = await errText(r); return; }
  const d = await r.json();
  $("jbox").replaceChildren();
  J.entries = []; J.cursor = d.cursor || "";
  addRows(d.entries);
  $("jbox").scrollTop = $("jbox").scrollHeight;
  if (!d.entries.length) $("jstatus").textContent = "No entries match these filters.";
}

async function poll() {
  if (!$("follow").checked || document.hidden) return;
  if (!J.cursor) { load(); return; }
  const r = await api("/api/journal?" + params({ after: J.cursor, lines: "500" }));
  if (!r.ok) return;
  const d = await r.json();
  if (d.entries.length) { addRows(d.entries); J.cursor = d.cursor || J.cursor; }
}

$("go").onclick = load;
$("q").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
$("unit").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
for (const id of ["rng", "prio", "lines"]) $(id).onchange = load;
$("dl").onclick = () => {
  const text = J.entries.map((e) => `${new Date(e.t).toISOString()} ${e.u}: ${e.m}`).join("\n") + "\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = "journal.txt";
  document.body.appendChild(a); a.click(); a.remove();
};
setInterval(poll, 2000);

(async () => {
  try {
    const r = await fetch("/api/units");
    if (r.ok) {
      const dl = $("unitlist");
      for (const u of await r.json()) {
        if (u.type !== "service") continue;
        const o = document.createElement("option"); o.value = u.name; dl.appendChild(o);
      }
    }
  } catch (e) {}
  load();
})();
