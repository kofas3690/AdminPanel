**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.2_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from 0.9.0 or 0.9.1: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Then open `https://SERVER-IP:8443` (or tunnel with `ssh -L 8443:127.0.0.1:8443 USER@SERVER-IP` and use `https://localhost:8443`). Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

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
