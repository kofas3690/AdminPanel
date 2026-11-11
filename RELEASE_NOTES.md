# Release notes

Install guide: [docs/INSTALL.md](docs/INSTALL.md). Upgrading from any earlier version: `sudo apt install ./adminpanel_VERSION_all.deb` then `sudo adminpanel-selfcheck`. Accounts, certificate, port and settings are kept.

---

## v3.2.0: Packages page (2026-11-11)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.2.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Packages** (a tab beside *Updates*). Search for software, install it, and remove installed packages, with a filter over everything already installed.
- **Look before you change.** Before an install or a removal the page shows apt's own dry run: what will be installed or upgraded, what will be removed, and the disk space involved. Nothing happens until you confirm.
- Changes run in the same background job as updates (they survive a panel restart), with the same live log. Only one job runs at a time. Every change is written to the audit log with the package name.

### Safety
- `adminpanel-apt` (the existing root helper) gains `install NAME` and `remove NAME`. The name is checked again as root: lower-case letters, digits and `+ . -` only, and it must be a real installable package.
- **Removal is refused** if apt's dry run shows it would take out anything the machine needs: the panel itself, `sudo`, SSH, nginx, systemd, apt, dpkg, the C library, Python, networking, boot loader or kernel packages, and any essential or required package. The check is on everything the removal would take with it, not just the name you asked for.
- **An install is refused** if it would remove other packages.
- Packages the system needs show as *Needed by the system* and have no Remove button.
- The sudo rule allows `install *` and `remove *` for this one helper only; the helper rejects anything else. The remote-management account does **not** get these rules.

---

## v3.1.0: Sudo activity tab (2026-11-10)

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

---

## v3.0.0: Kernel tab (2026-11-10)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Kernel** (a tab beside *Hardware*). Shows the running kernel, whether it is *tainted* (with each reason in words, such as an out-of-tree or proprietary module), and every loaded module with its size and what uses it, with a filter box.
- **Security settings.** A short table of kernel settings that matter on a server (address-space randomisation, kernel pointer and log restrictions, symlink and hard-link protection, SYN cookies, reverse-path filtering, redirects and others), each marked *As recommended*, *Different* (with the suggested value) or *Info* where the right value depends on the machine's job, such as IP forwarding.

### Notes
- Read only, with no new root helper and no sudo rule: everything comes from `/proc`, which any account can read. Nothing here changes a setting.
- A setting marked *Different* is a prompt to check, not proof of a problem.

---

## v2.9.0: Restart status (2026-11-10)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.9.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Restart status** on the *Software updates* page. It says whether a reboot is needed, how long it has been waiting, which packages asked for it, the running kernel compared with the newest one installed, and how long the machine has been up.
- **Alerts.** A reboot that has been waiting for 7 days or more raises a warning, because the updates are not fully in effect until the machine restarts.

### Notes
- Read only, and no new root helper or sudo rule: everything comes from files any account can read (`/run/reboot-required`, `/run/reboot-required.pkgs`, `/boot`).
- Only kernels of the same flavour as the running one (for example `-generic` or `-aws`) are compared.

---

## v2.8.0: Certificates page (2026-11-10)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.8.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Certificates** (new sidebar entry). A read-only list of the TLS certificates this machine serves: the panel's own, Let's Encrypt, and any that nginx points to. Each shows its names, who issued it (or *Self-signed*), when it expires, how many days are left, and where the file is.
- **Alerts.** A certificate that expires within 21 days raises a warning, within 7 days (or already expired) a critical alert, on the Alerts page and by email if you set that up. The reading is refreshed about once an hour; *Check again* reads it now.
- This page changes nothing and does not renew certificates.

### Security note
- A new read-only root helper, `adminpanel-certs`, with two exact sudo rules (`report` and `check`). It finds the certificate files itself and takes no path from the caller. It only uses the first certificate block of a file and never reads or outputs a private key, and it only follows paths that end up inside `/etc/letsencrypt`, `/etc/ssl`, `/etc/nginx` or `/etc/pki`.
- The remote-management account (Servers page) does **not** get these rules.

---

## v2.7.0: Date & time page (2026-11-10)

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

---

## v2.6.0: Cron jobs view under Services (2026-11-10)

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

---

## v2.5.1: Clearer remote connection errors (2026-11-10)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.5.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept.

### Improved
- **Clearer errors when a remote server can't be reached** (Servers → Remote services, remote reboot, logs). The panel used to say "Could not sign in to that server" for many different problems. It now says what happened: the server refused the panel's key, accepted the connection but didn't answer in time, refused the connection (SSH not running or wrong port), reset or closed the connection, or didn't answer at all (busy, starting up, or a firewall dropping it). Nothing about how the panel connects or what it is allowed to do has changed.

---

## v2.5.0: Disk health (2026-11-09)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.5.0_all.deb
sudo apt install smartmontools      # needed to read disk health; the package only recommends it
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Disk health** (*Storage* → *Health* tab). One row per physical disk with a Good, Warning, Failing, Asleep or Not available badge, the model, type (hard disk, SSD, NVMe), size, temperature, time powered on and, for NVMe, wear. The reasons are shown in plain words, for example "24 reallocated sectors" or "The drive is 93% worn".
- **Alerts.** A failing disk raises a critical alert and a disk with warning signs raises a warning on the Alerts page (and by email if you set that up). The reading is refreshed in the background about once an hour; *Check again* reads it now.
- Disks that are asleep are not woken just to read their health. Virtual and cloud disks usually don't report SMART and show *Not available*.

