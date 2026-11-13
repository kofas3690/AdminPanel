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
function bytes(n) { const u = ["B", "KB", "MB", "GB"]; let i = 0; while (n >= 1024 && i < 3) { n /= 1024; i++; } return (i ? n.toFixed(1) : n) + " " + u[i]; }
const STATUS = { "2xx": "2xx  worked", "3xx": "3xx  redirected", "4xx": "4xx  not found / refused", "5xx": "5xx  server error" };

async function show() {
  $("err").textContent = "";
  const r = await api("/api/weblogs/tail", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: $("file").value, lines: parseInt($("n").value, 10), filter: $("filter").value }) });
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  const d = await r.json();
  $("lines").textContent = d.lines.length ? d.lines.join("\n") : "No matching lines.";
  $("lines").scrollTop = $("lines").scrollHeight;
}

function rows(id, pairs) {
  const tb = $(id); tb.replaceChildren();
  for (const [k, v] of pairs) { const tr = el("tr"); tr.append(el("td", String(k), "m"), el("td", String(v))); tb.append(tr); }
  if (!pairs.length) { const tr = el("tr"), td = el("td", "None", "muted"); tr.append(td); tb.append(tr); }
}
async function summarise() {
  $("err").textContent = "";
  const r = await api("/api/weblogs/summary?name=" + encodeURIComponent($("file").value));
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  const d = await r.json();
  $("summary").hidden = false;
  $("sumnote").textContent = d.parsed + " requests read" + (d.unparsed ? ", " + d.unparsed + " line(s) not in the usual access-log format (an error log has none)." : ".");
  rows("status", Object.entries(d.status).map(([k, v]) => [STATUS[k] || k, v]));
  rows("ips", d.top_ips); rows("paths", d.top_paths);
}

$("form").onsubmit = (e) => { e.preventDefault(); show(); };
$("sum").onclick = summarise;

async function init() {
  const r = await api("/api/weblogs");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  const d = await r.json(), sel = $("file");
  if (!d.dir_exists || !d.files.length) { $("banner").textContent = "No nginx log files were found in /var/log/nginx. nginx may not be installed, or it logs elsewhere."; $("form").hidden = true; return; }
  for (const f of d.files) { const o = el("option", f.name + "  (" + bytes(f.size) + ")"); o.value = f.name; sel.append(o); }
  const acc = d.files.find((f) => f.name === "access.log"); if (acc) sel.value = acc.name;
  show();
}
init();
