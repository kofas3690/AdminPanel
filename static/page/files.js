const $ = (id) => document.getElementById(id);
const JSON_H = { "Content-Type": "application/json" };
const S = { user: "", home: "/", path: "/", entries: [], view: [], sel: new Set(), anchor: -1,
            hist: [], hpos: -1, sort: { k: "name", asc: true }, hidden: false, clip: null,
            free: null, accounts: [], editing: null };

/* ---------------- helpers ---------------- */
const join = (a, b) => (a.endsWith("/") ? a : a + "/") + b;
const parentOf = (p) => { const i = p.lastIndexOf("/"); return i <= 0 ? "/" : p.slice(0, i); };
const Q = (o) => new URLSearchParams(o).toString();
const U = (op, extra) => "/api/fs/" + op + "?" + Q({ user: S.user, ...(extra || {}) });

async function A(url, opts) {
  const r = await fetch(url, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
async function ok(r) {
  if (r.ok) return true;
  const t = await errText(r);
  if (t.startsWith("Not connected")) { showLogin(t); return false; }
  alert(t);
  return false;
}
const post = (op, body) => A(U(op), { method: "POST", headers: JSON_H, body: JSON.stringify(body) });

function fmtSize(n) {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(1) : Math.round(n)) + " " + u[i];
}
const fmtDate = (s) => (s ? new Date(s * 1000).toLocaleString() : "");
const status = (t) => { $("status").textContent = t; };

/* ---------------- icons (fixed artwork, not server data) ---------------- */
const SVG = {
  folder: '<svg viewBox="0 0 24 24"><path fill="#f4c145" d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path fill="#9aa4b1" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#c8ced6" d="M14 2v5h5z"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path fill="#73bcf7" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" d="M7 11h10v1.5H7zm0 3h10v1.5H7zm0 3h6v1.5H7z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><path fill="#7fd47a" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><circle cx="10" cy="12" r="1.6" fill="#fff"/><path fill="#fff" d="M6 19l4-4 2.5 2.5L15 15l3 4z"/></svg>',
  archive: '<svg viewBox="0 0 24 24"><path fill="#f08c4f" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" d="M10 4h2v2h-2zm0 3h2v2h-2zm0 3h2v2h-2zm0 3h2v4h-2z"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path fill="#b39ddb" d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path fill="#fff" d="M8 16l6-6m0 0h-4m4 0v4" stroke="#fff" stroke-width="1.6" fill="none"/></svg>',
};
function icon(kind) {
  const s = document.createElement("span");
  s.className = "ico";
  s.innerHTML = SVG[kind] || SVG.file;
  return s;
}
const EXT = (n) => { const i = n.lastIndexOf("."); return i > 0 ? n.slice(i + 1).toLowerCase() : ""; };
const TEXT_EXT = new Set("txt md log conf cfg ini json yaml yml xml html htm css js mjs ts py sh bash zsh service timer socket target path toml csv tsv sql env rc list sources gitignore php rb go rs c h cpp hpp java lua pl properties".split(" "));
const IMG_EXT = new Set("png jpg jpeg gif webp bmp svg ico".split(" "));
const ARC_EXT = new Set("zip tar gz tgz xz bz2 7z rar zst deb".split(" "));
const isDirEntry = (e) => e.type === "dir" || e.link_dir;
function kindOf(e) {
  if (isDirEntry(e)) return "folder";
  if (e.type === "link") return "link";
  const x = EXT(e.name);
  if (IMG_EXT.has(x)) return "image";
  if (ARC_EXT.has(x)) return "archive";
  if (TEXT_EXT.has(x)) return "text";
  return "file";
}
function kindLabel(e) {
  if (isDirEntry(e)) return e.type === "link" ? "Link to folder" : "Folder";
  if (e.type === "link") return "Link";
  const x = EXT(e.name);
  return x ? x.toUpperCase() + " file" : "File";
}

/* ---------------- sign-in and accounts ---------------- */
function showLogin(msg, canCancel) {
  $("explorer").hidden = S.accounts.length === 0 || !canCancel ? true : $("explorer").hidden;
  $("loginbox").hidden = false;
  $("lmsg").textContent = msg || "";
  $("lcancel").hidden = !canCancel;
  try { if (!$("luser").value) $("luser").value = localStorage.getItem("fsUser") || ""; } catch (e) {}
  $("lpass").value = "";
  ($("luser").value ? $("lpass") : $("luser")).focus();
}

/* After three wrong passwords the server makes you wait. The Connect button counts the seconds down. */
let waitTimer = null, waitLeft = 0;
function startWait(seconds) {
  const btn = document.querySelector("#lform button.primary");
  const label = btn.dataset.label || btn.textContent;
  btn.dataset.label = label;
  clearInterval(waitTimer);
  waitLeft = seconds;
  const tick = () => {
    if (waitLeft <= 0) {
      clearInterval(waitTimer);
      btn.disabled = false; btn.textContent = label; $("lmsg").textContent = "";
      return;
    }
    btn.disabled = true; btn.textContent = "Wait " + waitLeft + " s";
    waitLeft--;
  };
  tick();
  waitTimer = setInterval(tick, 1000);
}
/* Shows why a connect attempt failed (the server's own words, including how many tries are left). */
async function showConnectError(r) {
  $("lmsg").textContent = await errText(r);
  const wait = parseInt(r.headers.get("Retry-After") || "0", 10);
  if (wait > 0) startWait(wait);
}

$("lform").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (waitLeft > 0) return;
  const user = $("luser").value.trim(), password = $("lpass").value;
  $("lmsg").textContent = "Connecting\u2026";
  const r = await A("/api/fs/connect", { method: "POST", headers: JSON_H, body: JSON.stringify({ user, password }) });
  $("lpass").value = "";
  if (!r.ok) { await showConnectError(r); return; }
  const d = await r.json();
  $("lmsg").textContent = "";
  await enter(d.user, d.home);
});
$("lcancel").onclick = () => { $("loginbox").hidden = true; $("explorer").hidden = false; };
$("addacct").onclick = () => showLogin("", true);