### Security note
- A new read-only root helper, `adminpanel-smart`, with two exact sudo rules (`report` and `check`). It takes no disk names from the caller: it lists the disks itself and runs `smartctl` with fixed options.
- The remote-management account (Servers page) does **not** get these rules.
- Package: `smartmontools` is now a *recommended* package (not required).

---

## v2.4.0: Processes (2026-11-09)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.4.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Processes** (new sidebar entry, under *Services*). A live list of every process: number, name, user, CPU share, memory, state, start time and command line. Sort by any column, filter by name, user, number or command, hide root and system accounts, and refresh every 3 seconds (stops when the tab is hidden). The top shows totals and the load average.
- **End** and **Force quit** for ordinary programs: *End* asks the program to stop (TERM), *Force quit* stops it at once (KILL). Each asks for confirmation and is written to the audit log with the process, user and signal.

### Security note
- A new root helper, `adminpanel-proc`, with exact sudo rules (`signal *` and a self-check). It refuses processes owned by root or by the panel, core system processes (`systemd`, `sshd`, `dbus-daemon` and similar), the helper itself and process 1. Services are stopped from the Services page, not here.
- The panel sends the process number **and its start time**. The helper opens a handle on the process, checks that it is still the same process, and sends the signal through that handle, so if a program ended and another reused its number, nothing is signalled.
- The remote-management account (Servers page) does **not** get this rule.

---

## v2.3.1: Login history works when the last command is missing (2026-11-09)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.3.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept.

### Fixed
- **Login history** showed "The 'last' command is not installed" as an error and left the whole Sign-ins tab empty. Now the panel looks for `last` on the normal system paths, and when it is missing the *Signed in now* list still works and a note under *History* says how to install it (`sudo apt install util-linux-extra`, or `util-linux` on older Ubuntu). The *Failed attempts* tab never depended on it.

---

## v2.3.0: Backups (2026-11-09)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.3.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Backups** (new sidebar entry, under *Storage*). Choose the folders to save, a schedule (off, every day or every week, from an hour you pick) and how many copies to keep. *Back up now* starts a copy at once; each copy can be checked (the archive is read back to make sure it is not damaged) or deleted.
- Copies are `.tar.gz` files in `/var/backups/adminpanel`, readable only by root. The panel can list, check and delete them but cannot read what is inside, and the page shows the console command to restore.
- The schedule runs from a systemd timer that checks every hour whether a copy is due, so a machine that was off at the chosen hour makes its copy when it is next running. If a backup fails, the existing *failed service* alert on the Alerts page reports it, and the Backups page shows the reason.

### Security note
- A new root helper, `adminpanel-backup`, with exact sudo rules (`status`, `set`, `start`, `verify NAME`, `delete NAME`). The helper checks everything again as root: full paths only, no `..`, the folder must exist, `/proc`, `/sys`, `/dev`, `/run` and the backup folder itself are refused, and file names must match the backup pattern exactly. Settings are saved only by the helper, in a root-only file.
- The remote-management account (Servers page) does **not** get these rules.
- A copy on the same disk does not protect against losing the disk: copy `/var/backups/adminpanel` somewhere else as well.

---

## v2.2.0: Groups (2026-11-09)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.2.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Groups** (under *Accounts*, next to *Users* and *Login history*). See every group with its members, create a group, add an ordinary user to it, remove a user from it, and delete an empty group.
- **Locked on purpose.** Groups that give control of the machine (`sudo`, `adm`, `docker`, `shadow` and similar), system groups (group number below 1000) and administrator accounts cannot be changed from the panel; they show as *manage from console*. A user's main group cannot be removed.
- Every change is written to the audit log (user, group, who did it).

### Security note
- The accounts helper gets four new commands (`mkgroup`, `rmgroup`, `addgroup`, `delgroup`) and a list command (`groups`), each with its own exact sudo rule. The helper checks every name again as root, so a forged request cannot touch a privileged group or an administrator.

---

## v2.1.0: Login history (2026-11-09)

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

---

## v2.0.1: Smoother network graphs (2026-11-09)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.0.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **Smoother network graphs.** The Network card on Overview and the Network chart under *History* now draw smooth curves with a soft fade under the *Down* line, instead of jagged straight segments. The curve never dips below zero or overshoots a spike, and gaps in the history still show as breaks.
- The Network card now uses the same colours as the History chart: blue for *Down*, green for *Up*.

---

## v2.0.0: Hardware information (2026-11-09)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Hardware page** (System, after Storage): what the machine is made of, all in one place.
  - **System:** vendor, model, board, firmware version and date, and whether it is a physical machine or a virtual one.
  - **Processor:** model, sockets, cores, threads, speed range and caches.
  - **Memory:** total, available and swap, and (on real hardware) each **memory module** with its slot, size, type, speed and maker.
  - **Disks:** every disk and its partitions as a tree, with size, model, bus (NVMe, SATA, USB), file system and where it is mounted; SSD/flash and hard disks are told apart.
  - **Temperatures and sensors:** every temperature with its warning and critical limits (a value above its warning limit turns amber, above critical red), fans and battery. Refreshes by itself every five seconds.
  - **PCI devices** (with a filter box, so you can find "ethernet" or "nvidia" quickly) and **USB devices**.
- Where a machine has no such hardware, or a tool is missing, the section says so and how to install it, instead of staying blank. Virtual machines and cloud servers usually show no temperatures and no memory modules; that is normal.

