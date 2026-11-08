**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.8.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Alerts.** A new page (System, after Logs) lists problems found on the machine right now:
  - a **disk** that is filling up (warning at 85 %, critical at 95 % by default; each real disk is checked once),
  - **memory** running out (warning at 90 % used),
  - **failed services** (a failed `.service` is critical).
- **An alert count in the top bar** on every page (for example "3 alerts", red when anything is critical). It refreshes once a minute and links to the Alerts page.
- **Settings on the page:** change the three thresholds, and **mute** a service you know is failing and have decided to ignore. Muted services are not counted. Saving settings is written to the audit log.

### Notes
- Alerts only read the machine; nothing is changed or restarted by this page. There is no separate alert history, so the list is always the current state.
- Email notifications are not part of this release. They need mail-server settings and a stored password, so they will come separately.
