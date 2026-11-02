/* Dark / Light theme.
   Loaded first on every page (no "defer"), so the theme is set before anything is drawn.
   The choice is kept in this browser only (localStorage). Dark is the default. */
(function () {
  "use strict";
  const KEY = "adminpanel-theme";
  const root = document.documentElement;

  function stored() {
    try {
      const v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) { return null; }          // storage blocked or private window
  }
  function get() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  function apply(t) { root.setAttribute("data-theme", t); }
  function announce() { window.dispatchEvent(new CustomEvent("themechange", { detail: get() })); }
  function set(t) {
    t = t === "light" ? "light" : "dark";
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t);
    announce();
  }
  function toggle() { set(get() === "light" ? "dark" : "light"); }
  /* Current value of a CSS variable, for things drawn in JavaScript (charts, terminal). */
  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  /* A button that shows the theme you would switch to. */
  function button(extraClass) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "themebtn" + (extraClass ? " " + extraClass : "");
    const paint = () => {
      const light = get() === "light";
      b.textContent = light ? "☾ Dark" : "☀ Light";
      b.title = light ? "Switch to the dark theme" : "Switch to the light theme";
      b.setAttribute("aria-label", b.title);
    };
    b.addEventListener("click", toggle);
    window.addEventListener("themechange", paint);
    paint();
    return b;
  }

  apply(stored() || "dark");

  /* Another tab changed the theme: follow it. */
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { apply(stored() || "dark"); announce(); }
  });

  window.AdminTheme = { get, set, toggle, css, button };

  /* The sign-in page has no top bar, so it gets a small floating button. */
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body && document.body.classList.contains("login"))
      document.body.appendChild(button("float"));
  });
})();