### Security notes
- The page only **reads**. The one thing that needs root, listing the memory modules, goes through a new sudo rule that allows exactly `dmidecode -t memory` and nothing else. The rule is not given to the remote-management user created by `adminpanel-setup remote-enable`.
- Needs the standard tools `pciutils` and `usbutils` (installed by default on Ubuntu Server); `dmidecode` for the memory modules.

---

## v1.9.0: History graphs (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.9.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **History graphs on the Overview page.** Under the four cards there are now four charts: **CPU**, **Memory**, **Disk (/)** and **Network** (down and up). Choose the last hour, 6 hours, 24 hours or 7 days. Hover a chart to read the exact value and time; the latest value is shown at the top right of each chart.
- The panel records **one sample a minute** and keeps **seven days** (about 10,000 small rows in the panel database, well under 1 MB). Longer ranges show averages, so a short spike can look lower on the 7-day view.
- **Gaps are real.** While the panel or the machine is not running nothing is recorded, and the chart shows a break instead of a made-up line. After an install or a reboot the charts start filling within a couple of minutes.

### Notes
- Nothing leaves the machine; the history lives in the panel's own database, and the new `/api/metrics` endpoint needs a signed-in session like every other one.
- The CPU history is calculated separately from the live CPU card, so the two do not disturb each other.

---

## v1.8.1: Email notifications for alerts (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.8.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Email notifications for alerts.** On the Alerts page, under *Email*, enter your mail server, port, user name, password, a *From* address and up to five *To* addresses, tick **Send alert emails**, and press **Send test email** to check that it works.
- While it is on, the panel checks every two minutes and sends **one message** when new problems appear and one when they clear. It does not repeat itself while a problem stays. Muted services are not mailed.
- Works with any mail server that offers STARTTLS (port 587) or SSL (port 465); for Gmail and similar, use an app password.

### Security notes
- The connection **must be encrypted** and the server's certificate is checked; unencrypted mail is refused, so the password never crosses the network in the clear.
- The password is stored in its own file in the data folder (readable only by the panel account), is never sent back to the browser, and is never written to the audit log. Leave the field empty to keep the saved password.
- Addresses, server name and port are validated, so a crafted value cannot add extra mail headers or recipients.
- Saving the settings, test emails and failed sends are written to the audit log.

---

## v1.8.0: Alerts (2026-11-08)

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

---

## v1.7.0: A proper Logs page (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.7.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Logs is now in the sidebar** (System, after Accounts). The journal viewer already existed but had no menu entry, so it could only be reached by typing `/logs.html`.

### Changed
- **The Logs page is rebuilt** to read like a log browser:
  - Newest entries first, grouped under a heading for each day, with a *Reboot* marker where the machine restarted.
  - **Priority** works as "X and above" (Only emergency … Debug and above), so choosing *Error and above* shows errors, critical, alert and emergency together. The default is *Info and above*.
  - **Identifier** drop-down lists every source that has written to the journal (`sshd-session`, `kernel`, `systemd`, …), so you no longer type unit names.
  - Search as you type, and a **Pause** / **Resume** button instead of the Follow checkbox. New entries arrive automatically unless paused.
  - Identical lines that follow each other are folded into one row with a count.
  - Warnings and errors have a warning icon; Download still saves what is shown.
- The journal API gains `ident` (filter by identifier) and `/api/journal/identifiers`. All input is validated as before.

---

## v1.6.1: Remote services under Servers (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.6.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **Remote services now lives under Servers.** The sidebar has one *Servers* entry with two tabs at the top of the page: **AdminPanel servers** (the list of other AdminPanel servers, as before) and **Remote services** (services, boot state and power for machines you manage over SSH). Both pages work exactly as before; only where you reach them changed.
- *Servers* stays highlighted on both pages, and the sidebar search finds it for `remote`, `ssh`, `bridge`, `reboot` and `shut down`.
- Old bookmarks to `/remote.html` keep working.

---

## v1.6.0: VPN and Proxy under Networking (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.6.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **VPN and Proxy now live under Networking → Configuration.** The sidebar has one *Networking* entry. Its *Configuration* tab has three sub-tabs: **Interfaces**, **VPN** and **Proxy**. The VPN and Proxy pages work exactly as before; only where you reach them changed.
- The *Networking* entry stays highlighted while you are on VPN or Proxy, and the sidebar search still finds them (typing `vpn`, `proxy` or `wireguard` shows *Networking*).
- Old bookmarks to `/vpn.html` and `/proxy.html` keep working.

---

## v1.5.1: Fix false update-running refusal (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.5.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Reboot and Shut down said "A software update is running" when none was.** On Ubuntu a background program, `unattended-upgrade-shutdown`, runs all the time, waiting for the machine to shut down. It has the same short process name as a real unattended upgrade, so the check mistook it for one. The check now tells them apart by their command line. This affected the buttons on the Overview page, the *Reboot required* chip, and rebooting other machines; the other machines need the new package too, because the check runs there.
- The refusal now names the process that is running (for example `dpkg`), so you can see what it is waiting for.

### Still protected
A real update (`apt`, `apt-get`, `dpkg` or an unattended upgrade in progress) still blocks Reboot and Shut down until it has finished.

---

