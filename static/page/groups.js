const $ = (id) => document.getElementById(id);
let USERS = [];

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }

async function act(path, body, ask) {
  if (ask && !confirm(ask)) return;
  $("err").textContent = "";
  const r = await post(path, body);
  if (!r.ok) $("err").textContent = await errText(r);
  load();
}

function members(g) {
  const td = el("td");
  for (const m of g.primary) td.append(el("span", m + " (main group)", "chip fixed"));
  for (const m of g.members.filter((m) => !g.primary.includes(m))) {
    const c = el("span", m, "chip" + (g.locked ? " fixed" : ""));
    if (!g.locked) {
      const x = el("button", "×"); x.title = "Remove " + m + " from " + g.name; x.setAttribute("aria-label", x.title);
      x.onclick = () => act("/api/users/groups/remove", { name: m, group: g.name }, `Remove "${m}" from group "${g.name}"?`);
      c.append(x);
    }
    td.append(c);
  }
  if (!g.members.length) td.append(el("span", "no members", "muted"));
  return td;
}

function actions(g) {
  const td = el("td");
  if (g.locked) { td.append(el("span", "manage from console", "muted")); return td; }
  const candidates = USERS.filter((u) => !u.admin && !g.members.includes(u.name));
  if (candidates.length) {
    const box = el("span", undefined, "adder"), sel = el("select");
    sel.setAttribute("aria-label", "User to add to " + g.name);
    for (const u of candidates) sel.append(new Option(u.name, u.name));
    const add = el("button", "Add");
    add.onclick = () => act("/api/users/groups/add", { name: sel.value, group: g.name });
    box.append(sel, add); td.append(box, " ");
  }
  if (!g.members.length) {
    const d = el("button", "Delete");
    d.onclick = () => act("/api/users/groups/delete", { group: g.name }, `Delete the empty group "${g.name}"?`);
    td.append(d);
  }
  return td;
}

async function load() {
  const [g, u] = await Promise.all([api("/api/users/groups"), api("/api/users")]);
  if (!g.ok || !u.ok) { $("err").textContent = await errText(g.ok ? u : g); return; }
  USERS = await u.json();
  const all = await g.json(), body = $("rows");
  const showLocked = $("showlocked").checked;
  const rows = all.filter((x) => showLocked || !x.locked).sort((a, b) => a.locked - b.locked);
  $("count").textContent = all.filter((x) => x.locked).length + " locked group(s) " + (showLocked ? "shown" : "hidden");
  body.replaceChildren();
  if (!rows.length) { const tr = el("tr"), td = el("td", "No groups yet.", "muted"); td.colSpan = 4; tr.append(td); body.append(tr); }
  for (const x of rows) {
    const tr = el("tr");
    tr.append(el("td", x.name), el("td", String(x.gid)), members(x), actions(x));
    body.append(tr);
  }
}

$("showlocked").onchange = load;
$("create").addEventListener("submit", async (e) => {
  e.preventDefault();
  await act("/api/users/groups/create", { group: $("gname").value });
  e.target.reset();
});
load();
