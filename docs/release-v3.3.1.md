**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.3.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Terminal: the "Log in as" box no longer starts with a fixed name.** It used to be pre-filled with one built-in user name on every machine. It now starts with the account you connected with last time in this browser, and is empty (with a "username" hint) on a first visit. Pressing Enter in the box connects.
