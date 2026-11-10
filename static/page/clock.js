const $ = (id) => document.getElementById(id);
let S = null, skew = 0;

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  if (!r.ok) {
    let m = "Request failed (" + r.status + ")";
    try { const j = await r.json(); if (typeof j.detail === "string") m = j.detail; } catch (e) {}
    throw new Error(m);
  }
  return r.json();
}
function post(path, body) {
  return api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function say(ok, text) { $("err").textContent = ok ? "" : text; $("msg").textContent = ok ? text : ""; }

function tick() {
  if (!S) return;
  const d = new Date(Date.now() + skew);
  try {
    $("clock").textContent = d.toLocaleString([], { timeZone: S.timezone || undefined, dateStyle: "full", timeStyle: "medium" });
  } catch (e) { $("clock").textContent = d.toLocaleString(); }
}
function fillZones() {
  const q = $("zfilter").value.trim().toLowerCase();
  const sel = $("zone"); sel.textContent = "";
  for (const z of S.zones) {
    if (q && !z.toLowerCase().includes(q) && z !== S.timezone) continue;
    const o = document.createElement("option"); o.value = z; o.textContent = z; o.selected = z === S.timezone; sel.appendChild(o);
  }
}
function show(d) {
  S = d; skew = d.now * 1000 - Date.now();
  if (!d.available) { $("err").textContent = "This machine does not report its clock settings (timedatectl is not available)."; }
  $("zonenow").textContent = d.timezone ? "Time zone: " + d.timezone : "";
  $("ntpstate").textContent = d.ntp ? (d.synced ? "On, and the clock is synchronised." : "On, but the clock is not synchronised yet.") : "Off. The clock is not being corrected automatically.";
  $("ntpstate").className = d.ntp && !d.synced ? "bad" : "";
  $("ntpbtn").textContent = d.ntp ? "Turn network time off" : "Turn network time on";
  $("ntpbtn").disabled = !d.can_ntp && !d.ntp;
  if (document.activeElement !== $("host")) $("host").value = d.hostname;
  fillZones(); tick();
}
async function load() { try { show(await api("/api/clock")); } catch (e) { say(false, e.message); } }

$("zfilter").oninput = fillZones;
$("zsave").onclick = async () => {
  const z = $("zone").value; if (!z || z === S.timezone) return;
  try { show(await post("/api/clock/timezone", { timezone: z })); say(true, "Time zone changed to " + z + "."); } catch (e) { say(false, e.message); }
};
$("ntpbtn").onclick = async () => {
  const want = S.ntp ? "off" : "on";
  try { show(await post("/api/clock/ntp", { ntp: want })); say(true, "Network time turned " + want + "."); } catch (e) { say(false, e.message); }
};
$("hsave").onclick = async () => {
  const h = $("host").value.trim().toLowerCase(); if (!h || h === S.hostname) return;
  if (!confirm("Change the hostname from " + S.hostname + " to " + h + "?")) return;
  try { show(await post("/api/clock/hostname", { hostname: h })); say(true, "Hostname changed to " + h + "."); } catch (e) { say(false, e.message); }
};
setInterval(tick, 1000);
setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
load();
