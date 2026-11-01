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

Full guide: https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md
