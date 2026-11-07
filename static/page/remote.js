const $ = (id) => document.getElementById(id);
let hosts = [];
let busy = false;
let logOf = null;                                  // service whose log is open

const fmtBytes = (n) => {
  if (typeof n !== "number") return "?";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i ? 1 : 0) + " " + u[i];
};
const fmtUp = (s) => {
  if (typeof s !== "number") return "?";
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return (d ? d + " d " : "") + (h || d ? h + " h " : "") + m + " min";
};

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
  if (hosts.length) { loadInfo(); loadServices(); }
  else { $("info").hidden = true; closeLog(); }
}

async function loadInfo() {
  const h = current();
  const box = $("info");
  box.hidden = true;
  if (!h) return;
  let r;
  try { r = await api("/api/remote/info?host=" + encodeURIComponent(h.id)); } catch (e) { return; }
  if (current() !== h || !r.ok) return;             // the services request below shows the error
  const d = await r.json();
  const used = typeof d.mem_total === "number" && typeof d.mem_available === "number" ? d.mem_total - d.mem_available : null;
  const items = [
    ["Name", d.hostname], ["System", d.os], ["Kernel", d.kernel], ["Up", fmtUp(d.uptime)],
    ["Load", (d.load || []).join(", ") + (d.cpus ? "  (" + d.cpus + " CPUs)" : "")],
    ["Memory", fmtBytes(used) + " of " + fmtBytes(d.mem_total)],
    ["Disk (/)", fmtBytes(d.disk_used) + " of " + fmtBytes(d.disk_total)],
  ];
  box.replaceChildren();
  for (const [k, v] of items) {
    const div = document.createElement("div");
    const b = document.createElement("b"); b.textContent = k;
    div.appendChild(b); div.appendChild(document.createTextNode(String(v == null ? "?" : v)));
    box.appendChild(div);
  }
  box.hidden = false;
}

function closeLog() { logOf = null; $("logbox").hidden = true; $("logtext").textContent = ""; }

async function openLog(h, name) {
  logOf = { host: h.id, name };
  $("logtitle").textContent = "Log of " + name + " on " + h.name;
  $("logbox").hidden = false;
  $("logtext").textContent = "Loading…";
  let r;
  try {
    r = await api("/api/remote/logs?host=" + encodeURIComponent(h.id) + "&name=" + encodeURIComponent(name) +
                  "&lines=" + encodeURIComponent($("loglines").value));
  } catch (e) { return; }
  if (!logOf || logOf.host !== h.id || logOf.name !== name) return;   // another log was opened meanwhile
  if (!r.ok) { $("logtext").textContent = await errText(r); return; }
  const j = await r.json();
  $("logtext").textContent = j.text || "(the journal has nothing for this service)";
  $("logtext").scrollTop = $("logtext").scrollHeight;
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
    for (const text of [s.name, s.boot ? s.state + " \u00b7 boot: " + s.boot : s.state, s.description]) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    }
    const td = document.createElement("td");
    td.className = "act";
    for (const a of s.actions) {
      const b = document.createElement("button");
      b.textContent = (a === "enable" || a === "disable") ? a + " at boot" : a;
      b.addEventListener("click", () => act(h, s.name, a));
      td.appendChild(b);
    }
    if (s.state !== "not installed") {
      const lb = document.createElement("button");
      lb.textContent = "log";
      lb.addEventListener("click", () => openLog(h, s.name));
      td.appendChild(lb);
    }
    tr.appendChild(td);
    $("svc").appendChild(tr);
  }
}

async function act(h, name, action) {
  if (busy) return;
  const boot = action === "enable" || action === "disable";
  if (!confirm(boot ? action + " " + name + " at boot on " + h.name + "? (it is not started or stopped now)"
                    : action + " " + name + " on " + h.name + "?")) return;
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
  closeLog();
  loadInfo();
  loadServices();
});
$("reload").addEventListener("click", () => { loadInfo(); loadServices(); });
$("logreload").addEventListener("click", () => { const h = current(); if (logOf && h) openLog(h, logOf.name); });
$("logclose").addEventListener("click", closeLog);
loadHosts();
