const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const JSONH = { "Content-Type": "application/json" };

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
function fmtBytes(n) {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(1) : Math.round(n)) + " " + u[i];
}
const fmtRate = (n) => fmtBytes(n) + "/s";
function td(tr, text, cls) {
  const c = document.createElement("td"); c.textContent = text;
  if (cls) c.className = cls; tr.appendChild(c); return c;
}
function btn(text, fn) {
  const b = document.createElement("button"); b.textContent = text; b.onclick = fn; return b;
}

/* ---------------- tabs ---------------- */
document.querySelectorAll("button.tab").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("button.tab").forEach((x) => x.classList.toggle("active", x === b));
    $("tab-activity").hidden = b.dataset.tab !== "activity";
    $("tab-config").hidden = b.dataset.tab !== "config";
    if (b.dataset.tab === "activity") { loadConns(); drawGraph(); }
  };
});

// /network.html#config opens the Configuration tab (the VPN and Proxy pages link here)
function openFromHash() {
  if (location.hash === "#config") document.querySelector('button.tab[data-tab="config"]').click();
}
window.addEventListener("hashchange", openFromHash);
openFromHash();

/* ---------------- activity ---------------- */
const hist = {};
let runtime = {}, rtRoutes = [], rtDns = { servers: [], search: [] };

function spark(canvas, rx, tx) {
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(1, ...rx, ...tx);
  const draw = (arr, color) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    arr.forEach((v, i) => {
      const x = arr.length < 2 ? 0 : (i / (arr.length - 1)) * (w - 1);
      const y = h - 1 - (v / max) * (h - 3);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  draw(rx, AdminTheme.css("--ok")); draw(tx, AdminTheme.css("--accent"));
}

/* ---------------- live traffic graph ---------------- */
const WIN = 90;                       // samples shown: 90 x 2 s = 3 minutes
let gsel = "", gnames = "", ghover = -1;

/* Round a rate up to a tidy axis maximum (1, 2, 5, 10 ... in B, KB, MB ...), at least 1 KB. */
function niceMax(v) {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  v = Math.max(v, 1024);
  for (let u = 1; u < 1024 ** 5; u *= 1024)
    for (const s of steps) if (s * u >= v) return s * u;
  return v;
}
function hexA(hex, a) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")" : hex;
}
/* Smooth line through the points; it never leaves the range of the data (no dips below zero). */
function trace(ctx, p) {
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++)
    ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
  ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
}

function drawGraph() {
  const cv = $("traffic");
  if (!cv || $("tab-activity").hidden) return;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const h = hist[gsel] || { rx: [], tx: [] };
  const rx = h.rx.slice(-WIN), tx = h.tx.slice(-WIN), n = rx.length;
  const C = AdminTheme.css;
  const cDl = C("--ok"), cUl = C("--accent"), cGrid = C("--line"), cMute = C("--muted");
  const L = 62, R = 14, T = 10, B = 24, pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(0, ...rx, ...tx));
  ctx.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

  /* grid and axis labels */
  ctx.lineWidth = 1; ctx.strokeStyle = cGrid; ctx.fillStyle = cMute;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let k = 0; k <= 4; k++) {
    const y = Math.round(T + ph * (1 - k / 4)) + .5;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
    ctx.fillText(k === 0 ? "0" : fmtBytes(max * k / 4).replace(".0 ", " "), L - 8, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const marks = ["3 min ago", "", "2 min", "", "1 min", "", "now"];
  for (let j = 0; j <= 6; j++) {
    const x = Math.round(L + pw * j / 6) + .5;
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
    if (marks[j]) {
      ctx.textAlign = j === 0 ? "left" : j === 6 ? "right" : "center";
      ctx.fillText(marks[j], j === 0 ? L : j === 6 ? W - R : x, T + ph + 7);
    }
  }
  if (n < 2) {
    ctx.fillStyle = cMute; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Collecting data...", L + pw / 2, T + ph / 2);
    return;
  }

  /* the two series: upload first, so the download line is drawn on top */
  const xAt = (i) => L + pw * ((WIN - n + i) / (WIN - 1));
  const yAt = (v) => T + ph * (1 - Math.min(v, max) / max);
  const pts = (arr) => arr.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const series = [[tx, cUl], [rx, cDl]];
  for (const [arr, color] of series) {
    const p = pts(arr);
    const g = ctx.createLinearGradient(0, T, 0, T + ph);
    g.addColorStop(0, hexA(color, .30)); g.addColorStop(1, hexA(color, 0));
    ctx.beginPath(); trace(ctx, p);
    ctx.lineTo(p[n - 1].x, T + ph); ctx.lineTo(p[0].x, T + ph); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); trace(ctx, p);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
  }

  /* hover read-out */
  if (ghover >= 0 && ghover < n) {
    const x = xAt(ghover);
    ctx.strokeStyle = cMute; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke(); ctx.setLineDash([]);
    for (const [arr, color] of series) {
      ctx.beginPath(); ctx.arc(x, yAt(arr[ghover]), 4, 0, 7);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = C("--panel"); ctx.lineWidth = 2; ctx.stroke();
    }
    const ago = Math.round((n - 1 - ghover) * 2);
    const lines = [ago ? ago + " s ago" : "now", "Down  " + fmtRate(rx[ghover]), "Up  " + fmtRate(tx[ghover])];
    const bw = 124, bh = 58, bx = x + 12 + bw > W - R ? x - 12 - bw : x + 12, by = T + 6;
    ctx.fillStyle = C("--panel2"); ctx.strokeStyle = cGrid; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 6); else ctx.rect(bx, by, bw, bh);
    ctx.fill(); ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "12px system-ui, sans-serif";
    lines.forEach((t, i) => {
      ctx.fillStyle = i === 0 ? cMute : i === 1 ? cDl : cUl;
      ctx.fillText(t, bx + 10, by + 13 + i * 16);
    });
  }
}

