const $ = (id) => document.getElementById(id);
let INST = [], timer = null, jobId = "", since = 0;

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
function say(t) { $("err").textContent = t || ""; }
function btn(text, fn, cls) { const b = document.createElement("button"); b.textContent = text; if (cls) b.className = cls; b.onclick = fn; return b; }
function row(tbody, cells) {
  const tr = document.createElement("tr");
  for (const c of cells) { const td = document.createElement("td"); if (c instanceof Node) td.append(c); else td.textContent = c; tr.append(td); }
  tbody.append(tr);
}

async function showPlan(action, name) {
  say("");
  try {
    const p = await api("/api/packages/plan?action=" + action + "&name=" + encodeURIComponent(name));
    const box = $("plan"); box.textContent = ""; box.hidden = false;
    const h = document.createElement("b");
    h.textContent = (action === "install" ? "Install " : "Remove ") + name + "?";
    box.append(h);
    const list = (title, arr) => {
      if (!arr.length) return;
      const d = document.createElement("div"); d.textContent = title; box.append(d);
      const ul = document.createElement("ul");
      for (const x of arr) { const li = document.createElement("li"); li.textContent = x; ul.append(li); }
      box.append(ul);
    };
    list("Will be installed or upgraded:", p.add);
    list("Will be removed:", p.remove);
    if (!p.add.length && !p.remove.length) { const d = document.createElement("div"); d.textContent = "Nothing would change."; box.append(d); }
    if (p.size) { const d = document.createElement("div"); d.className = "small"; d.textContent = p.size; box.append(d); }
    const row = document.createElement("div"); row.style.marginTop = "8px";
    row.append(btn(action === "install" ? "Install" : "Remove", () => runChange(action, name)), " ", btn("Cancel", () => { box.hidden = true; }));
    box.append(row);
    box.scrollIntoView({ block: "nearest" });
  } catch (e) { say(e.message); }
}
async function runChange(action, name) {
  say("");
  try {
    await api("/api/packages/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, name }) });
    $("plan").hidden = true; $("box").hidden = false; $("box").textContent = ""; since = 0; jobId = "";
    poll();
  } catch (e) { say(e.message); }
}
async function poll() {
  clearTimeout(timer);
  let d;
  try { d = await api("/api/updates/job?since=" + since + "&id=" + jobId); } catch (e) { return; }
  if (d.status === "none") return;
  if (d.id !== jobId) { jobId = d.id; $("box").textContent = ""; }
  $("box").hidden = false;
  $("box").textContent += d.lines.map((l) => l + "\n").join(""); since = d.next; $("box").scrollTop = $("box").scrollHeight;
  const running = d.status === "running";
  $("status").textContent = running ? "Running: " + d.kind + "…" : d.kind + ": " + (d.status === "done" ? "finished" : "failed (exit code " + d.returncode + ")");
  if (running) timer = setTimeout(poll, 1000); else { loadInstalled(); if ($("q").value.trim().length >= 2) search(); }
}

async function search() {
  const q = $("q").value.trim(); if (q.length < 2) return;
  say("");
  try {
    const d = await api("/api/packages/search?q=" + encodeURIComponent(q));
    const b = $("results"); b.textContent = "";
    if (!d.results.length) { row(b, ["No packages found.", "", ""]); return; }
    for (const x of d.results) {
      const act = x.installed ? (() => { const s = document.createElement("span"); s.className = "pill"; s.textContent = "Installed " + x.version; return s; })() : btn("Install…", () => showPlan("install", x.name));
      row(b, [x.name, x.summary, act]);
    }
    if (d.capped) row(b, ["Showing the first " + d.results.length + ". Search for something more specific to narrow it.", "", ""]);
  } catch (e) { say(e.message); }
}
function showInstalled() {
  const q = $("f").value.trim().toLowerCase(); const b = $("installed"); b.textContent = "";
  const rows = INST.filter((x) => !q || x.name.includes(q) || x.summary.toLowerCase().includes(q));
  $("count").textContent = rows.length + " of " + INST.length;
  for (const x of rows.slice(0, 400)) {
    row(b, [x.name, x.version, x.summary, x.locked ? (() => { const s = document.createElement("span"); s.className = "small"; s.textContent = "Needed by the system"; return s; })() : btn("Remove…", () => showPlan("remove", x.name))]);
  }
  if (rows.length > 400) row(b, ["Showing the first 400. Filter to see more.", "", "", ""]);
}
async function loadInstalled() { try { INST = (await api("/api/packages/installed")).packages; showInstalled(); } catch (e) { say(e.message); } }

$("go").onclick = search; $("q").onkeydown = (e) => { if (e.key === "Enter") search(); };
$("f").oninput = showInstalled;
loadInstalled(); poll();
