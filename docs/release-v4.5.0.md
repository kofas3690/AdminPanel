**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.5.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Log cleanup** (a tab on the *Logs* page, next to *Journal*). Shows how much disk the system journal and the rest of `/var/log` use, how much disk is free, and the 15 biggest log files with their last-changed time. You can **trim the journal** to keep at most 100 MB, 500 MB, 1 GB or 2 GB, or only the last 7, 14, 30 or 90 days (it asks first). Full logs are a common reason a small server runs out of disk.

### Security note
- A new root helper, `adminpanel-logclean`, accepts only `status`, `vacuum-size MB` (50 to 102400) and `vacuum-time DAYS` (1 to 3650), with exact sudo rules, and runs journalctl's own vacuum with that number. It reads only file names, sizes and times, never contents, skips links, and never deletes a plain log file. The remote-management account (Servers page) does **not** get these rules.
