async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}

async function errText(r) {
  try {
    const j = await r.json();
    return typeof j.detail === "string" ? j.detail : "Invalid input";
  } catch (e) { return "Request failed (" + r.status + ")"; }
}

function post(path, body) {
  const opts = { method: "POST" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return api(path, opts);
}

async function load() {
  const r = await api("/api/firewall");
  const info = document.getElementById("info");
  if (!r.ok) { info.textContent = "Error: " + await errText(r); return; }
  const d = await r.json();
  info.textContent = d.active
    ? "Firewall is ACTIVE."
    : "Firewall is INACTIVE: the rules below are saved but not enforced yet.";
  info.className = d.active ? "" : "warn";
  document.getElementById("enable").hidden = d.active;
  document.getElementById("raw").textContent = d.status_text;

  const body = document.getElementById("rules");
  body.replaceChildren();
  for (const x of d.rules) {
    const tr = document.createElement("tr");
    [x.raw, x.port ?? "", x.proto ?? "", x.source ?? "Anywhere"].forEach((t) => {
      const td = document.createElement("td");
      td.textContent = t;
      tr.appendChild(td);
    });
    const td = document.createElement("td");
    if (x.protected) {
      td.textContent = "protected";
      td.className = "muted";
    } else if (!x.manageable) {
      td.textContent = "manage from console";
      td.className = "muted";
    } else {
      const b = document.createElement("button");
      b.textContent = "Remove";
      b.onclick = () => removeRule(x);
      td.appendChild(b);
    }
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function removeRule(x) {
  if (!confirm(`Remove rule: ${x.raw}?`)) return;
  const r = await post("/api/firewall/delete", { port: x.port, proto: x.proto, source: x.source });
  if (!r.ok) alert(await errText(r));
  load();
}

async function enableFw() {
  if (!confirm("Enable the firewall now? Incoming connections without an allow rule will be blocked. SSH (22/tcp) must already be allowed."))
    return;
  const r = await post("/api/firewall/enable");
  if (!r.ok) alert(await errText(r));
  load();
}

document.getElementById("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const src = document.getElementById("src").value.trim();
  const r = await post("/api/firewall/allow", {
    port: Number(document.getElementById("port").value),
    proto: document.getElementById("proto").value,
    source: src === "" ? null : src,
  });
  if (!r.ok) { alert(await errText(r)); return; }
  e.target.reset();
  load();
});

load();

document.getElementById("enable").addEventListener("click", () => enableFw());
