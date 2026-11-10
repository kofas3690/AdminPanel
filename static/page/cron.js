const $ = (id) => document.getElementById(id);
const S = { jobs: [], now: 0 };

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
function cmd(text) { const c = document.createElement("code"); c.className = "cmd"; c.textContent = text; return c; }
function whenCell(j) {
  const d = document.createElement("div"); d.textContent = j.when;
  const r = document.createElement("div"); r.className = "raw"; r.textContent = j.schedule; d.appendChild(r);
  return d;
}
function nextText(j) {
  if (j.schedule === "@reboot") return "At next startup";
  if (!j.next) return "Never (no matching date)";
  const d = new Date(j.next * 1000);
  const mins = Math.round((j.next - S.now) / 60);
  let rel = mins < 60 ? "in " + Math.max(mins, 1) + " min" : mins < 2880 ? "in " + Math.round(mins / 60) + " h" : "in " + Math.round(mins / 1440) + " days";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) + " (" + rel + ")";
}

function showJobs() {
  const q = $("q").value.trim().toLowerCase();
  const body = $("jobs"); body.textContent = "";
  const rows = S.jobs.filter((j) => !q || (j.command + " " + j.user + " " + j.source).toLowerCase().includes(q));
  $("count").textContent = rows.length + " of " + S.jobs.length + " shown";
  if (!rows.length) { empty(body, 5, S.jobs.length ? "No jobs match." : "No cron jobs are set up."); return; }
  for (const j of rows) row(body, [whenCell(j), nextText(j), j.user, cmd(j.command), j.source]);
}

async function load() {
  $("err").textContent = "";
  try {
    const d = await api("/api/cron");
    S.jobs = d.jobs; S.now = d.now;
    const notes = [];
    if (d.note) notes.push(d.note);
    if (!d.cron_running) notes.push("The cron service does not appear to be running, so these jobs will not run until it is started.");
    $("note").textContent = notes.join(" ");
    showJobs();
    const s = $("scripts"); s.textContent = "";
    if (!d.scripts.length) empty(s, 3, "No scripts.");
    for (const x of d.scripts) row(s, [({ hourly: "Every hour", daily: "Every day", weekly: "Every week", monthly: "Every month" })[x.kind], x.name, x.runs ? "" : "Not executable, so it is skipped"]);
    $("anawrap").hidden = !d.anacron.length;
    const a = $("ana"); a.textContent = "";
    for (const x of d.anacron) row(a, [x.period, x.delay, x.id, cmd(x.command)]);
  } catch (e) { $("err").textContent = e.message; }
}
$("q").oninput = showJobs;
load();
