(async function () {
  const box = document.getElementById("rbox");
  if (!box) return;
  function line(label, value, cls) {
    const p = document.createElement("p");
    const b = document.createElement("b"); b.textContent = label + " ";
    const s = document.createElement("span"); s.textContent = value; if (cls) s.className = cls;
    p.append(b, s); box.append(p);
  }
  try {
    const r = await fetch("/api/reboot");
    if (r.status === 401) { location.href = "/login.html"; return; }
    if (!r.ok) throw new Error("Request failed (" + r.status + ")");
    const d = await r.json();
    box.textContent = "";
    let state = "No restart is needed.";
    if (d.required) {
      state = "A reboot is needed to finish updates" +
        (d.days === null ? "." : d.days < 1 ? " (since today)." : " (waiting for " + d.days + " day" + (d.days === 1 ? "" : "s") + ").");
    } else if (d.kernel_behind) {
      state = "A newer kernel is installed than the one running, so a reboot will switch to it.";
    }
    line("Status:", state, d.required || d.kernel_behind ? "warn" : "");
    if (d.packages.length) line("Because of:", d.packages.join(", "));
    line("Running kernel:", d.running_kernel + (d.newest_kernel && d.newest_kernel !== d.running_kernel ? " (newest installed: " + d.newest_kernel + ")" : ""));
    if (d.uptime_days !== null) line("Up for:", d.uptime_days + " day" + (d.uptime_days === 1 ? "" : "s"));
  } catch (e) { box.textContent = e.message; }
})();
