**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.6.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Websites** (a tab beside *Services*, *Cron jobs*, *Containers* and *Startup*). Lists every site nginx is set up to serve, read from `/etc/nginx/sites-enabled` and `/etc/nginx/conf.d`: the names, the ports it listens on (with an HTTPS tag), what it serves (a folder, another program it passes requests to, PHP or a redirect), its certificate file and which file it comes from. **Test configuration** runs nginx's own check and **Reload nginx** applies a change. The reload is refused when the test fails, so a mistake in a site file cannot take the web server, and this panel, down.

### Security note
- A new root helper, `adminpanel-nginx`, accepts only `list`, `test`, `reload` and `check`, with exact sudo rules. It reads site files and never edits one, and never reloads without a passing `nginx -t`. The panel's own site appears in the list like any other. The remote-management account (Servers page) does **not** get these rules.