## v1.5.0: Reboot and shut down other machines (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.5.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### New
- **Reboot and Shut down for other machines.** On the Remote services page, a new *Power* row under the machine's services. Each button asks you to type the machine's name from the list before it does anything. The panel writes `remote_power` (and `remote_power_failed` if it did not work) to the audit log with who, from where and which machine.
- The machine refuses while a software update (`apt` or `dpkg`) is running there, and says so.
- A machine that is shut down must be started again from outside (power button, or your hosting provider's console).

### To use it on a managed machine
The other machine needs the new package and a refreshed sudo rule:
```bash
sudo apt install ./adminpanel_1.5.0_all.deb
sudo adminpanel-setup remote-enable 'ssh-ed25519 AAAA... adminpanel-central'
```
(the same `remote-enable` line as before; run `sudo adminpanel-setup remote-key` on the central panel to print it again). If you skip this, the button explains what is missing instead of failing silently.

### Under the hood
- The bridge has one new operation, `power.act`, which accepts only `reboot` or `poweroff`. It checks everything first (update running, sudo rule present), sends its answer, and only then starts the shutdown, so the central panel always gets a clear reply.
- The sudo rules are the two added in 1.4.0 (`systemctl --no-block reboot` and `poweroff`, exact arguments); `remote-enable` copies them for the bridge's account.
- The update check and the command now live in `actions.py` and are shared by the local Power buttons and the bridge.

---

## v1.4.1: Reboot from the Reboot required chip (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.4.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **The "Reboot required" chip in the top bar now reboots.** After updates that need a restart, click it on any page, type the machine's name and confirm. Before, it only linked to the software updates page. It uses the same confirmation, update check and audit entry as the Reboot button on the Overview page.

---

## v1.4.0: Reboot and Shut down buttons (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.4.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### New
- **Reboot and Shut down buttons** in a new *Power* section at the bottom of the Overview page. Each asks you to type the machine's own name before it does anything, so a stray click cannot restart a server. A machine that is shut down has to be started again from outside (power button, or your hosting provider's console).
- The buttons refuse while a software update (`apt` or `dpkg`) is running, because stopping one half way can leave packages broken.
- Every attempt is written to the audit log first (`power_action`, `power_refused`, `power_failed`), with who, from where and which machine.

### Under the hood
- New module `power.py` with `POST /api/power/reboot` and `POST /api/power/poweroff`. The command runs after the answer has been sent.
- Two new sudo rules: `systemctl --no-block reboot` and `systemctl --no-block poweroff`, with those exact arguments.
- This works on the machine the panel runs on. Other machines on the Remote services page are not affected.

---

## v1.3.1: Append-only audit log (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.3.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The audit log is append-only.** `/opt/adminpanel/data/audit.log` is marked append-only (`chattr +a`), so the panel account can add lines but cannot erase, rewrite, rename or delete them, even if the panel is taken over. Only root can lift the mark (`sudo chattr -a /opt/adminpanel/data/audit.log`). The copy in the system journal stays as a second safeguard.
- Weekly log rotation lifts the mark for a moment and sets it again afterwards. Removing the package does the same before it deletes the folder.
- `adminpanel-selfcheck` reports whether the audit log is append-only. On a file system that does not support the mark (rare) it shows a warning and the journal copy remains the safeguard.

---

## v1.3.0: Root-owned program files (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.3.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The panel can no longer rewrite its own program.** Until now the service account owned `/opt/adminpanel`, so anyone who found a flaw in the panel could change the panel's code and make the change survive a restart. The program files (and the Python environment) are now owned by root. The panel account can write only in `/opt/adminpanel/data`.
- **Everything the panel saves lives in `/opt/adminpanel/data`:** `users.json`, `panel.db` and `audit.log`. The upgrade moves your existing files there by itself (the panel is stopped for a moment while it does), so your administrators, 2FA, sessions and audit history stay as they were.
- `adminpanel-selfcheck` now checks that the panel account cannot change its own program files, and reports data files left in the old place.
- Log rotation of `audit.log` follows the new location.

### For developers
`deploy.sh` keeps the program files root-owned and leaves `data/` alone. `ADMINPANEL_DATA` points the panel at another data folder.

---

## v1.2.2: Require 2FA and tighten sign-in (2026-11-08)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.2.2_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

**Before you upgrade:** every panel administrator now needs two-step verification. Check with `sudo adminpanel-selfcheck` after upgrading; if it lists an account, run `sudo adminpanel-setup 2fa` on the server (SSH still works, so you cannot be locked out of the machine).

### Security
- **Two-step verification is required to sign in.** An account without it is refused with a message that says what to run. A wrong password still counts as a failed attempt; a right password on an account without 2FA does not.
- **Admin passwords must contain at least one symbol** (for example `!`, `@`, `#`, `-`, `_`). The minimum length stays at 8. This applies when you create an administrator or reset a password; existing passwords keep working.
- **Per-account sign-in limit.** Besides the existing 5 failures per address and user in 5 minutes, an account is now paused after 20 wrong attempts from all addresses together, so guessing from many addresses at once no longer gets unlimited tries.
- **Stricter service settings.** The panel's systemd unit now also blocks kernel module loading, kernel log access, cgroup and clock changes, hostname changes, new namespaces and non-native system calls, and creates files private to the panel by default.
- `adminpanel-selfcheck` reports any administrator without two-step verification.

### Emergency switch
If you ever lose the authenticator and the recovery codes, run `sudo adminpanel-setup 2fa` on the server. As a last resort, set `Environment=ADMINPANEL_ALLOW_NO_2FA=1` in a drop-in for `adminpanel.service`; remove it again afterwards.

---

## v1.2.1: Hide the boot state of ssh (2026-11-07)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.2.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **No boot state for `ssh`.** On Ubuntu 24.04 SSH starts through `ssh.socket`, so the `ssh` service itself reads "disabled" even though SSH comes up at boot. The Services tables no longer show a boot state for `ssh`, because it only looked like a problem.
- **Remote services page text** now says that services can also be set to start at boot.

