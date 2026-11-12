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
function secs(v) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return v || "?";
  if (n < 0) return "permanent";
  if (n % 86400 === 0) return n / 86400 + " d";
  if (n % 3600 === 0) return n / 3600 + " h";
  if (n % 60 === 0) return n / 60 + " min";
  return n + " s";
}

async function unban(jail, ip, btn) {
  if (!confirm("Lift the block on " + ip + " in \"" + jail + "\"?")) return;
  $("err").textContent = ""; btn.disabled = true;
  const r = await api("/api/blocked/unban", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jail, ip }) });
  if (!r.ok) $("err").textContent = ip + ": " + await errText(r);
  load();
}

function draw(d) {
  const box = $("jails"); box.replaceChildren();
  if (!d.installed) { $("banner").textContent = "fail2ban is not installed on this machine. Install the package fail2ban on the Packages page to have repeated failed sign-ins blocked automatically."; return; }
  if (!d.running) { $("banner").textContent = "fail2ban is installed but its service is not running" + (d.error ? " (" + d.error + ")" : "") + ". Start the fail2ban service on the Services page."; return; }
  const total = d.jails.reduce((a, j) => a + j.ips.length, 0);
  $("banner").textContent = d.jails.length + " jail" + (d.jails.length === 1 ? "" : "s") + ", " + total + " address" + (total === 1 ? "" : "es") + " blocked right now.";
  for (const j of d.jails) {
    const c = el("div", undefined, "jail");
    c.append(el("h2", j.name));
    c.append(el("div", "Blocked now: " + j.banned + " · blocked in total: " + j.total_banned + " · failed attempts seen: " + j.total_failed +
      " · blocks after " + (j.maxretry || "?") + " failures within " + secs(j.findtime) + " for " + secs(j.bantime), "muted"));
    const ips = el("div", undefined, "ips");
    if (!j.ips.length) ips.append(el("span", "Nothing is blocked.", "muted"));
    for (const ip of j.ips) {
      const s = el("span", undefined, "ip"); s.append(el("span", ip));
      const b = el("button", "Lift"); b.onclick = () => unban(j.name, ip, b); s.append(b); ips.append(s);
    }
    c.append(ips); box.append(c);
  }
}

async function load() {
  const r = await api("/api/blocked");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  $("err").textContent = "";
  draw(await r.json());
}
load();
