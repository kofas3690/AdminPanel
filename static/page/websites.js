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
const KIND = { files: "Files", proxy: "Another program (proxy)", php: "PHP", redirect: "Redirect", other: "Other" };

function draw(d) {
  const tb = $("rows"); tb.replaceChildren();
  if (!d.installed) { $("banner").textContent = "nginx is not installed on this machine."; $("test").disabled = $("reload").disabled = true; return; }
  $("banner").textContent = d.sites.length + " site block" + (d.sites.length === 1 ? "" : "s") + " in use" + (d.available_files ? ", " + d.available_files + " file(s) in sites-available" : "") + ".";
  if (!d.sites.length) { const tr = el("tr"), td = el("td", "No sites found.", "muted"); td.colSpan = 4; tr.append(td); tb.append(tr); }
  for (const s of d.sites) {
    const tr = el("tr");
    tr.append(el("td", s.names.join(", ") || "(any name)", "m"));
    const l = el("td", undefined, "m");
    for (const p of s.listen) l.append(el("span", p, "tag"));
    if (s.https) l.append(el("span", "HTTPS", "tag"));
    tr.append(l);
    const w = el("td"); w.append(el("div", KIND[s.kind] || s.kind));
    if (s.root) w.append(el("div", "Folder: " + s.root, "muted m"));
    if (s.proxy) w.append(el("div", "Passes to: " + s.proxy, "muted m"));
    if (s.certificate) w.append(el("div", "Certificate: " + s.certificate, "muted m"));
    tr.append(w, el("td", s.file, "m")); tb.append(tr);
  }
}

function show(ok, text) { const o = $("testout"); o.hidden = false; o.className = ok ? "good" : "bad"; o.textContent = (ok ? "OK. " : "Problem. ") + text.replaceAll(" | ", "\n"); }
async function act(path, label) {
  $("err").textContent = ""; $("test").disabled = $("reload").disabled = true;
  const r = await api(path, { method: "POST" });
  $("test").disabled = $("reload").disabled = false;
  if (!r.ok) { show(false, await errText(r)); return; }
  const d = await r.json(); show(d.ok, d.output || label);
}
$("test").onclick = () => act("/api/websites/test", "Done.");
$("reload").onclick = () => { if (confirm("Reload nginx? It is tested first and left alone if the test fails.")) act("/api/websites/reload", "Reloaded."); };

async function load() {
  const r = await api("/api/websites");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  draw(await r.json());
}
load();
