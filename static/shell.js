(function () {
  "use strict";
  const NAV = [
    ["System", [["Overview", "/"], ["Services", "/units.html"], ["Storage", "/storage.html"],
                ["Networking", "/network.html"], ["Firewall", "/firewall.html"], ["Accounts", "/users.html"]]],
    ["Tools", [["Software updates", "/updates.html"], ["File manager", "/files.html"],
               ["Terminal", "/terminal.html"]]],
  ];

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const isHere = (href) =>
    location.pathname === href || (href === "/" && location.pathname === "/index.html");

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
    chip.hidden = true;
    const menu = el("div", "menu");
    const sess = el("button", "", "Session \u25be");
    const pop = el("div", "menu-pop");
    pop.hidden = true;
    const who = el("div", "muted", "");
    const out = el("button", "", "Log out");
    pop.append(who, out);
    menu.append(sess, pop);
    top.append(burger, brand, el("div", "spacer"), chip, menu);

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
      for (const [label, href] of items) {
        const a = el("a", isHere(href) ? "on" : "", label);
        a.href = href;
        nav.appendChild(a);
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
          a.hidden = q !== "" && !a.textContent.toLowerCase().includes(q);
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