async function loadAccounts() {
  const r = await A("/api/fs/accounts");
  S.accounts = r.ok ? await r.json() : [];
  const sel = $("acct");
  sel.replaceChildren();
  for (const a of S.accounts) {
    const o = document.createElement("option");
    o.value = a.user; o.textContent = a.user;
    sel.appendChild(o);
  }
  sel.value = S.user;
}

async function enter(user, home) {
  S.user = user; S.home = home; S.hist = []; S.hpos = -1; S.clip = null;
  try { localStorage.setItem("fsUser", user); } catch (e) {}
  $("loginbox").hidden = true;
  $("explorer").hidden = false;
  await loadAccounts();
  buildTree();
  await go(home);
}

$("acct").onchange = () => {
  const a = S.accounts.find((x) => x.user === $("acct").value);
  if (a) enter(a.user, a.home);
};
$("disc").onclick = async () => {
  await A(U("disconnect"), { method: "POST" });
  await loadAccounts();
  if (S.accounts.length) enter(S.accounts[0].user, S.accounts[0].home);
  else { $("explorer").hidden = true; S.user = ""; showLogin(""); }
};

/* ---------------- navigation ---------------- */
async function go(path, push = true) {
  const r = await A(U("list", { path }));
  if (!(await ok(r))) return false;
  const d = await r.json();
  S.path = d.path; S.entries = d.items; S.free = d.free; S.sel.clear(); S.anchor = -1;
  if (push) { S.hist = S.hist.slice(0, S.hpos + 1); S.hist.push(S.path); S.hpos = S.hist.length - 1; }
  $("filter").value = "";
  renderAddr(); render(); markTree();
  if (d.truncated) status("Only the first 5000 entries are shown.");
  return true;
}
const refresh = () => go(S.path, false);
const up = () => { if (S.path !== "/") go(parentOf(S.path)); };
const back = () => { if (S.hpos > 0) { S.hpos--; go(S.hist[S.hpos], false); } };
const fwd = () => { if (S.hpos < S.hist.length - 1) { S.hpos++; go(S.hist[S.hpos], false); } };
$("back").onclick = back; $("fwd").onclick = fwd; $("up").onclick = up; $("refresh").onclick = refresh;

