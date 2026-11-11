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
const send = (method, path, body) => api(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
function fmtBytes(n) {
  const u = ["B", "kB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 || n >= 100 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
}
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }

async function act(verb, s, btn, label) {
  $("err").textContent = "";
  const old = btn.textContent; btn.disabled = true; btn.textContent = label;
  const r = await send("POST", "/api/shares/" + verb, { name: s.name });
  if (!r.ok) { $("err").textContent = s.name + ": " + await errText(r); }
  else if (verb === "test") {
    const j = await r.json();
    $("err").textContent = "";
    btn.textContent = "OK" + (j.total ? ", " + fmtBytes(j.free) + " free" : "");
    setTimeout(load, 2500);
    return;
  }
  btn.textContent = old;
  load();
}

function draw(d) {
  $("nocifs").hidden = d.cifs;
  $("nonfs").hidden = d.nfs;
  const tb = $("rows"); tb.replaceChildren();
  if (!d.shares.length) { const tr = el("tr"), td = el("td", "No shares yet.", "muted"); td.colSpan = 5; tr.append(td); tb.append(tr); }
  for (const s of d.shares) {
    const tr = el("tr");
    tr.append(el("td", s.name));
    const nfs = s.protocol === "nfs";
    const sv = el("td", nfs ? s.server + ":" + s.share : "//" + s.server + "/" + s.share); sv.append(el("div", (nfs ? "NFS " : "SMB ") + s.vers, "muted")); if (s.user) sv.append(el("div", (s.domain ? s.domain + "\\" : "") + s.user, "muted")); tr.append(sv);
    tr.append(el("td", s.access === "backup" ? "Backups" : "File manager (read only)"));
    const st = el("td");
    if (s.mounted) { st.append(el("span", "Connected", "ok")); if (s.total) st.append(el("div", fmtBytes(s.free) + " free of " + fmtBytes(s.total), "muted")); }
    else st.append(el("span", "Not connected", "muted"));
    tr.append(st);
    const ac = el("td", undefined, "act");
    const bt = el("button", "Test"), bm = el("button", s.mounted ? "Disconnect" : "Connect"), br = el("button", "Remove");
    bt.onclick = () => act("test", s, bt, "Testing…");
    bm.onclick = () => act(s.mounted ? "unmount" : "mount", s, bm, s.mounted ? "Disconnecting…" : "Connecting…");
    br.onclick = () => { if (confirm("Remove the share \"" + s.name + "\"? Files on the server are not touched. Its saved password is deleted.")) act("remove", s, br, "Removing…"); };
    ac.append(bt, bm, br);
    if (s.access === "browse" && s.mounted) { const a = el("a", "Open in File manager"); a.href = "/files.html"; ac.append(" ", a); }
    tr.append(ac); tb.append(tr);
  }
  const b = d.shares.find((s) => s.access === "browse" && s.mounted);
  $("hint").textContent = b ? "In the File manager, go to " + b.path + " to browse " + b.name + "." : "";
}

async function load() {
  const r = await api("/api/shares");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  draw(await r.json());
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault(); $("err").textContent = ""; $("addmsg").textContent = "";
  const body = { protocol: $("protocol").value, name: $("name").value.trim(), server: $("server").value.trim(), share: $("share").value.trim(), user: $("user").value.trim(),
    password: $("password").value, domain: $("domain").value.trim(), vers: $("vers").value, access: $("access").value };
  const r = await send("POST", "/api/shares", body);
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  $("password").value = "";
  $("addmsg").textContent = "Added. Use Test to check it.";
  $("form").reset(); proto();
  load();
});
const SMBV = [["3.1.1", "3.1.1 (newest, most secure)"], ["3.0", "3.0"], ["2.1", "2.1 (older servers)"]];
const NFSV = [["4.2", "4.2 (newest)"], ["4.1", "4.1"], ["4.0", "4.0"], ["3", "3 (older servers)"]];
function proto() {
  const nfs = $("protocol").value === "nfs";
  $("sharelabel").textContent = nfs ? "Export folder" : "Share";
  $("share").placeholder = nfs ? "/srv/backups" : "backups";
  $("verslabel").textContent = nfs ? "NFS version" : "SMB version";
  $("creds").hidden = nfs; $("credhint").hidden = nfs;
  const v = $("vers"); v.replaceChildren();
  for (const [val, text] of nfs ? NFSV : SMBV) v.append(new Option(text, val));
  if (nfs) { $("user").value = ""; $("password").value = ""; $("domain").value = ""; }
}
$("protocol").onchange = proto;
proto();
load();