/* keep the picker in step with the interfaces; default to the one that carries the default route */
function syncGraphPicker(d) {
  const names = d.interfaces.map((i) => i.name);
  const key = names.join(",");
  if (key !== gnames) {
    gnames = key;
    const sel = $("gif");
    sel.replaceChildren();
    for (const nm of names) { const o = document.createElement("option"); o.value = o.textContent = nm; sel.appendChild(o); }
    if (!names.includes(gsel)) {
      const def = d.routes.find((r) => r.dst === "default" && names.includes(r.dev));
      gsel = def ? def.dev : (names.find((nm) => nm !== "lo") || names[0] || "");
    }
    sel.value = gsel;
  }
  const h = hist[gsel];
  $("gdl").textContent = h ? fmtRate(h.rrx) : "-";
  $("gul").textContent = h ? fmtRate(h.rtx) : "-";
  drawGraph();
}
$("gif").addEventListener("change", (e) => { gsel = e.target.value; ghover = -1; drawGraph(); });
$("traffic").addEventListener("mousemove", (e) => {
  const cv = e.currentTarget, h = hist[gsel], n = h ? Math.min(h.rx.length, WIN) : 0;
  const L = 62, R = 14, pw = cv.clientWidth - L - R;
  const i = Math.round((e.offsetX - L) / pw * (WIN - 1)) - (WIN - n);
  ghover = i >= 0 && i < n ? i : -1;
  drawGraph();
});
$("traffic").addEventListener("mouseleave", () => { ghover = -1; drawGraph(); });
window.addEventListener("resize", drawGraph);
window.addEventListener("themechange", drawGraph);

async function loadOverview() {
  const r = await api("/api/network/overview");
  if (!r.ok) return;
  const d = await r.json();
  runtime = {};
  for (const i of d.interfaces) runtime[i.name] = i;
  rtRoutes = d.routes; rtDns = d.dns;

  const body = $("ifaces"); body.replaceChildren();
  for (const i of d.interfaces) {
    const h = hist[i.name] || (hist[i.name] = { prev: null, rx: [], tx: [], rrx: 0, rtx: 0 });
    if (h.prev && d.ts > h.prev.ts) {
      const dt = d.ts - h.prev.ts;
      h.rrx = Math.max(0, (i.rx_bytes - h.prev.rx) / dt);
      h.rtx = Math.max(0, (i.tx_bytes - h.prev.tx) / dt);
      h.rx.push(h.rrx); h.tx.push(h.rtx);
      if (h.rx.length > WIN) { h.rx.shift(); h.tx.shift(); }
    }
    h.prev = { rx: i.rx_bytes, tx: i.tx_bytes, ts: d.ts };

    const tr = document.createElement("tr");
    td(tr, i.name + "  (" + i.kind + (i.master ? ", in " + i.master : "") + ")");
    td(tr, i.state || "?", i.state === "up" ? "" : i.state === "down" ? "crit" : "muted");
    td(tr, i.addresses.map((a) => a.addr + (a.dynamic ? " (dynamic)" : "")).join("\n"), "addr");
    td(tr, [i.mac, i.mtu ? "MTU " + i.mtu : "", i.speed > 0 ? i.speed + " Mb/s" : ""].filter(Boolean).join("\n"), "addr");
    td(tr, fmtRate(h.rrx)); td(tr, fmtRate(h.rtx));
    td(tr, fmtBytes(i.rx_bytes) + " / " + fmtBytes(i.tx_bytes));
    td(tr, i.errors + " / " + i.drops, i.errors || i.drops ? "warn" : "");
    const g = document.createElement("td"), cv = document.createElement("canvas");
    cv.width = 120; cv.height = 28; g.appendChild(cv); tr.appendChild(g);
    body.appendChild(tr);
    spark(cv, h.rx.slice(-60), h.tx.slice(-60));
  }
  syncGraphPicker(d);

  const rb = $("routes"); rb.replaceChildren();
  for (const rt of d.routes) {
    const tr = document.createElement("tr");
    td(tr, rt.dst); td(tr, rt.gateway); td(tr, rt.dev);
    td(tr, rt.metric === null || rt.metric === undefined ? "" : rt.metric); td(tr, rt.src);
    rb.appendChild(tr);
  }
  $("dns").textContent = "DNS servers: " + (d.dns.servers.join(", ") || "none") +
    (d.dns.search.length ? "    Search: " + d.dns.search.join(" ") : "");
}

