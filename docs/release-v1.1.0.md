**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.1.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Remote machines answered "No usable answer from that server".** On a machine set up with `remote-enable`, the bridge could not start, because it was run from `/opt/adminpanel`, a folder only the panel's own account may enter. The bridge now has its own root-owned folder, `/usr/lib/adminpanel-bridge/`, and `remote-enable` points the key there. The panel's account can no longer change the code the bridge runs either.

### Changed
- `remote-enable` needs the 1.1.0 package on the machine (it checks for the new folder) and removes the `adminpanel-remote` user from the `adminpanel` group if an earlier workaround added it.
- **For every machine you set up before:** install 1.1.0 on it and run the same `sudo adminpanel-setup remote-enable '...'` line again. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).
