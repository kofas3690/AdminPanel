# Release notes

Install guide: [docs/INSTALL.md](docs/INSTALL.md). Upgrading from any earlier version: `sudo apt install ./adminpanel_VERSION_all.deb` then `sudo adminpanel-selfcheck`. Accounts, certificate, port and settings are kept.

---

## v1.0.0: File manager security fixes (2026-11-04)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **A successful File manager sign-in no longer resets the failed-sign-in counter.** The counter is shared with the Terminal, so someone with a panel session and one account they knew the password for could wipe it between guesses at another account. Failures now stay counted until their 5-minute window ends.
- **A burst of simultaneous guesses can no longer get past the limit.** The File manager now counts an attempt before it tries the password (and gives it back if the password turns out to be right, or the SSH server could not be reached), so 30 requests sent at once get at most 5 guesses, not 30.
- **The File manager now uses the per-account limit too.** 10 failures in 5 minutes against one Linux account lock it for the File manager as well as the Terminal, from any browser address.
- **Simultaneous File manager sign-ins can no longer exceed the connection limits** (3 accounts per browser session, 8 in total). Sign-ins still in progress now count towards the limits.
- **Free disk space in a folder is now read as the signed-in account**, not by the panel itself, so it can no longer reveal the free space of folders that account cannot open.

### Fixed
- **File manager sign-in accepts account names with capital letters and dots** (for example `john.doe`). Release 0.9.9 said it did, but the sign-in form still used the old lowercase-only rule. The Terminal was not affected.
- **Saving a file you opened through a symbolic link no longer replaces the link with a regular file.** The editor now writes to the file the link points to and leaves the link alone.
- **Saving a file keeps its owner.** When saving through a temporary file would give the file a different owner, the editor writes the file in place instead.

### Known limitations
- Saving through a temporary file (used when the folder is writable and the owner stays the same) does not carry over extended attributes or ACLs.
- A file whose name contains a line break cannot be downloaded: the server refuses the header and the download fails. It is not a security problem.

---

## v0.9.9: optional SSH group limit, more account names (2026-11-03)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.9_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Limit password sign-in over SSH to one group (optional).** `adminpanel-setup` allows password sign-in over SSH from this machine only, so the Terminal and File manager can work. By default that applies to every account. You can now limit it to the members of one group:

  ```bash
  sudo adminpanel-setup ssh-restrict adminpanel-ssh     # creates the group if it does not exist
  sudo usermod -aG adminpanel-ssh YOURNAME              # add each account that needs the Terminal / File manager
  ```

  Accounts that are not in the group can then no longer sign in to the Terminal or File manager. To go back to "every account", run `sudo adminpanel-setup ssh-restrict off`. The change is checked with `sshd -t` before it is applied and is undone automatically if the SSH server rejects it. Nothing changes unless you run this command, and running `adminpanel-setup` again does not undo it.

### Changed
- **Terminal and File manager accept more Linux account names.** Names with capital letters and dots (for example `john.doe`) now work. A name still has to start with a letter or `_`, so it can never be read as an SSH option.

### Known limitations
- Any panel administrator can still try any non-root account in the Terminal; the account's password is the only gate. With the group limit above, only group members can sign in.

---

## v0.9.8: Terminal security fixes (2026-11-03)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.8_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The pinned SSH host key can no longer be changed by the panel.** The Terminal and File manager check that they are talking to this machine's own SSH server by comparing its host key with a saved copy. That copy was kept in the panel's own folder, so anything that took over the panel could swap it and read passwords typed into the Terminal. It now lives in `/var/lib/adminpanel/ssh_known_hosts`, owned by root, which the panel can read but not change. Upgrading moves it automatically and re-reads the key from the machine's real host key; `adminpanel-selfcheck` fails if the old location is still in use.
- **The Terminal session limit now holds when connections arrive at the same moment.** Before, several simultaneous connections could all pass the limit check, so more than 2 per user (3 in total) could open. The slot is now reserved before the connection is accepted.
- **A failed Terminal sign-in now also counts against the Linux account being tried**, from any browser address: 10 failures in 5 minutes locks that account in the Terminal. The existing limit (5 per browser address and panel user) stays.
- **The Terminal now gives up after 10 seconds** if it cannot reach the SSH server (`ConnectTimeout`).

### Fixed
- A malformed message from the browser (for example a window size of `Infinity`) no longer ends the Terminal session. It is ignored.
- The audit log entry `terminal_close` now includes `auth_failures`, the number of failed sign-ins in that session. The authoritative record of a successful sign-in remains the SSH server's own log (`/var/log/auth.log` or `journalctl -u ssh`).

### Known limitations
- Password sign-in over SSH is still allowed from this machine for every account (the `Match Address 127.0.0.1,::1` rule written by `adminpanel-setup`). Restricting it to a group needs a setup step that adds users to that group, so it is planned for a later release.
- Linux account names with capital letters or dots are not accepted by the Terminal.

---

## v0.9.7: web console address at login (2026-11-03)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.7_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Login message with the web console address.** After you sign in to the server (SSH or console) on Ubuntu, it shows, for example: `AdminPanel Web console: https://testserver1:8443/ or https://192.168.109.133:8443/`. It reads the current port and addresses each time, so it stays correct if you change them. It is installed as `/etc/update-motd.d/90-adminpanel`; edit or delete that file to change or hide the message (your edit is kept on upgrade). On Debian, which does not run `update-motd.d`, the message does not appear.

---

## v0.9.6: security follow-ups (2026-11-03)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.6_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-setup tls      # existing installs: turns on the new security header (keeps your certificate)
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **Terminal sign-in lockout.** Wrong passwords typed into the Terminal now count against the same budget as the File manager: 5 failures in 5 minutes per browser address and panel user, kept across restarts. When the limit is reached the session is closed and new ones are refused until the window passes. Each failure is written to the audit log (`terminal_auth_failed`).
- **Software updates survive a panel restart.** `apt update` and `apt upgrade` now run as their own systemd unit (`adminpanel-apt-job`), so restarting or crashing the panel can no longer kill apt halfway through a package change. A restarted panel re-attaches to the running job and shows its log.
- **Content-Security-Policy.** The panel's pages now run only scripts served by the panel itself (inline scripts were moved to `static/page/*.js`). An existing install gets the header after `sudo adminpanel-setup tls`; `adminpanel-selfcheck` warns until then.

### Changed
- `adminpanel-selfcheck` also checks for `systemd-run` and the CSP header.
- HSTS is not enabled (browsers ignore it for IP addresses, and it would block the self-signed-certificate warning bypass). A commented example is in the nginx site file for use with a real certificate.

---

## v0.9.5: live traffic graph (2026-11-02)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.5_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from any earlier version: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Live traffic graph on the Networking tab.** A large graph of the last 3 minutes with a labelled rate axis, smooth download (green) and upload (blue) curves with a soft fill, an interface picker (it starts on the interface that carries the default route) and a hover read-out showing the exact rates. It follows the Dark and Light themes. The small per-interface graphs in the table stay.

---

## v0.9.4: Dark and Light themes (2026-11-02)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.4_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from any earlier version: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Dark and Light themes.** Press the **Light** / **Dark** button in the top bar (or in the corner of the sign-in page). Your choice is remembered in that browser; Dark stays the default. The Terminal, the overview and network charts, the log viewer and the file manager follow the theme too, and a change in one browser tab updates the others.
- The package build now checks that `theme.js` is present.

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