async function loadConns() {
  if ($("tab-activity").hidden) return;
  const r = await api("/api/network/connections");
  if (!r.ok) return;
  const rows = await r.json(), f = $("cfilter").value;
  const shown = rows.filter((c) => f === "all" ||
    (f === "listen" ? c.state === "LISTEN" || c.state === "UNCONN" : c.state === "ESTAB"));
  const body = $("conns"); body.replaceChildren();
  for (const c of shown.slice(0, 300)) {
    const tr = document.createElement("tr");
    td(tr, c.proto); td(tr, c.state); td(tr, c.local); td(tr, c.peer); td(tr, c.process);
    body.appendChild(tr);
  }
}
$("cfilter").onchange = loadConns;

/* ---------------- configuration ---------------- */
let cfg = { version: 1, items: {} }, applied = { version: 1, items: {} }, physical = [];

const IP_FIELDS = [
  { k: "dhcp4", label: "Get an IPv4 address by DHCP", t: "bool" },
  { k: "dhcp6", label: "Use DHCPv6", t: "bool" },
  { k: "addresses", label: "Static addresses (CIDR, comma-separated)", t: "list", ph: "192.168.1.10/24" },
  { k: "gateway4", label: "IPv4 gateway (inside one of the addresses above)", t: "text" },
  { k: "gateway6", label: "IPv6 gateway", t: "text" },
  { k: "dns", label: "DNS servers (comma-separated)", t: "list", ph: "1.1.1.1, 8.8.8.8" },
  { k: "mtu", label: "MTU (optional)", t: "int" },
  { k: "routes", label: "Extra routes, one per line: 10.0.0.0/8 via 192.168.1.1", t: "lines" },
];
const KINDS = {
  ethernet: { label: "Interface", fields: IP_FIELDS },
  vlan: { label: "VLAN", fields: [
    { k: "link", label: "Parent (a managed interface, bond or bridge from the list)", t: "text" },
    { k: "id", label: "VLAN ID (1-4094)", t: "int" }, ...IP_FIELDS] },
  bridge: { label: "Bridge", fields: [
    { k: "members", label: "Member interfaces (comma-separated; may be empty)", t: "list" },
    { k: "stp", label: "Spanning tree (STP)", t: "bool" },
    { k: "mac", label: "MAC address (optional; copy your NIC's to keep its DHCP address)", t: "text" },
    ...IP_FIELDS] },
  bond: { label: "Bond", fields: [
    { k: "members", label: "Member interfaces (comma-separated)", t: "list" },
    { k: "mode", label: "Mode", t: "select", options: ["active-backup", "802.3ad", "balance-rr",
      "balance-xor", "broadcast", "balance-tlb", "balance-alb"] },
    { k: "miimon", label: "Link check interval (ms)", t: "int" },
    { k: "mac", label: "MAC address (optional)", t: "text" }, ...IP_FIELDS] },
};

function defaultsFor(kind) {
  const base = { kind, dhcp4: false, dhcp6: false, addresses: [], gateway4: "", gateway6: "",
                 dns: [], mtu: null, routes: [] };
  if (kind === "vlan") return { ...base, link: "", id: null };
  if (kind === "bridge") return { ...base, members: [], stp: false, mac: "" };
  if (kind === "bond") return { ...base, members: [], mode: "active-backup", miimon: 100, mac: "" };
  return base;
}

