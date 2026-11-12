**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.1.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Automatic updates** (a tab beside *Updates* and *Packages*). Shows whether the machine installs security updates by itself, with a **Turn on / Turn off** button (turning off asks first), the state of the daily timer, and the end of the last run's log. If the `unattended-upgrades` package is not installed, the page says so and points to the Packages page. Automatic updates never restart the machine; the Overview page still tells you when a restart is needed.

### Security note
- A new root helper, `adminpanel-autoupd`, accepts only `status`, `set on` and `set off`, with exact sudo rules. It writes one file, `/etc/apt/apt.conf.d/20auto-upgrades`, with fixed content (nothing from the caller goes into it), replacing it atomically. The remote-management account (Servers page) does **not** get these rules.
