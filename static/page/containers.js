const $ = (id) => document.getElementById(id);
let logId = null;

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

async function act(c, action, btn, label) {
  if (action !== "start" && !confirm((action === "stop" ? "Stop" : "Restart") + " the container \"" + c.name + "\"?")) return;
  $("err").textContent = "";
  const old = btn.textContent; btn.disabled = true; btn.textContent = label;
  const r = await api("/api/containers/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, action }) });
  if (!r.ok) $("err").textContent = c.name + ": " + await errText(r);
  btn.textContent = old; btn.disabled = false;
  load();
  if (logId === c.id) showLog(c);
}

async function showLog(c) {
  logId = c.id;
  $("loghead").hidden = false; $("loghead").textContent = "Log: " + c.name + " (last 300 lines)";
  $("logrefresh").hidden = false; $("logbox").hidden = false;
  $("logrefresh").onclick = () => showLog(c);
  $("logbox").textContent = "Loading…";
  const r = await api("/api/containers/logs?id=" + encodeURIComponent(c.id));
  if (!r.ok) { $("logbox").textContent = await errText(r); return; }
  const t = (await r.json()).log;
  $("logbox").textContent = t || "(the log is empty)";
  $("logbox").scrollTop = $("logbox").scrollHeight;
}

function draw(d) {
  const tb = $("rows"); tb.replaceChildren();
  if (!d.installed) $("banner").textContent = "Docker is not installed on this machine. Install the package docker.io on the Packages page to manage containers here.";
  else if (!d.running) $("banner").textContent = "Docker is installed but its service is not running" + (d.error ? " (" + d.error + ")" : "") + ". Start the docker service on the Services page.";
  else $("banner").textContent = "Docker " + d.version + ": " + d.containers.length + " container" + (d.containers.length === 1 ? "" : "s") + ".";
  if (d.running && !d.containers.length) { const tr = el("tr"), td = el("td", "No containers.", "muted"); td.colSpan = 5; tr.append(td); tb.append(tr); }
  for (const c of d.containers) {
    const tr = el("tr");
    tr.append(el("td", c.name), el("td", c.image));
    const st = el("td"); st.append(el("span", c.state, c.state === "running" ? "ok" : c.state === "exited" || c.state === "dead" ? "bad" : "muted")); st.append(el("div", c.status, "muted")); tr.append(st);
    tr.append(el("td", c.ports, "ports"));
    const ac = el("td", undefined, "act");
    const run = c.state === "running";
    if (!run) { const b = el("button", "Start"); b.onclick = () => act(c, "start", b, "Starting…"); ac.append(b); }
    else { const b = el("button", "Stop"); b.onclick = () => act(c, "stop", b, "Stopping…"); ac.append(b); }
    const rb = el("button", "Restart"); rb.onclick = () => act(c, "restart", rb, "Restarting…");
    const lb = el("button", "Log"); lb.onclick = () => showLog(c);
    ac.append(rb, lb); tr.append(ac); tb.append(tr);
  }
}

async function load() {
  const r = await api("/api/containers");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  $("err").textContent = "";
  draw(await r.json());
}
load();
