**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.8_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Machine facts on the Remote services page.** Choosing a machine now shows its name, system, kernel, uptime, load, memory and disk, read through the same restricted bridge.
- **Service logs.** Each service has a **log** button that shows the last 50, 100, 200 or 500 journal lines of that service on the other machine, with Reload and Close. Only nginx, cron and ssh can be read, nothing else from the journal. Every read is written to the audit log (`remote_logs_read`).
- New bridge operations `system.info` and `logs.tail`; new endpoints `GET /api/remote/info` and `GET /api/remote/logs` (panel login needed).

### Changed
- `adminpanel-setup remote-enable` adds the bridge user to the `systemd-journal` group so logs can be read. **For a machine you already set up, run the same `remote-enable` command once more.**

### Known limitations
- Still read-only apart from the start, stop and restart of the three allowed services. The Terminal, File manager and other pages work on this machine only.
