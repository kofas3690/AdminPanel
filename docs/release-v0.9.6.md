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
