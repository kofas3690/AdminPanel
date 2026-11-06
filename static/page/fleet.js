const $ = (id) => document.getElementById(id);
let found = null;           // {url, fp, version} of the server being added
let busy = false;

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
const post = (path, obj) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
function say(text, bad) { const m = $("msg"); m.textContent = text || ""; m.className = bad ? "bad" : "muted"; }
const colonFp = (h) => h.toUpperCase().match(/.{2}/g).join(":");

function pill(st) {
  if (st === "up") return el("span", "pill on", "Up");
  if (st === "cert_changed") return el("span", "pill bad", "Certificate changed");
  if (st === "not_adminpanel") return el("span", "pill bad", "Not AdminPanel");
  return el("span", "pill off", "Down");
}

function openLink(url) {
  // Only an https address that this server itself checked and stored is ever turned into a link.
  if (!/^https:\/\/[^\s"'<>]+$/.test(url)) return el("span", "muted", url);
  const a = el("a", "", url.replace(/^https:\/\//, "").replace(/\/$/, ""));
  a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
  return a;
}

function render(data) {
  const rows = $("rows");
  rows.replaceChildren();
  const me = el("tr");
  const n = el("td"); n.append(el("strong", "", data.self.name), document.createTextNode(" "), el("span", "muted", "(this server)"));
  me.append(n, el("td", "muted", "this page"), (() => { const t = el("td"); t.append(el("span", "pill on", "Up")); return t; })(),
            el("td", "", data.self.version), el("td"));
  rows.append(me);
  for (const h of data.hosts) {
    const tr = el("tr");
    tr.append(el("td", "", h.name));
    const a = el("td"); a.append(openLink(h.url)); tr.append(a);
    const s = el("td"); s.append(pill(h.status));
    if (h.status === "down" && h.error) s.append(document.createTextNode(" "), el("span", "muted", h.error));
    tr.append(s);
    tr.append(el("td", "", h.version || ""));
    const act = el("td", "act");
    if (h.status === "cert_changed") {
      const b = el("button", "", "Trust new certificate");
      b.addEventListener("click", () => trustNew(h));
      act.append(b, document.createTextNode(" "));
    }
    const rm = el("button", "", "Remove");
    rm.addEventListener("click", () => remove(h));
    act.append(rm);
    tr.append(act);
    rows.append(tr);
  }
  if (!data.hosts.length) {
    const tr = el("tr"); const td = el("td", "muted", "No other servers yet. Use “Add a server” below.");
    td.colSpan = 5; tr.append(td); rows.append(tr);
  }
}

async function load() {
  try {
    const r = await api("/api/fleet/hosts");
    if (!r.ok) { say(await errText(r), true); return; }
    render(await r.json());
  } catch (e) { /* redirected to the login page */ }
}

async function remove(h) {
  if (!confirm("Remove " + h.name + " from this list? The server itself is not changed.")) return;
  const r = await api("/api/fleet/hosts/" + encodeURIComponent(h.id), { method: "DELETE" });
  if (!r.ok) { say(await errText(r), true); return; }
  say("Removed " + h.name + ".");
  load();
}

async function trustNew(h) {
  const ok = confirm(h.name + " now shows a different certificate:\n\n" + colonFp(h.fp) +
    "\n\nOnly accept it if you renewed or replaced that server's certificate yourself and this fingerprint matches.");
  if (!ok) return;
  const r = await post("/api/fleet/hosts/" + encodeURIComponent(h.id) + "/pin", { fp: h.fp });
  if (!r.ok) { say(await errText(r), true); return; }
  say("The new certificate for " + h.name + " is accepted.");
  load();
}

$("addbtn").addEventListener("click", () => { $("addbox").hidden = !$("addbox").hidden; if (!$("addbox").hidden) $("url").focus(); });

$("probe").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  busy = true; $("probebtn").disabled = true; $("found").hidden = true; found = null; say("Looking…");
  try {
    const url = $("url").value.trim();
    const r = await post("/api/fleet/probe", { url });
    if (!r.ok) { say(await errText(r), true); return; }
    const j = await r.json();
    found = { url, fp: j.fp, version: j.version };
    $("fver").textContent = j.version;
    $("ffp").textContent = colonFp(j.fp);
    $("found").hidden = false;
    say("");
    $("name").focus();
  } catch (err) { /* redirected */ } finally { busy = false; $("probebtn").disabled = false; }
});

$("save").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!found) return;
  const r = await post("/api/fleet/hosts", { name: $("name").value.trim(), url: found.url, fp: found.fp });
  if (!r.ok) { say(await errText(r), true); return; }
  $("url").value = ""; $("name").value = ""; $("found").hidden = true; $("addbox").hidden = true; found = null;
  say("Server added.");
  load();
});

load();
setInterval(() => { if (!document.hidden) load(); }, 30000);
