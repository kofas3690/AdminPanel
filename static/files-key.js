/* Adds "sign in with an SSH key" to the File manager's sign-in card. */
(function () {
  "use strict";
  const q = (id) => document.getElementById(id);
  const form = q("lform");
  if (!form || typeof SSHKeyUI === "undefined") return;
  const userLabel = q("luser").closest("label"), pwLabel = q("lpass").closest("label");
  const method = document.createElement("select");
  for (const [v, t] of [["password", "Password"], ["key", "SSH key"]]) { const o = document.createElement("option"); o.value = v; o.textContent = t; method.appendChild(o); }
  const ml = document.createElement("label"); ml.append("Sign in with ", document.createElement("br"), method);
  userLabel.after(ml);
  const keyBox = document.createElement("div"); keyBox.hidden = true;
  pwLabel.after(keyBox);
  const ui = SSHKeyUI.mount(keyBox, { passphrase: true, note: "Use a key that is authorized for this account." });
  method.onchange = () => {
    const key = method.value === "key";
    pwLabel.hidden = key; keyBox.hidden = !key; q("lpass").required = !key;
    q("lmsg").textContent = "";
  };
  form.addEventListener("submit", async (e) => {
    if (method.value !== "key") return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (typeof waitLeft !== "undefined" && waitLeft > 0) return;     // still waiting after wrong attempts
    const user = q("luser").value.trim(), key = ui.getKey(), pass = ui.getPassphrase();
    if (!key.trim()) { q("lmsg").textContent = "Choose or paste a private key."; return; }
    q("lmsg").textContent = "Connecting\u2026";
    const r = await A("/api/fs/connect", { method: "POST", headers: JSON_H,
      body: JSON.stringify({ user, private_key: key, passphrase: pass }) });
    ui.clearPassphrase();
    if (!r.ok) { await showConnectError(r); return; }
    ui.clear();
    const d = await r.json();
    q("lmsg").textContent = "";
    await enter(d.user, d.home);
  }, true);
})();
