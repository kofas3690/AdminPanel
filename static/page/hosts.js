const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  if (r.status === 422) return "That address or name is not valid.";
  return "Request failed (" + r.status + ")";
}
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }

async function post(path, body) {
  $("err").textContent = ""; $("msg").textContent = "";
  const r = await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { $("err").textContent = await errText(r); return false; }
  return true;
}

function draw(d) {
  const mine = $("mine"); mine.replaceChildren();
  for (const e of d.managed) {
    const tr = el("tr"), b = el("button", "Remove");
    b.onclick = async () => { if (confirm("Remove " + e.names[0] + " (" + e.address + ")?") && await post("/api/hosts/remove", { address: e.address, name: e.names[0] })) { $("msg").textContent = "Removed."; load(); } };
    const td = el("td"); td.append(b);
    tr.append(el("td", e.address, "m"), el("td", e.names.join(" "), "m"), td); mine.append(tr);
  }
  if (!d.managed.length) { const tr = el("tr"); tr.append(el("td", "Nothing added yet.", "muted")); mine.append(tr); }
  const sys = $("sys"); sys.replaceChildren();
  for (const e of d.system) { const tr = el("tr"); tr.append(el("td", e.address, "m"), el("td", e.names.join(" "), "m")); sys.append(tr); }
}

async function load() {
  const r = await api("/api/hosts");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  draw(await r.json());
}

$("form").onsubmit = async (ev) => {
  ev.preventDefault();
  if (await post("/api/hosts/add", { address: $("addr").value.trim(), name: $("name").value.trim() })) {
    $("msg").textContent = "Added. It applies straight away on this machine."; $("addr").value = ""; $("name").value = ""; load();
  }
};
load();
