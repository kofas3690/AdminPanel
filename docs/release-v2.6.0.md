**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.6.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Cron jobs** (*Services* → *Cron jobs*). A read-only list of everything scheduled through cron: `/etc/crontab`, the files in `/etc/cron.d`, and the personal crontab of every account. Each job shows its schedule in plain English (for example "At 03:17 on Monday and Friday"), the raw schedule, the next time it will run, who it runs as, the command and where it came from.
- A filter box, the daily/weekly/hourly/monthly scripts in `/etc/cron.*` (with a note if a script is not executable and so is skipped), and the anacron jobs that catch up after downtime.
- A warning when the cron service is not running.
- This page changes nothing. Systemd timers stay on the *Timers* tab of Services.

### Security note
- A new read-only root helper, `adminpanel-cron`, with two exact sudo rules (`list` and `check`). It takes no names from the caller: it lists the crontab directory itself, accepts only plain file names, refuses symlinks and other non-regular files, and caps how much it reads.
- The remote-management account (Servers page) does **not** get these rules.