function renderAddr() {
  const bar = $("addr");
  bar.replaceChildren();
  const crumb = (text, path) => {
    const a = document.createElement("a");
    a.className = "crumb"; a.textContent = text;
    a.onclick = (e) => { e.stopPropagation(); go(path); };
    bar.appendChild(a);
  };
  crumb("/", "/");
  let acc = "";
  for (const part of S.path.split("/").filter(Boolean)) {
    acc += "/" + part;
    const sep = document.createElement("span");
    sep.className = "sep"; sep.textContent = "\u203a";
    bar.appendChild(sep);
    crumb(part, acc);
  }
}
$("addr").addEventListener("click", () => {
  const bar = $("addr");
  const inp = document.createElement("input");
  inp.value = S.path;
  bar.replaceChildren(inp);
  inp.focus(); inp.select();
  inp.onkeydown = async (e) => {
    if (e.key === "Enter") { const p = inp.value.trim(); if (!(await go(p.startsWith("/") ? p : "/" + p))) renderAddr(); }
    else if (e.key === "Escape") renderAddr();
  };
  inp.onblur = () => renderAddr();
});

/* ---------------- folder tree ---------------- */
function makeNode(path, label) {
  const wrap = document.createElement("div");
  wrap.className = "node";
  const row = document.createElement("div");
  row.className = "row"; row.dataset.path = path;
  const tg = document.createElement("span");
  tg.className = "tg"; tg.textContent = "\u25b8";
  row.append(tg, icon("folder"), document.createTextNode(label));
  const kids = document.createElement("div");
  kids.className = "kids"; kids.hidden = true;
  let loaded = false;
  async function expand() {
    if (!loaded) {
      loaded = true; tg.textContent = "\u2026";
      const r = await A(U("list", { path, dirs_only: "1" }));
      if (r.ok) {
        const items = (await r.json()).items.filter((x) => !x.name.startsWith(".")).sort((a, b) => a.name.localeCompare(b.name));
        for (const x of items) kids.appendChild(makeNode(join(path, x.name), x.name));
      } else { tg.textContent = "\u00b7"; return; }
    }
    kids.hidden = false;
    tg.textContent = kids.childElementCount ? "\u25be" : "";
  }
  tg.onclick = (e) => {
    e.stopPropagation();
    if (kids.hidden) expand(); else { kids.hidden = true; tg.textContent = "\u25b8"; }
  };
  row.onclick = () => go(path);
  wrap.append(row, kids);
  wrap.expand = expand;
  return wrap;
}
function buildTree() {
  const t = $("tree");
  t.replaceChildren();
  const lab = (text) => { const d = document.createElement("div"); d.className = "label"; d.textContent = text; t.appendChild(d); };
  lab("Places");
  for (const [name, path] of [["Home", S.home], ["Computer (/)", "/"], ["etc", "/etc"], ["var/log", "/var/log"],
                              ["srv", "/srv"], ["home", "/home"], ["tmp", "/tmp"]]) {
    const row = document.createElement("div");
    row.className = "node";
    const r = document.createElement("div");
    r.className = "row";
    r.append(icon("folder"), document.createTextNode(name));
    r.onclick = () => go(path);
    row.appendChild(r);
    t.appendChild(row);
  }
  lab("Folders");
  const root = makeNode("/", "/");
  t.appendChild(root);
  root.expand();
}
function markTree() {
  document.querySelectorAll("#tree .row").forEach((r) => r.classList.toggle("on", r.dataset.path === S.path));
}