Nothing needs to be done on the other machines: only the panel machine changes.

---

## v1.2.0: Enable and disable services at boot (2026-11-07)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.2.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Enable and disable at boot.** The Services table on the Overview page and the Remote services page now show whether each service starts at boot ("active/running · boot: enabled") and offer one button to change it: "disable at boot" for an enabled service, "enable at boot" for a disabled one. These only change what happens at the next boot. They never start or stop the service now.
- Works for `nginx` and `cron`, on this machine and on other machines through the bridge. `ssh` is deliberately left out, so a mistake cannot stop you signing in after a reboot.
- Every change is written to the audit log like the other service actions (`service_action`, with `host` and `host_name` for other machines).

### Upgrade notes
- **This machine:** nothing to do. The package installs the new sudo rule.
- **Other machines you manage:** install 1.2.0 there, then run `sudo adminpanel-setup remote-enable 'ssh-ed25519 AAAA... adminpanel-central'` once more. Without it the new buttons answer "This machine's sudo rule is older. Run 'sudo adminpanel-setup remote-enable' there again"; everything else keeps working. The key is the line already in `/var/lib/adminpanel-remote/.ssh/authorized_keys` (its last two fields).

---

## v1.1.1: Audit log names the remote machine (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.1.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Changed
- **Audit log shows the machine's name.** Entries for actions on another machine (`service_action`, `remote_logs_read`) now carry `host_name` (for example `"host_name": "ubuntu"`) next to the short `host` id, so the log can be read without looking the id up. Entries for this machine are unchanged.

Nothing needs to be done on the other machines: only the panel machine changes.

---

## v1.1.0: Run the remote bridge from a root-owned folder (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.1.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Remote machines answered "No usable answer from that server".** On a machine set up with `remote-enable`, the bridge could not start, because it was run from `/opt/adminpanel`, a folder only the panel's own account may enter. The bridge now has its own root-owned folder, `/usr/lib/adminpanel-bridge/`, and `remote-enable` points the key there. The panel's account can no longer change the code the bridge runs either.

### Changed
- `remote-enable` needs the 1.1.0 package on the machine (it checks for the new folder) and removes the `adminpanel-remote` user from the `adminpanel` group if an earlier workaround added it.
- **For every machine you set up before:** install 1.1.0 on it and run the same `sudo adminpanel-setup remote-enable '...'` line again. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).

---

## v1.0.9: Fix button labels (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.9_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Button labels showing codes.** In the File manager the buttons showed the text `…`, `←`, `→`, `↑` and `⟳` instead of "Connect another…" and the back, forward, up and refresh arrows. The same happened to "Unlock…" and "Create volume group…" on the Storage page and "Import a client config…" on the VPN page. The labels now show the right characters.

---

## v1.0.8: Remote server facts and service logs (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.8_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Machine facts on the Remote services page.** Choosing a machine now shows its name, system, kernel, uptime, load, memory and disk, read through the same restricted bridge.
- **Service logs.** Each service has a **log** button that shows the last 50, 100, 200 or 500 journal lines of that service on the other machine, with Reload and Close. Only nginx, cron and ssh can be read, nothing else from the journal. Every read is written to the audit log (`remote_logs_read`).
- New bridge operations `system.info` and `logs.tail`; new endpoints `GET /api/remote/info` and `GET /api/remote/logs` (panel login needed).

### Changed
- `adminpanel-setup remote-enable` adds the bridge user to the `systemd-journal` group so logs can be read. **For a machine you already set up, run the same `remote-enable` command once more.**

### Known limitations
- Still read-only apart from the start, stop and restart of the three allowed services. The Terminal, File manager and other pages work on this machine only.

---

## v1.0.7: Remote services page (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.7_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Remote services page.** Pick a machine you listed with `adminpanel-setup add-host` and see its allowed services (nginx, cron, ssh), with start, stop and restart buttons. Every action asks first ("restart nginx on web1?"), runs on that machine through its bridge, and is written to the audit log with the machine's name. If a machine cannot be reached, or its host key has changed, the page says so in plain words. If no machine is listed yet, the page shows the three setup steps. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).
- `GET /api/remote/hosts` returns the listed machines (id, name, address, port only; never the key or user name). It needs a panel login.

### Known limitations
- Only the Services actions work on other machines so far. The other pages, including the Terminal and File manager, still work on this machine only.

---

## v1.0.6: Remote setup commands (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.6_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Set up other machines with `adminpanel-setup`.** Three steps: `sudo adminpanel-setup remote-key` on the central panel prints a command; run it on the other machine (`remote-enable`) to let the panel's key run the bridge and nothing else; then `sudo adminpanel-setup add-host NAME ADDRESS` on the central panel shows the other machine's SSH host key fingerprint, asks you to confirm it, pins it and tests the connection. Also `list-hosts`, `remove-host NAME` and `remote-disable`. The Servers and Services pages do not use this yet; a host selector comes next. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).

### Security
- The panel's key for other machines and the pinned host keys are root-owned: the panel can read them but cannot change them.
- `remote-enable` accepts only a plain `ssh-ed25519` key line, creates a user with no password, and gives the key a forced command with `restrict`. `add-host` changes nothing unless the fingerprint is confirmed.

---

