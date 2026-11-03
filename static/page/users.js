async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}

async function errText(r) {
  try {
    const j = await r.json();
    if (typeof j.detail === "string") return j.detail;
  } catch (e) {}
  return "Invalid input: user names use lowercase letters, digits, _ and - (max 32); passwords need 12 to 128 characters";
}

function post(path, body) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function btn(text, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = fn;
  return b;
}

async function load() {
  const r = await api("/api/users");
  const info = document.getElementById("info");
  if (!r.ok) { info.textContent = "Error: " + await errText(r); return; }
  const rows = await r.json();
  info.textContent = rows.length + " local user account(s)";
  const body = document.getElementById("rows");
  body.replaceChildren();
  for (const u of rows) {
    const tr = document.createElement("tr");
    const status = u.admin ? "administrator"
      : !u.has_password ? "no password"
      : u.locked ? "locked" : "active";
    [u.name, u.uid, u.home, status].forEach((t) => {
      const td = document.createElement("td");
      td.textContent = t;
      tr.appendChild(td);
    });
    const td = document.createElement("td");
    if (u.admin) {
      td.textContent = "manage from console";
      td.className = "muted";
    } else {
      td.append(btn("Set password", () => pick(u.name)));
      if (u.has_password)
        td.append(btn(u.locked ? "Unlock" : "Lock", () => simple(u.locked ? "unlock" : "lock", u.name)));
      td.append(btn("Delete", () => removeUser(u.name)));
    }
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function pick(name) {
  document.getElementById("pname").value = name;
  document.getElementById("pval").focus();
}

async function simple(action, name) {
  if (!confirm(`${action} user "${name}"?`)) return;
  const r = await post(`/api/users/${action}`, { name });
  if (!r.ok) alert(await errText(r));
  load();
}

async function removeUser(name) {
  const typed = prompt(`Delete user "${name}"? The home directory is kept.\nType the user name to confirm:`);
  if (typed !== name) return;
  const r = await post("/api/users/delete", { name });
  if (!r.ok) alert(await errText(r));
  load();
}

document.getElementById("create").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("cname").value;
  const password = document.getElementById("cpw").value;
  let r = await post("/api/users/create", { name });
  if (!r.ok) { alert(await errText(r)); return; }
  r = await post("/api/users/password", { name, password });
  if (!r.ok) alert("User created, but setting the password failed: " + await errText(r));
  e.target.reset();
  load();
});

document.getElementById("pw").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("pname").value;
  const password = document.getElementById("pval").value;
  const r = await post("/api/users/password", { name, password });
  if (!r.ok) { alert(await errText(r)); return; }
  e.target.reset();
  alert("Password set. The user must change it at next login.");
  load();
});

load();