/* ---------------- list ---------------- */
function render() {
  const q = $("filter").value.trim().toLowerCase();
  const rows = S.entries.filter((e) => (S.hidden || !e.name.startsWith(".")) && (!q || e.name.toLowerCase().includes(q)));
  const k = S.sort.k, dir = S.sort.asc ? 1 : -1;
  rows.sort((a, b) => {
    if (isDirEntry(a) !== isDirEntry(b)) return isDirEntry(a) ? -1 : 1;
    let r;
    if (k === "size") r = a.size - b.size;
    else if (k === "mtime") r = a.mtime - b.mtime;
    else if (k === "type") r = kindLabel(a).localeCompare(kindLabel(b)) || a.name.localeCompare(b.name);
    else r = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    return r * dir;
  });
  S.view = rows;
  const body = $("rows");
  const frag = document.createDocumentFragment();
  rows.forEach((e, i) => {
    const tr = document.createElement("tr");
    tr.dataset.i = i;
    const nameTd = document.createElement("td");
    nameTd.appendChild(icon(kindOf(e)));
    nameTd.append(e.name + (e.type === "link" && e.target ? "  \u2192  " + e.target : ""));
    tr.appendChild(nameTd);
    for (const t of [fmtDate(e.mtime), kindLabel(e), isDirEntry(e) ? "" : fmtSize(e.size), e.mode, e.owner]) {
      const td = document.createElement("td");
      td.textContent = t;
      tr.appendChild(td);
    }
    frag.appendChild(tr);
  });
  body.replaceChildren(frag);
  $("empty").hidden = rows.length > 0;
  $("empty").textContent = S.entries.length ? "No items match the filter" : "This folder is empty";
  paintSel();
}
document.querySelectorAll("#list th[data-k]").forEach((th) => {
  th.onclick = () => {
    const k = th.dataset.k;
    S.sort = { k, asc: S.sort.k === k ? !S.sort.asc : true };
    render();
  };
});
$("filter").oninput = render;
$("chkhidden").onchange = () => { S.hidden = $("chkhidden").checked; render(); };

const selected = () => S.view.filter((e) => S.sel.has(e.name));
function paintSel() {
  const clipPaths = S.clip && S.clip.user === S.user && S.clip.mode === "cut" ? new Set(S.clip.paths) : new Set();
  document.querySelectorAll("#rows tr").forEach((tr) => {
    const e = S.view[+tr.dataset.i];
    tr.classList.toggle("sel", S.sel.has(e.name));
    tr.classList.toggle("cut", clipPaths.has(join(S.path, e.name)));
  });
  const sel = selected(), n = sel.length;
  const bytes = sel.filter((e) => !isDirEntry(e)).reduce((a, e) => a + e.size, 0);
  status(`${S.view.length} item${S.view.length === 1 ? "" : "s"}` +
         (n ? ` \u00b7 ${n} selected${bytes ? " (" + fmtSize(bytes) + ")" : ""}` : "") +
         (S.free !== null ? ` \u00b7 ${fmtSize(S.free)} free` : ""));
  const writable = true;
  $("bdownload").disabled = !(n === 1 && !isDirEntry(sel[0]) && sel[0].type === "file");
  $("bcut").disabled = !n; $("bcopy").disabled = !n;
  $("bpaste").disabled = !(S.clip && S.clip.user === S.user);
  $("brename").disabled = n !== 1; $("bdelete").disabled = !n; $("bprops").disabled = n > 1;
}

function clickRow(e, i) {
  const name = S.view[i].name;
  if (e.shiftKey && S.anchor >= 0) {
    const [a, b] = [Math.min(S.anchor, i), Math.max(S.anchor, i)];
    S.sel = new Set(S.view.slice(a, b + 1).map((x) => x.name));
  } else if (e.ctrlKey || e.metaKey) {
    if (S.sel.has(name)) S.sel.delete(name); else S.sel.add(name);
    S.anchor = i;
  } else { S.sel = new Set([name]); S.anchor = i; }
  paintSel();
}
$("rows").addEventListener("click", (e) => { const tr = e.target.closest("tr"); if (tr) clickRow(e, +tr.dataset.i); });
$("rows").addEventListener("dblclick", (e) => { const tr = e.target.closest("tr"); if (tr) openEntry(S.view[+tr.dataset.i]); });
$("main").addEventListener("click", (e) => { if (!e.target.closest("tr")) { S.sel.clear(); paintSel(); } });

