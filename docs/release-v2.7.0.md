**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.7.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Date & time** (new sidebar entry). Shows the live clock in the machine's time zone, whether network time (NTP) is on and synchronised, and the hostname.
- **Change the time zone** from the list the system knows (with a filter box), **turn network time on or off**, and **change the hostname**. Every change is written to the audit log.
- The time itself cannot be typed in: with network time on the machine keeps it right, and a hand-set clock is a common cause of certificate and login problems.
- Changing the hostname also updates the machine's own `127.0.1.1` line in `/etc/hosts`, so `sudo` does not start complaining that it cannot resolve the new name.

### Security note
- A new root helper, `adminpanel-time`, with exact sudo rules (`timezone *`, `ntp on`, `ntp off`, `hostname *`, `check`). The helper checks every value itself as root: a time zone must be one that `timedatectl` lists, a hostname must be a valid name, and nothing goes through a shell.
- The remote-management account (Servers page) does **not** get these rules.
