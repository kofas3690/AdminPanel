const $ = (id) => document.getElementById(id);
let D = null;

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
const when = (s) => new Date(s * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
function row(tbody, cells) {
  const tr = document.createElement("tr");
  for (const c of cells) {
    const td = document.createElement("td");
    if (c instanceof Node) td.append(c); else td.textContent = c;
    tr.append(td);
  }
  tbody.append(tr);
}
function empty(tbody, cols, text) {
  const tr = document.createElement("tr"), td = document.createElement("td");
  td.colSpan = cols; td.className = "muted"; td.textContent = text; tr.append(td); tbody.append(tr);
}
function result(x) {
  const s = document.createElement("span");
  s.className = "pill " + x.kind;
  s.textContent = x.kind === "ran" ? "Ran" : x.kind === "denied" ? "Not allowed" : "Wrong password" + (x.attempts ? " ×" + x.attempts : "");
  return s;
}
function cmd(t) { const c = document.createElement("code"); c.className = "cmd"; c.textContent = t; return c; }

function show() {
  const u = $("users"); u.textContent = "";
  if (!D.users.length) empty(u, 4, "No sudo use in this period.");
  for (const s of D.users) row(u, [s.user, String(s.ran), String(s.refused), when(s.last)]);
  const q = $("cfilter").value.trim().toLowerCase();
  const b = $("recent"); b.textContent = "";
  const rows = D.recent.filter((x) => !q || (x.user + " " + x.command).toLowerCase().includes(q));
  $("count").textContent = rows.length + " of " + D.recent.length + " shown" + (D.total > D.recent.length ? " (newest of " + D.total + ")" : "");
  if (!rows.length) empty(b, 5, D.recent.length ? "Nothing matches." : "No sudo use in this period.");
  for (const x of rows) row(b, [when(x.t), x.user, result(x), x.as_user, cmd(x.command)]);
  $("hidden").textContent = !$("panel").checked && D.hidden_panel ? D.hidden_panel + " use(s) by the panel itself are hidden." : "";
}
async function load() {
  $("err").textContent = "";
  try { D = await api("/api/sudo?rng=" + $("rng").value + "&panel=" + ($("panel").checked ? "true" : "false")); show(); }
  catch (e) { $("err").textContent = e.message; }
}
$("rng").onchange = load; $("panel").onchange = load; $("cfilter").oninput = () => D && show();
load();
