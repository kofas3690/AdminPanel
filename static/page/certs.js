const $ = (id) => document.getElementById(id);

async function api(path) {
  const r = await fetch(path);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  if (!r.ok) {
    let m = "Request failed (" + r.status + ")";
    try { const j = await r.json(); if (typeof j.detail === "string") m = j.detail; } catch (e) {}
    throw new Error(m);
  }
  return r.json();
}
function cell(...nodes) { const td = document.createElement("td"); for (const n of nodes) td.append(n); return td; }
function div(text, cls) { const d = document.createElement("div"); d.textContent = text; if (cls) d.className = cls; return d; }
const LABEL = { ok: "Valid", warning: "Expires soon", critical: "Expires very soon", expired: "Expired" };
const KIND = { panel: "The panel's own", letsencrypt: "Let's Encrypt", nginx: "Used by nginx" };

function show(d) {
  const body = $("rows"); body.textContent = "";
  if (!d.certs.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 5; td.className = "muted"; td.textContent = "No certificates were found."; tr.append(td); body.append(tr); return;
  }
  for (const c of d.certs) {
    const tr = document.createElement("tr");
    const pill = document.createElement("span"); pill.className = "pill " + c.status; pill.textContent = LABEL[c.status] || c.status;
    const names = c.names.length ? c.names : [c.subject.replace(/^CN=/, "")];
    const left = c.days_left < 0 ? Math.abs(c.days_left) + " days ago" : c.days_left === 0 ? "today" : "in " + c.days_left + " days";
    tr.append(
      cell(pill),
      cell(div(names.slice(0, 3).join(", ") + (names.length > 3 ? " and " + (names.length - 3) + " more" : "")), div(KIND[c.kind] || c.kind, "small")),
      cell(div(c.self_signed ? "Self-signed" : c.issuer)),
      cell(div(new Date(c.end * 1000).toLocaleDateString([], { dateStyle: "medium" })), div(left, "small")),
      cell(div(c.path, "small"), div("SHA-256 " + c.fp.slice(0, 16) + "…", "small")));
    body.append(tr);
  }
  $("when").textContent = "Read " + new Date(d.t * 1000).toLocaleTimeString([], { timeStyle: "short" });
}
async function load(fresh) {
  $("err").textContent = "";
  try { show(await api("/api/certs" + (fresh ? "?fresh=true" : ""))); } catch (e) { $("err").textContent = e.message; }
}
$("again").onclick = () => load(true);
load(false);
