const $ = (id) => document.getElementById(id);
let current = "";

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
async function post(path, body) {
  $("err").textContent = ""; $("msg").textContent = "";
  const r = await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { $("err").textContent = await errText(r); return null; }
  return r.json();
}

function draw(d) {
  const tb = $("rows"); tb.replaceChildren();
  $("other").textContent = d.other_lines ? d.other_lines + " other line(s) in the file are not plain keys (for example keys with options) and are left untouched. They are not shown here." : "";
  if (!d.keys.length) { const tr = el("tr"), td = el("td", "No keys. This account can only sign in with a password.", "muted"); td.colSpan = 4; tr.append(td); tb.append(tr); }
  for (const k of d.keys) {
    const tr = el("tr");
    tr.append(el("td", k.type), el("td", k.fingerprint, "fp"), el("td", k.comment));
    const td = el("td"), b = el("button", "Remove");
    b.onclick = async () => {
      if (!confirm("Remove this key from " + current + "? Whoever uses it can no longer sign in with it.")) return;
      b.disabled = true;
      if (await post("/api/authkeys/remove", { user: current, fingerprint: k.fingerprint })) $("msg").textContent = "Key removed.";
      load();
    };
    td.append(b); tr.append(td); tb.append(tr);
  }
}

async function load() {
  if (!current) return;
  const r = await api("/api/authkeys?name=" + encodeURIComponent(current));
  if (!r.ok) { $("err").textContent = await errText(r); $("rows").replaceChildren(); return; }
  draw(await r.json());
}

async function init() {
  const r = await api("/api/authkeys/users");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  const users = (await r.json()).users, sel = $("user");
  for (const u of users) { const o = el("option", u); o.value = u; sel.append(o); }
  if (!users.length) { $("msg").textContent = "No accounts that can sign in over SSH were found. Create one on the Users page."; $("addform").hidden = true; return; }
  const want = new URLSearchParams(location.search).get("user");
  if (want && users.includes(want)) sel.value = want;
  current = sel.value; load();
}
$("user").onchange = () => { current = $("user").value; $("msg").textContent = ""; load(); };
$("addform").onsubmit = async (e) => {
  e.preventDefault();
  const res = await post("/api/authkeys/add", { user: current, key: $("key").value });
  if (res) { $("key").value = ""; $("msg").textContent = "Key added (" + res.fingerprint + ")."; }
  load();
};
init();
