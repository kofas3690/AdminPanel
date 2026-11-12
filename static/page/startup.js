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
function fmt(s) {
  if (s === null || s === undefined) return "n/a";
  if (s >= 60) return Math.floor(s / 60) + " min " + Math.round(s % 60) + " s";
  if (s >= 1) return s.toFixed(1) + " s";
  return Math.round(s * 1000) + " ms";
}
function card(label, value) { const c = el("div", undefined, "card"); c.append(el("b", value), el("span", label, "muted")); return c; }

function draw(d) {
  const cards = $("cards"); cards.replaceChildren();
  if (d.timing) {
    cards.append(card("Total", fmt(d.timing.total)));
    if (d.timing.kernel !== null) cards.append(card("Kernel", fmt(d.timing.kernel)));
    if (d.timing.initrd !== null) cards.append(card("Initrd", fmt(d.timing.initrd)));
    if (d.timing.userspace !== null) cards.append(card("Services", fmt(d.timing.userspace)));
    $("banner").textContent = "";
  } else {
    $("banner").textContent = "Boot timing is not available" + (d.note ? " (" + d.note + ")" : "") + ".";
  }
  const fb = $("fail"); fb.replaceChildren();
  $("nofail").hidden = d.failed.length > 0; $("failtbl").hidden = d.failed.length === 0;
  for (const f of d.failed) {
    const tr = el("tr"); tr.append(el("td", f.unit), el("td", f.active + " / " + f.sub, "bad"), el("td", f.description)); fb.append(tr);
  }
  const tb = $("rows"); tb.replaceChildren();
  const max = Math.max(0.001, ...d.slowest.map((x) => x.seconds));
  if (!d.slowest.length) { const tr = el("tr"), td = el("td", "No timing data.", "muted"); td.colSpan = 3; tr.append(td); tb.append(tr); }
  for (const x of d.slowest) {
    const tr = el("tr"); tr.append(el("td", x.unit), el("td", fmt(x.seconds)));
    const bc = el("td", undefined, "barcell"), b = el("div", undefined, "bar"); b.style.width = Math.max(1, Math.round(100 * x.seconds / max)) + "%"; bc.append(b); tr.append(bc); tb.append(tr);
  }
}

async function load() {
  const r = await api("/api/startup");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  $("err").textContent = "";
  draw(await r.json());
}
load();
