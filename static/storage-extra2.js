/* Storage administration, part 3: secure erase and jobs, filesystem growth,
   RAID maintenance and alerts, LUKS automatic unlock and header backup.
   Loaded after storage.html's own script and storage-extra.js. */
(function () {
  "use strict";
  const baseName = (p) => p.split("/").pop();
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const blank = () => INV.devices.filter((d) => d.can.blank);

  const _renderLvm = renderLvm;
  renderLvm = function () { _renderLvm(); try { extraRaid(); extraCrypt(); } catch (e) { console.error(e); } };
  const _renderDisks = renderDisks;
  renderDisks = function () { _renderDisks(); try { extraDisks(); } catch (e) { console.error(e); } };
  const _loadInv = loadInv;
  loadInv = async function () { await _loadInv(); if (tab === "disks") loadJobs(); };

  /* ================= disks: secure erase, filesystem growth, jobs ================= */
  function extraDisks() {
    const rows = $("devrows").children;
    INV.devices.forEach((d, i) => {
      const act = rows[i] && rows[i].querySelector(".acts");
      if (!act) return;
      if (d.can.fsgrow) act.appendChild(btn("Grow filesystem\u2026", () => actFsGrow(d)));
      if (d.can.wipe) act.appendChild(btn("Secure erase\u2026", () => actSecureErase(d)));
    });
    renderJobs();
  }

  function actFsGrow(d) {
    openOp({ title: `Grow the filesystem on ${d.name}`, op: "fs-grow",
      intro: "Expands the filesystem to fill its device, for example after the volume underneath was enlarged. It works while the filesystem is mounted.",
      fields: [], build: () => ({ device: d.path }) });
  }

  function actSecureErase(d) {
    const luks = d.fstype === "crypto_LUKS", ssd = !d.rota, canDiscard = d.disc_max > 0;
    const options = [];
    if (luks) options.push(["crypto", "Crypto-erase: destroy the encryption keys (instant, and secure for encrypted volumes)"]);
    options.push(["zero", "Overwrite with zeros (1 pass)"], ["random", "Overwrite with random data (1 pass)"],
      ["random-zero", "Overwrite with random data, then zeros (2 passes)"]);
    if (canDiscard) options.push(["secure-discard", "Secure discard: the device erases the blocks itself, if it supports it"],
      ["discard", "Discard / TRIM: fast, but not guaranteed to erase"]);
    openOp({ title: `Securely erase ${d.name}`, op: "secure-erase",
      intro: (ssd ? "This looks like an SSD or flash device: overwriting does not reliably erase it, so prefer secure discard (or encryption with crypto-erase). "
        : "This looks like a hard disk: an overwrite is a reliable way to erase it, but it takes as long as writing the whole disk. ")
        + "Overwrites run in the background and show their progress on this tab.",
      fields: [{ k: "method", label: "Method", type: "select", options,
        value: luks ? "crypto" : (ssd && canDiscard ? "secure-discard" : "zero") }],
      build: (v) => ({ device: d.path, method: v.method }), typed: () => d.name });
  }

  let JOBS = [];
  async function loadJobs() {
    let r;
    try { r = await api("/api/disks/jobs"); } catch (e) { return; }
    if (!r.ok) return;
    JOBS = (await r.json()).jobs;
    renderJobs();
  }
  const JOB_WORD = { queued: "Waiting", running: "Running", done: "Finished", failed: "Failed", cancelled: "Stopped" };
  function renderJobs() {
    let box = $("jobsbox");
    if (!box) { box = document.createElement("div"); box.id = "jobsbox"; $("tab-disks").insertBefore(box, $("tab-disks").firstChild); }
    box.replaceChildren();
    const live = JOBS.filter((j) => j.status === "running" || j.status === "queued");
    const rest = JOBS.filter((j) => !live.includes(j)).slice(0, 3);
    if (!live.length && !rest.length) return;
    const card = el("div", "vcard");
    card.appendChild(el("strong", "", "Background jobs"));
    for (const j of [...live, ...rest]) {
      const row = el("p");
      const pct = j.total ? Math.min(100, Math.round(100 * j.done / j.total)) : 0;
      row.append(`${JOB_WORD[j.status] || j.status}: secure erase (${j.method}) of ${j.device}   `);
      if (j.status === "running" || j.status === "queued") {
        const pr = el("progress"); pr.max = 100; pr.value = pct;
        row.append(pr, `  ${pct}%  \u00b7  pass ${j.pass || 1} of ${j.passes}   `, btn("Stop", () => cancelJob(j)));
      } else if (j.message) row.append(el("span", j.status === "failed" ? "crit" : "muted", j.message));
      card.appendChild(row);
    }
    box.appendChild(card);
  }
  async function cancelJob(j) {
    if (!confirm("Stop this erase? The device will be left partly overwritten.")) return;
    const post = () => api("/api/disks/jobs/cancel", { method: "POST", headers: JSON_H, body: JSON.stringify({ id: j.id }) });
    let r = await post();
    if (r.status === 423) { if (await askUnlock()) r = await post(); else return; }
    if (!r.ok) alert(await errText(r));
    loadJobs();
  }
  setInterval(() => {
    if (!document.hidden && tab === "disks" && JOBS.some((j) => j.status === "running" || j.status === "queued")) loadJobs();
  }, 3000);

  /* ================= RAID: maintenance and alerts ================= */
  function extraRaid() {
    const box = $("tab-raid"), R = INV.raid;
    if (!R || !R.available) return;
    const cards = box.querySelectorAll(".vcard");
    R.arrays.forEach((a, i) => {
      const card = cards[i];
      if (!card) return;
      const p = el("p");
      p.append("Maintenance:  ");
      if (a.can_add && ["raid1", "raid5", "raid6"].includes(a.level))
        p.append(btn("Add devices\u2026", () => actRaidGrowDevices(a)));
      if (["raid1", "raid5", "raid6", "raid10"].includes(a.level))
        p.append(btn("Use larger devices\u2026", () => actRaidGrowSize(a)));
      if (a.level === "raid1" || a.level === "raid5") p.append(btn("Convert level\u2026", () => actRaidConvert(a)));
      if (a.can_add) p.append(btn(a.bitmap === "internal" ? "Bitmap: on\u2026" : "Bitmap: off\u2026", () => actRaidBitmap(a)));
      card.insertBefore(p, card.querySelector("table"));
    });
    box.appendChild(alertsCard(R.alerts));
  }
  const backupField = { k: "backup", label: "Use a backup file for the critical section (try this if the reshape is refused)", type: "checkbox", value: false };
  function actRaidGrowDevices(a) {
    openOp({ title: `Add devices to ${a.name}`, op: "raid-grow",
      intro: `The array has ${a.raid_disks} devices. The chosen devices join it, and the data is spread over all of them (more capacity for RAID 5 and 6, more copies for RAID 1).`,
      fields: [{ k: "devices", label: "Devices to add", type: "devices", options: blank() }, backupField],
      build: (v) => ({ array: a.path, mode: "devices", devices: v.devices, backup: v.backup }) });
  }
  const actRaidGrowSize = (a) => openOp({ title: `Use the full size of ${a.name}'s devices`, op: "raid-grow",
    intro: "Use this after the devices underneath were enlarged (for example a bigger virtual disk or logical volume). Afterwards, grow the filesystem on the array.",
    fields: [], build: () => ({ array: a.path, mode: "size" }) });
  function actRaidConvert(a) {
    const to = a.level === "raid1" ? "raid5" : "raid6";
    openOp({ title: `Convert ${a.name} to ${to.replace("raid", "RAID ")}`, op: "raid-grow",
      intro: a.level === "raid1" ? "A 2-device RAID 1 becomes a 2-device RAID 5. You then add a device to gain capacity."
        : "A RAID 5 becomes a RAID 6 (two devices of redundancy). It needs at least one extra device.",
      fields: a.level === "raid5" ? [{ k: "devices", label: "Device(s) to add", type: "devices", options: blank() }, backupField] : [backupField],
      build: (v) => ({ array: a.path, mode: "level", level: to, devices: v.devices || [], backup: v.backup }) });
  }
  function actRaidBitmap(a) {
    openOp({ title: `Write-intent bitmap on ${a.name}`, op: "raid-bitmap",
      intro: "A bitmap remembers which parts of the array changed, so a resync after a crash or a briefly missing disk is much faster.",
      fields: [
        { k: "mode", label: "Bitmap", type: "select", value: a.bitmap, options: [["internal", "On (stored on the devices)"], ["none", "Off"]] },
        { k: "chunk", label: "Chunk size in MiB (optional, a power of two)", type: "text", placeholder: "64" },
      ],
      build: (v) => ({ array: a.path, mode: v.mode, chunk_mib: v.chunk.trim() === "" ? null : Number(v.chunk) }) });
  }

  function alertsCard(al) {
    const card = el("div", "vcard");
    card.appendChild(el("strong", "", "Alerts"));
    const p = el("p");
    p.append(al.enabled
      ? `On. Events are recorded here and in the system log${al.email ? ", and e-mailed to " + al.email : " (no e-mail address set)"}. Monitor service: ${al.monitor || "unknown"}.`
      : "Off. Failed disks and rebuilds are not reported anywhere until you turn this on.");
    card.appendChild(p);
    if (al.enabled && al.email && !al.sendmail) card.appendChild(el("p", "warn", "This server has no mail program, so e-mails can't be sent. Install one, for example: sudo apt install msmtp-mta"));
    const bar = el("p");
    bar.append(btn(al.enabled ? "Change\u2026" : "Turn on\u2026", () => openOp({ title: "RAID alerts", op: "raid-alerts",
      intro: "Events are always recorded in the panel and the system log. An e-mail address is optional and needs a mail program on this server.",
      fields: [{ k: "email", label: "E-mail address (optional)", type: "text", value: al.email || "", placeholder: "you@example.com" }],
      build: (v) => ({ enable: true, email: v.email.trim() }) }), "primary"));
    if (al.enabled) {
      bar.append(btn("Send a test", () => openOp({ title: "Send a test alert", op: "raid-alert-test", fields: [], build: () => ({}) })),
        btn("Turn off\u2026", () => openOp({ title: "Turn off RAID alerts", op: "raid-alerts", fields: [],
          intro: "Your original mail settings are restored.", build: () => ({ enable: false }) })));
    }
    card.appendChild(bar);
    if (al.events && al.events.length) {
      const t = el("table"), h = el("tr");
      for (const c of ["Time", "Event", "Array", "Device"]) h.appendChild(el("th", "", c));
      const th = el("thead"); th.appendChild(h); t.appendChild(th);
      const tb = el("tbody");
      for (const e of al.events) {
        const tr = el("tr");
        cell(tr, new Date(e.ts * 1000).toLocaleString());
        cell(tr, e.event, /Fail|Degraded|Dead/i.test(e.event) ? "crit" : "");
        cell(tr, e.array); cell(tr, e.device || "\u2014");
        tb.appendChild(tr);
      }
      t.appendChild(tb); card.appendChild(t);
    }
    return card;
  }

  /* ================= encryption: automatic unlock, key slots, header backup ================= */
  function extraCrypt() {
    const L = INV.luks, box = $("tab-crypt");
    if (!L || !L.available) return;
    const tb = box.querySelector("tbody");
    if (!tb || !L.containers.length) return;
    L.containers.forEach((c, i) => {
      const tr = tb.children[i];
      if (!tr) return;
      const state = tr.children[2], acts = tr.querySelector(".acts");
      if (c.system) state.appendChild(pill("System", "bad", "This volume holds the running system"));
      if (c.autounlock) state.append("  \u00b7  auto-unlock (" + (c.autounlock.mode === "tpm2" ? "TPM" : "key file") + ")");
      for (const b of acts.querySelectorAll("button")) {
        if (b.textContent.startsWith("Remove passphrase")) b.onclick = () => actLuksRemove2(c);
      }
      if (!c.system) {
        acts.appendChild(c.autounlock ? btn("Turn off auto-unlock\u2026", () => actAutoOff(c))
          : btn("Unlock at boot\u2026", () => actAutoOn(c, L.tpm2)));
      }
      acts.appendChild(btn("Header backup\u2026", () => downloadHeader(c)));
    });
    if (L.containers.some((c) => c.system)) {
      box.appendChild(el("p", "muted", "Encrypted system volumes: you can add and remove passphrases and download the header here. Unlocking at boot, formatting and erasing stay with the system."));
    }
  }

  function actLuksRemove2(c) {
    openOp({ title: `Remove a passphrase from ${c.path}`, op: "luks-removekey",
      intro: `The volume has ${c.slots} unlock methods. Enter the passphrase to remove, and one that stays valid. The kept one is tested first, so you can't remove your last working passphrase by mistake.`,
      fields: [{ k: "pass", label: "The passphrase to remove", type: "password" },
               { k: "keep", label: "A passphrase that stays valid", type: "password" }],
      build: (v) => ({ device: c.path, passphrase: v.pass, keep_passphrase: v.keep }), typed: () => baseName(c.path) });
  }
  function actAutoOn(c, tpm2) {
    const options = [["keyfile", "Key file on this server (works everywhere, weaker)"]];
    if (tpm2) options.unshift(["tpm2", "TPM 2.0 (tied to this machine, stronger)"]);
    openOp({ title: `Unlock ${c.path} automatically at boot`, op: "luks-autounlock",
      intro: "After a reboot, the volume unlocks by itself so services that use it can start. A key file stays on this server's system disk, so it only protects against someone taking the data disk alone. A TPM ties unlocking to this machine. You can still unlock with the passphrase.",
      fields: [
        { k: "mode", label: "Method", type: "select", options, value: options[0][0] },
        ...(c.open ? [] : [{ k: "name", label: "Name for the unlocked volume", type: "text", value: "crypt-" + (c.uuid || "").slice(0, 8) }]),
        { k: "pass", label: "A current passphrase", type: "password" },
      ],
      build: (v) => ({ device: c.path, mode: v.mode, name: v.name ? v.name.trim() : "", passphrase: v.pass }) });
  }
  const actAutoOff = (c) => openOp({ title: `Stop unlocking ${c.path} automatically`, op: "luks-autounlock-off",
    intro: "Removes the automatic unlock method. Enter a passphrase that stays valid; it is tested first.",
    fields: [{ k: "pass", label: "A passphrase that stays valid", type: "password" }],
    build: (v) => ({ device: c.path, passphrase: v.pass }) });

  async function downloadHeader(c) {
    if (!confirm("A header backup lets anyone who also knows an old passphrase unlock this volume, even after you change the passphrase.\n\nStore the file somewhere safe, not on this server. Download it?")) return;
    const post = () => api("/api/disks/luks/header", { method: "POST", headers: JSON_H, body: JSON.stringify({ device: c.path }) });
    let r = await post();
    if (r.status === 423) { if (await askUnlock()) r = await post(); else return; }
    if (!r.ok) { alert(await errText(r)); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = "luks-header-" + baseName(c.path) + ".img.gz";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
})();
