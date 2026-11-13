**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.9.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Hosts file** (a tab in the *Networking* group, after *Proxy*). Shows the lines of `/etc/hosts` and lets you add and remove name-to-address entries. The machine checks this file before DNS, so it is handy for pointing a name at a test server, or for blocking a name by sending it to `0.0.0.0`. Entries added here live in one marked block of the file; the system's own lines are shown but never changed. The page refuses a name that is already defined elsewhere in the file and the reserved `localhost` names. The first change saves the original as `/etc/hosts.adminpanel-backup`.

### Security note
- A new root helper, `adminpanel-hosts`, accepts only `list`, `add`, `remove` and `check`, with exact sudo rules. The address is validated as an IP address and the name against a strict host-name pattern; nothing else is accepted. It edits only its own block, writes the file atomically and takes a lock. Every change is recorded in the audit log. The remote-management account (Servers page) does **not** get these rules.