## v1.0.5: Bridge foundation (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.5_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Foundation for managing other machines from one panel (not visible yet).** A small program, `bridge.py`, can run on another machine over SSH and do only a fixed list of operations (`ping`, `services.list`, `services.act`). The panel has a client for it (`remote.py`) and the Services routes accept `?host=<id>`. There is no host selector and no add-host command yet; they come in the next releases. See [docs/REMOTE.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/REMOTE.md).

### Changed
- The service list and the start/stop/restart logic moved from `services.py` into `actions.py` so the panel and the bridge share one copy. On this machine the commands, the checks and the audit entries are unchanged.

### Security
- The bridge refuses unknown operations, extra arguments, malformed requests and requests over 64 KB, and re-checks the service name and action itself. A remote host's SSH key is checked against a root-owned list of pinned host keys that the panel cannot change.

---

## v1.0.4: Servers page (2026-11-06)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.4_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Servers page (System > Servers).** List the other AdminPanel servers you manage, see at a glance whether each one is up and which version it runs, and open its panel in a new tab. Each server keeps its own administrators, 2FA and audit log; nothing is shared or proxied. Add a server by its address, then confirm its certificate fingerprint against the other machine; if that certificate ever changes the row turns red and has to be accepted again by hand. See [docs/FLEET.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/FLEET.md).
- **`GET /api/health`.** Needs no login and returns only `{"app": "adminpanel", "version": "..."}`. It is what the Servers page asks the other servers.

### Security
- The page only makes `https://` requests, refuses link-local addresses, gives up after 4 seconds, reads at most 4 KB, never follows redirects, and writes every change to the audit log.

### Known limitations
- Panels older than 1.0.4 show as "Not AdminPanel" until they are upgraded.

---

## v1.0.3: File manager review fixes (2026-11-05)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.3_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The File manager no longer shows whether a Linux account exists.** A name that did not exist was turned away at once, while a real account took a moment longer to check, so the difference in time gave the name away. Both now go to the SSH server the same way and answer with the same message.

### Fixed
- **The File manager works when the account's login shell is not bash.** Commands such as copy, move, delete, folder size and free space were sent through the account's login shell with bash-style quoting. In `tcsh` a name containing `!` made them fail, and other shells can treat other characters differently. The commands are now sent as plain letters and digits and run by `/bin/sh`, so every login shell handles them the same way.
- **A file whose name contains a line break can be downloaded.** Before, the download failed because the line break ended up in the response header.
- **Opening a folder with a very large number of files no longer loads the whole folder at once.** The panel reads the listing as it arrives and stops after 100,000 entries (it still shows at most 5,000 and says the list is cut short).

---

## v1.0.2: Terminal SSH key sign-in fix (2026-11-05)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.2_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **Signing in to the Terminal with an SSH key now works.** The Terminal showed `no such identity: /dev/fd/16` and `Permission denied`. The key was handed to `ssh` as an open file, but `ssh` closes every file it did not open itself when it starts, so it never saw the key. The key is now written to a private file (mode 600, in its own mode 700 folder, in RAM under `/dev/shm`) just before `ssh` starts, and removed after 30 seconds or when the session ends, whichever comes first. The File manager's key sign-in was not affected.

### Changed
- The key is no longer described as "held in memory only": for up to 30 seconds it exists as a RAM-backed file readable only by the panel's own account. It is still never logged, and never written to a disk.

---

## v1.0.1: File manager sign-in wait (2026-11-05)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **A wrong password in the File manager no longer sends you back to the main panel login.** The server answered "wrong password" with the same code it uses for "your panel session has ended", so the browser logged you out of the page. A wrong Linux password now stays on the File manager sign-in card and shows an error. The main panel login only appears when your panel session really ended.

### Changed
- **Three tries, then a 30-second wait.** After 3 wrong passwords in a row the File manager sign-in form pauses for 30 seconds. The Connect button counts the seconds down and nothing is sent to the SSH server while you wait (not even a correct password). Each wrong password shows how many tries are left. A correct password resets the count, and the same wait applies to the SSH-key form.
- The existing limit still applies on top: 5 failed sign-ins in 5 minutes (per browser address and panel user), and 10 in 5 minutes per Linux account, lock sign-in for a few minutes. So after the first 3 wrong passwords and the wait, 2 more wrong ones reach that lock.

---

## v1.0.0: File manager security fixes (2026-11-04)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **A successful File manager sign-in no longer resets the failed-sign-in counter.** The counter is shared with the Terminal, so someone with a panel session and one account they knew the password for could wipe it between guesses at another account. Failures now stay counted until their 5-minute window ends.
- **A burst of simultaneous guesses can no longer get past the limit.** The File manager now counts an attempt before it tries the password (and gives it back if the password turns out to be right, or the SSH server could not be reached), so 30 requests sent at once get at most 5 guesses, not 30.
- **The File manager now uses the per-account limit too.** 10 failures in 5 minutes against one Linux account lock it for the File manager as well as the Terminal, from any browser address.
- **Simultaneous File manager sign-ins can no longer exceed the connection limits** (3 accounts per browser session, 8 in total). Sign-ins still in progress now count towards the limits.
- **Free disk space in a folder is now read as the signed-in account**, not by the panel itself, so it can no longer reveal the free space of folders that account cannot open.

### Fixed
- **File manager sign-in accepts account names with capital letters and dots** (for example `john.doe`). Release 0.9.9 said it did, but the sign-in form still used the old lowercase-only rule. The Terminal was not affected.
- **Saving a file you opened through a symbolic link no longer replaces the link with a regular file.** The editor now writes to the file the link points to and leaves the link alone.
- **Saving a file keeps its owner.** When saving through a temporary file would give the file a different owner, the editor writes the file in place instead.