function openEntry(e) {
  if (isDirEntry(e)) go(join(S.path, e.name));
  else if (e.type === "file") {
    if (TEXT_EXT.has(EXT(e.name)) || (!IMG_EXT.has(EXT(e.name)) && !ARC_EXT.has(EXT(e.name)) && e.size <= 262144)) openEditor(e.name);
    else download(e.name);
  }
}

/* ---------------- actions ---------------- */
function download(name) {
  const a = document.createElement("a");
  a.href = U("download", { path: join(S.path, name) });
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
async function newItem(kind) {
  const n = prompt(kind === "folder" ? "New folder name:" : "New file name:");
  if (!n) return;
  const r = await post(kind === "folder" ? "mkdir" : "newfile", { path: join(S.path, n) });
  if (await ok(r)) await refresh();
}
async function renameSel() {
  const [e] = selected();
  if (!e) return;
  const nn = prompt(`Rename "${e.name}" to:`, e.name);
  if (!nn || nn === e.name) return;
  const r = await post("rename", { path: join(S.path, e.name), new_name: nn });
  if (await ok(r)) await refresh();
}
async function deleteSel() {
  const sel = selected();
  if (!sel.length) return;
  const label = sel.length === 1 ? `"${sel[0].name}"` : `${sel.length} items`;
  if (sel.some((e) => e.type === "dir")) {
    const t = prompt(`Permanently delete ${label}, including everything inside folders?\nThere is no recycle bin. Type DELETE to confirm:`);
    if (t !== "DELETE") return;
  } else if (!confirm(`Permanently delete ${label}? There is no recycle bin.`)) return;
  const r = await post("delete", { paths: sel.map((e) => join(S.path, e.name)) });
  await ok(r);
  await refresh();
}
function clipSet(mode) {
  const sel = selected();
  if (!sel.length) return;
  S.clip = { user: S.user, mode, paths: sel.map((e) => join(S.path, e.name)) };
  paintSel();
  status(`${sel.length} item${sel.length === 1 ? "" : "s"} ${mode === "cut" ? "cut" : "copied"}`);
}
async function paste() {
  if (!S.clip || S.clip.user !== S.user) return;
  const op = S.clip.mode === "cut" ? "move" : "copy";
  status(op === "move" ? "Moving\u2026" : "Copying\u2026");
  const r = await post(op, { paths: S.clip.paths, dest: S.path, auto_rename: op === "copy" });
  if ((await ok(r)) && op === "move") S.clip = null;
  await refresh();
}

/* upload */
function uploadOne(file, overwrite) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", U("upload", { path: join(S.path, file.name), overwrite: overwrite ? "true" : "false" }));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) status(`Uploading ${file.name}: ${Math.round(100 * e.loaded / e.total)}%`);
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => resolve({ status: 0, body: "" });
    xhr.send(file);
  });
}
function detailOf(res) {
  try { const j = JSON.parse(res.body); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  if (res.status === 413) return "file too large (check the nginx upload limit)";
  if (res.status === 0) return "network error (a folder can't be uploaded)";
  return "HTTP " + res.status;
}
async function uploadFiles(files) {
  for (const f of files) {
    let res = await uploadOne(f, false);
    if (res.status === 409 && /already exists/.test(detailOf(res))) {
      if (!confirm(`"${f.name}" already exists. Replace it?`)) continue;
      res = await uploadOne(f, true);
    }
    if (res.status === 401) { location.href = "/login.html"; return; }
    if (res.status === 409 && detailOf(res).startsWith("Not connected")) { showLogin(detailOf(res)); return; }
    if (res.status !== 200) alert(`Upload of "${f.name}" failed: ` + detailOf(res));
  }
  await refresh();
}
$("bupload").onclick = () => $("picker").click();
$("picker").onchange = async () => { const f = Array.from($("picker").files); $("picker").value = ""; await uploadFiles(f); };
const main = $("main");
main.addEventListener("dragover", (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); main.classList.add("drag"); } });
main.addEventListener("dragleave", () => main.classList.remove("drag"));
main.addEventListener("drop", (e) => {
  main.classList.remove("drag");
  if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); uploadFiles(Array.from(e.dataTransfer.files)); }
});

