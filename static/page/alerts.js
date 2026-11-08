const $ = (id) => document.getElementById(id);
let CFG = null;

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
const say = (t, bad) => { const m = $("amsg"); m.textContent = t; m.className = bad ? "crit" : "muted"; };

function drawMuted() {
  const box = $("muted");
  box.replaceChildren();
  if (!CFG.muted.length) { const n = document.createElement("span"); n.style.border = "0"; n.className = "muted"; n.textContent = "None."; box.appendChild(n); return; }
  for (const u of CFG.muted) {
    const s = document.createElement("span"); s.append(u + " ");
    const x = document.createElement("button"); x.textContent = "×"; x.title = "Unmute " + u;
    x.onclick = () => { CFG.muted = CFG.muted.filter((n) => n !== u); persist("Unmuted " + u + "."); };
    s.appendChild(x); box.appendChild(s);
  }
}

function card(a) {
  const d = document.createElement("div"); d.className = "al " + a.severity;
  const ic = document.createElement("span"); ic.className = "ic"; ic.textContent = a.severity === "critical" ? "⛔" : "⚠";
  const mid = document.createElement("div");
  const ti = document.createElement("div"); ti.className = "ti"; ti.textContent = a.title;
  const de = document.createElement("div"); de.className = "de"; de.textContent = a.detail;
  mid.append(ti, de);
  const ac = document.createElement("div"); ac.className = "ac";
  const go = document.createElement("a"); go.href = a.link; go.textContent = "Open"; ac.appendChild(go);
  if (a.kind === "unit") {
    const mu = document.createElement("button"); mu.textContent = "Mute";
    mu.onclick = () => { if (!CFG.muted.includes(a.unit)) CFG.muted.push(a.unit); persist("Muted " + a.unit + "."); };
    ac.appendChild(mu);
  }
  d.append(ic, mid, ac);
  return d;
}

async function refresh() {
  let r;
  try { r = await api("/api/alerts"); } catch (e) { return; }
  if (!r.ok) { say(await errText(r), true); return; }
  const d = await r.json();
  CFG = d.settings;
  const list = $("list"); list.replaceChildren();
  if (!d.alerts.length) {
    const ok = document.createElement("div"); ok.className = "okbox"; ok.textContent = "✓ No problems found.";
    list.appendChild(ok);
  } else for (const a of d.alerts) list.appendChild(card(a));
  if (document.activeElement && ["dw", "dc", "mw"].includes(document.activeElement.id)) { drawMuted(); return; }
  $("dw").value = CFG.disk_warn; $("dc").value = CFG.disk_crit; $("mw").value = CFG.mem_warn;
  drawMuted();
}

async function persist(okText) {
  const body = { disk_warn: +$("dw").value, disk_crit: +$("dc").value, mem_warn: +$("mw").value, muted: CFG.muted };
  const r = await api("/api/alerts/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { say(await errText(r), true); return; }
  say(okText || "Saved.");
  refresh();
}

$("save").onclick = () => persist("Settings saved.");
setInterval(() => { if (!document.hidden) refresh(); }, 30000);
refresh();

// ---- email ----
const msay = (t, bad) => { const m = $("mmsg"); m.textContent = t; m.className = bad ? "crit" : "muted"; };
function mailBody() {
  return { enabled: $("men").checked, host: $("mh").value, port: +$("mp").value || 0, security: $("ms").value,
           username: $("mu").value, sender: $("mf").value, password: $("mw2").value || null,
           to: $("mt").value.split(/[,;\s]+/).filter(Boolean) };
}
function fillMail(c) {
  $("men").checked = c.enabled; $("mh").value = c.host; $("mp").value = c.port; $("ms").value = c.security;
  $("mu").value = c.username; $("mf").value = c.sender; $("mt").value = c.to.join(", ");
  $("mw2").value = ""; $("mw2").placeholder = c.has_password ? "(saved; leave empty to keep it)" : "";
}
async function loadMail() {
  const r = await api("/api/alerts/email");
  if (r.ok) fillMail(await r.json());
}
$("ms").onchange = () => { const p = $("mp"); if (p.value === "587" && $("ms").value === "ssl") p.value = 465; else if (p.value === "465" && $("ms").value === "starttls") p.value = 587; };
$("msave").onclick = async () => {
  const r = await api("/api/alerts/email", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mailBody()) });
  if (!r.ok) { msay(await errText(r), true); return; }
  fillMail(await r.json()); msay("Email settings saved.");
};
$("mtest").onclick = async () => {
  msay("Sending\u2026");
  const r = await api("/api/alerts/email/test", { method: "POST" });
  msay(r.ok ? "Test email sent. Check the inbox (and the spam folder)." : await errText(r), !r.ok);
};
loadMail();
