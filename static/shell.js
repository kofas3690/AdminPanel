(function () {
  "use strict";
  const NAV = [
    ["System", [["Overview", "/"], ["Servers", "/fleet.html", "remote services ssh bridge reboot shut down panels"], ["Services", "/units.html", "systemd units cron crontab scheduled jobs anacron docker containers startup boot time slow failed services systemd-analyze blame websites nginx sites web server virtual host reload"], ["Processes", "/processes.html", "top task manager cpu memory kill end process htop"], ["Storage", "/storage.html", "disk space usage du large files what is using space network share smb cifs nas windows mount swap swapfile memory out of memory oom swappiness"], ["Backups", "/backups.html", "backup restore copy archive tar schedule nas smb network share"],
                ["Hardware", "/hardware.html", "cpu processor memory ram dimm disks pci usb temperature sensors gpu model kernel modules lsmod sysctl taint"],
                ["Date & time", "/clock.html", "clock timezone time zone ntp hostname name date chrony"], ["Networking", "/network.html", "vpn proxy wireguard interfaces dns"], ["Firewall", "/firewall.html", "ufw fail2ban banned blocked ip addresses unban brute force jail listening open ports netstat ss exposed"], ["Certificates", "/certs.html", "tls ssl https expiry expire lets encrypt letsencrypt nginx renew"], ["Accounts", "/users.html", "sudo sudoers privilege login history sign-in failed attempts ssh brute force users groups members security check audit hardening root login password ssh keys authorized_keys public key passwordless login"],
                ["Logs", "/logs.html", "journal journalctl errors messages syslog log cleanup vacuum disk full big logs rotate trim"],
                ["Alerts", "/alerts.html", "warnings disk full memory failed services problems notifications"]]],
    ["Tools", [["Software updates", "/updates.html", "apt upgrade packages automatic updates unattended upgrades security patches"], ["File manager", "/files.html"],
               ["Terminal", "/terminal.html"]]],
  ];

  // Reboot or shut down this machine, after the person types its name. Used by the Overview page and
  // by the "Reboot required" chip. Returns the answer text, or null if they cancelled.
  window.AdminPower = {
    async run(action) {
      const label = action === "reboot" ? "Reboot" : "Shut down";
      const host = (await (await fetch("/api/system")).json()).hostname;
      const typed = prompt(label + " this machine now?\nType its name (" + host + ") to confirm.");
      if (typed === null) return null;
      const r = await fetch("/api/power/" + action, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: typed }) });
      if (r.status === 401) { location.href = "/login.html"; return null; }
      try { const j = await r.json(); return j.message || j.detail || "Request failed"; } catch (e) { return "Request failed"; }
    },
  };

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  // VPN and Proxy are tabs under Networking, so that sidebar entry stays highlighted on their pages.
  const SUBPAGES = { "/vpn.html": "/network.html", "/proxy.html": "/network.html", "/remote.html": "/fleet.html", "/logins.html": "/users.html", "/groups.html": "/users.html", "/cron.html": "/units.html", "/kernel.html": "/hardware.html", "/sudo.html": "/users.html", "/seccheck.html": "/users.html", "/logclean.html": "/logs.html", "/sshkeys.html": "/users.html", "/packages.html": "/updates.html", "/autoupdates.html": "/updates.html", "/usage.html": "/storage.html", "/shares.html": "/storage.html", "/swap.html": "/storage.html", "/containers.html": "/units.html", "/startup.html": "/units.html", "/websites.html": "/units.html", "/blocked.html": "/firewall.html", "/listening.html": "/firewall.html" };
  const isHere = (href) =>
    location.pathname === href || SUBPAGES[location.pathname] === href || (href === "/" && location.pathname === "/index.html");

  function build() {
    // The old "Back" links are replaced by the sidebar.
    for (const p of Array.from(document.body.children)) {
      const a = p.tagName === "P" ? p.firstElementChild : null;
      if (a && a.tagName === "A" && a.getAttribute("href") === "/" &&
          p.textContent.trim().startsWith("\u2190")) p.remove();
    }

    /* top bar */
    const top = el("header", "topbar");
    const burger = el("button", "burger", "\u2630");
    burger.setAttribute("aria-label", "Menu");
    const brand = el("div", "brand");
    const bu = el("span", "u", ""), bh = el("strong", "h", "\u2026");
    brand.append(bu, bh);
    const chip = el("a", "chip warn", "Reboot required");
    chip.href = "/updates.html";
    chip.title = "Click to reboot this machine now";
    chip.onclick = async (e) => {
      e.preventDefault();
      const msg = await window.AdminPower.run("reboot");
      if (msg) alert(msg);
    };
    chip.hidden = true;
    // Problems found on this machine (disk, memory, failed services); hidden when there are none.
    const alertChip = el("a", "chip warn", "");
    alertChip.href = "/alerts.html";
    alertChip.hidden = true;
    const menu = el("div", "menu");
    const sess = el("button", "", "Session \u25be");
    const pop = el("div", "menu-pop");
    pop.hidden = true;
    const who = el("div", "muted", "");
    const out = el("button", "", "Log out");
    pop.append(who, out);
    menu.append(sess, pop);
    const themeBtn = window.AdminTheme ? window.AdminTheme.button() : null;
    top.append(burger, brand, el("div", "spacer"), alertChip, chip);
    if (themeBtn) top.append(themeBtn);
    top.append(menu);

    /* sidebar */
    const side = el("aside", "side");
    const search = el("input", "navsearch");
    search.type = "search";
    search.placeholder = "Search";
    search.setAttribute("aria-label", "Search pages");
    const nav = el("nav", "nav");
    const groups = [];
    for (const [name, items] of NAV) {
      const g = { h: el("h4", "", name), links: [] };
      nav.appendChild(g.h);
      for (const [label, href, words] of items) {
        const a = el("a", isHere(href) ? "on" : "", label);
        a.href = href;
        nav.appendChild(a);
        a.dataset.words = words || "";
        g.links.push(a);
      }
      groups.push(g);
    }
    side.append(search, nav);
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      for (const g of groups) {
        let shown = 0;
        for (const a of g.links) {
          a.hidden = q !== "" && !(a.textContent + " " + a.dataset.words).toLowerCase().includes(q);
          if (!a.hidden) shown++;
        }
        g.h.hidden = shown === 0;
      }
    });

    /* page content */
    const content = el("main", "content");
    for (const n of Array.from(document.body.childNodes)) {
      if (n.nodeType === 1 && ["SCRIPT", "STYLE", "LINK"].includes(n.tagName)) continue;
      content.appendChild(n);
    }
    const app = el("div", "app");
    app.append(top, side, content);
    document.body.insertBefore(app, document.body.firstChild);

    /* behaviour */
    sess.onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; };
    burger.onclick = (e) => { e.stopPropagation(); document.body.classList.toggle("nav-open"); };
    document.addEventListener("click", () => { pop.hidden = true; });
    content.addEventListener("click", () => document.body.classList.remove("nav-open"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { pop.hidden = true; document.body.classList.remove("nav-open"); }
    });
    out.onclick = async () => {
      try { await fetch("/api/logout", { method: "POST" }); } catch (e) {}
      location.href = "/login.html";
    };

    document.body.classList.add("ready");
    window.dispatchEvent(new Event("resize"));   // lets the terminal re-measure its new width

    fetch("/api/system").then(async (r) => {
      if (r.status === 401) { location.href = "/login.html"; return; }
      if (!r.ok) return;
      const d = await r.json();
      bu.textContent = d.panel_user + "@";
      bh.textContent = d.hostname;
      who.textContent = "Signed in as " + d.panel_user;
      chip.hidden = !d.reboot_required;
    }).catch(() => {});

    const checkAlerts = () => {
      if (document.hidden) return;
      fetch("/api/alerts").then(async (r) => {
        if (!r.ok) return;
        const a = await r.json(), total = a.critical + a.warning;
        alertChip.hidden = total === 0;
        if (total) {
          alertChip.textContent = total + (total === 1 ? " alert" : " alerts");
          alertChip.style.color = a.critical ? "var(--crit)" : "";
          alertChip.style.borderColor = a.critical ? "var(--crit)" : "";
          alertChip.title = a.critical + " critical, " + a.warning + " warning";
        }
      }).catch(() => {});
    };
    checkAlerts();
    setInterval(checkAlerts, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