### Known limitations
- Saving through a temporary file (used when the folder is writable and the owner stays the same) does not carry over extended attributes or ACLs.
- A file whose name contains a line break cannot be downloaded: the server refuses the header and the download fails. It is not a security problem.

---

## v0.9.9: optional SSH group limit, more account names (2026-11-03)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.9_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Limit password sign-in over SSH to one group (optional).** `adminpanel-setup` allows password sign-in over SSH from this machine only, so the Terminal and File manager can work. By default that applies to every account. You can now limit it to the members of one group:

  ```bash
  sudo adminpanel-setup ssh-restrict adminpanel-ssh     # creates the group if it does not exist
  sudo usermod -aG adminpanel-ssh YOURNAME              # add each account that needs the Terminal / File manager
  ```

  Accounts that are not in the group can then no longer sign in to the Terminal or File manager. To go back to "every account", run `sudo adminpanel-setup ssh-restrict off`. The change is checked with `sshd -t` before it is applied and is undone automatically if the SSH server rejects it. Nothing changes unless you run this command, and running `adminpanel-setup` again does not undo it.

### Changed
- **Terminal and File manager accept more Linux account names.** Names with capital letters and dots (for example `john.doe`) now work. A name still has to start with a letter or `_`, so it can never be read as an SSH option.

### Known limitations
- Any panel administrator can still try any non-root account in the Terminal; the account's password is the only gate. With the group limit above, only group members can sign in.

---

## v0.9.8: Terminal security fixes (2026-11-03)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.8_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The pinned SSH host key can no longer be changed by the panel.** The Terminal and File manager check that they are talking to this machine's own SSH server by comparing its host key with a saved copy. That copy was kept in the panel's own folder, so anything that took over the panel could swap it and read passwords typed into the Terminal. It now lives in `/var/lib/adminpanel/ssh_known_hosts`, owned by root, which the panel can read but not change. Upgrading moves it automatically and re-reads the key from the machine's real host key; `adminpanel-selfcheck` fails if the old location is still in use.
- **The Terminal session limit now holds when connections arrive at the same moment.** Before, several simultaneous connections could all pass the limit check, so more than 2 per user (3 in total) could open. The slot is now reserved before the connection is accepted.
- **A failed Terminal sign-in now also counts against the Linux account being tried**, from any browser address: 10 failures in 5 minutes locks that account in the Terminal. The existing limit (5 per browser address and panel user) stays.
- **The Terminal now gives up after 10 seconds** if it cannot reach the SSH server (`ConnectTimeout`).

### Fixed
- A malformed message from the browser (for example a window size of `Infinity`) no longer ends the Terminal session. It is ignored.
- The audit log entry `terminal_close` now includes `auth_failures`, the number of failed sign-ins in that session. The authoritative record of a successful sign-in remains the SSH server's own log (`/var/log/auth.log` or `journalctl -u ssh`).

### Known limitations
- Password sign-in over SSH is still allowed from this machine for every account (the `Match Address 127.0.0.1,::1` rule written by `adminpanel-setup`). Restricting it to a group needs a setup step that adds users to that group, so it is planned for a later release.
- Linux account names with capital letters or dots are not accepted by the Terminal.

---

## v0.9.7: web console address at login (2026-11-03)

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

---

## v0.9.6: security follow-ups (2026-11-03)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.6_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-setup tls      # existing installs: turns on the new security header (keeps your certificate)
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **Terminal sign-in lockout.** Wrong passwords typed into the Terminal now count against the same budget as the File manager: 5 failures in 5 minutes per browser address and panel user, kept across restarts. When the limit is reached the session is closed and new ones are refused until the window passes. Each failure is written to the audit log (`terminal_auth_failed`).
- **Software updates survive a panel restart.** `apt update` and `apt upgrade` now run as their own systemd unit (`adminpanel-apt-job`), so restarting or crashing the panel can no longer kill apt halfway through a package change. A restarted panel re-attaches to the running job and shows its log.
- **Content-Security-Policy.** The panel's pages now run only scripts served by the panel itself (inline scripts were moved to `static/page/*.js`). An existing install gets the header after `sudo adminpanel-setup tls`; `adminpanel-selfcheck` warns until then.

### Changed
- `adminpanel-selfcheck` also checks for `systemd-run` and the CSP header.
- HSTS is not enabled (browsers ignore it for IP addresses, and it would block the self-signed-certificate warning bypass). A commented example is in the nginx site file for use with a real certificate.

---

## v0.9.5: live traffic graph (2026-11-02)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.5_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from any earlier version: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Live traffic graph on the Networking tab.** A large graph of the last 3 minutes with a labelled rate axis, smooth download (green) and upload (blue) curves with a soft fill, an interface picker (it starts on the interface that carries the default route) and a hover read-out showing the exact rates. It follows the Dark and Light themes. The small per-interface graphs in the table stay.

---

## v0.9.4: Dark and Light themes (2026-11-02)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.4_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from any earlier version: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Dark and Light themes.** Press the **Light** / **Dark** button in the top bar (or in the corner of the sign-in page). Your choice is remembered in that browser; Dark stays the default. The Terminal, the overview and network charts, the log viewer and the file manager follow the theme too, and a change in one browser tab updates the others.
- The package build now checks that `theme.js` is present.

---

## v0.9.3: Systemd units start/stop fixed (2026-11-02)

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

---

