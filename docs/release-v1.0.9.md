**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.9_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Button labels showing codes.** In the File manager the buttons showed the text `…`, `←`, `→`, `↑` and `⟳` instead of "Connect another…" and the back, forward, up and refresh arrows. The same happened to "Unlock…" and "Create volume group…" on the Storage page and "Import a client config…" on the VPN page. The labels now show the right characters.
