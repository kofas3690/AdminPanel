**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.2.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Packages** (a tab beside *Updates*). Search for software, install it, and remove installed packages, with a filter over everything already installed.
- **Look before you change.** Before an install or a removal the page shows apt's own dry run: what will be installed or upgraded, what will be removed, and the disk space involved. Nothing happens until you confirm.
- Changes run in the same background job as updates (they survive a panel restart), with the same live log. Only one job runs at a time. Every change is written to the audit log with the package name.

### Safety
- `adminpanel-apt` (the existing root helper) gains `install NAME` and `remove NAME`. The name is checked again as root: lower-case letters, digits and `+ . -` only, and it must be a real installable package.
- **Removal is refused** if apt's dry run shows it would take out anything the machine needs: the panel itself, `sudo`, SSH, nginx, systemd, apt, dpkg, the C library, Python, networking, boot loader or kernel packages, and any essential or required package. The check is on everything the removal would take with it, not just the name you asked for.
- **An install is refused** if it would remove other packages.
- Packages the system needs show as *Needed by the system* and have no Remove button.
- The sudo rule allows `install *` and `remove *` for this one helper only; the helper rejects anything else. The remote-management account does **not** get these rules.
