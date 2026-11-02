**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.5_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from any earlier version: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Live traffic graph on the Networking tab.** A large graph of the last 3 minutes with a labelled rate axis, smooth download (green) and upload (blue) curves with a soft fill, an interface picker (it starts on the interface that carries the default route) and a hover read-out showing the exact rates. It follows the Dark and Light themes. The small per-interface graphs in the table stay.
