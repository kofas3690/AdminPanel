const $ = (id) => document.getElementById(id);
let cur = "/";

function size(n) {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (i === 0 ? v : v.toFixed(v >= 100 ? 0 : 1)) + " " + u[i];
}
function join(base, name) { return (base === "/" ? "" : base) + "/" + name; }
function parent(p) { const i = p.lastIndexOf("/"); return i <= 0 ? "/" : p.slice(0, i); }

function crumbs(path) {
  const c = $("crumbs"); c.textContent = "";
  const parts = path.split("/").filter(Boolean);
  const add = (label, target) => { const a = document.createElement("a"); a.textContent = label; a.onclick = () => load(target); c.append(a); };
  add("/", "/");
  let acc = "";
  parts.forEach((p, i) => { acc += "/" + p; if (i > 0) c.append(" / "); if (i === parts.length - 1) c.append(p); else add(p, acc); });
}
function cell(content, cls) { const td = document.createElement("td"); if (cls) td.className = cls; if (content instanceof Node) td.append(content); else td.textContent = content; return td; }

async function load(path) {
  $("err").textContent = ""; $("partial").textContent = "";
  try {
    const r = await fetch("/api/du?path=" + encodeURIComponent(path));
    if (r.status === 401) { location.href = "/login.html"; return; }
    if (!r.ok) { let m = "Request failed (" + r.status + ")"; try { m = (await r.json()).detail || m; } catch (e) {} throw new Error(m); }
    const d = await r.json();
    cur = d.path; $("path").value = cur; crumbs(cur);
    $("summary").textContent = size(d.total) + " in " + d.count + " item" + (d.count === 1 ? "" : "s") +
      (d.fs ? " · this filesystem: " + size(d.fs.total - d.fs.free) + " used of " + size(d.fs.total) + ", " + size(d.fs.free) + " free" : "");
    if (d.partial) $("partial").textContent = "This folder is very large, so the measurement stopped early. The sizes shown are a lower bound. Look inside the biggest folders for a full count.";
    const body = $("rows"); body.textContent = "";
    const max = Math.max(1, ...d.items.map((x) => x.size));
    for (const x of d.items) {
      const tr = document.createElement("tr");
      let name;
      if (x.kind === "dir") { name = document.createElement("a"); name.textContent = x.name + "/"; name.onclick = () => load(join(cur, x.name)); }
      else { name = document.createElement("span"); name.textContent = x.name + (x.kind === "link" ? " (link)" : x.kind === "mount" ? " (another filesystem)" : ""); }
      const track = document.createElement("div"); track.className = "track";
      const fill = document.createElement("div"); fill.className = "fill"; fill.style.width = Math.max(1, Math.round(100 * x.size / max)) + "%"; track.append(fill);
      tr.append(cell(name), cell(track, "barcell"), cell(size(x.size), "num"), cell(String(x.files), "num"));
      body.append(tr);
    }
    if (d.count > d.items.length) { const tr = document.createElement("tr"); const td = cell("Showing the biggest " + d.items.length + " of " + d.count + "."); td.colSpan = 4; td.className = "small"; tr.append(td); body.append(tr); }
    if (!d.items.length) { const tr = document.createElement("tr"); const td = cell("This folder is empty."); td.colSpan = 4; td.className = "muted"; tr.append(td); body.append(tr); }
  } catch (e) { $("err").textContent = e.message; }
}
$("go").onclick = () => load($("path").value.trim() || "/");
$("path").onkeydown = (e) => { if (e.key === "Enter") $("go").onclick(); };
$("up").onclick = () => load(parent(cur));
load("/");
