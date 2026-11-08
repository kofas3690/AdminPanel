**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.6.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **VPN and Proxy now live under Networking → Configuration.** The sidebar has one *Networking* entry. Its *Configuration* tab has three sub-tabs: **Interfaces**, **VPN** and **Proxy**. The VPN and Proxy pages work exactly as before; only where you reach them changed.
- The *Networking* entry stays highlighted while you are on VPN or Proxy, and the sidebar search still finds them (typing `vpn`, `proxy` or `wireguard` shows *Networking*).
- Old bookmarks to `/vpn.html` and `/proxy.html` keep working.
