# 🛡️ AdminPanel

**A web control panel for Ubuntu and Debian servers.** Manage services, updates, firewall, users, storage, networking, logs, files and a terminal from one HTTPS page, protected by a password and two-step verification.

![Dashboard](screenshots/dashboard.png)

> **Status:** version 2.6.0, active development. Install only on machines you control. The panel can change disks, networking and accounts.

---

## Contents

- [Features](#-features)
- [Quick start](#-quick-start)
- [Documentation](#-documentation)
- [How it stays safe](#-how-it-stays-safe)
- [Screenshots](#-screenshots)
- [Building from source](#-building-from-source)
- [Project layout](#-project-layout)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)

---

## ✨ Features

| Area | What you can do |
|---|---|
| **Sign-in** | Password (argon2) + TOTP two-step verification, one-time recovery codes, persistent sessions with a session list, lockout after repeated failures |
| **Dashboard** | CPU, memory, disk, load, uptime |
| **Services** | System and per-user systemd units: start, stop, restart, enable, disable, with System / User switch |
| **Logs** | Live log viewer, journal browser |
| **Updates** | Check for APT updates and run update / upgrade jobs |
| **Firewall** | UFW rules, status, routing rules |
| **Users** | Create, lock, unlock, delete Linux accounts and set passwords |
| **Themes** | Dark and Light, switched from the top bar and remembered per browser |
| **Terminal** | Browser terminal (xterm.js) over SSH to this machine, password or **SSH key** |
| **File manager** | Explorer-style SFTP browser: upload, download, edit, as a chosen non-root account, password or **SSH key** |
| **Storage** | Disks and mounts, partitions, LVM, RAID (mdadm), LUKS encryption, iSCSI initiator and target, secure erase jobs |
| **Network** | Live activity, IP configuration, bridges, VLANs, bonds, WireGuard VPN (including full tunnel, peer config generator), gateway/NAT, proxies, automatic rollback of risky changes |
| **Audit trail** | Every administrative action is written to a JSON-lines audit log |

---

## 🚀 Quick start

Requirements: Ubuntu or Debian (or a derivative) with systemd, Python 3.10 or newer, and internet access during install.

```bash
# 1. Download the latest adminpanel_X.Y.Z_all.deb from the Releases page, then:
sudo apt update
sudo apt install ./adminpanel_2.6.0_all.deb

# 2. First-run setup: certificate, web server, administrator account, two-step verification
sudo adminpanel-setup

# 3. Verify
sudo adminpanel-selfcheck
```

Then open **`https://YOUR-SERVER-IP:8443`** and sign in. The certificate is self-signed, so the browser warns the first time.

On a VPS, the safer option is an SSH tunnel instead of opening port 8443:

```bash
ssh -L 8443:127.0.0.1:8443 YOURUSER@YOUR-SERVER-IP
# then browse to https://localhost:8443
```

➡️ The complete walkthrough, with troubleshooting, is in **[docs/INSTALL.md](docs/INSTALL.md)**.

---

## 📚 Documentation

| Document | Contents |
|---|---|
| [docs/INSTALL.md](docs/INSTALL.md) | Full installation and setup guide: requirements, install, first run, VPS access, SSH keys, upgrade, backup, uninstall, troubleshooting |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | What changed in each version, with upgrade notes |

---

## 🔒 How it stays safe

- **The web application runs as an unprivileged `adminpanel` user**, listening on `127.0.0.1:8000` only. nginx terminates HTTPS in front of it, with a rate limit on login.
- **Privileged actions go through small root helpers** (`/usr/local/sbin/adminpanel-*`) that sudo allows by exact command. Each helper re-validates its input; the panel account cannot run arbitrary commands as root (`adminpanel-selfcheck` tests this).
- **Disk changes need extra proof:** password + authenticator code ("unlock", valid for 10 minutes), typed confirmations, and a preview of the exact commands. One rule protects the system disk from every destructive action.
- **Network changes roll back automatically** unless you confirm them.
- **Terminal and File manager** use a pinned SSH host key, refuse `root`, count failed attempts, and time out when idle. An SSH key you supply is used once and never stored or logged (in the Terminal it lives for up to 30 seconds in a private RAM file).
- **Sessions** use HttpOnly, SameSite=Strict, Secure cookies, and are stored hashed.

Recommendations: keep port 8443 closed to the public internet where possible (use the SSH tunnel or allow only your own IP), keep the system updated, and keep your recovery codes offline.

---

## 🖼️ Screenshots

| | |
|---|---|
| ![Systemd units](screenshots/systemd-units.png) | ![Storage](screenshots/storage-overview.png) |
| ![Network](screenshots/network-management.png) | ![File manager](screenshots/file-manager.png) |
| ![Updates](screenshots/system-updates.png) | ![Terminal](screenshots/terminal.png) |
| ![Overview with Power section and Reboot required chip (1.4)](screenshots/overview-power.png) | ![Remote services with Reboot and Shut down (1.5)](screenshots/remote-services.png) |
| ![Networking, Configuration: interfaces (1.6)](screenshots/network-configuration.png) | ![VPN tab (1.6)](screenshots/vpn.png) |
| ![Proxy tab (1.6)](screenshots/proxy.png) | ![Servers (1.6)](screenshots/servers.png) |
| ![Logs page (1.7)](screenshots/logs.png) | ![Alerts (1.8)](screenshots/alerts.png) |
| ![Alerts, email settings (1.8.1)](screenshots/alerts-email.png) | ![History graphs (1.9)](screenshots/history.png) |
| ![Hardware (2.0)](screenshots/hardware.png) | ![Login history (2.1)](screenshots/logins.png) |
| ![Failed login attempts (2.1)](screenshots/logins-failed.png) | ![Groups (2.2)](screenshots/groups.png) |
| ![Backups (2.3)](screenshots/backups.png) | ![Processes (2.4)](screenshots/processes.png) |

---

## 🔨 Building from source

```bash
git clone https://github.com/kofas3690/AdminPanel.git
cd AdminPanel
bash packaging/build.sh        # produces dist/adminpanel_<version>_all.deb
```

The version comes from `packaging/VERSION`. The build checks that every module is listed, compiles and import-checks the Python code, validates the root helpers and sudoers rules, and refuses to build if anything is missing. When you add a Python module, add it to `MODULES` in `packaging/build.sh`.

`packaging/collect.sh` copies the working files and helpers from a deployed development machine into `packaging/`. `packaging/test-multipass.sh` installs the package in a clean Multipass VM.

### Running from source (development)

The package is the supported install. For development, see [docs/INSTALL.md](docs/INSTALL.md#developing-from-a-git-checkout).

---

## 📁 Project layout

```text
AdminPanel/
├── app.py                 FastAPI application, includes all routers
├── auth.py, store.py      Sign-in, TOTP, sessions (SQLite)
├── audit.py               Audit log
├── system.py, units.py, userunits.py, services.py, logs.py, journal.py, updates.py
├── firewall.py, users.py, security.py
├── storage.py, storage_admin.py, fs.py
├── network.py
├── terminal.py, sshkeys.py
├── create_user.py, enroll_2fa.py
├── static/                HTML, CSS and JS (xterm.js bundled in static/vendor)
├── system/                Reference copies of the root helpers
├── packaging/             build.sh, collect.sh, debian/ scripts, files/, live/ helpers
├── docs/INSTALL.md        Full setup guide
├── RELEASE_NOTES.md
└── screenshots/
```

Installed layout: application in `/opt/adminpanel`, root helpers in `/usr/local/sbin`, sudo rules in `/etc/sudoers.d`, nginx site `adminpanel.conf`, certificate `/etc/ssl/certs/adminpanel.crt`, state in `/var/lib/adminpanel`, service `adminpanel.service`.

---

## 🗺️ Roadmap

- [ ] Backup and restore of panel settings
- [ ] Real domain and Let's Encrypt certificate option in `adminpanel-setup`
- [ ] Root-owned application code (hardening)
- [ ] Offline package with bundled Python wheels
- [ ] Automated tests and release builds with GitHub Actions

---

## 🤝 Contributing

Issues and pull requests are welcome.

```bash
git checkout -b feature/my-change
# make changes, then
bash packaging/build.sh        # must pass
git commit -am "Describe the change"
git push origin feature/my-change
```

---

## 📄 License

This project is licensed under the MIT License.
See the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Kofi Agyapong Agyemang

## 👨‍💻 Author

**Kofi Agyapong Agyemang**: [@kofas3690](https://github.com/kofas3690)
