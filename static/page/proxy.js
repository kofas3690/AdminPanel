const $ = (id) => document.getElementById(id);
const JSON_H = { "Content-Type": "application/json" };

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
function values() {
  return { enabled: $("enabled").checked, http: $("http").value.trim(), https: $("https").value.trim(),
    no_proxy: $("noproxy").value.split(/[\s,]+/).filter(Boolean), apt: $("apt").checked, environment: $("envf").checked };
}

async function load() {
  const r = await api("/api/network/proxy");
  if (!r.ok) { $("msg").textContent = await errText(r); return; }
  const d = await r.json();
  $("enabled").checked = d.enabled; $("http").value = d.http; $("https").value = d.https;
  $("noproxy").value = (d.no_proxy || []).join(", "); $("apt").checked = d.apt; $("envf").checked = d.environment;
}

$("test").onclick = async () => {
  const v = values(), urls = [...new Set([v.http, v.https].filter(Boolean))];
  const box = $("results");
  box.replaceChildren();
  if (!urls.length) { $("msg").textContent = "Enter a proxy address to test."; return; }
  $("msg").textContent = "Testing\u2026";
  $("test").disabled = true;
  for (const url of urls) {
    const r = await api("/api/network/proxy/test", { method: "POST", headers: JSON_H, body: JSON.stringify({ url }) });
    if (!r.ok) { const d = document.createElement("div"); d.className = "crit"; d.textContent = url + ": " + await errText(r); box.appendChild(d); continue; }
    for (const x of (await r.json()).results) {
      const d = document.createElement("div");
      d.className = x.ok ? "" : "crit";
      d.textContent = (x.ok ? "\u2713 " : "\u2717 ") + url + " \u2192 " + x.target + (x.code && x.code !== "000" ? " (HTTP " + x.code + ")" : "") + (x.ok ? "" : "  " + x.error);
      box.appendChild(d);
    }
  }
  $("msg").textContent = "";
  $("test").disabled = false;
};

$("save").onclick = async () => {
  $("msg").textContent = "Saving\u2026";
  const r = await api("/api/network/proxy", { method: "POST", headers: JSON_H, body: JSON.stringify(values()) });
  $("msg").textContent = r.ok ? "Saved. apt and new logins use these settings now." : await errText(r);
  if (r.ok) load();
};

load();
