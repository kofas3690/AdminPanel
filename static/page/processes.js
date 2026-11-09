const $ = (id) => document.getElementById(id);
let DATA = null, sortKey = "cpu", sortDir = -1, timer = null;

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
function bytes(n) {
  const u = ["B", "kB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 || n >= 100 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
}
function ago(t, now) {
  const s = Math.max(0, now - t);
  if (s < 90) return s + " s ago"; if (s < 5400) return Math.round(s / 60) + " min ago";
  if (s < 172800) return Math.round(s / 3600) + " h ago"; return Math.round(s / 86400) + " days ago";
}

function stat(label, value) { const d = el("div"); d.append(el("b", value), el("span", label, "muted")); return d; }

function draw() {
  if (!DATA) return;
  const c = DATA.counts;
  const s = $("stats"); s.replaceChildren(
    stat("processes", String(DATA.total)), stat("running", String(c.running)), stat("sleeping", String(c.sleeping)),
    stat("zombie", String(c.zombie)), stat("load (1 / 5 / 15 min)", DATA.load.join(" / ")));
  const q = $("q").value.trim().toLowerCase(), hide = $("mine").checked;
  const rows = DATA.rows.filter((r) => (!hide || !r.protected) &&
    (!q || r.name.toLowerCase().includes(q) || r.user.toLowerCase().includes(q) || String(r.pid) === q || r.cmd.toLowerCase().includes(q)));
  rows.sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * sortDir || a.pid - b.pid;
  });
  $("shown").textContent = rows.length + " shown";
  const tb = $("rows"); tb.replaceChildren();
  for (const r of rows.slice(0, 400)) {
    const tr = el("tr", undefined, r.state === "zombie" ? "zombie" : "");
    const cells = [el("td", String(r.pid), "num"), el("td", r.name), el("td", r.user), el("td", r.cpu.toFixed(1), "num"),
      el("td", bytes(r.mem), "num"), el("td", r.state), el("td", ago(r.t, DATA.now)), el("td", r.cmd, "cmd")];
    cells[7].title = r.cmd;
    for (const x of cells) tr.append(x);
    const td = el("td");
    if (r.protected) { td.append(el("span", "locked", "muted")); td.title = "Root, system and panel processes can't be ended here"; }
    else {
      const e = el("button", "End"), f = el("button", "Force quit");
      e.onclick = () => stop(r, "TERM"); f.onclick = () => stop(r, "KILL");
      td.append(e, " ", f);
    }
    tr.append(td); tb.append(tr);
  }
  for (const th of document.querySelectorAll("th.sort")) th.setAttribute("aria-sort", th.dataset.k === sortKey ? (sortDir < 0 ? "descending" : "ascending") : "none");
}

async function stop(r, sig) {
  const what = sig === "TERM" ? "End" : "Force quit";
  if (!confirm(what + ' "' + r.name + '" (process ' + r.pid + ", user " + r.user + ")?" + (sig === "KILL" ? "\nUnsaved work in it will be lost." : ""))) return;
  $("err").textContent = "";
  const x = await api("/api/processes/signal", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pid: r.pid, started: r.st, signal: sig, name: r.name }) });
  if (!x.ok) $("err").textContent = await errText(x);
  setTimeout(load, 700);
}

async function load() {
  clearTimeout(timer);
  try {
    const r = await api("/api/processes");
    if (!r.ok) $("err").textContent = await errText(r);
    else { DATA = await r.json(); draw(); }
  } catch (e) { $("err").textContent = e.message; }
  if ($("live").checked) timer = setTimeout(load, 3000);
}

for (const th of document.querySelectorAll("th.sort")) th.onclick = () => {
  if (sortKey === th.dataset.k) sortDir = -sortDir; else { sortKey = th.dataset.k; sortDir = ["name", "user", "state", "pid", "t"].includes(sortKey) ? 1 : -1; }
  draw();
};
$("q").oninput = draw; $("mine").onchange = draw; $("live").onchange = load;
document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(timer); else load(); });
load();
