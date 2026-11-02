**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.4_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from any earlier version: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Dark and Light themes.** Press the **Light** / **Dark** button in the top bar (or in the corner of the sign-in page). Your choice is remembered in that browser; Dark stays the default. The Terminal, the overview and network charts, the log viewer and the file manager follow the theme too, and a change in one browser tab updates the others.
- The package build now checks that `theme.js` is present.