function runtimeDefaults(name) {
  const o = defaultsFor("ethernet"), i = runtime[name];
  if (!i) return o;
  const v4 = i.addresses.filter((a) => a.family === "inet");
  const v6 = i.addresses.filter((a) => a.family === "inet6" && !a.addr.toLowerCase().startsWith("fe80"));
  o.dhcp4 = v4.some((a) => a.dynamic);
  o.addresses = [...v4, ...v6].filter((a) => !a.dynamic).map((a) => a.addr);
  if (!o.dhcp4) {
    const gw = rtRoutes.find((r) => r.dst === "default" && r.dev === name && r.gateway && !r.gateway.includes(":"));
    if (gw) o.gateway4 = gw.gateway;
    o.dns = rtDns.servers.filter((s) => !s.includes(":"));
  }
  return o;
}

function summary(it) {
  const parts = [];
  if (it.kind === "vlan") parts.push(`VLAN ${it.id} on ${it.link}`);
  if (it.kind === "bridge") parts.push("members: " + ((it.members || []).join(", ") || "none") + (it.stp ? ", STP" : ""));
  if (it.kind === "bond") parts.push(`${it.mode}, members: ` + ((it.members || []).join(", ") || "none"));
  if (it.dhcp4) parts.push("DHCP");
  if ((it.addresses || []).length) parts.push(it.addresses.join(", "));
  if (it.gateway4) parts.push("gw " + it.gateway4);
  if ((it.dns || []).length) parts.push("DNS " + it.dns.join(", "));
  return parts.join(" | ");
}

const isDirty = () => JSON.stringify(cfg) !== JSON.stringify(applied);

function renderItems() {
  const body = $("items"); body.replaceChildren();
  const names = Object.keys(cfg.items).sort();
  if (!names.length) {
    const tr = document.createElement("tr");
    td(tr, "Nothing is managed by the panel yet. Existing settings stay as they are.", "muted");
    body.appendChild(tr);
  }
  for (const n of names) {
    const it = cfg.items[n], tr = document.createElement("tr");
    td(tr, n); td(tr, KINDS[it.kind].label); td(tr, summary(it));
    const act = document.createElement("td");
    act.appendChild(btn("Edit", () => openForm(it.kind, n)));
    act.appendChild(btn("Remove", () => { delete cfg.items[n]; renderItems(); }));
    tr.appendChild(act); body.appendChild(tr);
  }
  $("dirty").textContent = isDirty() ? "Unapplied changes" : "";
}

function collect(fields, inputs, kind) {
  const o = { kind };
  for (const f of fields) {
    const el = inputs[f.k];
    if (f.t === "bool") o[f.k] = el.checked;
    else if (f.t === "list") o[f.k] = el.value.split(/[,\s]+/).filter(Boolean);
    else if (f.t === "lines") o[f.k] = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
    else if (f.t === "int") { const v = el.value.trim(); o[f.k] = v === "" ? null : Number(v); }
    else o[f.k] = el.value.trim();
  }
  return o;
}

