**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.4.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **The "Reboot required" chip in the top bar now reboots.** After updates that need a restart, click it on any page, type the machine's name and confirm. Before, it only linked to the software updates page. It uses the same confirmation, update check and audit entry as the Reboot button on the Overview page.
