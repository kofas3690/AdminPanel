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
