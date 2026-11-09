const $ = (id) => document.getElementById(id);
const S = { history: [] };

async function api(path) {
  const r = await fetch(path);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  if (!r.ok) {
    let m = "Request failed (" + r.status + ")";
    try { const j = await r.json(); if (typeof j.detail === "string") m = j.detail; } catch (e) {}
    throw new Error(m);
  }
  return r.json();
}
const when = (s) => s ? new Date(s * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
function dur(a, b) {
  const s = Math.max(0, b - a), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m";
}
function row(tbody, cells) {
  const tr = document.createElement("tr");
  for (const c of cells) {
    const td = document.createElement("td");
    if (c instanceof Node) td.appendChild(c); else td.textContent = c;
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
}
function empty(tbody, cols, text) {
  const tr = document.createElement("tr"), td = document.createElement("td");
  td.colSpan = cols; td.className = "muted"; td.textContent = text; tr.appendChild(td); tbody.appendChild(tr);
}
function pill(text, live) {
  const s = document.createElement("span"); s.className = "pill" + (live ? " live" : ""); s.textContent = text; return s;
}

function showHistory() {
  const q = $("fuser").value.trim().toLowerCase();
  const body = $("hist"); body.textContent = "";
  const rows = S.history.filter((h) => !q || h.user.toLowerCase().includes(q) || h.host.toLowerCase().includes(q));
  $("okcount").textContent = rows.length + " of " + S.history.length + " shown";
  if (!rows.length) { empty(body, 5, "No sign-ins match."); return; }
  for (const h of rows) {
    let d;
    if (h.state === "active") d = pill("still signed in", true);
    else if (h.state === "gone") d = pill("no logout recorded");
    else if (h.state === "crash" || h.state === "down") d = pill("ended by " + (h.state === "crash" ? "a crash" : "shutdown"));
    else d = h.end ? dur(h.start, h.end) : "";
    row(body, [h.user, h.tty, h.host || "local", when(h.start), d]);
  }
}

async function loadOk() {
  const d = await api("/api/logins/sessions");
  S.history = d.history;
  $("note").textContent = d.note || "";
  const now = $("now"); now.textContent = "";
  if (!d.now.length) empty(now, 4, "Nobody is signed in on a terminal right now.");
  for (const n of d.now) row(now, [n.user, n.tty, n.host || "local", when(n.start)]);
  showHistory();
}

async function loadBad() {
  const d = await api("/api/logins/failed?rng=" + encodeURIComponent($("rng").value));
  $("badcount").textContent = d.total + " failed attempts from " + d.sources + " address" + (d.sources === 1 ? "" : "es");
  const a = $("byip"); a.textContent = "";
  if (!d.by_ip.length) empty(a, 4, "No failed attempts in this period.");
  for (const g of d.by_ip) {
    row(a, [g.ip, String(g.count), g.users.join(", ") + (g.more_users ? " and " + g.more_users + " more" : ""), when(g.last)]);
  }
  const r = $("recent"); r.textContent = "";
  if (!d.recent.length) empty(r, 3, "Nothing to show.");
  for (const x of d.recent) row(r, [when(x.t), x.user, x.ip]);
}

function tab(name) {
  for (const b of document.querySelectorAll(".tab")) b.classList.toggle("active", b.dataset.tab === name);
  $("tab-ok").hidden = name !== "ok"; $("tab-bad").hidden = name !== "bad";
  go(name);
}
async function go(name) {
  $("err").textContent = "";
  try { await (name === "ok" ? loadOk() : loadBad()); } catch (e) { $("err").textContent = e.message; }
}
for (const b of document.querySelectorAll(".tab")) b.onclick = () => { history.replaceState(null, "", "#" + b.dataset.tab); tab(b.dataset.tab); };
$("fuser").oninput = showHistory;
$("rng").onchange = () => go("bad");
tab(location.hash === "#bad" ? "bad" : "ok");
