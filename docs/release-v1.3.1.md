**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.3.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The audit log is append-only.** `/opt/adminpanel/data/audit.log` is marked append-only (`chattr +a`), so the panel account can add lines but cannot erase, rewrite, rename or delete them, even if the panel is taken over. Only root can lift the mark (`sudo chattr -a /opt/adminpanel/data/audit.log`). The copy in the system journal stays as a second safeguard.
- Weekly log rotation lifts the mark for a moment and sets it again afterwards. Removing the package does the same before it deletes the folder.
- `adminpanel-selfcheck` reports whether the audit log is append-only. On a file system that does not support the mark (rare) it shows a warning and the journal copy remains the safeguard.
