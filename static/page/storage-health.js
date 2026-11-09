/* Storage > Health tab: SMART health per physical disk (read only). Uses helpers from storage.js. */
function hbytes(n) {
  if (!n) return "";
  const u = ["B", "kB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 || n >= 100 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
}
const HEALTH = {
  ok: ["Good", "on"], warning: ["Warning", "warn"], failing: ["Failing", "bad"],
  unavailable: ["Not available", "off"], asleep: ["Asleep", "off"],
};
async function loadHealth(fresh) {
  $("herr").textContent = ""; $("hnote").hidden = true;
  $("hrefresh").disabled = true;
  try {
    const r = await api("/api/smart" + (fresh ? "?fresh=true" : ""));
    if (!r.ok) { $("herr").textContent = await errText(r); return; }
    const d = await r.json(), body = $("hrows");
    body.replaceChildren();
    $("hwhen").textContent = d.t ? "Last read " + new Date(d.t * 1000).toLocaleTimeString([], { timeStyle: "short" }) : "";
    if (!d.installed) {
      $("hnote").textContent = "The smartmontools package is not installed, so disk health can't be read. Install it with: sudo apt install smartmontools";
      $("hnote").hidden = false;
    }
    if (!d.disks.length) {
      const tr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = 8; td.className = "muted"; td.textContent = d.installed ? "No physical disks found." : ""; tr.appendChild(td); body.appendChild(tr);
    }
    for (const x of d.disks) {
      const tr = document.createElement("tr");
      cell(tr, "/dev/" + x.device); cell(tr, x.model || "unknown"); cell(tr, x.kind === "nvme" ? "NVMe" : x.kind === "ssd" ? "SSD" : x.kind === "hdd" ? "Hard disk" : "Disk");
      cell(tr, hbytes(x.size));
      const td = document.createElement("td"), h = HEALTH[x.status] || HEALTH.unavailable;
      td.appendChild(pill(h[0], h[1], x.reasons.join(" ")));
      if (x.reasons.length) {
        const ul = document.createElement("div"); ul.className = "muted"; ul.style.fontSize = "12px"; ul.style.marginTop = "4px";
        ul.textContent = x.reasons.join(" "); td.appendChild(ul);
      }
      tr.appendChild(td);
      cell(tr, x.temp == null ? "" : x.temp + " °C");
      cell(tr, x.hours == null ? "" : x.hours >= 48 ? Math.round(x.hours / 24) + " days" : x.hours + " h");
      cell(tr, x.wear == null ? "" : x.wear + "% used");
      body.appendChild(tr);
    }
  } catch (e) { $("herr").textContent = e.message; }
  finally { $("hrefresh").disabled = false; }
}
$("hrefresh").onclick = () => loadHealth(true);
if (location.hash === "#health") setTab("health");