/* editor */
async function openEditor(name) {
  const path = join(S.path, name);
  const r = await A(U("read", { path }));
  if (!r.ok) {
    const t = await errText(r);
    if (t.startsWith("Not connected")) { showLogin(t); return; }
    if (r.status === 415 || r.status === 413) { if (confirm(t + "\n\nDownload it instead?")) download(name); return; }
    alert(t); return;
  }
  const d = await r.json();
  S.editing = { path, version: d.version };
  $("etitle").textContent = path;
  $("etext").value = d.text;
  $("emsg").textContent = "";
  $("editor").showModal();
  $("etext").focus();
}
async function saveEditor() {
  const e = S.editing;
  if (!e) return;
  const r = await A(U("write"), { method: "PUT", headers: JSON_H,
    body: JSON.stringify({ path: e.path, text: $("etext").value, version: e.version }) });
  if (!r.ok) { $("emsg").textContent = await errText(r); return; }
  e.version = (await r.json()).version;
  $("emsg").textContent = "Saved " + new Date().toLocaleTimeString();
  refresh();
}
$("esave").onclick = saveEditor;
$("eclose").onclick = () => $("editor").close();
$("etext").addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); saveEditor(); }
});

/* properties */
async function props(name) {
  const path = name ? join(S.path, name) : S.path;
  const r = await A(U("info", { path }));
  if (!(await ok(r))) return;
  const d = await r.json();
  $("ptitle").textContent = d.name;
  const body = $("pbody");
  body.replaceChildren();
  const row = (k, v) => {
    const tr = document.createElement("tr");
    const a = document.createElement("td"); a.textContent = k;
    const b = document.createElement("td");
    if (v instanceof Node) b.appendChild(v); else b.textContent = v;
    tr.append(a, b); body.appendChild(tr);
    return b;
  };
  row("Location", d.path);
  row("Type", d.type === "dir" ? "Folder" : d.type === "link" ? "Link" : d.type === "file" ? "File" : "Special file");
  if (d.target) row("Points to", d.target);
  const sizeCell = row("Size", d.type === "dir" ? "" : fmtSize(d.size) + "  (" + d.size.toLocaleString() + " bytes)");
  if (d.type === "dir") {
    const b = document.createElement("button");
    b.textContent = "Calculate size";
    b.onclick = async () => {
      b.disabled = true; b.textContent = "Calculating\u2026";
      const rr = await A(U("info", { path, size: "true" }));
      if (rr.ok) { const dd = await rr.json(); sizeCell.textContent = dd.dir_size !== undefined ? fmtSize(dd.dir_size) : "unknown"; }
    };
    sizeCell.appendChild(b);
  }
  row("Modified", fmtDate(d.mtime));
  row("Owner", d.owner + (d.group ? " : " + d.group : ""));
  const permCell = row("Permissions", "");
  const inp = document.createElement("input");
  inp.value = d.mode_octal; inp.size = 5; inp.maxLength = 4;
  const apply = document.createElement("button");
  apply.textContent = "Apply";
  apply.onclick = async () => {
    if (!/^[0-7]{3,4}$/.test(inp.value)) { alert("Use octal digits, for example 644 or 755"); return; }
    const rr = await post("chmod", { path, mode: inp.value });
    if (await ok(rr)) { apply.textContent = "Applied"; refresh(); }
  };
  permCell.append(inp, " ", document.createTextNode(d.mode + "  "), apply);
  $("pdlg").showModal();
}
$("pclose").onclick = () => $("pdlg").close();

