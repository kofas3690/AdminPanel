/* Storage administration, part 2: RAID, encryption and iSCSI tabs.
   Loaded by storage.html after its own script, and reuses its dialog, preview and unlock logic. */
(function () {
  "use strict";
  const EXTRA = { raid: "RAID", crypt: "Encryption", iscsi: "iSCSI" };

  /* ---------- hooks into the page ---------- */
  const _showForm = showForm;
  showForm = function () {
    _showForm();
    for (const { f, el } of Object.values(CUR.els)) {
      if (f.type === "password") { el.type = "password"; el.autocomplete = "new-password"; }
    }
  };
  $("opdlg").addEventListener("close", () => {
    if (typeof CUR === "object" && CUR) { CUR.args = null; CUR.vals = null; }
    $("opbody").replaceChildren();   // wipes any passphrase left in the form
  });

  const tabsEl = $("tabs");
  for (const [t, label] of Object.entries(EXTRA)) {
    const b = document.createElement("button");
    b.dataset.t = t; b.textContent = label; b.onclick = () => setTab(t);
    tabsEl.appendChild(b);
  }
  let anchor = $("tab-lvm");
  for (const t of Object.keys(EXTRA)) {
    const s = document.createElement("section");
    s.id = "tab-" + t; s.hidden = true;
    anchor.after(s); anchor = s;
  }

  const _setTab = setTab;
  setTab = function (t) {
    if (!(t in EXTRA)) { for (const id in EXTRA) $("tab-" + id).hidden = true; _setTab(t); return; }
    tab = t;
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    for (const id of ["overview", "disks", "lvm", ...Object.keys(EXTRA)]) $("tab-" + id).hidden = id !== t;
    $("lockbar").hidden = false;
    refreshLock(); loadInv();
  };

  const _renderLvm = renderLvm;
  renderLvm = function () { _renderLvm(); renderRaid(); renderCrypt(); renderIscsi(); };

  const _contents = contents;
  contents = function (d) { return _contents(d) + (d.tran === "iscsi" ? "  \u00b7  iSCSI" : ""); };

  const blank = () => INV.devices.filter((d) => d.can.blank);
  const note = (parent, text, cls) => { const p = document.createElement("p"); p.className = cls || "muted"; p.textContent = text; parent.appendChild(p); return p; };
  function table(parent, heads) {
    const t = document.createElement("table"), h = document.createElement("tr");
    for (const c of heads) { const th = document.createElement("th"); th.textContent = c; h.appendChild(th); }
    const th = document.createElement("thead"); th.appendChild(h); t.appendChild(th);
    const tb = document.createElement("tbody"); t.appendChild(tb); parent.appendChild(t);
    return tb;
  }
  const actions = (tr, ...buttons) => { const td = document.createElement("td"); td.className = "acts"; td.append(...buttons); tr.appendChild(td); };
  const baseName = (p) => p.split("/").pop();

  /* ================= RAID ================= */
  const SYNC_TEXT = { check: "Checking", repair: "Repairing", resync: "Syncing", recover: "Rebuilding", reshape: "Reshaping" };
  function raidPill(a) {
    const act = SYNC_TEXT[a.sync_action] || "";
    const prog = act && a.progress !== null ? " " + a.progress + "%" : "";
    if (a.degraded > 0) return pill(act ? "Degraded, " + act.toLowerCase() + prog : "Degraded", "bad");
    if (act) return pill(act + prog, "off");
    if (a.state === "inactive") return pill("Inactive", "bad");
    return pill("Healthy", "on");
  }

  function renderRaid() {
    const box = $("tab-raid");
    box.replaceChildren();
    const R = INV.raid || { available: false, arrays: [] };
    const bar = document.createElement("p");
    const create = btn("Create array\u2026", actRaidCreate, "primary");
    create.disabled = !R.available;
    bar.append(create, btn("Assemble stopped arrays", () => openOp({
      title: "Assemble RAID arrays", op: "raid-assemble",
      intro: "Starts any arrays found on the connected disks that aren't running.", fields: [], build: () => ({}) })));
    box.appendChild(bar);
    if (!R.available) note(box, "mdadm isn't installed: sudo apt install -y mdadm", "warn");
    else if (!R.arrays.length) note(box, "There are no RAID arrays yet.");
    for (const a of R.arrays) {
      const card = document.createElement("div"); card.className = "vcard";
      const head = document.createElement("div");
      const s = document.createElement("strong"); s.textContent = a.name;
      head.append(s, `   ${a.path}   ${a.level.replace("raid", "RAID ")}   ${fmt(a.size)}   ${a.raid_disks - a.degraded}/${a.raid_disks} devices active   `, raidPill(a));
      if (a.protected) head.append(" ", pill("System", "bad", "This array holds the running system"));
      card.appendChild(head);
      if (a.progress !== null && a.sync_action && a.sync_action !== "idle") {
        const p = document.createElement("p"); const pr = document.createElement("progress"); pr.max = 100; pr.value = a.progress;
        p.append(pr, `  ${a.progress}%` + (a.speed ? `  \u00b7  ${fmt(a.speed * 1024)}/s` : "")); card.appendChild(p);
      }
      if (a.mismatches) note(card, `The last check found ${a.mismatches} mismatched blocks.`, "warn");
      if (a.mounts.length) note(card, "Mounted at " + a.mounts.join(", "));
      const ab = document.createElement("p");
      if (a.can_add) ab.appendChild(btn("Add a device\u2026", () => actRaidAdd(a)));
      if (a.sync_action === "idle") ab.appendChild(btn("Start a check", () => actRaidCheck(a, "check")));
      else if (a.sync_action === "check") ab.appendChild(btn("Stop the check", () => actRaidCheck(a, "idle")));
      if (a.can_stop) ab.append(btn("Stop array\u2026", () => actRaidStop(a)), btn("Remove array\u2026", () => actRaidRemove(a)));
      card.appendChild(ab);
      const tb = table(card, ["Device", "Role", "State", ""]);
      for (const m of a.members) {
        const tr = document.createElement("tr");
        cell(tr, m.path);
        cell(tr, /spare/.test(m.state) ? "spare" : m.slot && m.slot !== "none" ? "slot " + m.slot : "\u2014");
        cell(tr, m.state || "\u2014", /faulty/.test(m.state) ? "crit" : "");
        actions(tr, btn("Remove\u2026", () => actRaidRemoveMember(a, m)));
        tb.appendChild(tr);
      }
      box.appendChild(card);
    }
    note(box, "Arrays start automatically at boot. To put a filesystem on one, use the Disks tab; to pool several, use LVM.");
  }

  function actRaidCreate() {
    const cands = blank();
    openOp({ title: "Create a RAID array", op: "raid-create",
      intro: "Combines blank devices into one array. It is usable immediately; mirrored and parity arrays then synchronise in the background.",
      fields: [
        { k: "name", label: "Name", type: "text", placeholder: "data" },
        { k: "level", label: "Level", type: "select", value: "raid1", options: [
          ["raid0", "RAID 0: striping, no redundancy (2+ devices)"], ["raid1", "RAID 1: mirror (2+ devices)"],
          ["raid5", "RAID 5: one device of redundancy (3+ devices)"], ["raid6", "RAID 6: two devices of redundancy (4+ devices)"],
          ["raid10", "RAID 10: striped mirrors (4+ devices)"]] },
        { k: "devices", label: "Devices", type: "devices", options: cands },
        { k: "spares", label: "Spare devices (optional; take over when a device fails)", type: "devices", options: cands },
      ],
      build: (v) => ({ name: v.name.trim(), level: v.level, devices: v.devices, spares: v.spares }) });
  }
  function actRaidAdd(a) {
    openOp({ title: `Add a device to ${a.name}`, op: "raid-add",
      intro: "A degraded array rebuilds onto the new device. A healthy array keeps it as a spare.",
      fields: [{ k: "device", label: "Device", type: "select", options: blank().map((d) => [d.path, `${d.path}  (${fmt(d.size)})`]) }],
      build: (v) => ({ array: a.path, device: v.device }) });
  }
  function actRaidRemoveMember(a, m) {
    openOp({ title: `Remove ${m.path} from ${a.name}`, op: "raid-remove-member",
      intro: "Marks the device failed (if it isn't already) and removes it, for example to replace a broken disk.",
      fields: [{ k: "erase", label: "Also erase its RAID information, so it can be reused", type: "checkbox", value: true }],
      build: (v) => ({ array: a.path, device: m.path, erase: v.erase }), typed: () => baseName(m.path) });
  }
  const actRaidCheck = (a, action) => openOp({ title: (action === "check" ? "Check " : "Stop checking ") + a.name, op: "raid-check",
    intro: "A check reads every block and compares the copies. It repairs nothing and can run while the array is in use.",
    fields: [], build: () => ({ array: a.path, action }) });
  const actRaidStop = (a) => openOp({ title: `Stop ${a.name}`, op: "raid-stop", fields: [], build: () => ({ array: a.path }) });
  const actRaidRemove = (a) => openOp({ title: `Remove array ${a.name}`, op: "raid-remove",
    intro: "Stops the array and erases the RAID information from its devices.", fields: [],
    build: () => ({ array: a.path }), typed: () => a.name });

  /* ================= Encryption ================= */
  function pwFields(second) {
    const f = [{ k: "pass", label: second ? "New passphrase" : "Passphrase", type: "password" }];
    if (second) f.push({ k: "pass2", label: "Repeat the new passphrase", type: "password" });
    return f;
  }
  function checkNew(v) {
    if (v.pass !== v.pass2) throw new Error("The passphrases don't match.");
    if (v.pass.length < 12) throw new Error("Use at least 12 characters.");
  }

  function renderCrypt() {
    const box = $("tab-crypt");
    box.replaceChildren();
    const L = INV.luks || { available: false, containers: [] };
    if (!L.available) note(box, "cryptsetup isn't installed: sudo apt install -y cryptsetup", "warn");
    const h1 = document.createElement("h2"); h1.textContent = "Encrypted volumes"; box.appendChild(h1);
    const tb = table(box, ["Device", "Size", "State", "Passphrases", ""]);
    if (!L.containers.length) { const tr = document.createElement("tr"); cell(tr, "No encrypted volumes found.", "muted"); tb.appendChild(tr); }
    for (const c of L.containers) {
      const tr = document.createElement("tr");
      cell(tr, c.path); cell(tr, fmt(c.size));
      const st = document.createElement("td");
      st.appendChild(c.open ? pill("Unlocked", "on", c.mapper) : pill("Locked", "off"));
      if (c.open) st.append(" " + c.mapper + (c.mounts.length ? "  \u00b7  mounted at " + c.mounts.join(", ") : ""));
      tr.appendChild(st);
      cell(tr, c.slots === null ? "?" : String(c.slots));
      const b = [];
      if (!c.open) b.push(btn("Unlock\u2026", () => actLuksOpen(c)));
      else if (c.can_close) b.push(btn("Lock", () => actLuksClose(c)));
      b.push(btn("Add passphrase\u2026", () => actLuksAdd(c)));
      if (c.slots !== null && c.slots >= 2) b.push(btn("Remove passphrase\u2026", () => actLuksRemove(c)));
      actions(tr, ...b);
      tb.appendChild(tr);
    }
    note(box, "An unlocked volume appears on the Disks tab as an encrypted device. Format and mount it there. After a reboot every volume is locked again, and you unlock it here.");

    const h2 = document.createElement("h2"); h2.textContent = "Encrypt a device"; box.appendChild(h2);
    const cands = INV.devices.filter((d) => d.can.format && d.fstype !== "crypto_LUKS" &&
      (["disk", "part", "lvm"].includes(d.type) || d.type.startsWith("raid")));
    const t2 = table(box, ["Device", "Type", "Size", "Contents", ""]);
    if (!cands.length) { const tr = document.createElement("tr"); cell(tr, "No device is free to encrypt.", "muted"); t2.appendChild(tr); }
    for (const d of cands) {
      const tr = document.createElement("tr");
      cell(tr, d.path); cell(tr, d.type); cell(tr, fmt(d.size)); cell(tr, d.fstype || "\u2014");
      actions(tr, btn("Encrypt\u2026", () => actLuksFormat(d)));
      t2.appendChild(tr);
    }
    note(box, "Encrypting erases the device. There is no way to recover the data if you lose the passphrase.", "warn");
  }

  function actLuksFormat(d) {
    openOp({ title: `Encrypt ${d.name}`, op: "luks-format",
      intro: "Erases the device and sets it up as an encrypted volume (LUKS2). You unlock it afterwards with this passphrase.",
      fields: pwFields(true), typed: () => d.name,
      build: (v) => { checkNew(v); return { device: d.path, passphrase: v.pass }; } });
  }
  function actLuksOpen(c) {
    openOp({ title: `Unlock ${c.path}`, op: "luks-open",
      fields: [{ k: "name", label: "Name for the unlocked volume (it appears as /dev/mapper/\u2026)", type: "text", value: "crypt-" + (c.uuid || "").slice(0, 8) }, ...pwFields(false)],
      build: (v) => ({ device: c.path, name: v.name.trim(), passphrase: v.pass }) });
  }
  const actLuksClose = (c) => openOp({ title: `Lock ${c.mapper}`, op: "luks-close",
    intro: "The volume must be unmounted. Its data stays encrypted on the disk.", fields: [], build: () => ({ device: c.mapper }) });
  function actLuksAdd(c) {
    openOp({ title: `Add a passphrase to ${c.path}`, op: "luks-addkey",
      intro: "Enter one passphrase that already works, then the new one. Either will unlock the volume afterwards.",
      fields: [{ k: "cur", label: "A current passphrase", type: "password" }, ...pwFields(true)],
      build: (v) => { checkNew(v); return { device: c.path, passphrase: v.cur, new_passphrase: v.pass }; } });
  }
  function actLuksRemove(c) {
    openOp({ title: `Remove a passphrase from ${c.path}`, op: "luks-removekey",
      intro: `The volume has ${c.slots} passphrases. Enter the one to remove. At least one must remain.`,
      fields: [{ k: "pass", label: "The passphrase to remove", type: "password" }],
      build: (v) => ({ device: c.path, passphrase: v.pass }), typed: () => baseName(c.path) });
  }

  /* ================= iSCSI ================= */
  let DISC = [], ISCSI_HOST = "", ISCSI_MSG = "";
  async function discover() {
    ISCSI_HOST = $("iscsihost").value.trim();
    $("iscsimsg").textContent = "Looking for targets\u2026";
    const r = await api("/api/disks/iscsi/discover", { method: "POST", headers: JSON_H, body: JSON.stringify({ portal: ISCSI_HOST }) });
    if (!r.ok) { ISCSI_MSG = await errText(r); DISC = []; renderIscsi(true); return; }
    DISC = (await r.json()).targets;
    ISCSI_MSG = DISC.length ? "" : "That server answered, but offers no targets to this initiator.";
    renderIscsi(true);
  }

  function renderIscsi(force) {
    if (!force && document.activeElement && document.activeElement.id === "iscsihost") return;
    const box = $("tab-iscsi");
    box.replaceChildren();
    const I = INV.iscsi || { available: false, nodes: [], sessions: [] };
    if (!I.available) { note(box, "open-iscsi isn't installed: sudo apt install -y open-iscsi", "warn"); return; }
    const init = document.createElement("p");
    init.append("This server's initiator name: ");
    const code = document.createElement("code"); code.textContent = I.initiator || "unknown"; init.append(code, " ");
    if (I.initiator) init.appendChild(btn("Copy", async () => { try { await navigator.clipboard.writeText(I.initiator); } catch (e) {} }));
    box.appendChild(init);
    note(box, "Give this name to the storage server so it allows this machine to connect.");

    const h1 = document.createElement("h2"); h1.textContent = "Find targets"; box.appendChild(h1);
    const form = document.createElement("p");
    const inp = document.createElement("input"); inp.type = "text"; inp.id = "iscsihost"; inp.value = ISCSI_HOST;
    inp.placeholder = "Storage server, e.g. 192.168.1.50 or 192.168.1.50:3260"; inp.style.width = "340px"; inp.autocomplete = "off";
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") discover(); });
    const msg = document.createElement("span"); msg.id = "iscsimsg"; msg.className = ISCSI_MSG ? "crit" : "muted"; msg.textContent = ISCSI_MSG;
    form.append(inp, " ", btn("Discover", discover, "primary"), " ", msg);
    box.appendChild(form);
    if (DISC.length) {
      const tb = table(box, ["Target", "Address", ""]);
      for (const t of DISC) {
        const tr = document.createElement("tr");
        cell(tr, t.iqn); cell(tr, t.portal);
        const on = I.sessions.some((s) => s.iqn === t.iqn && s.portal === t.portal);
        if (on) { const td = document.createElement("td"); td.appendChild(pill("Connected", "on")); tr.appendChild(td); }
        else actions(tr, btn("Connect\u2026", () => actIscsiLogin(t)));
        tb.appendChild(tr);
      }
    }

    const h2 = document.createElement("h2"); h2.textContent = "Connected targets"; box.appendChild(h2);
    const tb2 = table(box, ["Target", "Address", "State", "Disks", ""]);
    if (!I.sessions.length) { const tr = document.createElement("tr"); cell(tr, "Not connected to any target.", "muted"); tb2.appendChild(tr); }
    for (const s of I.sessions) {
      const tr = document.createElement("tr");
      cell(tr, s.iqn); cell(tr, s.portal); cell(tr, s.state || "\u2014", /LOGGED_IN/.test(s.state) ? "" : "warn");
      cell(tr, s.disks.map((d) => `${d.path}  (${fmt(d.size)})` + (d.mounts.length ? "  mounted" : "")).join("\n") || "\u2014", "addr");
      actions(tr, s.can_logout ? btn("Disconnect\u2026", () => actIscsiLogout(s)) : pill("In use", "off", "Unmount or release its disks first"));
      tb2.appendChild(tr);
    }
    note(box, "The target's disks appear on the Disks tab, where you can partition, format and mount them.");

    const h3 = document.createElement("h2"); h3.textContent = "Saved targets"; box.appendChild(h3);
    const tb3 = table(box, ["Target", "Address", "Reconnect at boot", "Login", ""]);
    if (!I.nodes.length) { const tr = document.createElement("tr"); cell(tr, "No saved targets.", "muted"); tb3.appendChild(tr); }
    for (const n of I.nodes) {
      const tr = document.createElement("tr");
      const connected = I.sessions.some((s) => s.iqn === n.iqn && s.portal === n.portal);
      cell(tr, n.iqn); cell(tr, n.portal); cell(tr, n.startup === "automatic" ? "Yes" : "No");
      cell(tr, n.auth && n.auth !== "None" ? n.auth + (n.user ? " (" + n.user + ")" : "") : "none");
      const b = [btn(n.startup === "automatic" ? "Don't reconnect at boot" : "Reconnect at boot", () => actIscsiStartup(n))];
      if (!connected) b.push(btn("Forget\u2026", () => actIscsiForget(n)));
      actions(tr, ...b);
      tb3.appendChild(tr);
    }
  }

  function actIscsiLogin(t) {
    openOp({ title: `Connect to ${t.iqn}`, op: "iscsi-login",
      intro: `Server ${t.portal}. If the storage server requires a login (CHAP), fill in the credentials; otherwise leave them empty.`,
      fields: [
        { k: "auto", label: "Reconnect automatically at boot", type: "checkbox", value: true },
        { k: "user", label: "CHAP user name (optional)", type: "text", value: "" },
        { k: "pw", label: "CHAP password (optional)", type: "password" },
      ],
      build: (v) => {
        if ((v.user.trim() === "") !== (v.pw === "")) throw new Error("Enter both the CHAP user name and password, or neither.");
        return { iqn: t.iqn, portal: t.portal, auto: v.auto, chap_user: v.user.trim(), chap_pass: v.pw };
      } });
  }
  const actIscsiLogout = (s) => openOp({ title: `Disconnect ${s.iqn}`, op: "iscsi-logout",
    intro: "Its disks disappear from this server. Nothing on them is changed.",
    fields: [{ k: "forget", label: "Also forget this target (it won't reconnect at boot)", type: "checkbox", value: false }],
    build: (v) => ({ iqn: s.iqn, portal: s.portal, forget: v.forget }) });
  const actIscsiForget = (n) => openOp({ title: `Forget ${n.iqn}`, op: "iscsi-forget",
    intro: "Removes the saved connection details. You can discover the target again later.", fields: [],
    build: () => ({ iqn: n.iqn, portal: n.portal }) });
  const actIscsiStartup = (n) => openOp({ title: "Reconnect at boot", op: "iscsi-startup", fields: [],
    intro: n.startup === "automatic" ? "This target will no longer reconnect automatically at boot." : "This target will reconnect automatically at boot.",
    build: () => ({ iqn: n.iqn, portal: n.portal, mode: n.startup === "automatic" ? "manual" : "automatic" }) });
})();
