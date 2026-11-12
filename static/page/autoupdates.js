const $ = (id) => document.getElementById(id);
let cur = null;

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}

function draw(d) {
  cur = d;
  const st = $("state"), tg = $("toggle");
  $("detail").textContent = "";
  if (!d.installed) {
    st.textContent = "Not available"; st.className = "state bad";
    $("banner").textContent = "The package unattended-upgrades is not installed. Install it on the Packages page, then come back here.";
    tg.hidden = true;
  } else {
    $("banner").textContent = "";
    st.textContent = d.enabled ? "On" : "Off"; st.className = "state " + (d.enabled ? "ok" : "bad");
    tg.hidden = false; tg.textContent = d.enabled ? "Turn off" : "Turn on"; tg.disabled = false;
    $("detail").textContent = "Daily timer: " + d.timer + ". " + (d.enabled && d.timer !== "enabled" ? "The daily timer is not enabled, so nothing will run until it is." : "");
  }
  const has = !!d.log;
  $("loghead").hidden = !has; $("logbox").hidden = !has;
  $("logbox").textContent = d.log || "";
  $("logbox").scrollTop = $("logbox").scrollHeight;
}

$("toggle").onclick = async () => {
  if (!cur) return;
  const want = !cur.enabled;
  if (!want && !confirm("Turn automatic security updates off? The machine will no longer patch itself.")) return;
  $("err").textContent = ""; $("toggle").disabled = true;
  const r = await api("/api/autoupdates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: want }) });
  if (!r.ok) $("err").textContent = await errText(r);
  load();
};

async function load() {
  const r = await api("/api/autoupdates");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  $("err").textContent = "";
  draw(await r.json());
}
load();
