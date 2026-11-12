const $ = (id) => document.getElementById(id);

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
const LABEL = { ok: "OK", warn: "Warning", fail: "Fix" };
const ORDER = { fail: 0, warn: 1, ok: 2 };

function draw(items) {
  const n = { ok: 0, warn: 0, fail: 0 };
  for (const i of items) n[i.status]++;
  const cards = $("cards"); cards.replaceChildren();
  for (const [k, label] of [["ok", "Passed"], ["warn", "Warnings"], ["fail", "To fix"]]) {
    const c = el("div", undefined, "card"); c.append(el("b", String(n[k])), el("span", label, "muted")); cards.append(c);
  }
  const box = $("list"); box.replaceChildren();
  items.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  for (const i of items) {
    const row = el("div", undefined, "row");
    row.append(el("span", LABEL[i.status], "badge b-" + i.status));
    const body = el("div");
    body.append(el("h3", i.title), el("div", i.detail, "muted"));
    if (i.where && i.status !== "ok") { const a = el("a", "Open the page"); a.href = i.where; body.append(a); }
    row.append(body); box.append(row);
  }
}

async function load() {
  $("again").disabled = true; $("err").textContent = "";
  const r = await api("/api/seccheck");
  $("again").disabled = false;
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  draw((await r.json()).items);
}
$("again").onclick = load;
load();
