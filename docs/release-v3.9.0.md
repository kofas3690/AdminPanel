**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.9.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Listening ports** (a tab beside *Firewall* and *Blocked addresses*). Lists every TCP and UDP port that is waiting for connections, the program that owns it, and whether it is reachable from the **network** or from **this machine only**. A checkbox narrows the list to network-reachable ports, which is the quick way to see what the machine exposes. It is read only: to close a port, stop its service or add a firewall rule.

### Security note
- A new root helper, `adminpanel-ports`, only runs `ss` to list sockets (root is needed to see which program owns each one). It takes no address, port or name from anyone and changes nothing. The remote-management account (Servers page) does **not** get this rule.
