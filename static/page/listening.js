const $ = (id) => document.getElementById(id);
let data = null;

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
const local = (a) => a === "::1" || a.startsWith("127.");

function draw() {
  const tb = $("rows"); tb.replaceChildren();
  const only = $("onlynet").checked;
  const rows = data.sockets.filter((s) => !only || !local(s.address));
  const net = data.sockets.filter((s) => !local(s.address)).length;
  $("banner").textContent = data.sockets.length + " listening, " + net + " reachable from the network.";
  if (!rows.length) { const tr = el("tr"), td = el("td", "Nothing to show.", "muted"); td.colSpan = 5; tr.append(td); tb.append(tr); return; }
  for (const s of rows) {
    const tr = el("tr");
    tr.append(el("td", String(s.port)), el("td", s.proto.toUpperCase()));
    tr.append(el("td", local(s.address) ? "This machine only" : "Network", local(s.address) ? "ok" : "warn"));
    tr.append(el("td", s.address));
    tr.append(el("td", s.programs.length ? s.programs.map((p) => p.name + " (" + p.pid + ")").join(", ") : "unknown", s.programs.length ? "" : "muted"));
    tb.append(tr);
  }
}

async function load() {
  const r = await api("/api/listening");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  $("err").textContent = "";
  data = await r.json(); draw();
}
$("onlynet").onchange = () => data && draw();
load();
