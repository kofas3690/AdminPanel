**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.7_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Remote services page.** Pick a machine you listed with `adminpanel-setup add-host` and see its allowed services (nginx, cron, ssh), with start, stop and restart buttons. Every action asks first ("restart nginx on web1?"), runs on that machine through its bridge, and is written to the audit log with the machine's name. If a machine cannot be reached, or its host key has changed, the page says so in plain words. If no machine is listed yet, the page shows the three setup steps. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).
- `GET /api/remote/hosts` returns the listed machines (id, name, address, port only; never the key or user name). It needs a panel login.

### Known limitations
- Only the Services actions work on other machines so far. The other pages, including the Terminal and File manager, still work on this machine only.
