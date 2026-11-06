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
