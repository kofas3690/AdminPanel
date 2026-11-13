**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.8.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Web logs** (a tab in the *Services* group, next to *Websites*). Shows the end of the nginx log files (access, error and rotated `.log.1` files) with a choice of 50, 100, 300 or 1000 lines and an optional "only lines containing" filter. **Summarise** reads the last 5000 requests of an access log and shows how many were answered with 2xx, 3xx, 4xx and 5xx, the busiest addresses and the most requested paths. Access logs contain visitors' addresses, so the page says to treat them as private. If nginx has no logs the page says so.

### Security note
- A new root helper, `adminpanel-weblogs`, only reads. It accepts `list`, `tail`, `summary` and `check`, with exact sudo rules, and only opens regular files from its own listing in `/var/log/nginx` (no links, no directories, no paths). The filter is sent on standard input and matched as plain text. The remote-management account (Servers page) does **not** get these rules.
