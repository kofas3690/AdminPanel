const $ = (id) => document.getElementById(id);
let cur = null;

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
function mb(n) { return n >= 1024 ? (n / 1024).toFixed(n % 1024 ? 1 : 0) + " GB" : n + " MB"; }
function card(label, value) { const c = el("div", undefined, "card"); c.append(el("b", value), el("span", label, "muted")); return c; }
async function post(path, body) {
  $("err").textContent = ""; $("msg").textContent = "";
  const r = await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? "{}" : JSON.stringify(body) });
  if (!r.ok) { $("err").textContent = await errText(r); return false; }
  return true;
}

function draw(d) {
  cur = d;
  const cards = $("cards"); cards.replaceChildren();
  cards.append(card("Memory (RAM)", mb(d.mem_mb)), card("Swap total", mb(d.swap_total_mb)), card("Swap free", mb(d.swap_free_mb)),
               card("Disk free", mb(d.disk_free_mb)));
  $("warn").textContent = d.swap_total_mb === 0 ? "This machine has no swap. Creating a swap file below is a good idea on a small machine." : "";
  const tb = $("rows"); tb.replaceChildren();
  if (!d.swaps.length) { const tr = el("tr"), td = el("td", "No swap is active.", "muted"); td.colSpan = 4; tr.append(td); tb.append(tr); }
  for (const s of d.swaps) { const tr = el("tr"); tr.append(el("td", s.path), el("td", s.type), el("td", mb(s.size_mb)), el("td", mb(s.used_mb))); tb.append(tr); }
  const has = !!d.file;
  $("createform").hidden = has; $("createhead").hidden = has; $("remove").hidden = !has;
  if (!has) {
    const room = Math.max(0, d.disk_free_mb - d.margin_mb);
    const max = Math.min(d.max_mb, room);
    $("size").max = String(max);
    if (!$("size").value) $("size").value = String(Math.min(Math.max(d.min_mb, Math.round(d.mem_mb / 128) * 128 || d.min_mb), max || d.min_mb));
    $("createhint").textContent = max < d.min_mb ? "Not enough free disk space for a swap file." : "Up to " + mb(max) + " fits; at least " + mb(d.margin_mb) + " stays free.";
    $("createbtn").disabled = max < d.min_mb;
  }
  if (d.file && !d.file_in_fstab) $("warn").textContent = "The swap file is not in /etc/fstab, so it will not come back after a restart.";
  if (document.activeElement !== $("sw") && d.swappiness !== null) $("sw").value = String(d.swappiness);
}

$("createform").onsubmit = async (e) => {
  e.preventDefault();
  const n = parseInt($("size").value, 10);
  if (!confirm("Create a " + mb(n) + " swap file? This uses " + mb(n) + " of disk space.")) return;
  const b = $("createbtn"); b.disabled = true; b.textContent = "Creating…"; $("msg").textContent = "Creating the file. A large file can take a minute.";
  const ok = await post("/api/swap/create", { size_mb: n });
  b.textContent = "Create and turn on";
  if (ok) $("msg").textContent = "Swap file created and turned on.";
  load();
};
$("remove").onclick = async () => {
  if (!confirm("Turn off and delete the swap file? Data in swap is moved back to memory first; this fails if there is not enough free memory.")) return;
  $("remove").disabled = true;
  const ok = await post("/api/swap/remove");
  $("remove").disabled = false;
  if (ok) $("msg").textContent = "Swap file removed.";
  load();
};
$("swform").onsubmit = async (e) => {
  e.preventDefault();
  const ok = await post("/api/swap/swappiness", { value: parseInt($("sw").value, 10) });
  if (ok) $("msg").textContent = "Swappiness set.";
  load();
};

async function load() {
  const r = await api("/api/swap");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  draw(await r.json());
}
load();
