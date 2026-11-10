**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.1.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Sudo activity** (a tab under *Accounts*, beside *Login history*). Shows who used `sudo` in the last 24 hours, 7 days or 30 days, what they ran, in which directory, and as which user. A summary by person shows how many commands each ran and how many were refused.
- Refusals are marked: *Not allowed* (the user may not use sudo, or not that command) and *Wrong password* with the number of attempts.
- A filter box for the recent list.
- The panel's own use of `sudo` (its fixed root helpers, many times a day) is hidden by default, with a count of how many were hidden; a checkbox shows them.

### Notes
- Read only, from the system journal, which the panel already reads for logs and failed logins. No new root helper and no sudo rule.
- Commands are shown exactly as sudo logged them, as plain text.
