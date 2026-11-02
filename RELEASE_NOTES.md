# Release notes

Install guide: [docs/INSTALL.md](docs/INSTALL.md). Upgrading from any earlier version: `sudo apt install ./adminpanel_VERSION_all.deb` then `sudo adminpanel-selfcheck`. Accounts, certificate, port and settings are kept.

---

## v0.9.3: Systemd units start/stop fixed (2026-11-02)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.3_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from 0.9.0, 0.9.1 or 0.9.2: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Starting and stopping system units from the Systemd units page now works.** The page called a root helper, `adminpanel-units`, that was missing from the package, so every action failed. The helper, its sudo rule, and its entries in the build, self-check and uninstall steps are now included.

### Safety rules of the new helper
- It accepts only two requests: `policy NAME` and `act ACTION NAME`. Names and actions are checked again as root, and actions are serialised with a lock.
- Protected units cannot be controlled from the web: the panel itself (`adminpanel*`), D-Bus, the journal, login, udev, networkd and resolved. Targets are view-only.
- `ssh` and `nginx` can be started, restarted or reloaded, but not stopped or disabled, so a click cannot lock you out.
- Every action is written to the system journal (`journalctl -t adminpanel-units`) and to the panel's audit log.
- `adminpanel-selfcheck` now checks that the helper is present and answers.

---

## v0.9.2: security and setup fixes (2026-11-01)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.2_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from 0.9.0 or 0.9.1: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Then open `https://SERVER-IP:8443` (or tunnel with `ssh -L 8443:127.0.0.1:8443 USER@SERVER-IP` and use `https://localhost:8443`). Full guide: [docs/INSTALL.md](docs/INSTALL.md).

### Security
- **The Terminal now refuses `root`** (and any account with UID 0), like the File manager. Opening terminals is limited to 10 per panel user per 5 minutes, which slows password guessing.
- The interactive API docs (`/docs`, `/redoc`, `/openapi.json`) are switched off.
- The audit log is also written to the system journal (`journalctl -t adminpanel-audit`), which the panel account cannot edit, and is rotated weekly (`/etc/logrotate.d/adminpanel`).
- A one-time 2FA code can no longer be used twice by two simultaneous sign-ins.

### Changed
- The panel administrator password needs at least 8 characters (was 12). Setup states the rule before asking, and asks again (up to 3 tries) instead of stopping.
- Removed the unused legacy `/api/files` module, which exposed `/var/log` read-only and pointed at a folder nothing creates.
- `adminpanel-setup` uses private temporary files.
- The package build now fails if the network-manager guard cannot be added.
- `deploy.sh` no longer copies docs, packaging files or machine-specific files into `/opt/adminpanel`.

### Known issues
- The Systemd units page can list units, but starting and stopping them needs a root helper that is not yet packaged. Use the Services page or the command line for now.

---

## v0.9.1: SSH key sign-in

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.1_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Then open `https://SERVER-IP:8443` (or tunnel with `ssh -L 8443:127.0.0.1:8443 USER@SERVER-IP` and use `https://localhost:8443`). Full guide: [docs/INSTALL.md](docs/INSTALL.md).

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

---

## v0.9.0: first public release

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.0_all.deb
sudo adminpanel-setup
sudo adminpanel-selfcheck
```

### Highlights
- **Sign-in:** argon2 passwords, TOTP two-step verification with replay protection, one-time recovery codes, persistent sessions with a session list, lockout counters, HttpOnly / SameSite=Strict / Secure cookies.
- **Dashboard, Services** (system and per-user systemd units with System / User switch), **Logs** (live viewer and journal), **Updates** (APT), **Firewall** (UFW), **Users**.
- **Terminal** (xterm.js over SSH to this machine) and **File manager** (explorer-style SFTP, as a chosen non-root account).
- **Storage administration:** partitions, LVM, RAID (mdadm), LUKS encryption, iSCSI initiator and target, background secure-erase jobs. Destructive actions need password + authenticator unlock, typed confirmations and a preview of the exact commands; one rule protects the system disk.
- **Network manager:** activity, IP configuration, bridges, VLANs, bonds, WireGuard VPN (full tunnel, peer config generator), gateway/NAT, proxies, with automatic rollback.
- **Audit trail** of administrative actions.
- **Modern UI** with a sidebar layout shared by every page.

### Architecture and security
- The API runs as the unprivileged `adminpanel` user on `127.0.0.1:8000`; nginx provides HTTPS (self-signed certificate, login rate limit).
- Privileged work happens in small root-owned helpers in `/usr/local/sbin`, allowed through narrow sudoers rules, each re-validating its input. `adminpanel-selfcheck` verifies that the panel account cannot run arbitrary root commands.

### Packaging
- Debian package for Ubuntu and Debian-based systems (Python 3.10+, systemd), with `adminpanel-setup` (first-run setup) and `adminpanel-selfcheck` (installation check).
- `remove` keeps your data; `purge` deletes the panel's files and account but leaves settings it made for the machine (network files, `/etc/fstab` and `/etc/crypttab` lines marked `adminpanel`, RAID and VPN data).

### Known limitations
- Self-signed certificate (browser warning on first visit).
- The application code under `/opt/adminpanel` is owned by the service account, not root.
- Needs internet during install to download Python packages.
