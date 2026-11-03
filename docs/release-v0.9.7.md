**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.7_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Login message with the web console address.** After you sign in to the server (SSH or console) on Ubuntu, it shows, for example: `AdminPanel Web console: https://testserver1:8443/ or https://192.168.109.133:8443/`. It reads the current port and addresses each time, so it stays correct if you change them. It is installed as `/etc/update-motd.d/90-adminpanel`; edit or delete that file to change or hide the message (your edit is kept on upgrade). On Debian, which does not run `update-motd.d`, the message does not appear.