## v0.9.2: security and setup fixes (2026-11-01)

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.2_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Upgrading from 0.9.0 or 0.9.1: the same `apt install` line, then `sudo adminpanel-selfcheck`. Your accounts, certificate, port and settings are kept. Then open `https://SERVER-IP:8443` (or tunnel with `ssh -L 8443:127.0.0.1:8443 USER@SERVER-IP` and use `https://localhost:8443`). Full guide: [docs/INSTALL.md](docs/INSTALL.md).

### Security
- **The Terminal now refuses `root`** (and any account with UID 0), like the File manager. Opening terminals is limited to 10 per panel user per 5 minutes, which slows password guessing.
- The interactive API docs (`/docs`, `/redoc`, `/openapi.json`) are switched off.
- The audit log is also written to the system journal (`journalctl -t adminpanel-audit`), which the panel account cannot edit, and is rotated weekly (`/etc/logrotate.d/adminpanel`).
- A one-time 2FA code can no longer be used twice by two simultaneous sign-ins.

### Changed
- The panel administrator password needs at least 8 characters (was 12). Setup states the rule before asking, and asks again (up to 3 tries) instead of stopping.
- Removed the unused legacy `/api/files` module, which exposed `/var/log` read-only and pointed at a folder nothing creates.
- `adminpanel-setup` uses private temporary files.
- The package build now fails if the network-manager guard cannot be added.
- `deploy.sh` no longer copies docs, packaging files or machine-specific files into `/opt/adminpanel`.

### Known issues
- The Systemd units page can list units, but starting and stopping them needs a root helper that is not yet packaged. Use the Services page or the command line for now.

---

## v0.9.1: SSH key sign-in

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.1_all.deb
sudo adminpanel-setup          # first install only
sudo adminpanel-selfcheck
```

Then open `https://SERVER-IP:8443` (or tunnel with `ssh -L 8443:127.0.0.1:8443 USER@SERVER-IP` and use `https://localhost:8443`). Full guide: [docs/INSTALL.md](docs/INSTALL.md).

### Added
- **SSH key sign-in for the Terminal and File manager.** Both pages now offer **Sign in with: Password / SSH key**. Needed on VPS images that allow only key login.
- **Key pair generator** in the page: Ed25519, optional passphrase, shows the private key once, and gives a ready command that authorizes a restricted public key (`from="127.0.0.1,::1"`, no forwarding), so a stolen copy is useless from any other machine.
- Support for Ed25519, RSA and ECDSA keys in OpenSSH or PEM format, with passphrases. Clear messages for common mistakes: public key pasted by accident, PuTTY `.ppk` file, damaged or oversized key.
- Audit entries record the sign-in method (`key` or `password`), never the key.

### Security
- The key is used once: it is never stored or logged. In the Terminal it is held in an anonymous in-memory file (never written to disk) and passed to a single `ssh` process; a passphrase is typed into the terminal and never passes through the panel.
- Same protections as password sign-in: pinned SSH host key, no `root`, failed-attempt lockout, idle timeout, limits on concurrent terminals. A key that cannot be read does not count toward the lockout.
- The panel does not install keys into accounts on its own. You authorize the key as that account.

### Packaging
- New module `sshkeys` is included in the package (`MODULES` list in `packaging/build.sh`).

### Not included
- FIDO (`sk-`) and DSA keys, ssh-agent forwarding, and remembering keys between sessions.

---

## v0.9.0: first public release

**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.0_all.deb
sudo adminpanel-setup
sudo adminpanel-selfcheck
```

### Highlights
- **Sign-in:** argon2 passwords, TOTP two-step verification with replay protection, one-time recovery codes, persistent sessions with a session list, lockout counters, HttpOnly / SameSite=Strict / Secure cookies.
- **Dashboard, Services** (system and per-user systemd units with System / User switch), **Logs** (live viewer and journal), **Updates** (APT), **Firewall** (UFW), **Users**.
- **Terminal** (xterm.js over SSH to this machine) and **File manager** (explorer-style SFTP, as a chosen non-root account).
- **Storage administration:** partitions, LVM, RAID (mdadm), LUKS encryption, iSCSI initiator and target, background secure-erase jobs. Destructive actions need password + authenticator unlock, typed confirmations and a preview of the exact commands; one rule protects the system disk.
- **Network manager:** activity, IP configuration, bridges, VLANs, bonds, WireGuard VPN (full tunnel, peer config generator), gateway/NAT, proxies, with automatic rollback.
- **Audit trail** of administrative actions.
- **Modern UI** with a sidebar layout shared by every page.

### Architecture and security
- The API runs as the unprivileged `adminpanel` user on `127.0.0.1:8000`; nginx provides HTTPS (self-signed certificate, login rate limit).
- Privileged work happens in small root-owned helpers in `/usr/local/sbin`, allowed through narrow sudoers rules, each re-validating its input. `adminpanel-selfcheck` verifies that the panel account cannot run arbitrary root commands.

### Packaging
- Debian package for Ubuntu and Debian-based systems (Python 3.10+, systemd), with `adminpanel-setup` (first-run setup) and `adminpanel-selfcheck` (installation check).
- `remove` keeps your data; `purge` deletes the panel's files and account but leaves settings it made for the machine (network files, `/etc/fstab` and `/etc/crypttab` lines marked `adminpanel`, RAID and VPN data).

### Known limitations
- Self-signed certificate (browser warning on first visit).
- The application code under `/opt/adminpanel` is owned by the service account, not root.
- Needs internet during install to download Python packages.
