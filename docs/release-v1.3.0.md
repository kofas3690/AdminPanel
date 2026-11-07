**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.3.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The panel can no longer rewrite its own program.** Until now the service account owned `/opt/adminpanel`, so anyone who found a flaw in the panel could change the panel's code and make the change survive a restart. The program files (and the Python environment) are now owned by root. The panel account can write only in `/opt/adminpanel/data`.
- **Everything the panel saves lives in `/opt/adminpanel/data`:** `users.json`, `panel.db` and `audit.log`. The upgrade moves your existing files there by itself (the panel is stopped for a moment while it does), so your administrators, 2FA, sessions and audit history stay as they were.
- `adminpanel-selfcheck` now checks that the panel account cannot change its own program files, and reports data files left in the old place.
- Log rotation of `audit.log` follows the new location.

### For developers
`deploy.sh` keeps the program files root-owned and leaves `data/` alone. `ADMINPANEL_DATA` points the panel at another data folder.
