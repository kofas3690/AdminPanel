const $ = (id) => document.getElementById(id);
let poll = null;

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) { location.href = "/login.html"; throw new Error("not logged in"); }
  return r;
}
async function errText(r) {
  try { const j = await r.json(); if (typeof j.detail === "string") return j.detail; } catch (e) {}
  return "Request failed (" + r.status + ")";
}
const send = (method, path, body) => api(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
function fmtBytes(n) {
  const u = ["B", "kB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 || n >= 100 ? n.toFixed(0) : n.toFixed(1)) + " " + u[i];
}
const when = (s) => new Date(s * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function kv(tb, k, v, cls) { const tr = el("tr"); tr.append(el("th", k)); tr.append(el("td", v, cls)); tb.append(tr); }
const hh = (h) => String(h).padStart(2, "0") + ":00";

for (let h = 0; h < 24; h++) $("hour").append(new Option(hh(h), String(h)));

function drawState(d) {
  const tb = $("state"); tb.replaceChildren();
  const c = d.config;
  const sched = c.schedule === "off" ? "Off: only when you press the button"
    : (c.schedule === "daily" ? "Every day" : "Every week") + ", from " + hh(c.hour) + ". Keeps " + c.keep + " copies.";
  kv(tb, "Schedule", sched);
  if (d.running) kv(tb, "Last backup", "Running now…");
  else if (!d.last) kv(tb, "Last backup", "No backup has run yet");
  else if (d.last.ok) kv(tb, "Last backup", when(d.last.t) + ", " + fmtBytes(d.last.size) + (d.last.warning ? " (a file changed while it was read)" : ""), "ok");
  else kv(tb, "Last backup", "Failed on " + when(d.last.t) + ": " + (d.last.error || "unknown error"), "bad");
  const disk = c.dest.startsWith("mnt:");
  const label = c.dest === "local" ? "This machine" : disk ? "Disk /mnt/" + c.dest.slice(4) : "Network share \"" + c.dest + "\"";
  if (c.dest !== "local" && !d.dest_ready) kv(tb, "Stored on", label + ": " + (disk ? "not mounted right now. Mount it on the Storage page." : "not connected right now. It is connected automatically when a backup starts."), "bad");
  else kv(tb, "Stored on", label);
  if (d.dest_ready) kv(tb, "Free space", fmtBytes(d.free) + " of " + fmtBytes(d.total) + " on the backup " + (c.dest === "local" || disk ? "disk" : "share"));
  $("now").disabled = d.running;
  $("nowmsg").textContent = d.running ? "A backup is running." : "";
}

function drawCopies(d) {
  const tb = $("copies"); tb.replaceChildren();
  const list = d.archives.slice().reverse();
  if (!list.length) { const tr = el("tr"), td = el("td", "No copies yet.", "muted"); td.colSpan = 4; tr.append(td); tb.append(tr); }
  for (const a of list) {
    const tr = el("tr");
    tr.append(el("td", when(a.t)), el("td", fmtBytes(a.size)), el("td", a.name));
    const td = el("td"), v = el("button", "Check"), x = el("button", "Delete");
    v.onclick = async () => {
      v.disabled = true; v.textContent = "Checking…"; $("err").textContent = "";
      const r = await send("POST", "/api/backup/verify", { name: a.name });
      if (r.ok) { const j = await r.json(); v.textContent = "OK, " + j.entries + " items"; }
      else { $("err").textContent = await errText(r); v.textContent = "Check"; v.disabled = false; }
    };
    x.onclick = async () => {
      if (!confirm("Delete the copy from " + when(a.t) + "?")) return;
      const r = await send("POST", "/api/backup/delete", { name: a.name });
      if (!r.ok) $("err").textContent = await errText(r);
      load(false);
    };
    td.append(v, " ", x); tr.append(td); tb.append(tr);
  }
  const r = $("restore"); r.replaceChildren();
  r.append("To restore, sign in on the console and run, for example: ");
  r.append(el("code", "sudo tar -xzf " + (d.dest_path || "/var/backups/adminpanel") + "/" + (list[0] ? list[0].name : "FILE") + " -C /tmp/restore"));
  r.append(" (create the folder first), then copy back what you need. Copies are readable only by root, so this page cannot restore for you.");
}

async function fillDest(current, targets) {
  const sel = $("dest");
  while (sel.options.length > 1) sel.remove(1);
  try {
    const r = await api("/api/shares");
    if (r.ok) for (const s of (await r.json()).shares) if (s.access === "backup") sel.append(new Option("Network share: " + s.name + " (" + s.server + ")", s.name));
  } catch (e) {}
  for (const t of targets || []) sel.append(new Option("Disk " + t.path + " (" + t.fstype + ", " + fmtBytes(t.free) + " free)", t.name));
  if (current !== "local" && ![...sel.options].some((o) => o.value === current)) sel.append(new Option((current.startsWith("mnt:") ? "Disk /mnt/" + current.slice(4) : "Network share: " + current) + " (not available)", current));
  sel.value = current;
}

async function load(fillForm) {
  const r = await api("/api/backup");
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  const d = await r.json();
  drawState(d); drawCopies(d);
  if (fillForm) {
    $("sources").value = d.config.sources.join("\n");
    await fillDest(d.config.dest, d.targets);
    $("schedule").value = d.config.schedule; $("hour").value = String(d.config.hour); $("keep").value = d.config.keep;
  }
  clearTimeout(poll);
  if (d.running) poll = setTimeout(() => load(false), 3000);
}

$("now").onclick = async () => {
  $("err").textContent = "";
  const r = await send("POST", "/api/backup/start");
  if (!r.ok) $("err").textContent = await errText(r);
  setTimeout(() => load(false), 1200);
};
$("form").addEventListener("submit", async (e) => {
  e.preventDefault(); $("err").textContent = ""; $("savemsg").textContent = "";
  const sources = $("sources").value.split("\n").map((s) => s.trim()).filter(Boolean);
  const r = await send("PUT", "/api/backup/settings", { schedule: $("schedule").value, hour: Number($("hour").value), keep: Number($("keep").value), sources, dest: $("dest").value });
  if (!r.ok) { $("err").textContent = await errText(r); return; }
  $("savemsg").textContent = "Saved.";
  load(false);
});
load(true);
