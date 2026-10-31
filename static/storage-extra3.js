/* Storage administration, part 4: iSCSI initiator (rebuilt), multipath, iSCSI target.
   Loaded after storage.html's own script and the earlier storage scripts. */
(function () {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const note = (parent, text, cls) => { const p = el("p", cls || "muted", text); parent.appendChild(p); return p; };
  function table(parent, heads) {
    const t = el("table"), h = el("tr");
    for (const c of heads) h.appendChild(el("th", "", c));
    const th = el("thead"); th.appendChild(h); t.appendChild(th);
    const tb = el("tbody"); t.appendChild(tb); parent.appendChild(t);
    return tb;
  }
  const actions = (tr, ...b) => { const td = el("td", "acts"); td.append(...b); tr.appendChild(td); };
  const emptyRow = (tb, text) => { const tr = el("tr"); cell(tr, text, "muted"); tb.appendChild(tr); };
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); } catch (e) { prompt("Copy this:", t); } };

  /* ---------- tabs ---------- */
  const MORE = { mpath: "Multipath", target: "iSCSI target" };
  for (const [t, label] of Object.entries(MORE)) {
    const b = el("button", "", label); b.dataset.t = t; b.onclick = () => setTab(t); $("tabs").appendChild(b);
  }
  let anchor = [...document.querySelectorAll("section[id^='tab-']")].pop();
  for (const t of Object.keys(MORE)) { const s = el("section"); s.id = "tab-" + t; s.hidden = true; anchor.after(s); anchor = s; }
  const _setTab = setTab;
  setTab = function (t) {
    if (!(t in MORE)) { for (const id in MORE) $("tab-" + id).hidden = true; _setTab(t); return; }
    tab = t;
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    document.querySelectorAll("section[id^='tab-']").forEach((s) => { s.hidden = s.id !== "tab-" + t; });
    $("lockbar").hidden = false;
    refreshLock(); loadInv();
  };
  const _renderLvm = renderLvm;
  renderLvm = function () { _renderLvm(); try { renderIscsi2(false); renderMpath(); renderTarget(); } catch (e) { console.error(e); } };

  /* ================= iSCSI initiator ================= */
  const DST = { host: "", iface: "default", list: [], msg: "", du: "", dui: "" };
  const ifaceName = (i) => (i === "iser" ? "iSER" : "TCP");

  async function discover() {
    DST.host = $("ihost").value.trim(); DST.iface = $("iiface").value;
    DST.du = $("idu").value.trim(); DST.dui = $("idui").value.trim();
    const au = { user: DST.du, password: $("idp").value, user_in: DST.dui, password_in: $("idpi").value };
    const body = { portal: DST.host, iface: DST.iface };
    if (au.user || au.password || au.user_in || au.password_in) body.auth = au;
    $("idp").value = ""; $("idpi").value = "";
    $("imsg").textContent = "Looking for targets\u2026";
    const r = await api("/api/disks/iscsi/discover", { method: "POST", headers: JSON_H, body: JSON.stringify(body) });
    if (!r.ok) { DST.msg = await errText(r); DST.list = []; renderIscsi2(true); return; }
    DST.list = (await r.json()).targets;
    DST.msg = DST.list.length ? "" : "That server answered but offers no targets to this initiator.";
    renderIscsi2(true);
  }

  function renderIscsi2(force) {
    const box = $("tab-iscsi");
    if (!force && box.contains(document.activeElement) && ["INPUT", "SELECT"].includes(document.activeElement.tagName)) return;
    box.replaceChildren();
    const I = INV.iscsi || { available: false };
    if (!I.available) { note(box, "open-iscsi isn't installed: sudo apt install -y open-iscsi", "warn"); return; }
    if (I.error) note(box, "Could not read the iSCSI state: " + I.error, "crit");

    const init = el("p"); init.append("This server's initiator name: ");
    const code = el("code", "", I.initiator || "unknown"); init.append(code, " ");
    if (I.initiator) init.appendChild(btn("Copy", () => copyText(I.initiator)));
    box.appendChild(init);
    note(box, "Give this name to the storage server so it allows this machine to connect.");

    box.appendChild(el("h2", "", "Find targets"));
    const form = el("p");
    const host = el("input"); host.type = "text"; host.id = "ihost"; host.value = DST.host; host.autocomplete = "off";
    host.placeholder = "Storage server, e.g. 192.168.1.50 or 192.168.1.50:3260"; host.style.width = "340px";
    host.addEventListener("keydown", (e) => { if (e.key === "Enter") discover(); });
    const sel = el("select"); sel.id = "iiface";
    for (const [v, t] of [["default", "TCP"], ["iser", "iSER (RDMA)"]]) { const o = el("option", "", t); o.value = v; sel.appendChild(o); }
    sel.value = DST.iface;
    const msg = el("span", DST.msg ? "crit" : "muted", DST.msg); msg.id = "imsg";
    form.append(host, " ", sel, " ", btn("Discover", discover, "primary"), " ", msg);
    box.appendChild(form);
    if (DST.iface === "iser" && !(I.iser && I.iser.ok)) note(box, "iSER isn't available here: " + ((I.iser && I.iser.reason) || "unknown reason"), "warn");
    const det = el("details"); det.appendChild(el("summary", "", "Discovery login (CHAP), only if the storage server asks for one"));
    const df = el("div"); df.style.margin = "8px 0";
    const mk = (id, ph, pw, val) => { const i = el("input"); i.type = pw ? "password" : "text"; i.id = id; i.placeholder = ph; i.autocomplete = "off"; i.style.margin = "0 6px 6px 0"; if (val) i.value = val; return i; };
    df.append(mk("idu", "User name", false, DST.du), mk("idp", "Password", true), el("br"), mk("idui", "Mutual user name (optional)", false, DST.dui), mk("idpi", "Mutual password", true));
    det.appendChild(df); box.appendChild(det);

    if (DST.list.length) {
      const tb = table(box, ["Target", "Address", ""]);
      for (const t of DST.list) {
        const tr = el("tr"); cell(tr, t.iqn); cell(tr, t.portal);
        const on = I.sessions.some((s) => s.iqn === t.iqn && s.portal === t.portal && s.iface === DST.iface);
        if (on) { const td = el("td"); td.appendChild(pill("Connected", "on")); tr.appendChild(td); }
        else actions(tr, btn("Connect\u2026", () => actLogin({ iqn: t.iqn, portal: t.portal, iface: DST.iface })));
        tb.appendChild(tr);
      }
    }

    box.appendChild(el("h2", "", "Targets and paths"));
    const groups = new Map();
    const grp = (iqn) => { if (!groups.has(iqn)) groups.set(iqn, { iqn, paths: [] }); return groups.get(iqn); };
    for (const n of I.nodes) grp(n.iqn).paths.push({ node: n, portal: n.portal, iface: n.iface,
      sess: I.sessions.find((s) => s.iqn === n.iqn && s.portal === n.portal && s.iface === n.iface) || null });
    for (const s of I.sessions) {
      const g = grp(s.iqn);
      if (!g.paths.some((p) => p.portal === s.portal && p.iface === s.iface)) g.paths.push({ node: null, sess: s, portal: s.portal, iface: s.iface });
    }
    if (!groups.size) note(box, "Not connected to any target.");
    for (const g of groups.values()) {
      const card = el("div", "vcard");
      const head = el("div"); head.appendChild(el("strong", "", g.iqn));
      const live = g.paths.filter((p) => p.sess).length;
      head.append(`   ${live} of ${g.paths.length} path(s) connected`);
      card.appendChild(head);
      const bar = el("p");
      bar.append(btn("Add a path\u2026", () => actLogin({ iqn: g.iqn, portal: "", iface: "default" }, true)));
      if (live) bar.appendChild(btn("Rescan for new disks", () => openOp({ title: "Rescan iSCSI disks", op: "iscsi-rescan", fields: [], build: () => ({}) })));
      card.appendChild(bar);
      const tb = table(card, ["Address", "Transport", "State", "Disks", "At boot", "Login", ""]);
      for (const p of g.paths) {
        const tr = el("tr");
        cell(tr, p.portal); cell(tr, ifaceName(p.iface));
        cell(tr, p.sess ? (p.sess.state || "connected") : "not connected", p.sess ? (/LOGGED_IN/.test(p.sess.state) ? "" : "warn") : "muted");
        cell(tr, p.sess ? (p.sess.disks.map((d) => `${d.path}  (${fmt(d.size)})` + (d.mounts.length ? "  mounted" : "")).join("\n") || "\u2014") : "\u2014", "addr");
        cell(tr, p.node ? (p.node.startup === "automatic" ? "reconnects" : "manual") : "\u2014");
        cell(tr, p.node && p.node.auth && p.node.auth !== "None" ? p.node.auth + (p.node.mutual ? " (mutual)" : "") + (p.node.user ? ": " + p.node.user : "") : "none");
        const b = [];
        const key = { iqn: g.iqn, portal: p.portal, iface: p.iface };
        if (p.sess) b.push(p.sess.can_logout ? btn("Disconnect\u2026", () => actLogout(key, p.sess))
          : pill("In use", "off", "Unmount or release its disks first"));
        else if (p.node) b.push(btn("Reconnect", () => openOp({ title: `Reconnect ${p.portal}`, op: "iscsi-reconnect", fields: [],
          intro: "Uses the login saved for this path.", build: () => key })));
        if (p.node) {
          b.push(btn(p.node.startup === "automatic" ? "Don't reconnect at boot" : "Reconnect at boot", () => openOp({
            title: "Reconnect at boot", op: "iscsi-startup", fields: [], build: () => ({ ...key, mode: p.node.startup === "automatic" ? "manual" : "automatic" }) })));
          if (!p.sess) b.push(btn("Forget\u2026", () => openOp({ title: `Forget ${p.portal}`, op: "iscsi-forget", fields: [],
            intro: "Removes the saved path and its login.", build: () => key })));
        }
        actions(tr, ...b);
        tb.appendChild(tr);
      }
      box.appendChild(card);
    }
  }

  function actLogin(t, askPortal) {
    const I = INV.iscsi || {};
    const saved = (I.nodes || []).filter((n) => n.iqn === t.iqn && n.auth && n.auth !== "None");
    const iserOk = I.iser && I.iser.ok;
    const fields = [];
    if (askPortal) fields.push({ k: "portal", label: "Server address of the new path", type: "text", placeholder: "192.168.1.51:3260" });
    fields.push({ k: "iface", label: "Transport", type: "select", value: t.iface || "default",
      options: [["default", "TCP"], ...(iserOk ? [["iser", "iSER (RDMA)"]] : [])],
      hint: iserOk ? "" : "iSER is unavailable: " + ((I.iser && I.iser.reason) || "unknown reason") });
    if (saved.length) fields.push({ k: "copy", label: "Login", type: "select", value: "",
      options: [["", "Enter a login below (or none)"], ...saved.map((n) => [n.portal + "|" + n.iface, `Same login as ${n.portal} (${ifaceName(n.iface)})`])] });
    fields.push(
      { k: "user", label: "CHAP user name (optional)", type: "text", value: "" },
      { k: "pw", label: "CHAP password", type: "password" },
      { k: "muser", label: "Mutual CHAP: the storage server's user name (optional)", type: "text", value: "" },
      { k: "mpw", label: "Mutual CHAP: the storage server's password", type: "password" },
      { k: "auto", label: "Reconnect automatically at boot", type: "checkbox", value: true });
    openOp({ title: askPortal ? `Add a path to ${t.iqn}` : `Connect to ${t.iqn}`, op: "iscsi-login",
      intro: (askPortal ? "" : `Server ${t.portal}. `) + "Each path has its own login. If the storage server doesn't ask for one, leave the credentials empty. Mutual CHAP also proves the storage server's identity to you.",
      fields,
      build: (v) => {
        const portal = askPortal ? v.portal.trim() : t.portal;
        if (!portal) throw new Error("Enter the server address of the new path.");
        const base = { iqn: t.iqn, portal, iface: v.iface, auto: v.auto };
        if (v.copy) { const [cp, ci] = v.copy.split("|"); return { ...base, copy_portal: cp, copy_iface: ci }; }
        if ((v.user.trim() === "") !== (v.pw === "")) throw new Error("Enter both the CHAP user name and password, or neither.");
        if ((v.muser.trim() === "") !== (v.mpw === "")) throw new Error("Enter both mutual CHAP fields, or neither.");
        if (v.muser.trim() && !v.user.trim()) throw new Error("Mutual CHAP needs the CHAP user name and password too.");
        return { ...base, chap_user: v.user.trim(), chap_pass: v.pw, chap_user_in: v.muser.trim(), chap_pass_in: v.mpw };
      } });
  }
  const actLogout = (key, s) => openOp({ title: `Disconnect ${key.portal}`, op: "iscsi-logout",
    intro: s.disks.some((d) => d.redundant) ? "Its disks belong to a multipath device that has other paths, so I/O continues over them." : "Its disks disappear from this server. Nothing on them is changed.",
    fields: [{ k: "forget", label: "Also forget this path (it won't reconnect at boot)", type: "checkbox", value: false }],
    build: (v) => ({ ...key, forget: v.forget }) });

  /* ================= multipath ================= */
  function renderMpath() {
    const box = $("tab-mpath");
    box.replaceChildren();
    const M = INV.multipath || { available: false, maps: [] };
    if (!M.available) { note(box, "multipath-tools isn't installed: sudo apt install -y multipath-tools", "warn"); return; }
    if (M.error) note(box, "Could not read the multipath state: " + M.error, "crit");
    const card = el("div", "vcard");
    const head = el("p");
    head.append("Multipath service:  ", M.running ? pill("Running", "on") : pill("Stopped", "off"), "   ", M.enabled ? "starts at boot" : "does not start at boot");
    card.appendChild(head);
    const bar = el("p");
    if (!M.running) bar.append(btn("Enable multipath\u2026", () => openOp({ title: "Enable multipath", op: "mpath-enable",
      intro: "Starts the multipath service. A disk reached over more than one path (for example an iSCSI target with two portals) becomes one multipath device. Disks with a single path are left alone.",
      fields: [], build: () => ({}) }), "primary"));
    else bar.append(btn("Reload", () => openOp({ title: "Reload multipath", op: "mpath-reload", fields: [], build: () => ({}) })),
      btn("Disable\u2026", () => openOp({ title: "Disable multipath", op: "mpath-disable", fields: [], build: () => ({}) })));
    card.appendChild(bar);
    if (M.running && !M.managed_conf) note(card, "/etc/multipath.conf was edited by hand, so the panel leaves it alone.");
    box.appendChild(card);

    box.appendChild(el("h2", "", "Multipath devices"));
    const tb = table(box, ["Device", "Size", "Paths", "Contents", ""]);
    if (!M.maps.length) emptyRow(tb, M.running ? "No multipath devices. A device needs at least two paths to appear here." : "Turn multipath on to combine paths.");
    for (const m of M.maps) {
      const tr = el("tr");
      cell(tr, m.name + (m.state ? "  (" + m.state + ")" : "")); cell(tr, fmt(m.size));
      const pt = el("td", "addr");
      pt.textContent = m.paths.map((p) => `${p.dev}  ${[p.state, p.check].filter(Boolean).join(" / ") || "unknown"}`).join("\n");
      tr.appendChild(pt);
      cell(tr, (m.fstype || "\u2014") + (m.mounts.length ? "  mounted at " + m.mounts.join(", ") : ""));
      const d = INV.devices.find((x) => x.path === m.path), b = [];
      if (d) {
        if (d.can.mount) b.push(btn("Mount\u2026", () => actMount(d)));
        for (const mp of d.can.unmount) b.push(btn("Unmount " + mp, () => actUnmount(mp)));
        if (d.can.format) b.push(btn("Format\u2026", () => actFormat(d)));
      }
      actions(tr, ...b);
      tb.appendChild(tr);
    }
    note(box, "Use a multipath device as one disk: format and mount it here, encrypt it, or add it to a volume group on the LVM tab. It can't be partitioned. A path that fails is dropped from its device automatically, and used again when it returns.");
  }

  /* ================= iSCSI target (export) ================= */
  const asDevs = (list) => list.map((x) => ({ path: x.name, size: x.size }));
  function renderTarget() {
    const box = $("tab-target");
    if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    box.replaceChildren();
    const T = INV.target || { available: false };
    if (!T.available) { note(box, "The iSCSI target software isn't ready" + (T.reason ? ": " + T.reason : ""), "warn"); return; }

    const top = el("p");
    top.append(btn("Create target\u2026", actTgtCreate, "primary"), btn("Share a disk or volume\u2026", actBsBlock), btn("Create an image file\u2026", actBsFile));
    box.appendChild(top);
    note(box, "Exports this server's storage to other machines over iSCSI. Only the initiators you list can connect, and a login is required by default. Open port 3260/tcp on the Firewall page for the networks that should connect.");
    const st = el("p");
    st.append("Targets return after a reboot: ", T.persist === "enabled" ? pill("Yes", "on") : pill("No", "off"), " ",
      btn(T.persist === "enabled" ? "Turn off\u2026" : "Turn on", () => openOp({ title: "Restore targets at boot", op: "tgt-persist", fields: [],
        build: () => ({ enable: T.persist !== "enabled" }) })));
    box.appendChild(st);

    box.appendChild(el("h2", "", "Shared volumes"));
    const bt = table(box, ["Name", "Kind", "Source", "Size", "Used by", ""]);
    if (!T.backstores.length) emptyRow(bt, "Nothing is shared yet.");
    for (const b of T.backstores) {
      const tr = el("tr");
      cell(tr, b.name); cell(tr, b.kind === "file" ? "Image file" : "Disk or volume"); cell(tr, b.path || "\u2014"); cell(tr, fmt(b.size));
      cell(tr, b.used_by.join("\n") || "not used", b.used_by.length ? "addr" : "muted");
      actions(tr, b.used_by.length ? el("span", "muted", "remove its LUN first") : btn("Remove\u2026", () => actBsRemove(b)));
      bt.appendChild(tr);
    }

    box.appendChild(el("h2", "", "Targets"));
    if (!T.targets.length) note(box, "There are no targets yet.");
    for (const t of T.targets) box.appendChild(targetCard(T, t));

    box.appendChild(el("h2", "", "Discovery login"));
    const D = T.discovery || {};
    if (!D.supported) note(box, "Not available with this version of the target software.");
    else {
      const p = el("p");
      p.append(D.enabled ? `On (user ${D.user}${D.mutual ? ", mutual" : ""}). Initiators must log in to list this server's targets.  ` : "Off. Anyone who can reach the portal can list this server's targets.  ",
        btn(D.enabled ? "Change\u2026" : "Turn on\u2026", () => actDisc(true)));
      if (D.enabled) p.append(btn("Turn off\u2026", () => actDisc(false)));
      box.appendChild(p);
    }
  }

  function targetCard(T, t) {
    const card = el("div", "vcard");
    const head = el("div"); head.appendChild(el("strong", "", t.iqn)); head.append("   ", t.enabled ? pill("Enabled", "on") : pill("Disabled", "off"), " ",
      t.auth ? pill("Login required", "on") : pill("No login required", "bad"));
    card.appendChild(head);
    const bar = el("p");
    bar.append(btn("Share a volume\u2026", () => actLunAdd(T, t)), btn("Add address\u2026", () => actPortalAdd(T, t)),
      btn("Allow an initiator\u2026", () => actAclSet(t, null)),
      btn(t.enabled ? "Disable\u2026" : "Enable", () => openOp({ title: (t.enabled ? "Disable " : "Enable ") + t.iqn, op: "tgt-enable", fields: [], build: () => ({ iqn: t.iqn, enable: !t.enabled }) })),
      btn(t.auth ? "Stop requiring login\u2026" : "Require login", () => openOp({ title: "Login requirement", op: "tgt-auth", fields: [],
        intro: t.auth ? "Any allowed initiator will be able to connect without a password." : "Every initiator will need its CHAP login.",
        build: () => ({ iqn: t.iqn, required: !t.auth }), typed: t.auth ? () => "no login" : undefined })),
      btn("Remove target\u2026", () => openOp({ title: `Remove target ${t.iqn}`, op: "tgt-remove", fields: [], build: () => ({ iqn: t.iqn }), typed: () => t.iqn.split(":").pop() || "remove" })));
    card.appendChild(bar);

    card.appendChild(el("strong", "", "Listens on"));
    const pb = table(card, ["Address", "Port", "iSER", ""]);
    if (!t.portals.length) emptyRow(pb, "No address yet, so nobody can connect.");
    for (const p of t.portals) {
      const tr = el("tr"); cell(tr, p.ip === "0.0.0.0" ? "all addresses" : p.ip); cell(tr, String(p.port)); cell(tr, p.iser ? "yes" : "no");
      actions(tr, btn("Remove", () => openOp({ title: `Stop listening on ${p.ip}:${p.port}`, op: "tgt-portal-remove", fields: [], build: () => ({ iqn: t.iqn, ip: p.ip, port: p.port }) })));
      pb.appendChild(tr);
    }
    card.appendChild(el("strong", "", "Volumes (LUNs)"));
    const lb = table(card, ["LUN", "Volume", ""]);
    if (!t.luns.length) emptyRow(lb, "No volumes are shared by this target.");
    for (const l of t.luns) {
      const tr = el("tr"); cell(tr, String(l.lun)); cell(tr, l.backstore);
      actions(tr, btn("Remove\u2026", () => openOp({ title: `Stop sharing LUN ${l.lun}`, op: "tgt-lun-remove", fields: [], build: () => ({ iqn: t.iqn, lun: l.lun }), typed: () => "LUN" + l.lun })));
      lb.appendChild(tr);
    }
    card.appendChild(el("strong", "", "Initiators allowed to connect"));
    const ab = table(card, ["Initiator", "Login", "Access", "Status", ""]);
    if (!t.acls.length) emptyRow(ab, "No initiator is allowed yet.");
    for (const a of t.acls) {
      const tr = el("tr"); cell(tr, a.initiator);
      cell(tr, a.chap ? "CHAP: " + a.chap_user + (a.mutual ? " (mutual)" : "") : "none", a.chap ? "" : "warn");
      cell(tr, a.readonly ? "read-only" : "read and write"); cell(tr, a.connected ? "connected" : "not connected", a.connected ? "" : "muted");
      actions(tr, btn("Edit\u2026", () => actAclSet(t, a)), btn("Remove\u2026", () => openOp({ title: `Stop allowing ${a.initiator}`, op: "tgt-acl-remove", fields: [],
        build: () => ({ iqn: t.iqn, initiator: a.initiator }), typed: () => "remove" })));
      ab.appendChild(tr);
    }
    return card;
  }

  function actBsBlock() {
    const cands = INV.devices.filter((d) => d.can.export);
    openOp({ title: "Share a disk or volume", op: "tgt-backstore-create",
      intro: "Shares a whole device. It must not be mounted or used here. System disks, mounted devices and members of volume groups are not offered.",
      fields: [
        { k: "name", label: "Name for the shared volume", type: "text", placeholder: "data1" },
        { k: "device", label: "Device", type: "select", options: cands.map((d) => [d.path, `${d.path}  (${fmt(d.size)}, ${d.type})`]) },
      ],
      build: (v) => { if (!v.device) throw new Error("No device is free to share."); return { kind: "block", name: v.name.trim(), device: v.device }; } });
  }
  function actBsFile() {
    openOp({ title: "Create an image file to share", op: "tgt-backstore-create",
      intro: "Creates a sparse file that starts small and grows as it is written. It is stored in a root-only folder on this server.",
      fields: [
        { k: "name", label: "Name", type: "text", placeholder: "disk1" },
        { k: "size", label: "Size", type: "text", placeholder: "10G", hint: "Examples: 512M, 10G, 1T" },
      ],
      build: (v) => ({ kind: "file", name: v.name.trim(), size_mib: toMiB(v.size) }) });
  }
  const actBsRemove = (b) => openOp({ title: `Remove the shared volume ${b.name}`, op: "tgt-backstore-remove",
    intro: b.kind === "file" ? "Removes it from the target software." : "The disk keeps all its data.",
    fields: b.kind === "file" ? [{ k: "del", label: "Also delete the image file and its data", type: "checkbox", value: false }] : [],
    build: (v) => ({ name: b.name, delete_file: !!v.del }), typed: () => b.name });
  function actTgtCreate() {
    const T = INV.target;
    openOp({ title: "Create an iSCSI target", op: "tgt-create",
      intro: "A target is what other machines connect to. After creating it, allow the initiators that may connect.",
      fields: [
        { k: "label", label: "Name", type: "text", placeholder: "storage1", hint: "The full name is generated, for example iqn.2026-10.local.yourhost:storage1" },
        { k: "listen", label: "Listen on", type: "select", options: [["0.0.0.0", "All addresses of this server"], ...T.addresses.map((a) => [a, a])] },
        { k: "bs", label: "Volumes to share now (optional)", type: "devices", options: asDevs(T.backstores.filter((b) => !b.used_by.length)) },
        { k: "auth", label: "Require a login (CHAP). Strongly recommended.", type: "checkbox", value: true },
      ],
      build: (v) => ({ label: v.label.trim(), portals: [v.listen + ":3260"], backstores: v.bs, auth: v.auth }) });
  }
  function actLunAdd(T, t) {
    const free = T.backstores.filter((b) => !t.luns.some((l) => l.backstore === b.name));
    openOp({ title: `Share a volume through ${t.iqn}`, op: "tgt-lun-add",
      intro: "Every initiator already allowed on this target gets access to the new volume.",
      fields: [{ k: "bs", label: "Volume", type: "select", options: free.map((b) => [b.name, `${b.name}  (${fmt(b.size)})`]) }],
      build: (v) => { if (!v.bs) throw new Error("There is no unshared volume. Create or share one first."); return { iqn: t.iqn, backstore: v.bs }; } });
  }
  function actPortalAdd(T, t) {
    const iser = INV.iscsi && INV.iscsi.iser && INV.iscsi.iser.ok;
    openOp({ title: `Add an address to ${t.iqn}`, op: "tgt-portal-add",
      intro: "Adding a second address gives initiators a second path, which multipath can use.",
      fields: [
        { k: "ip", label: "Address", type: "select", options: [["0.0.0.0", "All addresses"], ...T.addresses.map((a) => [a, a])] },
        { k: "port", label: "Port", type: "text", value: "3260" },
        { k: "iser", label: "Offer iSER (RDMA) on this address", type: "checkbox", value: false, hint: iser ? "" : "iSER is unavailable here: " + ((INV.iscsi && INV.iscsi.iser && INV.iscsi.iser.reason) || "") },
      ],
      build: (v) => ({ iqn: t.iqn, ip: v.ip, port: Number(v.port), iser: v.iser }) });
  }
  function actAclSet(t, a) {
    const own = (INV.iscsi && INV.iscsi.initiator) || "";
    openOp({ title: a ? `Edit ${a.initiator}` : `Allow an initiator on ${t.iqn}`, op: "tgt-acl-set",
      intro: "Secrets must be 12 to 16 visible characters. The mutual secret must differ from the CHAP secret. Leave the secret fields empty to keep the stored ones.",
      fields: [
        { k: "init", label: "Initiator name", type: "text", value: a ? a.initiator : "", placeholder: own || "iqn.1993-08.org.debian:01:abcdef",
          hint: !a && own ? "This server's own initiator name is " + own : "" },
        { k: "user", label: "CHAP user name", type: "text", value: a ? a.chap_user : "" },
        { k: "pw", label: "CHAP password (12 to 16 characters)", type: "password" },
        { k: "muser", label: "Mutual CHAP user name (optional)", type: "text", value: "" },
        { k: "mpw", label: "Mutual CHAP password (12 to 16 characters)", type: "password" },
        { k: "ro", label: "Read-only access", type: "checkbox", value: a ? a.readonly : false },
        ...(a ? [{ k: "clear", label: "Remove its CHAP login", type: "checkbox", value: false }] : []),
      ],
      build: (v) => {
        if ((v.user.trim() === "") !== (v.pw === "") && !(a && v.pw === "" && v.user.trim() === a.chap_user)) throw new Error("Enter both the CHAP user name and password, or leave both empty.");
        if ((v.muser.trim() === "") !== (v.mpw === "")) throw new Error("Enter both mutual CHAP fields, or neither.");
        return { iqn: t.iqn, initiator: v.init.trim(), readonly: v.ro, clear_chap: !!v.clear,
          chap_user: v.pw ? v.user.trim() : "", chap_pass: v.pw, chap_user_in: v.muser.trim(), chap_pass_in: v.mpw };
      } });
  }
  function actDisc(on) {
    if (!on) { openOp({ title: "Turn off the discovery login", op: "tgt-discovery-auth", fields: [], build: () => ({ enable: false }), typed: () => "no login" }); return; }
    openOp({ title: "Discovery login", op: "tgt-discovery-auth",
      intro: "Initiators must log in before they can even list this server's targets. Secrets must be 12 to 16 visible characters.",
      fields: [
        { k: "user", label: "User name", type: "text", value: "" }, { k: "pw", label: "Password", type: "password" },
        { k: "muser", label: "Mutual user name (optional)", type: "text", value: "" }, { k: "mpw", label: "Mutual password", type: "password" },
      ],
      build: (v) => ({ enable: true, user: v.user.trim(), pass: v.pw, user_in: v.muser.trim(), pass_in: v.mpw }) });
  }
})();
