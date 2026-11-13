const $ = (id) => document.getElementById(id);
let busy = false;

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
function show(title, text) {
  $("outhead").hidden = false; $("outhead").textContent = title;
  $("out").hidden = false; $("out").textContent = text; $("out").scrollTop = $("out").scrollHeight;
}

const LABEL = { start: "Starting…", stop: "Stopping…", restart: "Restarting…", pull: "Pulling images…", up: "Applying…" };
const ASK = {
  stop: (n) => "Stop every container of the project \"" + n + "\"?",
  restart: (n) => "Restart every container of the project \"" + n + "\"?",
  up: (n) => "Apply \"" + n + "\"? Containers whose image or settings changed are recreated.",
};

async function act(p, action, btn) {
  if (busy) return;
  if (ASK[action] && !confirm(ASK[action](p.name))) return;
  busy = true; $("err").textContent = "";
  const old = btn.textContent; btn.disabled = true; btn.textContent = LABEL[action];
  show(p.name + ": " + action, "Working. Pulling images can take a few minutes…");
  const r = await api("/api/compose/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: p.name, action }) });
  if (!r.ok) { const m = await errText(r); $("err").textContent = p.name + ": " + m; show(p.name + ": " + action + " failed", m); }
  else show(p.name + ": " + action + " done", (await r.json()).output || "ok");
  btn.textContent = old; btn.disabled = false; busy = false;
  load();
}

async function logs(p) {
  show(p.name + ": log (last 300 lines)", "Loading…");
  const r = await api("/api/compose/logs?name=" + encodeURIComponent(p.name));
  show(p.name + ": log (last 300 lines)", r.ok ? ((await r.json()).log || "(the log is empty)") : await errText(r));
}
async function file(p) {
  show(p.name + ": compose file", "Loading…");
  const r = await api("/api/compose/file?name=" + encodeURIComponent(p.name));
  if (!r.ok) { show(p.name + ": compose file", await errText(r)); return; }
  const d = await r.json();
  show(p.name + ": compose file (values of keys that look like passwords are hidden)", d.files.map((f) => "# " + f.path + "\n" + f.text).join("\n\n"));
}

function draw(d) {
  const box = $("projects"); box.replaceChildren();
  if (!d.installed) $("banner").textContent = "Docker is not installed on this machine. Install the package docker.io on the Packages page.";
  else if (!d.running) $("banner").textContent = "Docker is installed but its service is not running" + (d.error ? " (" + d.error + ")" : "") + ". Start the docker service on the Services page.";
  else if (d.compose === false) $("banner").textContent = "Docker is running but the Compose plugin is missing. Install the package docker-compose-v2 on the Packages page.";
  else $("banner").textContent = "Compose " + d.version + ": " + d.projects.length + " project" + (d.projects.length === 1 ? "" : "s") + ".";
  if (d.compose && !d.projects.length) box.append(el("p", "No Compose projects found. A project appears here after it has been started once with docker compose on the command line.", "muted"));
  for (const p of d.projects) {
    const c = el("div", undefined, "proj");
    const h = el("h3", p.name); h.append(" ", el("span", p.status, p.status.startsWith("running") ? "ok" : "muted")); c.append(h);
    c.append(el("div", p.files.length ? p.files.join(", ") : "The compose file is not on this machine any more.", "muted"));
    const t = el("table"), th = el("thead"), hr = el("tr");
    for (const x of ["Service", "Container", "Image", "State", "Ports"]) hr.append(el("th", x));
    th.append(hr); t.append(th);
    const tb = el("tbody");
    for (const s of p.services) {
      const tr = el("tr");
      tr.append(el("td", s.service), el("td", s.container), el("td", s.image));
      const st = el("td"); st.append(el("span", s.state, s.state === "running" ? "ok" : s.state === "exited" || s.state === "dead" ? "bad" : "muted"), el("div", s.status, "muted")); tr.append(st);
      tr.append(el("td", s.ports, "ports")); tb.append(tr);
    }
    if (!p.services.length) { const tr = el("tr"), td = el("td", "No containers.", "muted"); td.colSpan = 5; tr.append(td); tb.append(tr); }
    t.append(tb); const w = el("div", undefined, "tbl-wrap"); w.append(t); c.append(w);
    const bt = el("div", undefined, "btns");
    if (p.files.length) {
      for (const [a, l] of [["start", "Start"], ["stop", "Stop"], ["restart", "Restart"], ["pull", "Pull images"], ["up", "Apply (up -d)"]]) {
        const b = el("button", l); b.onclick = () => act(p, a, b); bt.append(b);
      }
      const f = el("button", "Compose file"); f.onclick = () => file(p); bt.append(f);
    }
    const lb = el("button", "Log"); lb.onclick = () => logs(p); bt.append(lb);
    c.append(bt); box.append(c);
  }
}

async function load() {
  const r = await api("/api/compose");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  if (!busy) $("err").textContent = "";
  draw(await r.json());
}
load();
