**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.1.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Login history** (under *Accounts*, next to *Users*). A read-only page with two tabs:
  - *Sign-ins*: who is signed in on a terminal now, and a filterable history of past logins (user, terminal, address, time, duration, and whether a session ended in a crash or shutdown).
  - *Failed attempts*: failed SSH password and key attempts over the last 24 hours, 7 days or 30 days, grouped by source address with the user names tried, plus the latest individual attempts.
- No new permissions: it reads the system login record and the journal that the panel already reads. Nothing is changed by this page.
