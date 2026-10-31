/* Shared key picker and key-pair generator for the Terminal and File manager. */
window.SSHKeyUI = (function () {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const btn = (text, fn, cls) => { const b = el("button", cls || "", text); b.type = "button"; b.onclick = fn; return b; };
  let dlg = null, priv = "", onUse = null;

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch (e) { prompt("Copy this:", text); }
  }

  function build() {
    if (dlg) return;
    const st = el("style");
    st.textContent = "#sshgen{background:var(--panel,#24272c);color:var(--text,#e6e8eb);border:1px solid var(--line,#373c43);border-radius:10px;padding:18px 20px;width:min(720px,94vw)}" +
      "#sshgen::backdrop{background:rgba(0,0,0,.6)}#sshgen label{display:block;margin:10px 0}" +
      "#sshgen input[type=text],#sshgen input[type=password]{width:100%;margin-top:4px}" +
      "#sshgen pre{max-height:170px;overflow:auto;white-space:pre-wrap;word-break:break-all}";
    document.head.appendChild(st);
    dlg = el("dialog"); dlg.id = "sshgen";
    document.body.appendChild(dlg);
    dlg.addEventListener("close", () => { priv = ""; onUse = null; dlg.replaceChildren(); });
    dlg.addEventListener("cancel", () => { priv = ""; });
  }

  function showForm() {
    dlg.replaceChildren();
    dlg.appendChild(el("h3", "", "Generate a key pair for the panel"));
    dlg.appendChild(el("p", "muted", "Creates an Ed25519 key pair. The private key is shown once and is not kept on the server. The public key is restricted so it only works from this server itself."));
    const l1 = el("label", "", "Comment "), c = el("input"); c.type = "text"; c.value = "admin-panel"; c.autocomplete = "off"; l1.append(el("br"), c);
    const l2 = el("label", "", "Passphrase for the private key (recommended) "), p = el("input"); p.type = "password"; p.autocomplete = "new-password"; l2.append(el("br"), p);
    const err = el("span", "crit");
    const go = btn("Generate", async () => {
      err.textContent = ""; go.disabled = true;
      const r = await fetch("/api/sshkeys/generate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: c.value.trim(), passphrase: p.value }) });
      p.value = ""; go.disabled = false;
      if (r.status === 401) { location.href = "/login.html"; return; }
      if (!r.ok) { try { err.textContent = (await r.json()).detail; } catch (e) { err.textContent = "Request failed"; } return; }
      showResult(await r.json());
    }, "primary");
    const bar = el("p"); bar.append(go, btn("Cancel", () => dlg.close()), " ", err);
    dlg.append(l1, l2, bar);
  }

  function showResult(d) {
    priv = d.private;
    const cmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '" + d.authorized_line + "' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys";
    dlg.replaceChildren();
    dlg.appendChild(el("h3", "", "Your new key pair"));
    dlg.appendChild(el("p", "warn", "Shown once. Save the private key now. The server does not keep it."));
    dlg.appendChild(el("strong", "", "1. The private key"));
    const pre = el("pre", "", d.private); dlg.appendChild(pre);
    const b1 = el("p");
    b1.append(btn("Copy", () => copy(priv)),
      btn("Download", () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([priv], { type: "text/plain" })); a.download = "panel_key";
        document.body.appendChild(a); a.click(); a.remove();
      }),
      btn("Use this key now", () => { if (onUse) onUse(priv); dlg.close(); }, "primary"));
    dlg.appendChild(b1);
    dlg.appendChild(el("strong", "", "2. Authorize it for the account you will sign in to"));
    dlg.appendChild(el("p", "muted", "Log in to the server as that account (for example over your normal SSH connection) and run this. The panel never installs keys by itself."));
    dlg.appendChild(el("pre", "", cmd));
    const b2 = el("p"); b2.append(btn("Copy command", () => copy(cmd))); dlg.appendChild(b2);
    dlg.appendChild(el("p", "muted", "Fingerprint: " + d.fingerprint + ". The key only works from this server (from=127.0.0.1), so a copy of it is useless from any other machine."));
    dlg.appendChild(btn("Close", () => dlg.close()));
  }

  function mount(parent, opts) {
    opts = opts || {};
    const box = el("div");
    box.style.margin = "8px 0";
    const l1 = el("label", "", "Private key file ");
    const file = el("input"); file.type = "file"; l1.append(file);
    const ta = el("textarea"); ta.rows = 5; ta.spellcheck = false; ta.autocomplete = "off";
    ta.placeholder = "...or paste the whole private key here, from -----BEGIN to -----END";
    ta.style.cssText = "width:100%;font:12px ui-monospace,monospace;margin-top:6px";
    file.onchange = async () => {
      const f = file.files[0];
      if (!f) return;
      if (f.size > 20000) { alert("That file is too large to be a private key."); file.value = ""; return; }
      ta.value = await f.text(); file.value = "";
    };
    box.append(l1, ta);
    let pp = null;
    if (opts.passphrase) {
      const l = el("label", "", "Passphrase of the key (if it has one) ");
      pp = el("input"); pp.type = "password"; pp.autocomplete = "off"; pp.style.width = "100%";
      l.append(el("br"), pp); box.appendChild(l);
    }
    const row = el("p", "muted", (opts.note || "") + " The key is used once to sign in and is never stored or logged. ");
    row.append(btn("Clear", () => { ta.value = ""; if (pp) pp.value = ""; }),
      btn("Generate a key pair\u2026", () => { build(); onUse = (k) => { ta.value = k; }; showForm(); dlg.showModal(); }));
    box.appendChild(row);
    parent.appendChild(box);
    return { el: box, getKey: () => ta.value, getPassphrase: () => (pp ? pp.value : ""),
             clear() { ta.value = ""; if (pp) pp.value = ""; }, clearPassphrase() { if (pp) pp.value = ""; } };
  }
  return { mount };
})();
