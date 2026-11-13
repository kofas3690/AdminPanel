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

function draw(d) {
  const tb = $("rows"); tb.replaceChildren();
  const off = !d.installed;
  $("test").disabled = $("renew").disabled = off;
  if (off) { $("banner").textContent = "certbot is not installed on this machine, so there is nothing to renew here. Install the package certbot on the Packages page to get Let's Encrypt certificates."; return; }
  $("banner").textContent = (d.error ? "certbot reported: " + d.error + ". " : "") + "The renewal timer is " + d.timer + (d.timer === "active" || d.timer === "enabled" ? "." : ", so certificates are not renewed by themselves. Enable the certbot.timer service on the Services page.");
  if (!d.certs.length) { const tr = el("tr"), td = el("td", "certbot manages no certificates yet.", "muted"); td.colSpan = 4; tr.append(td); tb.append(tr); }
  for (const c of d.certs) {
    const tr = el("tr");
    const ok = c.state === "valid";
    const when = c.days === null ? c.state : c.days + " day" + (c.days === 1 ? "" : "s") + " left";
    tr.append(el("td", c.name, "m"), el("td", c.domains.join(", "), "m"), el("td", c.expiry), el("td", ok ? when : c.state, ok ? (c.days !== null && c.days <= 14 ? "warn" : "good") : "bad"));
    tb.append(tr);
  }
}

function show(ok, text) { const o = $("out"); o.hidden = false; o.className = ok ? "good" : "bad"; o.textContent = (ok ? "OK\n" : "Problem\n") + text; }
async function act(path) {
  $("err").textContent = ""; $("test").disabled = $("renew").disabled = true; $("out").hidden = false; $("out").className = ""; $("out").textContent = "Working. This can take a minute...";
  const r = await api(path, { method: "POST" });
  $("test").disabled = $("renew").disabled = false;
  if (!r.ok) { show(false, await errText(r)); return; }
  const d = await r.json(); show(d.ok, d.output);
  load();
}
$("test").onclick = () => act("/api/certrenew/test");
$("renew").onclick = () => { if (confirm("Renew the certificates that are due? Certificates that are not close to expiry are left alone.")) act("/api/certrenew/renew"); };

async function load() {
  const r = await api("/api/certrenew");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  draw(await r.json());
}
load();
