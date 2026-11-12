**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Startup** (a tab beside *Services*, *Cron jobs* and *Containers*). Shows how long the last boot took (total, kernel, initrd and services), the 30 services that were slowest to start with a bar for each, and any services that have **failed**. Use it to find out why a machine is slow to boot or which service did not come up.

### Security note
- Read only, and no new root helper or sudo rule: `systemd-analyze` and `systemctl --failed` are readable by any account. Unit names and descriptions are checked and drawn as plain text.
