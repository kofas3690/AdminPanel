**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.1_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Then open `https://SERVER-IP:8443` (or tunnel with `ssh -L 8443:127.0.0.1:8443 USER@SERVER-IP` and use `https://localhost:8443`). Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **SSH key sign-in for the Terminal and File manager.** Both pages now offer **Sign in with: Password / SSH key**. Needed on VPS images that allow only key login.
- **Key pair generator** in the page: Ed25519, optional passphrase, shows the private key once, and gives a ready command that authorizes a restricted public key (`from="127.0.0.1,::1"`, no forwarding), so a stolen copy is useless from any other machine.
- Support for Ed25519, RSA and ECDSA keys in OpenSSH or PEM format, with passphrases. Clear messages for common mistakes: public key pasted by accident, PuTTY `.ppk` file, damaged or oversized key.
- Audit entries record the sign-in method (`key` or `password`), never the key.

### Security
- The key is used once: it is never stored or logged. In the Terminal it is held in an anonymous in-memory file (never written to disk) and passed to a single `ssh` process; a passphrase is typed into the terminal and never passes through the panel.
- Same protections as password sign-in: pinned SSH host key, no `root`, failed-attempt lockout, idle timeout, limits on concurrent terminals. A key that cannot be read does not count toward the lockout.
- The panel does not install keys into accounts on its own. You authorize the key as that account.

### Packaging
- New module `sshkeys` is included in the package (`MODULES` list in `packaging/build.sh`).

### Not included
- FIDO (`sk-`) and DSA keys, ssh-agent forwarding, and remembering keys between sessions.

Full guide: https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md
