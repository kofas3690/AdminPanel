const $ = (id) => document.getElementById(id);
let hosts = [];
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
function say(text, bad) { const m = $("msg"); m.textContent = text || ""; m.className = bad ? "bad" : "muted"; }
const current = () => hosts.find((h) => h.id === $("host").value);

async function loadHosts() {
  const r = await api("/api/remote/hosts");
  if (!r.ok) { say(await errText(r), true); return; }
  hosts = await r.json();
  const sel = $("host");
  const keep = (() => { try { return sessionStorage.getItem("remoteHost"); } catch (e) { return null; } })();
  sel.replaceChildren();
  for (const h of hosts) {
    const o = document.createElement("option");
    o.value = h.id;
    o.textContent = h.name + " (" + h.address + (h.port !== 22 ? ":" + h.port : "") + ")";
    sel.appendChild(o);
  }
  if (keep && hosts.some((h) => h.id === keep)) sel.value = keep;
  $("empty").hidden = hosts.length > 0;
  $("tbl").hidden = hosts.length === 0;
  $("host").disabled = $("reload").disabled = hosts.length === 0;
  if (hosts.length) loadServices();
}

async function loadServices(quiet) {
  const h = current();
  if (!h) return;
  if (!quiet) say("Asking " + h.name + "…");
  $("svc").replaceChildren();
  let r;
  try { r = await api("/api/services?host=" + encodeURIComponent(h.id)); } catch (e) { return; }
  if (!r.ok) { say(await errText(r), true); return; }
  if (!quiet) say("");
  for (const s of await r.json()) {
    const tr = document.createElement("tr");
    for (const text of [s.name, s.state, s.description]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    const td = document.createElement("td");
    td.className = "act";
    for (const a of s.actions) {
      const b = document.createElement("button");
      b.textContent = a;
      b.addEventListener("click", () => act(h, s.name, a));
      td.appendChild(b);
    }
    tr.appendChild(td);
    $("svc").appendChild(tr);
  }
}

async function act(h, name, action) {
  if (busy) return;
  if (!confirm(action + " " + name + " on " + h.name + "?")) return;
  busy = true;
  say("Running " + action + " " + name + " on " + h.name + "…");
  try {
    const r = await api("/api/services/" + encodeURIComponent(name) + "/" + encodeURIComponent(action) +
                        "?host=" + encodeURIComponent(h.id), { method: "POST" });
    if (!r.ok) { say(await errText(r), true); }
    else { say("Done: " + action + " " + name + " on " + h.name + "."); }
  } catch (e) { /* redirected to the login page */ }
  finally { busy = false; }
  loadServices(true);
}

$("host").addEventListener("change", () => {
  try { sessionStorage.setItem("remoteHost", $("host").value); } catch (e) {}
  loadServices();
});
$("reload").addEventListener("click", () => loadServices());
loadHosts();