function openForm(kind, name) {
  const editing = name !== null, def = KINDS[kind];
  const item = editing ? cfg.items[name] : defaultsFor(kind);
  const box = $("form"); box.replaceChildren(); box.hidden = false;
  const title = document.createElement("h3");
  title.textContent = (editing ? "Edit " : "Add ") + def.label.toLowerCase();
  box.appendChild(title);
  const row = (text, el) => {
    const l = document.createElement("label");
    l.append(text, document.createElement("br"), el); box.appendChild(l);
  };

  let nameEl;
  if (kind === "ethernet" && !editing) {
    nameEl = document.createElement("select");
    const taken = new Set(Object.values(cfg.items).flatMap((i) => i.members || []));
    for (const n of physical.filter((p) => !cfg.items[p] && !taken.has(p))) {
      const o = document.createElement("option"); o.value = n; o.textContent = n; nameEl.appendChild(o);
    }
  } else {
    nameEl = document.createElement("input"); nameEl.type = "text";
    nameEl.value = editing ? name : ""; nameEl.readOnly = editing;
    nameEl.placeholder = { vlan: "vlan10", bridge: "br0", bond: "bond0", ethernet: "" }[kind];
  }
  row(kind === "ethernet" ? "Interface" : "Name", nameEl);

  const inputs = {};
  for (const f of def.fields) {
    let el;
    if (f.t === "bool") {
      el = document.createElement("input"); el.type = "checkbox";
      const l = document.createElement("label"); l.append(el, " " + f.label); box.appendChild(l);
    } else {
      if (f.t === "lines") { el = document.createElement("textarea"); el.rows = 3; }
      else if (f.t === "select") {
        el = document.createElement("select");
        for (const o of f.options) { const op = document.createElement("option"); op.value = o; op.textContent = o; el.appendChild(op); }
      } else { el = document.createElement("input"); el.type = "text"; }
      if (f.ph) el.placeholder = f.ph;
      row(f.label, el);
    }
    inputs[f.k] = el;
  }
  const fillFrom = (o) => {
    for (const f of def.fields) {
      const el = inputs[f.k], v = o[f.k];
      if (f.t === "bool") el.checked = !!v;
      else if (f.t === "list") el.value = (v || []).join(", ");
      else if (f.t === "lines") el.value = (v || []).join("\n");
      else el.value = v === null || v === undefined ? "" : v;
    }
  };
  if (kind === "ethernet" && !editing) {
    nameEl.onchange = () => fillFrom(runtimeDefaults(nameEl.value));
    fillFrom(nameEl.value ? runtimeDefaults(nameEl.value) : item);
  } else fillFrom(item);

  const bar = document.createElement("p");
  const save = btn("Save to draft", () => {
    const n = (nameEl.value || "").trim();
    if (!n) { alert("Choose or enter a name"); return; }
    if (!editing && cfg.items[n]) { alert("That name is already used in the list"); return; }
    cfg.items[n] = collect(def.fields, inputs, kind);
    box.hidden = true; renderItems();
  });
  bar.append(save, btn("Cancel", () => { box.hidden = true; }));
  box.appendChild(bar);
}

$("addeth").onclick = () => openForm("ethernet", null);
$("addvlan").onclick = () => openForm("vlan", null);
$("addbridge").onclick = () => openForm("bridge", null);
$("addbond").onclick = () => openForm("bond", null);
$("discard").onclick = () => { cfg = clone(applied); $("form").hidden = true; renderItems(); };

/* ---------------- apply / keep / revert ---------------- */
let pendLeft = null;
function paintPending() {
  $("pendtext").textContent = pendLeft === null ? ""
    : ` Reverting automatically in ${pendLeft} s unless you keep it. If this page still works and the network is fine, press Keep.`;
}
function showPending(p) {
  $("pending").hidden = !p;
  pendLeft = p ? p.seconds_left : null;
  paintPending();
}
setInterval(() => { if (pendLeft !== null && pendLeft > 0) { pendLeft--; paintPending(); } }, 1000);

async function loadConfig(forceDraft) {
  let r;
  try { r = await api("/api/network/config"); } catch (e) { return; }
  if (!r.ok) { $("cfgerr").textContent = "Configuration unavailable: " + await errText(r); return; }
  $("cfgerr").textContent = "";
  const d = await r.json();
  physical = d.physical;
  const wasDirty = isDirty();
  applied = d.state;
  if (forceDraft || !wasDirty) cfg = clone(applied);
  showPending(d.pending);
  renderItems();
}

$("apply").onclick = async () => {
  const timeout = Math.max(30, Math.min(600, Number($("timeout").value) || 90));
  if (!confirm(`Apply these changes?\n\nIf you can't reach this page afterwards, or don't press "Keep changes" within ${timeout} seconds, the previous settings are restored automatically.\n\nIf you changed the address this server is reached on, open the panel at the new address.`)) return;
  let r;
  try {
    r = await api("/api/network/apply", { method: "POST", headers: JSONH, body: JSON.stringify({ state: cfg, timeout }) });
  } catch (e) {
    $("pending").hidden = false;
    $("pendtext").textContent = " The request was interrupted, so the network probably changed. If the panel comes back (at a new address if you changed it), press Keep within " + timeout + " seconds, otherwise the old settings return by themselves.";
    pendLeft = null; return;
  }
  if (!r.ok) { alert(await errText(r)); return; }
  $("form").hidden = true;
  await loadConfig(true);
};
$("keep").onclick = async () => {
  const r = await api("/api/network/confirm", { method: "POST" });
  if (!r.ok) alert(await errText(r));
  loadConfig(true);
};
$("revert").onclick = async () => {
  if (!confirm("Revert to the previous settings now?")) return;
  const r = await api("/api/network/revert", { method: "POST" });
  if (!r.ok) alert(await errText(r));
  loadConfig(false);
};

loadOverview(); loadConfig(true); loadConns();
setInterval(loadOverview, 2000);
setInterval(loadConns, 5000);
setInterval(() => loadConfig(false), 3000);
