/* Adds "sign in with an SSH key" to the Terminal page. */
(function () {
  "use strict";
  const q = (id) => document.getElementById(id);
  if (!q("luser") || !q("connect") || typeof SSHKeyUI === "undefined") return;
  const row = q("luser").closest("p");
  const method = document.createElement("select");
  for (const [v, t] of [["password", "Password"], ["key", "SSH key"]]) { const o = document.createElement("option"); o.value = v; o.textContent = t; method.appendChild(o); }
  const ml = document.createElement("label"); ml.append(" Sign in with ", method);
  row.insertBefore(ml, q("connect"));
  const keyBox = document.createElement("div"); keyBox.hidden = true;
  row.after(keyBox);
  const ui = SSHKeyUI.mount(keyBox, { passphrase: false, note: "If the key has a passphrase, the terminal asks for it." });
  method.onchange = () => { keyBox.hidden = method.value !== "key"; };

  function connectKey() {
    if (ws) return;
    const user = q("luser").value.trim();
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(user)) { alert("Invalid user name"); return; }
    let key = ui.getKey();
    if (!key.trim()) { alert("Choose or paste a private key."); return; }
    term.reset();
    fit.fit();
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/api/terminal/ws?u=${encodeURIComponent(user)}&cols=${term.cols}&rows=${term.rows}&auth=key`;
    const sock = new WebSocket(url);
    sock.binaryType = "arraybuffer";
    let opened = false;
    ws = sock;
    setState("connecting\u2026", true);
    sock.onopen = () => {
      opened = true;
      sock.send(JSON.stringify({ type: "key", key }));
      key = ""; ui.clear();
      setState("connected", true);
      term.focus();
    };
    sock.onmessage = (e) => { if (e.data instanceof ArrayBuffer) term.write(new Uint8Array(e.data)); };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      setState("disconnected", false);
      term.write(opened ? "\r\n[connection closed]\r\n"
        : "\r\n[could not connect: not logged in, too many terminals open, or the host key file is missing]\r\n");
    };
  }
  q("connect").onclick = () => (method.value === "key" ? connectKey() : connect());
})();