/* toolbar */
$("bfolder").onclick = () => newItem("folder");
$("bfile").onclick = () => newItem("file");
$("bdownload").onclick = () => { const [e] = selected(); if (e) download(e.name); };
$("bcut").onclick = () => clipSet("cut");
$("bcopy").onclick = () => clipSet("copy");
$("bpaste").onclick = paste;
$("brename").onclick = renameSel;
$("bdelete").onclick = deleteSel;
$("bprops").onclick = () => { const [e] = selected(); props(e ? e.name : null); };

/* context menu */
function hideMenu() { $("ctx").hidden = true; }
function showMenu(x, y, items) {
  const m = $("ctx");
  m.replaceChildren();
  for (const it of items) {
    if (it === "-") { m.appendChild(document.createElement("hr")); continue; }
    const d = document.createElement("div");
    d.textContent = it[0];
    d.onclick = () => { hideMenu(); it[1](); };
    m.appendChild(d);
  }
  m.hidden = false;
  m.style.left = Math.min(x, innerWidth - 220) + "px";
  m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 8)) + "px";
}
$("main").addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const tr = e.target.closest("tr");
  if (tr) {
    const ent = S.view[+tr.dataset.i];
    if (!S.sel.has(ent.name)) { S.sel = new Set([ent.name]); S.anchor = +tr.dataset.i; paintSel(); }
    const sel = selected(), one = sel.length === 1;
    const items = [];
    if (one) items.push(["Open", () => openEntry(sel[0])]);
    if (one && sel[0].type === "file") items.push(["Download", () => download(sel[0].name)]);
    items.push("-", ["Cut", () => clipSet("cut")], ["Copy", () => clipSet("copy")]);
    if (S.clip && S.clip.user === S.user && one && isDirEntry(sel[0])) items.push(["Paste into folder", async () => { await go(join(S.path, sel[0].name)); paste(); }]);
    items.push("-");
    if (one) items.push(["Rename", renameSel]);
    items.push(["Delete", deleteSel], "-");
    if (one) items.push(["Properties", () => props(sel[0].name)]);
    showMenu(e.clientX, e.clientY, items);
  } else {
    S.sel.clear(); paintSel();
    const items = [["New folder", () => newItem("folder")], ["New file", () => newItem("file")], ["Upload\u2026", () => $("picker").click()], "-"];
    if (S.clip && S.clip.user === S.user) items.push(["Paste", paste]);
    items.push(["Refresh", refresh], "-", ["Properties", () => props(null)]);
    showMenu(e.clientX, e.clientY, items);
  }
});
document.addEventListener("click", hideMenu);
window.addEventListener("blur", hideMenu);

/* keyboard */
document.addEventListener("keydown", (e) => {
  if ($("explorer").hidden || e.target.closest("input, textarea, select, dialog")) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.key === "Delete") { e.preventDefault(); deleteSel(); }
  else if (e.key === "F2") { e.preventDefault(); renameSel(); }
  else if (e.key === "Enter" && S.sel.size === 1) { const [x] = selected(); if (x) openEntry(x); }
  else if (mod && k === "a") { e.preventDefault(); S.sel = new Set(S.view.map((x) => x.name)); paintSel(); }
  else if (mod && k === "c") { e.preventDefault(); clipSet("copy"); }
  else if (mod && k === "x") { e.preventDefault(); clipSet("cut"); }
  else if (mod && k === "v") { e.preventDefault(); paste(); }
  else if (e.key === "Backspace" || (e.altKey && e.key === "ArrowUp")) { e.preventDefault(); up(); }
  else if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); back(); }
  else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); fwd(); }
  else if (e.key === "Escape") { S.sel.clear(); paintSel(); hideMenu(); }
});

/* start */
(async () => {
  const r = await A("/api/fs/accounts");
  S.accounts = r.ok ? await r.json() : [];
  let first = S.accounts[0];
  try { const last = localStorage.getItem("fsUser"); const m = S.accounts.find((a) => a.user === last); if (m) first = m; } catch (e) {}
  if (first) enter(first.user, first.home);
  else showLogin("");
})();
