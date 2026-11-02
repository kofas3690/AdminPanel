**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.3_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from 0.9.0, 0.9.1 or 0.9.2: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Starting and stopping system units from the Systemd units page now works.** The page called a root helper, `adminpanel-units`, that was missing from the package, so every action failed. The helper, its sudo rule, and its entries in the build, self-check and uninstall steps are now included.

### Safety rules of the new helper
- It accepts only two requests: `policy NAME` and `act ACTION NAME`. Names and actions are checked again as root, and actions are serialised with a lock.
- Protected units cannot be controlled from the web: the panel itself (`adminpanel*`), D-Bus, the journal, login, udev, networkd and resolved. Targets are view-only.
- `ssh` and `nginx` can be started, restarted or reloaded, but not stopped or disabled, so a click cannot lock you out.
- Every action is written to the system journal (`journalctl -t adminpanel-units`) and to the panel's audit log.
- `adminpanel-selfcheck` now checks that the helper is present and answers.
