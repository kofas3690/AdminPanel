**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.6.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **Remote services now lives under Servers.** The sidebar has one *Servers* entry with two tabs at the top of the page: **AdminPanel servers** (the list of other AdminPanel servers, as before) and **Remote services** (services, boot state and power for machines you manage over SSH). Both pages work exactly as before; only where you reach them changed.
- *Servers* stays highlighted on both pages, and the sidebar search finds it for `remote`, `ssh`, `bridge`, `reboot` and `shut down`.
- Old bookmarks to `/remote.html` keep working.
